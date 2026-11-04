<template>
  <div
    class="modal-overlay"
    @click.self="$emit('close')"
    @keydown.esc="$emit('close')"
  >
    <div class="virtual-disks-modal" tabindex="0" @keydown="handleKeyDown">
      <!-- Header -->
      <div class="modal-header">
        <div class="virtual-disks-title-box">
          <Disc :size="18" class="modal-icon" />
          <div class="modal-title-text">
            Активні віртуальні пристрої та образи
          </div>
          <span v-if="disks.length > 0" class="badge-count">
            {{ disks.length }}
          </span>
        </div>
        <button
          class="modal-close-btn"
          title="Закрити (Esc)"
          @click="$emit('close')"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Body -->
      <div class="virtual-disks-body">
        <!-- Toolbar -->
        <div class="virtual-disks-toolbar">
          <div class="toolbar-info">
            <span>
              Змонтовані диски у системі (Finder → Місця / /Volumes):
            </span>
          </div>
          <div class="toolbar-actions">
            <button
              class="btn-secondary"
              :disabled="loading"
              title="Оновити список (F5)"
              @click="loadDisks"
            >
              <RotateCw :size="13" :class="{ 'spin-icon': loading }" />
              <span>Оновити</span>
            </button>
            <button
              v-if="disks.length > 1"
              class="btn-danger-outline"
              :disabled="loading || ejectingAll"
              title="Вилучити всі віртуальні диски"
              @click="handleEjectAll"
            >
              <Loader2 v-if="ejectingAll" :size="13" class="spin-icon" />
              <CircleArrowUp v-else :size="13" />
              <span>Вилучити всі</span>
            </button>
          </div>
        </div>

        <!-- Disks List -->
        <div class="virtual-disks-list-container">
          <div v-if="loading && disks.length === 0" class="empty-state">
            <Loader2 :size="24" class="spin-icon" />
            <span>Пошук активних змонтованих образів...</span>
          </div>

          <div v-else-if="disks.length === 0" class="empty-state">
            <CheckCircle2 :size="28" class="icon-success" />
            <span class="empty-title">
              Жодного віртуального пристрою не змонтовано
            </span>
            <span class="empty-subtitle">
              Образи .dmg або .iso з'являться тут автоматично при відкритті
            </span>
          </div>

          <div v-else class="virtual-disks-cards">
            <div
              v-for="disk in disks"
              :key="disk.mountPoint || disk.devEntry"
              class="virtual-disk-card"
            >
              <div class="card-main-col">
                <div class="card-header-row">
                  <Disc :size="16" class="disk-icon" />
                  <span class="disk-name">{{ disk.name }}</span>
                  <span class="disk-badge-type">{{ disk.imageType }}</span>
                  <span v-if="disk.totalSpace > 0" class="disk-space-text">
                    {{ formatBytes(disk.totalSpace) }}
                  </span>
                </div>

                <div class="card-meta-row">
                  <div class="meta-item" :title="disk.mountPoint">
                    <span class="meta-label">Том:</span>
                    <span class="meta-value">{{ disk.mountPoint }}</span>
                  </div>
                  <div
                    v-if="disk.imagePath"
                    class="meta-item"
                    :title="disk.imagePath"
                  >
                    <span class="meta-label">Файл .dmg:</span>
                    <span class="meta-value mono">{{ disk.imagePath }}</span>
                  </div>
                </div>
              </div>

              <div class="card-actions-col">
                <button
                  class="btn-action-icon"
                  title="Перейти до папки змонтованого диску"
                  @click="handleNavigate(disk.mountPoint)"
                >
                  <FolderOpen :size="14" />
                  <span>Перейти</span>
                </button>

                <button
                  class="btn-action-icon"
                  title="Показати у macOS Finder"
                  @click="handleRevealFinder(disk.mountPoint)"
                >
                  <ExternalLink :size="14" />
                </button>

                <button
                  class="btn-action-eject"
                  :disabled="isDiskBusy(disk)"
                  title="Вилучити цей диск (Eject)"
                  @click="handleEject(disk)"
                >
                  <Loader2
                    v-if="busyDisks.has(disk.mountPoint)"
                    :size="13"
                    class="spin-icon"
                  />
                  <CircleArrowUp v-else :size="13" />
                  <span>Вилучити</span>
                </button>

                <button
                  v-if="disk.sourceExists && disk.imagePath"
                  class="btn-action-trash"
                  :disabled="isDiskBusy(disk)"
                  title="Вилучити образ та перемістити вихідний файл .dmg у Смітник macOS"
                  @click="handleDeleteSource(disk)"
                >
                  <Trash2 :size="13" />
                  <span>У Смітник</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <div class="footer-hint">
          <Info :size="13" />
          <span>
            При натисканні «У Смітник» диск безпечно вилучається, а файл .dmg
            переміщується у Trash.
          </span>
        </div>
        <div class="footer-actions">
          <button class="btn-secondary" @click="$emit('close')">
            Закрити (Esc)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { VirtualDiskInfo } from "@/types";
import { formatBytes } from "@/utils/formatters";
import {
  Disc,
  X,
  RotateCw,
  CircleArrowUp,
  FolderOpen,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Loader2,
  Info,
} from "lucide-vue-next";

const emit = defineEmits<{
  (e: "close"): void;
  (e: "navigate", path: string): void;
}>();

const disks = ref<VirtualDiskInfo[]>([]);
const loading = ref(false);
const ejectingAll = ref(false);
const busyDisks = ref<Set<string>>(new Set());

async function loadDisks() {
  loading.value = true;
  try {
    const res = await window.electronAPI.getVirtualDisks();
    if (res.success && res.data) {
      disks.value = res.data;
    }
  } catch {
    disks.value = [];
  } finally {
    loading.value = false;
  }
}

function isDiskBusy(disk: VirtualDiskInfo): boolean {
  return busyDisks.value.has(disk.mountPoint) || ejectingAll.value;
}

async function handleEject(disk: VirtualDiskInfo) {
  if (isDiskBusy(disk)) return;
  busyDisks.value.add(disk.mountPoint);
  try {
    await window.electronAPI.ejectVirtualDisk(disk.mountPoint || disk.devEntry);
    await loadDisks();
  } finally {
    busyDisks.value.delete(disk.mountPoint);
  }
}

async function handleEjectAll() {
  if (ejectingAll.value) return;
  ejectingAll.value = true;
  try {
    await window.electronAPI.ejectAllVirtualDisks();
    await loadDisks();
  } finally {
    ejectingAll.value = false;
  }
}

async function handleDeleteSource(disk: VirtualDiskInfo) {
  if (isDiskBusy(disk) || !disk.imagePath) return;
  busyDisks.value.add(disk.mountPoint);
  try {
    await window.electronAPI.deleteVirtualDiskSource({
      imagePath: disk.imagePath,
      mountPoint: disk.mountPoint,
    });
    await loadDisks();
  } finally {
    busyDisks.value.delete(disk.mountPoint);
  }
}

function handleNavigate(mountPoint: string) {
  emit("navigate", mountPoint);
  emit("close");
}

function handleRevealFinder(mountPoint: string) {
  window.electronAPI.showInFolder(mountPoint);
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    emit("close");
  } else if (e.key === "F5") {
    e.preventDefault();
    loadDisks();
  }
}

onMounted(() => {
  loadDisks();
});
</script>
