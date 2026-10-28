<template>
  <div 
    class="file-table-wrapper" 
    :class="{ 'is-drag-over': isDragOverTable }"
    ref="wrapperRef"
    tabindex="0"
    @keydown="handleKeyDown"
    @dragover.prevent="onTableDragOver"
    @dragleave="isDragOverTable = false"
    @drop.prevent="onTableDrop"
    @contextmenu.prevent="handleTableContextMenu($event)"
  >
    <table class="file-table">
      <thead>
        <tr>
          <th class="col-name" title="Сортувати за назвою (клік для перемикання A-Z / Z-A)" @click="$emit('sort', 'name')">
            Name <span v-if="sortField === 'name'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
          </th>
          <th class="col-ext" title="Сортувати за розширенням файлів" @click="$emit('sort', 'ext')">
            Ext <span v-if="sortField === 'ext'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
          </th>
          <th class="col-size" title="Сортувати за розміром файлів" @click="$emit('sort', 'size')">
            Size <span v-if="sortField === 'size'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
          </th>
          <th class="col-date" title="Сортувати за датою останньої модифікації" @click="$emit('sort', 'mtime')">
            Modified <span v-if="sortField === 'mtime'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <!-- Parent Directory (..) -->
        <tr 
          v-if="!isRootPath" 
          class="file-row is-parent"
          :class="{ 'is-cursor': cursorIndex === -1 }"
          title="⤴ Перейти у батьківську директорію (Backspace або подвійний клік)"
          @click="setCursor(-1)"
          @dblclick="$emit('go-up')"
          @contextmenu.prevent.stop="handleTableContextMenu($event)"
        >
          <td colspan="4">
            <div class="col-icon-name">
              <CornerLeftUp :size="15" class="parent-icon" title="Батьківська папка (..)" />
              <span class="parent-name">.. [Parent Directory]</span>
            </div>
          </td>
        </tr>

        <!-- File and Directory Rows -->
        <tr 
          v-for="(item, index) in items" 
          :key="item.path"
          class="file-row"
          :class="{
            'is-dir': item.isDirectory,
            'is-cursor': cursorIndex === index,
            'is-selected': isSelected(item.path),
            'is-hidden': item.isHidden,
            'is-drag-target': dragTargetItemPath === item.path
          }"
          :draggable="true"
          :title="getItemTooltip(item)"
          @dragstart="onDragStart($event, item)"
          @dragover.prevent.stop="onItemDragOver($event, item)"
          @dragleave.stop="onItemDragLeave(item)"
          @drop.prevent.stop="onItemDrop($event, item)"
          @click="handleRowClick($event, item, index)"
          @dblclick="handleRowDblClick(item)"
          @contextmenu.prevent.stop="handleRowContextMenu($event, item, index)"
        >
          <td class="col-name">
            <div class="col-icon-name">
              <component 
                :is="getIconComponent(item)" 
                :size="15" 
                :class="['item-icon', getIconModifier(item)]"
                :title="item.isDirectory ? 'Папка: ' + item.name : (item.extension ? item.extension.toUpperCase() + ' ' : '') + 'Файл: ' + item.name + ' (' + formatBytes(item.size) + ')'"
              />
              <span 
                class="item-name" 
                :class="{ 'name-dir': item.isDirectory }"
                :data-tooltip="getShortItemTooltip(item)"
                data-tooltip-pos="right"
                :title="item.path"
              >
                {{ item.name }}
              </span>
            </div>
          </td>
          <td class="col-ext" :title="item.isDirectory ? 'Папка' : (item.extension || 'Без розширення')">
            <span v-if="!item.isDirectory && item.extension" class="ext-badge" :class="'ext-' + getCategory(item)">
              {{ item.extension }}
            </span>
          </td>
          <td class="col-size" :title="item.isDirectory ? 'Папка' : formatNumber(item.size) + ' байт'">
            <span v-if="item.isDirectory" class="dir-badge">&lt;DIR&gt;</span>
            <span v-else class="file-size-text">{{ formatBytes(item.size) }}</span>
          </td>
          <td class="col-date" :title="'Дата зміни: ' + formatDate(item.mtime)">{{ formatDate(item.mtime) }}</td>
        </tr>

        <!-- Empty State -->
        <tr v-if="items.length === 0 && !loading">
          <td colspan="4" class="empty-state">
            <span v-if="filterText">No files matching "{{ filterText }}"</span>
            <span v-else>Directory is empty</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Loading Overlay -->
    <div v-if="loading" class="loading-overlay">
      <span>Loading...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { FileItem, SortField } from '../../types'
