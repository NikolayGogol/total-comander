<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card archive-view-card">
      <div class="modal-header">
        <div class="modal-title">
          <Archive :size="16" class="icon-amber" />
          <span>{{ archiveFileName }}</span>
          <span v-if="isEncrypted" class="archive-lock-tag" title="Архів захищено паролем">
            <Lock :size="12" /> Захищено
          </span>
        </div>
        <button class="modal-close-btn" title="Закрити (Esc)" @click="$emit('close')">
          <X :size="15" />
        </button>
      </div>

      <div class="modal-body archive-view-body">
        <!-- Password prompt if required -->
        <div v-if="needPassword" class="archive-pass-banner">
          <Lock :size="15" class="icon-rose" />
          <span class="pass-msg">Для перегляду або видобування потрібен пароль:</span>
          <input
            v-model="passwordInput"
            type="password"
            class="form-input pass-input"
            placeholder="Введіть пароль..."
            @keydown.enter="reloadWithPassword"
          />
          <button class="btn-primary btn-sm" @click="reloadWithPassword">OK</button>
        </div>

        <!-- Filter bar & summary -->
        <div class="archive-toolbar">
          <div class="archive-search">
            <Search :size="13" class="search-icon" />
            <input
              v-model="filterQuery"
              type="text"
              class="form-input search-input"
              placeholder="Швидкий пошук файлів в архіві..."
            />
          </div>
          <div class="archive-summary">
            <span>{{ entries.length }} файлів</span>
            <span class="dot">•</span>
            <span>{{ formatBytes(totalArchiveSize) }}</span>
          </div>
        </div>

        <!-- Virtual Breadcrumbs Path Bar -->
        <div class="archive-breadcrumb-bar">
          <button
            class="archive-up-btn"
            :disabled="!currentSubDir || !!filterQuery"
            title="⤴ Рівень вгору (Backspace або двічі клікніть '..')"
            @click="goUp"
          >
            <CornerLeftUp :size="14" />
          </button>

          <div class="archive-crumbs">
            <span
              class="crumb-item"
              :class="{ 'is-active': !currentSubDir && !filterQuery }"
              title="Корінь архіву"
              @click="goToRoot"
            >
              {{ archiveFileName }}
            </span>

            <template v-if="filterQuery">
              <span class="crumb-sep">/</span>
              <span class="crumb-item is-active">Пошук: "{{ filterQuery }}"</span>
            </template>

            <template v-else>
              <template v-for="(crumb, idx) in breadcrumbs" :key="idx">
                <span class="crumb-sep">/</span>
                <span
                  class="crumb-item"
                  :class="{ 'is-active': idx === breadcrumbs.length - 1 }"
                  @click="goToCrumb(idx)"
                >
                  {{ crumb }}
                </span>
              </template>
            </template>
          </div>
        </div>

        <!-- Archive files table -->
        <div class="archive-table-wrapper">
          <table v-if="visibleItems.length > 0 || currentSubDir" class="archive-table">
            <thead>
              <tr>
                <th class="col-arc-name">Ім'я</th>
                <th class="col-arc-size">Розмір</th>
                <th class="col-arc-packed">Стиснений</th>
                <th class="col-arc-date">Дата</th>
              </tr>
            </thead>
            <tbody>
              <!-- Parent Directory (..) Row -->
              <tr
                v-if="currentSubDir && !filterQuery"
                class="archive-row is-parent"
                title="⤴ Перейти на рівень вгору (подвійний клік або Backspace)"
                @dblclick="goUp"
              >
                <td class="col-arc-name" colspan="4">
                  <div class="arc-icon-name">
                    <CornerLeftUp :size="14" class="icon-cyan" />
                    <span class="arc-name-text">.. [Parent Directory]</span>
                  </div>
                </td>
              </tr>

              <!-- Items (Folders & Files) -->
              <tr
                v-for="item in visibleItems"
                :key="item.fullRelativePath"
                class="archive-row"
                :class="{ 'is-dir': item.isDirectory }"
                :title="
                  item.isDirectory ? 'Папка: ' + item.name + ' (двічі клікніть щоб відкрити)' : 'Файл: ' + item.name
                "
                @dblclick="handleRowDblClick(item)"
              >
                <td class="col-arc-name">
                  <div class="arc-icon-name">
                    <Folder v-if="item.isDirectory" :size="14" class="icon-amber" />
                    <File v-else :size="14" class="icon-cyan" />
                    <span class="arc-name-text">{{ item.name }}</span>
                  </div>
                </td>
                <td class="col-arc-size">
                  <span v-if="item.isDirectory" class="dir-badge">&lt;DIR&gt;</span>
                  <span v-else>{{ formatBytes(item.size) }}</span>
                </td>
                <td class="col-arc-packed">
                  <span v-if="item.packedSize">{{ formatBytes(item.packedSize) }}</span>
                  <span v-else>--</span>
                </td>
                <td class="col-arc-date">{{ item.modified || '--' }}</td>
              </tr>
            </tbody>
          </table>

          <div v-else-if="loading" class="archive-empty">
            <span>Читання архіву...</span>
          </div>

          <div v-else class="archive-empty">
            <span v-if="errorMessage">{{ errorMessage }}</span>
            <span v-else-if="filterQuery">Не знайдено файлів за фільтром "{{ filterQuery }}"</span>
            <span v-else>Ця папка в архіві порожня</span>
          </div>
        </div>

        <!-- Destination / Extraction Target Bar -->
        <div class="archive-extract-bar">
          <div class="dest-input-row">
            <span class="dest-label">Шлях розпакування:</span>
            <input
              v-model="customExtractDir"
              type="text"
              class="form-input dest-input"
              placeholder="Папка куди видобути вміст..."
            />
            <div class="dest-buttons">
              <button
                type="button"
                class="btn-xs"
                :class="isCurrentDirActive ? 'btn-primary' : 'btn-secondary'"
                title="Розпакувати у поточну папку (де розташовано архів)"
                @click="customExtractDir = archiveFileDir"
              >
                Поточна папка
              </button>
              <button
                v-if="props.targetExtractDir"
                type="button"
                class="btn-xs"
                :class="isOppositeDirActive ? 'btn-primary' : 'btn-secondary'"
                title="Розпакувати у протилежну панель"
                @click="customExtractDir = props.targetExtractDir"
              >
                Сусідня панель
              </button>
            </div>
          </div>
          <div class="dest-subfolder-row">
            <label class="extract-checkbox-label">
              <input v-model="createSubfolder" type="checkbox" />
              <span
                >Створити окрему підпапку: <strong>{{ archiveBaseName }}</strong></span
              >
            </label>
            <div class="dest-target-preview" :title="finalExtractPath">
              Ціль: <code>{{ finalExtractPath }}</code>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer archive-footer">
        <button class="btn-secondary" @click="$emit('close')">Закрити (Esc)</button>
        <button class="btn-primary" :disabled="loading || entries.length === 0" @click="extractAll">
          <FolderArchive :size="14" />
          <span>Розархівувати все</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Archive, Lock, X, Search, Folder, File, FolderArchive, CornerLeftUp } from 'lucide-vue-next'
