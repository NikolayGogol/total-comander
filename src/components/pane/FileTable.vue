<template>
  <div
    ref="wrapperRef"
    class="file-table-wrapper"
    :class="{ 'is-drag-over': isDragOverTable }"
    tabindex="0"
    @click="handleWrapperClick"
    @keydown="handleKeyDown"
    @dragover.prevent="onTableDragOver"
    @dragleave="onTableDragLeave"
    @drop.prevent="onTableDrop"
    @contextmenu.prevent="handleTableContextMenu($event)"
  >
    <table ref="tableRef" class="file-table">
      <thead>
        <tr>
          <th
            class="col-name"
            title="Сортувати за назвою (клік для перемикання A-Z / Z-A)"
            @click="$emit('sort', 'name')"
          >
            <div class="th-content">
              <span>Name</span>
              <span v-if="sortField === 'name'" class="sort-arrow">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </div>
            <div
              class="col-resizer"
              :class="{ 'is-active': activeResizingCol === 'name' }"
              title="Перетягніть для зміни ширини колонки (двічі клікніть для скидання)"
              @click.stop
              @mousedown="startColResize('name', $event)"
              @dblclick="resetColWidth('name')"
            ></div>
          </th>

          <th class="col-ext" title="Сортувати за розширенням файлів" @click="$emit('sort', 'ext')">
            <div class="th-content">
              <span>Ext</span>
              <span v-if="sortField === 'ext'" class="sort-arrow">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </div>
            <div
              class="col-resizer"
              :class="{ 'is-active': activeResizingCol === 'ext' }"
              title="Перетягніть для зміни ширини колонки (двічі клікніть для скидання)"
              @click.stop
              @mousedown="startColResize('ext', $event)"
              @dblclick="resetColWidth('ext')"
            ></div>
          </th>

          <th class="col-size" title="Сортувати за розміром файлів" @click="$emit('sort', 'size')">
            <div class="th-content">
              <span>Size</span>
              <span v-if="sortField === 'size'" class="sort-arrow">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </div>
            <div
              class="col-resizer"
              :class="{ 'is-active': activeResizingCol === 'size' }"
              title="Перетягніть для зміни ширини колонки (двічі клікніть для скидання)"
              @click.stop
              @mousedown="startColResize('size', $event)"
              @dblclick="resetColWidth('size')"
            ></div>
          </th>

          <th class="col-date" title="Сортувати за датою останньої модифікації" @click="$emit('sort', 'mtime')">
            <div class="th-content">
              <span>Modified</span>
              <span v-if="sortField === 'mtime'" class="sort-arrow">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </div>
            <div
              class="col-resizer"
              :class="{ 'is-active': activeResizingCol === 'date' }"
              title="Перетягніть для зміни ширини колонки (двічі клікніть для скидання)"
              @click.stop
              @mousedown="startColResize('date', $event)"
              @dblclick="resetColWidth('date')"
            ></div>
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
          @click="handleParentClick"
          @dblclick="$emit('go-up')"
          @dragover.prevent="onTableDragOver"
          @dragleave="onTableDragLeave"
          @drop.prevent="onTableDrop"
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
            'is-drag-target': dragTargetItemPath === item.path,
          }"
          :draggable="true"
          :title="getItemTooltip(item)"
          @dragstart="onDragStart($event, item)"
          @dragend="onDragEnd"
          @dragover.prevent="onItemDragOver($event, item)"
          @dragleave="onItemDragLeave(item)"
          @drop.prevent="onItemDrop($event, item)"
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
                :title="
                  item.isDirectory
                    ? 'Папка: ' + item.name
                    : (item.extension ? item.extension.toUpperCase() + ' ' : '') +
                      'Файл: ' +
                      item.name +
                      ' (' +
                      formatBytes(item.size) +
                      ')'
                "
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
          <td class="col-ext" :title="item.isDirectory ? 'Папка' : item.extension || 'Без розширення'">
            <span v-if="!item.isDirectory && item.extension" class="ext-badge" :class="'ext-' + getCategory(item)">
              {{ item.extension }}
            </span>
          </td>
          <td
            class="col-size"
            :title="
              item.isDirectory
                ? item.size > 0
                  ? formatNumber(item.size) + ' байт'
                  : 'Папка'
                : formatNumber(item.size) + ' байт'
            "
          >
            <span v-if="item.isDirectory && (!item.size || item.size === 0)" class="dir-badge">&lt;DIR&gt;</span>
            <span v-else-if="item.isDirectory" class="file-size-text dir-calculated-size">{{
              formatBytes(item.size)
            }}</span>
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
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import type { FileItem, SortField } from '@/types'
import { formatBytes, formatDate, formatNumber, getFileCategory, getFileTypeDescription } from '@/utils/formatters'
import { Archive, Code, CornerLeftUp, File, FileText, Film, Folder, Image, Music } from 'lucide-vue-next'

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
  (e: 'select-all'): void
  (e: 'clear-selection'): void
  (e: 'sort', field: SortField): void
  (e: 'open-folder-size', path: string): void
  (e: 'drop-items', sourcePaths: string[], targetDir: string, isMove?: boolean): void
  (e: 'context-menu', payload: { x: number; y: number; item: FileItem | null }): void
}>()

