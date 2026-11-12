<template>
  <div
    class="remote-local-pane"
    :class="{ 'is-drop-target': isDragOver }"
    @dragover.prevent="isDragOver = true"
    @dragleave="isDragOver = false"
    @drop.prevent="onDrop"
  >
    <!-- Local Pane Toolbar -->
    <div class="explorer-toolbar local-toolbar">
      <div class="breadcrumbs-bar">
        <button
          type="button"
          class="btn-breadcrumb-up"
          title="Вгору на один рівень (Backspace)"
          :disabled="currentPath === '/'"
          @click="navigateUp"
        >
          <CornerLeftUp :size="13" />
        </button>
        <div class="breadcrumbs-scroll">
          <span
            v-for="(crumb, idx) in breadcrumbs"
            :key="crumb.path"
            class="crumb-wrapper"
          >
            <span
              class="crumb-item"
              :class="{ 'is-current': idx === breadcrumbs.length - 1 }"
              @click="navigateTo(crumb.path)"
            >
              {{ crumb.name }}
            </span>
            <ChevronRight
              v-if="idx < breadcrumbs.length - 1"
              :size="10"
              class="crumb-separator"
            />
          </span>
        </div>
      </div>

      <div class="toolbar-tools">
        <div class="search-input-wrapper">
          <Search :size="12" class="search-icon" />
          <input
            v-model="filterQuery"
            type="text"
            class="filter-input"
            placeholder="Фільтр..."
          />
        </div>
        <button
          type="button"
          class="btn-tool"
          title="Оновити вміст"
          :disabled="isLoading"
          @click="refresh"
        >
          <RotateCw :size="13" :class="{ 'icon-spinning': isLoading }" />
        </button>
      </div>
    </div>

    <!-- Local File Table -->
    <div class="remote-table-wrapper">
      <table class="remote-table">
        <thead>
          <tr>
            <th class="th-name">NAME (LOCAL)</th>
            <th class="th-ext">EXT</th>
            <th class="th-size">SIZE</th>
            <th class="th-date">MODIFIED</th>
          </tr>
        </thead>
        <tbody>
          <!-- Parent Directory Row -->
          <tr
            v-if="currentPath !== '/'"
            class="remote-row is-parent-dir"
            @dblclick="navigateUp"
          >
            <td class="td-name" colspan="4">
              <CornerLeftUp :size="14" class="parent-icon" />
              <span class="parent-text">.. [Parent Directory]</span>
            </td>
          </tr>

          <!-- Local File / Directory Rows -->
          <tr
            v-for="file in filteredFiles"
            :key="file.path"
            class="remote-row"
            :class="{ 'is-selected': selectedItem?.path === file.path }"
            draggable="true"
            @click="selectItem(file)"
            @dblclick="onRowDblClick(file)"
            @dragstart="onDragStart($event, file)"
          >
            <td class="td-name">
              <Folder v-if="file.isDirectory" :size="14" class="icon-folder" />
              <Archive
                v-else-if="isArchiveExt(file.extension)"
                :size="14"
                class="icon-archive"
              />
              <File v-else :size="14" class="icon-file" />
              <span class="entry-name">{{ file.name }}</span>
            </td>
            <td class="td-ext">
              <span
                v-if="!file.isDirectory && file.extension"
                class="ext-badge"
              >
                {{ file.extension }}
              </span>
            </td>
            <td class="td-size">
              <span v-if="file.isDirectory" class="dir-badge">&lt;DIR&gt;</span>
              <span v-else class="size-text">{{ formatBytes(file.size) }}</span>
            </td>
            <td class="td-date">
              {{ file.mtime ? formatDate(file.mtime) : "-" }}
            </td>
          </tr>

          <tr v-if="filteredFiles.length === 0" class="empty-row">
            <td colspan="4" class="empty-cell">
              {{
                isLoading ? "Завантаження..." : "Папка порожня або немає збігів"
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Local Footer -->
    <div class="explorer-footer local-footer">
      <div class="footer-left">
        <span class="footer-stats">
          {{ filteredFiles.length }} елементів
          <template v-if="selectedItem">
            • Вибрано: <strong>{{ selectedItem.name }}</strong>
            <span v-if="!selectedItem.isDirectory">
              ({{ formatBytes(selectedItem.size) }})</span
            >
          </template>
        </span>
      </div>
      <div class="footer-right">
        <button
          type="button"
          class="btn-primary btn-upload-arrow"
          :disabled="!selectedItem"
          title="Завантажити вибраний файл на віддалений сервер (F5 або перетягніть мишкою)"
          @click="selectedItem && $emit('upload', selectedItem)"
        >
          <Upload :size="13" />
          <span>Надіслати на сервер →</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import {
  Folder,
  File,
  Archive,
  CornerLeftUp,
  ChevronRight,
  Search,
  RotateCw,
  Upload,
} from "lucide-vue-next";
import { formatBytes, formatDate } from "@/utils/formatters";
import type { FileItem, RemoteFileEntry } from "@/types";

const props = defineProps<{
  initialPath: string;
}>();

const emit = defineEmits<{
  (e: "select", item: FileItem | null): void;
  (e: "drop-remote", remoteItem: RemoteFileEntry): void;
  (e: "upload", localItem: FileItem): void;
  (e: "navigate", path: string): void;
}>();

const currentPath = ref(props.initialPath || "/");
const files = ref<FileItem[]>([]);
const isLoading = ref(false);
const filterQuery = ref("");
const selectedItem = ref<FileItem | null>(null);
const isDragOver = ref(false);

const filteredFiles = computed(() => {
  if (!filterQuery.value.trim()) return files.value;
  const q = filterQuery.value.toLowerCase().trim();
  return files.value.filter((f) => f.name.toLowerCase().includes(q));
});

const breadcrumbs = computed(() => {
  const raw = currentPath.value;
  if (!raw || raw === "/") return [{ name: "/", path: "/" }];
  const parts = raw.split("/").filter(Boolean);
  const result = [{ name: "/", path: "/" }];
  let accum = "";
  for (const part of parts) {
    accum += "/" + part;
    result.push({ name: part, path: accum });
  }
  return result;
});

async function loadDirectory(targetPath: string) {
  isLoading.value = true;
  selectedItem.value = null;
  emit("select", null);
  try {
    const res = await window.electronAPI.readDir(targetPath, false);
    if (res && res.data) {
      files.value = (res.data as FileItem[]).sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
      currentPath.value = targetPath;
      emit("navigate", targetPath);
    }
  } catch (err) {
    console.error("Failed to read local dir:", err);
  } finally {
    isLoading.value = false;
  }
}

function navigateTo(targetPath: string) {
  loadDirectory(targetPath);
}

function navigateUp() {
  if (currentPath.value === "/") return;
  const parent =
    currentPath.value.substring(0, currentPath.value.lastIndexOf("/")) || "/";
  loadDirectory(parent);
}

function refresh() {
  loadDirectory(currentPath.value);
}

function selectItem(file: FileItem) {
  selectedItem.value = file;
  emit("select", file);
}

function onRowDblClick(file: FileItem) {
  if (file.isDirectory) {
    navigateTo(file.path);
  } else {
    emit("upload", file);
  }
}

function onDragStart(e: DragEvent, file: FileItem) {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = "copyMove";
  e.dataTransfer.setData(
    "application/json",
    JSON.stringify({
      type: "local",
      file: {
        name: file.name,
        path: file.path,
        isDirectory: file.isDirectory,
        size: file.size,
      },
    }),
  );
  e.dataTransfer.setData("text/plain", file.path);
}

function onDrop(e: DragEvent) {
  isDragOver.value = false;
  if (!e.dataTransfer) return;
  try {
    const raw = e.dataTransfer.getData("application/json");
    if (raw) {
      const data = JSON.parse(raw);
      if (data.type === "remote" && data.entry) {
        emit("drop-remote", data.entry);
        return;
      }
    }
  } catch {}
}

function isArchiveExt(ext?: string): boolean {
  if (!ext) return false;
  return ["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar"].includes(
    ext.toLowerCase(),
  );
}

watch(
  () => props.initialPath,
  (newPath) => {
    if (newPath && newPath !== currentPath.value) {
      loadDirectory(newPath);
    }
  },
);

onMounted(() => {
  loadDirectory(currentPath.value);
});

defineExpose({
  currentPath,
  selectedItem,
  refresh,
});
</script>
