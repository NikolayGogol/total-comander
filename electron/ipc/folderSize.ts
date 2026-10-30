import { ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { execFile } from 'child_process'
import { getWindowsLockedFiles } from '../utils'

/**
 * Fast folder statistics calculation using native Windows robocopy multithreaded scanning.
 * Falls back to recursive filesystem traversal if robocopy is unavailable or fails.
 */
export function fastGetFolderStats(folderPath: string): Promise<{ size: number; fileCount: number; dirCount: number }> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      let p = path.resolve(folderPath)
      // If path ends with a backslash, duplicate it so execFile's quotes won't escape the closing quote
      if (p.endsWith('\\')) {
        p = p + '\\'
      }
      execFile(
        'robocopy.exe',
        [p, 'NULL', '/L', '/E', '/BYTES', '/NJH', '/NFL', '/NDL', '/NP', '/MT:16', '/R:0', '/W:0'],
        { maxBuffer: 10 * 1024 * 1024, windowsHide: true },
        (err, stdout) => {
          const text = stdout || ''
          const d = text.match(/Dirs\s*:\s*(\d+)/i)
          const f = text.match(/Files\s*:\s*(\d+)/i)
          const b = text.match(/Bytes\s*:\s*(\d+)/i)
          if (b || f || d) {
            resolve({
              dirCount: d ? parseInt(d[1], 10) : 0,
              fileCount: f ? parseInt(f[1], 10) : 0,
              size: b ? parseInt(b[1], 10) : 0,
            })
            return
          }
          fallbackScan(folderPath).then(resolve)
        }
      )
    } else {
      fallbackScan(folderPath).then(resolve)
    }
  })
}

/**
 * Fallback iterative directory scanning for non-Windows platforms or permission-restricted folders
 */
