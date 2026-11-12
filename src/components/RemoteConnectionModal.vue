<template>
  <div class="remote-modal-root">
    <!-- Floating Minimized Dock Pill (When Minimized) -->
    <Transition name="remote-pill-anim">
      <RemoteMinimizedPill
        v-if="isMinimized"
        :protocol="currentConfig.protocol"
        :host="currentConfig.host"
        @maximize="setMinimized(false)"
        @close="$emit('close')"
      />
    </Transition>

    <!-- Fullscreen Modal View (When Not Minimized) -->
    <Transition name="remote-modal-anim">
      <div
        v-if="!isMinimized"
        class="modal-overlay remote-modal-overlay"
        @click.self="$emit('close')"
      >
        <div
          class="modal-card remote-modal-card"
          @keydown="handleKeyDown"
          tabindex="-1"
        >
          <!-- Modal Header -->
          <div class="modal-header">
            <div class="modal-title">
              <Server :size="16" class="icon-blue" />
              <span>Мережеві підключення (SSH / SFTP / FTP)</span>
              <span
                v-if="isConnected"
                class="remote-status-pill connected"
                title="Активне мережеве з'єднання"
              >
                <span class="status-dot"></span>
                {{ currentConfig.protocol.toUpperCase() }}:
                {{ currentConfig.host }}
              </span>
            </div>
            <div class="modal-header-actions">
              <button
                class="modal-close-btn"
                title="Згорнути у фоновий режим (Cmd+M)"
                @click="setMinimized(true)"
              >
                <Minus :size="15" />
              </button>
              <button
                class="modal-close-btn"
                title="Закрити (Esc)"
                @click="$emit('close')"
              >
                <X :size="15" />
              </button>
            </div>
          </div>

          <!-- Modal Body (Config View vs Dual-Pane Connected View) -->
          <div class="modal-body remote-modal-body">
            <!-- VIEW A: Profile List + Config Form (When NOT connected) -->
            <template v-if="!isConnected">
              <RemoteProfilesSidebar
                :profiles="profiles"
                :selected-profile-id="selectedProfileId"
                @select="selectProfile"
                @create="createNewProfile('sftp')"
                @delete="deleteProfile"
                @contextmenu="onProfileContextMenu"
              />

              <main class="remote-main-view">
                <div
                  v-if="statusMessage"
                  class="remote-status-banner"
                  :class="statusMessage.type"
                >
                  <CheckCircle2
                    v-if="statusMessage.type === 'success'"
                    :size="14"
                    class="banner-icon"
                  />
                  <AlertCircle v-else :size="14" class="banner-icon" />
                  <span class="banner-text">{{ statusMessage.text }}</span>
                </div>

                <RemoteConfigForm
                  :config="currentConfig"
                  :is-loading="isLoading"
                  :is-testing="isTesting"
                  @update:config="Object.assign(currentConfig, $event)"
                  @connect="handleConnect"
                  @save="saveCurrentProfile"
                  @test="testConnection"
                  @terminal="openSshTerminal"
                  @pick-key="pickPrivateKey"
                />
              </main>
            </template>

            <!-- VIEW B: Total Commander Dual-Pane Explorer (When CONNECTED) -->
            <div v-else class="remote-dual-panes">
              <!-- LEFT PANE: Local Files (TC) -->
              <RemoteLocalPane
                ref="localPaneRef"
                :initial-path="activeLocalPath"
                @select="selectedLocalFile = $event"
                @drop-remote="handleDownloadRemoteItem"
                @upload="handleUploadLocalFile"
                @navigate="currentLocalDir = $event"
              />

              <!-- RIGHT PANE: Remote Server Files -->
              <RemoteExplorerPane
                :protocol="currentConfig.protocol"
                :current-remote-path="currentRemotePath"
                :breadcrumbs="breadcrumbs"
                :filtered-entries="filteredEntries"
                :selected-item="selectedItem"
                :filter-query="filterQuery"
                :is-loading="isLoading"
                :is-transferring="isTransferring"
                @update:filter-query="filterQuery = $event"
                @navigate="navigateTo"
                @navigate-up="navigateUp"
                @refresh="refreshRemoteDir"
                @terminal="openSshTerminal"
                @select="selectedItem = $event"
                @dblclick="onRowDblClick"
                @contextmenu-row="onRowContextMenu"
                @contextmenu-blank="onTableBlankContextMenu"
                @dragstart-entry="onRemoteDragStart"
                @drop-local="onDropOnRemote"
                @prompt-folder="openPrompt('folder')"
                @prompt-file="openPrompt('file')"
                @download="handleDownloadSelectedItem"
                @prompt-delete="openPrompt('confirm', selectedItem)"
                @disconnect="disconnect"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Context Menu for Items, Blank Space & Profiles -->
    <RemoteContextMenu
      :visible="contextMenuState.visible"
      :x="contextMenuState.x"
      :y="contextMenuState.y"
      :target-type="contextMenuState.targetType"
      :item="contextMenuState.item"
      :profile="contextMenuState.profile"
      :has-local-selected="!!selectedLocalFile || !!activeSelectedItem"
      @action="handleContextMenuAction"
      @close="contextMenuState.visible = false"
    />

    <!-- Remote Text Editor Modal (F4 / Edit) -->
    <RemoteEditorModal
      :open="editorState.open"
      :file-name="editorState.fileName"
      :remote-path="editorState.remotePath"
      :config="currentConfig"
      @saved="refreshRemoteDir"
      @close="editorState.open = false"
    />

    <!-- Remote Prompt & Confirm Dialog -->
    <RemotePromptModal
      :open="promptState.open"
      :mode="promptState.mode"
      :title="promptState.title"
      :message="promptState.message"
      :label="promptState.label"
      :initial-value="promptState.initialValue"
      :placeholder="promptState.placeholder"
      :submit-text="promptState.submitText"
      :hint="promptState.hint"
      @submit="handlePromptSubmit"
      @cancel="promptState.open = false"
    />

    <!-- Real-time Transfer Progress Modal (Upload / Download) -->
    <RemoteTransferProgressModal
      :open="isProgressModalOpen"
      :data="transferProgress"
      :target-path="progressTargetPath"
      :protocol="currentConfig.protocol"
      @cancel="cancelTransferProgress"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch } from "vue";
