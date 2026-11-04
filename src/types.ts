export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymlink: boolean;
  isApp?: boolean;
  isAlias?: boolean;
  aliasTarget?: string;
  appIcon?: string;
  size: number;
  mtime: number;
  birthtime: number;
  mode: number;
  permissions: string;
  extension: string;
  isHidden: boolean;
  icon?: string;
}

export interface DriveItem {
  name: string;
  path: string;
  icon: string;
  type:
    | "home"
    | "root"
    | "volume"
    | "bookmark"
    | "folder"
    | "usb"
    | "dmg"
    | "cdrom";
  label?: string;
  freeSpace?: number;
  availableSpace?: number;
  purgeableSpace?: number;
  totalSpace?: number;
  isRemovable?: boolean;
}

export type SortField = "name" | "ext" | "size" | "mtime";
export type SortOrder = "asc" | "desc";

export interface TabItem {
  id: string;
  title: string;
  path: string;
  history: string[];
  historyIndex: number;
}

export interface PaneState {
  currentPath: string;
  tabs: TabItem[];
  activeTabId: string;
  items: FileItem[];
  selectedPaths: Set<string>;
  cursorIndex: number;
  sortField: SortField;
  sortOrder: SortOrder;
  filterText: string;
  showHidden: boolean;
  loading: boolean;
  error: string | null;
  freeSpace?: number;
  availableSpace?: number;
  purgeableSpace?: number;
  totalSpace?: number;
}

export interface SearchResult {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  matchLine?: string;
}

export interface SystemInfo {
  homeDir: string;
  tmpDir: string;
  platform: string;
  username: string;
}

export interface BuildInfo {
  version: string;
  buildNumber: string;
  platform: string;
  arch: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
}

export interface DiskAnalysisFile {
  name: string;
  path: string;
  size: number;
  mtime: number;
  extension: string;
}

export interface ArchiveEntry {
  path: string;
  name: string;
  size: number;
  packedSize?: number;
  modified?: string;
  isDirectory: boolean;
  encrypted?: boolean;
}

export interface LargeFileItem {
  path: string;
  name: string;
  size: number;
  mtime: number;
  extension: string;
  dir: string;
}

export interface FolderSizeItem {
  name: string;
  path: string;
  size: number;
  fileCount: number;
  dirCount: number;
}

export interface LockingProcess {
  pid: number;
  name: string;
  appName: string;
}

export interface UnlockerExecuteOptions {
  targetPath: string;
  action: "delete" | "move" | "copy" | "unlock";
  pidsToKill?: number[];
  destinationDir?: string;
  permanentDelete?: boolean;
}

export interface CreateArchiveOptions {
  sources: string[];
  targetPath: string;
  format: "zip" | "tar.gz" | "7z" | "rar";
  password?: string;
  level?: number;
  encryptHeader?: boolean;
}

export interface FolderSizeSubfolder {
  name: string;
  path: string;
  size: number;
  count: number;
  percentage: number;
}

export interface FolderSizeBreakdown {
  folderPath: string;
  totalSize: number;
  totalFiles: number;
  subfolders: FolderSizeSubfolder[];
}

export interface DiskSubdirItem {
  name: string;
  path: string;
  size: number;
  fileCount: number;
}

export interface DiskAnalysisResult {
  scannedPath: string;
  totalBytes: number;
  totalFiles: number;
  largestFiles: DiskAnalysisFile[];
  subdirectories: DiskSubdirItem[];
  categoryBreakdown: Record<string, number>;
}

export interface VirtualDiskInfo {
  name: string;
  mountPoint: string;
  devEntry: string;
  imagePath: string;
  imageType: string;
  totalSpace: number;
  freeSpace: number;
  usedSpace: number;
  sourceExists: boolean;
  sourceSize: number;
}

