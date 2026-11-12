import { ipcMain, shell, nativeImage, app, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { exec, spawn } from 'child_process'
import { formatPermissions } from '../utils'
import { executeCopyMove, cancelTransfer } from './transferEngine'

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

  // Copy Paths with Real-Time Progress, Speed & ETA
  ipcMain.handle('fs:copyPaths', async (event, sources: string[], destinationDir: string, operationId?: string) => {
    const opId = operationId || `copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    return executeCopyMove({
      operationId: opId,
      type: 'copy',
      sources,
      destinationDir,
      onProgress: (data) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('fs:transferProgress', data)
        }
      },
    })
  })

  // Move Paths with Real-Time Progress, Speed & ETA
  ipcMain.handle('fs:movePaths', async (event, sources: string[], destinationDir: string, operationId?: string) => {
    const opId = operationId || `move-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    return executeCopyMove({
      operationId: opId,
      type: 'move',
      sources,
      destinationDir,
      onProgress: (data) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('fs:transferProgress', data)
        }
      },
    })
  })

  // Cancel in-flight copy/move transfer
  ipcMain.handle('fs:cancelTransfer', async (_, operationId: string) => {
    return cancelTransfer(operationId)
  })

  // Native Drag-and-Drop to External Applications (Explorer, Desktop, Discord, Telegram, Browsers, etc.)
  ipcMain.on('fs:startDrag', (event, paths: string[] | { files: string[] }) => {
    const rawFiles = Array.isArray(paths) ? paths : paths?.files || []
    if (!rawFiles || rawFiles.length === 0) return

    // Normalize paths with Windows backslashes and ensure they exist
    const files = rawFiles.map((f) => path.normalize(path.resolve(f))).filter((f) => fs.existsSync(f))

    if (files.length === 0) return

    let dragIcon: any = null
    try {
      const possibleIconPaths = [path.join(app.getAppPath(), 'build', 'icon.png'), path.resolve('build/icon.png')]
      for (const ip of possibleIconPaths) {
        if (fs.existsSync(ip)) {
          const img = nativeImage.createFromPath(ip)
          if (!img.isEmpty()) {
            dragIcon = img.resize({ width: 32, height: 32 })
            break
          }
        }
      }
    } catch {}

    const dragItem: { file: string; files: string[]; icon?: any } = {
      file: files[0],
      files,
    }
    if (dragIcon && !dragIcon.isEmpty()) {
      dragItem.icon = dragIcon
    }

    event.sender.startDrag(dragItem)
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

  // Open with specific application (or Windows Open As dialog if appPath is 'system')
  ipcMain.handle('fs:openWith', async (_, filePath: string, appPath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: 'Файл не знайдено' }
      }
      const cleanFile = path.resolve(filePath)

      if (!appPath || appPath === 'system') {
        // Trigger Windows native "Open with" dialog
        const sysRoot = process.env.SystemRoot || 'C:\\Windows'
        const rundll = path.join(sysRoot, 'System32', 'rundll32.exe')
        exec(`"${rundll}" shell32.dll,OpenAs_RunDLL "${cleanFile}"`)
        return { success: true }
      }

      // Check if chosen app is an executable or shortcut
      const cleanApp = path.resolve(appPath)
      if (cleanApp.toLowerCase().endsWith('.lnk')) {
        try {
          const resolved = shell.readShortcutLink(cleanApp)
          if (resolved.target && fs.existsSync(resolved.target)) {
            spawn(resolved.target, [cleanFile], { detached: true, stdio: 'ignore' }).unref()
            return { success: true }
          }
        } catch {}
      }

      spawn(cleanApp, [cleanFile], { detached: true, stdio: 'ignore' }).unref()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Не вдалося відкрити файл у вибраній програмі' }
    }
  })

  // Get installed applications for Open With selector on Windows
  ipcMain.handle('fs:getInstalledApps', async () => {
    try {
      const results: Array<{ name: string; path: string }> = []
      const seen = new Set<string>()

      // 1. Built-in Windows system applications
      const sysRoot = process.env.SystemRoot || 'C:\\Windows'
      const systemApps = [
        { name: 'Блокнот (Notepad)', path: path.join(sysRoot, 'System32', 'notepad.exe') },
        { name: 'Paint (Графічний редактор)', path: path.join(sysRoot, 'System32', 'mspaint.exe') },
        {
          name: 'WordPad',
          path: path.join(
            process.env['ProgramFiles'] || 'C:\\Program Files',
            'Windows NT',
            'Accessories',
            'wordpad.exe'
          ),
        },
        {
          name: 'Windows Media Player',
          path: path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Windows Media Player', 'wmplayer.exe'),
        },
        {
          name: 'PowerShell',
          path: path.join(sysRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
        },
        { name: 'Командний рядок (CMD)', path: path.join(sysRoot, 'System32', 'cmd.exe') },
      ]
      for (const sa of systemApps) {
        if (fs.existsSync(sa.path)) {
          seen.add(sa.name.toLowerCase())
          results.push(sa)
        }
      }

      // 2. Scan Start Menu directories
      const startMenuDirs = [
        'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs',
        path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      ]

      async function scanDir(dir: string, depth = 0) {
        if (depth > 4 || !fs.existsSync(dir)) return
        try {
          const entries = await fsPromises.readdir(dir, { withFileTypes: true })
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)
            if (entry.isDirectory()) {
              await scanDir(fullPath, depth + 1)
            } else if (entry.name.toLowerCase().endsWith('.lnk')) {
              const baseName = entry.name.replace(/\.lnk$/i, '').trim()
              const lower = baseName.toLowerCase()
              if (
                lower.includes('uninstall') ||
                lower.includes('видалит') ||
                lower.includes('деінстал') ||
                lower.includes('help') ||
                lower.includes('readme') ||
                lower.includes('довідка') ||
                seen.has(lower)
              ) {
                continue
              }
              try {
                const resolved = shell.readShortcutLink(fullPath)
                if (
                  resolved.target &&
                  resolved.target.toLowerCase().endsWith('.exe') &&
                  fs.existsSync(resolved.target)
                ) {
                  seen.add(lower)
                  results.push({ name: baseName, path: resolved.target })
                }
              } catch {
                seen.add(lower)
                results.push({ name: baseName, path: fullPath })
              }
            }
          }
        } catch {}
      }

      for (const smDir of startMenuDirs) {
        await scanDir(smDir)
      }

      // Sort alphabetically by application name
      results.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      return { success: true, apps: results }
    } catch (err: any) {
      return { success: false, error: err.message, apps: [] }
    }
  })

  // Select application from disk via native Windows OpenDialog
  ipcMain.handle('fs:selectAppDialog', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Виберіть програму для відкриття файлу',
        defaultPath: process.env['ProgramFiles'] || 'C:\\Program Files',
        properties: ['openFile'],
        filters: [
          { name: 'Програми (*.exe, *.bat, *.cmd, *.lnk)', extensions: ['exe', 'bat', 'cmd', 'lnk'] },
          { name: 'Усі файли (*.*)', extensions: ['*'] },
        ],
      })
      if (canceled || !filePaths.length) {
        return { canceled: true }
      }
      return { canceled: false, appPath: filePaths[0] }
    } catch (err: any) {
      return { canceled: true, error: err.message }
    }
  })
}