import { Server, X, Minus, CheckCircle2, AlertCircle } from "lucide-vue-next";
import { useRemoteConnections } from "@/composables/useRemoteConnections";
import RemoteProfilesSidebar from "@/components/RemoteProfilesSidebar.vue";
import RemoteConfigForm from "@/components/RemoteConfigForm.vue";
import RemoteContextMenu from "@/components/RemoteContextMenu.vue";
import RemoteEditorModal from "@/components/RemoteEditorModal.vue";
import RemotePromptModal from "@/components/RemotePromptModal.vue";
import RemoteMinimizedPill from "@/components/RemoteMinimizedPill.vue";
import RemoteLocalPane from "@/components/RemoteLocalPane.vue";
import RemoteExplorerPane from "@/components/RemoteExplorerPane.vue";
import RemoteTransferProgressModal from "@/components/RemoteTransferProgressModal.vue";
import type {
  FileItem,
  RemoteFileEntry,
  RemoteProfile,
  RemoteTransferProgress,
} from "@/types";

const props = defineProps<{
  activeLocalPath: string;
  activeSelectedItem?: FileItem | null;
  minimized?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "update:minimized", val: boolean): void;
  (e: "file-downloaded", path: string): void;
  (e: "file-uploaded", path: string): void;
}>();

const isMinimized = ref(props.minimized || false);
const localPaneRef = ref<InstanceType<typeof RemoteLocalPane> | null>(null);
const currentLocalDir = ref(props.activeLocalPath || "/");
const selectedLocalFile = ref<FileItem | null>(null);

