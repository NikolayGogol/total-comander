<template>
  <div class="modal-overlay" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <div class="folder-size-modal" tabindex="0" @keydown="handleKeyDown">
      <!-- Header -->
      <div class="folder-size-header">
        <div class="folder-size-title-box">
          <FolderArchive :size="18" class="modal-icon" />
          <div>
            <div class="modal-title-text">Аналіз розміру папок</div>
            <div class="modal-path-text" :title="targetPath">{{ targetPath }}</div>
          </div>
        </div>
        <button class="modal-close-btn" title="Закрити (Esc)" @click="$emit('close')">
          <X :size="16" />
        </button>
      </div>

      <!-- Body -->
      <div class="folder-size-body">
        <div class="folder-size-toolbar">
          <input
            v-model="filterQuery"
            type="text"
            class="folder-filter-input"
            placeholder="Швидкий фільтр папок за назвою..."
            @keydown.enter="jumpToSelected"
          />
          <button class="btn-refresh" :disabled="isLoading" @click="loadData">
            <Loader2 v-if="isLoading" :size="13" class="spinning-icon" />
            <RotateCw v-else :size="13" />
            <span>Перерахувати</span>
          </button>
        </div>

        <!-- Table of Folders -->
        <div class="folder-size-table-container">
          <table class="folder-size-table">
            <thead>
              <tr>
                <th class="th-name" @click="changeSort('name')">
                  Папка {{ sortField === 'name' ? (sortAsc ? '▲' : '▼') : '' }}
                </th>
                <th class="th-percent" @click="changeSort('size')">
                  Частка {{ sortField === 'size' ? (sortAsc ? '▲' : '▼') : '' }}
                </th>
                <th class="th-count" @click="changeSort('fileCount')">
                  Файлів {{ sortField === 'fileCount' ? (sortAsc ? '▲' : '▼') : '' }}
                </th>
                <th class="th-size" @click="changeSort('size')">
                  Розмір {{ sortField === 'size' ? (sortAsc ? '▲' : '▼') : '' }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="isLoading" class="empty-row">
                <td colspan="4" class="empty-state-cell">
                  <Loader2 :size="20" class="spinning-icon" />
                  <div>Триває розрахунок розміру папок... Зачекайте будь ласка.</div>
                </td>
              </tr>

              <tr v-else-if="filteredFolders.length === 0" class="empty-row">
                <td colspan="4" class="empty-state-cell">
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
                    <Folder :size="14" class="item-icon" />
                    <span class="folder-name-text">{{ folder.name }}</span>
                  </div>
                </td>
                <td class="td-percent">
                  <div class="percent-bar-wrapper">
                    <progress class="folder-progress-bar" :value="folder.size" :max="totalSize || 1"></progress>
                    <span class="percent-label">{{ getPercentLabel(folder.size) }}</span>
                  </div>
                </td>
                <td class="td-count">{{ formatNumber(folder.fileCount) }}</td>
                <td class="td-size">{{ formatBytes(folder.size) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer: Total Size at Bottom -->
      <div class="folder-size-footer">
        <div class="folder-size-total-box">
          <span class="total-label">Загальний розмір:</span>
          <span class="total-size-value">{{ formatBytes(totalSize) }}</span>
          <span class="total-stats-text">
            (Папок: <strong>{{ folders.length }}</strong
            >, Файлів: <strong>{{ formatNumber(totalFiles) }}</strong
            >)
          </span>
        </div>

        <div class="folder-size-actions">
          <button
            class="btn-secondary-action"
            :disabled="!selectedPath"
            title="Показати у Провіднику Windows"
            @click="showInExplorer"
          >
            <ExternalLink :size="14" />
            <span>У Провіднику</span>
          </button>

          <button
            class="btn-success-action"
            :disabled="!selectedPath"
            title="Відкрити папку у Total Commander (Enter)"
            @click="jumpToSelected"
          >
            <FolderOpen :size="14" />
            <span>Відкрити (Enter)</span>
          </button>

          <button class="btn-secondary-action" @click="$emit('close')">Закрити (Esc)</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { FolderSizeItem } from '@/types'
import { formatBytes, formatNumber } from '@/utils/formatters'
import { FolderArchive, Folder, FolderOpen, X, RotateCw, Loader2, ExternalLink } from 'lucide-vue-next'

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

const sortField = ref<'size' | 'name' | 'fileCount'>('size')
const sortAsc = ref(false)

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

async function loadData() {
  if (!props.targetPath) return
  isLoading.value = true
  selectedPath.value = null

  try {
    const res = await window.electronAPI.analyzeFolderSizes(props.targetPath)
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
    emit('toast', err.message || 'Помилка аналізу папок', 'error')
  } finally {
    isLoading.value = false
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
  }
}

onMounted(() => {
  loadData()
})
</script>
