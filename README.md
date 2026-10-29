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

- **Classic Total Commander Function Keys (F2 - F10)**:
  - **F2 Rename / Shift+F6**: Rename any file or directory in place.
  - **F3 View**: In-app quick viewer (Text/Code with syntax line numbering, Image preview, Hex inspection, or trigger native macOS **QuickLook**).
  - **F4 Edit**: In-app code/text editor with `Cmd+S` save, line numbers, and change detection.
  - **F5 Copy**: Copy selected files/folders directly from active pane to target pane directory.
  - **Shift+F5 Clone**: Instant duplication/cloning of a file or folder in the same directory.
  - **F6 Move**: Move/rename files to target pane with cross-device filesystem fallback.
  - **F7 Folder**: Quickly create a new directory.
  - **+File (Shift+F4 / Shift+F7)**: Create a new file.
  - **F8 Delete**: Safe deletion by moving items directly to macOS Trash (`shell.trashItem`).
  - **Shift+Delete / Shift+F8**: Permanent deletion bypassing macOS Trash (with confirmation warning).
  - **F9 Terminal**: Instantly open the current directory in macOS Terminal.
  - **Alt+F7 / F10 Search**: Deep file search with name patterns, containing-text search inside files, and direct jump to matching files.

- **Total Commander Selection & Navigation Enhancements**:
  - `*` (`NumpadMultiply`): Invert selection in active pane.
  - `+` (`NumpadAdd`): Select all files.
  - `-` (`NumpadSubtract`): Deselect all files.
  - `Home` / `End`: Jump to the first or last item in the list.
  - `PageUp` / `PageDown`: Scroll up or down by 15 items.
  - `Alt + Enter`: Reveal selected item in macOS Finder.
  - `Alt + ←` / `Alt + →`: History back / forward.
  - `Alt + ↑` / `Backspace`: Navigate to parent directory (`..`).
  - `Ctrl + Tab` / `Ctrl + Shift + Tab`: Cycle between pane tabs.

- **Finder-like Behavior & Native macOS Integration**:
  - Double-click on any file launches it with its default native macOS application (just like Finder).
  - Double-click on any directory navigates inside.
  - Double-click on `.app` bundles launches them natively.
  - **External Drag & Drop from Finder / Desktop**: drag files from macOS Finder or Desktop straight into Total Commander panes or subfolders (`webUtils.getPathForFile`).
  - **Copy vs Move on Drag**: hold `Shift` while dragging to switch mode to Move.
  - Duplicate-drop protection: prevents dropping an item onto its current directory.
  - Window drag protection: prevents the browser engine from opening dropped files.
  - Frameless window with integrated macOS traffic lights.
  - Quick access bar for macOS drives & locations: `Macintosh HD`, `Home (~)`, `Desktop`, `Documents`, `Downloads`, `Applications`, and `/Volumes` mounts.
  - **USB & External Drive Management**: automatic detection of USB flash drives and external volumes with real-time drive change events, spinning `Loader2` indicator during unmount, and automatic navigation away from the unmounting drive to prevent resource-busy errors.
  - **APFS Free & Available Disk Space**: status bar displays free and total space, accurately distinguishing physical SSD free blocks from macOS APFS purgeable cache.
  - Toggle hidden files (`Cmd+Shift+.` or `Cmd+H`).

- **Right-Click Context Menu**:
  - Item context: Launch App, Show Package Contents (`.app`), Open with Default App, Quick Look (`F3`), Edit (`F4`), Copy (`F5`), Move (`F6`), Rename (`F2`), Clipboard Copy (`⌘C`), Clipboard Cut (`⌘X`), **Copy Full Path**, **Show in Finder**, Open in Terminal (`F9`), Move to Trash (`F8`).
  - Background context: New Folder (`F7`), New File (`⇧F4`), Paste (`⌘V`), Select All (`⌘A`), Terminal (`F9`), Refresh (`⌘R`).

