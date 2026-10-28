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
          <th class="col-perms" title="Права доступу UNIX (POSIX permissions)">Perms</th>
        </tr>
      </thead>
      <tbody>
        <!-- Parent Directory (..) -->
        <tr 
          v-if="currentPath !== '/'" 
          class="file-row is-parent"
          :class="{ 'is-cursor': cursorIndex === -1 }"
          title="⤴ Перейти у батьківську директорію (Backspace або подвійний клік)"
          @click="setCursor(-1)"
          @dblclick="$emit('go-up')"
        >
          <td colspan="5">
            <div class="col-icon-name">
              <CornerLeftUp :size="14" class="parent-icon" title="Батьківська папка (..)" />
              <span>.. [Parent Directory]</span>
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
        >
          <td class="col-name">
            <div class="col-icon-name">
              <component 
                :is="getIconComponent(item)" 
                :size="14" 
                :class="['item-icon', getIconModifier(item)]"
                :title="item.isDirectory ? 'Папка: ' + item.name : (item.extension ? item.extension.toUpperCase() + ' ' : '') + 'Файл: ' + item.name + ' (' + formatBytes(item.size) + ')'"
              />
              <span 
                class="item-name" 
                :data-tooltip="getShortItemTooltip(item)"
                data-tooltip-pos="right"
                :title="item.path"
              >
                {{ item.name }}
              </span>
            </div>
          </td>
          <td class="col-ext" :title="item.isDirectory ? 'Папка' : (item.extension || 'Без розширення')">{{ item.isDirectory ? '' : item.extension }}</td>
          <td class="col-size" :title="item.isDirectory ? 'Папка' : formatNumber(item.size) + ' байт'">{{ item.isDirectory ? '<DIR>' : formatBytes(item.size) }}</td>
          <td class="col-date" :title="'Дата зміни: ' + formatDate(item.mtime)">{{ formatDate(item.mtime) }}</td>
          <td class="col-perms" :title="'Права доступу UNIX: ' + item.permissions">{{ item.permissions }}</td>
        </tr>

        <!-- Empty State -->
        <tr v-if="items.length === 0 && !loading">
          <td colspan="5" class="empty-state">
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
import { ref, nextTick } from 'vue'
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
}>()

const wrapperRef = ref<HTMLElement | null>(null)
const isDragOverTable = ref(false)
const dragTargetItemPath = ref<string | null>(null)

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
    // Open in native default app (like macOS Finder)
    emit('open-native', item)
  }
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
    const minCursor = props.currentPath === '/' ? 0 : -1
    if (props.cursorIndex > minCursor) {
      setCursor(props.cursorIndex - 1)
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
  } else if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault()
    emit('go-up')
  }
}

function scrollToCursor() {
  nextTick(() => {
    const el = wrapperRef.value?.querySelector('.is-cursor') as HTMLElement
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  })
}

// Drag and drop handlers
function onDragStart(e: DragEvent, item: FileItem) {
  const selected = Array.from(props.selectedPaths)
  const paths = selected.length > 0 && selected.includes(item.path) ? selected : [item.path]
  e.dataTransfer?.setData('application/json', JSON.stringify(paths))
  e.dataTransfer!.effectAllowed = 'copyMove'
}

function onTableDragOver(e: DragEvent) {
  isDragOverTable.value = true
  e.dataTransfer!.dropEffect = 'copy'
}

function onTableDrop(e: DragEvent) {
  isDragOverTable.value = false
  dragTargetItemPath.value = null
  const rawData = e.dataTransfer?.getData('application/json')
  if (rawData) {
    try {
      const paths = JSON.parse(rawData) as string[]
      emit('drop-items', paths, props.currentPath)
    } catch {}
  }
}

function onItemDragOver(e: DragEvent, item: FileItem) {
  if (item.isDirectory) {
    dragTargetItemPath.value = item.path
    e.dataTransfer!.dropEffect = 'copy'
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
  const rawData = e.dataTransfer?.getData('application/json')
  if (rawData) {
    try {
      const paths = JSON.parse(rawData) as string[]
      const target = item.isDirectory ? item.path : props.currentPath
      emit('drop-items', paths, target)
    } catch {}
  }
}

// Icon selectors
function getIconComponent(item: FileItem) {
  const cat = getFileCategory(item.extension, item.isDirectory)
  switch (cat.icon) {
    case 'Folder': return Folder
    case 'Code': return Code
    case 'Image': return Image
    case 'Film': return Film
    case 'Music': return Music
    case 'FileText': return FileText
    case 'Archive': return Archive
    default: return File
  }
}

function getIconModifier(item: FileItem): string {
  return getFileCategory(item.extension, item.isDirectory).classModifier
}

function getShortItemTooltip(item?: FileItem): string {
  if (!item) return ''
  if (item.isDirectory) {
    return `📁 ${item.name} • Папка`
  }
  const ext = item.extension ? item.extension.toUpperCase().replace('.', '') + ' • ' : ''
  return `📄 ${item.name} • ${ext}${formatBytes(item.size)}`
}

function getItemTooltip(item?: FileItem): string {
  if (!item) return ''
  if (item.isDirectory) {
    return [
      `📁 Папка: ${item.name || ''}`,
      `Шлях: ${item.path || ''}`,
      `Змінено: ${formatDate(item.mtime)}`,
      `Права доступу: ${item.permissions || '--'}`,
      `💡 Подвійний клік — увійти у папку`,
    ].join('\n')
  }

  const extStr = item.extension ? ` (${item.extension.toUpperCase()})` : ''
  const sizeDetailed = `${formatBytes(item.size)} (${formatNumber(item.size)} байт)`
  const typeDesc = getFileTypeDescription(item.extension, false)
  return [
    `📄 Файл: ${item.name || ''}${extStr}`,
    `Тип: ${typeDesc}`,
    `Розмір: ${sizeDetailed}`,
    `Шлях: ${item.path || ''}`,
    `Змінено: ${formatDate(item.mtime)}`,
    `Права доступу: ${item.permissions || '--'}`,
    `💡 Подвійний клік — відкрити у нативній програмі`,
  ].join('\n')
}

defineExpose({
  focus: () => wrapperRef.value?.focus(),
  scrollToCursor,
})
</script>
