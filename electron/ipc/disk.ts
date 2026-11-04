import { app, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import os from 'os'
import { exec } from 'child_process'
import { ejectVirtualDisk } from './virtualDisks'

function safeHandle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener)
}

export async function getVolumeInfo(volPath: string): Promise<{ isUSB: boolean; isRemovable: boolean }> {
  return new Promise((resolve) => {
    exec(`diskutil info -plist "${volPath}"`, (err, stdout) => {
      if (err || !stdout) {
        return resolve({ isUSB: false, isRemovable: false })
      }
      const busMatch = stdout.match(/<key>BusProtocol<\/key>\s*<string>([^<]+)<\/string>/i)
      const bus = busMatch ? busMatch[1].trim() : ''
      const internalMatch = stdout.match(/<key>Internal<\/key>\s*<(true|false)\/>/i)
      const isInternal = internalMatch ? internalMatch[1] === 'true' : false
      const ejectableMatch = stdout.match(/<key>Ejectable<\/key>\s*<(true|false)\/>/i)
      const isEjectable = ejectableMatch ? ejectableMatch[1] === 'true' : false
      const isDiskImage = bus.toLowerCase().includes('disk image') || bus.toLowerCase().includes('virtual')

      // STRICT USB: Only real external physical USB devices (excluding DMG disk images and internal system partitions)
      const isUSB = !isInternal && !isDiskImage && bus.toUpperCase() === 'USB'

      resolve({ isUSB, isRemovable: isEjectable })
    })
  })
}

export function getHelperBinaryPath(): string {
  const devPath = path.join(__dirname, '../../bin/mac-diskspace')
  if (fs.existsSync(devPath)) return devPath
  const altDevPath = path.join(__dirname, '../bin/mac-diskspace')
  if (fs.existsSync(altDevPath)) return altDevPath
  const appPath = path.join(app.getAppPath(), 'bin/mac-diskspace')
  if (fs.existsSync(appPath)) return appPath
  const resPath = path.join(process.resourcesPath, 'bin/mac-diskspace')
  if (fs.existsSync(resPath)) return resPath
  return devPath
}

export async function getDiskSpaceStats(targetPath: string): Promise<{
  total: number
  free: number
  available: number
  purgeable: number
}> {
  const binary = getHelperBinaryPath()
  if (fs.existsSync(binary)) {
    try {
      const output = await new Promise<string>((resolve, reject) => {
        exec(`"${binary}" "${targetPath}"`, { timeout: 1500 }, (err, stdout) => {
          if (err || !stdout) return reject(err || new Error('No output'))
          resolve(stdout.trim())
        })
      })
      const data = JSON.parse(output)
      if (data && typeof data.total === 'number') {
        return {
          total: data.total,
          free: data.free,
          available: data.available || data.free,
          purgeable: data.purgeable || 0,
        }
      }
    } catch {
      // Fallback to statfs below
    }
  }

  try {
    const stats = await fsPromises.statfs(targetPath)
    const bsize = stats.bsize
    const total = stats.blocks * bsize
    const free = stats.bfree * bsize
    const available = stats.bavail * bsize
    return {
      total,
      free,
      available,
      purgeable: 0,
    }
  } catch {
    return {
      total: 0,
      free: 0,
      available: 0,
      purgeable: 0,
    }
  }
}

export function isProtectedSystemFile(name: string, fullPath: string): boolean {
  const lowerName = name.toLowerCase()
  const lowerPath = fullPath.toLowerCase()

  // 1. Docker and VM virtual disks that are critical system/developer infrastructure
  if (lowerName === 'docker.raw' || lowerName === 'docker.qcow2') return true
  if (
    lowerPath.includes('com.docker.docker') &&
    (lowerName.endsWith('.raw') || lowerName.endsWith('.qcow2') || lowerName.endsWith('.dmg'))
  ) {
    return true
  }

  // 2. macOS Virtual memory, kernel sleepimage, swapfiles
  if (lowerName.startsWith('swapfile') || lowerName === 'sleepimage') return true
  if (lowerPath.startsWith('/private/var/vm') || lowerPath.startsWith('/var/vm')) return true

  // 3. macOS Core system files & metadata
  if (
    lowerPath.startsWith('/system/') ||
    lowerPath.startsWith('/usr/') ||
    lowerPath.startsWith('/bin/') ||
    lowerPath.startsWith('/sbin/')
  ) {
    return true
  }
  return lowerName === '.spotlight-v100' ||
      lowerName === '.fseventsd' ||
      lowerName === '.documentrevisions-v100';


}

