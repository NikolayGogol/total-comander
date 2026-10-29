<template>
  <div class="modal-overlay" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <div class="large-files-modal" tabindex="0" @keydown="handleModalKeyDown">
      <!-- Header -->
      <div class="large-files-header">
        <div class="large-files-title-box">
          <PieChart :size="18" class="modal-icon" />
          <div>
            <div class="modal-title-text">Аналізатор диска — Пошук великих файлів</div>
            <div class="modal-subtitle">Швидкий пошук файлів гігантського розміру для звільнення місця на диску</div>
          </div>
        </div>
        <button class="modal-close-btn" title="Закрити (Esc)" @click="$emit('close')">
          <X :size="16" />
        </button>
      </div>

      <!-- Body / Filter Controls -->
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
                placeholder="C:\ або вибрана папка" 
                @keydown.enter="startScan"
              />
              <div class="quick-drives-chips">
                <button 
                  v-for="d in drives" 
                  :key="d.path"
                  class="chip-btn"
                  :class="{ 'is-selected': targetDir === d.path }"
                  @click="targetDir = d.path"
                >
                  {{ d.name }}
                </button>
                <button 
                  v-if="initialDir"
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
                class="chip-btn" 
                :class="{ 'is-selected': sizePresetMb === 10 }" 
                @click="setPreset(10)"
              >
                &gt; 10 MB
              </button>
              <button 
                class="chip-btn" 
                :class="{ 'is-selected': sizePresetMb === 25 }" 
                @click="setPreset(25)"
              >
                &gt; 25 MB
              </button>
              <button 
                class="chip-btn" 
                :class="{ 'is-selected': sizePresetMb === 50 }" 
                @click="setPreset(50)"
              >
                &gt; 50 MB
              </button>
              <button 
                class="chip-btn" 
                :class="{ 'is-selected': sizePresetMb === 100 }" 
                @click="setPreset(100)"
              >
                &gt; 100 MB
              </button>
              <button 
                class="chip-btn" 
                :class="{ 'is-selected': sizePresetMb === 500 }" 
                @click="setPreset(500)"
              >
                &gt; 500 MB
              </button>
              <button 
                class="chip-btn" 
                :class="{ 'is-selected': sizePresetMb === 1024 }" 
                @click="setPreset(1024)"
              >
                &gt; 1 GB
              </button>
              <button 
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

            <!-- Scan Button -->
            <div class="scan-action-box">
              <button 
                type="button" 
                class="btn-folder-analysis" 
                title="Відкрити структуру папок із точним розрахунком зайнятого місця"
                @click="openFolderAnalysis"
              >
                <FolderArchive :size="13" />
                <span>Аналіз папок диска</span>
              </button>
              <button 
                class="btn-scan-primary" 
                :disabled="isScanning || !targetDir" 
                @click="startScan"
              >
                <Loader2 v-if="isScanning" :size="14" class="spinning-icon" />
                <Search v-else :size="14" />
                <span>{{ isScanning ? 'Сканування...' : 'Почати пошук' }}</span>
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
            <strong>{{ selectedPaths.size }} ({{ formatBytes(selectedTotalSize) }})</strong>
          </div>
        </div>

        <!-- Table of Large Files -->
        <div class="large-files-table-container">
          <table class="large-files-table">
            <thead>
              <tr>
                <th class="th-chk" @click="toggleSelectAll">
                  <input 
                    type="checkbox" 
                    :checked="foundFiles.length > 0 && selectedPaths.size === foundFiles.length" 
                    :indeterminate="selectedPaths.size > 0 && selectedPaths.size < foundFiles.length" 
                    @click.stop="toggleSelectAll"
                  />
                </th>
                <th class="th-name" @click="changeSort('name')">
                  Назва {{ sortField === 'name' ? (sortAsc ? '▲' : '▼') : '' }}
                </th>
                <th class="th-ext" @click="changeSort('extension')">
                  Тип {{ sortField === 'extension' ? (sortAsc ? '▲' : '▼') : '' }}
                </th>
                <th class="th-size" @click="changeSort('size')">
                  Розмір {{ sortField === 'size' ? (sortAsc ? '▲' : '▼') : '' }}
                </th>
                <th class="th-date" @click="changeSort('mtime')">
                  Дата зміни {{ sortField === 'mtime' ? (sortAsc ? '▲' : '▼') : '' }}
                </th>
                <th class="th-path" @click="changeSort('dir')">
                  Розташування
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="foundFiles.length === 0 && !isScanning" class="empty-row">
                <td colspan="6" class="empty-state-cell">
                  {{ hasScanned ? 'Великих файлів за заданими критеріями не знайдено.' : 'Натисніть "Почати пошук" для сканування диску на великі файли.' }}
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
                :class="{ 'is-selected': selectedPaths.has(file.path) }"
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
                    <component :is="getFileIcon(file.extension)" :size="14" class="item-icon" />
                    <span class="file-name-text">{{ file.name }}</span>
                  </div>
                </td>
                <td class="td-ext">
                  <span class="ext-badge">{{ file.extension ? file.extension.toUpperCase() : '—' }}</span>
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
            class="btn-danger-action" 
            :disabled="selectedPaths.size === 0" 
            title="Перемістити вибрані файли у Кошик Windows (Delete)"
            @click="deleteSelected(true)"
          >
            <Trash2 :size="14" />
            <span>У Кошик ({{ selectedPaths.size }})</span>
          </button>

          <button 
            class="btn-secondary-action" 
            :disabled="selectedPaths.size === 0" 
            title="Безповоротно видалити з диску (Shift+Delete)"
            @click="deleteSelected(false)"
          >
            <span>Безповоротно</span>
          </button>
        </div>

        <div class="large-files-actions-right">
          <button 
            class="btn-secondary-action" 
            :disabled="!focusedFile" 
            title="Показати вибраний файл у Провіднику Windows"
            @click="showInExplorer"
          >
            <ExternalLink :size="14" />
            <span>У Провіднику</span>
          </button>

          <button 
            class="btn-success-action" 
            :disabled="!focusedFile" 
            title="Перейти до файлу у двопанельному режимі Total Commander (Enter)"
            @click="jumpToFocusedFile"
          >
            <FolderOpen :size="14" />
            <span>Перейти до файлу (Enter)</span>
          </button>

          <button class="btn-secondary-action" @click="$emit('close')">
            Закрити (Esc)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { DriveItem, LargeFileItem } from '../types'
