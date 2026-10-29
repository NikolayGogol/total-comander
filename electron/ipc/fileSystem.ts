import { ipcMain, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { exec } from 'child_process'
import { formatPermissions, safeEnsureDir } from '../utils'

export function registerFileSystemIpc(): void {
  // Read Directory
  ipcMain.handle('fs:readDir', async (_, dirPath: string, showHidden = false) => {
    try {
      const resolvedPath = path.resolve(dirPath)
      const entries = await fsPromises.readdir(resolvedPath, { withFileTypes: true })
      const items = []

      for (const entry of entries) {
        const isHidden = entry.name.startsWith('.')
        if (isHidden && !showHidden) continue

        const itemPath = path.join(resolvedPath, entry.name)
        try {
          const stats = await fsPromises.lstat(itemPath)
          const isDir = entry.isDirectory() || (entry.isSymbolicLink() && stats.isDirectory())
          const isFile = entry.isFile() || (entry.isSymbolicLink() && stats.isFile())
          const ext = isDir ? '' : path.extname(entry.name).replace(/^\./, '').toLowerCase()

          items.push({
            name: entry.name,
            path: itemPath,
            isDirectory: isDir,
            isFile: isFile,
            isSymlink: entry.isSymbolicLink(),
            size: isDir ? 0 : stats.size,
            mtime: stats.mtimeMs,
            birthtime: stats.birthtimeMs,
            mode: stats.mode,
            permissions: formatPermissions(stats.mode, isDir),
            extension: ext,
            isHidden,
          })
        } catch {
          // If stat fails (e.g. broken symlink or protected system file)
          items.push({
            name: entry.name,
            path: itemPath,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            isSymlink: entry.isSymbolicLink(),
            size: 0,
            mtime: 0,
            birthtime: 0,
            mode: 0,
            permissions: entry.isDirectory() ? 'drwxr-xr-x' : '-rw-r--r--',
            extension: path.extname(entry.name).toLowerCase(),
            isHidden,
          })
        }
      }

      return { success: true, data: items }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to read directory' }
    }
  })

  // Create Folder
  ipcMain.handle('fs:createFolder', async (_, targetPath: string) => {
    try {
      await fsPromises.mkdir(targetPath, { recursive: true })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Create File
  ipcMain.handle('fs:createFile', async (_, targetPath: string) => {
    try {
      await fsPromises.writeFile(targetPath, '', { flag: 'wx' })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Delete Paths (Move to Windows Recycle Bin by default)
  ipcMain.handle('fs:deletePaths', async (_, paths: string[], moveToTrash = true) => {
    try {
      for (const itemPath of paths) {
        if (moveToTrash) {
          try {
            await shell.trashItem(itemPath)
          } catch {
            await fsPromises.rm(itemPath, { recursive: true, force: true })
          }
        } else {
          await fsPromises.rm(itemPath, { recursive: true, force: true })
        }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Copy Paths
  ipcMain.handle('fs:copyPaths', async (_, sources: string[], destinationDir: string) => {
    try {
      await safeEnsureDir(destinationDir)
      for (const src of sources) {
        const baseName = path.basename(src)
        const dest = path.join(destinationDir, baseName)
        if (src.toLowerCase() === dest.toLowerCase()) {
          const ext = path.extname(baseName)
          const nameWithoutExt = path.basename(baseName, ext)
          const copyDest = path.join(destinationDir, `${nameWithoutExt} - Копія${ext}`)
          await fsPromises.cp(src, copyDest, { recursive: true })
        } else {
          await fsPromises.cp(src, dest, { recursive: true })
        }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Move Paths
  ipcMain.handle('fs:movePaths', async (_, sources: string[], destinationDir: string) => {
    try {
      await safeEnsureDir(destinationDir)
      for (const src of sources) {
        const baseName = path.basename(src)
        const dest = path.join(destinationDir, baseName)
        if (src.toLowerCase() === dest.toLowerCase()) continue

        try {
          await fsPromises.rename(src, dest)
        } catch (renameErr: any) {
          // EXDEV fallback for cross-filesystem moves
          if (renameErr.code === 'EXDEV') {
            await fsPromises.cp(src, dest, { recursive: true })
            await fsPromises.rm(src, { recursive: true, force: true })
          } else {
            throw renameErr
          }
        }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Rename Single Path
  ipcMain.handle('fs:renamePath', async (_, oldPath: string, newPath: string) => {
    try {
      await fsPromises.rename(oldPath, newPath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Read File Content (for Viewer and Editor)
  ipcMain.handle('fs:readFile', async (_, filePath: string, maxBytes = 2 * 1024 * 1024) => {
    try {
      const stats = await fsPromises.stat(filePath)
      if (stats.size > maxBytes) {
        return {
          success: false,
          error: `Файл занадто великий для відображення (${(stats.size / (1024 * 1024)).toFixed(1)} МБ). Ліміт 2 МБ.`,
        }
      }

      const buffer = await fsPromises.readFile(filePath)
      let isBinary = false
      const checkLength = Math.min(buffer.length, 1024)
      for (let i = 0; i < checkLength; i++) {
        if (buffer[i] === 0) {
          isBinary = true
          break
        }
      }

      if (isBinary) {
        return {
          success: true,
          isBinary: true,
          content: buffer.toString('base64'),
        }
      }

      return {
        success: true,
        isBinary: false,
        content: buffer.toString('utf-8'),
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Write File Content
  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    try {
      await fsPromises.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Open with Windows default app
  ipcMain.handle('fs:openPath', async (_, filePath: string) => {
    try {
      const result = await shell.openPath(filePath)
      if (result) {
        return { success: false, error: result }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Show in Windows Explorer
  ipcMain.handle('fs:showInFolder', async (_, filePath: string) => {
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Open Directory in Windows Terminal / PowerShell / CMD
  ipcMain.handle('fs:openInTerminal', async (_, dirPath: string) => {
    return new Promise((resolve) => {
      try {
        let cleanDir = dirPath ? path.resolve(dirPath) : 'C:\\'
        if (/^[a-zA-Z]:$/.test(cleanDir)) {
          cleanDir += '\\'
        }

        const sysRoot = process.env.SystemRoot || 'C:\\Windows'
        const psExe = path.join(sysRoot, 'System32\\WindowsPowerShell\\v1.0\\powershell.exe')
        const cmdExe = path.join(sysRoot, 'System32\\cmd.exe')
        const localAppData = process.env.LOCALAPPDATA || ''
        const wtPath = localAppData ? path.join(localAppData, 'Microsoft', 'WindowsApps', 'wt.exe') : ''
        const hasWt = wtPath ? fs.existsSync(wtPath) : false

        const launchCmd = () => {
          const targetCmd = fs.existsSync(cmdExe) ? cmdExe : 'cmd.exe'
          exec(`"${targetCmd}" /c start "" "${targetCmd}" /K cd /D "${cleanDir}"`, { cwd: cleanDir }, (cmdErr) => {
            if (cmdErr) {
              resolve({ success: false, error: cmdErr.message })
            } else {
              resolve({ success: true })
            }
          })
        }

        const launchPowerShell = () => {
          if (fs.existsSync(psExe)) {
            const escapedDir = cleanDir.replace(/'/g, "''")
            const targetCmd = fs.existsSync(cmdExe) ? cmdExe : 'cmd.exe'
            exec(
              `"${targetCmd}" /c start "" "${psExe}" -NoExit -Command "Set-Location -LiteralPath '${escapedDir}'"`,
              { cwd: cleanDir },
              (psErr) => {
                if (psErr) {
                  launchCmd()
                } else {
                  resolve({ success: true })
                }
              }
            )
          } else {
            launchCmd()
          }
        }

        if (hasWt) {
          const targetCmd = fs.existsSync(cmdExe) ? cmdExe : 'cmd.exe'
          exec(`"${targetCmd}" /c start "" "${wtPath}" -d "${cleanDir}"`, { cwd: cleanDir }, (wtErr) => {
            if (wtErr) {
              launchPowerShell()
            } else {
              resolve({ success: true })
            }
          })
        } else {
          launchPowerShell()
        }
      } catch (err: any) {
        resolve({ success: false, error: err.message })
      }
    })
  })

  // QuickLook substitute: Open default system app
  ipcMain.handle('fs:quickLook', async (_, filePath: string) => {
    try {
      await shell.openPath(filePath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
