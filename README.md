# Total Commander for macOS 🚀

A modern, high-performance orthodox two-panel file manager (Total Commander clone) designed specifically for macOS, built with **Node.js**, **Electron**, **Vue 3**, and **SCSS**.

---

## ✨ Features

- **Classic Dual-Pane Architecture**:
  - Independent Left and Right panes with active-state glow.
  - Multi-tab management in each pane (open multiple directories side-by-side).
  - Breadcrumb navigation with clickable directory segments or manual path input (`/Users/...`).
  - History tracking (Back / Forward / Parent Directory `..`).
  - Live filtering: instant fuzzy search as you type.

- **Classic Total Commander Function Keys (F2 - F10)**:
  - **F2 Rename**: Rename any file or directory in place.
  - **F3 View**: In-app quick viewer (Text/Code with syntax line numbering, Image preview, Hex inspection, or trigger native macOS **QuickLook**).
  - **F4 Edit**: In-app code/text editor with `Cmd+S` save, line numbers, and change detection.
  - **F5 Copy**: Copy selected files/folders directly from active pane to target pane directory.
  - **F6 Move**: Move/rename files to target pane with cross-device filesystem fallback.
  - **F7 Folder**: Quickly create a new directory.
  - **+File (Shift+F4)**: Create a new file.
  - **F8 Delete**: Safe deletion by moving items directly to macOS Trash (`shell.trashItem`).
  - **F9 Terminal**: Instantly open the current directory in macOS Terminal.
  - **Alt+F7 / F10 Search**: Deep file search with name patterns, containing-text search inside files, and direct jump to matching files.

- **Finder-like Behavior & Native macOS Integration**:
  - Double-click on any file launches it with its default native macOS application (just like Finder!).
  - Double-click on any directory navigates inside.
  - Drag and Drop between panes or directly into subfolders.
  - Frameless window with integrated macOS traffic lights.
  - Quick access bar for macOS drives & locations: `Macintosh HD`, `Home (~)`, `Desktop`, `Documents`, `Downloads`, `Applications`, and `/Volumes` mounts.
  - **Підтримка USB-носіїв та знімних накопичувачів**: автоматичне розпізнавання USB флешок з іконкою `Usb`, відстеження підключення/відключення в реальному часі та нативна кнопка безпечного вилучення (`Eject`).
  - **Відображення вільного місця на дисках**: статус-бар кожної панелі показує вільне та загальне місце (наприклад, `92.4 GB вільно з 245.1 GB`), а також плашки дисків показують вільний простір.
  - Toggle hidden files (`Cmd+Shift+.`).

