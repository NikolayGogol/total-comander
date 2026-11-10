<template>
  <div class="app-container" :data-theme="currentTheme">
    <!-- Top Title Bar -->
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

    <!-- Quick Drive Selector & Free Space -->
    <DriveBar
      :drives="drives"
      :current-path="activePaneState.currentPath"
      @select-drive="navigateToDrive"
      @eject-drive="ejectDrive"
    />

    <!-- Dual File Panes Main Coordinator -->
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
        @select-all="() => selectAllInPane('left')"
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
        @select-all="() => selectAllInPane('right')"
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

    <!-- Quick Viewer Modal (F3) -->
    <ViewerModal
      v-if="viewerModal.open"
      :file-path="viewerModal.filePath"
      :file-name="viewerModal.fileName"
      :file-size="viewerModal.fileSize"
      :initial-mode="viewerModal.mode"
      @close="viewerModal.open = false"
      @toast="showToast"
    />

    <!-- Built-in Editor Modal (F4) -->
    <EditorModal
      v-if="editorModal.open"
      :file-path="editorModal.filePath"
      :file-name="editorModal.fileName"
      @close="editorModal.open = false"
      @saved="onFileSaved"
      @toast="showToast"
    />

    <!-- Operation Modal (F2 Rename, F5 Copy, F6 Move, F7 Mkdir, F8 Delete) -->
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
      @open-large-files="
        (dir) => {
          searchModal.open = false
          openLargeFilesModal(dir)
        }
      "
    />

    <!-- Create Archive Modal (Alt+F5) -->
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

    <!-- Unlocker Utility Modal (Right-Click Menu) -->
    <UnlockerModal
      v-if="unlockerModal.open"
      :target-path="unlockerModal.targetPath"
      :target-name="unlockerModal.targetName"
      :is-directory="unlockerModal.isDirectory"
      :opposite-path="unlockerModal.oppositePath"
      @close="unlockerModal.open = false"
      @action-completed="onUnlockerActionCompleted"
    />

    <!-- Real-time File Transfer Progress Modal (Traffic, Speed, ETA) -->
    <FileOperationProgressModal
      v-if="transferProgressModal.open"
      :data="transferProgressModal.data"
      :target-dir="transferProgressModal.targetDir"
      @cancel="cancelCurrentTransfer"
      @close="transferProgressModal.open = false"
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
      <div v-for="toast in toasts" :key="toast.id" class="toast" :class="[`toast-${toast.type}`]">
        <span v-if="toast.shortcut" class="toast-kbd-badge">{{ toast.shortcut }}</span>
        <span class="toast-message">{{ toast.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import TitleBar from '@/components/TitleBar.vue'
import DriveBar from '@/components/DriveBar.vue'
import PaneView from '@/components/pane/PaneView.vue'
import BottomActionBar from '@/components/BottomActionBar.vue'
import ViewerModal from '@/components/ViewerModal.vue'
import EditorModal from '@/components/EditorModal.vue'
import OperationModal from '@/components/OperationModal.vue'
import SearchModal from '@/components/SearchModal.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import CreateArchiveModal from '@/components/CreateArchiveModal.vue'
import ArchiveViewModal from '@/components/ArchiveViewModal.vue'
import LargeFilesModal from '@/components/LargeFilesModal.vue'
import FolderSizeModal from '@/components/FolderSizeModal.vue'
import UnlockerModal from '@/components/UnlockerModal.vue'
import FileOperationProgressModal from '@/components/FileOperationProgressModal.vue'

import { useToast } from '@/composables/useToast'
import { usePanes } from '@/composables/usePanes'
import { useDrives } from '@/composables/useDrives'
import { useClipboard } from '@/composables/useClipboard'
import { useModals } from '@/composables/useModals'
import { useShortcuts } from '@/composables/useShortcuts'

const homeDir = ref('C:\\')
const currentTheme = ref<'dark' | 'light'>((localStorage.getItem('tc-theme') as 'dark' | 'light') || 'dark')

function toggleTheme() {
  currentTheme.value = currentTheme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('tc-theme', currentTheme.value)
  document.documentElement.setAttribute('data-theme', currentTheme.value)
  showShortcutToast('Ctrl + Shift + T', `Тема оформлення: ${currentTheme.value === 'dark' ? '🌙 Темна' : '☀️ Світла'}`)
}

// Composables
const { toasts, showToast, showShortcutToast } = useToast()

const {
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
} = usePanes({ showToast, showShortcutToast })

const { drives, loadDrivesList, ejectDrive } = useDrives({
  showToast,
  homeDir,
  leftPane,
  rightPane,
  navigatePane,
})

const { canPaste, checkCanPaste, copySelectedToClipboard, pasteFromClipboard } = useClipboard({
  getSelectedOrCursorPaths,
  getActivePaneTargetDir: () => activePaneState.value.currentPath,
  refreshAllPanes,
  showToast,
  showShortcutToast,
  runTransferWithProgress: (type, sources, dest) => runTransferWithProgress(type, sources, dest),
})

const {
  viewerModal,
  editorModal,
  operationModal,
  searchModal,
  largeFilesModal,
  folderSizeModal,
  createArchiveModal,
  archiveViewModal,
  unlockerModal,
  transferProgressModal,
  cancelCurrentTransfer,
  runTransferWithProgress,
  contextMenu,
  openContextMenu,
  openSearchModal,
  openLargeFilesModal,
  openCreateArchiveModal,
  openArchiveViewer,
  openFolderSizeModal,
  jumpToSearchFile,
  openActiveTerminal,
  openFileNative,
  handleBottomAction,
  handleContextMenuAction,
  onOperationConfirm,
  onArchiveCreated,
  onArchiveExtracted,
  onFileSaved,
  onUnlockerActionCompleted,
  handleDragDrop,
} = useModals({
  activePaneId,
  activePaneState,
  oppositePaneState: inactivePaneState,
  navigatePane,
  refreshPane,
  refreshAllPanes,
  getActiveCursorItem,
  getSelectedOrCursorPaths,
  selectAllInActivePane,
  canPaste,
  checkCanPaste,
  copySelectedToClipboard,
  pasteFromClipboard,
  showToast,
  showShortcutToast,
})

const { handleGlobalShortcuts } = useShortcuts({
  activePaneId,
  activePaneState,
  drives,
  modals: {
    contextMenu,
    viewerModal,
    editorModal,
    operationModal,
    searchModal,
  },
  switchNextTab,
  swapPanes,
  handleBottomAction,
  getSelectedOrCursorPaths,
  getActiveCursorItem,
  openCreateArchiveModal,
  openArchiveViewer,
  openSearchModal,
  canGoBack,
  canGoForward,
  goBack,
  goForward,
  goUp,
  refreshAllPanes,
  toggleHiddenFiles,
  newTab,
  closeTab,
  selectAllInActivePane,
  invertSelectionInActivePane,
  deselectAllInActivePane,
  copySelectedToClipboard,
  pasteFromClipboard,
  toggleTheme,
  showToast,
  showShortcutToast,
})

let unsubscribeAppCommand: (() => void) | null = null
let unsubscribeDrives: (() => void) | null = null

function preventDragDefault(e: DragEvent) {
  e.preventDefault()
}

onMounted(async () => {
  try {
    document.documentElement.setAttribute('data-theme', currentTheme.value)
    const sys = await window.electronAPI.getSystemInfo()
    homeDir.value = sys.homeDir || 'C:\\'
    await Promise.all([loadDirectory(leftPane, homeDir.value), loadDirectory(rightPane, 'C:\\'), loadDrivesList()])

    // Prevent browser from navigating away on dropped files
    window.addEventListener('dragover', preventDragDefault)
    window.addEventListener('drop', preventDragDefault)

    // Global keyboard listener to catch TC hotkeys across the window
    window.addEventListener('keydown', handleGlobalShortcuts)

    // Listen to native Edit Menu commands
    if (window.electronAPI?.onAppCommand) {
      unsubscribeAppCommand = window.electronAPI.onAppCommand((cmd) => {
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
        } else if (cmd === 'refresh') {
          refreshAllPanes()
        }
      })
    }

    // Watch for USB insertion/removal and mounted volumes in real-time
    if (window.electronAPI?.onDrivesChanged) {
      unsubscribeDrives = window.electronAPI.onDrivesChanged(async () => {
        await loadDrivesList()
        showShortcutToast('USB', 'Оновлено підключені USB-носії та диски')
      })
    }
  } catch (err: any) {
    console.error('Initialization error:', err)
  }
})

onUnmounted(() => {
  unsubscribeAppCommand?.()
  unsubscribeDrives?.()
  window.removeEventListener('keydown', handleGlobalShortcuts)
  window.removeEventListener('dragover', preventDragDefault)
  window.removeEventListener('drop', preventDragDefault)
})
</script>
