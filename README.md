# Total Commander for macOS 🚀

A modern, high-performance orthodox two-panel file manager (Total Commander clone) designed specifically for **macOS**, built with **Node.js**, **Electron**, **Vue 3 (Composition API)**, and modular **SCSS**.

---

## ✨ Features

- **Classic Dual-Pane Architecture**:
  - Independent Left and Right panes with active-state glow.
  - Multi-tab management in each pane (open multiple directories side-by-side).
  - Breadcrumb navigation with clickable directory segments or manual path input (`/Users/...`).
  - History tracking (Back / Forward / Parent Directory `..`).
  - Live filtering: instant fuzzy search as you type.
  - Swap Panes with `Ctrl + U`.
  - Empty space click deselects active items.

- **Interactive Resizable Columns**:
  - Drag dividers between `NAME`, `EXT`, `SIZE`, `MODIFIED`, and `PERMS` to adjust width smoothly.
  - State persisted automatically in `localStorage`.
  - Double-click any divider to reset width to default.

- **macOS Unlocker (File & Process Unlocker)**:
  - Detects processes locking files or directories using native macOS `/usr/sbin/lsof`.
  - Displays locking processes with names and PIDs.
  - Terminates locking processes (`kill -9`).
  - Clears macOS immutable file flags (`chflags -R nouchg,noschg`) and restores write permissions (`chmod -R u+w`).
  - Supports automatic execution of pending actions after unlocking: Delete, Move, Copy, or Unlock Only.
  - Accessible via right-click Context Menu «Розблокувати (Unlocker)...» or from the Large Files Analyzer.

- **Native macOS File Icons**:
  - Direct retrieval of true macOS system icons via Electron's `app.getFileIcon`.
  - Batch retrieval with shared in-memory extension and folder cache for high performance.
  - Seamlessly integrated into file tables.

- **Built-in Archive Manager (ZIP / TAR / GZ / TGZ / BZ2)**:
  - **Create Archive (`Alt + F5`)**: Pack files/directories into ZIP or TAR.GZ via native macOS `ditto`, `tar`, and `zip`. Supports password encryption (`zip -P`) and custom compression levels (`0` Store, `6` Normal, `9` Maximum).
  - **Archive Explorer (`Alt + F6` / Double-Click)**: Virtual directory navigation with clickable breadcrumbs, internal directory hierarchy, search filtering, and password prompt banner for password-protected archives (`ArchiveViewModal.vue`).
  - Distinctive purple archive icons for fast visual recognition.
  - Context menu shortcuts: "Розархівувати вміст...", "Створити архів (ZIP)...".

- **Remote Connections Manager (SSH / SFTP / FTP / FTPS) (`Ctrl + F`)**:
  - Full-featured **dual-pane Total Commander interface** for remote connections (`RemoteConnectionModal.vue`).
  - **Dual-Pane View**: Left pane browses local computer files, right pane browses remote server files with bidirectional Drag-and-Drop and F5 transfer.
  - **Bidirectional Drag & Drop**: Drag files from local to remote pane to upload, or from remote to local pane to download.
  - **Minimizing to Background (`Cmd + M`)**: Minimize the connection window into a floating dock pill to freely navigate Total Commander without interrupting or disconnecting the session.
  - **Right-Click Context Menu**: Full remote context menu for editing on server, deleting, renaming, copying paths, and creating folders/files.
  - **In-App Remote Text Editor (`RemoteEditorModal.vue`, `F4`)**: Direct inline code/text editing with line numbers and `Cmd + S` remote save.
  - **Native Dialogs (`RemotePromptModal.vue`)**: In-app prompt dialogs for creating folders (F7), files (Shift+F4), renaming (F2), and deleting.
  - **Instant Profile Sync**: Real-time auto-saving of connection profiles, protocol badges (SFTP/SSH/FTP), and automatic port switching.

- **"Open With..." Application Chooser (`OpenWithModal.vue`)**:
  - Right-click context menu option «Відкрити за допомогою...» (Open With...).
  - Scans `/Applications`, `/System/Applications`, and `~/Applications` for installed macOS apps with native bundle icons.
  - Smart recommended apps matched against file extension (code editors, image viewers, media players, archives).
  - Instant search filtering and native macOS file dialog to browse any custom application on disk.

- **Mounted Virtual Disks & DMG Manager (`Alt + D`)**:
  - TitleBar disc icon with active disk counter badge (`VirtualDisksModal.vue`).
  - Displays all active disk images, mounted DMG volumes, source file paths, and mount points.
  - Individual or batch unmount ("Eject All" via native `hdiutil detach`).
  - Option to move source DMG image file to macOS Trash after unmounting.

- **Real-Time Transfer Progress & Speed**:
  - Detailed live progress modal (`FileOperationProgressModal.vue`) for copy and move operations.
  - Real-time transfer speed (MB/s), ETA timer, byte progress bars, current item indicator, and cancel support.

