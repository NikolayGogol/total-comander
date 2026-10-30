<template>
  <div class="modal-overlay" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <div class="folder-size-modal" tabindex="0" @keydown="handleKeyDown">
      <!-- Header -->
      <div class="folder-size-header">
        <div class="folder-size-title-box">
          <HardDrive :size="18" class="modal-icon" />
          <div class="modal-title-text">Аналіз розміру папки: {{ folderName }}</div>
        </div>
        <button class="modal-close-btn" title="Закрити (Esc)" @click="$emit('close')">
          <X :size="16" />
        </button>
      </div>

      <!-- Body -->
      <div class="folder-size-body">
        <!-- Subbar: Path Pill & Refresh Button -->
        <div class="folder-size-subbar">
          <div class="subbar-left">
            <div class="path-pill" :title="targetPath">
              <span class="path-label">Шлях:</span>
              <span class="path-value">{{ targetPath }}</span>
            </div>
            <div v-if="isLoading" class="scanning-status-pill">
              <Loader2 :size="12" class="spinning-icon" />
              <span>
                {{
                  scanProgress.total > 0 ? `Сканування ${scanProgress.current}/${scanProgress.total}` : 'Сканування...'
                }}
              </span>
              <span v-if="scanProgress.folderName" class="scanning-name">({{ scanProgress.folderName }})</span>
            </div>
          </div>
          <button class="btn-refresh" :disabled="isLoading" title="Оновити дані" @click="loadData">
            <RotateCw :size="13" :class="{ 'spinning-icon': isLoading }" />
            <span>Оновити</span>
          </button>
        </div>

        <!-- 3 Summary Stats Cards -->
        <div class="folder-size-stats-grid">
          <div class="stat-card">
            <div class="stat-label">Загальний розмір:</div>
            <div class="stat-value text-accent">{{ formatBytes(totalSize) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Всього файлів:</div>
            <div class="stat-value">{{ formatNumber(totalFiles) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Підпапок:</div>
            <div class="stat-value">{{ folders.length }}</div>
          </div>
        </div>

        <!-- Quick Filter Input (Kept as requested) -->
        <div class="folder-filter-toolbar">
          <div class="search-input-wrapper">
            <Search :size="14" class="search-icon" />
            <input
              v-model="filterQuery"
              type="text"
              class="folder-filter-input"
              placeholder="Швидкий фільтр папок за назвою..."
              @keydown.enter="jumpToSelected"
            />
            <button v-if="filterQuery" class="clear-filter-btn" title="Очистити фільтр" @click="filterQuery = ''">
              <X :size="12" />
            </button>
          </div>
          <span v-if="filterQuery" class="filter-count-badge">
            Знайдено: {{ filteredFolders.length }} з {{ folders.length }}
          </span>
        </div>

        <!-- Table of Folders -->
        <div class="folder-size-table-container">
          <table class="folder-size-table">
            <thead>
              <tr>
                <th class="th-name" @click="changeSort('name')">
                  Папка {{ sortField === 'name' ? (sortAsc ? '▲' : '▼') : '' }}
                </th>
                <th class="th-share" @click="changeSort('size')">
                  Частка {{ sortField === 'size' ? (sortAsc ? '▲' : '▼') : '' }}
                </th>
                <th class="th-size" @click="changeSort('size')">
                  Розмір {{ sortField === 'size' ? (sortAsc ? '▲' : '▼') : '' }}
                </th>
                <th class="th-files" @click="changeSort('fileCount')">
                  Файлів {{ sortField === 'fileCount' ? (sortAsc ? '▲' : '▼') : '' }}
                </th>
                <th class="th-action">Дія</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="isLoading && folders.length === 0" class="empty-row">
                <td colspan="5" class="empty-state-cell">
                  <Loader2 :size="20" class="spinning-icon" />
                  <div>Триває розрахунок розміру папок... Зачекайте будь ласка.</div>
                </td>
              </tr>

              <tr v-else-if="filteredFolders.length === 0" class="empty-row">
                <td colspan="5" class="empty-state-cell">
                  {{ filterQuery ? 'Жодної папки не знайдено за фільтром.' : 'У цій папці немає підпапок.' }}
                </td>
              </tr>

              <tr
                v-for="folder in filteredFolders"
                :key="folder.path"
                class="folder-size-row"
                :class="{ 'is-selected': selectedPath === folder.path }"
                @click="selectedPath = folder.path"
                @dblclick="jumpToFolder(folder.path)"
              >
                <td class="td-name">
                  <div class="folder-name-cell" :title="folder.name + '\n' + folder.path">
                    <Folder :size="15" class="item-icon" />
                    <span class="folder-name-text">{{ folder.name }}</span>
                  </div>
                </td>
                <td class="td-share">
                  <div class="share-cell">
                    <progress class="folder-progress-bar" :value="folder.size" :max="totalSize || 1"></progress>
                    <span class="share-label">{{ getPercentLabel(folder.size) }}</span>
                  </div>
                </td>
                <td class="td-size">{{ formatBytes(folder.size) }}</td>
                <td class="td-files">{{ formatNumber(folder.fileCount) }}</td>
                <td class="td-action">
                  <button
                    class="btn-row-action"
                    title="Відкрити цю папку у Total Commander"
                    @click.stop="jumpToFolder(folder.path)"
                  >
                    Відкрити
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div class="folder-size-footer">
        <button class="btn-secondary" @click="$emit('close')">Закрити (Esc)</button>
        <button
          v-if="selectedPath"
          class="btn-secondary"
          title="Показати вибрану папку у Провіднику Windows"
          @click="showInExplorer"
        >
          <ExternalLink :size="13" />
          <span>У Провіднику</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { FolderSizeItem } from '@/types'
import { formatBytes, formatNumber } from '@/utils/formatters'
import { HardDrive, Folder, X, RotateCw, Loader2, Search, ExternalLink } from 'lucide-vue-next'

const props = defineProps<{
  targetPath: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'jump-to', path: string): void
  (e: 'toast', message: string, type: 'info' | 'success' | 'error'): void
}>()

const isLoading = ref(true)
const folders = ref<FolderSizeItem[]>([])
const totalSize = ref(0)
const totalFiles = ref(0)
const selectedPath = ref<string | null>(null)
const filterQuery = ref('')
const scanProgress = ref({
  current: 0,
  total: 0,
  folderName: '',
})
const currentScanId = ref('')
let unsubs: Array<() => void> = []

const sortField = ref<'size' | 'name' | 'fileCount'>('size')
const sortAsc = ref(false)

const folderName = computed(() => {
  if (!props.targetPath) return ''
  const clean = props.targetPath.replace(/[/\\]+$/, '')
  return clean.split(/[/\\]/).filter(Boolean).pop() || clean
})

const filteredFolders = computed(() => {
  let list = [...folders.value]
  if (filterQuery.value.trim()) {
    const q = filterQuery.value.trim().toLowerCase()
    list = list.filter((f) => f.name.toLowerCase().includes(q))
  }

  const field = sortField.value
  const asc = sortAsc.value

  list.sort((a, b) => {
    let valA = a[field]
    let valB = b[field]
    if (typeof valA === 'string') valA = (valA as string).toLowerCase()
    if (typeof valB === 'string') valB = (valB as string).toLowerCase()

    if (valA < valB) return asc ? -1 : 1
    if (valA > valB) return asc ? 1 : -1
    return 0
  })

  return list
})

function getPercentLabel(size: number): string {
  if (!totalSize.value || totalSize.value === 0) return '0%'
  const pct = Math.round((size / totalSize.value) * 100)
  return `${pct}%`
}

function changeSort(field: 'size' | 'name' | 'fileCount') {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value
  } else {
    sortField.value = field
    sortAsc.value = field !== 'size'
  }
}

function cancelCurrentScan() {
  if (currentScanId.value) {
    window.electronAPI.cancelAnalyzeFolderSizes(currentScanId.value).catch(() => {})
  }
}

async function loadData() {
  if (!props.targetPath) return

  cancelCurrentScan()

  const scanId = Math.random().toString(36).slice(2)
  currentScanId.value = scanId

  isLoading.value = true
  folders.value = []
  totalSize.value = 0
  totalFiles.value = 0
  selectedPath.value = null
  scanProgress.value = { current: 0, total: 0, folderName: '' }

  try {
    const res = await window.electronAPI.analyzeFolderSizes(props.targetPath, scanId)
    if (currentScanId.value !== scanId) return

    if (res.success && res.folders) {
      folders.value = res.folders
      totalSize.value = res.totalSize || 0
      totalFiles.value = res.totalFiles || 0
      if (res.folders.length > 0) {
        selectedPath.value = res.folders[0].path
      }
    } else {
      emit('toast', res.error || 'Не вдалося порахувати розмір папок', 'error')
    }
  } catch (err: any) {
    if (currentScanId.value === scanId) {
      emit('toast', err.message || 'Помилка аналізу папок', 'error')
    }
  } finally {
    if (currentScanId.value === scanId) {
      isLoading.value = false
    }
  }
}

function jumpToFolder(path: string) {
  emit('jump-to', path)
  emit('close')
}

function jumpToSelected() {
  if (selectedPath.value) {
    jumpToFolder(selectedPath.value)
  }
}

async function showInExplorer() {
  if (selectedPath.value) {
    await window.electronAPI.showInFolder(selectedPath.value)
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  } else if (e.key === 'Enter') {
    jumpToSelected()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    const list = filteredFolders.value
    if (list.length === 0) return
    const curIdx = list.findIndex((f) => f.path === selectedPath.value)
    const nextIdx = curIdx < list.length - 1 ? curIdx + 1 : 0
    selectedPath.value = list[nextIdx].path
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const list = filteredFolders.value
    if (list.length === 0) return
    const curIdx = list.findIndex((f) => f.path === selectedPath.value)
    const prevIdx = curIdx > 0 ? curIdx - 1 : list.length - 1
    selectedPath.value = list[prevIdx].path
  }
}

onMounted(() => {
  // Listen to real-time streaming items as each folder finishes scanning
  const unsubItem = window.electronAPI.onFolderSizeItem((data) => {
    if (data.scanId !== currentScanId.value) return

    const item = data.folder
    const exists = folders.value.some((f) => f.path === item.path)
    if (!exists) {
      folders.value.push(item)
      totalSize.value += item.size
      totalFiles.value += item.fileCount

      if (!selectedPath.value) {
        selectedPath.value = item.path
      }
    }
  })

  // Listen to real-time scanning progress updates
  const unsubProgress = window.electronAPI.onFolderSizeProgress((data) => {
    if (data.scanId !== currentScanId.value) return

    scanProgress.value = {
      current: data.current,
      total: data.total,
      folderName: data.folderName || '',
    }
    if (data.isDone) {
      isLoading.value = false
    }
  })

  unsubs.push(unsubItem, unsubProgress)

  loadData()
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  cancelCurrentScan()
  unsubs.forEach((fn) => fn())
  unsubs = []
  window.removeEventListener('keydown', handleKeyDown)
})
</script>
