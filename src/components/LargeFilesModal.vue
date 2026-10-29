<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card large-files-card">
      <div class="modal-header">
        <div class="modal-title">
          <PieChart :size="16" class="icon-rose" title="Disk Cleanup" />
          <span>Аналізатор великих файлів (Disk Cleanup)</span>
        </div>
        <button
          class="modal-close-btn"
          title="Закрити (Esc)"
          @click="$emit('close')"
        >
          <X :size="15" />
        </button>
      </div>

      <div class="modal-body large-files-body">
        <!-- Path and controls -->
        <div class="large-files-toolbar">
          <div class="path-pill" :title="initialDir">
            <span class="path-label">Папка:</span>
            <code>{{ initialDir }}</code>
          </div>
          <button
            class="btn-rescan"
            :disabled="scanning"
            title="Повторне сканування"
            @click="runScan"
          >
            <RotateCw :size="13" :class="{ spin: scanning }" />
            <span>Оновити</span>
          </button>
        </div>

        <!-- Filter Threshold Buttons -->
        <div class="threshold-selector">
          <span class="threshold-label">Фільтр розміру:</span>
          <button
            v-for="t in thresholds"
            :key="t.bytes"
            type="button"
            class="threshold-pill"
            :class="{ 'is-active': activeThreshold === t.bytes }"
            @click="activeThreshold = t.bytes"
          >
            {{ t.label }}
          </button>
        </div>

        <!-- Loading / Empty / Content states -->
        <div v-if="scanning" class="scanner-status-box">
          <Loader2 :size="24" class="spin icon-blue" />
          <span>Сканування вмісту та підрахунок розмірів файлів...</span>
        </div>

        <div v-else-if="filteredFiles.length === 0" class="scanner-empty-box">
          <CheckCircle2 :size="24" class="icon-emerald" />
          <span>Файлів більших за обраний поріг не знайдено. Диск чистий!</span>
        </div>

        <div v-else class="large-files-table-wrapper">
          <table class="large-files-table">
            <thead>
              <tr>
                <th class="col-check">
                  <input
                    type="checkbox"
                    :checked="isAllSelected"
                    title="Виділити всі (Cmd+A)"
                    @change="toggleSelectAll"
                  />
                </th>
                <th class="col-name">Файл</th>
                <th class="col-size">Розмір</th>
                <th class="col-actions">Дії</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(file, idx) in filteredFiles"
                :key="file.path"
                class="file-row"
                :class="{ 'is-selected': isSelected(file.path) }"
                @click="handleRowClick($event, file.path, idx)"
              >
                <td class="col-check" @click.stop>
                  <input
                    type="checkbox"
                    :checked="isSelected(file.path)"
                    @change="toggleSelect(file.path, idx)"
                  />
                </td>
                <td class="col-name">
                  <div class="name-container" :title="file.path">
                    <File :size="14" class="item-icon icon-cyan" />
                    <span class="file-name-text">{{ file.name }}</span>
                    <span class="file-dir-hint">{{
                      getDirName(file.path)
                    }}</span>
                  </div>
                </td>
                <td class="col-size">
                  <span class="large-size-badge">{{
                    formatBytes(file.size)
                  }}</span>
                </td>
                <td class="col-actions" @click.stop>
                  <button
                    class="btn-row-action"
                    title="Показати у Finder"
                    @click="revealInFinder(file.path)"
                  >
                    <FolderSearch :size="13" />
                  </button>
                  <button
                    class="btn-row-action is-danger"
                    title="Видалити у Смітник"
                    @click="trashFile(file.path)"
                  >
                    <Trash2 :size="13" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer with bulk actions -->
      <div class="modal-footer large-files-footer">
        <div class="summary-text">
          <span>
            Знайдено: <strong>{{ filteredFiles.length }}</strong> файлів ({{
              formatBytes(totalFilteredBytes)
            }})
          </span>
          <span v-if="selectedPaths.size > 0" class="selected-summary">
            | Виділено: <strong>{{ selectedPaths.size }}</strong> ({{
              formatBytes(selectedBytes)
            }})
          </span>
        </div>
        <div class="footer-actions">
          <button class="btn-secondary" @click="$emit('close')">
            Закрити (Esc)
          </button>
          <button
            v-if="selectedPaths.size > 0"
            class="btn-danger"
            :disabled="cleaning"
            @click="trashSelected"
          >
            <Trash2 :size="14" />
            <span>{{
              cleaning ? "Очищення..." : `У Смітник (${selectedPaths.size})`
            }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { DiskAnalysisFile } from "@/types";
import { formatBytes } from "@/utils/formatters";
import {
  PieChart,
  X,
  RotateCw,
  Loader2,
  File,
  FolderSearch,
  Trash2,
  CheckCircle2,
} from "lucide-vue-next";

const props = defineProps<{
  initialDir: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "refreshed"): void;
}>();

