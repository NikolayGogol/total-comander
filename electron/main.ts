import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { setupAppMenu } from './menu'
import { setupFileSystemIpc } from './ipc/fileSystem'
import { setupDiskIpc } from './ipc/disk'
import { setupArchiveIpc } from './ipc/archive'
import { setupClipboardIpc } from './ipc/clipboard'
import { setupUtilsIpc } from './ipc/utils'
import { registerIconsIpc } from './ipc/icons'
import { registerUnlockerIpc } from './ipc/unlocker'
import { registerFolderSizeIpc } from './ipc/folderSize'
import { registerVirtualDisksIpc } from './ipc/virtualDisks'

app.setName('Total Commander')
app.name = 'Total Commander'

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null = null
const preload = path.join(__dirname, 'preload.js')

function createWindow() {
  const iconPath = path.join(__dirname, '../build/icon.png')

  if (app.dock && fs.existsSync(iconPath)) {
    app.dock.setIcon(iconPath)
  }

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Total Commander',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
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
  } else {
    const distPath = process.env.DIST || path.join(__dirname, '../dist')
    win.loadFile(path.join(distPath, 'index.html'))
  }
}

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

function setupIpcHandlers() {
  setupFileSystemIpc()
  setupDiskIpc()
  setupArchiveIpc()
  setupClipboardIpc()
  setupUtilsIpc()
  registerIconsIpc()
  registerUnlockerIpc()
  registerFolderSizeIpc()
  registerVirtualDisksIpc()
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
