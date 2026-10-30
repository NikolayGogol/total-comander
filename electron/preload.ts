import { contextBridge, ipcRenderer, webUtils } from 'electron'

function toPlain<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch {
    return obj
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  getPathForFile: (file: File) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file)
      }
      return (file as any).path || ''
    } catch {
      return (file as any).path || ''
    }
  },
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
  deletePaths: (paths: string[], moveToTrash?: boolean) =>
    ipcRenderer.invoke('fs:deletePaths', toPlain(paths), moveToTrash),
  copyPaths: (sources: string[], destinationDir: string) =>
    ipcRenderer.invoke('fs:copyPaths', toPlain(sources), destinationDir),
  movePaths: (sources: string[], destinationDir: string) =>
    ipcRenderer.invoke('fs:movePaths', toPlain(sources), destinationDir),
  renamePath: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:renamePath', oldPath, newPath),
  readFile: (filePath: string, maxBytes?: number) => ipcRenderer.invoke('fs:readFile', filePath, maxBytes),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  openPath: (filePath: string) => ipcRenderer.invoke('fs:openPath', filePath),
  showInFolder: (filePath: string) => ipcRenderer.invoke('fs:showInFolder', filePath),
  openInTerminal: (dirPath: string) => ipcRenderer.invoke('fs:openInTerminal', dirPath),
  quickLook: (filePath: string) => ipcRenderer.invoke('fs:quickLook', filePath),
  createZip: (sources: string[], targetZipPath: string) =>
    ipcRenderer.invoke('fs:createZip', toPlain(sources), targetZipPath),
  extractZip: (zipPath: string, targetDir: string) => ipcRenderer.invoke('fs:extractZip', zipPath, targetDir),
  createArchive: (options: any) => ipcRenderer.invoke('fs:createArchive', toPlain(options)),
  listArchive: (archivePath: string, password?: string) => ipcRenderer.invoke('fs:listArchive', archivePath, password),
  extractArchive: (archivePath: string, targetDir: string, password?: string) =>
    ipcRenderer.invoke('fs:extractArchive', archivePath, targetDir, password),
  getDirSize: (dirPath: string) => ipcRenderer.invoke('fs:getDirSize', dirPath),
  analyzeFolderSizes: (targetPath: string, scanId?: string) =>
    ipcRenderer.invoke('fs:analyzeFolderSizes', targetPath, scanId),
  onFolderSizeItem: (callback: (data: { scanId: string; folder: any; current: number; total: number }) => void) => {
    const listener = (_: any, data: any) => callback(data)
    ipcRenderer.on('folderSize:item', listener)
    return () => ipcRenderer.removeListener('folderSize:item', listener)
  },
  onFolderSizeProgress: (
    callback: (data: { scanId: string; current: number; total: number; folderName?: string; isDone?: boolean }) => void
  ) => {
    const listener = (_: any, data: any) => callback(data)
    ipcRenderer.on('folderSize:progress', listener)
    return () => ipcRenderer.removeListener('folderSize:progress', listener)
  },
  cancelAnalyzeFolderSizes: (scanId?: string) => ipcRenderer.invoke('fs:cancelAnalyzeFolderSizes', scanId),
  findLargeFiles: (options: any) => ipcRenderer.invoke('fs:findLargeFiles', toPlain(options)),
  search: (dirPath: string, query: string, recursive: boolean, contentSearch?: string) =>
    ipcRenderer.invoke('fs:search', dirPath, query, recursive, contentSearch),
  copyFilesToClipboard: (paths: string[], action?: 'copy' | 'cut') =>
    ipcRenderer.invoke('clipboard:copyFiles', toPlain(paths), action),
  getClipboardFiles: () => ipcRenderer.invoke('clipboard:getFiles'),
  clearClipboard: () => ipcRenderer.invoke('clipboard:clear'),
  onAppCommand: (callback: (cmd: 'copy' | 'cut' | 'paste' | 'selectAll' | 'refresh') => void) => {
    const listener = (_: any, cmd: any) => callback(cmd)
    ipcRenderer.on('app:command', listener)
    return () => ipcRenderer.removeListener('app:command', listener)
  },
  getSystemInfo: () => ipcRenderer.invoke('app:getSystemInfo'),
})
