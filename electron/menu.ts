import { app, Menu, BrowserWindow } from 'electron'

export function setupAppMenu() {
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
              (focusedWindow as BrowserWindow | null)?.webContents?.send('app:command', 'copy')
            },
          },
          {
            label: 'Cut',
            accelerator: 'CmdOrCtrl+X',
            click: (_, focusedWindow) => {
              (focusedWindow as BrowserWindow | null)?.webContents?.send('app:command', 'cut')
            },
          },
          {
            label: 'Paste',
            accelerator: 'CmdOrCtrl+V',
            click: (_, focusedWindow) => {
              (focusedWindow as BrowserWindow | null)?.webContents?.send('app:command', 'paste')
            },
          },
          {
            label: 'Select All',
            accelerator: 'CmdOrCtrl+A',
            click: (_, focusedWindow) => {
              (focusedWindow as BrowserWindow | null)?.webContents?.send('app:command', 'selectAll')
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

