import { ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'

export async function fastGetFolderStats(
  folderPath: string
): Promise<{ size: number; fileCount: number; dirCount: number }> {
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
          const st = await fsPromises.lstat(full)
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

function safeHandle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener)
}

export function registerFolderSizeIpc(): void {
  // Cancel in-progress scan
  safeHandle('fs:cancelAnalyzeFolderSizes', async (_, scanId?: string) => {
    cancelAnalyzeScan(scanId)
    return { success: true }
  })

  // Calculate single directory size (Space key / Context Menu)
  safeHandle('fs:getDirSize', async (_, dirPath: string) => {
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

  // Stream folder & subfolder sizes in real-time
  safeHandle('fs:analyzeFolderSizes', async (event, targetPath: string, scanId?: string) => {
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
        return { success: false, error: 'Сканування скасовано' }
      }

      const allEntries = await fsPromises.readdir(targetPath, { withFileTypes: true })
      const subdirs = allEntries.filter((e) => e.isDirectory() && !e.isSymbolicLink() && !e.name.startsWith('.'))

      let rootFilesSize = 0
      let rootFilesCount = 0
      for (const e of allEntries) {
        if (!e.isDirectory() && !e.name.startsWith('.')) {
          try {
            const st = await fsPromises.lstat(path.join(targetPath, e.name))
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

      // Emit root files if any
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

      if (foldersToScan.length === 0) {
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