const wrapperRef = ref<HTMLElement | null>(null)
const tableRef = ref<HTMLTableElement | null>(null)
const isDragOverTable = ref(false)
const dragTargetItemPath = ref<string | null>(null)

interface ColumnWidths {
  name: number
  ext: number
  size: number
  date: number
}

const DEFAULT_COL_WIDTHS: ColumnWidths = {
  name: 260,
  ext: 75,
  size: 95,
  date: 150,
}

const minWidths: Record<keyof ColumnWidths, number> = {
  name: 90,
  ext: 45,
  size: 60,
  date: 100,
}

function loadSavedColWidths(): ColumnWidths {
  try {
    const saved = localStorage.getItem('tc-col-widths')
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        name: typeof parsed.name === 'number' && parsed.name >= minWidths.name ? parsed.name : DEFAULT_COL_WIDTHS.name,
        ext: typeof parsed.ext === 'number' && parsed.ext >= minWidths.ext ? parsed.ext : DEFAULT_COL_WIDTHS.ext,
        size: typeof parsed.size === 'number' && parsed.size >= minWidths.size ? parsed.size : DEFAULT_COL_WIDTHS.size,
        date: typeof parsed.date === 'number' && parsed.date >= minWidths.date ? parsed.date : DEFAULT_COL_WIDTHS.date,
      }
    }
  } catch {}
  return { ...DEFAULT_COL_WIDTHS }
}

const colWidths = reactive<ColumnWidths>(loadSavedColWidths())
const activeResizingCol = ref<keyof ColumnWidths | null>(null)

function applyColWidthsToDOM() {
  if (!tableRef.value) return
  tableRef.value.style.setProperty('--col-name-w', `${colWidths.name}px`)
  tableRef.value.style.setProperty('--col-ext-w', `${colWidths.ext}px`)
  tableRef.value.style.setProperty('--col-size-w', `${colWidths.size}px`)
  tableRef.value.style.setProperty('--col-date-w', `${colWidths.date}px`)
}

