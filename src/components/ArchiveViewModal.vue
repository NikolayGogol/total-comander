<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card archive-view-card">
      <div class="modal-header">
        <div class="modal-title">
          <Archive :size="16" class="icon-amber" title="Archive View" />
          <span>Переглядач архіву: {{ archiveName }}</span>
        </div>
        <button
          class="modal-close-btn"
          title="Закрити (Esc)"
          @click="$emit('close')"
        >
          <X :size="15" />
        </button>
      </div>

      <div class="modal-body archive-view-body">
        <div class="archive-toolbar">
          <div class="archive-info-stats">
            <span class="stat-badge"
              >Елементів: <strong>{{ entries.length }}</strong></span
            >
            <span class="stat-badge"
              >Розмір: <strong>{{ formatBytes(totalBytes) }}</strong></span
            >
          </div>
          <div class="archive-filter-wrapper">
            <input
              v-model="filterText"
              type="text"
              class="form-input search-mini-input"
              placeholder="Фільтр файлів..."
            />
          </div>
        </div>

        <div v-if="loading" class="archive-loading-state">
          <Loader2 :size="24" class="spin icon-blue" />
          <span>Зчитування вмісту архіву...</span>
        </div>

        <div v-else-if="error" class="archive-error-state">
          <AlertCircle :size="20" class="icon-rose" />
          <span>{{ error }}</span>
        </div>

        <div v-else class="archive-table-container">
          <table class="archive-table">
            <thead>
              <tr>
                <th class="col-check">
                  <input
                    type="checkbox"
                    :checked="isAllSelected"
                    @change="toggleSelectAll"
                  />
                </th>
                <th class="col-name">Назва та шлях</th>
                <th class="col-size">Розмір</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in filteredEntries"
                :key="entry.name"
                class="archive-row"
                :class="{ 'is-selected': selectedNames.has(entry.name) }"
                @click="toggleSelect(entry.name)"
              >
                <td class="col-check" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedNames.has(entry.name)"
                    @change="toggleSelect(entry.name)"
                  />
                </td>
                <td class="col-name">
                  <component
                    :is="entry.isDirectory ? Folder : File"
                    :size="14"
                    class="item-icon"
                  />
                  <span class="archive-entry-name">{{ entry.name }}</span>
                </td>
                <td class="col-size">
                  <span v-if="entry.isDirectory" class="dir-badge"
                    >&lt;DIR&gt;</span
                  >
                  <span v-else>{{ formatBytes(entry.size) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-footer archive-footer">
        <button class="btn-secondary" @click="$emit('close')">
          Закрити (Esc)
        </button>
        <div class="footer-actions">
          <button
            v-if="selectedNames.size > 0"
            class="btn-secondary"
            :disabled="extracting"
            @click="extractSelected"
          >
            <FolderArchive :size="14" />
            <span>Витягти вибране ({{ selectedNames.size }})</span>
          </button>
          <button
            class="btn-primary"
            :disabled="extracting || entries.length === 0"
            @click="extractAll"
          >
            <ArchiveRestore :size="14" />
            <span>{{
              extracting ? "Розпакування..." : "Розархівувати все"
            }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { ArchiveEntry } from "@/types";
import { formatBytes } from "@/utils/formatters";
import {
  Archive,
  X,
  Folder,
  File,
  Loader2,
  AlertCircle,
  ArchiveRestore,
  FolderArchive,
} from "lucide-vue-next";

const props = defineProps<{
  archivePath: string;
  destinationDir: string;
}>();

const emit = defineEmits<{
  (
    e: "extract",
    payload: {
      archivePath: string;
      targetDir: string;
      selectedFiles?: string[];
    },
  ): void;
  (e: "close"): void;
}>();

const archiveName = computed(
  () => props.archivePath.split("/").filter(Boolean).pop() || "archive",
);
const entries = ref<ArchiveEntry[]>([]);
const selectedNames = ref<Set<string>>(new Set());
const filterText = ref("");
const loading = ref(true);
const extracting = ref(false);
const error = ref<string | null>(null);

const totalBytes = computed(() =>
  entries.value.reduce((acc, curr) => acc + (curr.size || 0), 0),
);
const filteredEntries = computed(() => {
  const q = filterText.value.toLowerCase().trim();
  if (!q) return entries.value;
  return entries.value.filter((e) => e.name.toLowerCase().includes(q));
});

const isAllSelected = computed(() => {
  return (
    filteredEntries.value.length > 0 &&
    filteredEntries.value.every((e) => selectedNames.value.has(e.name))
  );
});

function toggleSelect(name: string) {
  if (selectedNames.value.has(name)) selectedNames.value.delete(name);
  else selectedNames.value.add(name);
}

function toggleSelectAll() {
  if (isAllSelected.value) selectedNames.value.clear();
  else filteredEntries.value.forEach((e) => selectedNames.value.add(e.name));
}

function extractAll() {
  extracting.value = true;
  emit("extract", {
    archivePath: props.archivePath,
    targetDir: props.destinationDir,
  });
}

function extractSelected() {
  if (selectedNames.value.size === 0) return;
  extracting.value = true;
  emit("extract", {
    archivePath: props.archivePath,
    targetDir: props.destinationDir,
    selectedFiles: Array.from(selectedNames.value),
  });
}

function handleKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    emit("close");
  }
}

onMounted(async () => {
  window.addEventListener("keydown", handleKey);
  try {
    const res = await window.electronAPI.listArchive(props.archivePath);
    if (res.success && res.entries) {
      entries.value = res.entries;
    } else {
      error.value = res.error || "Не вдалося прочитати вміст архіву";
    }
  } catch (err: any) {
    error.value = err.message || "Помилка";
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKey);
});
</script>