import { formatBytes, formatDate, formatNumber, getFileCategory, getFileTypeDescription } from '../../utils/formatters'
import { 
  Folder, 
  File, 
  Code, 
  Image, 
  Film, 
  Music, 
  FileText, 
  Archive, 
  CornerLeftUp 
} from 'lucide-vue-next'

const props = defineProps<{
  items: FileItem[]
  currentPath: string
  cursorIndex: number
  selectedPaths: Set<string>
  sortField: SortField
  sortOrder: 'asc' | 'desc'
  filterText: string
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'navigate', path: string): void
  (e: 'go-up'): void
  (e: 'open-native', item: FileItem): void
  (e: 'update-cursor', index: number): void
  (e: 'toggle-select', path: string): void
  (e: 'select-range', fromIndex: number, toIndex: number): void
  (e: 'sort', field: SortField): void
  (e: 'drop-items', sourcePaths: string[], targetDir: string): void
  (e: 'context-menu', payload: { x: number; y: number; item: FileItem | null }): void
}>()

const wrapperRef = ref<HTMLElement | null>(null)
const isDragOverTable = ref(false)
const dragTargetItemPath = ref<string | null>(null)

const isRootPath = computed(() => {
  const p = props.currentPath.trim()
  return !p || /^[a-zA-Z]:\\?$/.test(p) || p === '/' || p === '\\'
})

function isSelected(path: string): boolean {
  return props.selectedPaths.has(path)
}

function setCursor(idx: number) {
  emit('update-cursor', idx)
}

function handleRowClick(e: MouseEvent, item: FileItem, index: number) {
  if (e.shiftKey) {
    emit('select-range', props.cursorIndex >= 0 ? props.cursorIndex : 0, index)
  } else if (e.metaKey || e.ctrlKey) {
    emit('toggle-select', item.path)
    setCursor(index)
  } else {
    setCursor(index)
  }
}

function handleRowDblClick(item: FileItem) {
  if (item.isDirectory) {
    emit('navigate', item.path)
  } else {
    emit('open-native', item)
  }
}

function handleRowContextMenu(e: MouseEvent, item: FileItem, index: number) {
  if (!props.selectedPaths.has(item.path)) {
    props.selectedPaths.clear()
    props.selectedPaths.add(item.path)
    setCursor(index)
  }
  emit('context-menu', { x: e.clientX, y: e.clientY, item })
}

function handleTableContextMenu(e: MouseEvent) {
  emit('context-menu', { x: e.clientX, y: e.clientY, item: null })
}

