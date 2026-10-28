# Total Commander for macOS — Developer & Agent Documentation

> **AGENTS.md**: Цей файл містить повну архітектурну документацію, правила розробки, дизайн-систему, структуру модулів та інструкції запуску проєкту.

---

## 1. Загальний огляд проєкту (Project Overview)

**Total Commander for macOS** — сучасний orthodox двопанельний файловий менеджер для macOS, розроблений на базі:
- **Node.js (Runtime)** + **Electron**: системні виклики файлової системи POSIX, нативне переміщення у Смітник macOS (`shell.trashItem`), виклик macOS QuickLook (`qlmanage`), відкриття системного термінала та запуск файлів у нативних програмах за замовчуванням (як у Finder).
- **Vue 3 (Composition API)** + **TypeScript**: реактивний інтерфейс, двопанельна координація, підтримка вкладок у кожній панелі, фільтрація, гарячі клавіші.
- **SCSS Design System**: повністю модульна система стилів без інлайн-стилів.
- **Day.js** (форматування дат) та **Numeral.js** (форматування розмірів файлів і чисел).
- **Lucide Icons**: семантичні системні іконки.

---

## 2. Суворі правила кодової бази (Mandatory Code Rules)

1. **Стилі виключно у SCSS файлах**:
   - Жодних блоків `<style>` у Vue-компонентах.
   - Усі стилі розташовані в `src/styles/` та імпортуються через `main.scss`.
2. **Кольори та розміри через змінні**:
   - Усі кольори визначені через SCSS змінні (`$color-bg-app`, `$color-accent-blue`, тощо).
   - Усі відступи (padding, margin), радіуси та розміри кнопок/панелей визначені через змінні (`$size-space-md`, `$radius-sm`, `$size-btn-icon`, тощо).
3. **Розміри шрифтів через змінні**:
   - Використовуються змінні: `$font-size-2xs`, `$font-size-xs`, `$font-size-sm`, `$font-size-base`, `$font-size-md`, `$font-size-lg`, `$font-size-xl`.
4. **Ніяких інлайн-стилів**:
   - Атрибут `style="..."` суворо заборонений у шаблонах.
   - Замість цього використовуються семантичні класи: `.icon-cyan`, `.icon-amber`, `.col-name`, `.is-parent`, `.item-icon`, `.icon-folder`, `.search-col-name` тощо.
5. **Модульність та компонентний поділ**:
   - Жодних гігантських файлів. Кожен компонент має чітку відповідальність (< 150 рядків).
6. **Поведінка Finder на подвійний клік**:
   - Подвійний клік на файл викликає нативну асоційовану програму macOS (`electronAPI.openPath`).
   - Подвійний клік на директорію переходить у неї.
7. **Форматування**:
   - Форматування дат: **`dayjs`**.
   - Форматування чисел та розмірів байтів: **`numeral`**.
8. **Безпечна IPC-серіалізація (Structured Clone Safety)**:
   - Об'єкти та масиви з реактивного стану Vue 3 (Reactive Proxy) перед відправкою через `window.electronAPI` проходять очищення (`toPlain()` / JSON-серіалізацію), що унеможливлює помилку `DOMException: An object could not be cloned` в Electron.

---

## 3. Команди запуску (Run & Build Commands)

| Команда | Опис |
| :--- | :--- |
| `npm start` | **Головна команда для запуску всього проєкту**. Запускає Vite dev server + Electron додаток з live-reload. |
| `npm run dev` | Синонім `npm start` (Vite + Electron). |
| `npm run app` | Синонім `npm start`. |
| `npm run build` | Компілює production бандл (Vue UI в `dist/`, Electron main/preload в `dist-electron/`). |
| `npm run build:dmg` | **Створює готовий DMG пакет встановлення для macOS** (у папку `release/`). |
| `npm run build:dmg:arm64` | Створює нативний Apple Silicon (M1/M2/M3/M4) `.dmg` пакет. |
| `npm run build:win` | **Створює інсталятори для Windows** (NSIS інсталятор та Portable .exe у `release/`). |
| `npm run build:win:x64` | Створює 64-бітний Windows NSIS інсталятор (`.exe`). |
| `npm run build:win:portable` | Створює портативну версію Windows без встановлення. |
| `npm run build:win:arm64` | Створює Windows інсталятор для пристроїв ARM64. |
| `npm run build:all` | Збирає пакети одночасно для macOS (.dmg) та Windows (.exe). |
| `npm run run:prod` | Збирає бандл та запускає його у продакшн режимі Electron. |

