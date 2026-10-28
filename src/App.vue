<template>
  <div class="app-container" :data-theme="currentTheme" @keydown="handleGlobalShortcuts">
    <!-- Title Bar with macOS Traffic Lights Space -->
    <TitleBar 
      :show-hidden="showHidden"
      :current-theme="currentTheme"
      @open-search="openSearchModal"
      @toggle-hidden="toggleHiddenFiles"
      @swap-panes="swapPanes"
      @open-terminal="openActiveTerminal"
      @refresh-all="refreshAllPanes"
      @toggle-theme="toggleTheme"
    />

    <!-- Quick Drive / Location Bar -->
    <DriveBar 
      :drives="drives" 
      :current-path="activePaneState.currentPath"
      @select-drive="navigateToDrive"
      @eject-drive="ejectDrive"
    />

    <!-- Dual Panes Split View -->
    <main class="dual-pane-container">
      <!-- Left Pane -->
      <PaneView 
        :pane="leftPane"
        :is-active="activePaneId === 'left'"
        :can-go-back="canGoBack('left')"
        :can-go-forward="canGoForward('left')"
        @activate="activePaneId = 'left'"
        @navigate="(p) => navigatePane('left', p)"
        @go-up="goUp('left')"
        @go-back="goBack('left')"
        @go-forward="goForward('left')"
        @refresh="refreshPane('left')"
        @switch-tab="(tabId) => switchTab('left', tabId)"
        @new-tab="newTab('left')"
        @close-tab="(tabId) => closeTab('left', tabId)"
        @update-cursor="(idx) => updateCursor('left', idx)"
        @toggle-select="(p) => toggleSelect('left', p)"
        @select-range="(from, to) => selectRange('left', from, to)"
        @sort="(field) => setSort('left', field)"
        @open-native="openFileNative"
        @drag-drop-items="handleDragDrop"
        @context-menu="(payload) => handleContextMenu('left', payload)"
      />

      <!-- Right Pane -->
      <PaneView 
        :pane="rightPane"
        :is-active="activePaneId === 'right'"
        :can-go-back="canGoBack('right')"
        :can-go-forward="canGoForward('right')"
        @activate="activePaneId = 'right'"
        @navigate="(p) => navigatePane('right', p)"
        @go-up="goUp('right')"
        @go-back="goBack('right')"
        @go-forward="goForward('right')"
        @refresh="refreshPane('right')"
        @switch-tab="(tabId) => switchTab('right', tabId)"
        @new-tab="newTab('right')"
        @close-tab="(tabId) => closeTab('right', tabId)"
        @update-cursor="(idx) => updateCursor('right', idx)"
        @toggle-select="(p) => toggleSelect('right', p)"
        @select-range="(from, to) => selectRange('right', from, to)"
        @sort="(field) => setSort('right', field)"
        @open-native="openFileNative"
        @drag-drop-items="handleDragDrop"
        @context-menu="(payload) => handleContextMenu('right', payload)"
      />
    </main>

    <!-- Bottom Action Bar (Classic Total Commander F2-F10) -->
    <BottomActionBar 
      :has-cursor-item="hasActiveCursorItem"
      :selected-count="activePaneState.selectedPaths.size"
      @action="handleBottomAction"
    />

    <!-- F3 Viewer Modal -->
    <ViewerModal 
      v-if="viewerModal.open"
      :file-path="viewerModal.filePath"
      :file-name="viewerModal.fileName"
      :file-size="viewerModal.fileSize"
      @close="viewerModal.open = false"
    />

    <!-- F4 Editor Modal -->
    <EditorModal 
      v-if="editorModal.open"
      :file-path="editorModal.filePath"
      :file-name="editorModal.fileName"
      @close="editorModal.open = false"
      @saved="onFileSaved"
    />

    <!-- Operation Modal (Copy / Move / Mkdir / NewFile / Delete / Rename) -->
    <OperationModal 
      v-if="operationModal.open"
      :op-type="operationModal.opType"
      :source-items="operationModal.sourceItems"
      :target-dir="operationModal.targetDir"
      @confirm="onOperationConfirm"
      @cancel="operationModal.open = false"
    />

    <!-- Search Modal (Alt+F7) -->
    <SearchModal 
      v-if="searchModal.open"
      :initial-dir="searchModal.initialDir"
      @close="searchModal.open = false"
      @jump-to="jumpToSearchFile"
    />

    <!-- Right-Click Context Menu -->
    <ContextMenu 
      :visible="contextMenuState.visible"
      :x="contextMenuState.x"
      :y="contextMenuState.y"
      :item="contextMenuState.item"
      :current-path="activePaneState.currentPath"
      :selected-count="activePaneState.selectedPaths.size"
      @action="handleContextMenuAction"
      @close="contextMenuState.visible = false"
    />

    <!-- Toast Notifications -->
    <div class="toast-container">
      <div 
        v-for="toast in toasts" 
        :key="toast.id" 
        class="toast"
        :class="{
          'toast-error': toast.type === 'error',
          'toast-success': toast.type === 'success',
          'toast-shortcut': toast.type === 'shortcut'
        }"
      >
        <span v-if="toast.shortcut" class="toast-kbd-badge">{{ toast.shortcut }}</span>
        <span class="toast-message">{{ toast.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import type { PaneState, DriveItem, FileItem, SortField } from './types'
import { getParentPath, getPathLeafName, isRootPath, normalizePath } from './utils/paths'
import TitleBar from './components/TitleBar.vue'
import DriveBar from './components/DriveBar.vue'
import PaneView from './components/pane/PaneView.vue'
import BottomActionBar from './components/BottomActionBar.vue'
import ViewerModal from './components/ViewerModal.vue'
import EditorModal from './components/EditorModal.vue'
import OperationModal from './components/OperationModal.vue'
import SearchModal from './components/SearchModal.vue'
import ContextMenu from './components/ContextMenu.vue'

const activePaneId = ref<'left' | 'right'>('left')
const showHidden = ref(false)
const currentTheme = ref<'dark' | 'light'>(
  (localStorage.getItem('tc-theme') as 'dark' | 'light') || 'dark'
)
const drives = ref<DriveItem[]>([])

function toggleTheme() {
  currentTheme.value = currentTheme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('tc-theme', currentTheme.value)
  document.documentElement.setAttribute('data-theme', currentTheme.value)
  showShortcutToast('Cmd + Shift + T', `Тема змінена на: ${currentTheme.value === 'dark' ? '🌙 Темна' : '☀️ Світла'}`)
}

function createDefaultPaneState(initialPath: string): PaneState {
  const tabId = 'tab-' + Math.random().toString(36).substring(2, 9)
  const cleanPath = normalizePath(initialPath)
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
    sortField: 'name',
    sortOrder: 'asc',
    filterText: '',
    showHidden: false,
    loading: false,
    error: null,
  }
}

const leftPane = reactive<PaneState>(createDefaultPaneState('/'))
const rightPane = reactive<PaneState>(createDefaultPaneState('/'))

const activePaneState = computed(() => {
  return activePaneId.value === 'left' ? leftPane : rightPane
})

const oppositePaneState = computed(() => {
  return activePaneId.value === 'left' ? rightPane : leftPane
})

// Modals State
const viewerModal = reactive({
  open: false,
  filePath: '',
  fileName: '',
  fileSize: 0,
})

const editorModal = reactive({
  open: false,
  filePath: '',
  fileName: '',
})

const operationModal = reactive<{
  open: boolean
  opType: 'copy' | 'move' | 'mkdir' | 'newfile' | 'delete' | 'rename'
  sourceItems: string[]
  targetDir: string
}>({
  open: false,
  opType: 'copy',
  sourceItems: [],
  targetDir: '',
})

const searchModal = reactive({
  open: false,
  initialDir: '',
})

// Right-click Context Menu State
const contextMenuState = reactive<{
  visible: boolean
  x: number
  y: number
  item: FileItem | null
  paneId: 'left' | 'right'
}>({
  visible: false,
  x: 0,
  y: 0,
  item: null,
  paneId: 'left',
})

// Toast notification stack
interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'shortcut'
  shortcut?: string
}

