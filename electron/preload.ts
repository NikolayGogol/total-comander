import { contextBridge, ipcRenderer } from 'electron'

function toPlain<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch {
    return obj
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  readDir: (dirPath: string, showHidden?: boolean) => ipcRenderer.invoke('fs:readDir', dirPath, showHidden),
  getDrives: () => ipcRenderer.invoke('fs:getDrives'),
  getDiskSpace: (dirPath: string) => ipcRenderer.invoke('fs:getDiskSpace', dirPath),
  ejectVolume: (volumePath: string) => ipcRenderer.invoke('fs:ejectVolume', volumePath),
  onDrivesChanged: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('drives:changed', listener)
    return () => ipcRenderer.removeListener('drives:changed', listener)
  },
  createFolder: (targetPath: string) => ipcRenderer.invoke('fs:createFolder', targetPath),
  createFile: (targetPath: string) => ipcRenderer.invoke('fs:createFile', targetPath),
  deletePaths: (paths: string[], moveToTrash?: boolean) => ipcRenderer.invoke('fs:deletePaths', toPlain(paths), moveToTrash),
  copyPaths: (sources: string[], destinationDir: string) => ipcRenderer.invoke('fs:copyPaths', toPlain(sources), destinationDir),
  movePaths: (sources: string[], destinationDir: string) => ipcRenderer.invoke('fs:movePaths', toPlain(sources), destinationDir),
  renamePath: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:renamePath', oldPath, newPath),
  readFile: (filePath: string, maxBytes?: number) => ipcRenderer.invoke('fs:readFile', filePath, maxBytes),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  openPath: (filePath: string) => ipcRenderer.invoke('fs:openPath', filePath),
  openInTerminal: (dirPath: string) => ipcRenderer.invoke('fs:openInTerminal', dirPath),
  quickLook: (filePath: string) => ipcRenderer.invoke('fs:quickLook', filePath),
  getDirSize: (dirPath: string) => ipcRenderer.invoke('fs:getDirSize', dirPath),
  search: (dirPath: string, query: string, recursive: boolean, contentSearch?: string) =>
    ipcRenderer.invoke('fs:search', dirPath, query, recursive, contentSearch),
  copyFilesToClipboard: (paths: string[], action?: 'copy' | 'cut') =>
    ipcRenderer.invoke('clipboard:copyFiles', toPlain(paths), action),
  getClipboardFiles: () => ipcRenderer.invoke('clipboard:getFiles'),
  clearClipboard: () => ipcRenderer.invoke('clipboard:clear'),
  onAppCommand: (callback: (cmd: 'copy' | 'cut' | 'paste' | 'selectAll') => void) => {
    const listener = (_: any, cmd: any) => callback(cmd)
    ipcRenderer.on('app:command', listener)
    return () => ipcRenderer.removeListener('app:command', listener)
  },
  getSystemInfo: () => ipcRenderer.invoke('app:getSystemInfo'),
})
