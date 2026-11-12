<template>
  <div
    class="remote-minimized-pill"
    title="Мережеве з'єднання активно (натисніть для розгортання)"
    @click="$emit('maximize')"
  >
    <div class="pill-status-dot"></div>
    <div class="pill-info">
      <span class="pill-badge">{{ protocol.toUpperCase() }}</span>
      <span class="pill-host">{{ host || "Мережеве з'єднання" }}</span>
    </div>
    <div class="pill-actions">
      <button type="button" class="btn-pill-action" title="Розгорнути вікно (Cmd+M)" @click.stop="$emit('maximize')">
        <Maximize2 :size="12" />
      </button>
      <button
        type="button"
        class="btn-pill-action btn-pill-close"
        title="Закрити з'єднання"
        @click.stop="$emit('close')"
      >
        <X :size="12" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Maximize2, X } from 'lucide-vue-next'

defineProps<{
  protocol: string
  host: string
}>()

defineEmits<{
  (e: 'maximize'): void
  (e: 'close'): void
}>()
</script>
