<template>
  <div
    class="remote-explorer-container"
    :class="{ 'is-drop-target': isDragOver }"
    @dragover.prevent="isDragOver = true"
    @dragleave="isDragOver = false"
    @drop.prevent="onDrop"
  >
    <!-- Toolbar -->
    <div class="explorer-toolbar remote-toolbar">
      <div class="breadcrumbs-bar">
        <button
          type="button"
          class="btn-breadcrumb-up"
          title="Вгору на один рівень (Backspace)"
          :disabled="currentRemotePath === '/'"
          @click="$emit('navigate-up')"
        >
          <CornerLeftUp :size="13" />
        </button>
        <div class="breadcrumbs-scroll">
          <span v-for="(crumb, idx) in breadcrumbs" :key="crumb.path" class="crumb-wrapper">
            <span
              class="crumb-item"
              :class="{ 'is-current': idx === breadcrumbs.length - 1 }"
              @click="$emit('navigate', crumb.path)"
            >
              {{ crumb.name }}
            </span>
            <ChevronRight v-if="idx < breadcrumbs.length - 1" :size="10" class="crumb-separator" />
          </span>
        </div>
      </div>

      <div class="toolbar-tools">
        <div class="search-input-wrapper">
          <Search :size="12" class="search-icon" />
          <input
            :value="filterQuery"
            type="text"
            class="filter-input"
            placeholder="Фільтр..."
            @input="$emit('update:filter-query', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <button
          type="button"
          class="btn-tool"
          title="Оновити вміст (Cmd+R)"
          :disabled="isLoading"
          @click="$emit('refresh')"
        >
          <RotateCw :size="13" :class="{ 'icon-spinning': isLoading }" />
        </button>
        <button
          v-if="protocol === 'ssh' || protocol === 'sftp'"
          type="button"
          class="btn-tool"
          title="Відкрити інтерактивну SSH сесію в нативному macOS Terminal"
          @click="$emit('terminal')"
        >
          <Terminal :size="13" />
        </button>
        <button
          type="button"
          class="btn-tool"
          title="Створити нову папку на сервері (F7)"
          @click="$emit('prompt-folder')"
        >
          <FolderPlus :size="13" />
        </button>
        <button
          type="button"
          class="btn-tool"
          title="Створити новий файл на сервері (Shift+F4)"
          @click="$emit('prompt-file')"
        >
          <FilePlus :size="13" />
        </button>
        <button
          type="button"
          class="btn-tool btn-disconnect"
          title="Розірвати підключення"
          @click="$emit('disconnect')"
        >
          <Power :size="13" />
          <span>Відключитися</span>
        </button>
      </div>
    </div>

    <!-- Remote Table -->
    <div class="remote-table-wrapper" @contextmenu.prevent="$emit('contextmenu-blank', $event)">
      <table class="remote-table">
        <thead>
          <tr>
            <th class="th-name">NAME (REMOTE)</th>
            <th class="th-ext">EXT</th>
            <th class="th-size">SIZE</th>
            <th class="th-date">MODIFIED</th>
            <th class="th-perms">PERMS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="currentRemotePath !== '/'" class="remote-row is-parent-dir" @dblclick="$emit('navigate-up')">
            <td class="td-name" colspan="5">
              <CornerLeftUp :size="14" class="parent-icon" />
              <span class="parent-text">.. [Parent Directory]</span>
            </td>
          </tr>

          <tr
            v-for="entry in filteredEntries"
            :key="entry.path"
            class="remote-row"
            :class="{ 'is-selected': selectedItem?.path === entry.path }"
            draggable="true"
            @click="$emit('select', entry)"
            @dblclick="$emit('dblclick', entry)"
            @dragstart="$emit('dragstart-entry', $event, entry)"
            @contextmenu.prevent.stop="$emit('contextmenu-row', $event, entry)"
          >
            <td class="td-name">
              <Folder v-if="entry.isDirectory" :size="14" class="icon-folder" />
              <Archive v-else-if="isArchiveExt(entry.extension)" :size="14" class="icon-archive" />
              <File v-else :size="14" class="icon-file" />
              <span class="entry-name">{{ entry.name }}</span>
            </td>
            <td class="td-ext">
              <span v-if="!entry.isDirectory && entry.extension" class="ext-badge">
                {{ entry.extension }}
              </span>
            </td>
            <td class="td-size">
              <span v-if="entry.isDirectory" class="dir-badge">&lt;DIR&gt;</span>
              <span v-else class="size-text">{{ formatBytes(entry.size) }}</span>
            </td>
            <td class="td-date">
              {{ entry.modified ? formatDate(entry.modified) : '-' }}
            </td>
            <td class="td-perms">
              <span class="perms-code">{{ entry.permissions || '-' }}</span>
            </td>
          </tr>

          <tr v-if="filteredEntries.length === 0" class="empty-row">
            <td colspan="5" class="empty-cell">
              {{ isLoading ? 'Завантаження списку...' : 'Ця папка порожня або немає збігів' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Remote Footer -->
    <div class="explorer-footer remote-footer">
      <div class="footer-left">
        <span class="footer-stats">
          {{ filteredEntries.length }} елементів
          <template v-if="selectedItem">
            • Вибрано: <strong>{{ selectedItem.name }}</strong>
            <span v-if="!selectedItem.isDirectory"> ({{ formatBytes(selectedItem.size) }}) </span>
          </template>
        </span>
      </div>
      <div class="footer-right">
        <button
          type="button"
          class="btn-primary"
          :disabled="!selectedItem || selectedItem.isDirectory || isTransferring"
          title="Завантажити вибраний файл на локальний диск (F5 або перетягніть мишкою)"
          @click="$emit('download')"
        >
          <Download :size="13" />
          <span>{{ isTransferring ? 'Завантаження...' : '← Завантажити у TC' }}</span>
        </button>
        <button
          type="button"
          class="btn-danger"
          :disabled="!selectedItem"
          title="Видалити вибраний елемент із сервера (Del)"
          @click="$emit('prompt-delete')"
        >
          <Trash2 :size="13" />
          <span>Видалити</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  CornerLeftUp,
  ChevronRight,
  Search,
  RotateCw,
  Terminal,
  FolderPlus,
  FilePlus,
  Power,
  Folder,
  Archive,
  File,
  Download,
  Trash2,
} from 'lucide-vue-next'
import { formatBytes, formatDate } from '@/utils/formatters'
import type { RemoteFileEntry } from '@/types'

defineProps<{
  currentRemotePath: string
  breadcrumbs: Array<{ name: string; path: string }>
  filteredEntries: RemoteFileEntry[]
  selectedItem: RemoteFileEntry | null
  filterQuery: string
  isLoading: boolean
  isTransferring: boolean
  protocol?: string
}>()

const emit = defineEmits<{
  (e: 'update:filter-query', val: string): void
  (e: 'navigate', path: string): void
  (e: 'navigate-up'): void
  (e: 'refresh'): void
  (e: 'terminal'): void
  (e: 'select', item: RemoteFileEntry): void
  (e: 'dblclick', entry: RemoteFileEntry): void
  (e: 'contextmenu-row', event: MouseEvent, entry: RemoteFileEntry): void
  (e: 'contextmenu-blank', event: MouseEvent): void
  (e: 'dragstart-entry', event: DragEvent, entry: RemoteFileEntry): void
  (e: 'drop-local', event: DragEvent): void
  (e: 'prompt-folder'): void
  (e: 'prompt-file'): void
  (e: 'download'): void
  (e: 'prompt-delete'): void
  (e: 'disconnect'): void
}>()

const isDragOver = ref(false)

function onDrop(e: DragEvent) {
  isDragOver.value = false
  emit('drop-local', e)
}

function isArchiveExt(ext?: string): boolean {
  if (!ext) return false
  return ['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar'].includes(ext.toLowerCase())
}
</script>