import { formatBytes, formatDate } from '../utils/formatters'
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
} from 'lucide-vue-next'

const props = defineProps<{
  initialDir: string
  drives: DriveItem[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'jump-to', filePath: string): void
  (e: 'toast', message: string, type: 'info' | 'success' | 'error'): void
  (e: 'open-folder-size', path: string): void
}>()

const targetDir = ref(props.initialDir || 'C:\\')
const sizePresetMb = ref(100)
const customSizeMb = ref<number | null>(null)
const isScanning = ref(false)
const hasScanned = ref(false)
const foundFiles = ref<LargeFileItem[]>([])
const selectedPaths = ref<Set<string>>(new Set())

const sortField = ref<'size' | 'name' | 'mtime' | 'extension' | 'dir'>('size')
const sortAsc = ref(false)

const lastSelectedPath = ref<string | null>(null)

const focusedFile = computed<LargeFileItem | null>(() => {
  if (lastSelectedPath.value) {
    const f = foundFiles.value.find((x) => x.path === lastSelectedPath.value)
    if (f) return f
  }
  if (selectedPaths.value.size > 0) {
    const first = Array.from(selectedPaths.value)[0]
    return foundFiles.value.find((x) => x.path === first) || null
  }
  return foundFiles.value[0] || null
})

const totalSizeFound = computed(() => {
  return foundFiles.value.reduce((acc, f) => acc + f.size, 0)
})

const selectedTotalSize = computed(() => {
  return foundFiles.value
    .filter((f) => selectedPaths.value.has(f.path))
    .reduce((acc, f) => acc + f.size, 0)
})

