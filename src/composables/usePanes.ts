import { ref, reactive, computed } from 'vue'
import type { PaneState, FileItem, SortField } from '@/types'

function createDefaultPaneState(initialPath: string): PaneState {
  const tabId = 'tab-' + Math.random().toString(36).substring(2, 9)
  return {
    currentPath: initialPath,
    items: [],
    loading: false,
    error: null,
    cursorIndex: -1,
    selectedPaths: new Set(),
    sortField: 'name',
    sortOrder: 'asc',
    filterText: '',
    tabs: [
      {
        id: tabId,
        title: initialPath.split(/[/\\]/).filter(Boolean).pop() || initialPath,
        path: initialPath,
        history: [initialPath],
        historyIndex: 0,
      },
    ],
    activeTabId: tabId,
  }
}

export function usePanes(options: {
  showToast: (message: string, type?: 'success' | 'error' | 'shortcut') => void
  showShortcutToast: (shortcut: string, message: string) => void
}) {
  const { showToast, showShortcutToast } = options

  const activePaneId = ref<'left' | 'right'>('left')
  const showHidden = ref(false)

  const leftPane = reactive<PaneState>(createDefaultPaneState('C:\\'))
  const rightPane = reactive<PaneState>(createDefaultPaneState('C:\\'))

  const activePaneState = computed(() => (activePaneId.value === 'left' ? leftPane : rightPane))
  const inactivePaneState = computed(() => (activePaneId.value === 'left' ? rightPane : leftPane))

  const hasActiveCursorItem = computed(() => {
    const p = activePaneState.value
    return p.cursorIndex >= 0 && p.cursorIndex < p.items.length
  })

  function getActiveCursorItem(): FileItem | null {
    const p = activePaneState.value
    if (p.cursorIndex >= 0 && p.cursorIndex < p.items.length) {
      return p.items[p.cursorIndex]
    }
    return null
  }

  function getSelectedOrCursorPaths(): string[] {
    const p = activePaneState.value
    if (p.selectedPaths.size > 0) {
      return Array.from(p.selectedPaths)
    }
    const item = getActiveCursorItem()
    return item ? [item.path] : []
  }

  function sortItems(items: FileItem[], field: SortField, order: 'asc' | 'desc') {
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1

      let compare = 0
      if (field === 'name') {
        compare = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      } else if (field === 'ext') {
        compare = a.extension.localeCompare(b.extension)
      } else if (field === 'size') {
        compare = a.size - b.size
      } else if (field === 'mtime') {
        compare = a.mtime - b.mtime
      }

      return order === 'asc' ? compare : -compare
    })
  }

  async function loadDirectory(pane: PaneState, dirPath: string): Promise<void> {
    pane.loading = true
    pane.error = null

    try {
      const res = await window.electronAPI.readDir(dirPath, showHidden.value)
      if (res.success && res.data) {
        pane.currentPath = dirPath
        const currentTab = pane.tabs.find((t) => t.id === pane.activeTabId)
        if (currentTab) {
          currentTab.path = dirPath
          currentTab.title = dirPath.split(/[/\\]/).filter(Boolean).pop() || dirPath
        }

        sortItems(res.data, pane.sortField, pane.sortOrder)
        pane.items = res.data
        pane.selectedPaths.clear()
        pane.cursorIndex = pane.items.length > 0 ? 0 : -1

        try {
          const spaceRes = await window.electronAPI.getDiskSpace(dirPath)
          if (spaceRes.success && spaceRes.free !== undefined && spaceRes.total !== undefined) {
            pane.freeSpace = spaceRes.free
            pane.totalSpace = spaceRes.total
          }
        } catch {
          // Non-blocking
        }
      } else {
        pane.error = res.error || 'Failed to read directory'
        showToast(res.error || 'Failed to open directory', 'error')
      }
    } catch (err: any) {
      pane.error = err.message
      showToast(err.message, 'error')
    } finally {
      pane.loading = false
    }
  }

  function setSort(paneKey: 'left' | 'right', field: SortField) {
    const p = paneKey === 'left' ? leftPane : rightPane
    if (p.sortField === field) {
      p.sortOrder = p.sortOrder === 'asc' ? 'desc' : 'asc'
    } else {
      p.sortField = field
      p.sortOrder = 'asc'
    }
    sortItems(p.items, p.sortField, p.sortOrder)
  }

  async function navigatePane(paneKey: 'left' | 'right', targetPath: string): Promise<void> {
    const p = paneKey === 'left' ? leftPane : rightPane
    const tab = p.tabs.find((t) => t.id === p.activeTabId)
    if (tab) {
      if (tab.history[tab.historyIndex] !== targetPath) {
        tab.history = tab.history.slice(0, tab.historyIndex + 1)
        tab.history.push(targetPath)
        tab.historyIndex = tab.history.length - 1
      }
    }
    await loadDirectory(p, targetPath)
  }

  function goUp(paneKey: 'left' | 'right') {
    const p = paneKey === 'left' ? leftPane : rightPane
    const current = p.currentPath.trim()
    if (!current || /^[a-zA-Z]:\\?$/.test(current) || current === '/' || current === '\\') return
    const driveMatch = current.match(/^([a-zA-Z]:)[/\\]?(.*)$/)
    if (driveMatch) {
      const drive = driveMatch[1].toUpperCase()
      const subParts = driveMatch[2].split(/[/\\]/).filter(Boolean)
      subParts.pop()
      const parentPath = subParts.length === 0 ? `${drive}\\` : `${drive}\\${subParts.join('\\')}`
      navigatePane(paneKey, parentPath)
      return
    }
    const parts = current.split(/[/\\]/).filter(Boolean)
    parts.pop()
    const parentPath = parts.length === 0 ? '\\' : '\\' + parts.join('\\')
    navigatePane(paneKey, parentPath)
  }

  function canGoBack(paneKey: 'left' | 'right'): boolean {
    const p = paneKey === 'left' ? leftPane : rightPane
    const tab = p.tabs.find((t) => t.id === p.activeTabId)
    return !!tab && tab.historyIndex > 0
  }

  function canGoForward(paneKey: 'left' | 'right'): boolean {
    const p = paneKey === 'left' ? leftPane : rightPane
    const tab = p.tabs.find((t) => t.id === p.activeTabId)
    return !!tab && tab.historyIndex < tab.history.length - 1
  }

  function goBack(paneKey: 'left' | 'right') {
    const p = paneKey === 'left' ? leftPane : rightPane
    const tab = p.tabs.find((t) => t.id === p.activeTabId)
    if (tab && tab.historyIndex > 0) {
      tab.historyIndex--
      loadDirectory(p, tab.history[tab.historyIndex])
    }
  }

  function goForward(paneKey: 'left' | 'right') {
    const p = paneKey === 'left' ? leftPane : rightPane
    const tab = p.tabs.find((t) => t.id === p.activeTabId)
    if (tab && tab.historyIndex < tab.history.length - 1) {
      tab.historyIndex++
      loadDirectory(p, tab.history[tab.historyIndex])
    }
  }

  function refreshPane(paneKey: 'left' | 'right') {
    const p = paneKey === 'left' ? leftPane : rightPane
    loadDirectory(p, p.currentPath)
  }

  async function refreshAllPanes(): Promise<void> {
    await Promise.all([loadDirectory(leftPane, leftPane.currentPath), loadDirectory(rightPane, rightPane.currentPath)])
  }

  function switchTab(paneKey: 'left' | 'right', tabId: string) {
    const p = paneKey === 'left' ? leftPane : rightPane
    const tab = p.tabs.find((t) => t.id === tabId)
    if (tab) {
      p.activeTabId = tabId
      loadDirectory(p, tab.path)
    }
  }

  function switchNextTab(paneKey: 'left' | 'right', direction: 1 | -1 = 1) {
    const p = paneKey === 'left' ? leftPane : rightPane
    if (p.tabs.length <= 1) return
    const curIdx = p.tabs.findIndex((t) => t.id === p.activeTabId)
    if (curIdx === -1) return
    let nextIdx = (curIdx + direction) % p.tabs.length
    if (nextIdx < 0) nextIdx += p.tabs.length
    switchTab(paneKey, p.tabs[nextIdx].id)
    showShortcutToast('Ctrl + Tab', `Вкладка: ${p.tabs[nextIdx].title}`)
  }

  function newTab(paneKey: 'left' | 'right') {
    const p = paneKey === 'left' ? leftPane : rightPane
    const newId = 'tab-' + Math.random().toString(36).substring(2, 9)
    p.tabs.push({
      id: newId,
      title: p.currentPath.split(/[/\\]/).filter(Boolean).pop() || p.currentPath,
      path: p.currentPath,
      history: [p.currentPath],
      historyIndex: 0,
    })
    p.activeTabId = newId
  }

  function closeTab(paneKey: 'left' | 'right', tabId: string) {
    const p = paneKey === 'left' ? leftPane : rightPane
    if (p.tabs.length <= 1) return
    const idx = p.tabs.findIndex((t) => t.id === tabId)
    if (idx !== -1) {
      p.tabs.splice(idx, 1)
      if (p.activeTabId === tabId) {
        const nextTab = p.tabs[Math.max(0, idx - 1)]
        p.activeTabId = nextTab.id
        loadDirectory(p, nextTab.path)
      }
    }
  }

  function updateCursor(paneKey: 'left' | 'right', idx: number) {
    const p = paneKey === 'left' ? leftPane : rightPane
    p.cursorIndex = idx
  }

  function toggleSelect(paneKey: 'left' | 'right', path: string) {
    const p = paneKey === 'left' ? leftPane : rightPane
    const newSet = new Set(p.selectedPaths)
    if (newSet.has(path)) {
      newSet.delete(path)
      showShortcutToast('Space / Ins', 'Знято виділення')
    } else {
      newSet.add(path)
      showShortcutToast('Space / Ins', 'Виділено елемент')
    }
    p.selectedPaths = newSet
  }

  function selectRange(paneKey: 'left' | 'right', from: number, to: number) {
    const p = paneKey === 'left' ? leftPane : rightPane
    const start = Math.min(from, to)
    const end = Math.max(from, to)
    const newSet = new Set(p.selectedPaths)
    for (let i = start; i <= end; i++) {
      if (p.items[i]) {
        newSet.add(p.items[i].path)
      }
    }
    p.selectedPaths = newSet
    p.cursorIndex = to
    showShortcutToast('Shift + Click', `Виділено діапазон (${p.selectedPaths.size} елементів)`)
  }

  function clearSelection(paneKey: 'left' | 'right') {
    const p = paneKey === 'left' ? leftPane : rightPane
    if (p.selectedPaths.size > 0) {
      p.selectedPaths = new Set()
    }
  }

  function selectAllInPane(paneKey: 'left' | 'right') {
    activePaneId.value = paneKey
    const p = paneKey === 'left' ? leftPane : rightPane
    const newSet = new Set<string>()
    for (const item of p.items) {
      newSet.add(item.path)
    }
    p.selectedPaths = newSet
    window.getSelection()?.removeAllRanges()
    showShortcutToast('Ctrl + A', `Виділено всі файли (${newSet.size})`)
  }

  function selectAllInActivePane() {
    selectAllInPane(activePaneId.value)
  }

  function invertSelectionInActivePane() {
    const p = activePaneState.value
    const newSet = new Set<string>()
    for (const item of p.items) {
      if (!p.selectedPaths.has(item.path)) {
        newSet.add(item.path)
      }
    }
    p.selectedPaths = newSet
    showShortcutToast('*', `Інвертовано виділення (${p.selectedPaths.size} вибрано)`)
  }

  function deselectAllInActivePane() {
    const p = activePaneState.value
    p.selectedPaths = new Set()
    showShortcutToast('Esc / -', 'Знято виділення з усіх файлів')
  }

  function toggleHiddenFiles() {
    showHidden.value = !showHidden.value
    refreshAllPanes()
    showShortcutToast('Ctrl + Shift + .', showHidden.value ? 'Показано приховані файли' : 'Сховано приховані файли')
  }

  function swapPanes() {
    const tempPath = leftPane.currentPath
    loadDirectory(leftPane, rightPane.currentPath)
    loadDirectory(rightPane, tempPath)
    showShortcutToast('Ctrl + U', 'Поміняно ліву і праву панелі місцями')
  }

  function navigateToDrive(path: string) {
    navigatePane(activePaneId.value, path)
  }

  return {
    activePaneId,
    showHidden,
    leftPane,
    rightPane,
    activePaneState,
    inactivePaneState,
    hasActiveCursorItem,
    getActiveCursorItem,
    getSelectedOrCursorPaths,
    loadDirectory,
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
    switchNextTab,
    newTab,
    closeTab,
    updateCursor,
    toggleSelect,
    selectRange,
    clearSelection,
    selectAllInPane,
    selectAllInActivePane,
    invertSelectionInActivePane,
    deselectAllInActivePane,
    toggleHiddenFiles,
    swapPanes,
    navigateToDrive,
  }
}