const toasts = ref<ToastItem[]>([])
let toastCounter = 0

function showToast(message: string, type: 'success' | 'error' | 'shortcut' = 'success', shortcut?: string) {
  const id = ++toastCounter
  if (type === 'shortcut') {
    toasts.value = toasts.value.filter((t) => t.type !== 'shortcut')
  }
  toasts.value.push({ id, message, type, shortcut })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, type === 'shortcut' ? 2200 : 3500)
}

function showShortcutToast(shortcut: string, message: string) {
  showToast(message, 'shortcut', shortcut)
}

// Active Item Detection
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

// Load Directory
async function loadDirectory(pane: PaneState, dirPath: string) {
  pane.loading = true
  pane.error = null

  try {
    const res = await window.electronAPI.readDir(dirPath, showHidden.value)
    if (res.success && res.data) {
      pane.currentPath = dirPath
      const currentTab = pane.tabs.find((t) => t.id === pane.activeTabId)
      if (currentTab) {
        currentTab.path = dirPath
        currentTab.title = getPathLeafName(dirPath)
      }

      sortItems(res.data, pane.sortField, pane.sortOrder)
      pane.items = res.data
      pane.selectedPaths.clear()
      pane.cursorIndex = pane.items.length > 0 ? 0 : -1

      // Fetch free and total disk space for current path
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

function navigatePane(paneKey: 'left' | 'right', targetPath: string) {
  const p = paneKey === 'left' ? leftPane : rightPane
  const tab = p.tabs.find((t) => t.id === p.activeTabId)
  if (tab) {
    if (tab.history[tab.historyIndex] !== targetPath) {
      tab.history = tab.history.slice(0, tab.historyIndex + 1)
      tab.history.push(targetPath)
      tab.historyIndex = tab.history.length - 1
    }
  }
  loadDirectory(p, targetPath)
}

function goUp(paneKey: 'left' | 'right') {
  const p = paneKey === 'left' ? leftPane : rightPane
  if (isRootPath(p.currentPath)) return
  const parentPath = getParentPath(p.currentPath)
  if (parentPath && parentPath !== p.currentPath) {
    navigatePane(paneKey, parentPath)
  }
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

function refreshAllPanes() {
  refreshPane('left')
  refreshPane('right')
}

// Tabs
function switchTab(paneKey: 'left' | 'right', tabId: string) {
  const p = paneKey === 'left' ? leftPane : rightPane
  const tab = p.tabs.find((t) => t.id === tabId)
  if (tab) {
    p.activeTabId = tabId
    loadDirectory(p, tab.path)
  }
}

function newTab(paneKey: 'left' | 'right') {
  const p = paneKey === 'left' ? leftPane : rightPane
  const newId = 'tab-' + Math.random().toString(36).substring(2, 9)
  p.tabs.push({
    id: newId,
    title: getPathLeafName(p.currentPath),
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

// Selection & Cursor
function updateCursor(paneKey: 'left' | 'right', idx: number) {
  const p = paneKey === 'left' ? leftPane : rightPane
  p.cursorIndex = idx
}

function toggleSelect(paneKey: 'left' | 'right', path: string) {
  const p = paneKey === 'left' ? leftPane : rightPane
  if (p.selectedPaths.has(path)) {
    p.selectedPaths.delete(path)
    showShortcutToast('Space / Ins', 'Знято виділення з елемента')
  } else {
    p.selectedPaths.add(path)
    showShortcutToast('Space / Ins', 'Виділено елемент')
  }
}

function selectRange(paneKey: 'left' | 'right', from: number, to: number) {
  const p = paneKey === 'left' ? leftPane : rightPane
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  for (let i = start; i <= end; i++) {
    if (p.items[i]) {
      p.selectedPaths.add(p.items[i].path)
    }
  }
  p.cursorIndex = to
  showShortcutToast('Shift + Click', `Виділено діапазон (${p.selectedPaths.size} елементів)`)
}

// Global Actions
function toggleHiddenFiles() {
  showHidden.value = !showHidden.value
  refreshAllPanes()
  showShortcutToast('Cmd + Shift + .', showHidden.value ? 'Показано приховані файли (.dotfiles)' : 'Сховано приховані файли')
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

async function openActiveTerminal() {
  await window.electronAPI.openInTerminal(activePaneState.value.currentPath)
}

// Native open (macOS Finder style on double-click!)
async function openFileNative(item: FileItem) {
  const res = await window.electronAPI.openPath(item.path)
  if (!res.success) {
    showToast(`Could not open file: ${res.error}`, 'error')
  }
}

// Bottom Action Bar handlers
function handleBottomAction(type: string) {
  const cursorItem = getActiveCursorItem()
  const selectedPaths = getSelectedOrCursorPaths()

  switch (type) {
    case 'rename':
      if (cursorItem) {
        operationModal.opType = 'rename'
        operationModal.sourceItems = [cursorItem.path]
        operationModal.targetDir = ''
        operationModal.open = true
      }
      break

    case 'view':
      if (cursorItem && !cursorItem.isDirectory) {
        viewerModal.filePath = cursorItem.path
        viewerModal.fileName = cursorItem.name
        viewerModal.fileSize = cursorItem.size
        viewerModal.open = true
      }
      break

    case 'edit':
      if (cursorItem && !cursorItem.isDirectory) {
        editorModal.filePath = cursorItem.path
        editorModal.fileName = cursorItem.name
        editorModal.open = true
      }
      break

    case 'copy':
      if (selectedPaths.length > 0) {
        operationModal.opType = 'copy'
        operationModal.sourceItems = selectedPaths
        operationModal.targetDir = oppositePaneState.value.currentPath
        operationModal.open = true
      }
      break

    case 'move':
      if (selectedPaths.length > 0) {
        operationModal.opType = 'move'
        operationModal.sourceItems = selectedPaths
        operationModal.targetDir = oppositePaneState.value.currentPath
        operationModal.open = true
      }
      break

    case 'mkdir':
      operationModal.opType = 'mkdir'
      operationModal.sourceItems = []
      operationModal.targetDir = activePaneState.value.currentPath
      operationModal.open = true
      break

    case 'newfile':
      operationModal.opType = 'newfile'
      operationModal.sourceItems = []
      operationModal.targetDir = activePaneState.value.currentPath
      operationModal.open = true
      break

    case 'delete':
      if (selectedPaths.length > 0) {
        operationModal.opType = 'delete'
        operationModal.sourceItems = selectedPaths
        operationModal.targetDir = ''
        operationModal.open = true
      }
      break

    case 'terminal':
      openActiveTerminal()
      break

    case 'search':
      openSearchModal()
      break
  }
}

function openSearchModal() {
  searchModal.initialDir = activePaneState.value.currentPath
  searchModal.open = true
}

function jumpToSearchFile(filePath: string) {
  searchModal.open = false
  const parts = filePath.split('/')
  parts.pop()
  const dir = parts.join('/') || '/'
  navigatePane(activePaneId.value, dir)
}

function handleContextMenu(paneId: 'left' | 'right', payload: { x: number; y: number; item: FileItem | null }) {
  activePaneId.value = paneId
  const p = paneId === 'left' ? leftPane : rightPane
  if (payload.item) {
    const idx = p.items.findIndex((i) => i.path === payload.item!.path)
    if (idx !== -1 && !p.selectedPaths.has(payload.item.path)) {
      p.cursorIndex = idx
    }
  }
  contextMenuState.visible = true
  contextMenuState.x = payload.x
  contextMenuState.y = payload.y
  contextMenuState.item = payload.item
  contextMenuState.paneId = paneId
}

async function handleContextMenuAction(action: string, item: FileItem | null) {
  switch (action) {
    case 'open':
      if (item) {
        if (item.isApp) {
          await openFileNative(item)
        } else if (item.isDirectory) {
          navigatePane(contextMenuState.paneId, item.path)
        } else {
          await openFileNative(item)
        }
      }
      break

    case 'show-package-contents':
      if (item) {
        navigatePane(contextMenuState.paneId, item.path)
      }
      break

    case 'view':
      if (item && !item.isDirectory) {
        viewerModal.filePath = item.path
        viewerModal.fileName = item.name
        viewerModal.fileSize = item.size
        viewerModal.open = true
      }
      break

    case 'edit':
      if (item && !item.isDirectory) {
        editorModal.filePath = item.path
        editorModal.fileName = item.name
        editorModal.open = true
      }
      break

    case 'copy':
      handleBottomAction('copy')
      break

    case 'move':
      handleBottomAction('move')
      break

    case 'rename':
      handleBottomAction('rename')
      break

    case 'delete':
      handleBottomAction('delete')
      break

    case 'clipboard-copy':
      copySelectedToClipboard('copy')
      break

    case 'clipboard-cut':
      copySelectedToClipboard('cut')
      break

    case 'paste':
      pasteFromClipboard()
      break

    case 'show-in-folder':
      if (item) {
        try {
          await window.electronAPI.showInFolder(item.path)
          showShortcutToast('Finder', `Показано у Finder: ${item.name}`)
        } catch (err: any) {
          showToast(err.message, 'error')
        }
      }
      break

    case 'terminal':
      openActiveTerminal()
      break

    case 'mkdir':
      handleBottomAction('mkdir')
      break

    case 'newfile':
      handleBottomAction('newfile')
      break

    case 'select-all':
      selectAllInActivePane()
      break

    case 'refresh':
      refreshPane(contextMenuState.paneId)
      break
  }
}

async function onOperationConfirm(payload: { opType: string; target: string }) {
  operationModal.open = false
  const { opType, target } = payload
  const rawSources: string[] = JSON.parse(JSON.stringify(operationModal.sourceItems))

  try {
    if (opType === 'mkdir') {
      const fullPath = `${activePaneState.value.currentPath}/${target}`
      const res = await window.electronAPI.createFolder(fullPath)
      if (res.success) {
        showToast(`Created directory "${target}"`, 'success')
        refreshPane(activePaneId.value)
      } else {
        showToast(`Error creating folder: ${res.error}`, 'error')
      }
    } else if (opType === 'newfile') {
      const fullPath = `${activePaneState.value.currentPath}/${target}`
      const res = await window.electronAPI.createFile(fullPath)
      if (res.success) {
        showToast(`Created file "${target}"`, 'success')
        refreshPane(activePaneId.value)
      } else {
        showToast(`Error creating file: ${res.error}`, 'error')
      }
    } else if (opType === 'rename') {
      const oldPath = rawSources[0]
      const dirParts = oldPath.split('/')
      dirParts.pop()
      const newPath = `${dirParts.join('/')}/${target}`
      const res = await window.electronAPI.renamePath(oldPath, newPath)
      if (res.success) {
        showToast(`Renamed to "${target}"`, 'success')
        refreshAllPanes()
      } else {
        showToast(`Rename error: ${res.error}`, 'error')
      }
    } else if (opType === 'copy') {
      const res = await window.electronAPI.copyPaths(rawSources, target)
      if (res.success) {
        showToast(`Copied ${rawSources.length} item(s)`, 'success')
        refreshAllPanes()
      } else {
        showToast(`Copy error: ${res.error}`, 'error')
      }
    } else if (opType === 'move') {
      const res = await window.electronAPI.movePaths(rawSources, target)
      if (res.success) {
        showToast(`Moved ${rawSources.length} item(s)`, 'success')
        refreshAllPanes()
      } else {
        showToast(`Move error: ${res.error}`, 'error')
      }
    } else if (opType === 'delete') {
      const res = await window.electronAPI.deletePaths(rawSources, true)
      if (res.success) {
        showToast(`Moved ${rawSources.length} item(s) to Trash`, 'success')
        refreshAllPanes()
      } else {
        showToast(`Delete error: ${res.error}`, 'error')
      }
    }
  } catch (err: any) {
    showToast(`Operation failed: ${err.message}`, 'error')
  }
}

function onFileSaved() {
  showToast('File saved successfully', 'success')
  refreshAllPanes()
}

// Drag and drop between panes & folders
async function handleDragDrop(sourcePaths: string[], targetDir: string) {
  try {
    const rawPaths: string[] = JSON.parse(JSON.stringify(sourcePaths))
    const res = await window.electronAPI.copyPaths(rawPaths, targetDir)
    if (res.success) {
      showToast(`Copied ${rawPaths.length} item(s) to ${targetDir.split('/').pop() || 'target'}`, 'success')
      refreshAllPanes()
    } else {
      showToast(`Drag & drop error: ${res.error}`, 'error')
    }
  } catch (err: any) {
    showToast(`Error: ${err.message}`, 'error')
  }
}

// Global Keyboard Shortcuts
function handleGlobalShortcuts(e: KeyboardEvent) {
  if (contextMenuState.visible) {
    if (e.key === 'Escape') {
      e.preventDefault()
      contextMenuState.visible = false
      return
    }
  }

  if (viewerModal.open || editorModal.open || operationModal.open || searchModal.open) {
    if (e.key === 'Escape') {
      viewerModal.open = false
      editorModal.open = false
      operationModal.open = false
      searchModal.open = false
      showShortcutToast('Esc', 'Закрито активне модальне вікно')
    }
    return
  }

  // Switch Active Pane with Tab
  if (e.key === 'Tab') {
    e.preventDefault()
    activePaneId.value = activePaneId.value === 'left' ? 'right' : 'left'
    showShortcutToast('Tab', `Активна панель: ${activePaneId.value === 'left' ? 'Ліва' : 'Права'}`)
    return
  }

  // Swap Left & Right Panes with Ctrl+U or Cmd+U
  if ((e.metaKey || e.ctrlKey) && (e.key === 'u' || e.key === 'U')) {
    e.preventDefault()
    swapPanes()
    return
  }

  // Help / Shortcut Cheat Sheet (F1)
  if (e.key === 'F1') {
    e.preventDefault()
    showShortcutToast('F1', 'Довідка: Tab, F2-F10, Space, Backspace, Cmd+A, Cmd+R, Cmd+T')
    return
  }

  // F2 - Rename
  if (e.key === 'F2') {
    e.preventDefault()
    showShortcutToast('F2', 'Перейменування файлу або папки')
    handleBottomAction('rename')
    return
  }

  // F3 - View
  if (e.key === 'F3') {
    e.preventDefault()
    showShortcutToast('F3', 'Швидкий перегляд файлу')
    handleBottomAction('view')
    return
  }

  // F4 - Edit
  if (e.key === 'F4') {
    if (e.shiftKey) {
      e.preventDefault()
      showShortcutToast('Shift + F4', 'Створення нового файлу')
      handleBottomAction('newfile')
    } else {
      e.preventDefault()
      showShortcutToast('F4', 'Редагування у вбудованому редакторі')
      handleBottomAction('edit')
    }
    return
  }

  // F5 - Copy
  if (e.key === 'F5') {
    e.preventDefault()
    showShortcutToast('F5', 'Копіювання у цільову панель')
    handleBottomAction('copy')
    return
  }

  // F6 - Move
  if (e.key === 'F6') {
    e.preventDefault()
    showShortcutToast('F6', 'Переміщення у цільову панель')
    handleBottomAction('move')
    return
  }

  // F7 - New Folder
  if (e.key === 'F7') {
    if (e.altKey) {
      e.preventDefault()
      showShortcutToast('Alt + F7', 'Пошук файлів за назвою та текстом')
      openSearchModal()
    } else if (e.shiftKey) {
      e.preventDefault()
      showShortcutToast('Shift + F7', 'Створення нового файлу')
      handleBottomAction('newfile')
    } else {
      e.preventDefault()
      showShortcutToast('F7', 'Створення нової папки')
      handleBottomAction('mkdir')
    }
    return
  }

  // F8 or Delete or Cmd+Backspace - Move to Trash
  if (e.key === 'F8' || e.key === 'Delete' || ((e.metaKey || e.ctrlKey) && e.key === 'Backspace')) {
    e.preventDefault()
    const badge = e.key === 'F8' ? 'F8' : (e.key === 'Delete' ? 'Delete' : 'Cmd + ⌫')
    showShortcutToast(badge, 'Переміщення у macOS Смітник')
    handleBottomAction('delete')
    return
  }

  // F9 - Terminal
  if (e.key === 'F9') {
    e.preventDefault()
    showShortcutToast('F9', 'Відкриття термінала macOS у поточній папці')
    handleBottomAction('terminal')
    return
  }

  // F10 - Search
  if (e.key === 'F10') {
    e.preventDefault()
    showShortcutToast('F10', 'Пошук файлів за назвою та текстом')
    openSearchModal()
    return
  }

  // Cmd+R - Refresh
  if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
    e.preventDefault()
    showShortcutToast('Cmd + R', 'Оновлення вмісту обох панелей')
    refreshAllPanes()
    return
  }

  // Cmd+Shift+. - Toggle Hidden Files
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '.') {
    e.preventDefault()
    toggleHiddenFiles()
    return
  }

  // Cmd+T - New Tab
  if ((e.metaKey || e.ctrlKey) && e.key === 't') {
    e.preventDefault()
    newTab(activePaneId.value)
    showShortcutToast('Cmd + T', 'Відкрито нову вкладку')
    return
  }

  // Cmd+W - Close Tab
  if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
    e.preventDefault()
    closeTab(activePaneId.value, activePaneState.value.activeTabId)
    showShortcutToast('Cmd + W', 'Закрито поточну вкладку')
    return
  }

  // Cmd+A - Select All
  if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
    const activeEl = document.activeElement as HTMLElement
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return
    }
    e.preventDefault()
    selectAllInActivePane()
    return
  }

  // Cmd+C / Ctrl+C - Copy selected files to clipboard
  if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C')) {
    const activeEl = document.activeElement as HTMLElement
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      const input = activeEl as HTMLInputElement | HTMLTextAreaElement
      if (input.selectionStart !== input.selectionEnd) {
        return
      }
    }
    e.preventDefault()
    copySelectedToClipboard('copy')
    return
  }

  // Cmd+X / Ctrl+X - Cut selected files to clipboard
  if ((e.metaKey || e.ctrlKey) && (e.key === 'x' || e.key === 'X')) {
    const activeEl = document.activeElement as HTMLElement
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      const input = activeEl as HTMLInputElement | HTMLTextAreaElement
      if (input.selectionStart !== input.selectionEnd) {
        return
      }
    }
    e.preventDefault()
    copySelectedToClipboard('cut')
    return
  }

  // Cmd+V / Ctrl+V - Paste files from clipboard
  if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) {
    const activeEl = document.activeElement as HTMLElement
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return
    }
    e.preventDefault()
    pasteFromClipboard()
    return
  }

  // Cmd+Shift+T - Toggle Light/Dark Theme
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'T' || e.key === 't')) {
    e.preventDefault()
    toggleTheme()
    return
  }

  // Backspace - Parent directory
  if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey) {
    const target = e.target as HTMLElement
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return
    }
    e.preventDefault()
    goUp(activePaneId.value)
    showShortcutToast('Backspace', 'Перехід у батьківську директорію (..)')
    return
  }
}