export function setupDiskIpc() {
  // Quick Access / Drives & USB Media
  safeHandle('fs:getDrives', async () => {
    try {
      const home = os.homedir()
      const drives: any[] = [
        { name: 'Home (~)', path: home, icon: 'Home', type: 'home', isRemovable: false },
        { name: 'Desktop', path: path.join(home, 'Desktop'), icon: 'Monitor', type: 'folder', isRemovable: false },
        { name: 'Documents', path: path.join(home, 'Documents'), icon: 'FileText', type: 'folder', isRemovable: false },
        { name: 'Downloads', path: path.join(home, 'Downloads'), icon: 'Download', type: 'folder', isRemovable: false },
        { name: 'Applications', path: '/Applications', icon: 'Grid', type: 'folder', isRemovable: false },
      ]

      // Check /Volumes on macOS (ONLY real external physical USB drives, exclude DMGs & system recovery)
      const ignoredVolumes = new Set([
        'Macintosh HD',
        'Recovery',
        'Preboot',
        'VM',
        'Update',
        'Data',
        'TimeMachine',
        '.timemachine',
      ])

      try {
        const volumes = await fsPromises.readdir('/Volumes')
        for (const vol of volumes) {
          if (vol.startsWith('.') || ignoredVolumes.has(vol)) continue
          const volPath = path.join('/Volumes', vol)
          const volInfo = await getVolumeInfo(volPath)

          // Only add real physical USB drives
          if (volInfo.isUSB) {
            drives.push({
              name: vol,
              path: volPath,
              icon: 'Usb',
              type: 'usb',
              isRemovable: true,
            })
          }
        }
      } catch {
        // Ignore volume read error if any
      }

      // Filter only paths that actually exist and attach free/available/purgeable/total disk space
      const existingDrives = []
      for (const d of drives) {
        if (fs.existsSync(d.path)) {
          if (d.totalSpace === undefined) {
            const space = await getDiskSpaceStats(d.path)
            d.totalSpace = space.total
            d.freeSpace = space.free
            d.availableSpace = space.available
            d.purgeableSpace = space.purgeable
          }
          existingDrives.push(d)
        }
      }

      return { success: true, data: existingDrives }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get Disk Space for any path
  safeHandle('fs:getDiskSpace', async (_, dirPath: string) => {
    try {
      const space = await getDiskSpaceStats(dirPath)
      return {
        success: true,
        total: space.total,
        free: space.free,
        available: space.available,
        purgeable: space.purgeable,
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Eject USB / Virtual Disk / External Volume
  safeHandle('fs:ejectVolume', async (_, volumePath: string) => {
    try {
      if (!volumePath.startsWith('/Volumes/')) {
        return { success: false, error: 'Тільки зовнішні томи або USB можна вилучити' }
      }
      const res = await ejectVirtualDisk(volumePath)
      if (res.success) {
        return { success: true }
      }
      await new Promise<void>((resolve, reject) => {
        exec(`diskutil eject "${volumePath}"`, (err, stdout, stderr) => {
          if (err) {
            exec(`diskutil unmount "${volumePath}"`, (err2, stdout2, stderr2) => {
              if (err2) return reject(new Error(stderr2 || stderr || err2.message))
              resolve()
            })
          } else {
            resolve()
          }
        })
      })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Folder Size Breakdown for FolderSizeModal
  safeHandle('fs:getFolderSizeBreakdown', async (_, dirPath: string) => {
    try {
      const resolved = path.resolve(dirPath)
      const entries = await fsPromises.readdir(resolved, { withFileTypes: true })
      let totalFolderSize = 0
      let totalFolderFiles = 0

      const subfolderResults: Array<{ name: string; path: string; size: number; count: number; percentage: number }> = []

      for (const e of entries) {
        if (!e.name.startsWith('.')) {
          const subPath = path.join(resolved, e.name)
          if (e.isDirectory()) {
            let subSize = 0
            let subCount = 0
            async function scan(curr: string, d = 0) {
              if (d > 5) return
              try {
                const subEntries = await fsPromises.readdir(curr, { withFileTypes: true })
                for (const se of subEntries) {
                  const p = path.join(curr, se.name)
                  if (se.isDirectory()) {
                    await scan(p, d + 1)
                  } else {
                    const st = await fsPromises.lstat(p)
                    subSize += st.size
                    subCount++
                  }
                }
              } catch {}
            }
            await scan(subPath)
            totalFolderSize += subSize
            totalFolderFiles += subCount
            subfolderResults.push({
              name: e.name,
              path: subPath,
              size: subSize,
              count: subCount,
              percentage: 0,
            })
          } else {
            try {
              const st = await fsPromises.lstat(subPath)
              totalFolderSize += st.size
              totalFolderFiles++
            } catch {}
          }
        }
      }

      subfolderResults.sort((a, b) => b.size - a.size)
      for (const s of subfolderResults) {
        s.percentage = totalFolderSize > 0 ? Math.round((s.size / totalFolderSize) * 100) : 0
      }

      return {
        success: true,
        data: {
          folderPath: resolved,
          totalSize: totalFolderSize,
          totalFiles: totalFolderFiles,
          subfolders: subfolderResults,
        },
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Fast Search for Large Files by Threshold
  safeHandle(
    'fs:findLargeFiles',
    async (_, options: { targetDir: string; minSizeBytes: number; limit?: number }) => {
      try {
        const { targetDir, minSizeBytes = 50 * 1024 * 1024, limit = 200 } = options
        const resolved = path.resolve(targetDir)
        if (!fs.existsSync(resolved)) {
          return { success: false, error: 'Директорія не існує' }
        }

        const largeFiles: Array<{
          path: string
          name: string
          size: number
          mtime: number
          extension: string
          dir: string
        }> = []

        let totalSize = 0
        let scannedCount = 0
        const queue: Array<{ dir: string; depth: number }> = [{ dir: resolved, depth: 0 }]
        const skipNames = new Set([
          '.git',
          'node_modules',
          '.trash',
          '.trashes',
          '.fseventsd',
          '.spotlight-v100',
        ])

        while (queue.length > 0 && scannedCount < 100000) {
          const current = queue.shift()!
          if (current.depth > 7) continue

          let entries: fs.Dirent[]
          try {
            entries = await fsPromises.readdir(current.dir, { withFileTypes: true })
          } catch {
            continue
          }

          for (const entry of entries) {
            scannedCount++
            const lowerName = entry.name.toLowerCase()

            if (entry.isDirectory()) {
              if (skipNames.has(lowerName)) continue
              if (entry.isSymbolicLink()) continue
              if (current.dir.includes('/Library/Containers/com.docker.docker')) continue
              queue.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 })
            } else if (entry.isFile()) {
              if (isProtectedSystemFile(entry.name, path.join(current.dir, entry.name))) {
                continue
              }
              try {
                const fullPath = path.join(current.dir, entry.name)
                const st = await fsPromises.lstat(fullPath)
                if (st.isSymbolicLink()) continue
                if (st.size >= minSizeBytes) {
                  totalSize += st.size
                  largeFiles.push({
                    path: fullPath,
                    name: entry.name,
                    size: st.size,
                    mtime: st.mtimeMs,
                    extension: path.extname(entry.name).replace(/^\./, '').toLowerCase(),
                    dir: current.dir,
                  })
                }
              } catch {}
            }
          }
        }

        largeFiles.sort((a, b) => b.size - a.size)
        const resultFiles = limit > 0 ? largeFiles.slice(0, limit) : largeFiles

        return {
          success: true,
          files: resultFiles,
          totalSize,
          scannedCount,
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Помилка пошуку великих файлів' }
      }
    }
  )

  // Large Files & Disk Space Analysis
  safeHandle('fs:analyzeDisk', async (_, dirPath: string, maxItems = 100) => {
    try {
      const resolved = path.resolve(dirPath)
      let totalScannedBytes = 0
      let totalScannedFiles = 0
      const allFiles: Array<{ name: string; path: string; size: number; mtime: number; extension: string }> = []
      const subdirsMap = new Map<string, { name: string; path: string; size: number; fileCount: number }>()
      const categoryMap: Record<string, number> = {
        video: 0,
        audio: 0,
        image: 0,
        archive: 0,
        code: 0,
        doc: 0,
        app: 0,
        other: 0,
      }

      function categorize(ext: string, size: number) {
        if (['mp4', 'mov', 'mkv', 'avi', 'webm', 'flv', 'm4v'].includes(ext)) categoryMap.video += size
        else if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'aiff'].includes(ext)) categoryMap.audio += size
        else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'heic', 'icns'].includes(ext)) categoryMap.image += size
        else if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz', 'dmg', 'iso', 'pkg'].includes(ext)) categoryMap.archive += size
        else if (['js', 'ts', 'vue', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'swift', 'json', 'html', 'css', 'scss'].includes(ext)) categoryMap.code += size
        else if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'md', 'csv', 'ppt', 'pptx'].includes(ext)) categoryMap.doc += size
        else if (ext === 'app') categoryMap.app += size
        else categoryMap.other += size
      }

      try {
        const topEntries = await fsPromises.readdir(resolved, { withFileTypes: true })
        for (const e of topEntries) {
          if (e.isDirectory() && !e.name.startsWith('.')) {
            subdirsMap.set(path.join(resolved, e.name), {
              name: e.name,
              path: path.join(resolved, e.name),
              size: 0,
              fileCount: 0,
            })
          }
        }
      } catch {}

      async function walk(curr: string, depth = 0, rootSubdir?: string) {
        if (depth > 7) return
        let entries
        try {
          entries = await fsPromises.readdir(curr, { withFileTypes: true })
        } catch {
          return
        }

        for (const e of entries) {
          const subPath = path.join(curr, e.name)
          const currentRoot = depth === 0 && e.isDirectory() ? subPath : rootSubdir

          if (e.isDirectory()) {
            const lowerDir = e.name.toLowerCase()
            if (
              lowerDir === '.git' ||
              lowerDir === '.trash' ||
              (lowerDir === 'node_modules' && depth > 2) ||
              subPath.includes('com.docker.docker/Data/vms')
            ) {
              continue
            }
            await walk(subPath, depth + 1, currentRoot)
          } else {
            if (isProtectedSystemFile(e.name, subPath)) {
              continue
            }
            try {
              const st = await fsPromises.lstat(subPath)
              if (st.isSymbolicLink()) continue
              totalScannedBytes += st.size
              totalScannedFiles++

              if (currentRoot && subdirsMap.has(currentRoot)) {
                const s = subdirsMap.get(currentRoot)!
                s.size += st.size
                s.fileCount++
              }

              const ext = path.extname(e.name).toLowerCase().replace('.', '')
              categorize(ext, st.size)

              allFiles.push({
                name: e.name,
                path: subPath,
                size: st.size,
                mtime: st.mtimeMs,
                extension: ext,
              })

              if (allFiles.length > maxItems * 4) {
                allFiles.sort((a, b) => b.size - a.size)
                allFiles.length = maxItems * 2
              }
            } catch {}
          }
        }
      }

      await walk(resolved, 0)
      allFiles.sort((a, b) => b.size - a.size)
      const largestFiles = allFiles.slice(0, maxItems)
      const subdirectories = Array.from(subdirsMap.values()).sort((a, b) => b.size - a.size)

      return {
        success: true,
        data: {
          scannedPath: resolved,
          totalBytes: totalScannedBytes,
          totalFiles: totalScannedFiles,
          largestFiles,
          subdirectories,
          categoryBreakdown: categoryMap,
        },
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}

