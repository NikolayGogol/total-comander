import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import os from 'os'
import { getAppIcon } from './utils'
import { setupAppMenu } from './menu'
import { registerFileSystemIpc } from './ipc/fileSystem'
import { registerArchiveIpc } from './ipc/archive'
import { registerDiskIpc, refreshDriveTypes, setupVolumeWatcher } from './ipc/disk'
import { registerFolderSizeIpc } from './ipc/folderSize'
import { registerSearchIpc } from './ipc/search'
import { registerClipboardIpc } from './ipc/clipboard'

app.setName('Total Commander')
app.name = 'Total Commander'

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null = null
const preload = path.join(__dirname, 'preload.js')

function createWindow(): void {
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

function setupIpcHandlers(): void {
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

  // Register domain IPC modules
  registerFileSystemIpc()
  registerArchiveIpc()
  registerDiskIpc(() => win)
  registerFolderSizeIpc()
  registerSearchIpc()
  registerClipboardIpc()
}

app.whenReady().then(() => {
  setupAppMenu()
  setupIpcHandlers()
  setupVolumeWatcher(() => win)
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
