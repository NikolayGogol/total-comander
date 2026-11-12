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
  runTransfer: (payload: { type: 'copy' | 'move'; sources: string[]; destinationDir: string; operationId: string }) =>
    ipcRenderer.invoke('fs:runTransfer', toPlain(payload)),
  cancelTransfer: (operationId: string) => ipcRenderer.invoke('fs:cancelTransfer', operationId),
  onTransferProgress: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data)
    ipcRenderer.on('transfer:progress', listener)
    return () => ipcRenderer.removeListener('transfer:progress', listener)
  },
  startDrag: (paths: string[] | { files: string[] }) =>
    ipcRenderer.send('fs:startDrag', toPlain(paths)),
  renamePath: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:renamePath', oldPath, newPath),
  readFile: (filePath: string, maxBytes?: number) => ipcRenderer.invoke('fs:readFile', filePath, maxBytes),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  openPath: (filePath: string) => ipcRenderer.invoke('fs:openPath', filePath),
  openWith: (filePath: string, appPath: string) => ipcRenderer.invoke('fs:openWith', filePath, appPath),
  getInstalledApps: () => ipcRenderer.invoke('fs:getInstalledApps'),
  selectAppDialog: () => ipcRenderer.invoke('fs:selectAppDialog'),
  showInFolder: (filePath: string) => ipcRenderer.invoke('fs:showInFolder', filePath),
  openInTerminal: (dirPath: string) => ipcRenderer.invoke('fs:openInTerminal', dirPath),
  quickLook: (filePath: string) => ipcRenderer.invoke('fs:quickLook', filePath),
  getDirSize: (dirPath: string) => ipcRenderer.invoke('fs:getDirSize', dirPath),
  getFolderSizeBreakdown: (dirPath: string) => ipcRenderer.invoke('fs:getFolderSizeBreakdown', dirPath),
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
  createArchive: (optionsOrSources: any, targetZipPath?: string) =>
    ipcRenderer.invoke('fs:createArchive', toPlain(optionsOrSources), targetZipPath),
  listArchive: (archivePath: string, password?: string) =>
    ipcRenderer.invoke('fs:listArchive', archivePath, password),
  extractArchive: (archivePath: string, destinationDir: string, passwordOrSelected?: string | string[]) =>
    ipcRenderer.invoke('fs:extractArchive', archivePath, destinationDir, toPlain(passwordOrSelected)),
  analyzeDisk: (dirPath: string, maxItems?: number) =>
    ipcRenderer.invoke('fs:analyzeDisk', dirPath, maxItems),
  getBuildInfo: () => ipcRenderer.invoke('app:getBuildInfo'),
  search: (dirPath: string, query: string, recursive: boolean, contentSearch?: string) =>
    ipcRenderer.invoke('fs:search', dirPath, query, recursive, contentSearch),
  copyFilesToClipboard: (paths: string[], action?: 'copy' | 'cut') =>
    ipcRenderer.invoke('clipboard:copyFiles', toPlain(paths), action),
  getClipboardFiles: () => ipcRenderer.invoke('clipboard:getFiles'),
  clearClipboard: () => ipcRenderer.invoke('clipboard:clear'),
  getFileIcon: (filePath: string) => ipcRenderer.invoke('fs:getFileIcon', filePath),
  getFileIcons: (items: any[]) => ipcRenderer.invoke('fs:getFileIcons', toPlain(items)),
  resolveShortcut: (filePath: string) => ipcRenderer.invoke('fs:resolveShortcut', filePath),
  findLockingProcesses: (targetPath: string) => ipcRenderer.invoke('unlocker:findLockingProcesses', targetPath),
  killProcesses: (pids: number[]) => ipcRenderer.invoke('unlocker:killProcesses', toPlain(pids)),
  unlockAndExecute: (options: any) => ipcRenderer.invoke('unlocker:unlockAndExecute', toPlain(options)),
  getVirtualDisks: () => ipcRenderer.invoke('fs:getVirtualDisks'),
  ejectVirtualDisk: (target: string) => ipcRenderer.invoke('fs:ejectVirtualDisk', target),
  ejectAllVirtualDisks: () => ipcRenderer.invoke('fs:ejectAllVirtualDisks'),
  deleteVirtualDiskSource: (payload: { imagePath: string; mountPoint?: string }) =>
    ipcRenderer.invoke('fs:deleteVirtualDiskSource', toPlain(payload)),
  remoteTestConnection: (config: any) =>
    ipcRenderer.invoke('remote:testConnection', toPlain(config)),
  remoteListDir: (config: any, remotePath?: string) =>
    ipcRenderer.invoke('remote:listDir', toPlain(config), remotePath),
  remoteDownload: (config: any, remoteFilePath: string, localDestinationDir: string) =>
    ipcRenderer.invoke('remote:download', toPlain(config), remoteFilePath, localDestinationDir),
  remoteUpload: (config: any, localFilePath: string, remoteDestinationDir: string) =>
    ipcRenderer.invoke('remote:upload', toPlain(config), localFilePath, remoteDestinationDir),
  remoteMkdir: (config: any, remotePath: string) =>
    ipcRenderer.invoke('remote:mkdir', toPlain(config), remotePath),
  remoteCreateFile: (config: any, remotePath: string, content?: string) =>
    ipcRenderer.invoke('remote:createFile', toPlain(config), remotePath, content),
  remoteRename: (config: any, oldPath: string, newPath: string) =>
    ipcRenderer.invoke('remote:rename', toPlain(config), oldPath, newPath),
  remoteReadText: (config: any, remotePath: string) =>
    ipcRenderer.invoke('remote:readText', toPlain(config), remotePath),
  remoteWriteText: (config: any, remotePath: string, content: string) =>
    ipcRenderer.invoke('remote:writeText', toPlain(config), remotePath, content),
  remoteDelete: (config: any, remotePath: string, isDirectory: boolean) =>
    ipcRenderer.invoke('remote:delete', toPlain(config), remotePath, isDirectory),
  remoteOpenSshTerminal: (config: any) =>
    ipcRenderer.invoke('remote:openSshTerminal', toPlain(config)),
  remoteSelectPrivateKeyDialog: () =>
    ipcRenderer.invoke('remote:selectPrivateKeyDialog'),
  onRemoteTransferProgress: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data)
    ipcRenderer.on('remote:transfer-progress', listener)
    return () => ipcRenderer.removeListener('remote:transfer-progress', listener)
  },
  onAppCommand: (callback: (cmd: 'copy' | 'cut' | 'paste' | 'selectAll') => void) => {
    const listener = (_: any, cmd: any) => callback(cmd)
    ipcRenderer.on('app:command', listener)
    return () => ipcRenderer.removeListener('app:command', listener)
  },
  getSystemInfo: () => ipcRenderer.invoke('app:getSystemInfo'),
})