watch(
  () => props.minimized,
  (val) => {
    isMinimized.value = !!val;
  },
);

function setMinimized(val: boolean) {
  isMinimized.value = val;
  emit("update:minimized", val);
}

const {
  profiles,
  selectedProfileId,
  currentConfig,
  isConnected,
  isLoading,
  isTesting,
  isTransferring,
  currentRemotePath,
  selectedItem,
  filterQuery,
  filteredEntries,
  breadcrumbs,
  statusMessage,
  loadProfiles,
  selectProfile,
  createNewProfile,
  saveCurrentProfile,
  deleteProfile,
  testConnection,
  openSshTerminal,
  pickPrivateKey,
  connect,
  disconnect,
  navigateTo,
  navigateUp,
  refreshRemoteDir,
  downloadItem,
  uploadFile,
  createRemoteFolder,
  createRemoteFile,
  renameRemoteItem,
  deleteRemoteItem,
  duplicateProfile,
} = useRemoteConnections();

const isProgressModalOpen = ref(false);
const transferProgress = ref<RemoteTransferProgress | null>(null);
const progressTargetPath = ref("");
let cleanupProgress: (() => void) | null = null;

onMounted(() => {
  loadProfiles();
  if (window.electronAPI?.onRemoteTransferProgress) {
    cleanupProgress = window.electronAPI.onRemoteTransferProgress((data) => {
      transferProgress.value = data;
      if (data.isDone) {
        setTimeout(() => {
          isProgressModalOpen.value = false;
        }, 350);
      }
    });
  }
});

onUnmounted(() => {
  if (cleanupProgress) cleanupProgress();
});

function cancelTransferProgress() {
  isProgressModalOpen.value = false;
}

// --- Drag & Drop Remote <-> Local ---
function onRemoteDragStart(e: DragEvent, entry: RemoteFileEntry) {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = "copyMove";
  e.dataTransfer.setData(
    "application/json",
    JSON.stringify({ type: "remote", entry }),
  );
  e.dataTransfer.setData("text/plain", entry.path);
}

async function onDropOnRemote(e: DragEvent) {
  if (!e.dataTransfer) return;
  try {
    const raw = e.dataTransfer.getData("application/json");
    if (raw) {
      const data = JSON.parse(raw);
      if (data.type === "local" && data.file) {
        await handleUploadLocalFile(data.file);
        return;
      }
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i];
        const p = window.electronAPI.getPathForFile(f);
        if (p) {
          const fakeItem: FileItem = {
            name: f.name,
            path: p,
            isDirectory: false,
            isFile: true,
            isSymlink: false,
            size: f.size || 0,
            mtime: 0,
            birthtime: 0,
            mode: 0,
            permissions: "-rw-r--r--",
            extension: f.name.split(".").pop() || "",
            isHidden: false,
          };
          await handleUploadLocalFile(fakeItem);
        }
      }
    }
  } catch (err) {
    console.error("Drop on remote failed:", err);
  }
}

async function handleDownloadRemoteItem(entry: RemoteFileEntry) {
  const destDir = currentLocalDir.value || props.activeLocalPath;
  progressTargetPath.value = destDir;
  transferProgress.value = {
    type: "download",
    fileName: entry.name,
    bytesTransferred: 0,
    totalBytes: entry.size || 0,
    bytesRemaining: entry.size || 0,
    percent: 0,
    speedBytesPerSec: 0,
    etaSeconds: 0,
    elapsedSeconds: 0,
  };
  isProgressModalOpen.value = true;

  try {
    const ok = await downloadItem(entry, destDir);
    if (ok) {
      await localPaneRef.value?.refresh();
      emit("file-downloaded", destDir);
    }
  } finally {
    setTimeout(() => {
      isProgressModalOpen.value = false;
    }, 350);
  }
}

