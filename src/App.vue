<template>
  <div class="app-container" :data-theme="currentTheme" @keydown="handleGlobalShortcuts">
    <!-- Title Bar with Windows TC Brand and Actions -->
    <TitleBar 
      :show-hidden="showHidden"
      :current-theme="currentTheme"
      @open-search="openSearchModal"
      @open-large-files="openLargeFilesModal"
      @toggle-hidden="toggleHiddenFiles"
      @swap-panes="swapPanes"
      @open-terminal="openActiveTerminal"
      @refresh-all="refreshAllPanes"
      @toggle-theme="toggleTheme"
    />

    <!-- Quick Drive Bar (Physical & Logical Drives C:, D:, etc.) -->
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
        pane-id="left"
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
        @select-all="selectAllInActivePane"
        @clear-selection="() => clearSelection('left')"
        @sort="(field) => setSort('left', field)"
        @open-folder-size="openFolderSizeModal"
        @open-native="openFileNative"
        @drag-drop-items="handleDragDrop"
        @context-menu="openContextMenu"
      />

      <!-- Right Pane -->
      <PaneView 
        :pane="rightPane"
        pane-id="right"
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
        @select-all="selectAllInActivePane"
        @clear-selection="() => clearSelection('right')"
        @sort="(field) => setSort('right', field)"
        @open-folder-size="openFolderSizeModal"
        @open-native="openFileNative"
        @drag-drop-items="handleDragDrop"
        @context-menu="openContextMenu"
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
      @open-large-files="(dir) => { searchModal.open = false; openLargeFilesModal(dir); }"
    />

    <!-- Create Archive Modal (Alt+F5 / Context Menu) -->
    <CreateArchiveModal 
      v-if="createArchiveModal.open"
      :sources="createArchiveModal.sources"
      :current-dir="createArchiveModal.currentDir"
      @close="createArchiveModal.open = false"
      @created="onArchiveCreated"
      @toast="showToast"
    />

    <!-- Archive Viewer Modal (Alt+F6 / Double-click on archive) -->
    <ArchiveViewModal 
      v-if="archiveViewModal.open"
      :archive-path="archiveViewModal.archivePath"
      :target-extract-dir="archiveViewModal.targetExtractDir"
      :current-dir="archiveViewModal.currentDir"
      @close="archiveViewModal.open = false"
      @extracted="onArchiveExtracted"
      @toast="showToast"
    />

    <!-- Large Files Finder / Disk Cleanup Modal -->
    <LargeFilesModal 
      v-if="largeFilesModal.open"
      :initial-dir="largeFilesModal.initialDir"
      :drives="drives"
      @close="largeFilesModal.open = false"
      @jump-to="jumpToSearchFile"
      @open-folder-size="openFolderSizeModal"
      @toast="showToast"
    />

    <!-- Folder Size Analysis Modal -->
    <FolderSizeModal 
      v-if="folderSizeModal.open"
      :target-path="folderSizeModal.targetPath"
      @close="folderSizeModal.open = false"
      @jump-to="(dir) => navigatePane(activePaneId, dir)"
      @toast="showToast"
    />

    <!-- Right-Click Context Menu -->
    <ContextMenu 
      v-if="contextMenu.open"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :item="contextMenu.item"
      :can-paste="canPaste"
      @close="contextMenu.open = false"
      @action="handleContextMenuAction"
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
import TitleBar from './components/TitleBar.vue'
import DriveBar from './components/DriveBar.vue'
import PaneView from './components/pane/PaneView.vue'
import BottomActionBar from './components/BottomActionBar.vue'
import ViewerModal from './components/ViewerModal.vue'
import EditorModal from './components/EditorModal.vue'
import OperationModal from './components/OperationModal.vue'
import SearchModal from './components/SearchModal.vue'
import ContextMenu from './components/ContextMenu.vue'
import CreateArchiveModal from './components/CreateArchiveModal.vue'
import ArchiveViewModal from './components/ArchiveViewModal.vue'
import LargeFilesModal from './components/LargeFilesModal.vue'
import FolderSizeModal from './components/FolderSizeModal.vue'
import { formatBytes, formatNumber } from './utils/formatters'

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
  showShortcutToast('Ctrl + Shift + T', `Тема змінена на: ${currentTheme.value === 'dark' ? '🌙 Темна' : '☀️ Світла'}`)
}