- **Design System & Performance**:
  - Strict modular **SCSS** architecture with design tokens for colors, sizes, and typography.
  - Category-based colored extension badges (`.ext-badge` for code, archives, audio, video, images, docs, system).
  - Custom sleek scrollbars for light and dark themes.
  - **Day.js** for date/time formatting.
  - **Numeral.js** for number and file size formatting.
  - Strictly **ZERO inline styles** across the entire codebase.

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Action |
| :--- | :--- |
| `Tab` | Switch active pane (Left ⇄ Right) |
| `Ctrl + Tab` / `Ctrl + Shift + Tab` | Switch between tabs in active pane |
| `↑` / `↓` | Navigate files / change cursor |
| `Home` / `End` | Jump to first / last item in list |
| `PageUp` / `PageDown` | Scroll 15 items up / down |
| `Space` or `Insert` | Select/deselect file and advance cursor |
| `Shift + Click` | Select continuous range of files |
| `Cmd + A` or `+` (`NumpadAdd`) | Select all files in active pane |
| `-` (`NumpadSubtract`) | Deselect all files in active pane |
| `*` (`NumpadMultiply`) | Invert selection in active pane |
| `Enter` | Open directory or launch file in macOS default app |
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
| `Shift + F4` / `Shift + F7` | Create new file |
| `F5` | Copy selected files to opposite pane |
| `Shift + F5` | Duplicate / Clone file in same directory |
| `F6` | Move selected files to opposite pane |
| `F7` | Create new directory |
| `Alt + F7` / `F10` | Search files (by name & content) |
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

### ⚡ Quick Start Development (1 Command)

You only need **one command** to launch the entire development environment:

```bash
npm start
# or
npm run dev
```

> **What this command does**:
> 1. Starts **Vite dev server** (Vue 3, fast HMR for components and SCSS).
> 2. Compiles Electron background processes (**Main** and **Preload**).
> 3. Automatically opens the **Total Commander** window on macOS with native dock icon and menus.
> 4. Supports **Live Reload** for UI and automatic reload on code changes.

---

### Command Reference (`package.json`)

#### 1. Development (Live Reload)

| Command | Purpose & Description |
| :--- | :--- |
| `npm start` | **Main command for daily development**. Launches Vite dev server alongside Electron application in one click. Supports hot module replacement (HMR) for Vue components and SCSS styles. |
| `npm run dev` | Exact synonym for `npm start`. |
| `npm run app` | Alternative alias for launching development mode (`vite`). |

```bash
npm start
```

---

#### 2. Production Build & Local Testing

| Command | Purpose & Description |
| :--- | :--- |
| `npm run build` | **Compiles production code**: bundles Vue 3 frontend into `dist/` and compiles Electron Main & Preload into `dist-electron/`. Checks TypeScript types and validates all SCSS styles. |
| `npm run run:prod` | **Tests compiled production bundle locally**: runs `npm run build` and then launches the result via native Electron without dev server. |

```bash
# Compile project to dist/ and dist-electron/
npm run build

# Test production build locally
npm run run:prod
```

---

#### 3. Packaging & DMG Distribution (macOS)

| Command | Purpose & Description |
| :--- | :--- |
| `npm run build:dmg:arm64` | **Builds native Apple Silicon DMG installer** (M1, M2, M3, M4 processors). Packages the app with the native icon `build/icon.icns` into `release/Total Commander-1.0.0-arm64.dmg`. |
| `npm run build:dmg` | Builds standard DMG package for the current host architecture via `electron-builder`. |

```bash
# Build native Apple Silicon (.dmg) installer
npm run build:dmg:arm64
```

> **DMG Output**: Ready-to-install disk image with drag-and-drop to `/Applications`:
> `release/Total Commander-1.0.0-arm64.dmg`

---

#### 4. Lifecycle Hooks

| Hook | Purpose & Description |
| :--- | :--- |
| `postinstall` | **Automatic hook after `npm install`**. Copies `build/icon.icns` and ensures `CFBundleDisplayName` and `CFBundleName` ("Total Commander") are set in Electron's dev bundle so that the dock displays the proper icon and name during development. |

---

Full architecture specifications, strict coding rules, and component structures are documented in [AGENTS.md](file:///Users/mikolagogol/Projects/total-comander/AGENTS.md).