async function handleUploadLocalFile(file: FileItem) {
  progressTargetPath.value = currentRemotePath.value;
  transferProgress.value = {
    type: "upload",
    fileName: file.name,
    bytesTransferred: 0,
    totalBytes: file.size || 0,
    bytesRemaining: file.size || 0,
    percent: 0,
    speedBytesPerSec: 0,
    etaSeconds: 0,
    elapsedSeconds: 0,
  };
  isProgressModalOpen.value = true;

  try {
    const ok = await uploadFile(file.path);
    if (ok) {
      await refreshRemoteDir();
      emit("file-uploaded", currentRemotePath.value);
    }
  } finally {
    setTimeout(() => {
      isProgressModalOpen.value = false;
    }, 350);
  }
}

// --- Context Menu ---
const contextMenuState = reactive<{
  visible: boolean;
  x: number;
  y: number;
  targetType: "item" | "blank" | "profile";
  item: RemoteFileEntry | null;
  profile: RemoteProfile | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  targetType: "item",
  item: null,
  profile: null,
});

function onRowContextMenu(e: MouseEvent, entry: RemoteFileEntry) {
  selectedItem.value = entry;
  contextMenuState.visible = true;
  contextMenuState.x = e.clientX;
  contextMenuState.y = e.clientY;
  contextMenuState.targetType = "item";
  contextMenuState.item = entry;
  contextMenuState.profile = null;
}

function onTableBlankContextMenu(e: MouseEvent) {
  contextMenuState.visible = true;
  contextMenuState.x = e.clientX;
  contextMenuState.y = e.clientY;
  contextMenuState.targetType = "blank";
  contextMenuState.item = null;
  contextMenuState.profile = null;
}

function onProfileContextMenu(e: MouseEvent, profile: RemoteProfile) {
  selectProfile(profile);
  contextMenuState.visible = true;
  contextMenuState.x = e.clientX;
  contextMenuState.y = e.clientY;
  contextMenuState.targetType = "profile";
  contextMenuState.item = null;
  contextMenuState.profile = profile;
}

// --- Remote Editor ---
const editorState = reactive({
  open: false,
  fileName: "",
  remotePath: "",
});

function openRemoteEditor(entry: RemoteFileEntry) {
  if (entry.isDirectory) return;
  editorState.fileName = entry.name;
  editorState.remotePath = entry.path;
  editorState.open = true;
}

// --- In-App Prompt ---
const promptState = reactive<{
  open: boolean;
  mode: "folder" | "file" | "rename" | "confirm";
  title: string;
  message?: string;
  label?: string;
  initialValue?: string;
  placeholder?: string;
  submitText?: string;
  hint?: string;
  targetItem?: RemoteFileEntry | null;
}>({
  open: false,
  mode: "folder",
  title: "",
  message: "",
  label: "",
  initialValue: "",
  placeholder: "",
  submitText: "",
  hint: "",
  targetItem: null,
});

function openPrompt(
  mode: "folder" | "file" | "rename" | "confirm",
  item?: RemoteFileEntry | null,
) {
  const isRename = mode === "rename";
  const isConfirm = mode === "confirm";
  const isFolder = mode === "folder";
  const kind = item?.isDirectory ? "папку" : "файл";
  Object.assign(promptState, {
    open: true,
    mode,
    targetItem: item || null,
    title: isConfirm
      ? "Видалення з сервера"
      : isRename
        ? `Перейменувати ${kind}`
        : isFolder
          ? "Створити нову папку на сервері"
          : "Створити новий файл на сервері",
    message: isConfirm
      ? `Ви дійсно бажаєте безповоротно видалити ${kind} "${item?.name}" з сервера?`
      : `Поточна директорія: ${currentRemotePath.value}`,
    label: isConfirm
      ? ""
      : isRename
        ? "Нова назва:"
        : isFolder
          ? "Назва нової папки:"
          : "Назва файлу (з розширенням):",
    initialValue: isRename ? item?.name : "",
    placeholder: isRename ? item?.name : isFolder ? "Нова папка" : "file.txt",
    submitText: isConfirm
      ? "Видалити"
      : isRename
        ? "Перейменувати"
        : "Створити",
    hint: isConfirm
      ? "Цю дію неможливо скасувати"
      : "Зміни будуть застосовані на сервері",
  });
}