- **Disk Cleanup & Large Files Analyzer (`Alt + L`)**:
  - Rapid recursive disk inspection (`LargeFilesModal.vue`).
  - Quick size preset chips: `> 10 MB`, `> 25 MB`, `> 50 MB`, `> 100 MB`, `> 500 MB`, `> 1 GB`, `> 2 GB`, or custom MB.
  - Quick drive chips: `Macintosh HD`, `Home (~)`, `/Volumes`, and current directory.
  - Direct jump to Folder Size Analyzer and File Unlocker.
  - Quick reveal in Finder, individual trash, or batch cleanup of selected giant files.
  - **System Safety Protection**: automatically excludes and prevents accidental deletion of critical infrastructure and system files: Docker virtual disks (`Docker.raw`, `Docker.qcow2`), macOS swap files (`swapfile*`, `sleepimage`), and core system folders.
  - **Multi-Selection**: select multiple files using checkboxes, row clicks, Shift+Click (range selection), or `Cmd+A` (select all).

- **Real-time Streaming Folder Size Analyzer**:
  - Press **`Space`** on any folder to instantly calculate its exact size and replace the `<DIR>` badge.
  - Open **Folder Size Breakdown** (`FolderSizeModal.vue`) via context menu to view subfolder size distribution.
  - Real-time streaming scanning with progress indicator (`onFolderSizeItem`, `onFolderSizeProgress`), percentage visual progress bars, and 3 summary statistics cards (total size, total files, subfolder count).
  - Cancelable background scanning.

- **Classic Total Commander Function Keys (F2 - F10)**:
  - **F2 Rename / Shift+F6**: Rename any file or directory in place.
  - **F3 View**: In-app quick viewer (Text/Code with syntax line numbering, Image preview, Hex inspection, or trigger native macOS **QuickLook**).
  - **F4 Edit**: In-app code/text editor with `Cmd+S` save, line numbers, and change detection.
  - **Shift+F4 / +File**: Create a new file in active directory.
  - **F5 Copy**: Copy selected files/folders directly from active pane to target pane directory.
  - **Shift+F5 Clone**: Instant duplication/cloning of a file or folder in the same directory.
  - **Alt+F5 Archive**: Create ZIP/TAR archive.
  - **F6 Move**: Move/rename files to target pane with cross-device filesystem fallback.
  - **Alt+F6 Unpack**: Browse or extract archive.
  - **F7 Folder**: Quickly create a new directory.
  - **F8 Delete**: Safe deletion by moving items directly to macOS Trash (`shell.trashItem`).
  - **Shift+Delete / Shift+F8**: Permanent deletion bypassing macOS Trash (with confirmation warning).
  - **F9 Terminal**: Instantly open the current directory in macOS Terminal.
  - **Alt+F7 / F10 Search**: Deep file search with name patterns, containing-text search inside files, and direct jump to matching files.
  - **Alt+L Analyzer**: Large files finder & disk space cleaner.

- **Total Commander Selection & Navigation Enhancements**:
  - `Space`: On folders — calculates folder size in place; on files — toggles selection and moves cursor down.
  - `Insert`: Toggles selection and moves cursor down.
  - `*` (`NumpadMultiply`): Invert selection in active pane.
  - `+` (`NumpadAdd`): Select all files.
  - `-` (`NumpadSubtract`): Deselect all files.
  - `Home` / `End`: Jump to the first or last item in the list.
  - `PageUp` / `PageDown`: Scroll up or down by 15 items.
  - `Alt + Enter`: Reveal selected item in macOS Finder.
  - `Alt + ←` / `Alt + →`: Directory history back / forward.
  - `Alt + ↑` / `Backspace`: Navigate to parent directory (`..`).
  - `Ctrl + Tab` / `Ctrl + Shift + Tab`: Cycle between pane tabs.