const homeDir = ref('/')
let lastCopyTime = 0

function selectAllInActivePane() {
  const p = activePaneState.value
  p.items.forEach((item) => p.selectedPaths.add(item.path))
  showShortcutToast('Cmd + A', `Виділено всі файли (${p.items.length})`)
}

async function copySelectedToClipboard(action: 'copy' | 'cut' = 'copy') {
  const now = Date.now()
  if (now - lastCopyTime < 150) return
  lastCopyTime = now

  const paths = getSelectedOrCursorPaths()
  if (paths.length === 0) {
    showToast('Не вибрано жодного файлу для копіювання', 'error')
    return
  }

  try {
    const res = await window.electronAPI.copyFilesToClipboard(paths, action)
    if (res.success) {
      const count = paths.length
      const badge = action === 'copy' ? 'Cmd + C' : 'Cmd + X'
      if (count === 1) {
        const fileName = paths[0].split('/').filter(Boolean).pop() || paths[0]
        const text = action === 'copy'
          ? `Файл скопійовано у буфер: ${fileName}`
          : `Файл вирізано у буфер: ${fileName}`
        showShortcutToast(badge, text)
      } else {
        const text = action === 'copy'
          ? `Скопійовано ${count} файлів у буфер`
          : `Вирізано ${count} файлів у буфер`
        showShortcutToast(badge, text)
      }
    } else {
      showToast(res.error || 'Помилка копіювання у буфер', 'error')
    }
  } catch (err: any) {
    showToast(err.message || 'Помилка копіювання у буфер', 'error')
  }
}

