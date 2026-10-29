<template>
  <div class="drive-bar">
    <div
      v-for="drive in drives"
      :key="drive.path"
      class="drive-pill"
      :class="{
        active: isDriveActive(drive.path),
        'is-usb': drive.type === 'usb',
      }"
      :data-tooltip="getDriveTooltip(drive)"
      data-tooltip-pos="bottom"
      :title="getDriveTooltip(drive)"
      @click="$emit('select-drive', drive.path)"
    >
      <component :is="getIcon(drive.icon)" :size="13" :title="drive.name" class="drive-icon" />
      <span class="drive-name">{{ drive.name }}</span>
      <span
        v-if="drive.freeSpace !== undefined"
        class="drive-space-badge"
        :title="'Вільно: ' + formatBytes(drive.freeSpace)"
      >
        {{ formatBytes(drive.freeSpace) }}
      </span>
      <button
        v-if="drive.isRemovable"
        class="drive-eject-btn"
        :disabled="ejectingPath === drive.path"
        :title="ejectingPath === drive.path ? 'Вилучення...' : 'Вилучити носій (Eject)'"
        @click.stop="handleEject(drive.path)"
      >
        <Loader2 v-if="ejectingPath === drive.path" :size="11" class="spin" />
        <CircleArrowUp v-else :size="11" title="Вилучити носій" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { DriveItem } from '@/types'
import { formatBytes } from '@/utils/formatters'
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
  Loader2,
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
  const cur = props.currentPath.replace(/[/\\]+$/, '').toLowerCase()
  const drv = drivePath.replace(/[/\\]+$/, '').toLowerCase()
  return cur === drv || cur.startsWith(drv + '\\') || cur.startsWith(drv + '/')
}

function getDriveTooltip(drive: DriveItem): string {
  const parts = [drive.name]
  if (drive.type === 'usb') {
    parts.unshift('[USB Накопичувач]')
  } else if (drive.type === 'cdrom') {
    parts.unshift('[CD/DVD/ISO Образ]')
  }
  if (drive.label) {
    parts.push(`«${drive.label}»`)
  }
  parts.push(`(${drive.path})`)
  if (drive.freeSpace !== undefined && drive.totalSpace !== undefined) {
    parts.push(`• ${formatBytes(drive.freeSpace)} вільно з ${formatBytes(drive.totalSpace)}`)
  }
  return parts.join(' ')
}

function getIcon(name: string) {
  switch (name) {
    case 'HardDrive':
      return HardDrive
    case 'Home':
      return Home
    case 'Monitor':
      return Monitor
    case 'FileText':
      return FileText
    case 'Download':
      return Download
    case 'Grid':
      return Grid
    case 'Disc':
      return Disc
    case 'Usb':
      return Usb
    default:
      return Folder
  }
}
</script>