---

## 4. Структура файлів і модулів (File Structure)

```text
total-comander/
├── build/
│   ├── icon.icns            # Нативна іконка macOS (16x16 ... 1024x1024 Retina)
│   ├── icon.ico             # Нативна багаторозмірна іконка Windows (16x16 ... 256x256)
│   ├── icon.png             # Головне PNG-зображення іконки (1024x1024)
│   └── icon.iconset/        # Повний набір усіх стандартних резолюцій Apple
├── electron/
│   ├── main.ts              # Electron Main process: вікно macOS, IPC обробники
│   └── preload.ts           # Безпечний contextBridge для renderer
├── src/
│   ├── components/
│   │   ├── TitleBar.vue     # Шапка програми з відступом під traffic lights macOS, кнопками дій та сегментним перемикачем теми (Light/Dark)
│   │   ├── DriveBar.vue     # Швидкий вибір дисків і системних папок macOS
│   │   ├── BottomActionBar.vue # Нижня панель функціональних клавіш (F2-F10)
│   │   ├── pane/
│   │   │   ├── PaneView.vue      # Координатор окремої панелі
│   │   │   ├── PaneTabs.vue      # Вкладки панелі (додавання, закриття, перемикання)
│   │   │   ├── PaneNavHeader.vue # Хлібні крихти, ручне введення шляху, кнопки Up/Back
│   │   │   ├── FileTable.vue     # Таблиця файлів, сортування, виділення, drag-and-drop
│   │   │   └── PaneFooter.vue    # Статистика: кількість файлів/папок, виділений розмір
│   │   ├── ViewerModal.vue  # F3: Переглядач тексту/коду, зображень, Hex-дампу, QuickLook
│   │   ├── EditorModal.vue  # F4: Вбудований редактор з Cmd+S збереженням
│   │   ├── OperationModal.vue # F2/F5/F6/F7/F8: Перейменування, Створення файлу/папки, Копіювання, Видалення
│   │   └── SearchModal.vue  # Alt+F7: Пошук за назвою та текстом усередині файлів
│   ├── styles/
│   │   ├── _variables.scss  # Дизайн-токени: кольори, розміри, відступи, font-size
│   │   ├── _mixins.scss     # SCSS міксини (flex, scrollbar, truncate, glass)
│   │   ├── _reset.scss      # Скидання стилів та базові параметри вікна
│   │   ├── main.scss        # Головна точка входу для SCSS
│   │   └── components/
│   │       ├── _layout.scss
│   │       ├── _titlebar.scss
│   │       ├── _drivebar.scss
│   │       ├── _pane.scss
│   │       ├── _filetable.scss
│   │       ├── _bottomactionbar.scss
│   │       ├── _modals.scss
│   │       └── _toast.scss
│   ├── utils/
│   │   └── formatters.ts    # Утиліти форматування (dayjs, numeral) та селектор іконок
│   ├── types.ts             # TypeScript інтерфейси (FileItem, PaneState, ElectronAPI)
│   ├── App.vue              # Головний компонент (координація лівої/правої панелей)
│   └── main.ts              # Ініціалізація додатку Vue 3
├── index.html               # Шаблон HTML з підключенням сучасних шрифтів
├── package.json             # Скрипти, залежності
├── tsconfig.json            # Налаштування TypeScript
└── vite.config.ts           # Конфігурація Vite + vite-plugin-electron
```

