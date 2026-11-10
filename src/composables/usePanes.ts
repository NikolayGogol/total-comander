import { ref, reactive, computed } from "vue";
import type { PaneState, FileItem, SortField } from "@/types";
import {
  getParentPath,
  getPathLeafName,
  isRootPath,
  normalizePath,
} from "@/utils/paths";

export function usePanes(
  showToast: (
    message: string,
    type?: "success" | "error" | "shortcut",
    shortcut?: string,
  ) => void,
  showShortcutToast: (shortcut: string, message: string) => void,
) {
  const activePaneId = ref<"left" | "right">("left");
  const showHidden = ref(false);

  function createDefaultPaneState(initialPath: string): PaneState {
    const tabId = "tab-" + Math.random().toString(36).substring(2, 9);
    const cleanPath = normalizePath(initialPath);
    return {
      currentPath: cleanPath,
      tabs: [
        {
          id: tabId,
          title: getPathLeafName(cleanPath),
          path: cleanPath,
          history: [cleanPath],
          historyIndex: 0,
        },
      ],
      activeTabId: tabId,
      items: [],
      selectedPaths: new Set(),
      cursorIndex: 0,
      sortField: "name",
      sortOrder: "asc",
      filterText: "",
      showHidden: false,
      loading: false,
      error: null,
    };
  }

  const leftPane = reactive<PaneState>(createDefaultPaneState("/"));
  const rightPane = reactive<PaneState>(createDefaultPaneState("/"));

  const activePaneState = computed(() => {
    return activePaneId.value === "left" ? leftPane : rightPane;
  });

  const oppositePaneState = computed(() => {
    return activePaneId.value === "left" ? rightPane : leftPane;
  });

  const hasActiveCursorItem = computed(() => {
    const p = activePaneState.value;
    return p.cursorIndex >= 0 && p.cursorIndex < p.items.length;
  });

  function getActiveCursorItem(): FileItem | null {
    const p = activePaneState.value;
    if (p.cursorIndex >= 0 && p.cursorIndex < p.items.length) {
      return p.items[p.cursorIndex];
    }
    return null;
  }

  function getSelectedOrCursorPaths(): string[] {
    const p = activePaneState.value;
    if (p.selectedPaths.size > 0) {
      return Array.from(p.selectedPaths);
    }
    const item = getActiveCursorItem();
    return item ? [item.path] : [];
  }

  function sortItems(
    items: FileItem[],
    field: SortField,
    order: "asc" | "desc",
  ) {
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;

      let compare = 0;
      if (field === "name") {
        compare = a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      } else if (field === "ext") {
        compare = a.extension.localeCompare(b.extension);
      } else if (field === "size") {
        compare = a.size - b.size;
      } else if (field === "mtime") {
        compare = a.mtime - b.mtime;
      }

      return order === "asc" ? compare : -compare;
    });
  }

  function setSort(paneKey: "left" | "right", field: SortField) {
    const p = paneKey === "left" ? leftPane : rightPane;
    if (p.sortField === field) {
      p.sortOrder = p.sortOrder === "asc" ? "desc" : "asc";
    } else {
      p.sortField = field;
      p.sortOrder = "asc";
    }
    sortItems(p.items, p.sortField, p.sortOrder);
  }

  async function loadDirectory(pane: PaneState, dirPath: string) {
    pane.loading = true;
    pane.error = null;

    try {
      const res = await window.electronAPI.readDir(dirPath, showHidden.value);
      if (res.success && res.data) {
        pane.currentPath = dirPath;
        const currentTab = pane.tabs.find((t) => t.id === pane.activeTabId);
        if (currentTab) {
          currentTab.path = dirPath;
          currentTab.title = getPathLeafName(dirPath);
        }

        sortItems(res.data, pane.sortField, pane.sortOrder);
        pane.items = res.data;
        pane.selectedPaths.clear();
        pane.cursorIndex = pane.items.length > 0 ? 0 : -1;

        // Fetch free and total disk space for current path
        try {
          const spaceRes = await window.electronAPI.getDiskSpace(dirPath);
          if (spaceRes.success && spaceRes.total !== undefined) {
            pane.freeSpace = spaceRes.free;
            pane.availableSpace = spaceRes.available;
            pane.purgeableSpace = spaceRes.purgeable;
            pane.totalSpace = spaceRes.total;
          }
        } catch {
          // Non-blocking
        }
      } else {
        pane.error = res.error || "Failed to read directory";
        showToast(res.error || "Failed to open directory", "error");
      }
    } catch (err: any) {
      pane.error = err.message;
      showToast(err.message, "error");
    } finally {
      pane.loading = false;
    }
  }

  function navigatePane(paneKey: "left" | "right", targetPath: string) {
    const p = paneKey === "left" ? leftPane : rightPane;
    const tab = p.tabs.find((t) => t.id === p.activeTabId);
    if (tab) {
      if (tab.history[tab.historyIndex] !== targetPath) {
        tab.history = tab.history.slice(0, tab.historyIndex + 1);
        tab.history.push(targetPath);
        tab.historyIndex = tab.history.length - 1;
      }
    }
    loadDirectory(p, targetPath);
  }

  function goUp(paneKey: "left" | "right") {
    const p = paneKey === "left" ? leftPane : rightPane;
    if (isRootPath(p.currentPath)) return;
    const parentPath = getParentPath(p.currentPath);
    if (parentPath && parentPath !== p.currentPath) {
      navigatePane(paneKey, parentPath);
    }
  }

  function canGoBack(paneKey: "left" | "right"): boolean {
    const p = paneKey === "left" ? leftPane : rightPane;
    const tab = p.tabs.find((t) => t.id === p.activeTabId);
    return !!tab && tab.historyIndex > 0;
  }

  function canGoForward(paneKey: "left" | "right"): boolean {
    const p = paneKey === "left" ? leftPane : rightPane;
    const tab = p.tabs.find((t) => t.id === p.activeTabId);
    return !!tab && tab.historyIndex < tab.history.length - 1;
  }

  function goBack(paneKey: "left" | "right") {
    const p = paneKey === "left" ? leftPane : rightPane;
    const tab = p.tabs.find((t) => t.id === p.activeTabId);
    if (tab && tab.historyIndex > 0) {
      tab.historyIndex--;
      loadDirectory(p, tab.history[tab.historyIndex]);
    }
  }

  function goForward(paneKey: "left" | "right") {
    const p = paneKey === "left" ? leftPane : rightPane;
    const tab = p.tabs.find((t) => t.id === p.activeTabId);
    if (tab && tab.historyIndex < tab.history.length - 1) {
      tab.historyIndex++;
      loadDirectory(p, tab.history[tab.historyIndex]);
    }
  }

  function refreshPane(paneKey: "left" | "right"): Promise<void> {
    const p = paneKey === "left" ? leftPane : rightPane;
    return loadDirectory(p, p.currentPath);
  }

  function refreshAllPanes(): Promise<[void, void]> {
    return Promise.all([refreshPane("left"), refreshPane("right")]);
  }

  function switchTab(paneKey: "left" | "right", tabId: string) {
    const p = paneKey === "left" ? leftPane : rightPane;
    const tab = p.tabs.find((t) => t.id === tabId);
    if (tab) {
      p.activeTabId = tabId;
      loadDirectory(p, tab.path);
    }
  }

  function newTab(paneKey: "left" | "right") {
    const p = paneKey === "left" ? leftPane : rightPane;
    const newId = "tab-" + Math.random().toString(36).substring(2, 9);
    p.tabs.push({
      id: newId,
      title: getPathLeafName(p.currentPath),
      path: p.currentPath,
      history: [p.currentPath],
      historyIndex: 0,
    });
    p.activeTabId = newId;
  }

  function closeTab(paneKey: "left" | "right", tabId: string) {
    const p = paneKey === "left" ? leftPane : rightPane;
    if (p.tabs.length <= 1) return;
    const idx = p.tabs.findIndex((t) => t.id === tabId);
    if (idx !== -1) {
      p.tabs.splice(idx, 1);
      if (p.activeTabId === tabId) {
        const nextTab = p.tabs[Math.max(0, idx - 1)];
        p.activeTabId = nextTab.id;
        loadDirectory(p, nextTab.path);
      }
    }
  }

  function switchNextTab(paneKey: "left" | "right", direction: 1 | -1 = 1) {
    const p = paneKey === "left" ? leftPane : rightPane;
    if (p.tabs.length <= 1) return;
    const curIdx = p.tabs.findIndex((t) => t.id === p.activeTabId);
    if (curIdx === -1) return;
    const nextIdx = (curIdx + direction + p.tabs.length) % p.tabs.length;
    switchTab(paneKey, p.tabs[nextIdx].id);
  }

  function updateCursor(paneKey: "left" | "right", idx: number) {
    const p = paneKey === "left" ? leftPane : rightPane;
    p.cursorIndex = idx;
  }

  function toggleSelect(paneKey: "left" | "right", path: string) {
    const p = paneKey === "left" ? leftPane : rightPane;
    const next = new Set(p.selectedPaths);
    if (next.has(path)) {
      next.delete(path);
      showShortcutToast("Space / Ins", "Знято виділення з елемента");
    } else {
      next.add(path);
      showShortcutToast("Space / Ins", "Виділено елемент");
    }
    p.selectedPaths = next;
  }

  function selectRange(paneKey: "left" | "right", from: number, to: number) {
    const p = paneKey === "left" ? leftPane : rightPane;
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    const next = new Set(p.selectedPaths);
    for (let i = start; i <= end; i++) {
      if (p.items[i]) {
        next.add(p.items[i].path);
      }
    }
    p.selectedPaths = next;
    p.cursorIndex = to;
    showShortcutToast(
      "Shift + Click",
      `Виділено діапазон (${p.selectedPaths.size} елементів)`,
    );
  }

  function clearSelection(paneKey: "left" | "right") {
    const p = paneKey === "left" ? leftPane : rightPane;
    p.selectedPaths = new Set();
  }

  function selectAllInActivePane() {
    const p = activePaneState.value;
    const next = new Set<string>();
    p.items.forEach((item) => next.add(item.path));
    p.selectedPaths = next;
    showShortcutToast("Cmd + A / +", `Виділено всі файли (${p.items.length})`);
  }

  function invertSelectionInActivePane() {
    const p = activePaneState.value;
    const next = new Set<string>();
    for (const item of p.items) {
      if (!p.selectedPaths.has(item.path)) {
        next.add(item.path);
      }
    }
    p.selectedPaths = next;
    showShortcutToast(
      "*",
      `Інвертовано виділення (${p.selectedPaths.size} вибрано)`,
    );
  }

  function deselectAllInActivePane() {
    const p = activePaneState.value;
    p.selectedPaths = new Set();
    showShortcutToast("- / Esc", "Знято виділення з усіх файлів");
  }

  function swapPanes() {
    const tempPath = leftPane.currentPath;
    loadDirectory(leftPane, rightPane.currentPath);
    loadDirectory(rightPane, tempPath);
    showShortcutToast("Ctrl + U", "Поміняно ліву і праву панелі місцями");
  }

  function toggleHiddenFiles() {
    showHidden.value = !showHidden.value;
    refreshAllPanes();
    showShortcutToast(
      "Cmd + Shift + .",
      showHidden.value
        ? "Показано приховані файли (.dotfiles)"
        : "Сховано приховані файли",
    );
  }

  return {
    activePaneId,
    showHidden,
    leftPane,
    rightPane,
    activePaneState,
    oppositePaneState,
    hasActiveCursorItem,
    getActiveCursorItem,
    getSelectedOrCursorPaths,
    loadDirectory,
    sortItems,
    setSort,
    navigatePane,
    goUp,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    refreshPane,
    refreshAllPanes,
    switchTab,
    newTab,
    closeTab,
    switchNextTab,
    updateCursor,
    toggleSelect,
    selectRange,
    clearSelection,
    selectAllInActivePane,
    invertSelectionInActivePane,
    deselectAllInActivePane,
    swapPanes,
    toggleHiddenFiles,
  };
}
