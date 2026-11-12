<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card open-with-card">
      <div class="modal-header">
        <div class="modal-title">
          <AppWindow :size="16" class="icon-blue" />
          <span>Відкрити за допомогою...</span>
        </div>
        <button class="modal-close-btn" title="Закрити (Esc)" @click="$emit('close')">
          <X :size="15" />
        </button>
      </div>

      <div class="modal-body open-with-body">
        <!-- File Info Bar -->
        <div class="file-info-header">
          <div class="file-info-icon-col">
            <Archive v-if="isArchive(item)" :size="24" class="item-icon icon-archive" />
            <component :is="getIconComponent(item)" v-else :size="24" :class="['item-icon', getIconModifier(item)]" />
          </div>
          <div class="file-info-details">
            <div class="file-info-name" :title="item.path">
              {{ item.name }}
            </div>
            <div class="file-info-meta">
              <span>{{ formatBytes(item.size) }}</span>
              <span class="meta-dot">•</span>
              <span>{{ getFileTypeDescription(item.extension || item.name, item.isDirectory) }}</span>
            </div>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="open-with-search">
          <Search :size="14" class="search-icon" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            class="form-input search-input"
            placeholder="Швидкий пошук програми (VS Code, Notepad++, Chrome, VLC)..."
            @keydown.down.prevent="navigateList(1)"
            @keydown.up.prevent="navigateList(-1)"
            @keydown.enter.prevent="submitSelected"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="search-clear-btn"
            title="Очистити пошук"
            @click="searchQuery = ''"
          >
            <X :size="12" />
          </button>
        </div>

        <!-- App List -->
        <div class="open-with-list-wrapper">
          <div v-if="loading" class="open-with-state-box">
            <Loader2 :size="20" class="spin icon-blue" />
            <span>Пошук встановлених програм Windows...</span>
          </div>

          <div v-else-if="allFilteredApps.length === 0" class="open-with-state-box">
            <AlertCircle :size="20" class="icon-rose" />
            <span>Програм за запитом "{{ searchQuery }}" не знайдено</span>
          </div>

          <div v-else class="open-with-sections">
            <!-- Recommended Apps Section -->
            <div v-if="recommendedApps.length > 0 && !searchQuery.trim()" class="app-section">
              <div class="section-title">
                <Star :size="12" class="icon-amber" />
                <span>Рекомендовані для цього типу файлу</span>
              </div>
              <div class="app-list">
                <div
                  v-for="app in recommendedApps"
                  :key="'rec-' + app.path"
                  class="app-item"
                  :class="{ 'is-selected': selectedApp?.path === app.path }"
                  @click="selectedApp = app"
                  @dblclick="submit(app)"
                >
                  <div class="app-icon-wrapper">
                    <img
                      v-if="appIcons[app.path]"
                      :src="appIcons[app.path]"
                      class="app-icon-img"
                      :alt="app.name"
                      draggable="false"
                    />
                    <AppWindow v-else :size="20" class="app-icon-fallback" />
                  </div>
                  <div class="app-info">
                    <div class="app-name-row">
                      <span class="app-name">{{ app.name }}</span>
                      <span class="recommended-tag">Рекомендовано</span>
                    </div>
                    <div class="app-path" :title="app.path">{{ app.path }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- All Apps Section -->
            <div class="app-section">
              <div class="section-title">
                <span>
                  {{ searchQuery.trim() ? 'Результати пошуку' : 'Всі встановлені програми' }}
                  ({{ allFilteredApps.length }})
                </span>
              </div>
              <div class="app-list">
                <div
                  v-for="app in allFilteredApps"
                  :key="'all-' + app.path"
                  class="app-item"
                  :class="{ 'is-selected': selectedApp?.path === app.path }"
                  @click="selectedApp = app"
                  @dblclick="submit(app)"
                >
                  <div class="app-icon-wrapper">
                    <img
                      v-if="appIcons[app.path]"
                      :src="appIcons[app.path]"
                      class="app-icon-img"
                      :alt="app.name"
                      draggable="false"
                    />
                    <AppWindow v-else :size="20" class="app-icon-fallback" />
                  </div>
                  <div class="app-info">
                    <div class="app-name-row">
                      <span class="app-name">{{ app.name }}</span>
                    </div>
                    <div class="app-path" :title="app.path">{{ app.path }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer open-with-footer">
        <div class="footer-actions-left">
          <button
            type="button"
            class="btn-secondary btn-browse-app"
            title="Вибрати програму (.exe, .bat, .cmd) на диску комп'ютера"
            @click="browseDisk"
          >
            <FolderOpen :size="14" />
            <span>Огляд на диску...</span>
          </button>
          <button
            type="button"
            class="btn-secondary btn-system-dialog"
            title="Відкрити стандартний системний діалог Windows 'Відкрити за допомогою'"
            @click="openWithSystemDialog"
          >
            <ExternalLink :size="14" />
            <span>Діалог Windows...</span>
          </button>
        </div>

        <div class="footer-actions-right">
          <button type="button" class="btn-secondary" @click="$emit('close')">Скасувати (Esc)</button>
          <button type="button" class="btn-primary" :disabled="!selectedApp" @click="submitSelected">
            <ExternalLink :size="14" />
            <span>Відкрити (Enter)</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import {
  AppWindow,
  X,
  Search,
  Loader2,
  AlertCircle,
  Star,
  FolderOpen,
  ExternalLink,
  Archive,
  Folder,
  Code,
  Image,
  Film,
  Music,
  FileText,
  CornerLeftUp,
  File,
} from 'lucide-vue-next'
import type { FileItem, InstalledApp } from '@/types'
import { formatBytes, getFileTypeDescription, isArchive, getFileCategory } from '@/utils/formatters'

const props = defineProps<{
  item: FileItem
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-with', appPath: string): void
}>()

function getIconComponent(item: FileItem) {
  if (item.isDirectory) return Folder
  const cat = getFileCategory(item.extension || item.name, item.isDirectory).category
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
    case 'shortcut':
      return CornerLeftUp
    default:
      return File
  }
}

function getIconModifier(item: FileItem): string {
  return getFileCategory(item.extension || item.name, item.isDirectory).classModifier
}

const searchInputRef = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const apps = ref<InstalledApp[]>([])
const appIcons = ref<Record<string, string>>({})
const loading = ref(true)
const selectedApp = ref<InstalledApp | null>(null)

const RECOMMENDATION_MAP: Record<string, string[]> = {
  code: [
    'visual studio code',
    'notepad++',
    'antigravity ide',
    'sublime text',
    'webstorm',
    'intellij idea',
    'pycharm',
    'cursor',
    'блокнот',
    'notepad',
  ],
  image: ['paint', 'photos', 'adobe photoshop', 'figma', 'google chrome', 'firefox', 'irfanview', 'gimp'],
  video: ['vlc media player', 'vlc', 'media player', 'windows media player', 'potplayer', 'mpv', 'kmplayer'],
  audio: ['vlc media player', 'vlc', 'windows media player', 'media player', 'aimp', 'foobar2000', 'winamp', 'spotify'],
  doc: [
    'microsoft word',
    'word',
    'microsoft excel',
    'excel',
    'microsoft powerpoint',
    'powerpoint',
    'adobe acrobat',
    'блокнот',
    'notepad',
    'notepad++',
    'wordpad',
  ],
  archive: ['total commander', '7-zip', 'winrar', 'winzip', 'bandizip', 'peazip'],
}

function getCategoryRecommendations(): string[] {
  if (isArchive(props.item)) return RECOMMENDATION_MAP.archive
  const ext = (props.item.extension || '').toLowerCase()
  if (ext === 'iso') return ['total commander', '7-zip', 'winrar']
  const cat = getFileCategory(props.item.extension || props.item.name, props.item.isDirectory).category
  return RECOMMENDATION_MAP[cat] || ['notepad', 'блокнот']
}

const recommendedApps = computed(() => {
  const recList = getCategoryRecommendations()
  return apps.value.filter((app) => {
    const lower = app.name.toLowerCase()
    return recList.some((r) => lower === r || lower.includes(r))
  })
})

const allFilteredApps = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return apps.value
  return apps.value.filter((app) => app.name.toLowerCase().includes(q) || app.path.toLowerCase().includes(q))
})

