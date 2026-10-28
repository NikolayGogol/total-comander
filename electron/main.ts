import { app, BrowserWindow, ipcMain, shell, Menu, clipboard } from 'electron'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import os from 'os'
import { exec } from 'child_process'

app.setName('Total Commander')
app.name = 'Total Commander'

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null = null
const preload = path.join(__dirname, 'preload.js')

function formatPermissions(mode: number, isDirectory: boolean): string {
  const type = isDirectory ? 'd' : '-'
  const perms = [
    mode & 0o400 ? 'r' : '-',
    mode & 0o200 ? 'w' : '-',
    mode & 0o100 ? 'x' : '-',
    mode & 0o040 ? 'r' : '-',
    mode & 0o020 ? 'w' : '-',
    mode & 0o010 ? 'x' : '-',
    mode & 0o004 ? 'r' : '-',
    mode & 0o002 ? 'w' : '-',
    mode & 0o001 ? 'x' : '-',
  ].join('')
  return type + perms
}

function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../build/icon.ico')
    : path.join(__dirname, '../build/icon.png')

  if (process.platform === 'darwin' && app.dock && fs.existsSync(iconPath)) {
    app.dock.setIcon(iconPath)
  }

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Total Commander',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 14 } : undefined,
    backgroundColor: '#121418',
    show: false,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer Log level=${level}] ${message} (${sourceId}:${line})`)
  })

  win.once('ready-to-show', () => {
    win?.show()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    // Optional: win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
}

function setupAppMenu() {
  if (process.platform === 'darwin') {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: app.name,
        submenu: [
          { role: 'about', label: 'About Total Commander' },
          { type: 'separator' },
          { role: 'hide', label: 'Hide Total Commander' },
          { role: 'hideOthers', label: 'Hide Others' },
          { role: 'unhide', label: 'Show All' },
          { type: 'separator' },
          { role: 'quit', label: 'Quit Total Commander' },
        ],
      },
      { role: 'fileMenu' },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          {
            label: 'Copy',
            accelerator: 'CmdOrCtrl+C',
            click: (_, focusedWindow) => {
              focusedWindow?.webContents.send('app:command', 'copy')
            },
          },
          {
            label: 'Cut',
            accelerator: 'CmdOrCtrl+X',
            click: (_, focusedWindow) => {
              focusedWindow?.webContents.send('app:command', 'cut')
            },
          },
          {
            label: 'Paste',
            accelerator: 'CmdOrCtrl+V',
            click: (_, focusedWindow) => {
              focusedWindow?.webContents.send('app:command', 'paste')
            },
          },
          {
            label: 'Select All',
            accelerator: 'CmdOrCtrl+A',
            click: (_, focusedWindow) => {
              focusedWindow?.webContents.send('app:command', 'selectAll')
            },
          },
        ],
      },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }
}

app.whenReady().then(() => {
  setupAppMenu()
  setupIpcHandlers()
  setupVolumeWatcher()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function setupVolumeWatcher() {
  if (process.platform !== 'darwin') return
  try {
    let debounceTimer: NodeJS.Timeout | null = null
    fs.watch('/Volumes', () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('drives:changed')
        }
      }, 500)
    })
  } catch (err) {
    console.warn('Could not watch /Volumes:', err)
  }
}

async function getVolumeInfo(volPath: string): Promise<{ type: 'usb' | 'dmg' | 'volume'; isRemovable: boolean }> {
  return new Promise((resolve) => {
    exec(`diskutil info -plist "${volPath}"`, (err, stdout) => {
      if (err || !stdout) {
        return resolve({ type: 'volume', isRemovable: false })
      }
      const busMatch = stdout.match(/<key>BusProtocol<\/key>\s*<string>([^<]+)<\/string>/i)
      const bus = busMatch ? busMatch[1].trim() : ''
      const internalMatch = stdout.match(/<key>Internal<\/key>\s*<(true|false)\/>/i)
      const isInternal = internalMatch ? internalMatch[1] === 'true' : false
      const ejectableMatch = stdout.match(/<key>Ejectable<\/key>\s*<(true|false)\/>/i)
      const isEjectable = ejectableMatch ? ejectableMatch[1] === 'true' : false

      if (bus.toUpperCase() === 'USB') {
        resolve({ type: 'usb', isRemovable: true })
      } else if (bus === 'Disk Image') {
        resolve({ type: 'dmg', isRemovable: true })
      } else if (!isInternal || isEjectable) {
        resolve({ type: 'usb', isRemovable: isEjectable })
      } else {
        resolve({ type: 'volume', isRemovable: isEjectable })
      }
    })
  })
}

function setupIpcHandlers() {
  // System Info
  ipcMain.handle('app:getSystemInfo', async () => {
    return {
      homeDir: os.homedir(),
      tmpDir: os.tmpdir(),
      platform: process.platform,
      username: os.userInfo().username,
    }
  })

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
          const ext = isDir ? '' : path.extname(entry.name).toLowerCase()

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

  // Quick Access / Drives & USB Media
  ipcMain.handle('fs:getDrives', async () => {
    try {
      const isWin = process.platform === 'win32'
      const home = os.homedir()
      const rootPath = isWin ? (process.env.SystemDrive ? process.env.SystemDrive + '\\' : 'C:\\') : '/'
      const rootName = isWin ? `Локальний диск (${rootPath})` : 'Macintosh HD'

      const drives: any[] = [
        { name: rootName, path: rootPath, icon: 'HardDrive', type: 'root', isRemovable: false },
        { name: 'Home (~)', path: home, icon: 'Home', type: 'home', isRemovable: false },
        { name: 'Desktop', path: path.join(home, 'Desktop'), icon: 'Monitor', type: 'folder', isRemovable: false },
        { name: 'Documents', path: path.join(home, 'Documents'), icon: 'FileText', type: 'folder', isRemovable: false },
        { name: 'Downloads', path: path.join(home, 'Downloads'), icon: 'Download', type: 'folder', isRemovable: false },
      ]

      if (!isWin) {
        drives.push({ name: 'Applications', path: '/Applications', icon: 'Grid', type: 'folder', isRemovable: false })
      }

      // Check /Volumes on macOS or drive letters on Windows
      if (process.platform === 'darwin') {
        try {
          const volumes = await fsPromises.readdir('/Volumes')
          for (const vol of volumes) {
            if (vol === 'Macintosh HD') continue
            const volPath = path.join('/Volumes', vol)
            const volInfo = await getVolumeInfo(volPath)
            drives.push({
              name: vol,
              path: volPath,
              icon: volInfo.type === 'usb' ? 'Usb' : volInfo.type === 'dmg' ? 'Disc' : 'HardDrive',
              type: volInfo.type,
              isRemovable: volInfo.isRemovable,
            })
          }
        } catch {
          // Ignore volume read error if any
        }
      } else if (isWin) {
        // Enumerate Windows drive letters (D:, E:, F:, G:, etc.)
        const letters = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('')
        for (const letter of letters) {
          const driveLetterPath = `${letter}:\\`
          if (fs.existsSync(driveLetterPath)) {
            drives.push({
              name: `Диск (${letter}:)`,
              path: driveLetterPath,
              icon: 'HardDrive',
              type: 'volume',
              isRemovable: true,
            })
          }
        }
      }

      // Filter only paths that actually exist and attach free/total disk space
      const existingDrives = []
      for (const d of drives) {
        if (fs.existsSync(d.path)) {
          try {
            const stat = await fsPromises.statfs(d.path)
            d.totalSpace = stat.bsize * stat.blocks
            d.freeSpace = stat.bsize * stat.bavail
          } catch {
            // Virtual or unreadable filesystem
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
  ipcMain.handle('fs:getDiskSpace', async (_, dirPath: string) => {
    try {
      const stats = await fsPromises.statfs(dirPath)
      return {
        success: true,
        total: stats.bsize * stats.blocks,
        free: stats.bsize * stats.bavail,
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Eject USB / External Volume
  ipcMain.handle('fs:ejectVolume', async (_, volumePath: string) => {
    try {
      if (!volumePath.startsWith('/Volumes/')) {
        return { success: false, error: 'Тільки зовнішні томи або USB можна вилучити' }
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

  // Delete Paths (Move to Trash by default, or permanent with fallback)
  ipcMain.handle('fs:deletePaths', async (_, paths: string[], moveToTrash = true) => {
    try {
      for (const itemPath of paths) {
        if (moveToTrash) {
          try {
            await shell.trashItem(itemPath)
          } catch (trashErr) {
            // Fallback to permanent removal if macOS Trash rejects path (e.g. external volumes or protected temp)
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
      for (const src of sources) {
        const baseName = path.basename(src)
        const dest = path.join(destinationDir, baseName)
        if (src === dest) {
          // If copying to same directory, create copy name: filename - Copy.ext
          const ext = path.extname(baseName)
          const nameWithoutExt = path.basename(baseName, ext)
          const copyDest = path.join(destinationDir, `${nameWithoutExt} - Copy${ext}`)
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
      for (const src of sources) {
        const baseName = path.basename(src)
        const dest = path.join(destinationDir, baseName)
        if (src === dest) continue

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

  // Read File Content (for F3 Viewer and F4 Editor)
  ipcMain.handle('fs:readFile', async (_, filePath: string, maxBytes = 2 * 1024 * 1024) => {
    try {
      const stats = await fsPromises.stat(filePath)
      if (stats.size > maxBytes) {
        return {
          success: false,
          error: `File is too large to display directly (${(stats.size / (1024 * 1024)).toFixed(1)} MB). Limit is 2 MB.`,
        }
      }

      const buffer = await fsPromises.readFile(filePath)
      // Check if binary (null bytes test)
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

  // Write File Content (for F4 Editor)
  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    try {
      await fsPromises.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Open with macOS default app
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

  // Open Directory in System Terminal (macOS Terminal / Windows cmd or PowerShell)
  ipcMain.handle('fs:openInTerminal', async (_, dirPath: string) => {
    try {
      if (process.platform === 'win32') {
        exec(`start cmd /K cd /D "${dirPath}"`, (err) => {
          if (err) console.error('Failed to open CMD:', err)
        })
      } else {
        exec(`open -a Terminal "${dirPath}"`, (err) => {
          if (err) console.error('Failed to open Terminal:', err)
        })
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // macOS QuickLook (`qlmanage -p`)
  ipcMain.handle('fs:quickLook', async (_, filePath: string) => {
    try {
      exec(`qlmanage -p "${filePath}" >/dev/null 2>&1 &`)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Calculate Directory Size
  ipcMain.handle('fs:getDirSize', async (_, dirPath: string) => {
    try {
      let totalSize = 0
      let totalCount = 0

      async function scan(current: string, depth = 0) {
        if (depth > 6) return
        const entries = await fsPromises.readdir(current, { withFileTypes: true })
        for (const e of entries) {
          const subPath = path.join(current, e.name)
          if (e.isDirectory()) {
            await scan(subPath, depth + 1)
          } else {
            const st = await fsPromises.lstat(subPath)
            totalSize += st.size
            totalCount++
          }
        }
      }

      await scan(dirPath)
      return { success: true, size: totalSize, count: totalCount }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // File Search (Total Commander Alt+F7)
  ipcMain.handle('fs:search', async (_, dirPath: string, query: string, recursive = true, contentSearch?: string) => {
    try {
      const results: any[] = []
      const lowerQuery = query.toLowerCase()
      const maxResults = 300

      async function searchDir(current: string, depth = 0) {
        if (results.length >= maxResults) return
        if (depth > 8) return

        let entries
        try {
          entries = await fsPromises.readdir(current, { withFileTypes: true })
        } catch {
          return
        }

        for (const entry of entries) {
          if (results.length >= maxResults) break
          const fullPath = path.join(current, entry.name)
          const nameMatches = !query || entry.name.toLowerCase().includes(lowerQuery)

          let contentMatchLine: string | undefined

          if (contentSearch && entry.isFile()) {
            try {
              const fileContent = await fsPromises.readFile(fullPath, 'utf8')
              const lines = fileContent.split('\n')
              const foundLine = lines.find((l) => l.toLowerCase().includes(contentSearch.toLowerCase()))
              if (foundLine) {
                contentMatchLine = foundLine.trim().slice(0, 100)
              } else {
                continue // Doesn't match content search
              }
            } catch {
              continue
            }
          }

          if (nameMatches || contentMatchLine) {
            let size = 0
            try {
              if (entry.isFile()) {
                const st = await fsPromises.lstat(fullPath)
                size = st.size
              }
            } catch {}

            results.push({
              name: entry.name,
              path: fullPath,
              isDirectory: entry.isDirectory(),
              size,
              matchLine: contentMatchLine,
            })
          }

          if (recursive && entry.isDirectory() && !entry.name.startsWith('.')) {
            await searchDir(fullPath, depth + 1)
          }
        }
      }

      await searchDir(dirPath)
      return { success: true, results }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  let appClipboard: { paths: string[]; action: 'copy' | 'cut' } = { paths: [], action: 'copy' }

  // Copy Files to System Clipboard & In-App Store
  ipcMain.handle('clipboard:copyFiles', async (_, paths: string[], action: 'copy' | 'cut' = 'copy') => {
    try {
      if (!paths || paths.length === 0) {
        return { success: false, error: 'Не вибрано файлів' }
      }

      const validPaths = paths.filter((p) => fs.existsSync(p))
      if (validPaths.length === 0) {
        return { success: false, error: 'Файли не знайдено на диску' }
      }

      appClipboard = { paths: validPaths, action }

      // 1. Text format (for pasting in terminal, notes, editors, web)
      clipboard.writeText(validPaths.join('\n'))

      // 2. Native macOS NSFilenamesPboardType (standard Apple pasteboard for files)
      const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
${validPaths.map((p) => `  <string>${p}</string>`).join('\n')}
</array>
</plist>`
      clipboard.writeBuffer('NSFilenamesPboardType', Buffer.from(plist, 'utf-8'))

      return { success: true, count: validPaths.length, action }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Read Files from Clipboard
  ipcMain.handle('clipboard:getFiles', async () => {
    try {
      // 1. Check in-app clipboard first
      if (appClipboard.paths.length > 0) {
        const existing = appClipboard.paths.filter((p) => fs.existsSync(p))
        if (existing.length > 0) {
          return { success: true, paths: existing, action: appClipboard.action }
        }
      }

      // 2. Check native NSFilenamesPboardType
      const buffer = clipboard.readBuffer('NSFilenamesPboardType')
      if (buffer && buffer.length > 0) {
        const xml = buffer.toString('utf-8')
        const matches = xml.match(/<string>(.*?)<\/string>/g)
        if (matches) {
          const paths = matches
            .map((m) => m.replace(/<\/?string>/g, '').trim())
            .filter((p) => fs.existsSync(p))
          if (paths.length > 0) {
            return { success: true, paths, action: 'copy' }
          }
        }
      }

      // 3. Fallback: check text clipboard lines
      const text = clipboard.readText().trim()
      if (text) {
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
        const valid = lines
          .map((l) => l.replace(/^file:\/\//, ''))
          .filter((l) => l.startsWith('/') && fs.existsSync(l))
        if (valid.length > 0) {
          return { success: true, paths: valid, action: 'copy' }
        }
      }

      return { success: true, paths: [], action: 'copy' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Clear In-App Clipboard
  ipcMain.handle('clipboard:clear', async () => {
    appClipboard = { paths: [], action: 'copy' }
    return { success: true }
  })
}