function createDefaultPaneState(initialPath: string): PaneState {
  const tabId = 'tab-' + Math.random().toString(36).substring(2, 9)
  return {
    currentPath: initialPath,
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

const leftPane = reactive<PaneState>(createDefaultPaneState('C:\\'))
const rightPane = reactive<PaneState>(createDefaultPaneState('C:\\'))

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

const createArchiveModal = reactive({
  open: false,
  sources: [] as string[],
  currentDir: '',
})

const archiveViewModal = reactive({
  open: false,
  archivePath: '',
  targetExtractDir: '',
  currentDir: '',
})

const largeFilesModal = reactive({
  open: false,
  initialDir: '',
})

const folderSizeModal = reactive({
  open: false,
  targetPath: '',
})

const contextMenu = reactive<{
  open: boolean
  x: number
  y: number
  item: FileItem | null
  paneKey: 'left' | 'right'
}>({
  open: false,
  x: 0,
  y: 0,
  item: null,
  paneKey: 'left',
})

const canPaste = ref(false)

async function openContextMenu(payload: { x: number; y: number; item: FileItem | null; paneKey: 'left' | 'right' }) {
  activePaneId.value = payload.paneKey
  contextMenu.x = payload.x
  contextMenu.y = payload.y
  contextMenu.item = payload.item
  contextMenu.paneKey = payload.paneKey
  contextMenu.open = true

  try {
    const res = await window.electronAPI.getClipboardFiles()
    canPaste.value = !!(res.success && res.paths && res.paths.length > 0)
  } catch {
    canPaste.value = false
  }
}

function openViewer(item: FileItem) {
  viewerModal.filePath = item.path
  viewerModal.fileName = item.name
  viewerModal.fileSize = item.size
  viewerModal.open = true
}

function openEditor(item: FileItem) {
  editorModal.filePath = item.path
  editorModal.fileName = item.name
  editorModal.open = true
}

async function handleContextMenuAction(action: string) {
  const item = contextMenu.item
  const paneKey = contextMenu.paneKey

  switch (action) {
    case 'open':
      if (item) {
        if (item.isDirectory) {
          navigatePane(paneKey, item.path)
        } else {
          openFileNative(item)
        }
      }
      break

    case 'view':
      if (item) {
        openViewer(item)
      } else {
        handleBottomAction('view')
      }
      break

    case 'edit':
      if (item && !item.isDirectory) {
        openEditor(item)
      } else {
        handleBottomAction('edit')
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

    case 'mkdir':
      handleBottomAction('mkdir')
      break

    case 'newfile':
      handleBottomAction('newfile')
      break

    case 'terminal':
      if (item && item.isDirectory) {
        window.electronAPI.openInTerminal(item.path)
      } else {
        openActiveTerminal()
      }
      break

    case 'refresh':
      refreshPane(paneKey)
      break

    case 'select-all':
      selectAllInActivePane()
      break

    case 'calculate-dir-size': {
      const p = (item && item.isDirectory) ? item.path : activePaneState.value.currentPath
      openFolderSizeModal(p)
      break
    }

    case 'large-files': {
      const p = (item && item.isDirectory) ? item.path : activePaneState.value.currentPath
      openLargeFilesModal(p)
      break
    }

    case 'zip': {
      const paths = getSelectedOrCursorPaths()
      const targets = paths.length > 0 ? paths : (item ? [item.path] : [])
      if (targets.length > 0) {
        openCreateArchiveModal(targets)
      } else {
        showToast('Не вибрано жодного файлу для архівування', 'error')
      }
      break
    }

    case 'unzip': {
      const targetItem = item || getActiveCursorItem()
      if (targetItem && !targetItem.isDirectory) {
        openArchiveViewer(targetItem.path)
      }
      break
    }

    case 'clipboard-copy':
      copySelectedToClipboard('copy')
      break

    case 'clipboard-cut':
      copySelectedToClipboard('cut')
      break

    case 'clipboard-paste':
      pasteFromClipboard()
      break

    case 'copy-path':
      if (item) {
        try {
          await navigator.clipboard.writeText(item.path)
          showShortcutToast('Ctrl + C', `Шлях скопійовано: ${item.name}`)
        } catch {
          window.electronAPI.copyFilesToClipboard([item.path], 'copy')
          showShortcutToast('Ctrl + C', `Шлях скопійовано: ${item.name}`)
        }
      }
      break

    case 'show-in-folder':
      if (item) {
        window.electronAPI.showInFolder(item.path)
      }
      break
  }
}

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
        currentTab.title = dirPath.split(/[/\\]/).filter(Boolean).pop() || dirPath
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

// Selection & Cursor
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

function selectAllInActivePane() {
  const p = activePaneState.value
  p.selectedPaths = new Set(p.items.map((item) => item.path))
  window.getSelection()?.removeAllRanges()
  showShortcutToast('Ctrl + A', `Виділено всі файли (${p.items.length})`)
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

// Global Actions
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

async function openActiveTerminal() {
  const currentDir = activePaneState.value.currentPath
  const res = await window.electronAPI.openInTerminal(currentDir)
  if (res.success) {
    const dirName = currentDir.split(/[/\\]/).filter(Boolean).pop() || currentDir
    showShortcutToast('F9', `Термінал відкрито у: ${dirName}`)
  } else {
    showToast(res.error || 'Не вдалося відкрити термінал', 'error')
  }
}

// Native open (Windows Explorer association on double-click)
async function openFileNative(item: FileItem) {
  const ext = (item.extension || item.name.split('.').pop() || '').toLowerCase().replace(/^\./, '')
  if (['zip', '7z', 'rar', 'tar', 'gz', 'tgz', 'iso', 'bz2', 'xz'].includes(ext)) {
    openArchiveViewer(item.path)
    return
  }
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

    case 'clone':
      if (cursorItem) {
        operationModal.opType = 'copy'
        operationModal.sourceItems = [cursorItem.path]
        operationModal.targetDir = activePaneState.value.currentPath
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

    case 'permanent-delete':
      if (selectedPaths.length > 0) {
        operationModal.opType = 'delete'
        operationModal.sourceItems = selectedPaths
        operationModal.targetDir = 'PERMANENT'
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

function openLargeFilesModal(targetPath?: string) {
  largeFilesModal.initialDir = (typeof targetPath === 'string' && targetPath.trim()) ? targetPath.trim() : activePaneState.value.currentPath
  largeFilesModal.open = true
}

function openCreateArchiveModal(sources: string[]) {
  createArchiveModal.sources = Array.isArray(sources) ? Array.from(sources).map((s) => String(s)) : []
  createArchiveModal.currentDir = activePaneState.value.currentPath
  createArchiveModal.open = true
}

function openArchiveViewer(archivePath: string) {
  archiveViewModal.archivePath = archivePath
  archiveViewModal.currentDir = activePaneState.value.currentPath
  archiveViewModal.targetExtractDir = oppositePaneState.value.currentPath || activePaneState.value.currentPath
  archiveViewModal.open = true
}

function onArchiveCreated(targetPath: string) {
  const name = targetPath.split(/[/\\]/).filter(Boolean).pop() || targetPath
  showToast(`Архів створено: ${name}`, 'success')
  refreshAllPanes()
}

function onArchiveExtracted(targetPath?: string) {
  if (targetPath) {
    showToast(`Архів успішно розпаковано у: ${targetPath}`, 'success')
  } else {
    showToast('Архів успішно розархівовано', 'success')
  }
  refreshAllPanes()
}

function openFolderSizeModal(targetPath: string) {
  folderSizeModal.targetPath = targetPath
  folderSizeModal.open = true
}

function calculateFolderSize(item: FileItem) {
  openFolderSizeModal(item.path)
}

function jumpToSearchFile(filePath: string) {
  searchModal.open = false
  const lastSlashIdx = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'))
  const dir = lastSlashIdx !== -1 ? filePath.slice(0, lastSlashIdx) : filePath
  navigatePane(activePaneId.value, dir)
}

async function onOperationConfirm(payload: { opType: string; target: string }) {
  operationModal.open = false
  const { opType, target } = payload
  const rawSources: string[] = JSON.parse(JSON.stringify(operationModal.sourceItems))

  try {
    if (opType === 'mkdir') {
      const cur = activePaneState.value.currentPath
      const sep = cur.endsWith('\\') || cur.endsWith('/') ? '' : (cur.includes('\\') ? '\\' : '/')
      const fullPath = `${cur}${sep}${target}`
      const res = await window.electronAPI.createFolder(fullPath)
      if (res.success) {
        showToast(`Created directory "${target}"`, 'success')
        refreshPane(activePaneId.value)
      } else {
        showToast(`Error creating folder: ${res.error}`, 'error')
      }
    } else if (opType === 'newfile') {
      const cur = activePaneState.value.currentPath
      const sep = cur.endsWith('\\') || cur.endsWith('/') ? '' : (cur.includes('\\') ? '\\' : '/')
      const fullPath = `${cur}${sep}${target}`
      const res = await window.electronAPI.createFile(fullPath)
      if (res.success) {
        showToast(`Created file "${target}"`, 'success')
        refreshPane(activePaneId.value)
      } else {
        showToast(`Error creating file: ${res.error}`, 'error')
      }
    } else if (opType === 'rename') {
      const oldPath = rawSources[0]
      const lastSlashIdx = Math.max(oldPath.lastIndexOf('\\'), oldPath.lastIndexOf('/'))
      const parentDir = lastSlashIdx !== -1 ? oldPath.slice(0, lastSlashIdx) : ''
      const sep = oldPath.includes('\\') ? '\\' : '/'

      const newPath = parentDir ? `${parentDir}${sep}${target}` : target
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
      const isPermanent = operationModal.targetDir === 'PERMANENT'
      const res = await window.electronAPI.deletePaths(rawSources, !isPermanent)
      if (res.success) {
        showToast(
          isPermanent
            ? `Безповоротно видалено ${rawSources.length} елемент(ів)`
            : `Переміщено ${rawSources.length} елемент(ів) у Кошик`,
          'success'
        )
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

// Drag and drop between panes & folders (and external Explorer files)
async function handleDragDrop(sourcePaths: string[], targetDir: string, isMove: boolean = false) {
  try {
    if (!sourcePaths || sourcePaths.length === 0) return
    const rawPaths: string[] = JSON.parse(JSON.stringify(sourcePaths))
    const targetName = targetDir.split(/[/\\]/).filter(Boolean).pop() || targetDir

    // Avoid dropping onto the exact same folder
    const firstParent = rawPaths[0].replace(/[/\\][^/\\]+$/, '')
    const normParent = firstParent.toLowerCase().replace(/[/\\]+$/, '')
    const normTarget = targetDir.toLowerCase().replace(/[/\\]+$/, '')
    if (normParent === normTarget) {
      showToast('Цільова папка збігається з вихідною', 'error')
      return
    }

    const res = isMove
      ? await window.electronAPI.movePaths(rawPaths, targetDir)
      : await window.electronAPI.copyPaths(rawPaths, targetDir)

    if (res.success) {
      const actionWord = isMove ? 'Переміщено' : 'Скопійовано'
      const itemsWord = rawPaths.length === 1 ? 'елемент' : (rawPaths.length < 5 ? 'елементи' : 'елементів')
      showToast(`${actionWord} ${rawPaths.length} ${itemsWord} у "${targetName}"`, 'success')
      refreshAllPanes()
    } else {
      showToast(`Drag & drop помилка: ${res.error}`, 'error')
    }
  } catch (err: any) {
    showToast(`Помилка drag & drop: ${err.message}`, 'error')
  }
}

// ZIP Archiving & Extraction (Alt+F5 / Alt+F6)
async function archivePathsToZip(sources: string[]) {
  if (!sources || sources.length === 0) return
  const curDir = activePaneState.value.currentPath
  const sep = curDir.includes('/') ? '/' : '\\'

  let baseName = 'archive'
  if (sources.length === 1) {
    const sName = sources[0].split(/[/\\]/).filter(Boolean).pop() || 'archive'
    baseName = sName.replace(/\.[^.]+$/, '')
  } else {
    baseName = curDir.split(/[/\\]/).filter(Boolean).pop() || 'archive'
  }

  const zipName = `${baseName}.zip`
  const targetZip = `${curDir.replace(/[/\\]+$/, '')}${sep}${zipName}`

  showShortcutToast('Alt + F5', `Створення архіву "${zipName}"...`)

  try {
    const res = await window.electronAPI.createZip(sources, targetZip)
    if (res.success) {
      showToast(`Архів успішно створено: ${zipName}`, 'success')
      refreshAllPanes()
    } else {
      showToast(`Помилка архівування: ${res.error}`, 'error')
    }
  } catch (err: any) {
    showToast(`Помилка архівування: ${err.message}`, 'error')
  }
}

async function extractZipFile(zipPath: string) {
  if (!zipPath) return
  const curDir = activePaneState.value.currentPath
  const sep = curDir.includes('/') ? '/' : '\\'
  const zipName = zipPath.split(/[/\\]/).filter(Boolean).pop() || 'Archive.zip'
  const folderName = zipName.replace(/\.[^.]+$/, '')
  const targetDir = `${curDir.replace(/[/\\]+$/, '')}${sep}${folderName}`

  showShortcutToast('Alt + F6', `Розархівування "${zipName}"...`)

  try {
    const res = await window.electronAPI.extractZip(zipPath, targetDir)
    if (res.success) {
      showToast(`Архів розпаковано у папку "${folderName}"`, 'success')
      refreshAllPanes()
    } else {
      showToast(`Помилка розархівування: ${res.error}`, 'error')
    }
  } catch (err: any) {
    showToast(`Помилка розархівування: ${err.message}`, 'error')
  }
}

// Global Keyboard Shortcuts
function handleGlobalShortcuts(e: KeyboardEvent) {
  if (contextMenu.open) {
    if (e.key === 'Escape') {
      contextMenu.open = false
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

  const activeEl = document.activeElement as HTMLElement
  const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')

  // Switch tabs in active pane with Ctrl+Tab / Ctrl+Shift+Tab
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault()
    switchNextTab(activePaneId.value, e.shiftKey ? -1 : 1)
    return
  }

  // Switch Active Pane with Tab
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
    e.preventDefault()
    activePaneId.value = activePaneId.value === 'left' ? 'right' : 'left'
    showShortcutToast('Tab', `Активна панель: ${activePaneId.value === 'left' ? 'Ліва' : 'Права'}`)
    return
  }

  // Swap Left & Right Panes with Ctrl+U
  if ((e.metaKey || e.ctrlKey) && (e.key === 'u' || e.key === 'U')) {
    e.preventDefault()
    swapPanes()
    return
  }

  // Help / Shortcut Cheat Sheet (F1)
  if (e.key === 'F1') {
    e.preventDefault()
    showShortcutToast('F1', 'Довідка: Tab, F2-F10, Shift+F4..F8, Alt+F7, Ctrl+A/C/X/V/R/T/W/U, Alt+Enter/←/→/↑, Space, Ins, *')
    return
  }

  // F2 or Shift+F6 - Rename
  if (e.key === 'F2' || (e.shiftKey && e.key === 'F6')) {
    e.preventDefault()
    showShortcutToast(e.key === 'F2' ? 'F2' : 'Shift + F6', 'Перейменування файлу або папки')
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

  // F5 - Copy (Shift+F5: Duplicate/Clone; Alt+F5: Create Archive ZIP/7Z/RAR)
  if (e.key === 'F5') {
    e.preventDefault()
    if (e.altKey) {
      const paths = getSelectedOrCursorPaths()
      if (paths.length > 0) {
        openCreateArchiveModal(paths)
      } else {
        showToast('Не вибрано файли для архівування', 'error')
      }
    } else if (e.shiftKey) {
      showShortcutToast('Shift + F5', 'Копіювання у поточну папку (Clone)')
      handleBottomAction('clone')
    } else {
      showShortcutToast('F5', 'Копіювання у цільову панель')
      handleBottomAction('copy')
    }
    return
  }

  // F6 - Move (Alt+F6: View / Unpack Archive)
  if (e.key === 'F6') {
    e.preventDefault()
    if (e.altKey) {
      const cursor = getActiveCursorItem()
      if (cursor && !cursor.isDirectory) {
        openArchiveViewer(cursor.path)
      } else {
        showToast('Виберіть архів для перегляду та розпакування', 'error')
      }
    } else {
      showShortcutToast('F6', 'Переміщення у цільову панель')
      handleBottomAction('move')
    }
    return
  }

  // F7 - New Folder / Alt+F7 Search / Shift+F7 New File
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

  // Permanent Delete (Shift+Delete or Shift+F8)
  if (e.shiftKey && (e.key === 'Delete' || e.key === 'F8')) {
    e.preventDefault()
    showShortcutToast('Shift + Del', 'Безповоротне видалення файлів (без Кошика)')
    handleBottomAction('permanent-delete')
    return
  }

  // F8 or Delete or Ctrl+Backspace - Move to Recycle Bin
  if (e.key === 'F8' || e.key === 'Delete' || ((e.metaKey || e.ctrlKey) && e.key === 'Backspace')) {
    if (isInputActive && e.key !== 'F8') return
    e.preventDefault()
    const badge = e.key === 'F8' ? 'F8' : (e.key === 'Delete' ? 'Delete' : 'Ctrl + ⌫')
    showShortcutToast(badge, 'Переміщення у Кошик Windows')
    handleBottomAction('delete')
    return
  }

  // F9 - Terminal
  if (e.key === 'F9') {
    e.preventDefault()
    showShortcutToast('F9', 'Відкриття Термінала Windows у поточній папці')
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

  // Alt+Enter - Show in Windows Explorer
  if (e.altKey && e.key === 'Enter') {
    e.preventDefault()
    const cursor = getActiveCursorItem()
    if (cursor) {
      window.electronAPI.showInFolder(cursor.path)
      showShortcutToast('Alt + Enter', `Показано у Провіднику: ${cursor.name}`)
    }
    return
  }

  // Alt+ArrowLeft - Directory history back
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault()
    if (canGoBack(activePaneId.value)) {
      goBack(activePaneId.value)
      showShortcutToast('Alt + ←', 'Назад по історії')
    }
    return
  }

  // Alt+ArrowRight - Directory history forward
  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault()
    if (canGoForward(activePaneId.value)) {
      goForward(activePaneId.value)
      showShortcutToast('Alt + →', 'Вперед по історії')
    }
    return
  }

  // Alt+ArrowUp - Parent directory
  if (e.altKey && e.key === 'ArrowUp') {
    e.preventDefault()
    goUp(activePaneId.value)
    showShortcutToast('Alt + ↑', 'Батьківська директорія')
    return
  }

  // Ctrl+R - Refresh
  if ((e.metaKey || e.ctrlKey) && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault()
    showShortcutToast('Ctrl + R', 'Оновлення вмісту обох панелей')
    refreshAllPanes()
    return
  }

  // Ctrl+Shift+. or Ctrl+H - Toggle Hidden Files
  if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '.') || (!isInputActive && (e.metaKey || e.ctrlKey) && (e.key === 'h' || e.key === 'H'))) {
    e.preventDefault()
    toggleHiddenFiles()
    return
  }

  // Ctrl+D - Quick drives info
  if (!isInputActive && (e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
    e.preventDefault()
    const driveList = drives.value.map(d => d.name).join(', ')
    showShortcutToast('Ctrl + D', `Диски: ${driveList || 'C:\\'}`)
    return
  }

  // Ctrl+T - New Tab
  if ((e.metaKey || e.ctrlKey) && (e.key === 't' || e.key === 'T')) {
    e.preventDefault()
    newTab(activePaneId.value)
    showShortcutToast('Ctrl + T', 'Відкрито нову вкладку')
    return
  }

  // Ctrl+W - Close Tab
  if ((e.metaKey || e.ctrlKey) && (e.key === 'w' || e.key === 'W')) {
    e.preventDefault()
    closeTab(activePaneId.value, activePaneState.value.activeTabId)
    showShortcutToast('Ctrl + W', 'Закрито поточну вкладку')
    return
  }

  // Ctrl+A - Select All
  if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
    if (isInputActive) return
    e.preventDefault()
    selectAllInActivePane()
    return
  }

  // Numeric * or * - Invert selection (TC standard)
  if (!isInputActive && (e.key === '*' || e.code === 'NumpadMultiply')) {
    e.preventDefault()
    invertSelectionInActivePane()
    return
  }

  // Numeric + or + - Select all
  if (!isInputActive && (e.key === '+' || e.code === 'NumpadAdd')) {
    e.preventDefault()
    selectAllInActivePane()
    return
  }

  // Numeric - or - Deselect all
  if (!isInputActive && (e.key === '-' || e.code === 'NumpadSubtract')) {
    e.preventDefault()
    deselectAllInActivePane()
    return
  }

  // Ctrl+C - Copy selected files to clipboard
  if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C')) {
    if (isInputActive) {
      const input = activeEl as HTMLInputElement | HTMLTextAreaElement
      if (input.selectionStart !== input.selectionEnd) return
    }
    e.preventDefault()
    copySelectedToClipboard('copy')
    return
  }

  // Ctrl+X - Cut selected files to clipboard
  if ((e.metaKey || e.ctrlKey) && (e.key === 'x' || e.key === 'X')) {
    if (isInputActive) {
      const input = activeEl as HTMLInputElement | HTMLTextAreaElement
      if (input.selectionStart !== input.selectionEnd) return
    }
    e.preventDefault()
    copySelectedToClipboard('cut')
    return
  }

  // Ctrl+V - Paste files from clipboard
  if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) {
    if (isInputActive) return
    e.preventDefault()
    pasteFromClipboard()
    return
  }

  // Ctrl+Shift+T - Toggle Light/Dark Theme
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'T' || e.key === 't')) {
    e.preventDefault()
    toggleTheme()
    return
  }

  // Backspace - Parent directory
  if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey) {
    if (isInputActive) return
    e.preventDefault()
    goUp(activePaneId.value)
    showShortcutToast('Backspace', 'Перехід у батьківську директорію (..)')
    return
  }
}

const homeDir = ref('C:\\')
let lastCopyTime = 0

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
      const badge = action === 'copy' ? 'Ctrl + C' : 'Ctrl + X'
      if (count === 1) {
        const fileName = paths[0].split(/[/\\]/).filter(Boolean).pop() || paths[0]
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
      const dirName = targetDir.split(/[/\\]/).filter(Boolean).pop() || targetDir
      const verb = action === 'cut' ? 'Переміщено' : 'Вставлено'
      const itemsWord = count === 1 ? 'елемент' : (count < 5 ? 'елементи' : 'елементів')
      showShortcutToast('Ctrl + V', `${verb} ${count} ${itemsWord} у ${dirName}`)
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
    const match = path.match(/^([A-Za-z]):/)
    const letter = match ? match[1].toUpperCase() : ''
    const driveRoot = letter ? `${letter}:\\` : path

    // 1. Release active file locks: navigate away from this drive if currently open in either pane
    const home = homeDir.value || 'C:\\'
    let navigated = false
    if (leftPane.currentPath.toUpperCase().startsWith(driveRoot.toUpperCase())) {
      await navigatePane('left', home)
      navigated = true
    }
    if (rightPane.currentPath.toUpperCase().startsWith(driveRoot.toUpperCase())) {
      await navigatePane('right', home)
      navigated = true
    }

    for (const tab of leftPane.tabs) {
      if (tab.path.toUpperCase().startsWith(driveRoot.toUpperCase())) {
        tab.path = home
        tab.title = 'C:'
      }
    }
    for (const tab of rightPane.tabs) {
      if (tab.path.toUpperCase().startsWith(driveRoot.toUpperCase())) {
        tab.path = home
        tab.title = 'C:'
      }
    }

    if (navigated) {
      await new Promise((r) => setTimeout(r, 250))
    }

    // 2. Perform safe ejection via Windows Shell COM
    const res = await window.electronAPI.ejectVolume(path)
    if (res.success) {
      // Immediately remove from UI reactive state
      drives.value = drives.value.filter(
        (d) => !d.path.toUpperCase().startsWith(driveRoot.toUpperCase())
      )
      showToast('Носій безпечно вилучено', 'success')
      await loadDrivesList()
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
    homeDir.value = sys.homeDir || 'C:\\'
    await Promise.all([
      loadDirectory(leftPane, homeDir.value),
      loadDirectory(rightPane, 'C:\\'),
      loadDrivesList(),
    ])

    // Prevent browser from navigating away on dropped files
    window.addEventListener('dragover', preventDragDefault)
    window.addEventListener('drop', preventDragDefault)

    // Global keyboard listener to catch TC hotkeys across the window
    window.addEventListener('keydown', handleGlobalShortcuts)

    // Listen to native Edit Menu commands
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

function preventDragDefault(e: DragEvent) {
  e.preventDefault()
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalShortcuts)
  window.removeEventListener('dragover', preventDragDefault)
  window.removeEventListener('drop', preventDragDefault)
})
</script>
