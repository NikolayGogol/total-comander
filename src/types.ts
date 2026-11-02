export interface FileItem {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
  size: number
  mtime: number
  birthtime: number
  mode: number
  permissions: string
  extension: string
  isHidden: boolean
  icon?: string
}

export interface DriveItem {
  name: string
  path: string
  icon: string
  type: 'home' | 'root' | 'volume' | 'bookmark' | 'folder' | 'usb' | 'cdrom'
  label?: string
  freeSpace?: number
  totalSpace?: number
  isRemovable?: boolean
}

export type SortField = 'name' | 'ext' | 'size' | 'mtime'
export type SortOrder = 'asc' | 'desc'

export interface TabItem {
  id: string
  title: string
  path: string
  history: string[]
  historyIndex: number
}

export interface PaneState {
  currentPath: string
  tabs: TabItem[]
  activeTabId: string
  items: FileItem[]
  selectedPaths: Set<string>
  cursorIndex: number
  sortField: SortField
  sortOrder: SortOrder
  filterText: string
  showHidden: boolean
  loading: boolean
  error: string | null
  freeSpace?: number
  totalSpace?: number
}

export interface SearchResult {
  name: string
  path: string
  isDirectory: boolean
  size: number
  matchLine?: string
}

export interface ArchiveEntry {
  path: string
  name: string
  isDirectory: boolean
  size: number
  packedSize?: number
  modified?: string
  encrypted?: boolean
}

export interface LargeFileItem {
  path: string
  name: string
  size: number
  mtime: number
  extension: string
  dir: string
}

export interface FolderSizeItem {
  name: string
  path: string
  size: number
  fileCount: number
  dirCount: number
}

export interface LockingProcess {
  pid: number
  name: string
  appName: string
}

export interface UnlockerExecuteOptions {
  targetPath: string
  action: 'delete' | 'move' | 'copy' | 'unlock'
  pidsToKill?: number[]
  destinationDir?: string
  permanentDelete?: boolean
}

export interface CreateArchiveOptions {
  sources: string[]
  targetPath: string
  format: 'zip' | '7z' | 'rar'
  password?: string
  level?: number
  encryptHeader?: boolean
}

export interface SystemInfo {
  homeDir: string
  tmpDir: string
  platform: string
  username: string
  version?: string
}

export interface ElectronAPI {
  getPathForFile?: (file: File) => string
  readDir: (dirPath: string, showHidden?: boolean) => Promise<{ success: boolean; data?: FileItem[]; error?: string }>
  getDrives: () => Promise<{ success: boolean; data?: DriveItem[]; error?: string }>
  getDiskSpace: (dirPath: string) => Promise<{ success: boolean; free?: number; total?: number; error?: string }>
  ejectVolume: (volumePath: string) => Promise<{ success: boolean; error?: string }>
  onDrivesChanged: (callback: () => void) => () => void
  createFolder: (targetPath: string) => Promise<{ success: boolean; error?: string }>
  createFile: (targetPath: string) => Promise<{ success: boolean; error?: string }>
  deletePaths: (paths: string[], moveToTrash?: boolean) => Promise<{ success: boolean; error?: string }>
  copyPaths: (sources: string[], destinationDir: string) => Promise<{ success: boolean; error?: string }>
  movePaths: (sources: string[], destinationDir: string) => Promise<{ success: boolean; error?: string }>
  renamePath: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>
  readFile: (
    filePath: string,
    maxBytes?: number
  ) => Promise<{ success: boolean; content?: string; isBinary?: boolean; error?: string }>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  openPath: (filePath: string) => Promise<{ success: boolean; error?: string }>
  showInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>
  openInTerminal: (dirPath: string) => Promise<{ success: boolean; error?: string }>
  quickLook: (filePath: string) => Promise<{ success: boolean; error?: string }>
  createZip: (sources: string[], targetZipPath: string) => Promise<{ success: boolean; error?: string }>
  extractZip: (zipPath: string, targetDir: string) => Promise<{ success: boolean; error?: string }>
  createArchive: (options: CreateArchiveOptions) => Promise<{ success: boolean; targetPath?: string; error?: string }>
  listArchive: (
    archivePath: string,
    password?: string
  ) => Promise<{ success: boolean; entries?: ArchiveEntry[]; error?: string; isEncrypted?: boolean }>
  extractArchive: (
    archivePath: string,
    targetDir: string,
    password?: string
  ) => Promise<{ success: boolean; error?: string }>
  getDirSize: (dirPath: string) => Promise<{ success: boolean; size?: number; count?: number; error?: string }>
  analyzeFolderSizes: (
    targetPath: string,
    scanId?: string
  ) => Promise<{
    success: boolean
    parentPath?: string
    folders?: FolderSizeItem[]
    totalSize?: number
    totalFiles?: number
    error?: string
  }>
  onFolderSizeItem: (
    callback: (data: { scanId: string; folder: FolderSizeItem; current: number; total: number }) => void
  ) => () => void
  onFolderSizeProgress: (
    callback: (data: { scanId: string; current: number; total: number; folderName?: string; isDone?: boolean }) => void
  ) => () => void
  cancelAnalyzeFolderSizes: (scanId?: string) => Promise<{ success: boolean }>
  findLargeFiles: (options: { targetDir: string; minSizeBytes: number; limit?: number }) => Promise<{
    success: boolean
    files?: LargeFileItem[]
    totalSize?: number
    scannedCount?: number
    error?: string
  }>
  search: (
    dirPath: string,
    query: string,
    recursive: boolean,
    contentSearch?: string
  ) => Promise<{ success: boolean; results?: SearchResult[]; error?: string }>
  copyFilesToClipboard: (
    paths: string[],
    action?: 'copy' | 'cut'
  ) => Promise<{ success: boolean; count?: number; error?: string }>
  getClipboardFiles: () => Promise<{ success: boolean; paths?: string[]; action?: 'copy' | 'cut'; error?: string }>
  clearClipboard: () => Promise<{ success: boolean }>
  getFileIcon: (filePath: string) => Promise<string | null>
  getFileIcons: (
    items: Array<{ path: string; name?: string; isDirectory: boolean; extension: string }>
  ) => Promise<Record<string, string>>
  resolveShortcut: (filePath: string) => Promise<{
    target: string
    arguments?: string
    isDirectory: boolean
    description?: string
    iconPath?: string
  } | null>
  findLockingProcesses: (
    targetPath: string
  ) => Promise<{ success: boolean; processes?: LockingProcess[]; error?: string }>
  killProcesses: (pids: number[]) => Promise<{ success: boolean; killedCount: number; errors?: string[] }>
  unlockAndExecute: (
    options: UnlockerExecuteOptions
  ) => Promise<{ success: boolean; killedCount?: number; actionExecuted?: string; error?: string }>
  onAppCommand: (callback: (cmd: 'copy' | 'cut' | 'paste' | 'selectAll' | 'refresh') => void) => () => void
  getSystemInfo: () => Promise<SystemInfo>
}