import type { ArchiveEntry } from '../types'
import { formatBytes } from '../utils/formatters'

interface VirtualArchiveItem {
  name: string
  fullRelativePath: string
  isDirectory: boolean
  size: number
  packedSize?: number
  modified?: string
  encrypted?: boolean
}

const props = defineProps<{
  archivePath: string
  targetExtractDir: string
  currentDir?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'extracted', targetPath?: string): void
  (e: 'toast', msg: string, type?: 'success' | 'error' | 'info'): void
}>()

const entries = ref<ArchiveEntry[]>([])
const loading = ref(true)
const errorMessage = ref('')
const needPassword = ref(false)
const isEncrypted = ref(false)
const passwordInput = ref('')
const filterQuery = ref('')
const currentSubDir = ref('')

const archiveFileName = computed(() => {
  return props.archivePath.split(/[/\\]/).filter(Boolean).pop() || props.archivePath
})

const archiveBaseName = computed(() => {
  return archiveFileName.value.replace(/\.[^.]+$/, '')
})

const archiveFileDir = computed(() => {
  if (props.currentDir) return props.currentDir
  const parent = props.archivePath.replace(/[/\\][^/\\]+$/, '')
  return parent || 'C:\\'
})

// Default to CURRENT directory where the archive is located
const defaultExtractBase = computed(() => {
  return archiveFileDir.value || props.targetExtractDir || 'C:\\'
})

const customExtractDir = ref(defaultExtractBase.value)
const createSubfolder = ref(true)

const isCurrentDirActive = computed(() => {
  if (!customExtractDir.value) return false
  return (
    customExtractDir.value.toLowerCase().replace(/[/\\]+$/, '') ===
    archiveFileDir.value.toLowerCase().replace(/[/\\]+$/, '')
  )
})

const isOppositeDirActive = computed(() => {
  if (!customExtractDir.value || !props.targetExtractDir) return false
  return (
    customExtractDir.value.toLowerCase().replace(/[/\\]+$/, '') ===
    props.targetExtractDir.toLowerCase().replace(/[/\\]+$/, '')
  )
})

const finalExtractPath = computed(() => {
  const base = (customExtractDir.value || '').trim().replace(/[/\\]+$/, '')
  const sep = base.includes('/') ? '/' : '\\'
  if (createSubfolder.value) {
    return `${base}${sep}${archiveBaseName.value}`
  }
  return base
})

const breadcrumbs = computed(() => {
  if (!currentSubDir.value) return []
  return currentSubDir.value.split('/').filter(Boolean)
})

