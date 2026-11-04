<template>
  <div
    class="modal-overlay"
    @click.self="$emit('close')"
    @keydown.esc="$emit('close')"
  >
    <div class="large-files-modal" tabindex="0" @keydown="handleModalKeyDown">
      <!-- Header -->
      <div class="large-files-header">
        <div class="large-files-title-box">
          <PieChart :size="18" class="modal-icon" />
          <div>
            <div class="modal-title-text">
              Аналізатор диска — Пошук великих файлів
            </div>
            <div class="modal-subtitle">
              Швидкий пошук файлів гігантського розміру для звільнення пам'яті
              macOS
            </div>
          </div>
        </div>
        <button
          class="modal-close-btn"
          title="Закрити (Esc)"
          @click="$emit('close')"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Controls -->
      <div class="large-files-body">
        <div class="large-files-controls">
          <!-- Target Directory -->
          <div class="control-row">
            <span class="control-label">Папка / Диск:</span>
            <div class="target-dir-input-group">
              <input
                v-model="targetDir"
                type="text"
                class="target-dir-input"
                placeholder="/ або вибрана директорія"
                @keydown.enter="startScan"
              />
              <div class="quick-drives-chips">
                <button
                  type="button"
                  class="chip-btn"
                  :class="{ 'is-selected': targetDir === '/' }"
                  @click="targetDir = '/'"
                >
                  Macintosh HD
                </button>
                <button
                  v-if="userHomeDir"
                  type="button"
                  class="chip-btn"
                  :class="{ 'is-selected': targetDir === userHomeDir }"
                  @click="targetDir = userHomeDir"
                >
                  Home (~)
                </button>
                <button
                  type="button"
                  class="chip-btn"
                  :class="{ 'is-selected': targetDir === '/Volumes' }"
                  @click="targetDir = '/Volumes'"
                >
                  /Volumes
                </button>
                <button
                  v-if="initialDir"
                  type="button"
                  class="chip-btn"
                  :class="{ 'is-selected': targetDir === initialDir }"
                  title="Поточна відкрита папка"
                  @click="targetDir = initialDir"
                >
                  Поточна
                </button>
              </div>
            </div>
          </div>

          <!-- Size Threshold Presets -->
          <div class="control-row">
            <span class="control-label">Мінімальний розмір:</span>
            <div class="size-presets-group">
              <button
                type="button"
                class="chip-btn"
                :class="{ 'is-selected': sizePresetMb === 10 }"
                @click="setPreset(10)"
              >
                &gt; 10 MB
              </button>
              <button
                type="button"
                class="chip-btn"
                :class="{ 'is-selected': sizePresetMb === 25 }"
                @click="setPreset(25)"
              >
                &gt; 25 MB
              </button>
              <button
                type="button"
                class="chip-btn"
                :class="{ 'is-selected': sizePresetMb === 50 }"
                @click="setPreset(50)"
              >
                &gt; 50 MB
              </button>
              <button
                type="button"
                class="chip-btn"
                :class="{ 'is-selected': sizePresetMb === 100 }"
                @click="setPreset(100)"
              >
                &gt; 100 MB
              </button>
              <button
                type="button"
                class="chip-btn"
                :class="{ 'is-selected': sizePresetMb === 500 }"
                @click="setPreset(500)"
              >
                &gt; 500 MB
              </button>
              <button
                type="button"
                class="chip-btn"
                :class="{ 'is-selected': sizePresetMb === 1024 }"
                @click="setPreset(1024)"
              >
                &gt; 1 GB
              </button>
              <button
                type="button"
                class="chip-btn"
                :class="{ 'is-selected': sizePresetMb === 2048 }"
                @click="setPreset(2048)"
              >
                &gt; 2 GB
              </button>
              <div class="custom-mb-box">
                <input
                  v-model.number="customSizeMb"
                  type="number"
                  min="1"
                  class="custom-mb-input"
                  placeholder="MB"
                  @input="sizePresetMb = 0"
                  @keydown.enter="startScan"
                />
                <span class="custom-mb-label">MB</span>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="scan-action-box">
              <button
                type="button"
                class="btn-folder-analysis"
                title="Відкрити структуру папок із детальним розрахунком зайнятого місця"
                @click="openFolderAnalysis"
              >
                <FolderArchive :size="13" />
                <span>Аналіз папок</span>
              </button>
              <button
                type="button"
                class="btn-scan-primary"
                :disabled="isScanning || !targetDir"
                @click="startScan"
              >
                <Loader2 v-if="isScanning" :size="14" class="spinning-icon" />
                <Search v-else :size="14" />
                <span>{{ isScanning ? "Сканування..." : "Почати пошук" }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Summary Bar -->
        <div class="large-files-summary-bar">
          <div class="summary-stat-item">
            <span>Знайдено файлів:</span>
            <strong>{{ foundFiles.length }}</strong>
          </div>
          <div class="summary-stat-item">
            <span>Загальний розмір:</span>
            <strong>{{ formatBytes(totalSizeFound) }}</strong>
          </div>
          <div class="summary-stat-item stat-space-freed">
            <span>Вибрано:</span>
            <strong
              >{{ selectedPaths.size }} ({{
                formatBytes(selectedTotalSize)
              }})</strong
            >
          </div>
        </div>

        <!-- Table -->
        <div class="large-files-table-container">
          <table class="large-files-table">
            <thead>
              <tr>
                <th class="th-chk" @click="toggleSelectAll">
                  <input
                    type="checkbox"
                    :checked="
                      foundFiles.length > 0 &&
                      selectedPaths.size === foundFiles.length
                    "
                    :indeterminate="
                      selectedPaths.size > 0 &&
                      selectedPaths.size < foundFiles.length
                    "
                    @click.stop="toggleSelectAll"
                  />
                </th>
                <th class="th-name" @click="changeSort('name')">
                  Назва {{ sortField === "name" ? (sortAsc ? "▲" : "▼") : "" }}
                </th>
                <th class="th-ext" @click="changeSort('extension')">
                  Тип
                  {{ sortField === "extension" ? (sortAsc ? "▲" : "▼") : "" }}
                </th>
                <th class="th-size" @click="changeSort('size')">
                  Розмір {{ sortField === "size" ? (sortAsc ? "▲" : "▼") : "" }}
                </th>
                <th class="th-date" @click="changeSort('mtime')">
                  Дата зміни
                  {{ sortField === "mtime" ? (sortAsc ? "▲" : "▼") : "" }}
                </th>
                <th class="th-path" @click="changeSort('dir')">Розташування</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-if="foundFiles.length === 0 && !isScanning"
                class="empty-row"
              >
                <td colspan="6" class="empty-state-cell">
                  {{
                    hasScanned
                      ? "Великих файлів за заданими критеріями не знайдено."
                      : 'Натисніть "Почати пошук" для сканування диску на великі файли.'
                  }}
                </td>
              </tr>

              <tr v-if="isScanning" class="empty-row">
                <td colspan="6" class="empty-state-cell">
                  <Loader2 :size="20" class="spinning-icon" />
                  <div>Триває аналіз диска... Зачекайте будь ласка.</div>
                </td>
              </tr>

              <tr
                v-for="file in sortedFiles"
                :key="file.path"
                class="large-file-row"
                :class="{
                  'is-selected': selectedPaths.has(file.path),
                  'is-protected': isProtectedFile(file.path),
                }"
                @click="toggleFileSelection(file.path, $event)"
                @dblclick="jumpToFile(file)"
              >
                <td class="td-chk" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedPaths.has(file.path)"
                    @change="toggleFileSelection(file.path)"
                  />
                </td>
                <td class="td-name">
                  <div class="file-name-cell" :title="file.name">
                    <component
                      :is="getFileIcon(file.extension)"
                      :size="14"
                      class="item-icon"
                    />
                    <span class="file-name-text">{{ file.name }}</span>
                    <ShieldAlert
                      v-if="isProtectedFile(file.path)"
                      :size="13"
                      class="protected-icon"
                      title="Критичний системний файл (захищений від видалення)"
                    />
                  </div>
                </td>
                <td class="td-ext">
                  <span class="ext-badge">{{
                    file.extension ? file.extension.toUpperCase() : "—"
                  }}</span>
                </td>
                <td class="td-size">
                  <span :class="getSizeClass(file.size)">
                    {{ formatBytes(file.size) }}
                  </span>
                </td>
                <td class="td-date">{{ formatDate(file.mtime) }}</td>
                <td class="td-path" :title="file.dir">{{ file.dir }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="large-files-footer">
        <div class="large-files-actions-left">
          <button
            type="button"
            class="btn-danger-action"
            :disabled="selectedPaths.size === 0"
            title="Перемістити вибрані файли у Смітник macOS"
            @click="deleteSelected(true)"
          >
            <Trash2 :size="14" />
            <span>У Смітник ({{ selectedPaths.size }})</span>
          </button>

          <button
            type="button"
            class="btn-secondary-action"
            :disabled="selectedPaths.size === 0"
            title="Безповоротно видалити з диску (Shift+Delete)"
            @click="deleteSelected(false)"
          >
            <span>Безповоротно</span>
          </button>

          <button
            v-if="focusedFile"
            type="button"
            class="btn-secondary-action"
            title="Розблокувати заблоковані файли / процеси (Unlocker)"
            @click="openUnlockerForFile"
          >
            <Unlock :size="13" />
            <span>Розблокувати</span>
          </button>
        </div>

        <div class="large-files-actions-right">
          <button
            type="button"
            class="btn-secondary-action"
            :disabled="!focusedFile"
            title="Показати вибраний файл у macOS Finder (Alt+Enter)"
            @click="showInFinder"
          >
            <ExternalLink :size="14" />
            <span>У Finder</span>
          </button>

          <button
            type="button"
            class="btn-success-action"
            :disabled="!focusedFile"
            title="Перейти до файлу у двопанельному режимі Total Commander (Enter)"
            @click="jumpToFocusedFile"
          >
            <FolderOpen :size="14" />
            <span>Перейти (Enter)</span>
          </button>

          <button
            type="button"
            class="btn-secondary-action"
            @click="$emit('close')"
          >
            Закрити (Esc)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { LargeFileItem } from "@/types";
import { formatBytes, formatDate } from "@/utils/formatters";
import {
  PieChart,
  X,
  Search,
  Loader2,
  Trash2,
  FolderOpen,
  ExternalLink,
  Film,
  Archive,
  FolderArchive,
  FileCode,
  FileText,
  File,
  Unlock,
  ShieldAlert,
} from "lucide-vue-next";

const props = defineProps<{
  initialDir: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "jump-to", filePath: string): void;
  (e: "open-folder-sizes", folderPath: string): void;
  (
    e: "open-unlocker",
    targetPath: string,
    targetName: string,
    isDirectory: boolean,
  ): void;
  (e: "refreshed"): void;
}>();

