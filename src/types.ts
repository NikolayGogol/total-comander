export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymlink: boolean;
  isApp?: boolean;
  appIcon?: string;
  size: number;
  mtime: number;
  birthtime: number;
  mode: number;
  permissions: string;
  extension: string;
  isHidden: boolean;
}

export interface DriveItem {
  name: string;
  path: string;
  icon: string;
  type: "home" | "root" | "volume" | "bookmark" | "folder" | "usb" | "dmg";
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
  name: string;
  size: number;
  isDirectory: boolean;
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

export interface ElectronAPI {
  getPathForFile?: (file: File) => string;
  readDir: (
    dirPath: string,
    showHidden?: boolean,
  ) => Promise<{ success: boolean; data?: FileItem[]; error?: string }>;
  getDrives: () => Promise<{
    success: boolean;
    data?: DriveItem[];
    error?: string;
  }>;
  getDiskSpace: (dirPath: string) => Promise<{
    success: boolean;
    free?: number;
    available?: number;
    purgeable?: number;
    total?: number;
    error?: string;
  }>;
  ejectVolume: (
    volumePath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onDrivesChanged: (callback: () => void) => () => void;
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
  createArchive: (
    sources: string[],
    targetZipPath: string,
  ) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
  listArchive: (
    archivePath: string,
  ) => Promise<{ success: boolean; entries?: ArchiveEntry[]; error?: string }>;
  extractArchive: (
    archivePath: string,
    destinationDir: string,
    selectedFiles?: string[],
  ) => Promise<{ success: boolean; error?: string }>;
  analyzeDisk: (
    dirPath: string,
    maxItems?: number,
  ) => Promise<{ success: boolean; data?: DiskAnalysisResult; error?: string }>;
  getFolderSizeBreakdown: (dirPath: string) => Promise<{
    success: boolean;
    data?: FolderSizeBreakdown;
    error?: string;
  }>;
  getBuildInfo: () => Promise<BuildInfo>;
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
  onAppCommand: (
    callback: (cmd: "copy" | "cut" | "paste" | "selectAll") => void,
  ) => () => void;
  getSystemInfo: () => Promise<SystemInfo>;
}