// Keyboard navigation
function handleKeyDown(e: KeyboardEvent) {
  const len = props.items.length

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (props.cursorIndex < len - 1) {
      setCursor(props.cursorIndex + 1)
      scrollToCursor()
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const minCursor = isRootPath.value ? 0 : -1
    if (props.cursorIndex > minCursor) {
      setCursor(props.cursorIndex - 1)
      scrollToCursor()
    }
  } else if (e.key === 'Home') {
    e.preventDefault()
    const minCursor = isRootPath.value ? 0 : -1
    setCursor(minCursor)
    scrollToCursor()
  } else if (e.key === 'End') {
    e.preventDefault()
    if (len > 0) {
      setCursor(len - 1)
      scrollToCursor()
    }
  } else if (e.key === 'PageDown') {
    e.preventDefault()
    if (e.ctrlKey) {
      if (props.cursorIndex >= 0 && props.cursorIndex < len) {
        const item = props.items[props.cursorIndex]
        if (item.isDirectory) emit('navigate', item.path)
      }
    } else if (len > 0) {
      setCursor(Math.min(len - 1, props.cursorIndex + 14))
      scrollToCursor()
    }
  } else if (e.key === 'PageUp') {
    e.preventDefault()
    if (e.ctrlKey) {
      emit('go-up')
    } else {
      const minCursor = isRootPath.value ? 0 : -1
      setCursor(Math.max(minCursor, props.cursorIndex - 14))
      scrollToCursor()
    }
  } else if (e.key === ' ' || e.key === 'Insert') {
    e.preventDefault()
    if (props.cursorIndex >= 0 && props.cursorIndex < len) {
      const item = props.items[props.cursorIndex]
      emit('toggle-select', item.path)
      if (props.cursorIndex < len - 1) {
        setCursor(props.cursorIndex + 1)
        scrollToCursor()
      }
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (props.cursorIndex === -1) {
      emit('go-up')
    } else if (props.cursorIndex >= 0 && props.cursorIndex < len) {
      const item = props.items[props.cursorIndex]
      if (item.isDirectory) {
        emit('navigate', item.path)
      } else {
        emit('open-native', item)
      }
    }
  }
}

function scrollToCursor() {
  nextTick(() => {
    const el = wrapperRef.value?.querySelector('.is-cursor')
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  })
}

// Drag & Drop
function onDragStart(e: DragEvent, item: FileItem) {
  if (!e.dataTransfer) return
  let paths: string[] = []
  if (isSelected(item.path)) {
    paths = Array.from(props.selectedPaths)
  } else {
    paths = [item.path]
  }

  e.dataTransfer.setData('application/json', JSON.stringify(paths))
  e.dataTransfer.effectAllowed = 'copyMove'
}

function onTableDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('application/json')) {
    isDragOverTable.value = true
    e.dataTransfer.dropEffect = 'copy'
  }
}

function onTableDrop(e: DragEvent) {
  isDragOverTable.value = false
  dragTargetItemPath.value = null
  const data = e.dataTransfer?.getData('application/json')
  if (!data) return
  try {
    const sources: string[] = JSON.parse(data)
    emit('drop-items', sources, props.currentPath)
  } catch {}
}

function onItemDragOver(e: DragEvent, item: FileItem) {
  if (item.isDirectory && e.dataTransfer?.types.includes('application/json')) {
    dragTargetItemPath.value = item.path
    e.dataTransfer.dropEffect = 'copy'
  }
}

function onItemDragLeave(item: FileItem) {
  if (dragTargetItemPath.value === item.path) {
    dragTargetItemPath.value = null
  }
}

function onItemDrop(e: DragEvent, item: FileItem) {
  dragTargetItemPath.value = null
  isDragOverTable.value = false
  const data = e.dataTransfer?.getData('application/json')
  if (!data) return
  try {
    const sources: string[] = JSON.parse(data)
    const target = item.isDirectory ? item.path : props.currentPath
    emit('drop-items', sources, target)
  } catch {}
}

// Icons & Modifiers
function getCategory(item: FileItem) {
  return getFileCategory(item.extension || item.name, item.isDirectory).category
}

function getIconComponent(item: FileItem) {
  if (item.isDirectory) return Folder
  const cat = getCategory(item)
  switch (cat) {
    case 'code':
    case 'exe': return Code
    case 'image': return Image
    case 'video': return Film
    case 'audio': return Music
    case 'doc': return FileText
    case 'archive': return Archive
    default: return File
  }
}

function getIconModifier(item: FileItem): string {
  return getFileCategory(item.extension || item.name, item.isDirectory).classModifier
}

function getItemTooltip(item: FileItem): string {
  const parts = [
    item.name,
    item.isDirectory ? '[Папка]' : `[${getFileTypeDescription(item.extension || item.name, false)}]`,
    item.isDirectory ? '' : `Розмір: ${formatBytes(item.size)}`,
    `Змінено: ${formatDate(item.mtime)}`
  ]
  return parts.filter(Boolean).join(' • ')
}

function getShortItemTooltip(item: FileItem): string {
  return `${item.name} (${item.isDirectory ? 'Папка' : formatBytes(item.size)})`
}
</script>