const targetDir = ref(props.initialDir || "/");
const userHomeDir = ref("");
const sizePresetMb = ref(500);
const customSizeMb = ref<number | null>(null);
const isScanning = ref(false);
const hasScanned = ref(false);
const foundFiles = ref<LargeFileItem[]>([]);
const selectedPaths = ref<Set<string>>(new Set());
const lastSelectedPath = ref<string | null>(null);

const sortField = ref<"name" | "extension" | "size" | "mtime" | "dir">("size");
const sortAsc = ref(false);

const focusedFile = computed<LargeFileItem | null>(() => {
  if (selectedPaths.value.size === 0) return null;
  const path = lastSelectedPath.value || Array.from(selectedPaths.value)[0];
  return foundFiles.value.find((f) => f.path === path) || null;
});

const totalSizeFound = computed(() => {
  return foundFiles.value.reduce((acc, f) => acc + f.size, 0);
});

const selectedTotalSize = computed(() => {
  return foundFiles.value
    .filter((f) => selectedPaths.value.has(f.path))
    .reduce((acc, f) => acc + f.size, 0);
});

function isProtectedFile(filePath: string): boolean {
  const norm = filePath.toLowerCase();
  if (
    norm.includes("docker.raw") ||
    norm.includes("docker.qcow2") ||
    norm.includes("com.docker.docker")
  ) {
    return true;
  }
  if (
    norm.includes("/private/var/vm/sleepimage") ||
    norm.includes("/private/var/vm/swapfile") ||
    norm.includes("swapfile")
  ) {
    return true;
  }
  if (
    norm.startsWith("/system") ||
    norm.startsWith("/bin") ||
    norm.startsWith("/sbin") ||
    norm.startsWith("/usr/bin")
  ) {
    return true;
  }
  return false;
}

