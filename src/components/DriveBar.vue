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
      :data-tooltip="getDriveTooltip(drive)"
      data-tooltip-pos="bottom"
      :title="getDriveTooltip(drive)"
      @click="$emit('select-drive', drive.path)"
    >
      <component :is="getIcon(drive.icon)" :size="13" :title="drive.name" class="drive-icon" />
      <span class="drive-name">{{ drive.name }}</span>
      <span v-if="drive.freeSpace !== undefined" class="drive-space-badge" :title="'Вільно: ' + formatBytes(drive.freeSpace)">
        {{ formatBytes(drive.freeSpace) }}
      </span>
      <button 
        v-if="drive.isRemovable"
        class="drive-eject-btn"
        title="Витягти носій (Eject)"
        @click.stop="$emit('eject-drive', drive.path)"
      >
        <CircleArrowUp :size="11" title="Витягти носій" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
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
  CircleArrowUp
} from 'lucide-vue-next'

const props = defineProps<{
  drives: DriveItem[]
  currentPath: string
}>()

defineEmits<{
  (e: 'select-drive', path: string): void
  (e: 'eject-drive', path: string): void
}>()

function isDriveActive(drivePath: string): boolean {
  if (drivePath === '/') {
    return props.currentPath === '/'
  }
  return props.currentPath === drivePath || props.currentPath.startsWith(drivePath + '/')
}

function getDriveTooltip(drive: DriveItem): string {
  const parts = [drive.name, `(${drive.path})`]
  if (drive.type === 'usb') {
    parts.unshift('[USB Носій]')
  } else if (drive.type === 'dmg') {
    parts.unshift('[Образ диску]')
  }
  if (drive.freeSpace !== undefined && drive.totalSpace !== undefined) {
    parts.push(`• ${formatBytes(drive.freeSpace)} вільно з ${formatBytes(drive.totalSpace)}`)
  }
  return parts.join(' ')
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