function navigateList(dir: 1 | -1) {
  const list = allFilteredApps.value
  if (!list.length) return
  const curIdx = selectedApp.value ? list.findIndex((a) => a.path === selectedApp.value!.path) : -1
  const nextIdx = Math.max(0, Math.min(list.length - 1, curIdx + dir))
  selectedApp.value = list[nextIdx]
}

function submit(app: InstalledApp | null) {
  if (!app) return
  emit('open-with', app.path)
}

function submitSelected() {
  submit(selectedApp.value)
}

function openWithSystemDialog() {
  emit('open-with', 'system')
}

async function browseDisk() {
  try {
    const res = await window.electronAPI.selectAppDialog()
    if (!res.canceled && res.appPath) {
      emit('open-with', res.appPath)
    }
  } catch {}
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  nextTick(() => {
    searchInputRef.value?.focus()
  })

  try {
    const res = await window.electronAPI.getInstalledApps()
    if (res.success && res.apps) {
      apps.value = res.apps
      if (recommendedApps.value.length > 0) {
        selectedApp.value = recommendedApps.value[0]
      } else if (apps.value.length > 0) {
        selectedApp.value = apps.value[0]
      }

      // Fetch native app icons in batch
      try {
        const toFetch = res.apps.map((a) => ({
          path: a.path,
          name: a.name,
          isDirectory: false,
          extension: 'exe',
        }))
        const icons = await window.electronAPI.getFileIcons(toFetch as any)
        if (icons && typeof icons === 'object') {
          appIcons.value = icons
        }
      } catch {}
    }
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>