async function pasteFromClipboard() {
  try {
    const res = await window.electronAPI.getClipboardFiles()
    if (!res.success || !res.paths || res.paths.length === 0) {
      showToast('Буфер обміну не містить файлів для вставки', 'error')
      return
    }

    const targetDir = activePaneState.value.currentPath
    const count = res.paths.length
    const action = res.action || 'copy'

    let opRes
    if (action === 'cut') {
      opRes = await window.electronAPI.movePaths(res.paths, targetDir)
      await window.electronAPI.clearClipboard()
    } else {
      opRes = await window.electronAPI.copyPaths(res.paths, targetDir)
    }

    if (opRes.success) {
      await Promise.all([
        loadDirectory(leftPane, leftPane.currentPath),
        loadDirectory(rightPane, rightPane.currentPath),
      ])
      const dirName = targetDir.split('/').filter(Boolean).pop() || 'директорію'
      const verb = action === 'cut' ? 'Переміщено' : 'Вставлено'
      const itemsWord = count === 1 ? 'елемент' : (count < 5 ? 'елементи' : 'елементів')
      showShortcutToast('Cmd + V', `${verb} ${count} ${itemsWord} у ${dirName}`)
    } else {
      showToast(opRes.error || 'Помилка вставки файлів', 'error')
    }
  } catch (err: any) {
    showToast(err.message || 'Помилка вставки файлів', 'error')
  }
}