function goToRoot() {
  currentSubDir.value = ''
  filterQuery.value = ''
}

function goToCrumb(index: number) {
  const crumbs = breadcrumbs.value.slice(0, index + 1)
  currentSubDir.value = crumbs.join('/')
  filterQuery.value = ''
}

function goUp() {
  if (!currentSubDir.value) return
  const crumbs = breadcrumbs.value
  crumbs.pop()
  currentSubDir.value = crumbs.join('/')
}

function handleRowDblClick(item: VirtualArchiveItem) {
  if (item.isDirectory) {
    currentSubDir.value = item.fullRelativePath
    filterQuery.value = ''
  }
}

// Compute items visible in the current directory or search query
const visibleItems = computed<VirtualArchiveItem[]>(() => {
  if (filterQuery.value.trim()) {
    const q = filterQuery.value.toLowerCase().trim()
    return entries.value
      .filter((e) => e.path.toLowerCase().includes(q))
      .map((e) => {
        const norm = e.path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
        return {
          name: norm,
          fullRelativePath: norm,
          isDirectory: e.isDirectory,
          size: e.size,
          packedSize: e.packedSize,
          modified: e.modified,
          encrypted: e.encrypted,
        }
      })
  }

  const cur = currentSubDir.value ? currentSubDir.value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : ''
  const prefix = cur ? cur + '/' : ''

  const foldersMap = new Map<string, VirtualArchiveItem>()
  const filesList: VirtualArchiveItem[] = []

  for (const entry of entries.value) {
    const norm = entry.path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    if (norm === cur) continue

    if (!prefix || norm.startsWith(prefix)) {
      const remainder = prefix ? norm.slice(prefix.length) : norm
      const parts = remainder.split('/')

      if (parts.length === 1) {
        // Direct child
        if (entry.isDirectory) {
          if (!foldersMap.has(parts[0])) {
            foldersMap.set(parts[0], {
              name: parts[0],
              fullRelativePath: prefix + parts[0],
              isDirectory: true,
              size: entry.size || 0,
              packedSize: entry.packedSize,
              modified: entry.modified,
              encrypted: entry.encrypted,
            })
          }
        } else {
          filesList.push({
            name: parts[0],
            fullRelativePath: prefix + parts[0],
            isDirectory: false,
            size: entry.size,
            packedSize: entry.packedSize,
            modified: entry.modified,
            encrypted: entry.encrypted,
          })
        }
      } else {
        // Nested child -> parts[0] is a folder at current directory level
        const folderName = parts[0]
        if (!foldersMap.has(folderName)) {
          foldersMap.set(folderName, {
            name: folderName,
            fullRelativePath: prefix + folderName,
            isDirectory: true,
            size: entry.size || 0,
            packedSize: entry.packedSize,
            modified: entry.modified,
            encrypted: entry.encrypted,
          })
        } else {
          const existing = foldersMap.get(folderName)!
          existing.size += entry.size || 0
          if (entry.packedSize) existing.packedSize = (existing.packedSize || 0) + entry.packedSize
        }
      }
    }
  }

  const sortedFolders = Array.from(foldersMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
  const sortedFiles = filesList.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  return [...sortedFolders, ...sortedFiles]
})

const totalArchiveSize = computed(() => {
  return entries.value.reduce((acc, e) => acc + (e.size || 0), 0)
})

async function loadArchive(pwd?: string) {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await window.electronAPI.listArchive(props.archivePath, pwd)
    if (res.success && res.entries) {
      entries.value = res.entries
      needPassword.value = false
      if (res.entries.some((e) => e.encrypted)) {
        isEncrypted.value = true
      }
    } else {
      if (res.isEncrypted || (res.error && res.error.includes('пароль'))) {
        needPassword.value = true
        isEncrypted.value = true
      }
      errorMessage.value = res.error || 'Не вдалося відкрити архів'
    }
  } catch (err: any) {
    errorMessage.value = err.message
  } finally {
    loading.value = false
  }
}

function reloadWithPassword() {
  if (!passwordInput.value.trim()) return
  loadArchive(passwordInput.value.trim())
}

async function extractAll() {
  loading.value = true
  try {
    const fullTarget = finalExtractPath.value
    const pwd = passwordInput.value.trim() || undefined

    const res = await window.electronAPI.extractArchive(props.archivePath, fullTarget, pwd)
    if (res.success) {
      emit('extracted', fullTarget)
      emit('close')
    } else {
      errorMessage.value = res.error || 'Помилка розпакування'
    }
  } catch (err: any) {
    errorMessage.value = err.message
  } finally {
    loading.value = false
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  } else if (e.key === 'Backspace' && currentSubDir.value && !filterQuery.value) {
    e.preventDefault()
    goUp()
  }
}

onMounted(() => {
  loadArchive()
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>