const sortedFiles = computed(() => {
  const list = [...foundFiles.value];
  const field = sortField.value;
  const asc = sortAsc.value;

  list.sort((a, b) => {
    let valA = a[field];
    let valB = b[field];

    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();

    if (valA < valB) return asc ? -1 : 1;
    if (valA > valB) return asc ? 1 : -1;
    return 0;
  });

  return list;
});

function setPreset(mb: number) {
  sizePresetMb.value = mb;
  customSizeMb.value = null;
}

function changeSort(field: "name" | "extension" | "size" | "mtime" | "dir") {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortField.value = field;
    sortAsc.value = field !== "size";
  }
}

function getFileIcon(ext: string) {
  const e = (ext || "").toLowerCase();
  if (["mp4", "mkv", "avi", "mov", "webm"].includes(e)) return Film;
  if (["zip", "rar", "7z", "tar", "gz", "tgz", "dmg", "iso"].includes(e)) {
    return Archive;
  }
  if (
    ["ts", "js", "vue", "json", "html", "css", "py", "c", "cpp"].includes(e)
  ) {
    return FileCode;
  }
  if (["txt", "md", "pdf", "docx", "log"].includes(e)) return FileText;
  return File;
}

function getSizeClass(size: number) {
  if (size >= 1024 * 1024 * 1024) return "size-gigabyte";
  if (size >= 500 * 1024 * 1024) return "size-huge";
  return "size-normal";
}