- **Finder-like Behavior & Native macOS Integration**:
  - Native macOS application icons for `.app` bundles (`<APP>` badge).
  - Double-click on any file launches it with its default native macOS application.
  - Double-click on any directory navigates inside.
  - Double-click on `.app` bundles launches them natively; context menu offers "Показати вміст пакета".
  - Double-click on archives opens the built-in archive viewer.
  - **External Drag & Drop from Finder / Desktop**: drag files from macOS Finder or Desktop straight into Total Commander panes or subfolders (`webUtils.getPathForFile`).
  - **Copy vs Move on Drag**: hold `Shift` while dragging to switch mode to Move.
  - Duplicate-drop protection: prevents dropping an item onto its current directory.
  - Frameless window with integrated macOS traffic lights and build version indicator.
  - Quick access bar for macOS drives & locations: `Macintosh HD`, `Home (~)`, `Desktop`, `Documents`, `Downloads`, `Applications`, and `/Volumes` mounts.
  - **USB & External Drive Management**: automatic detection of USB flash drives and external volumes with spinning `Loader2` indicator during unmount and automatic navigation away to prevent resource-busy errors.
  - **APFS Free & Available Disk Space**: status bar displays free and total space, accurately distinguishing physical SSD free blocks from macOS APFS purgeable cache.

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Action |
| :--- | :--- |
| `Tab` | Switch active pane (Left ⇄ Right) |
| `Ctrl + Tab` / `Ctrl + Shift + Tab` | Switch between tabs in active pane |
| `↑` / `↓` | Navigate files / change cursor |
| `Home` / `End` | Jump to first / last item in list |
| `PageUp` / `PageDown` | Scroll 15 items up / down |
| `Space` | Folder: Calculate size in-place; File: Select and advance cursor |
| `Insert` | Select/deselect file and advance cursor |
| `Shift + Click` | Select continuous range of files |
| `Cmd + A` or `+` (`NumpadAdd`) | Select all files in active pane |
| `-` (`NumpadSubtract`) | Deselect all files in active pane |
| `*` (`NumpadMultiply`) | Invert selection in active pane |
| `Enter` | Open directory, archive viewer, or launch in macOS default app |
| `Alt + Enter` | Show selected item in macOS Finder (Reveal) |
| `Backspace` or `Alt + ↑` | Navigate to parent directory (`..`) |
| `Alt + ←` / `Alt + →` | Directory history back / forward |
| `Cmd + C` | Copy selected files to system clipboard (with toast notification) |
| `Cmd + X` | Cut selected files to system clipboard (with toast notification) |
| `Cmd + V` | Paste files from clipboard into active directory |
| `F1` | Show shortcut cheat-sheet |
| `F2` or `Shift + F6` | Rename file or folder |
| `F3` | Quick view file (Text / Image / Hex / QuickLook) |
| `F4` | Edit file in-app (`Cmd+S` to save) |
| `Shift + F4` / `+File` | Create new file |
| `F5` | Copy selected files to opposite pane |
| `Shift + F5` | Duplicate / Clone file in same directory |
| `Alt + F5` | Create ZIP/TAR archive dialog |
| `F6` | Move selected files to opposite pane |
| `Alt + F6` | Open archive viewer & unpacker |
| `F7` | Create new directory |
| `Alt + F7` / `F10` | Search files (by name & content) |
| `Alt + L` | Open large files & disk cleanup analyzer |
| `Alt + D` | View mounted virtual disks and DMG images |
| `Ctrl + F` / `Cmd + Shift + F` | Remote connections manager (SSH / SFTP / FTP) |
| `F8` / `Delete` / `Cmd + Backspace` | Move selected files to macOS Trash |
| `Shift + Delete` / `Shift + F8` | Permanently delete selected files (bypassing Trash) |
| `F9` | Open Terminal at current directory |
| `Ctrl + U` | Swap Left and Right panes |
| `Cmd + R` | Refresh both panes |
| `Cmd + Shift + .` / `Cmd + H` | Toggle hidden dotfiles |
| `Cmd + Shift + T` | Toggle Light ☀️ / Dark 🌙 theme |
| `Cmd + D` | Quick view drives list info |
| `Cmd + T` | Open new tab in active pane |
| `Cmd + W` | Close current tab |
| `Esc` | Close any active modal / context menu or clear selection |

---

## 🛠️ Run & Build Commands

| Command | Purpose & Description |
| :--- | :--- |
| `npm start` | **Main command for daily development**. Runs build info generator, Vite dev server, and Electron application with live-reload. |
| `npm run dev` | Synonym for `npm start`. |
| `npm run app` | Synonym for `npm start`. |
| `npm run build` | Compiles production bundle with **automatic build number increment** (`yyyy.mm.dd.X`). |
| `npm run build:dmg` | Builds **universal macOS DMG installer** (`release/`) that runs natively on both Apple Silicon (ARM64) & Intel (x86_64). |
| `npm run build:dmg:universal` | Builds Universal DMG installer (both ARM64 & Intel x86_64). |
| `npm run build:dmg:arm64` | Builds native Apple Silicon (M1/M2/M3/M4) DMG installer. |
| `npm run build:dmg:x64` | Builds native Intel (x86_64) DMG installer. |
| `npm run run:prod` | Builds bundle and launches it in production mode. |
| `npm run lint` | Runs ESLint check across all TS, JS, and Vue files. |
| `npm run lint:fix` | Automatically fixes ESLint errors. |
| `npm run format` | Formats codebase using Prettier. |
| `npm run fix` | One-step command: runs both ESLint auto-fix and Prettier formatting. |

---

### 💡 macOS Security & Gatekeeper Note

Because the app is built without a paid Apple Developer certificate, it uses automated ad-hoc code signing (`afterPack` hook). When transferred via Telegram or web browsers, macOS marks it with quarantine:
- **First launch**: Right-click (or Control-click) `Total Commander.app` → select **Open** → click **Open**.
- **Or via Terminal**: run `xattr -cr "/Applications/Total Commander.app"`.
