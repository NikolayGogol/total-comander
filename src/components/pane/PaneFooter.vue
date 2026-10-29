<template>
  <div class="pane-footer">
    <div class="pane-footer-left">
      <span v-if="selectedCount > 0" class="pane-footer-selected">
        {{ selectedCount }} selected ({{ formatBytes(selectedSize) }})
      </span>
      <span v-else> {{ totalDirectories }} dirs, {{ totalFiles }} files ({{ formatBytes(totalFileSize) }}) </span>
    </div>

    <!-- Free & Total Disk Space for current pane -->
    <div
      v-if="freeSpace !== undefined && totalSpace !== undefined"
      class="pane-footer-space"
      :title="'Вільне місце на диску: ' + formatBytes(freeSpace) + ' з ' + formatBytes(totalSpace)"
    >
      <HardDrive :size="12" class="pane-footer-space-icon" title="Дисковий простір" />
      <span>{{ formatBytes(freeSpace) }} вільно з {{ formatBytes(totalSpace) }}</span>
    </div>

    <div class="pane-footer-right">
      <span>{{ itemCount }} items</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { HardDrive } from 'lucide-vue-next'
import { formatBytes } from '@/utils/formatters'

defineProps<{
  selectedCount: number
  selectedSize: number
  totalDirectories: number
  totalFiles: number
  totalFileSize: number
  itemCount: number
  freeSpace?: number
  totalSpace?: number
}>()
</script>
