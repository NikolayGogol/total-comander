import type { Ref } from "vue";
import type { DriveItem, FileItem } from "@/types";

export interface ShortcutsHandlerContext {
  contextMenuState: { visible: boolean };
  isAnyModalOpen: Ref<boolean>;
  closeAllModals: () => void;
  activePaneId: Ref<"left" | "right">;
  activePaneCurrentPath: Ref<string>;
  activePaneActiveTabId: Ref<string>;
  getActiveCursorItem: () => FileItem | null;
  getSelectedOrCursorPaths: () => string[];
  switchNextTab: (paneKey: "left" | "right", dir: 1 | -1) => void;
  swapPanes: () => void;
  handleBottomAction: (type: string) => void;
  openLargeFilesModal: () => void;
  openVirtualDisksModal?: () => void;
  openCreateArchiveModal: () => void;
  openArchiveInViewer: (item: FileItem) => void;
  openSearchModal: () => void;
  selectAllInActivePane: () => void;
  invertSelectionInActivePane: () => void;
  deselectAllInActivePane: () => void;
  refreshAllPanes: () => void | Promise<any>;
  toggleHiddenFiles: () => void;
  toggleTheme: () => void;
  goUp: (paneKey: "left" | "right") => void;
  canGoBack: (paneKey: "left" | "right") => boolean;
  canGoForward: (paneKey: "left" | "right") => boolean;
  goBack: (paneKey: "left" | "right") => void;
  goForward: (paneKey: "left" | "right") => void;
  newTab: (paneKey: "left" | "right") => void;
  closeTab: (paneKey: "left" | "right", tabId: string) => void;
  copySelectedToClipboard: (action: "copy" | "cut") => void;
  pasteFromClipboard: () => void;
  drives: Ref<DriveItem[]>;
  showToast: (message: string, type?: "success" | "error" | "shortcut") => void;
  showShortcutToast: (shortcut: string, message: string) => void;
}