function startColResize(colKey: keyof ColumnWidths, e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()

  activeResizingCol.value = colKey
  const startX = e.clientX
  const startWidth = colWidths[colKey]

  document.body.classList.add('is-resizing-columns')

  function onMouseMove(moveEvent: MouseEvent) {
    const deltaX = moveEvent.clientX - startX
    colWidths[colKey] = Math.max(minWidths[colKey], Math.min(1200, startWidth + deltaX))
    applyColWidthsToDOM()
  }

  function onMouseUp() {
    activeResizingCol.value = null
    document.body.classList.remove('is-resizing-columns')
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    try {
      localStorage.setItem('tc-col-widths', JSON.stringify(colWidths))
      window.dispatchEvent(new CustomEvent('tc-col-widths-updated', { detail: { ...colWidths } }))
    } catch {}
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function resetColWidth(colKey: keyof ColumnWidths) {
  colWidths[colKey] = DEFAULT_COL_WIDTHS[colKey]
  applyColWidthsToDOM()
  try {
    localStorage.setItem('tc-col-widths', JSON.stringify(colWidths))
    window.dispatchEvent(new CustomEvent('tc-col-widths-updated', { detail: { ...colWidths } }))
  } catch {}
}

function onColWidthsUpdated(e: Event) {
  const custom = e as CustomEvent<ColumnWidths>
  if (custom.detail) {
    Object.assign(colWidths, custom.detail)
    applyColWidthsToDOM()
  }
}

function onStorageChange(e: StorageEvent) {
  if (e.key === 'tc-col-widths' && e.newValue) {
    try {
      const parsed = JSON.parse(e.newValue)
      Object.assign(colWidths, parsed)
      applyColWidthsToDOM()
    } catch {}
  }
}

onMounted(() => {
  applyColWidthsToDOM()
  window.addEventListener('tc-col-widths-updated', onColWidthsUpdated)
  window.addEventListener('storage', onStorageChange)
})

onUnmounted(() => {
  window.removeEventListener('tc-col-widths-updated', onColWidthsUpdated)
  window.removeEventListener('storage', onStorageChange)
})

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

function handleParentClick() {
  setCursor(-1)
  emit('clear-selection')
}

function handleWrapperClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (!target) return
  if (target.closest('th')) return
  if (!target.closest('.file-row')) {
    emit('clear-selection')
  }
}

function handleRowClick(e: MouseEvent, item: FileItem, index: number) {
  if (e.shiftKey) {
    emit('select-range', props.cursorIndex >= 0 ? props.cursorIndex : 0, index)
  } else if (e.metaKey || e.ctrlKey) {
    emit('toggle-select', item.path)
    setCursor(index)
  } else {
    if (props.selectedPaths.size > 0) {
      emit('clear-selection')
    }
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

  // Ctrl+A - Select All
  if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault()
    emit('select-all')
    return
  }

  // Escape - Clear selection
  if (e.key === 'Escape') {
    if (props.selectedPaths.size > 0) {
      e.preventDefault()
      emit('clear-selection')
      return
    }
  }

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
      if (e.key === ' ' && item.isDirectory) {
        emit('open-folder-size', item.path)
      } else {
        emit('toggle-select', item.path)
        if (props.cursorIndex < len - 1) {
          setCursor(props.cursorIndex + 1)
          scrollToCursor()
        }
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
  let paths: string[]
  if (isSelected(item.path)) {
    paths = Array.from(props.selectedPaths)
  } else {
    paths = [item.path]
    const idx = props.items.findIndex((it) => it.path === item.path)
    if (idx !== -1) {
      setCursor(idx)
    }
  }

  // 1. Shared in-app drag storage (guarantees 100% reliable data transfer between panes)
  ;(window as any).__TC_ACTIVE_DRAG__ = {
    sources: paths,
    fromPath: props.currentPath,
  }

  // 2. DataTransfer payload
  try {
    e.dataTransfer.setData('application/json', JSON.stringify(paths))
    e.dataTransfer.setData('text/plain', paths.join('\r\n'))
    e.dataTransfer.effectAllowed = 'copyMove'

    // 3. Create a clean ghost drag image badge
    const badge = document.createElement('div')
    badge.style.cssText =
      'position: absolute; top: -1000px; left: -1000px; padding: 4px 10px; background: #131824; color: #38bdf8; border: 1px solid #38bdf8; border-radius: 4px; font-family: monospace; font-size: 12px; pointer-events: none; z-index: 99999; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-weight: bold;'
    badge.textContent = paths.length === 1 ? `📄 ${item.name}` : `📁 ${paths.length} items`
    document.body.appendChild(badge)
    e.dataTransfer.setDragImage(badge, 12, 12)
    setTimeout(() => {
      if (badge.parentNode) badge.parentNode.removeChild(badge)
    }, 0)
  } catch {}
}

function onDragEnd() {
  setTimeout(() => {
    ;(window as any).__TC_ACTIVE_DRAG__ = null
  }, 300)
}

function extractDroppedPaths(e: DragEvent): string[] {
  // Check internal in-app drag payload first
  const internalDrag = (window as any).__TC_ACTIVE_DRAG__
  if (internalDrag && Array.isArray(internalDrag.sources) && internalDrag.sources.length > 0) {
    return [...internalDrag.sources]
  }

  if (!e.dataTransfer) return []

  // 1. Total Commander internal payload
  try {
    const json = e.dataTransfer.getData('application/json')
    if (json) {
      const parsed = JSON.parse(json)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch {}

  // 2. Windows Explorer / Native files
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
      if (p) {
        list.push(p)
      }
    }
    if (list.length > 0) {
      return list
    }
  }

  // 3. Plain text paths fallback
  try {
    const text = e.dataTransfer.getData('text/plain')
    if (text) {
      const lines = text
        .split(/[\r\n]+/)
        .map((l) => l.trim().replace(/^["']|["']$/g, ''))
        .filter((l) => /^[a-zA-Z]:[/\\]/.test(l) || l.startsWith('\\\\'))
      if (lines.length > 0) {
        return lines
      }
    }
  } catch {}

  return []
}

function onTableDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = e.shiftKey ? 'move' : 'copy'
  }
  isDragOverTable.value = true
}

function onTableDragLeave(e: DragEvent) {
  const related = e.relatedTarget as HTMLElement | null
  if (!related || !wrapperRef.value?.contains(related)) {
    isDragOverTable.value = false
    dragTargetItemPath.value = null
  }
}

function onTableDrop(e: DragEvent) {
  e.preventDefault()
  isDragOverTable.value = false
  const targetDir = dragTargetItemPath.value || props.currentPath
  dragTargetItemPath.value = null
  const sources = extractDroppedPaths(e)
  ;(window as any).__TC_ACTIVE_DRAG__ = null
  if (sources.length > 0) {
    const isMove = e.shiftKey
    emit('drop-items', sources, targetDir, isMove)
  }
}

function onItemDragOver(e: DragEvent, item: FileItem) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = e.shiftKey ? 'move' : 'copy'
  }
  isDragOverTable.value = true
  if (item.isDirectory) {
    dragTargetItemPath.value = item.path
  } else {
    dragTargetItemPath.value = null
  }
}

function onItemDragLeave(item: FileItem) {
  if (dragTargetItemPath.value === item.path) {
    dragTargetItemPath.value = null
  }
}

function onItemDrop(e: DragEvent, item: FileItem) {
  e.preventDefault()
  e.stopPropagation()
  dragTargetItemPath.value = null
  isDragOverTable.value = false
  const sources = extractDroppedPaths(e)
  ;(window as any).__TC_ACTIVE_DRAG__ = null
  if (sources.length > 0) {
    const target = item.isDirectory ? item.path : props.currentPath
    const isMove = e.shiftKey
    emit('drop-items', sources, target, isMove)
  }
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
    case 'exe':
      return Code
    case 'image':
      return Image
    case 'video':
      return Film
    case 'audio':
      return Music
    case 'doc':
      return FileText
    case 'archive':
      return Archive
    default:
      return File
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
    `Змінено: ${formatDate(item.mtime)}`,
  ]
  return parts.filter(Boolean).join(' • ')
}

function getShortItemTooltip(item: FileItem): string {
  return `${item.name} (${item.isDirectory ? 'Папка' : formatBytes(item.size)})`
}

function focus() {
  wrapperRef.value?.focus()
}

defineExpose({
  focus,
})
</script>