---

## 5. Гарячі клавіші (Keyboard Shortcuts)

- **`Tab`** — перемикання активного фокуса між лівою і правою панелями.
- **`↑` / `↓`** — переміщення курсора по списку файлів.
- **`Space` або `Insert`** — інвертування виділення поточного файлу та перехід до наступного.
- **`Enter`** — відкриття папки або запуск файлу асоційованою нативною програмою macOS.
- **`Backspace`** — перехід у батьківську директорію (`..`).
- **`F1`** — довідка та шпаргалка гарячих клавіш.
- **`F2`** — перейменування вибраного файлу або папки.
- **`F3`** — перегляд файлу (код/текст, зображення, Hex-дапм, QuickLook).
- **`F4`** — редагування файлу у вбудованому редакторі (`Cmd+S` для збереження).
- **`Shift + F4` / `+File`** — створення нового файлу.
- **`F5`** — копіювання виділених файлів у цільову протилежну панель.
- **`F6`** — переміщення виділених файлів у цільову панель.
- **`F7`** — створення нової папки.
- **`Alt + F7` або `F10`** — пошук файлів за маскою або текстом всередині.
- **`F8` або `Delete`** — переміщення вибраних елементів у macOS Смітник.
- **`F9`** — відкриття поточної папки в терміналі macOS.
- **`Ctrl + U`** — поміняти ліву і праву панелі місцями (Swap Panes).
- **`Cmd + R`** — оновлення вмісту обох панелей.
- **`Cmd + Shift + .`** — показати/приховати файли, що починаються з крапки (`.dotfiles`).
- **`Cmd + Shift + T`** — перемикання теми оформлення (Світла ☀️ / Темна 🌙).
- **`Cmd + T`** — відкрити нову вкладку в активній панелі.
- **`Cmd + W`** — закрити поточну вкладку.
- **`Cmd + A`** — виділити всі файли в активній панелі.
- **`Cmd + C`** — скопіювати вибрані файли у системний буфер обміну (з показом тосту).
- **`Cmd + X`** — вирізати вибрані файли у системний буфер обміну.
- **`Cmd + V`** — вставити файли з буфера обміну у відкриту папку.
- **`Esc`** — закрити активне модальне вікно.

---

## 6. Drag & Drop функціонал

- Перетягування виділених файлів:
  - На протилежну панель або порожнє місце таблиці — копіювання в поточну відкриту директорію панелі.
  - На конкретну підпапку в таблиці — копіювання безпосередньо всередину цієї підпапки (з візуальним виділенням цілі `is-drag-target`).

---

## 7. IPC API (Electron Bridge)

Всі виклики між Vue (Renderer) та Node.js (Main) відбуваються безпечно через `window.electronAPI`:
- `readDir(dirPath, showHidden)`
- `getDrives()` — системні папки, томи `/Volumes`, виявлення USB з протоколом та статусом вилучення
- `getDiskSpace(dirPath)` — точний розрахунок вільного та повного простору через нативний POSIX `statfs`
- `ejectVolume(volumePath)` — безпечне вилучення USB або зовнішнього тома (`diskutil eject / unmount`)
- `onDrivesChanged(callback)` — реактивне слухання підключення/відключення USB накопичувачів
- `createFolder(targetPath)`
- `createFile(targetPath)`
- `deletePaths(paths, moveToTrash)`
- `renamePath(oldPath, newPath)`
- `copyPaths(sources, targetDir)`
- `movePaths(sources, targetDir)`
- `readFile(filePath)`
- `writeFile(filePath, content)`
- `openPath(filePath)` — запуск через Finder / системну асоціацію
- `openInTerminal(dirPath)` — запуск macOS Terminal
- `quickLook(filePath)` — виклик `qlmanage -p`
- `search(dirPath, query, recursive, contentSearch)`
- `getSystemInfo()`
