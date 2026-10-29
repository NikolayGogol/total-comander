<template>
  <div 
    class="file-table-wrapper" 
    :class="{ 'is-drag-over': isDragOverTable }"
    ref="wrapperRef"
    tabindex="0"
    @click="handleWrapperClick"
    @keydown="handleKeyDown"
    @dragover.prevent="onTableDragOver"
    @dragleave="onTableDragLeave"
    @drop.prevent="onTableDrop"
    @contextmenu.prevent="onTableContextMenu"
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
          @contextmenu.prevent.stop="onRowContextMenu($event, item, index)"
        >
          <td class="col-name">
            <div class="col-icon-name">
              <img 
                v-if="item.appIcon" 
                :src="item.appIcon" 
                class="item-icon app-icon-img" 
                :alt="item.name" 
              />
              <component 
                v-else 
                :is="getIconComponent(item)" 
                :size="14" 
                :class="['item-icon', getIconModifier(item)]"
                :title="item.isApp ? 'Програма macOS: ' + item.name : (item.isDirectory ? 'Папка: ' + item.name : (item.extension ? item.extension.toUpperCase() + ' ' : '') + 'Файл: ' + item.name + ' (' + formatBytes(item.size) + ')')"
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
          <td class="col-ext" :title="item.isApp ? 'Програма macOS' : (item.isDirectory ? 'Папка' : (item.extension || 'Без розширення'))">
            <span v-if="item.isApp" class="app-badge">&lt;APP&gt;</span>
            <span v-else-if="!item.isDirectory && item.extension" class="ext-badge" :class="'ext-' + getCategory(item)">
              {{ item.extension }}
            </span>
          </td>
          <td class="col-size" :title="item.isApp ? 'Програма macOS (.app)' : (item.isDirectory ? 'Папка' : formatNumber(item.size) + ' байт')">
            <span v-if="item.isApp" class="app-badge">&lt;APP&gt;</span>
            <span v-else-if="item.isDirectory" class="dir-badge">&lt;DIR&gt;</span>
            <span v-else class="file-size-text">{{ formatBytes(item.size) }}</span>
          </td>
          <td class="col-date" :title="'Дата зміни: ' + formatDate(item.mtime)">{{ formatDate(item.mtime) }}</td>
          <td class="col-perms" :title="'Права доступу UNIX: ' + item.permissions">{{ item.permissions }}</td>
        </tr>

        <!-- Empty State -->
        <tr v-if="items.length === 0 && !loading">
          <td colspan="5" class="empty-state">
            <span v-if="filterText">Немає файлів за запитом "{{ filterText }}"</span>
            <span v-else>Директорія порожня</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Loading Overlay -->
    <div v-if="loading" class="loading-overlay">
      <span>Завантаження...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { FileItem, SortField, SortOrder } from '../../types'
import { 
  formatBytes, 
  formatDate, 
  formatNumber, 
  getFileCategory, 
  getItemTooltip, 
  getShortItemTooltip 
} from '../../utils/formatters'
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
  sortOrder: SortOrder
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
  (e: 'clear-selection'): void
  (e: 'sort', field: SortField): void
  (e: 'drop-items', sourcePaths: string[], targetDir: string, isMove?: boolean): void
  (e: 'context-menu', payload: { x: number; y: number; item: FileItem | null }): void
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

function handleWrapperClick(e: MouseEvent) {
  if ((e.target as HTMLElement)?.closest('tbody')) return
  emit('clear-selection')
}

function onRowContextMenu(e: MouseEvent, item: FileItem, index: number) {
  if (!props.selectedPaths.has(item.path)) {
    setCursor(index)
  }
  emit('context-menu', { x: e.clientX, y: e.clientY, item })
}

function onTableContextMenu(e: MouseEvent) {
  emit('context-menu', { x: e.clientX, y: e.clientY, item: null })
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
  if (item.isApp) {
    emit('open-native', item)
  } else if (item.isDirectory) {
    emit('navigate', item.path)
  } else {
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
    if (props.cursorIndex > (props.currentPath !== '/' ? -1 : 0)) {
      setCursor(props.cursorIndex - 1)
      scrollToCursor()
    }
  } else if (e.key === 'Home') {
    e.preventDefault()
    setCursor(props.currentPath !== '/' ? -1 : 0)
    scrollToCursor()
  } else if (e.key === 'End') {
    e.preventDefault()
    if (len > 0) {
      setCursor(len - 1)
      scrollToCursor()
    }
  } else if (e.key === 'PageUp') {
    e.preventDefault()
    setCursor(Math.max(props.currentPath !== '/' ? -1 : 0, props.cursorIndex - 15))
    scrollToCursor()
  } else if (e.key === 'PageDown') {
    e.preventDefault()
    setCursor(Math.min(len - 1, props.cursorIndex + 15))
    scrollToCursor()
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
      if (item.isApp) {
        emit('open-native', item)
      } else if (item.isDirectory) {
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

function extractDroppedPaths(e: DragEvent): string[] {
  if (!e.dataTransfer) return []

  const json = e.dataTransfer.getData('application/json')
  if (json) {
    try {
      const parsed = JSON.parse(json)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    } catch {}
  }

  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const list: string[] = []
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i]
      let p = ''
      if (window.electronAPI && typeof window.electronAPI.getPathForFile === 'function') {
        p = window.electronAPI.getPathForFile(file)
      }
      if (!p) {
        p = (file as any).path || ''
      }
      if (p) list.push(p)
    }
    if (list.length > 0) return list
  }

  const text = e.dataTransfer.getData('text/plain')
  if (text) {
    const lines = text
      .split(/[\r\n]+/)
      .map((l) => l.trim().replace(/^["']|["']$/g, ''))
      .filter((l) => l.length > 0 && l.startsWith('/'))
    if (lines.length > 0) return lines
  }

  return []
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
  e.dataTransfer!.dropEffect = e.shiftKey ? 'move' : 'copy'
}

function onTableDragLeave(e: DragEvent) {
  const related = e.relatedTarget as HTMLElement | null
  if (!related || !wrapperRef.value?.contains(related)) {
    isDragOverTable.value = false
  }
}

function onTableDrop(e: DragEvent) {
  isDragOverTable.value = false
  dragTargetItemPath.value = null
  const sources = extractDroppedPaths(e)
  if (sources.length > 0) {
    emit('drop-items', sources, props.currentPath, e.shiftKey)
  }
}

function onItemDragOver(e: DragEvent, item: FileItem) {
  if (item.isDirectory) {
    dragTargetItemPath.value = item.path
    e.dataTransfer!.dropEffect = e.shiftKey ? 'move' : 'copy'
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
  const sources = extractDroppedPaths(e)
  if (sources.length > 0) {
    const target = item.isDirectory ? item.path : props.currentPath
    emit('drop-items', sources, target, e.shiftKey)
  }
}

function getCategory(item: FileItem) {
  return getFileCategory(item.extension || item.name, item.isDirectory).category
}

// Icon selectors
function getIconComponent(item: FileItem) {
  if (item.isDirectory) return Folder
  const cat = getCategory(item)
  switch (cat) {
    case 'code':
    case 'app': return Code
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

defineExpose({
  focus: () => wrapperRef.value?.focus(),
  scrollToCursor,
})
</script>
