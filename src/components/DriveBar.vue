<template>
  <div class="drive-bar">
    <div 
      v-for="drive in drives" 
      :key="drive.path"
      class="drive-pill"
      :class="{ 
        active: isDriveActive(drive.path),
        'is-usb': drive.type === 'usb',
        'is-dmg': drive.type === 'dmg'
      }"
      :title="getDriveTooltip(drive)"
      @click="$emit('select-drive', drive.path)"
    >
      <component :is="getIcon(drive.icon)" :size="13" :title="drive.name" class="drive-icon" />
      <span class="drive-name">{{ drive.name }}</span>
      <span 
        v-if="drive.availableSpace !== undefined || drive.freeSpace !== undefined" 
        class="drive-space-badge"
        :title="getDriveTooltip(drive)"
      >
        {{ formatDriveBadge(drive) }}
      </span>
      <button 
        v-if="drive.isRemovable"
        class="drive-eject-btn"
        :disabled="ejectingPath === drive.path"
        :title="ejectingPath === drive.path ? 'Витягування носія...' : 'Витягти носій (Eject)'"
        @click.stop="handleEject(drive.path)"
      >
        <Loader2 v-if="ejectingPath === drive.path" :size="11" class="spin" />
        <CircleArrowUp v-else :size="11" title="Витягти носій" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { DriveItem } from '../types'
import { formatBytes } from '../utils/formatters'
import { 
  HardDrive, 
  Home, 
  Monitor, 
  FileText, 
  Download, 
  Grid, 
  Disc,
  Folder,
  Usb,
  CircleArrowUp,
  Loader2
} from 'lucide-vue-next'

const props = defineProps<{
  drives: DriveItem[]
  currentPath: string
}>()

const emit = defineEmits<{
  (e: 'select-drive', path: string): void
  (e: 'eject-drive', path: string): void
}>()

const ejectingPath = ref<string | null>(null)

function handleEject(path: string) {
  if (ejectingPath.value) return
  ejectingPath.value = path
  try {
    emit('eject-drive', path)
  } finally {
    setTimeout(() => {
      if (ejectingPath.value === path) {
        ejectingPath.value = null
      }
    }, 2500)
  }
}

function isDriveActive(drivePath: string): boolean {
  if (drivePath === '/') {
    return props.currentPath === '/'
  }
  return props.currentPath === drivePath || props.currentPath.startsWith(drivePath + '/')
}

function formatDriveBadge(drive: DriveItem): string {
  const avail = drive.availableSpace ?? drive.freeSpace
  return avail !== undefined ? formatBytes(avail) : ''
}

function getDriveTooltip(drive: DriveItem): string {
  const lines: string[] = []
  const titlePrefix = drive.type === 'usb' ? '🔌 USB-носій: ' : (drive.type === 'dmg' ? '💿 Образ диска: ' : '💾 Диск / Папка: ')
  lines.push(`${titlePrefix}${drive.name}`)
  lines.push(`Шлях: ${drive.path}`)

  const avail = drive.availableSpace ?? drive.freeSpace
  if (avail !== undefined) {
    lines.push(`• Доступно для запису (Finder): ${formatBytes(avail)}`)
  }
  if (drive.freeSpace !== undefined) {
    lines.push(`• Фізично вільні блоки SSD: ${formatBytes(drive.freeSpace)}`)
  }
  if (drive.purgeableSpace && drive.purgeableSpace > 50 * 1024 * 1024) {
    lines.push(`• Очищуваний кеш macOS (Purgeable): ${formatBytes(drive.purgeableSpace)}`)
    lines.push(`💡 macOS APFS автоматично вивільнить цей кеш, якщо вам знадобиться місце`)
  }
  if (drive.totalSpace !== undefined) {
    lines.push(`• Загальний обсяг: ${formatBytes(drive.totalSpace)}`)
  }

  return lines.join('\n')
}

function getIcon(name: string) {
  switch (name) {
    case 'HardDrive': return HardDrive
    case 'Home': return Home
    case 'Monitor': return Monitor
    case 'FileText': return FileText
    case 'Download': return Download
    case 'Grid': return Grid
    case 'Disc': return Disc
    case 'Usb': return Usb
    default: return Folder
  }
}
</script>