async function loadDrivesList() {
  try {
    const drivesRes = await window.electronAPI.getDrives()
    if (drivesRes.success && drivesRes.data) {
      drives.value = drivesRes.data
    }
  } catch (err) {
    console.error('Failed to load drives:', err)
  }
}

async function ejectDrive(path: string) {
  try {
    const res = await window.electronAPI.ejectVolume(path)
    if (res.success) {
      showToast('Носій безпечно вилучено', 'success')
      await loadDrivesList()
      const home = homeDir.value || '/'
      if (leftPane.currentPath.startsWith(path)) {
        await navigatePane('left', home)
      }
      if (rightPane.currentPath.startsWith(path)) {
        await navigatePane('right', home)
      }
    } else {
      showToast(res.error || 'Не вдалося вилучити носій', 'error')
    }
  } catch (err: any) {
    showToast(err.message || 'Помилка вилучення носія', 'error')
  }
}

onMounted(async () => {
  try {
    document.documentElement.setAttribute('data-theme', currentTheme.value)
    const sys = await window.electronAPI.getSystemInfo()
    homeDir.value = sys.homeDir || '/'
    const defaultRoot = '/'
    await Promise.all([
      loadDirectory(leftPane, homeDir.value),
      loadDirectory(rightPane, defaultRoot),
      loadDrivesList(),
    ])

    // Global keyboard listener to catch Cmd+C, Cmd+V, etc. across the window
    window.addEventListener('keydown', handleGlobalShortcuts)

    // Listen to native macOS Edit Menu commands
    window.electronAPI.onAppCommand((cmd) => {
      const activeEl = document.activeElement as HTMLElement
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')

      if (cmd === 'copy') {
        if (isInput) {
          document.execCommand('copy')
        } else {
          copySelectedToClipboard('copy')
        }
      } else if (cmd === 'cut') {
        if (isInput) {
          document.execCommand('cut')
        } else {
          copySelectedToClipboard('cut')
        }
      } else if (cmd === 'paste') {
        if (isInput) {
          document.execCommand('paste')
        } else {
          pasteFromClipboard()
        }
      } else if (cmd === 'selectAll') {
        if (isInput) {
          document.execCommand('selectAll')
        } else {
          selectAllInActivePane()
        }
      }
    })

    // Watch for USB insertion/removal and mounted volumes in real-time
    window.electronAPI.onDrivesChanged(async () => {
      await loadDrivesList()
      showShortcutToast('USB', 'Оновлено підключені USB-носії та диски')
    })
  } catch (err: any) {
    console.error('Initialization error:', err)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalShortcuts)
})
</script>
