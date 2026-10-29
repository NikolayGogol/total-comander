import { Menu } from 'electron'

export function setupAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Оновити',
          accelerator: 'CmdOrCtrl+R',
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
          accelerator: 'CmdOrCtrl+C',
          click: (_, focusedWindow) => {
            focusedWindow?.webContents.send('app:command', 'copy')
          },
        },
        {
          label: 'Вирізати',
          accelerator: 'CmdOrCtrl+X',
          click: (_, focusedWindow) => {
            focusedWindow?.webContents.send('app:command', 'cut')
          },
        },
        {
          label: 'Вставити',
          accelerator: 'CmdOrCtrl+V',
          click: (_, focusedWindow) => {
            focusedWindow?.webContents.send('app:command', 'paste')
          },
        },
        {
          label: 'Виділити все',
          accelerator: 'CmdOrCtrl+A',
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
