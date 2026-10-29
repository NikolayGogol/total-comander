import { app, BrowserWindow, ipcMain, shell, Menu, clipboard } from 'electron'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import os from 'os'
import { exec, execFile, execSync } from 'child_process'

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

function runPowerShell(script: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const defaultPs = path.join(
      process.env.SystemRoot || 'C:\\Windows',
      'System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    )
    const psExe = fs.existsSync(defaultPs) ? `"${defaultPs}"` : 'powershell.exe'
    const buffer = Buffer.from(script, 'utf16le')
    const base64Script = buffer.toString('base64')
    const cmd = `${psExe} -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${base64Script}`

    exec(cmd, { windowsHide: true, timeout: 8000 }, (error, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || (error ? error.message : '') })
    })
  })
}

const driveInfoCache = new Map<string, { type: string; label: string }>()

async function refreshDriveTypes(): Promise<void> {
  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
[System.IO.DriveInfo]::GetDrives() | ForEach-Object {
    $t = $_.DriveType.ToString()
    $n = $_.Name.TrimEnd('\\')
    $lbl = ''
    try { if ($_.IsReady) { $lbl = $_.VolumeLabel } } catch {}
    Write-Output "$n|$t|$lbl"
}
`
  const { stdout } = await runPowerShell(script)
  if (stdout) {
    const lines = stdout.split(/\r?\n/)
    for (const line of lines) {
      const parts = line.trim().split('|')
      if (parts.length >= 2) {
        const letter = parts[0].replace(/[:\\/]/g, '').toUpperCase()
        if (letter) {
          const rawLabel = parts[2] || ''
          const cleanLabel = rawLabel.replace(/[\uFFFD\0]/g, '').trim()
          driveInfoCache.set(letter, {
            type: parts[1] || 'Fixed',
            label: cleanLabel,
          })
        }
      }
    }
  }
}

function getAppIcon(): string | undefined {
  const possiblePaths = [
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, '../public/icon.ico'),
    path.join(process.env.DIST || '', 'icon.ico'),
    path.join(__dirname, 'icon.ico'),
    path.join(process.resourcesPath || '', 'build/icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico'),
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p
  }
  return undefined
}

function get7zPath(): string | null {
  const possiblePaths = [
    path.join(__dirname, '../bin/7za.exe'),
    path.join(process.resourcesPath || '', 'bin/7za.exe'),
    path.join(process.resourcesPath || '', '7za.exe'),
    path.join(__dirname, '7za.exe'),
    path.join(process.cwd(), 'bin/7za.exe'),
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe',
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function getRarPath(): string | null {
  const possiblePaths = [
    path.join(__dirname, '../bin/rar.exe'),
    path.join(process.resourcesPath || '', 'bin/rar.exe'),
    path.join(process.resourcesPath || '', 'rar.exe'),
    path.join(process.cwd(), 'bin/rar.exe'),
    'C:\\Program Files\\WinRAR\\rar.exe',
    'C:\\Program Files (x86)\\WinRAR\\rar.exe',
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'WinRAR', 'rar.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'WinRAR', 'rar.exe'),
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function getUnrarPath(): string | null {
  const possiblePaths = [
    path.join(__dirname, '../bin/unrar.exe'),
    path.join(process.resourcesPath || '', 'bin/unrar.exe'),
    path.join(process.resourcesPath || '', 'unrar.exe'),
    path.join(process.cwd(), 'bin/unrar.exe'),
    'C:\\Program Files\\WinRAR\\UnRAR.exe',
    'C:\\Program Files (x86)\\WinRAR\\UnRAR.exe',
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'WinRAR', 'UnRAR.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'WinRAR', 'UnRAR.exe'),
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function createWindow() {
  const iconPath = getAppIcon()

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: `Total Commander v${app.getVersion()}`,
    icon: iconPath,
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    backgroundColor: '#0c0f16',
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
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
}

function setupAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Оновити',
          accelerator: 'Ctrl+R',
          click: (_, focusedWindow) => {
            focusedWindow?.webContents.send('app:command', 'refresh')
          },
        },
        { type: 'separator' },
        { role: 'quit', label: 'Вихід' },
      ],
    },
    {
      label: 'Правка',
      submenu: [
        {
          label: 'Копіювати',
          accelerator: 'Ctrl+C',
          click: (_, focusedWindow) => {
            focusedWindow?.webContents.send('app:command', 'copy')
          },
        },
        {
          label: 'Вирізати',
          accelerator: 'Ctrl+X',
          click: (_, focusedWindow) => {
            focusedWindow?.webContents.send('app:command', 'cut')
          },
        },
        {
          label: 'Вставити',
          accelerator: 'Ctrl+V',
          click: (_, focusedWindow) => {
            focusedWindow?.webContents.send('app:command', 'paste')
          },
        },
        {
          label: 'Виділити все',
          accelerator: 'Ctrl+A',
          click: (_, focusedWindow) => {
            focusedWindow?.webContents.send('app:command', 'selectAll')
          },
        },
      ],
    },
    {
      label: 'Вигляд',
      submenu: [
        { role: 'reload', label: 'Перезавантажити' },
        { role: 'forceReload', label: 'Примусове перезавантаження' },
        { role: 'toggleDevTools', label: 'Інструменти розробника' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Скинути масштаб' },
        { role: 'zoomIn', label: 'Збільшити' },
        { role: 'zoomOut', label: 'Зменшити' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Повноекранний режим' },
      ],
    },
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  setupAppMenu()
  setupIpcHandlers()
  setupVolumeWatcher()
  createWindow()
  refreshDriveTypes().catch(() => {})

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

function setupVolumeWatcher() {
  let knownDrives = ''
  setInterval(async () => {
    try {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
      const current = letters.filter((l) => fs.existsSync(`${l}:\\`)).join(',')
      if (knownDrives && current !== knownDrives) {
        await refreshDriveTypes()
        if (win && !win.isDestroyed()) {
          win.webContents.send('drives:changed')
        }
      }
      knownDrives = current
    } catch {}
  }, 2000)
}

function setupIpcHandlers() {
  // System Info
  ipcMain.handle('app:getSystemInfo', async () => {
    return {
      homeDir: os.homedir(),
      tmpDir: os.tmpdir(),
      platform: process.platform,
      username: os.userInfo().username,
      version: app.getVersion(),
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

  // Quick Access / Drives
  ipcMain.handle('fs:getDrives', async () => {
    try {
      if (driveInfoCache.size === 0) {
        await Promise.race([
          refreshDriveTypes(),
          new Promise((r) => setTimeout(r, 1500)),
        ])
      }

      const systemDrive = process.env.SystemDrive ? process.env.SystemDrive.toUpperCase() + '\\' : 'C:\\'
      const drives: any[] = []

      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
      for (const letter of letters) {
        const drivePath = `${letter}:\\`
        if (fs.existsSync(drivePath)) {
          const isSys = drivePath.toUpperCase() === systemDrive
          const info = driveInfoCache.get(letter)

          let dType = info?.type
          if (!dType) {
            dType = isSys || letter === 'D' ? 'Fixed' : 'Removable'
          }

          const isRemovable = dType === 'Removable' || dType === 'CDRom'

          let icon = 'HardDrive'
          let type = 'volume'
          if (isSys) {
            type = 'root'
            icon = 'HardDrive'
          } else if (dType === 'Removable') {
            type = 'usb'
            icon = 'Usb'
          } else if (dType === 'CDRom') {
            type = 'cdrom'
            icon = 'Disc'
          }

          const driveName = `Диск (${letter}:)`

          drives.push({
            name: driveName,
            path: drivePath,
            icon,
            type,
            label: info?.label || undefined,
            isRemovable,
          })
        }
      }

      // Calculate disk space
      for (const d of drives) {
        try {
          const stat = await fsPromises.statfs(d.path)
          d.totalSpace = stat.bsize * stat.blocks
          d.freeSpace = stat.bsize * stat.bavail
        } catch {
          // Virtual or unreadable filesystem
        }
      }

      return { success: true, data: drives }
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

  // Eject USB / External Volume / Virtual Disk
  ipcMain.handle('fs:ejectVolume', async (_, volumePath: string) => {
    try {
      const match = volumePath.match(/^([A-Za-z]):/)
      if (!match) {
        return { success: false, error: 'Некоректний шлях до носія' }
      }
      const letter = match[1].toUpperCase()
      const drivePath = `${letter}:\\`

      const sysDriveLetter = (process.env.SystemDrive || 'C:').charAt(0).toUpperCase()
      if (letter === sysDriveLetter) {
        return { success: false, error: 'Неможливо вилучити системний диск' }
      }

      const cachedInfo = driveInfoCache.get(letter)
      if (cachedInfo && cachedInfo.type === 'Fixed') {
        return { success: false, error: 'Неможливо вилучити вбудований фіксований диск' }
      }

      const ejectScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$target = '${letter}'
$drivePath = '${letter}:\\'

# 1. Dismount mounted ISO / Disk Image if applicable
try {
    $vol = Get-Volume -DriveLetter $target -ErrorAction SilentlyContinue
    if ($vol) {
        $img = Get-DiskImage -DevicePath $vol.Path -ErrorAction SilentlyContinue
        if ($img) {
            Dismount-DiskImage -DevicePath $vol.Path -ErrorAction SilentlyContinue
        }
    }
} catch {}

# 2. Shell COM: Direct folder item
try {
    $sh = New-Object -ComObject Shell.Application
    $driveFolder = $sh.NameSpace($drivePath)
    if ($driveFolder -and $driveFolder.Self) {
        $item = $driveFolder.Self
        $executed = $false
        foreach ($verb in $item.Verbs()) {
            $vName = $verb.Name.Replace('&', '').Trim()
            if ($vName -match '^(Eject|Вилучити|Витягнути|Извлечь|Wysuń|Auswerfen|Éjecter)') {
                $verb.DoIt()
                $executed = $true
                break
            }
        }
        if (-not $executed) {
            $item.InvokeVerb('Eject')
        }
    }
} catch {}

# 3. Shell COM: Search in 'This PC' (Namespace 17)
try {
    $sh = New-Object -ComObject Shell.Application
    $pc = $sh.Namespace(17)
    if ($pc) {
        foreach ($item in $pc.Items()) {
            $p = $item.Path
            $n = $item.Name
            if ($p -eq $drivePath -or $p -like ($target + ':*') -or $n -like ('*(' + $target + ':)*') -or $n -like ('*' + $target + ':*')) {
                foreach ($verb in $item.Verbs()) {
                    $vName = $verb.Name.Replace('&', '').Trim()
                    if ($vName -match '^(Eject|Вилучити|Витягнути|Извлечь|Wysuń|Auswerfen|Éjecter)') {
                        $verb.DoIt()
                        break
                    }
                }
                $item.InvokeVerb('Eject')
                break
            }
        }
    }
} catch {}

# 4. Fallback mountvol dismount
try {
    & mountvol.exe ($target + ':') /p 2>$null
} catch {}

# Allow Windows Explorer time to process asynchronous COM verb
Start-Sleep -Milliseconds 800
Write-Output "DONE"
`
      await runPowerShell(ejectScript)

      // Poll up to 3.5 seconds to confirm the drive is actually dismounted
      let dismounted = false
      for (let i = 0; i < 7; i++) {
        if (!fs.existsSync(drivePath)) {
          dismounted = true
          break
        }
        await new Promise((r) => setTimeout(r, 500))
      }

      if (dismounted) {
        driveInfoCache.delete(letter)
        if (win && !win.isDestroyed()) {
          win.webContents.send('drives:changed')
        }
        return { success: true }
      } else {
        return {
          success: false,
          error: `Диск (${letter}:) зайнятий іншою програмою або системою Windows. Будь ласка, закрийте відкриті файли і спробуйте знову.`,
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка при вилученні носія' }
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
            exec(`"${targetCmd}" /c start "" "${psExe}" -NoExit -Command "Set-Location -LiteralPath '${escapedDir}'"`, { cwd: cleanDir }, (psErr) => {
              if (psErr) {
                launchCmd()
              } else {
                resolve({ success: true })
              }
            })
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

  // Create ZIP Archive
  ipcMain.handle('fs:createZip', async (_, sources: string[], targetZipPath: string) => {
    try {
      if (!sources || sources.length === 0) {
        return { success: false, error: 'Не вибрано файли для архівування' }
      }

      const parentDir = path.dirname(sources[0])
      const basenames = sources.map((s) => path.basename(s))
      const sysRoot = process.env.SystemRoot || 'C:\\Windows'
      const sysTar = path.join(sysRoot, 'System32', 'tar.exe')
      const tarExe = fs.existsSync(sysTar) ? sysTar : null

      if (tarExe) {
        const escapedNames = basenames.map((b) => `"${b}"`).join(' ')
        const cmd = `"${tarExe}" -a -c -f "${targetZipPath}" -C "${parentDir}" ${escapedNames}`
        await new Promise<void>((resolve, reject) => {
          exec(cmd, { cwd: parentDir }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve()
          })
        })
        return { success: true }
      } else {
        const psList = sources.map((s) => `'${s.replace(/'/g, "''")}'`).join(', ')
        const psScript = `Compress-Archive -LiteralPath @(${psList}) -DestinationPath '${targetZipPath.replace(/'/g, "''")}' -Force`
        const { error } = await runPowerShell(psScript)
        if (error) return { success: false, error }
        return { success: true }
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка архівування' }
    }
  })

  async function safeEnsureDir(dirPath: string) {
    if (!dirPath) return
    const clean = dirPath.trim()
    if (/^[a-zA-Z]:[/\\]?$/.test(clean) || clean === '/' || clean === '\\') return
    if (!fs.existsSync(clean)) {
      try {
        await fsPromises.mkdir(clean, { recursive: true })
      } catch (e: any) {
        if (e.code !== 'EEXIST') throw e
      }
    }
  }

  // Extract ZIP Archive
  ipcMain.handle('fs:extractZip', async (_, zipPath: string, targetDir: string) => {
    try {
      if (!fs.existsSync(zipPath)) {
        return { success: false, error: 'Файл архіву не знайдено' }
      }

      await safeEnsureDir(targetDir)
      const sysRoot = process.env.SystemRoot || 'C:\\Windows'
      const sysTar = path.join(sysRoot, 'System32', 'tar.exe')
      const tarExe = fs.existsSync(sysTar) ? sysTar : null

      if (tarExe) {
        const cmd = `"${tarExe}" -xf "${zipPath}" -C "${targetDir}"`
        await new Promise<void>((resolve, reject) => {
          exec(cmd, { cwd: targetDir }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve()
          })
        })
        return { success: true }
      } else {
        const psScript = `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`
        const { error } = await runPowerShell(psScript)
        if (error) return { success: false, error }
        return { success: true }
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка розархівування' }
    }
  })

  // Create Archive (7Z, ZIP, RAR with optional password & compression level)
  ipcMain.handle('fs:createArchive', async (_, options: {
    sources: string[]
    targetPath: string
    format: 'zip' | '7z' | 'rar'
    password?: string
    level?: number
    encryptHeader?: boolean
  }) => {
    try {
      const { sources, targetPath, format, password, level = 5, encryptHeader } = options
      if (!sources || sources.length === 0) {
        return { success: false, error: 'Не вибрано файли для архівування' }
      }

      await safeEnsureDir(path.dirname(targetPath))
      const parentDir = path.dirname(sources[0])
      const basenames = sources.map((s) => path.basename(s))
      const sevenZip = get7zPath()
      const rarPath = getRarPath()

      if (format === 'rar') {
        if (!rarPath) {
          return { success: false, error: 'Архіватор RAR не знайдено на системі.' }
        }
        const rarLevel = level >= 9 ? '5' : (level <= 1 ? '1' : '3')
        const args: string[] = ['a', '-ep1', '-y', `-m${rarLevel}`]
        if (password) {
          args.push(`-p${password}`)
          if (encryptHeader) {
            args.push(`-hp${password}`)
          }
        }
        args.push(targetPath)
        args.push(...basenames)

        await new Promise<void>((resolve, reject) => {
          execFile(rarPath, args, { cwd: parentDir }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve()
          })
        })
        return { success: true, targetPath }
      }

      if (sevenZip) {
        const typeArg = format === '7z' ? '-t7z' : '-tzip'
        const args: string[] = ['a', typeArg, '-y', `-mx${level}`]
        if (password) {
          args.push(`-p${password}`)
        }
        if (format === '7z' && password && encryptHeader) {
          args.push('-mhe=on')
        }
        args.push(targetPath)
        args.push(...basenames)

        await new Promise<void>((resolve, reject) => {
          execFile(sevenZip, args, { cwd: parentDir }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve()
          })
        })
        return { success: true, targetPath }
      }

      // Fallback for zip
      const sysRoot = process.env.SystemRoot || 'C:\\Windows'
      const tarExe = path.join(sysRoot, 'System32', 'tar.exe')
      if (fs.existsSync(tarExe) && !password && format === 'zip') {
        const args: string[] = ['-a', '-c', '-f', targetPath, '-C', parentDir, ...basenames]
        await new Promise<void>((resolve, reject) => {
          execFile(tarExe, args, { cwd: parentDir }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve()
          })
        })
        return { success: true, targetPath }
      }

      return { success: false, error: 'Архіватор не знайдено' }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка архівування' }
    }
  })

  // List files inside archive (7Z, ZIP, RAR, TAR, GZ)
  ipcMain.handle('fs:listArchive', async (_, archivePath: string, password?: string) => {
    try {
      if (!fs.existsSync(archivePath)) {
        return { success: false, error: 'Архів не знайдено' }
      }

      const sevenZip = get7zPath()
      const ext = path.extname(archivePath).toLowerCase()

      if (sevenZip) {
        const passArg = password ? `-p"${password.replace(/"/g, '\\"')}"` : '-p-'
        const cmd = `"${sevenZip}" l -slt -ba ${passArg} "${archivePath}"`

        const output = await new Promise<string>((resolve, reject) => {
          exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (stdout) return resolve(stdout)
            if (err) {
              const str = (stderr || err.message || '').toLowerCase()
              if (str.includes('wrong password') || str.includes('password') || str.includes('can not open encrypted')) {
                return reject(new Error('WRONG_PASSWORD'))
              }
              return reject(new Error(stderr || err.message))
            }
            resolve('')
          })
        }).catch((err) => {
          if (err.message === 'WRONG_PASSWORD') throw err
          return ''
        })

        if (output) {
          const entries: any[] = []
          const blocks = output.split(/\r?\n\r?\n/)

          for (const block of blocks) {
            const lines = block.split(/\r?\n/)
            let itemPath = ''
            let isFolder = false
            let size = 0
            let packedSize = 0
            let modified = ''
            let encrypted = false

            for (const line of lines) {
              const eq = line.indexOf('=')
              if (eq === -1) continue
              const key = line.slice(0, eq).trim()
              const val = line.slice(eq + 1).trim()

              if (key === 'Path') itemPath = val
              else if (key === 'Folder') isFolder = val === '+'
              else if (key === 'Size') size = parseInt(val, 10) || 0
              else if (key === 'Packed Size') packedSize = parseInt(val, 10) || 0
              else if (key === 'Modified') modified = val
              else if (key === 'Encrypted') encrypted = val === '+'
            }

            if (itemPath && itemPath !== path.basename(archivePath)) {
              entries.push({
                path: itemPath,
                name: itemPath.split(/[/\\]/).filter(Boolean).pop() || itemPath,
                isDirectory: isFolder,
                size,
                packedSize,
                modified,
                encrypted,
              })
            }
          }

          if (entries.length > 0) {
            return { success: true, entries }
          }
        }
      }

      // If RAR and 7za couldn't read (e.g. RAR5), try bundled unrar/rar
      const rarTool = getUnrarPath() || getRarPath()
      if (ext === '.rar' && rarTool) {
        const passArg = password ? `-p"${password.replace(/"/g, '\\"')}"` : '-p-'
        const cmd = `"${rarTool}" vb -c- ${passArg} "${archivePath}"`
        const out = await new Promise<string>((resolve, reject) => {
          exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve(stdout || '')
          })
        }).catch(() => '')

        if (out) {
          const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
          const entries = lines.map((l) => ({
            path: l,
            name: l.split(/[/\\]/).filter(Boolean).pop() || l,
            isDirectory: l.endsWith('/') || l.endsWith('\\'),
            size: 0,
          }))
          return { success: true, entries }
        }
      }

      return { success: false, error: 'Не вдалося прочитати вміст архіву' }
    } catch (err: any) {
      if (err.message === 'WRONG_PASSWORD') {
        return { success: false, error: 'Потрібен пароль або пароль некоректний', isEncrypted: true }
      }
      return { success: false, error: err.message || 'Помилка відкриття архіву' }
    }
  })

  // Extract Archive
  ipcMain.handle('fs:extractArchive', async (_, archivePath: string, targetDir: string, password?: string) => {
    try {
      if (!fs.existsSync(archivePath)) {
        return { success: false, error: 'Файл архіву не знайдено' }
      }

      await safeEnsureDir(targetDir)
      const ext = path.extname(archivePath).toLowerCase()
      const sevenZip = get7zPath()
      const rarTool = getUnrarPath() || getRarPath()

      if (ext === '.rar' && rarTool) {
        const passArg = password ? `-p"${password.replace(/"/g, '\\"')}"` : ''
        const cmd = `"${rarTool}" x -y -ep1 ${passArg} "${archivePath}" "${targetDir}\\"`
        await new Promise<void>((resolve, reject) => {
          exec(cmd, { cwd: targetDir }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve()
          })
        })
        return { success: true }
      }

      if (sevenZip) {
        const passArg = password ? `-p"${password.replace(/"/g, '\\"')}"` : ''
        const cmd = `"${sevenZip}" x -y -aoa ${passArg} -o"${targetDir}" "${archivePath}"`
        await new Promise<void>((resolve, reject) => {
          exec(cmd, { cwd: targetDir }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve()
          })
        })
        return { success: true }
      }

      const sysRoot = process.env.SystemRoot || 'C:\\Windows'
      const tarExe = path.join(sysRoot, 'System32', 'tar.exe')
      if (fs.existsSync(tarExe)) {
        const cmd = `"${tarExe}" -xf "${archivePath}" -C "${targetDir}"`
        await new Promise<void>((resolve, reject) => {
          exec(cmd, { cwd: targetDir }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve()
          })
        })
        return { success: true }
      }

      return { success: false, error: 'Утиліту для розпакування не знайдено' }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка розархівування' }
    }
  })

  // Calculate Directory Size
  ipcMain.handle('fs:getDirSize', async (_, dirPath: string) => {
    try {
      let totalSize = 0
      let totalCount = 0

      async function scan(current: string, depth = 0) {
        if (depth > 18) return
        let entries
        try {
          entries = await fsPromises.readdir(current, { withFileTypes: true })
        } catch {
          return
        }
        for (const e of entries) {
          const subPath = path.join(current, e.name)
          if (e.isDirectory()) {
            if (e.isSymbolicLink()) continue
            await scan(subPath, depth + 1)
          } else {
            try {
              const st = await fsPromises.stat(subPath)
              totalSize += st.size
              totalCount++
            } catch {}
          }
        }
      }

      await scan(dirPath)
      return { success: true, size: totalSize, count: totalCount }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Analyze Folder & Subfolders Sizes (Folder Size Modal)
  ipcMain.handle('fs:analyzeFolderSizes', async (_, targetPath: string) => {
    try {
      if (!fs.existsSync(targetPath)) {
        return { success: false, error: 'Папка не існує' }
      }

      const stat = await fsPromises.stat(targetPath)
      if (!stat.isDirectory()) {
        return { success: false, error: 'Вказаний шлях не є папкою' }
      }

      const entries = await fsPromises.readdir(targetPath, { withFileTypes: true })
      const subdirs = entries.filter((e) => e.isDirectory() && !e.isSymbolicLink())

      const foldersToScan: { name: string; path: string }[] = []
      for (const d of subdirs) {
        foldersToScan.push({
          name: d.name,
          path: path.join(targetPath, d.name),
        })
      }

      if (foldersToScan.length === 0) {
        foldersToScan.push({
          name: path.basename(targetPath) || targetPath,
          path: targetPath,
        })
      }

      const results: Array<{
        name: string
        path: string
        size: number
        fileCount: number
        dirCount: number
      }> = []

      let grandTotalSize = 0
      let grandTotalFiles = 0

      for (const f of foldersToScan) {
        let fSize = 0
        let fFiles = 0
        let fDirs = 0

        async function walk(cur: string, depth = 0) {
          if (depth > 18) return
          let subEntries
          try {
            subEntries = await fsPromises.readdir(cur, { withFileTypes: true })
          } catch {
            return
          }
          for (const se of subEntries) {
            if (se.isDirectory()) {
              if (se.isSymbolicLink()) continue
              fDirs++
              await walk(path.join(cur, se.name), depth + 1)
            } else if (se.isFile()) {
              try {
                const s = await fsPromises.stat(path.join(cur, se.name))
                fSize += s.size
                fFiles++
              } catch {}
            }
          }
        }

        await walk(f.path)
        results.push({
          name: f.name,
          path: f.path,
          size: fSize,
          fileCount: fFiles,
          dirCount: fDirs,
        })
        grandTotalSize += fSize
        grandTotalFiles += fFiles
      }

      if (/^[a-zA-Z]:[/\\]?$/.test(targetPath)) {
        const locked = getWindowsLockedFiles(targetPath)
        for (const lf of locked) {
          results.push({
            name: `${lf.name} (системний файл Windows)`,
            path: lf.path,
            size: lf.size,
            fileCount: 1,
            dirCount: 0,
          })
          grandTotalSize += lf.size
          grandTotalFiles += 1
        }
      }

      results.sort((a, b) => b.size - a.size)

      return {
        success: true,
        parentPath: targetPath,
        folders: results,
        totalSize: grandTotalSize,
        totalFiles: grandTotalFiles,
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка аналізу розміру папок' }
    }
  })

  function getWindowsLockedFiles(driveRoot: string): Array<{
    path: string
    name: string
    size: number
    mtime: number
    extension: string
    dir: string
  }> {
    const list: Array<{
      path: string
      name: string
      size: number
      mtime: number
      extension: string
      dir: string
    }> = []
    if (process.platform !== 'win32') return list

    const cleanRoot = driveRoot.replace(/[/\\]+$/, '') + '\\'
    const lockedCandidates = ['hiberfil.sys', 'pagefile.sys', 'swapfile.sys', 'MEMORY.DMP']

    for (const fileName of lockedCandidates) {
      const full = path.join(cleanRoot, fileName)
      try {
        const out = execSync(`cmd /c dir /-c /a "${full}"`, { encoding: 'utf8', timeout: 800 })
        const match = out.match(/File\(s\)\s+(\d+)\s+bytes/i)
        if (match) {
          const sz = parseInt(match[1], 10)
          if (sz > 0) {
            list.push({
              path: full,
              name: fileName,
              size: sz,
              mtime: Date.now(),
              extension: fileName.split('.').pop() || 'sys',
              dir: cleanRoot,
            })
          }
        }
      } catch {}
    }
    return list
  }

  // Find Large Files (Disk Space Analyzer / Cleanup)
  ipcMain.handle('fs:findLargeFiles', async (_, options: {
    targetDir: string
    minSizeBytes: number
    limit?: number
  }) => {
    try {
      const { targetDir, minSizeBytes = 50 * 1024 * 1024, limit = 200 } = options
      if (!targetDir || !fs.existsSync(targetDir)) {
        return { success: false, error: 'Директорія або диск не існує' }
      }

      const largeFiles: Array<{
        path: string
        name: string
        size: number
        mtime: number
        extension: string
        dir: string
      }> = []

      let scannedCount = 0
      let totalSize = 0

      // If scanning root of a drive, immediately grab locked system files (hiberfil.sys, pagefile.sys)
      const isDriveRoot = /^[a-zA-Z]:[/\\]?$/.test(targetDir)
      if (isDriveRoot) {
        const locked = getWindowsLockedFiles(targetDir)
        for (const lf of locked) {
          if (lf.size >= minSizeBytes) {
            totalSize += lf.size
            largeFiles.push(lf)
          }
        }
      }

      // System / junk / looped folders to skip
      const skipNames = new Set([
        '$recycle.bin',
        'system volume information',
        'recovery',
        'msocache',
        'winsxs',
        'assembly',
        'node_modules',
      ])

      const queue: { dir: string; depth: number }[] = [{ dir: targetDir, depth: 0 }]

      while (queue.length > 0 && scannedCount < 600000) {
        const current = queue.shift()!
        if (current.depth > 14) continue

        let entries: fs.Dirent[]
        try {
          entries = await fsPromises.readdir(current.dir, { withFileTypes: true })
        } catch {
          continue
        }

        // If at root of a drive, prioritize user directories over Windows system internals
        if (current.depth === 0) {
          entries.sort((a, b) => {
            const aName = a.name.toLowerCase()
            const bName = b.name.toLowerCase()
            if (aName === 'users') return -1
            if (bName === 'users') return 1
            if (aName.includes('program')) return -1
            if (bName.includes('program')) return 1
            if (aName.includes('games') || aName.includes('xbox')) return -1
            if (bName.includes('games') || bName.includes('xbox')) return 1
            if (aName === 'windows') return 1
            if (bName === 'windows') return -1
            return 0
          })
        }

        for (const entry of entries) {
          scannedCount++
          const lowerName = entry.name.toLowerCase()

          if (entry.isDirectory()) {
            if (skipNames.has(lowerName)) continue
            if (entry.isSymbolicLink()) continue
            // Restrict depth inside Windows system internals
            if (current.dir.toLowerCase().includes('\\windows') && current.depth >= 3) continue
            queue.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 })
          } else if (entry.isFile()) {
            try {
              const fullPath = path.join(current.dir, entry.name)
              const st = await fsPromises.stat(fullPath)
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

      // Sort descending by size (largest first)
      largeFiles.sort((a, b) => b.size - a.size)

      const resultFiles = limit > 0 ? largeFiles.slice(0, limit) : largeFiles
      return {
        success: true,
        files: resultFiles,
        totalSize,
        scannedCount,
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка сканування великих файлів' }
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
              const lines = fileContent.split(/\r?\n/)
              const foundLine = lines.find((l) => l.toLowerCase().includes(contentSearch.toLowerCase()))
              if (foundLine) {
                contentMatchLine = foundLine.trim().slice(0, 100)
              } else {
                continue
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

  // Copy Files to Clipboard
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
      clipboard.writeText(validPaths.join('\r\n'))

      return { success: true, count: validPaths.length, action }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Read Files from Clipboard
  ipcMain.handle('clipboard:getFiles', async () => {
    try {
      if (appClipboard.paths.length > 0) {
        const existing = appClipboard.paths.filter((p) => fs.existsSync(p))
        if (existing.length > 0) {
          return { success: true, paths: existing, action: appClipboard.action }
        }
      }

      const text = clipboard.readText().trim()
      if (text) {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        const valid = lines
          .map((l) => {
            let p = l.replace(/^file:\/\/\/?/, '')
            try {
              p = decodeURI(p)
            } catch {}
            return p
          })
          .filter((l) => fs.existsSync(l))

        if (valid.length > 0) {
          return { success: true, paths: valid, action: 'copy' }
        }
      }

      return { success: true, paths: [], action: 'copy' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Clear Clipboard
  ipcMain.handle('clipboard:clear', async () => {
    appClipboard = { paths: [], action: 'copy' }
    return { success: true }
  })
}
