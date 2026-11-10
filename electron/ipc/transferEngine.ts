import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { pipeline } from 'stream/promises'
import { safeEnsureDir } from '../utils'

export interface TransferProgressData {
  operationId: string
  type: 'copy' | 'move'
  currentFile: string
  currentDir: string
  itemsDone: number
  totalItems: number
  bytesTransferred: number
  totalBytes: number
  bytesRemaining: number
  speedBytesPerSec: number
  etaSeconds: number
  elapsedSeconds: number
  percent: number
  isDone?: boolean
  error?: string
  canceled?: boolean
}

interface TransferItem {
  src: string
  dest: string
  relPath: string
  isDirectory: boolean
  size: number
}

// Active controllers to support cancellation
const activeTransfers = new Map<string, AbortController>()

export function cancelTransfer(operationId: string): boolean {
  const controller = activeTransfers.get(operationId)
  if (controller) {
    controller.abort()
    activeTransfers.delete(operationId)
    return true
  }
  return false
}

async function collectItems(srcPath: string, destBasePath: string, relPath: string = ''): Promise<TransferItem[]> {
  const items: TransferItem[] = []
  const stat = await fsPromises.stat(srcPath)

  if (stat.isDirectory()) {
    items.push({
      src: srcPath,
      dest: path.join(destBasePath, relPath),
      relPath,
      isDirectory: true,
      size: 0,
    })

    const entries = await fsPromises.readdir(srcPath, { withFileTypes: true })
    for (const entry of entries) {
      const childSrc = path.join(srcPath, entry.name)
      const childRel = relPath ? path.join(relPath, entry.name) : entry.name
      const childItems = await collectItems(childSrc, destBasePath, childRel)
      items.push(...childItems)
    }
  } else {
    items.push({
      src: srcPath,
      dest: path.join(destBasePath, relPath),
      relPath,
      isDirectory: false,
      size: stat.size,
    })
  }

  return items
}