async function fallbackScan(folderPath: string): Promise<{ size: number; fileCount: number; dirCount: number }> {
  let size = 0
  let fileCount = 0
  let dirCount = 0
  const stack = [folderPath]

  while (stack.length > 0) {
    const cur = stack.pop()!
    let entries: fs.Dirent[]
    try {
      entries = await fsPromises.readdir(cur, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const full = path.join(cur, entry.name)
      if (entry.isDirectory()) {
        if (!entry.isSymbolicLink()) {
          dirCount++
          stack.push(full)
        }
      } else if (entry.isFile()) {
        try {
          const st = await fsPromises.stat(full)
          size += st.size
          fileCount++
        } catch {}
      }
    }
  }

  return { size, fileCount, dirCount }
}

let activeScanId: string | null = null

export function cancelAnalyzeScan(scanId?: string): void {
  if (!scanId || activeScanId === scanId) {
    activeScanId = null
  }
}

/**
 * Parallel execution helper with concurrency limit and per-item completion callback
 */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  onEach?: (result: R) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let currentIndex = 0

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex++
      const res = await fn(items[index])
      results[index] = res
      if (onEach) {
        onEach(res)
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export function registerFolderSizeIpc(): void {
  // Cancel in-progress scan
  ipcMain.handle('fs:cancelAnalyzeFolderSizes', async (_, scanId?: string) => {
    cancelAnalyzeScan(scanId)
    return { success: true }
  })

  // Calculate Single Directory Size (Space key / Context Menu)
  ipcMain.handle('fs:getDirSize', async (_, dirPath: string) => {
    try {
      if (!fs.existsSync(dirPath)) {
        return { success: false, error: 'Папка не існує' }
      }
      const stats = await fastGetFolderStats(dirPath)
      return { success: true, size: stats.size, count: stats.fileCount }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Analyze Folder & Subfolders Sizes (Folder Size Modal) with real-time streaming
  ipcMain.handle('fs:analyzeFolderSizes', async (event, targetPath: string, scanId?: string) => {
    const currentScanId = scanId || Math.random().toString(36).slice(2)
    activeScanId = currentScanId

    try {
      if (!fs.existsSync(targetPath)) {
        return { success: false, error: 'Папка не існує' }
      }

      const stat = await fsPromises.stat(targetPath)
      if (!stat.isDirectory()) {
        return { success: false, error: 'Вказаний шлях не є папкою' }
      }

      if (activeScanId !== currentScanId) {
        return { success: false, error: 'Cancelled' }
      }

      const entries = await fsPromises.readdir(targetPath, { withFileTypes: true })
      const subdirs = entries.filter((e) => e.isDirectory() && !e.isSymbolicLink())

      // Direct files in root folder
      let rootFilesSize = 0
      let rootFilesCount = 0
      for (const e of entries) {
        if (e.isFile()) {
          try {
            const st = await fsPromises.stat(path.join(targetPath, e.name))
            rootFilesSize += st.size
            rootFilesCount++
          } catch {}
        }
      }

      const foldersToScan = subdirs.map((d) => ({
        name: d.name,
        path: path.join(targetPath, d.name),
      }))

      const totalSubdirsCount = foldersToScan.length
      let grandTotalSize = 0
      let grandTotalFiles = 0
      const results: Array<{
        name: string
        path: string
        size: number
        fileCount: number
        dirCount: number
      }> = []

      function emitItem(
        folder: { name: string; path: string; size: number; fileCount: number; dirCount: number },
        current: number,
        total: number
      ) {
        if (!event.sender.isDestroyed() && activeScanId === currentScanId) {
          event.sender.send('folderSize:item', {
            scanId: currentScanId,
            folder,
            current,
            total,
          })
        }
      }

      function emitProgress(current: number, total: number, folderName?: string, isDone = false) {
        if (!event.sender.isDestroyed() && activeScanId === currentScanId) {
          event.sender.send('folderSize:progress', {
            scanId: currentScanId,
            current,
            total,
            folderName,
            isDone,
          })
        }
      }

      // Stream direct root files if any
      if (rootFilesCount > 0) {
        const rootItem = {
          name: `(Файли в поточній папці: ${rootFilesCount})`,
          path: targetPath,
          size: rootFilesSize,
          fileCount: rootFilesCount,
          dirCount: 0,
        }
        results.push(rootItem)
        grandTotalSize += rootFilesSize
        grandTotalFiles += rootFilesCount
        emitItem(rootItem, 0, totalSubdirsCount)
      }

      // Stream Windows system locked files on drive root (e.g. C:\)
      if (/^[a-zA-Z]:[/\\]?$/.test(targetPath)) {
        const locked = getWindowsLockedFiles(targetPath)
        for (const lf of locked) {
          const lockedItem = {
            name: `${lf.name} (системний файл Windows)`,
            path: lf.path,
            size: lf.size,
            fileCount: 1,
            dirCount: 0,
          }
          results.push(lockedItem)
          grandTotalSize += lf.size
          grandTotalFiles += 1
          emitItem(lockedItem, 0, totalSubdirsCount)
        }
      }

      if (foldersToScan.length === 0) {
        // Leaf folder with no subdirectories
        emitProgress(0, 1, path.basename(targetPath))
        const stats = await fastGetFolderStats(targetPath)
        const singleItem = {
          name: path.basename(targetPath) || targetPath,
          path: targetPath,
          size: stats.size,
          fileCount: stats.fileCount,
          dirCount: stats.dirCount,
        }
        results.push(singleItem)
        grandTotalSize += stats.size
        grandTotalFiles += stats.fileCount
        emitItem(singleItem, 1, 1)
        emitProgress(1, 1, singleItem.name, true)
      } else {
        let completedCount = 0
        emitProgress(0, totalSubdirsCount)

        // Parallel execution with 8 workers, streaming results as they finish
        await mapConcurrent(
          foldersToScan,
          8,
          async (f) => {
            if (activeScanId !== currentScanId) return null
            const stats = await fastGetFolderStats(f.path)
            if (activeScanId !== currentScanId) return null
            return {
              name: f.name,
              path: f.path,
              size: stats.size,
              fileCount: stats.fileCount,
              dirCount: stats.dirCount,
            }
          },
          (item) => {
            if (!item || activeScanId !== currentScanId) return
            completedCount++
            results.push(item)
            grandTotalSize += item.size
            grandTotalFiles += item.fileCount
            emitItem(item, completedCount, totalSubdirsCount)
            emitProgress(completedCount, totalSubdirsCount, item.name, completedCount === totalSubdirsCount)
          }
        )
      }

      emitProgress(totalSubdirsCount, totalSubdirsCount, undefined, true)

      // Sort descending by size
      results.sort((a, b) => b.size - a.size)

      const folderName = path.basename(targetPath) || targetPath
      return {
        success: true,
        parentPath: targetPath,
        folders: results,
        results,
        totalSize: grandTotalSize,
        grandTotalSize,
        totalFiles: grandTotalFiles,
        grandTotalFiles,
        folderName,
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка розрахунку розміру папок' }
    } finally {
      if (activeScanId === currentScanId) {
        activeScanId = null
      }
    }
  })
}