const sortedFiles = computed(() => {
  const list = [...foundFiles.value]
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

function openFolderAnalysis() {
  emit('open-folder-size', targetDir.value)
  emit('close')
}

function setPreset(mb: number) {
  sizePresetMb.value = mb
  customSizeMb.value = null
}

function changeSort(field: 'size' | 'name' | 'mtime' | 'extension' | 'dir') {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value
  } else {
    sortField.value = field
    sortAsc.value = field !== 'size'
  }
}

function getEffectiveMinSizeBytes(): number {
  if (customSizeMb.value && customSizeMb.value > 0) {
    return customSizeMb.value * 1024 * 1024
  }
  return sizePresetMb.value * 1024 * 1024
}

async function startScan() {
  if (isScanning.value || !targetDir.value) return
  isScanning.value = true
  hasScanned.value = true
  selectedPaths.value.clear()
  lastSelectedPath.value = null

  try {
    const res = await window.electronAPI.findLargeFiles({
      targetDir: targetDir.value,
      minSizeBytes: getEffectiveMinSizeBytes(),
      limit: 300,
    })

    if (res.success && res.files) {
      foundFiles.value = res.files
      emit('toast', `Знайдено ${res.files.length} великих файлів`, 'info')
    } else {
      emit('toast', res.error || 'Помилка сканування', 'error')
    }
  } catch (err: any) {
    emit('toast', err.message || 'Помилка сканування', 'error')
  } finally {
    isScanning.value = false
  }
}

function toggleSelectAll() {
  if (selectedPaths.value.size === foundFiles.value.length) {
    selectedPaths.value.clear()
  } else {
    selectedPaths.value = new Set(foundFiles.value.map((f) => f.path))
  }
}

function toggleFileSelection(path: string, e?: MouseEvent) {
  lastSelectedPath.value = path
  if (selectedPaths.value.has(path)) {
    selectedPaths.value.delete(path)
  } else {
    if (!e || (!e.ctrlKey && !e.metaKey && !e.shiftKey)) {
      // Single select on normal click
      selectedPaths.value.clear()
    }
    selectedPaths.value.add(path)
  }
}

function jumpToFile(file: LargeFileItem) {
  emit('jump-to', file.path)
  emit('close')
}

function jumpToFocusedFile() {
  if (focusedFile.value) {
    jumpToFile(focusedFile.value)
  }
}

async function showInExplorer() {
  if (!focusedFile.value) return
  await window.electronAPI.showInFolder(focusedFile.value.path)
}

async function deleteSelected(moveToTrash = true) {
  const paths = Array.from(selectedPaths.value)
  if (paths.length === 0) return

  const confirmMsg = moveToTrash
    ? `Перемістити ${paths.length} файл(ів) у Кошик Windows?`
    : `УВАГА! Безповоротно видалити ${paths.length} файл(ів) без можливості відновлення з Кошика?`

  if (!confirm(confirmMsg)) return

  const res = await window.electronAPI.deletePaths(paths, moveToTrash)
  if (res.success) {
    const deletedCount = paths.length
    foundFiles.value = foundFiles.value.filter((f) => !selectedPaths.value.has(f.path))
    selectedPaths.value.clear()
    lastSelectedPath.value = null
    emit('toast', `Успішно видалено ${deletedCount} файл(ів). Місце звільнено!`, 'success')
  } else {
    emit('toast', res.error || 'Не вдалося видалити файли', 'error')
  }
}

function getFileIcon(ext: string) {
  const e = (ext || '').toLowerCase()
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv'].includes(e)) return Film
  if (['zip', '7z', 'rar', 'tar', 'gz', 'iso', 'img', 'vhdx'].includes(e)) return Archive
  if (['ts', 'js', 'py', 'c', 'cpp', 'html', 'css'].includes(e)) return FileCode
  if (['txt', 'log', 'pdf', 'doc', 'docx'].includes(e)) return FileText
  return File
}

function getSizeClass(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return 'badge-size-gigantic'
  if (bytes >= 500 * 1024 * 1024) return 'badge-size-huge'
  return 'badge-size-large'
}

function handleModalKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  } else if (e.key === 'Enter') {
    if (focusedFile.value) {
      jumpToFocusedFile()
    } else {
      startScan()
    }
  } else if (e.key === 'Delete') {
    deleteSelected(!e.shiftKey)
  }
}

onMounted(() => {
  startScan()
})
</script>