const scanning = ref(true);
const cleaning = ref(false);
const files = ref<DiskAnalysisFile[]>([]);
const selectedPaths = ref<Set<string>>(new Set());
let lastClickedIndex = -1;

const thresholds = [
  { label: "> 50 MB", bytes: 50 * 1024 * 1024 },
  { label: "> 100 MB", bytes: 100 * 1024 * 1024 },
  { label: "> 500 MB", bytes: 500 * 1024 * 1024 },
  { label: "> 1 GB", bytes: 1024 * 1024 * 1024 },
  { label: "> 2 GB", bytes: 2 * 1024 * 1024 * 1024 },
  { label: "Всі файли", bytes: 0 },
];
const activeThreshold = ref<number>(50 * 1024 * 1024);

const filteredFiles = computed(() => {
  return files.value.filter((f) => f.size >= activeThreshold.value);
});

const totalFilteredBytes = computed(() => {
  return filteredFiles.value.reduce((acc, f) => acc + f.size, 0);
});

const selectedBytes = computed(() => {
  return filteredFiles.value
    .filter((f) => selectedPaths.value.has(f.path))
    .reduce((acc, f) => acc + f.size, 0);
});

const isAllSelected = computed(() => {
  return (
    filteredFiles.value.length > 0 &&
    filteredFiles.value.every((f) => selectedPaths.value.has(f.path))
  );
});

function isSelected(path: string): boolean {
  return selectedPaths.value.has(path);
}

function getDirName(filePath: string): string {
  const parts = filePath.split("/");
  parts.pop();
  return parts.slice(-2).join("/");
}

function toggleSelect(path: string, index?: number) {
  const next = new Set(selectedPaths.value);
  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }
  selectedPaths.value = next;
  if (index !== undefined) {
    lastClickedIndex = index;
  }
}

function handleRowClick(e: MouseEvent, path: string, index: number) {
  if (e.shiftKey && lastClickedIndex !== -1) {
    const start = Math.min(lastClickedIndex, index);
    const end = Math.max(lastClickedIndex, index);
    const next = new Set(selectedPaths.value);
    for (let i = start; i <= end; i++) {
      if (filteredFiles.value[i]) {
        next.add(filteredFiles.value[i].path);
      }
    }
    selectedPaths.value = next;
  } else {
    toggleSelect(path, index);
  }
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedPaths.value = new Set();
  } else {
    const next = new Set<string>();
    filteredFiles.value.forEach((f) => next.add(f.path));
    selectedPaths.value = next;
  }
}

async function runScan() {
  scanning.value = true;
  selectedPaths.value = new Set();
  lastClickedIndex = -1;
  try {
    const res = await window.electronAPI.analyzeDisk(props.initialDir, 200);
    if (res.success && res.data) {
      files.value = res.data.largestFiles || [];
    }
  } catch {}
  scanning.value = false;
}

async function revealInFinder(filePath: string) {
  await window.electronAPI.showInFolder(filePath);
}

async function trashFile(filePath: string) {
  cleaning.value = true;
  await window.electronAPI.deletePaths([filePath], true);
  files.value = files.value.filter((f) => f.path !== filePath);
  const next = new Set(selectedPaths.value);
  next.delete(filePath);
  selectedPaths.value = next;
  cleaning.value = false;
  emit("refreshed");
}

async function trashSelected() {
  if (selectedPaths.value.size === 0) return;
  cleaning.value = true;
  const paths = Array.from(selectedPaths.value);
  await window.electronAPI.deletePaths(paths, true);
  files.value = files.value.filter((f) => !selectedPaths.value.has(f.path));
  selectedPaths.value = new Set();
  cleaning.value = false;
  emit("refreshed");
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    emit("close");
  } else if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A")) {
    e.preventDefault();
    toggleSelectAll();
  }
}

onMounted(() => {
  runScan();
  window.addEventListener("keydown", onKey);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
});
</script>