function toggleSelectAll() {
  if (selectedPaths.value.size === foundFiles.value.length) {
    selectedPaths.value.clear();
    lastSelectedPath.value = null;
  } else {
    foundFiles.value.forEach((f) => selectedPaths.value.add(f.path));
  }
}

function toggleFileSelection(path: string, event?: MouseEvent) {
  if (event && (event.metaKey || event.ctrlKey)) {
    if (selectedPaths.value.has(path)) {
      selectedPaths.value.delete(path);
    } else {
      selectedPaths.value.add(path);
      lastSelectedPath.value = path;
    }
  } else {
    selectedPaths.value.clear();
    selectedPaths.value.add(path);
    lastSelectedPath.value = path;
  }
}

async function startScan() {
  if (!targetDir.value || isScanning.value) return;

  isScanning.value = true;
  hasScanned.value = true;
  foundFiles.value = [];
  selectedPaths.value.clear();
  lastSelectedPath.value = null;

  const minBytes = customSizeMb.value
    ? customSizeMb.value * 1024 * 1024
    : sizePresetMb.value * 1024 * 1024;

  try {
    const res = await window.electronAPI.findLargeFiles({
      targetDir: targetDir.value,
      minSizeBytes: minBytes,
      limit: 200,
    });
    if (res.success && res.files) {
      foundFiles.value = res.files;
      if (res.files.length > 0) {
        selectedPaths.value.add(res.files[0].path);
        lastSelectedPath.value = res.files[0].path;
      }
    }
  } catch (err) {
    console.error("Помилка сканування великих файлів:", err);
  } finally {
    isScanning.value = false;
  }
}

function jumpToFile(file: LargeFileItem) {
  emit("jump-to", file.path);
  emit("close");
}

function jumpToFocusedFile() {
  if (focusedFile.value) {
    jumpToFile(focusedFile.value);
  }
}

async function showInFinder() {
  if (focusedFile.value) {
    await window.electronAPI.showInFolder(focusedFile.value.path);
  }
}

function openFolderAnalysis() {
  emit("open-folder-sizes", targetDir.value);
  emit("close");
}

function openUnlockerForFile() {
  if (focusedFile.value) {
    emit(
      "open-unlocker",
      focusedFile.value.path,
      focusedFile.value.name,
      false,
    );
  }
}

async function deleteSelected(moveToTrash: boolean) {
  const paths = Array.from(selectedPaths.value);
  if (paths.length === 0) return;

  // Filter out protected files
  const unsafe = paths.filter((p) => isProtectedFile(p));
  if (unsafe.length > 0) {
    alert(
      "Неможливо видалити захищені системні файли macOS або віртуальні диски Docker!",
    );
    return;
  }

  const confirmMsg = moveToTrash
    ? `Перемістити ${paths.length} файлів у Смітник macOS?`
    : `УВАГА! Безповоротно видалити ${paths.length} файлів з диску без можливості відновлення?`;

  if (!confirm(confirmMsg)) return;

  for (const p of paths) {
    try {
      if (moveToTrash) {
        await window.electronAPI.trashFile(p);
      } else {
        await window.electronAPI.deleteItem(p);
      }
    } catch (e) {
      console.error(e);
    }
  }

  emit("refreshed");
  startScan();
}

function handleModalKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    emit("close");
  } else if (e.key === "Enter" && focusedFile.value) {
    jumpToFocusedFile();
  }
}

onMounted(() => {
  if (targetDir.value) {
    startScan();
  }
});
</script>