async function handlePromptSubmit(value: string) {
  const item = promptState.targetItem;
  const mode = promptState.mode;
  promptState.open = false;

  if (mode === "folder") {
    await createRemoteFolder(value);
  } else if (mode === "file") {
    const newPath =
      currentRemotePath.value === "/"
        ? `/${value}`
        : `${currentRemotePath.value}/${value}`;
    await createRemoteFile(newPath);
  } else if (mode === "rename" && item) {
    const parent = item.path.substring(0, item.path.lastIndexOf("/"));
    const newPath = parent === "" ? `/${value}` : `${parent}/${value}`;
    await renameRemoteItem(item.path, newPath);
  } else if (mode === "confirm" && item) {
    await deleteRemoteItem(item);
  }
}

async function handleContextMenuAction(
  action: string,
  item?: RemoteFileEntry | null,
) {
  const actions: Record<string, () => void> = {
    open: () =>
      item?.isDirectory ? navigateTo(item.path) : handleDownloadSelectedItem(),
    edit: () => item && !item.isDirectory && openRemoteEditor(item),
    rename: () => item && openPrompt("rename", item),
    delete: () => item && openPrompt("confirm", item),
    "copy-path": () => item && navigator.clipboard.writeText(item.path),
    "new-folder": () => openPrompt("folder"),
    "new-file": () => openPrompt("file"),
    upload: () =>
      selectedLocalFile.value && handleUploadLocalFile(selectedLocalFile.value),
    refresh: refreshRemoteDir,
    "copy-dir-path": () =>
      navigator.clipboard.writeText(currentRemotePath.value),
    "connect-profile": handleConnect,
    "duplicate-profile": () =>
      contextMenuState.profile && duplicateProfile(contextMenuState.profile),
    "delete-profile": () =>
      contextMenuState.profile && deleteProfile(contextMenuState.profile.id),
  };
  actions[action]?.();
}

function handleKeyDown(e: KeyboardEvent) {
  if (promptState.open || editorState.open) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m") {
    e.preventDefault();
    setMinimized(true);
    return;
  }
  if (!isConnected.value) return;

  if (e.key === "F5") {
    e.preventDefault();
    if (selectedLocalFile.value) {
      handleUploadLocalFile(selectedLocalFile.value);
    } else if (selectedItem.value && !selectedItem.value.isDirectory) {
      handleDownloadSelectedItem();
    }
  } else if (e.key === "F7") {
    e.preventDefault();
    openPrompt("folder");
  } else if (e.key === "F4") {
    e.preventDefault();
    if (e.shiftKey) {
      openPrompt("file");
    } else if (selectedItem.value && !selectedItem.value.isDirectory) {
      openRemoteEditor(selectedItem.value);
    }
  } else if (e.key === "F2") {
    e.preventDefault();
    if (selectedItem.value) openPrompt("rename", selectedItem.value);
  } else if (e.key === "Delete" || e.key === "Backspace") {
    if (e.target instanceof HTMLInputElement) return;
    if (selectedItem.value) {
      e.preventDefault();
      openPrompt("confirm", selectedItem.value);
    }
  }
}

async function handleConnect() {
  await connect();
}

function onRowDblClick(entry: RemoteFileEntry) {
  if (entry.isDirectory) {
    navigateTo(entry.path);
  } else {
    handleDownloadSelectedItem();
  }
}

async function handleDownloadSelectedItem() {
  if (!selectedItem.value || selectedItem.value.isDirectory) return;
  await handleDownloadRemoteItem(selectedItem.value);
}
</script>
