<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card folder-size-card">
      <div class="modal-header">
        <div class="modal-title">
          <HardDrive
            :size="16"
            class="icon-blue"
            title="Folder Size Breakdown"
          />
          <span>Аналіз розміру папки: {{ folderName }}</span>
        </div>
        <button
          class="modal-close-btn"
          title="Закрити (Esc)"
          @click="$emit('close')"
        >
          <X :size="15" />
        </button>
      </div>

      <div class="modal-body folder-size-body">
        <div class="folder-size-toolbar">
          <div class="path-display" :title="folderPath">
            <span class="path-label">Шлях:</span>
            <code>{{ folderPath }}</code>
          </div>
          <button
            class="btn-rescan"
            :disabled="loading"
            title="Оновити підрахунок"
            @click="fetchData"
          >
            <RotateCw :size="13" :class="{ spin: loading }" />
            <span>Оновити</span>
          </button>
        </div>

        <div v-if="loading" class="folder-size-loading">
          <Loader2 :size="24" class="spin icon-blue" />
          <span>Підрахунок розмірів підпапок...</span>
        </div>

        <div v-else-if="error" class="folder-size-error">
          <AlertCircle :size="20" class="icon-rose" />
          <span>{{ error }}</span>
        </div>

        <div v-else class="folder-size-content">
          <!-- Summary Header -->
          <div class="folder-summary-bar">
            <div class="summary-pill">
              <span class="pill-title">Загальний розмір:</span>
              <span class="pill-value text-accent">{{
                formatBytes(data?.totalSize)
              }}</span>
            </div>
            <div class="summary-pill">
              <span class="pill-title">Всього файлів:</span>
              <span class="pill-value">{{ data?.totalFiles || 0 }}</span>
            </div>
            <div class="summary-pill">
              <span class="pill-title">Підпапок:</span>
              <span class="pill-value">{{ data?.subfolders.length || 0 }}</span>
            </div>
          </div>

          <!-- Subfolders List -->
          <div class="subfolders-list-wrapper">
            <table class="subfolders-table">
              <thead>
                <tr>
                  <th class="col-name">Папка</th>
                  <th class="col-share">Частка</th>
                  <th class="col-size">Розмір</th>
                  <th class="col-count">Файлів</th>
                  <th class="col-action">Дія</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="sub in data?.subfolders"
                  :key="sub.path"
                  class="subfolder-row"
                  @dblclick="navigateTo(sub.path)"
                >
                  <td class="col-name">
                    <Folder :size="14" class="item-icon icon-folder" />
                    <span class="subfolder-name" :title="sub.path">{{
                      sub.name
                    }}</span>
                  </td>
                  <td class="col-share">
                    <div class="share-bar-container">
                      <div
                        class="share-bar-fill"
                        :ref="
                          (el) => setBarWidth(el as HTMLElement, sub.percentage)
                        "
                      />
                      <span class="share-percent">{{ sub.percentage }}%</span>
                    </div>
                  </td>
                  <td class="col-size">
                    <span class="subfolder-size">{{
                      formatBytes(sub.size)
                    }}</span>
                  </td>
                  <td class="col-count">
                    <span>{{ sub.count }}</span>
                  </td>
                  <td class="col-action">
                    <button
                      class="btn-open-folder"
                      title="Перейти у цю папку"
                      @click="navigateTo(sub.path)"
                    >
                      <span>Відкрити</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('close')">
          Закрити (Esc)
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { FolderSizeBreakdown } from "@/types";
import { formatBytes } from "@/utils/formatters";
import {
  HardDrive,
  X,
  RotateCw,
  Loader2,
  AlertCircle,
  Folder,
} from "lucide-vue-next";

const props = defineProps<{
  folderPath: string;
}>();

const emit = defineEmits<{
  (e: "navigate", path: string): void;
  (e: "close"): void;
}>();

const folderName = computed(
  () => props.folderPath.split("/").filter(Boolean).pop() || "Папка",
);
const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<FolderSizeBreakdown | null>(null);

function setBarWidth(el: HTMLElement | null, pct: number) {
  if (el) {
    el.style.setProperty("--bar-width", `${Math.max(2, Math.min(100, pct))}%`);
  }
}

async function fetchData() {
  loading.value = true;
  error.value = null;
  try {
    const res = await window.electronAPI.getFolderSizeBreakdown(
      props.folderPath,
    );
    if (res.success && res.data) {
      data.value = res.data;
    } else {
      error.value = res.error || "Не вдалося розрахувати розмір папки";
    }
  } catch (err: any) {
    error.value = err.message || "Помилка";
  } finally {
    loading.value = false;
  }
}

function navigateTo(path: string) {
  emit("navigate", path);
  emit("close");
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    emit("close");
  }
}

onMounted(() => {
  fetchData();
  window.addEventListener("keydown", onKey);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
});
</script>