- **Design System & Performance**:
  - Strict modular **SCSS** architecture with design tokens for colors, sizes, and typography.
  - **Day.js** for date/time formatting.
  - **Numeral.js** for number and file size formatting.
  - Strictly **ZERO inline styles** across the entire codebase.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Tab` | Switch active pane (Left ⇄ Right) |
| `↑` / `↓` | Navigate files / change cursor |
| `Space` or `Insert` | Select/deselect file and advance cursor |
| `Enter` | Open directory or launch file in macOS default app |
| `Backspace` | Navigate to parent directory (`..`) |
| `Shift + Click` | Select range of files |
| `Cmd + A` | Select all files in active pane |
| `Cmd + C` | Copy selected files to system clipboard (with toast notification) |
| `Cmd + X` | Cut selected files to system clipboard (with toast notification) |
| `Cmd + V` | Paste files from clipboard into active directory |
| `F1` | Show shortcut cheat-sheet |
| `F2` | Rename file or folder |
| `F3` | Quick view file (Text / Image / Hex / QuickLook) |
| `F4` | Edit file in-app |
| `F5` | Copy selected files to opposite pane |
| `F6` | Move selected files to opposite pane |
| `F7` | Create new directory |
| `Shift + F4` / `Shift + F7` | Create new file |
| `Alt + F7` / `F10` | Search files (by name & content) |
| `F8` / `Delete` | Move selected files to macOS Trash |
| `F9` | Open Terminal at current directory |
| `Ctrl + U` | Swap Left and Right panes |
| `Cmd + R` | Refresh panes |
| `Cmd + Shift + .` | Toggle hidden dotfiles |
| `Cmd + Shift + T` | Toggle Light / Dark theme |
| `Cmd + T` | Open new tab in active pane |
| `Cmd + W` | Close current tab |
| `Esc` | Close any active modal |

---

## 🛠️ Run & Build Commands

### ⚡ Швидкий запуск розробки (1 команда)

Вам потрібна лише **одна команда**, щоб запустити все середовище розробки:

```bash
npm start
# або
npm run dev
```

> **Що робить ця 1 команда**:
> 1. Запускає **Vite dev-сервер** (Vue 3, швидкий HMR для компонентів та SCSS).
> 2. Компілює фонові процеси Electron (**Main** та **Preload**).
> 3. Автоматично відкриває вікно **Total Commander** на macOS з фірмовою іконкою та меню.
> 4. Підтримує **Live Reload** для інтерфейсу та автоматичний рестарт при зміні коду. Жодних додаткових терміналів чи команд відкривати не потрібно!

---

### Детальний довідник команд з `package.json`

### 1. Development (Live Reload)

| Command | Purpose & Description |
| :--- | :--- |
| `npm start` | **Головна команда для щоденної розробки**. Запускає Vite dev server разом із Electron-додатком в один клік. Підтримує гаряче перезавантаження (HMR) для Vue-компонентів і стилів SCSS. |
| `npm run dev` | Повний синонім `npm start`. Запускає середовище розробки з підключеним live-reload. |
| `npm run app` | Альтернативний аліас для запуску розробки (`vite`). |

```bash
# Start the entire development environment (Vite + Electron)
npm start
```

---

### 2. Production Build & Local Testing

| Command | Purpose & Description |
| :--- | :--- |
| `npm run build` | **Компіляція production-коду**: збирає оптимізований Vue 3 інтерфейс у папку `dist/` та компілює Electron Main і Preload процеси у папку `dist-electron/`. Перевіряє сумісність TypeScript та валідність усіх SCSS-стилів. |
| `npm run run:prod` | **Тестування зібраного продакшн-бандлу локально**: спочатку виконує `npm run build`, а потім запускає зібраний код через нативний Electron без dev-сервера. Дозволяє перевірити фінальну продуктивність перед створенням інсталятора. |

```bash
# Compile project to dist/ and dist-electron/
npm run build

# Test production build locally
npm run run:prod
```

---

### 3. Packaging & DMG Distribution (macOS)

| Command | Purpose & Description |
| :--- | :--- |
| `npm run build:dmg:arm64` | **Створення нативного DMG-інсталятора для Apple Silicon** (процесори M1, M2, M3, M4). Компілює проєкт, пакує нативний додаток із фірмовою іконкою `build/icon.icns` і створює готовий `.dmg` файл у папці `release/Total Commander-1.0.0-arm64.dmg`. |
| `npm run build:dmg` | Створює стандартний DMG-пакет встановлення для поточної архітектури macOS за допомогою `electron-builder`. |

```bash
# Build native Apple Silicon (.dmg) installer
npm run build:dmg:arm64
```

> **Результат збірки DMG**: готовий образ диска з вікном перетягування у `/Applications` з'являється у папці:
> `release/Total Commander-1.0.0-arm64.dmg`

---

### 4. Lifecycle Hooks

| Hook | Purpose & Description |
| :--- | :--- |
| `postinstall` | **Автоматичний хук після встановлення залежностей** (`npm install`). Він автоматично копіює нативну іконку `build/icon.icns` та прописує коректні параметри `CFBundleDisplayName` і `CFBundleName` («Total Commander») у dev-пакет Electron, щоб навіть у режимі розробки в macOS Dock відображалася правильна назва та іконка програми. |

---

Full architecture specifications, strict coding rules, and component structures are documented in [AGENTS.md](file:///Users/mikolagogol/Projects/total-comander/AGENTS.md).