export interface ElectronAPI {
  getDirectoryContents: (dirPath: string) => Promise<{
    items: FileItem[];
    freeSpace?: number;
    availableSpace?: number;
    purgeableSpace?: number;
    totalSpace?: number;
    error?: string;
  }>;
  getDrives: () => Promise<DriveItem[]>;
  ejectDrive: (
    drivePath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  createFolder: (
    targetPath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  createFile: (
    targetPath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deletePaths: (
    paths: string[],
    moveToTrash?: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  copyPaths: (
    sources: string[],
    destinationDir: string,
  ) => Promise<{ success: boolean; error?: string }>;
  movePaths: (
    sources: string[],
    destinationDir: string,
  ) => Promise<{ success: boolean; error?: string }>;
  renamePath: (
    oldPath: string,
    newPath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  readFile: (
    filePath: string,
    maxBytes?: number,
  ) => Promise<{
    success: boolean;
    content?: string;
    isBinary?: boolean;
    error?: string;
  }>;
  writeFile: (
    filePath: string,
    content: string,
  ) => Promise<{ success: boolean; error?: string }>;
  openPath: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  showInFolder: (
    filePath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  openInTerminal: (
    dirPath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  quickLook: (
    filePath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  getDirSize: (dirPath: string) => Promise<{
    success: boolean;
    size?: number;
    count?: number;
    error?: string;
  }>;
  getFolderSizeBreakdown: (dirPath: string) => Promise<{
    success: boolean;
    data?: FolderSizeBreakdown;
    error?: string;
  }>;
  analyzeFolderSizes: (
    targetPath: string,
    scanId?: string,
  ) => Promise<{
    success: boolean;
    parentPath?: string;
    folders?: FolderSizeItem[];
    totalSize?: number;
    totalFiles?: number;
    error?: string;
  }>;
  onFolderSizeItem: (
    callback: (data: {
      scanId: string;
      folder: FolderSizeItem;
      current: number;
      total: number;
    }) => void,
  ) => () => void;
  onFolderSizeProgress: (
    callback: (data: {
      scanId: string;
      current: number;
      total: number;
      folderName?: string;
      isDone?: boolean;
    }) => void,
  ) => () => void;
  cancelAnalyzeFolderSizes: (scanId?: string) => Promise<{ success: boolean }>;
  findLargeFiles: (options: {
    targetDir: string;
    minSizeBytes: number;
    limit?: number;
  }) => Promise<{
    success: boolean;
    files?: LargeFileItem[];
    totalSize?: number;
    scannedCount?: number;
    error?: string;
  }>;
  analyzeDisk: (
    dirPath: string,
    maxItems?: number,
  ) => Promise<{ success: boolean; data?: DiskAnalysisResult; error?: string }>;
  createArchive: (
    optionsOrSources: CreateArchiveOptions | string[],
    targetZipPath?: string,
  ) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
  listArchive: (
    archivePath: string,
    password?: string,
  ) => Promise<{
    success: boolean;
    entries?: ArchiveEntry[];
    error?: string;
    isEncrypted?: boolean;
  }>;
  extractArchive: (
    archivePath: string,
    destinationDir: string,
    passwordOrSelectedFiles?: string | string[],
  ) => Promise<{ success: boolean; error?: string }>;
  getBuildInfo: () => Promise<BuildInfo>;
  search: (
    dirPath: string,
    query: string,
    recursive: boolean,
    contentSearch?: string,
  ) => Promise<{ success: boolean; results?: SearchResult[]; error?: string }>;
  copyFilesToClipboard: (
    paths: string[],
    action?: "copy" | "cut",
  ) => Promise<{ success: boolean; count?: number; error?: string }>;
  getClipboardFiles: () => Promise<{
    success: boolean;
    paths?: string[];
    action?: "copy" | "cut";
    error?: string;
  }>;
  clearClipboard: () => Promise<{ success: boolean }>;
  getFileIcon: (filePath: string) => Promise<string | null>;
  getFileIcons: (
    items: Array<{
      path: string;
      name?: string;
      isDirectory: boolean;
      extension: string;
    }>,
  ) => Promise<Record<string, string>>;
  resolveShortcut: (filePath: string) => Promise<{
    target: string;
    arguments?: string;
    isDirectory: boolean;
    description?: string;
    iconPath?: string;
  } | null>;
  findLockingProcesses: (targetPath: string) => Promise<{
    success: boolean;
    processes?: LockingProcess[];
    error?: string;
  }>;
  killProcesses: (
    pids: number[],
  ) => Promise<{ success: boolean; killedCount: number; errors?: string[] }>;
  unlockAndExecute: (options: UnlockerExecuteOptions) => Promise<{
    success: boolean;
    killedCount?: number;
    actionExecuted?: string;
    error?: string;
  }>;
  getVirtualDisks: () => Promise<{
    success: boolean;
    data?: VirtualDiskInfo[];
    error?: string;
  }>;
  ejectVirtualDisk: (
    target: string,
  ) => Promise<{ success: boolean; error?: string }>;
  ejectAllVirtualDisks: () => Promise<{
    success: boolean;
    count?: number;
    error?: string;
  }>;
  deleteVirtualDiskSource: (payload: {
    imagePath: string;
    mountPoint?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onAppCommand: (
    callback: (cmd: "copy" | "cut" | "paste" | "selectAll") => void,
  ) => () => void;
  getSystemInfo: () => Promise<SystemInfo>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