export async function executeCopyMove(options: {
  operationId: string
  type: 'copy' | 'move'
  sources: string[]
  destinationDir: string
  onProgress: (data: TransferProgressData) => void
}): Promise<{ success: boolean; canceled?: boolean; error?: string }> {
  const { operationId, type, sources, destinationDir, onProgress } = options

  const abortController = new AbortController()
  activeTransfers.set(operationId, abortController)
  const { signal } = abortController

  try {
    await safeEnsureDir(destinationDir)

    // 1. Fast pre-scan all items
    const allItems: TransferItem[] = []
    for (const src of sources) {
      if (signal.aborted) break
      try {
        const baseName = path.basename(src)
        let destTargetName = baseName

        // If copying into same directory, append "- Копія"
        if (path.dirname(src).toLowerCase() === destinationDir.toLowerCase()) {
          const ext = path.extname(baseName)
          const nameWithoutExt = path.basename(baseName, ext)
          destTargetName = `${nameWithoutExt} - Копія${ext}`
        }

        const items = await collectItems(src, path.join(destinationDir, destTargetName), '')
        allItems.push(...items)
      } catch (err: any) {
        return { success: false, error: `Помилка доступу до "${src}": ${err.message}` }
      }
    }

    if (signal.aborted) {
      return { success: false, canceled: true }
    }

    const totalFiles = allItems.filter((i) => !i.isDirectory).length
    const totalItems = allItems.length
    const totalBytes = allItems.reduce((acc, it) => acc + (it.isDirectory ? 0 : it.size), 0)

    let itemsDone = 0
    let bytesTransferred = 0
    const startTime = Date.now()
    let lastIpcEmitTime = 0
    let lastEtaUpdateTime = 0
    let smoothedSpeed = 0
    let smoothedEtaSeconds = -1

    interface SpeedSample {
      time: number
      bytes: number
    }
    const speedSamples: SpeedSample[] = [{ time: startTime, bytes: 0 }]

    const SPEED_WINDOW_MS = 2500 // 2.5-second sliding window for speed estimation
    const IPC_THROTTLE_MS = 200 // Max 5 IPC updates per second for UI stability and low CPU
    const ETA_UPDATE_INTERVAL_MS = 1000 // Update ETA calculation at most once per second

    function updateSpeedAndEta(now: number, isDone = false) {
      if (isDone) {
        smoothedSpeed = 0
        smoothedEtaSeconds = 0
        return
      }

      // 1. Maintain sliding window of speed samples
      speedSamples.push({ time: now, bytes: bytesTransferred })
      const cutoff = now - SPEED_WINDOW_MS
      while (speedSamples.length > 2 && speedSamples[0].time < cutoff) {
        speedSamples.shift()
      }

      // Compute speed over window
      if (speedSamples.length >= 2) {
        const oldest = speedSamples[0]
        const dt = (now - oldest.time) / 1000
        const db = bytesTransferred - oldest.bytes
        if (dt >= 0.3) {
          const windowSpeed = db / dt
          if (smoothedSpeed === 0) {
            smoothedSpeed = windowSpeed
          } else {
            // Low-pass filter to dampen I/O cache spikes
            smoothedSpeed = smoothedSpeed * 0.75 + windowSpeed * 0.25
          }
        }
      }

      // 2. Stabilized ETA calculation (evaluated once per second)
      const elapsedSinceStart = (now - startTime) / 1000
      const bytesRemaining = Math.max(0, totalBytes - bytesTransferred)

      if (elapsedSinceStart >= 1.2 && smoothedSpeed > 1024) {
        if (now - lastEtaUpdateTime >= ETA_UPDATE_INTERVAL_MS) {
          const rawEta = Math.ceil(bytesRemaining / smoothedSpeed)
          if (smoothedEtaSeconds <= 0) {
            smoothedEtaSeconds = rawEta
          } else {
            const diff = Math.abs(rawEta - smoothedEtaSeconds)
            if (diff <= 3) {
              // Steady countdown step
              smoothedEtaSeconds = Math.max(1, smoothedEtaSeconds - 1)
            } else if (diff < 20) {
              // Gentle transition without sudden jumping
              smoothedEtaSeconds = Math.round(smoothedEtaSeconds * 0.8 + rawEta * 0.2)
            } else {
              // Damped transition for major speed shifts
              smoothedEtaSeconds = Math.round(smoothedEtaSeconds * 0.6 + rawEta * 0.4)
            }
          }
          lastEtaUpdateTime = now
        }
      } else if (elapsedSinceStart >= 1.2 && smoothedEtaSeconds > 0) {
        // Transfer temporarily paused/stalled: slowly advance countdown rather than exploding
        if (now - lastEtaUpdateTime >= ETA_UPDATE_INTERVAL_MS) {
          smoothedEtaSeconds = Math.min(smoothedEtaSeconds + 1, 86400)
          lastEtaUpdateTime = now
        }
      } else {
        // Initial warmup period
        smoothedEtaSeconds = -1
      }
    }

    function emitProgress(currentFile: string, isDone = false, error?: string, canceled = false, force = false) {
      const now = Date.now()

      // Throttle IPC emission to keep UI updates smooth and readable
      if (!isDone && !canceled && !force && now - lastIpcEmitTime < IPC_THROTTLE_MS) {
        return
      }

      lastIpcEmitTime = now
      updateSpeedAndEta(now, isDone)

      const elapsedSeconds = Math.max(0, Math.round((now - startTime) / 1000))
      const bytesRemaining = Math.max(0, totalBytes - bytesTransferred)
      const percent =
        totalBytes > 0
          ? Math.min(100, Math.round((bytesTransferred / totalBytes) * 100))
          : totalItems > 0
            ? Math.min(100, Math.round((itemsDone / totalItems) * 100))
            : 100

      onProgress({
        operationId,
        type,
        currentFile,
        currentDir: destinationDir,
        itemsDone,
        totalItems: totalFiles > 0 ? totalFiles : totalItems,
        bytesTransferred,
        totalBytes,
        bytesRemaining,
        speedBytesPerSec: isDone ? 0 : Math.round(smoothedSpeed),
        etaSeconds: isDone ? 0 : smoothedEtaSeconds,
        elapsedSeconds,
        percent: isDone ? 100 : percent,
        isDone,
        error,
        canceled,
      })
    }

    // Initial progress report (0%)
    emitProgress(allItems[0] ? path.basename(allItems[0].src) : '', false, undefined, false, true)

    // Check same filesystem for instant rename move
    const canQuickRename =
      type === 'move' &&
      sources.every(
        (src) =>
          path.parse(src).root.toLowerCase() === path.parse(destinationDir).root.toLowerCase() &&
          path.dirname(src).toLowerCase() !== destinationDir.toLowerCase()
      )

    if (canQuickRename && sources.length <= 50) {
      // Direct root moves
      for (const src of sources) {
        if (signal.aborted) {
          emitProgress('', false, undefined, true)
          return { success: false, canceled: true }
        }
        const baseName = path.basename(src)
        const dest = path.join(destinationDir, baseName)
        emitProgress(baseName)
        await fsPromises.rename(src, dest)
        itemsDone++
      }
      bytesTransferred = totalBytes
      emitProgress('Готово', true)
      return { success: true }
    }

    // 2. Transfer item by item
    for (const item of allItems) {
      if (signal.aborted) {
        emitProgress('', false, undefined, true)
        return { success: false, canceled: true }
      }

      if (item.isDirectory) {
        await safeEnsureDir(item.dest)
        continue
      }

      const fileName = path.basename(item.src)
      emitProgress(fileName)

      await safeEnsureDir(path.dirname(item.dest))

      // Try quick rename for individual top-level files in move if same drive
      let renamed = false
      if (type === 'move' && path.parse(item.src).root.toLowerCase() === path.parse(item.dest).root.toLowerCase()) {
        try {
          await fsPromises.rename(item.src, item.dest)
          renamed = true
          bytesTransferred += item.size
          itemsDone++
          emitProgress(fileName)
        } catch {
          renamed = false
        }
      }

      // Stream copy if not renamed
      if (!renamed) {
        let currentDestFd: string | null = item.dest
        try {
          const readStream = fs.createReadStream(item.src, { highWaterMark: 512 * 1024 })
          const writeStream = fs.createWriteStream(item.dest, { highWaterMark: 512 * 1024 })

          readStream.on('data', (chunk: Buffer | string) => {
            bytesTransferred += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
            emitProgress(fileName)
          })

          await pipeline(readStream, writeStream, { signal })
          currentDestFd = null

          if (type === 'move') {
            await fsPromises.unlink(item.src)
          }

          itemsDone++
        } catch (err: any) {
          if (currentDestFd && fs.existsSync(currentDestFd)) {
            try {
              await fsPromises.unlink(currentDestFd)
            } catch {}
          }
          if (signal.aborted || err.name === 'AbortError') {
            emitProgress(fileName, false, undefined, true)
            return { success: false, canceled: true }
          }
          throw err
        }
      }
    }

    // 3. For directories in move operations: clean up empty source directories in reverse order
    if (type === 'move') {
      const dirs = allItems.filter((i) => i.isDirectory).reverse()
      for (const d of dirs) {
        try {
          await fsPromises.rm(d.src, { recursive: true, force: true })
        } catch {}
      }
    }

    bytesTransferred = totalBytes
    emitProgress('Готово', true)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Помилка копіювання / переміщення' }
  } finally {
    activeTransfers.delete(operationId)
  }
}
