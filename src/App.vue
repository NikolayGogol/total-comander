<template>
  <div
    class="app-container"
    :data-theme="currentTheme"
    @keydown="handleGlobalShortcuts"
  >
    <!-- Title Bar with macOS Traffic Lights Space -->
    <TitleBar
      :show-hidden="showHidden"
      :current-theme="currentTheme"
      :build-version="
        'v' + BUILD_INFO.version + ' (b.' + BUILD_INFO.buildNumber + ')'
      "
      @open-search="openSearchModal"
      @open-analyzer="openLargeFilesModal"
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
      @eject-drive="handleEjectDrive"
    />

    <!-- Dual Panes Split View -->
    <main class="dual-pane-container">
      <!-- Left Pane -->
      <PaneView
        ref="leftPaneRef"
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
        @clear-selection="() => clearSelection('left')"
        @sort="(field) => setSort('left', field)"
        @open-native="openFileNative"
        @open-archive="openArchiveInViewer"
        @drag-drop-items="handleDragDrop"
        @context-menu="(payload) => handleContextMenu('left', payload)"
      />

      <!-- Right Pane -->
      <PaneView
        ref="rightPaneRef"
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
        @clear-selection="() => clearSelection('right')"
        @sort="(field) => setSort('right', field)"
        @open-native="openFileNative"
        @open-archive="openArchiveInViewer"
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

    <!-- Create Archive Modal (Alt+F5) -->
    <CreateArchiveModal
      v-if="createArchiveModal.open"
      :source-items="createArchiveModal.sourceItems"
      :target-dir="createArchiveModal.targetDir"
      @confirm="onArchiveCreateConfirm"
      @close="createArchiveModal.open = false"
    />

    <!-- Archive View Modal (Alt+F6 / Double-click) -->
    <ArchiveViewModal
      v-if="archiveViewModal.open"
      :archive-path="archiveViewModal.archivePath"
      :destination-dir="archiveViewModal.destinationDir"
      @extract="onArchiveExtractConfirm"
      @close="archiveViewModal.open = false"
    />

    <!-- Large Files & Disk Cleanup Modal (Alt+L) -->
    <LargeFilesModal
      v-if="largeFilesModal.open"
      :initial-dir="largeFilesModal.initialDir"
      @close="largeFilesModal.open = false"
      @refreshed="refreshAllPanes"
    />

    <!-- Folder Size Breakdown Modal -->
    <FolderSizeModal
      v-if="folderSizeModal.open"
      :folder-path="folderSizeModal.folderPath"
      @navigate="(p) => navigatePane(activePaneId, p)"
      @close="folderSizeModal.open = false"
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
          'toast-shortcut': toast.type === 'shortcut',
        }"
      >
        <span v-if="toast.shortcut" class="toast-kbd-badge">{{
          toast.shortcut
        }}</span>
        <span class="toast-message">{{ toast.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { BUILD_INFO } from "@/buildInfo";
import TitleBar from "@/components/TitleBar.vue";
import DriveBar from "@/components/DriveBar.vue";
import PaneView from "@/components/pane/PaneView.vue";
import BottomActionBar from "@/components/BottomActionBar.vue";
import ViewerModal from "@/components/ViewerModal.vue";
import EditorModal from "@/components/EditorModal.vue";
import OperationModal from "@/components/OperationModal.vue";
import SearchModal from "@/components/SearchModal.vue";
import ContextMenu from "@/components/ContextMenu.vue";
import CreateArchiveModal from "@/components/CreateArchiveModal.vue";
import ArchiveViewModal from "@/components/ArchiveViewModal.vue";
import LargeFilesModal from "@/components/LargeFilesModal.vue";
import FolderSizeModal from "@/components/FolderSizeModal.vue";

import { useToast } from "@/composables/useToast";
import { useModals } from "@/composables/useModals";
import { usePanes } from "@/composables/usePanes";
import { useDrives } from "@/composables/useDrives";
import { useClipboard } from "@/composables/useClipboard";
import { useShortcuts } from "@/composables/useShortcuts";
import { useFileOperations } from "@/composables/useFileOperations";

const leftPaneRef = ref<InstanceType<typeof PaneView> | null>(null);
const rightPaneRef = ref<InstanceType<typeof PaneView> | null>(null);

const currentTheme = ref<"dark" | "light">(
  (localStorage.getItem("tc-theme") as "dark" | "light") || "dark",
);

const { toasts, showToast, showShortcutToast } = useToast();

const {
  viewerModal,
  editorModal,
  operationModal,
  searchModal,
  createArchiveModal,
  archiveViewModal,
  largeFilesModal,
  folderSizeModal,
  contextMenuState,
  isAnyModalOpen,
  closeAllModals,
} = useModals();

const {
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
} = usePanes(showToast, showShortcutToast);

const { drives, homeDir, loadDrivesList, ejectDrive } = useDrives(showToast);

const { copySelectedToClipboard, pasteFromClipboard } = useClipboard(
  showToast,
  showShortcutToast,
);

const {
  openActiveTerminal,
  openFileNative,
  openSearchModal,
  jumpToSearchFile,
  openCreateArchiveModal,
  openArchiveInViewer,
  openLargeFilesModal,
  handleBottomAction,
  onArchiveCreateConfirm,
  onArchiveExtractConfirm,
  handleContextMenu,
  handleContextMenuAction,
  onOperationConfirm,
  onFileSaved,
  handleDragDrop,
} = useFileOperations({
  activePaneId,
  activePaneState,
  oppositePaneState,
  leftPane,
  rightPane,
  leftPaneRef,
  rightPaneRef,
  operationModal,
  viewerModal,
  editorModal,
  searchModal,
  createArchiveModal,
  archiveViewModal,
  largeFilesModal,
  folderSizeModal,
  contextMenuState,
  getActiveCursorItem,
  getSelectedOrCursorPaths,
  loadDirectory,
  navigatePane,
  refreshPane,
  refreshAllPanes,
  copySelectedToClipboard,
  pasteFromClipboard,
  selectAllInActivePane,
  showToast,
  showShortcutToast,
});

function toggleTheme() {
  currentTheme.value = currentTheme.value === "dark" ? "light" : "dark";
  localStorage.setItem("tc-theme", currentTheme.value);
  document.documentElement.setAttribute("data-theme", currentTheme.value);
  showShortcutToast(
    "Cmd + Shift + T",
    `Тема змінена на: ${currentTheme.value === "dark" ? "🌙 Темна" : "☀️ Світла"}`,
  );
}

function navigateToDrive(path: string) {
  navigatePane(activePaneId.value, path);
}

function handleEjectDrive(path: string) {
  ejectDrive(path, leftPane, rightPane, navigatePane);
}

const activePaneCurrentPath = computed(() => activePaneState.value.currentPath);
const activePaneActiveTabId = computed(() => activePaneState.value.activeTabId);

const { handleGlobalShortcuts } = useShortcuts({
  contextMenuState,
  isAnyModalOpen,
  closeAllModals,
  activePaneId,
  activePaneCurrentPath,
  activePaneActiveTabId,
  getActiveCursorItem,
  getSelectedOrCursorPaths,
  switchNextTab,
  swapPanes,
  handleBottomAction,
  openLargeFilesModal,
  openCreateArchiveModal,
  openArchiveInViewer,
  openSearchModal,
  selectAllInActivePane,
  invertSelectionInActivePane,
  deselectAllInActivePane,
  refreshAllPanes,
  toggleHiddenFiles,
  toggleTheme,
  goUp,
  canGoBack,
  canGoForward,
  goBack,
  goForward,
  newTab,
  closeTab,
  copySelectedToClipboard: (action) =>
    copySelectedToClipboard(getSelectedOrCursorPaths(), action),
  pasteFromClipboard: () =>
    pasteFromClipboard(activePaneState.value.currentPath, () =>
      Promise.all([
        loadDirectory(leftPane, leftPane.currentPath),
        loadDirectory(rightPane, rightPane.currentPath),
      ]).then(() => {}),
    ),
  drives,
  showToast,
  showShortcutToast,
});

function preventDragDefault(e: DragEvent) {
  e.preventDefault();
}

onMounted(async () => {
  try {
    document.documentElement.setAttribute("data-theme", currentTheme.value);
    const sys = await window.electronAPI.getSystemInfo();
    homeDir.value = sys.homeDir || "/";
    const defaultRoot = "/";
    await Promise.all([
      loadDirectory(leftPane, homeDir.value),
      loadDirectory(rightPane, defaultRoot),
      loadDrivesList(),
    ]);

    window.addEventListener("dragover", preventDragDefault);
    window.addEventListener("drop", preventDragDefault);
    window.addEventListener("keydown", handleGlobalShortcuts);

    window.electronAPI.onAppCommand((cmd) => {
      const activeEl = document.activeElement as HTMLElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

      if (cmd === "copy") {
        if (isInput) {
          document.execCommand("copy");
        } else {
          copySelectedToClipboard(getSelectedOrCursorPaths(), "copy");
        }
      } else if (cmd === "cut") {
        if (isInput) {
          document.execCommand("cut");
        } else {
          copySelectedToClipboard(getSelectedOrCursorPaths(), "cut");
        }
      } else if (cmd === "paste") {
        if (isInput) {
          document.execCommand("paste");
        } else {
          pasteFromClipboard(activePaneState.value.currentPath, () =>
            Promise.all([
              loadDirectory(leftPane, leftPane.currentPath),
              loadDirectory(rightPane, rightPane.currentPath),
            ]).then(() => {}),
          );
        }
      } else if (cmd === "selectAll") {
        if (isInput) {
          document.execCommand("selectAll");
        } else {
          selectAllInActivePane();
        }
      }
    });

    window.electronAPI.onDrivesChanged(async () => {
      await loadDrivesList();
      showShortcutToast("USB", "Оновлено підключені USB-носії та диски");
    });
  } catch (err: any) {
    console.error("Initialization error:", err);
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalShortcuts);
  window.removeEventListener("dragover", preventDragDefault);
  window.removeEventListener("drop", preventDragDefault);
});
</script>