export function useShortcuts(ctx: ShortcutsHandlerContext) {
  function handleGlobalShortcuts(e: KeyboardEvent) {
    if (ctx.contextMenuState.visible) {
      if (e.key === "Escape") {
        e.preventDefault();
        ctx.contextMenuState.visible = false;
        return;
      }
    }

    if (ctx.isAnyModalOpen.value) {
      if (e.key === "Escape") {
        ctx.closeAllModals();
        ctx.showShortcutToast("Esc", "Закрито активне модальне вікно");
      }
      return;
    }

    const activeEl = document.activeElement as HTMLElement;
    const isInputActive =
      activeEl &&
      (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

    // Switch tabs in active pane with Ctrl+Tab / Ctrl+Shift+Tab
    if (e.ctrlKey && e.key === "Tab") {
      e.preventDefault();
      ctx.switchNextTab(ctx.activePaneId.value, e.shiftKey ? -1 : 1);
      return;
    }

    // Switch Active Pane with Tab
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      ctx.activePaneId.value =
        ctx.activePaneId.value === "left" ? "right" : "left";
      ctx.showShortcutToast(
        "Tab",
        `Активна панель: ${ctx.activePaneId.value === "left" ? "Ліва" : "Права"}`,
      );
      return;
    }

    // Swap Left & Right Panes with Ctrl+U or Cmd+U
    if ((e.metaKey || e.ctrlKey) && (e.key === "u" || e.key === "U")) {
      e.preventDefault();
      ctx.swapPanes();
      return;
    }

    // Help / Shortcut Cheat Sheet (F1)
    if (e.key === "F1") {
      e.preventDefault();
      ctx.showShortcutToast(
        "F1",
        "Довідка: Tab, F2-F10, Shift+F4..F8, Alt+F7, Cmd+A/C/X/V/R/T/W, Alt+Enter/←/→/↑, Space, Ins, *",
      );
      return;
    }

    // F2 or Shift+F6 - Rename
    if (e.key === "F2" || (e.shiftKey && e.key === "F6")) {
      e.preventDefault();
      ctx.showShortcutToast(
        e.key === "F2" ? "F2" : "Shift + F6",
        "Перейменування файлу або папки",
      );
      ctx.handleBottomAction("rename");
      return;
    }

    // F3 - View
    if (e.key === "F3") {
      e.preventDefault();
      ctx.showShortcutToast("F3", "Швидкий перегляд файлу");
      ctx.handleBottomAction("view");
      return;
    }

    // F4 - Edit / Shift+F4 New File
    if (e.key === "F4") {
      e.preventDefault();
      if (e.shiftKey) {
        ctx.showShortcutToast("Shift + F4", "Створення нового файлу");
        ctx.handleBottomAction("newfile");
      } else {
        ctx.showShortcutToast("F4", "Редагування у вбудованому редакторі");
        ctx.handleBottomAction("edit");
      }
      return;
    }

    // Alt+L - Large Files & Disk Cleanup
    if (e.altKey && (e.key === "l" || e.key === "L")) {
      e.preventDefault();
      ctx.showShortcutToast(
        "Alt + L",
        "Аналізатор великих файлів (Disk Cleanup)",
      );
      ctx.openLargeFilesModal();
      return;
    }

    // Alt+D - Virtual Disks & Mounted DMGs
    if (e.altKey && (e.key === "d" || e.key === "D")) {
      e.preventDefault();
      ctx.showShortcutToast(
        "Alt + D",
        "Віртуальні пристрої та змонтовані образи",
      );
      ctx.openVirtualDisksModal?.();
      return;
    }

    // F5 - Copy (Alt+F5: Create Archive, Shift+F5: Duplicate/Clone)
    if (e.key === "F5") {
      e.preventDefault();
      if (e.altKey) {
        ctx.showShortcutToast("Alt + F5", "Створення архіву (ZIP / TAR)");
        ctx.openCreateArchiveModal();
      } else if (e.shiftKey) {
        ctx.showShortcutToast(
          "Shift + F5",
          "Копіювання у поточну папку (Clone)",
        );
        ctx.handleBottomAction("clone");
      } else {
        ctx.showShortcutToast("F5", "Копіювання у цільову панель");
        ctx.handleBottomAction("copy");
      }
      return;
    }

    // F6 - Move (Alt+F6: View / Extract Archive)
    if (e.key === "F6" && !e.shiftKey) {
      e.preventDefault();
      if (e.altKey) {
        ctx.showShortcutToast("Alt + F6", "Перегляд та розпакування архіву");
        const item = ctx.getActiveCursorItem();
        if (item) {
          ctx.openArchiveInViewer(item);
        } else {
          ctx.showToast("Виберіть архів для перегляду", "error");
        }
      } else {
        ctx.showShortcutToast("F6", "Переміщення у цільову панель");
        ctx.handleBottomAction("move");
      }
      return;
    }

    // F7 - New Folder / Alt+F7 Search / Shift+F7 New File
    if (e.key === "F7") {
      e.preventDefault();
      if (e.altKey) {
        ctx.showShortcutToast("Alt + F7", "Пошук файлів за назвою та текстом");
        ctx.openSearchModal();
      } else if (e.shiftKey) {
        ctx.showShortcutToast("Shift + F7", "Створення нового файлу");
        ctx.handleBottomAction("newfile");
      } else {
        ctx.showShortcutToast("F7", "Створення нової папки");
        ctx.handleBottomAction("mkdir");
      }
      return;
    }

    // Permanent Delete (Shift+Delete or Shift+F8)
    if (e.shiftKey && (e.key === "Delete" || e.key === "F8")) {
      e.preventDefault();
      ctx.showShortcutToast(
        "Shift + Del",
        "Безповоротне видалення файлів (без Смітника)",
      );
      ctx.handleBottomAction("permanent-delete");
      return;
    }

    // F8 or Delete or Cmd+Backspace - Move to Trash
    if (
      e.key === "F8" ||
      e.key === "Delete" ||
      ((e.metaKey || e.ctrlKey) && e.key === "Backspace")
    ) {
      if (isInputActive && e.key !== "F8") return;
      e.preventDefault();
      const badge =
        e.key === "F8" ? "F8" : e.key === "Delete" ? "Delete" : "Cmd + ⌫";
      ctx.showShortcutToast(badge, "Переміщення у macOS Смітник");
      ctx.handleBottomAction("delete");
      return;
    }

    // F9 - Terminal
    if (e.key === "F9") {
      e.preventDefault();
      ctx.showShortcutToast("F9", "Відкриття термінала macOS у поточній папці");
      ctx.handleBottomAction("terminal");
      return;
    }

    // F10 - Search
    if (e.key === "F10") {
      e.preventDefault();
      ctx.showShortcutToast("F10", "Пошук файлів за назвою та текстом");
      ctx.openSearchModal();
      return;
    }

    // Alt+Enter - Show in macOS Finder
    if (e.altKey && e.key === "Enter") {
      e.preventDefault();
      const item = ctx.getActiveCursorItem();
      if (item) {
        window.electronAPI.showInFolder(item.path);
        ctx.showShortcutToast("Alt + ↵", `Показано у Finder: ${item.name}`);
      }
      return;
    }

    // Alt+Left - History Back
    if (e.altKey && e.key === "ArrowLeft") {
      if (ctx.canGoBack(ctx.activePaneId.value)) {
        e.preventDefault();
        ctx.goBack(ctx.activePaneId.value);
        ctx.showShortcutToast("Alt + ←", "Назад по історії папок");
      }
      return;
    }

    // Alt+Right - History Forward
    if (e.altKey && e.key === "ArrowRight") {
      if (ctx.canGoForward(ctx.activePaneId.value)) {
        e.preventDefault();
        ctx.goForward(ctx.activePaneId.value);
        ctx.showShortcutToast("Alt + →", "Вперед по історії папок");
      }
      return;
    }

    // Alt+Up - Parent directory
    if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      ctx.goUp(ctx.activePaneId.value);
      ctx.showShortcutToast("Alt + ↑", "Батьківська папка (..)");
      return;
    }

    // Invert Selection with Numeric Keypad *
    if (!isInputActive && (e.key === "*" || e.code === "NumpadMultiply")) {
      e.preventDefault();
      ctx.invertSelectionInActivePane();
      return;
    }

    // Select All with Numeric Keypad +
    if (
      !isInputActive &&
      !e.metaKey &&
      !e.ctrlKey &&
      (e.key === "+" || e.code === "NumpadAdd")
    ) {
      e.preventDefault();
      ctx.selectAllInActivePane();
      return;
    }

    // Deselect All with Numeric Keypad -
    if (
      !isInputActive &&
      !e.metaKey &&
      !e.ctrlKey &&
      (e.key === "-" || e.code === "NumpadSubtract")
    ) {
      e.preventDefault();
      ctx.deselectAllInActivePane();
      return;
    }

    // Cmd+R - Refresh
    if ((e.metaKey || e.ctrlKey) && (e.key === "r" || e.key === "R")) {
      e.preventDefault();
      ctx.showShortcutToast("Cmd + R", "Оновлення вмісту обох панелей");
      ctx.refreshAllPanes();
      return;
    }

    // Cmd+Shift+. or Cmd+H - Toggle Hidden Files
    if (
      ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ".") ||
      (!isInputActive &&
        (e.metaKey || e.ctrlKey) &&
        (e.key === "h" || e.key === "H"))
    ) {
      e.preventDefault();
      ctx.toggleHiddenFiles();
      return;
    }

    // Cmd+D - Quick drives info
    if (
      !isInputActive &&
      (e.metaKey || e.ctrlKey) &&
      (e.key === "d" || e.key === "D")
    ) {
      e.preventDefault();
      const driveList = ctx.drives.value.map((d) => d.name).join(", ");
      ctx.showShortcutToast("Cmd + D", `Диски: ${driveList || "/"}`);
      return;
    }

    // Cmd+T - New Tab
    if ((e.metaKey || e.ctrlKey) && (e.key === "t" || e.key === "T")) {
      e.preventDefault();
      ctx.newTab(ctx.activePaneId.value);
      ctx.showShortcutToast("Cmd + T", "Відкрито нову вкладку");
      return;
    }

    // Cmd+W - Close Tab
    if ((e.metaKey || e.ctrlKey) && (e.key === "w" || e.key === "W")) {
      e.preventDefault();
      ctx.closeTab(ctx.activePaneId.value, ctx.activePaneActiveTabId.value);
      ctx.showShortcutToast("Cmd + W", "Закрито поточну вкладку");
      return;
    }

    // Cmd+A - Select All
    if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A")) {
      if (isInputActive) return;
      e.preventDefault();
      ctx.selectAllInActivePane();
      return;
    }

    // Cmd+C / Ctrl+C - Copy selected files to clipboard
    if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C")) {
      if (isInputActive) {
        const input = activeEl as HTMLInputElement | HTMLTextAreaElement;
        if (input.selectionStart !== input.selectionEnd) return;
      }
      e.preventDefault();
      ctx.copySelectedToClipboard("copy");
      return;
    }

    // Cmd+X / Ctrl+X - Cut selected files to clipboard
    if ((e.metaKey || e.ctrlKey) && (e.key === "x" || e.key === "X")) {
      if (isInputActive) {
        const input = activeEl as HTMLInputElement | HTMLTextAreaElement;
        if (input.selectionStart !== input.selectionEnd) return;
      }
      e.preventDefault();
      ctx.copySelectedToClipboard("cut");
      return;
    }

    // Cmd+V / Ctrl+V - Paste files from clipboard
    if ((e.metaKey || e.ctrlKey) && (e.key === "v" || e.key === "V")) {
      if (isInputActive) return;
      e.preventDefault();
      ctx.pasteFromClipboard();
      return;
    }

    // Cmd+Shift+T - Toggle Light/Dark Theme
    if (
      (e.metaKey || e.ctrlKey) &&
      e.shiftKey &&
      (e.key === "T" || e.key === "t")
    ) {
      e.preventDefault();
      ctx.toggleTheme();
      return;
    }

    // Backspace - Parent directory
    if (e.key === "Backspace" && !e.metaKey && !e.ctrlKey) {
      if (isInputActive) return;
      e.preventDefault();
      ctx.goUp(ctx.activePaneId.value);
      ctx.showShortcutToast(
        "Backspace",
        "Перехід у батьківську директорію (..)",
      );
      return;
    }
  }

  return {
    handleGlobalShortcuts,
  };
}
