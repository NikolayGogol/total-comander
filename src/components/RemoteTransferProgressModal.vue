<template>
  <div v-if="open" class="modal-overlay" @click.self="handleBackdropClick">
    <div class="modal-card op-progress-modal-card">
      <div class="modal-header">
        <div class="modal-title">
          <Upload v-if="data?.type === 'upload'" :size="16" class="text-accent text-emerald" />
          <Download v-else :size="16" class="text-accent text-blue" />
          <span>{{ titleText }}</span>
        </div>
        <div class="op-status-badge is-running">
          <span class="status-dot"></span>
          <span>{{ protocol.toUpperCase() }} • Передача</span>
        </div>
      </div>

      <div class="modal-body">
        <!-- Target Directory Info -->
        <div class="op-destination-card">
          <div class="dest-icon-wrap">
            <Folder :size="18" class="dest-icon" />
          </div>
          <div class="dest-details">
            <span class="dest-label">Призначення:</span>
            <span class="dest-path" :title="targetPath">{{ targetPath }}</span>
          </div>
        </div>

        <!-- Current File Being Transferred -->
        <div class="current-file-box">
          <div class="file-info-row">
            <div class="file-name-wrap">
              <FileText :size="15" class="file-icon" />
              <span class="file-name" :title="data?.fileName">{{ data?.fileName || 'Підготовка файлу...' }}</span>
            </div>
            <div class="file-counter">
              <span>{{ data?.percent || 0 }}%</span>
            </div>
          </div>
        </div>

        <!-- Progress Bar & Traffic -->
        <div class="progress-section">
          <div class="progress-track">
            <div ref="progressFillRef" class="progress-fill"></div>
          </div>
          <div class="progress-meta-row">
            <span class="percent-label">{{ data?.percent || 0 }}%</span>
            <span class="traffic-label">
              {{ formatBytes(data?.bytesTransferred) }} з
              {{ formatBytes(data?.totalBytes) }}
              <span v-if="(data?.bytesRemaining || 0) > 0" class="remaining-traffic">
                (Залишилося: {{ formatBytes(data?.bytesRemaining) }})
              </span>
            </span>
          </div>
        </div>

        <!-- Real-time Metrics Grid (Speed, ETA, Elapsed) -->
        <div class="metrics-grid">
          <!-- Speed Card -->
          <div class="metric-card">
            <div class="metric-header">
              <Zap :size="14" class="metric-icon text-speed" />
              <span class="metric-title">Швидкість</span>
            </div>
            <div class="metric-value">{{ currentSpeedFormatted }}</div>
            <div class="metric-hint">у реальному часі</div>
          </div>

          <!-- ETA Card -->
          <div class="metric-card">
            <div class="metric-header">
              <Clock :size="14" class="metric-icon text-eta" />
              <span class="metric-title">Лишилося часу</span>
            </div>
            <div class="metric-value">{{ etaFormatted }}</div>
            <div class="metric-hint">розрахунковий час</div>
          </div>

          <!-- Elapsed Card -->
          <div class="metric-card">
            <div class="metric-header">
              <Timer :size="14" class="metric-icon text-elapsed" />
              <span class="metric-title">Минуло</span>
            </div>
            <div class="metric-value">{{ elapsedFormatted }}</div>
            <div class="metric-hint">тривалість</div>
          </div>
        </div>
      </div>

      <!-- Footer with Cancel Button -->
      <div class="modal-footer op-progress-footer">
        <span class="footer-hint">Не закривайте програму під час передачі...</span>
        <button type="button" class="btn-secondary btn-cancel-op" @click="$emit('cancel')">
          <X :size="14" />
          <span>Скасувати</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Folder, FileText, Upload, Download, Zap, Clock, Timer, X } from 'lucide-vue-next'
import { formatBytes, formatDuration, formatEta } from '@/utils/formatters'
import type { RemoteTransferProgress } from '@/types'

const props = defineProps<{
  open: boolean
  data: RemoteTransferProgress | null
  targetPath: string
  protocol: string
}>()

defineEmits<{
  (e: 'cancel'): void
}>()

const progressFillRef = ref<HTMLDivElement | null>(null)

const titleText = computed(() => {
  if (props.data?.type === 'upload') return 'Надсилання файлу на сервер'
  return 'Завантаження файлу з сервера'
})

const currentSpeedFormatted = computed(() => {
  if (!props.data?.speedBytesPerSec || props.data.speedBytesPerSec <= 0) return '--'
  return `${formatBytes(props.data.speedBytesPerSec)}/с`
})

const etaFormatted = computed(() => {
  if (!props.data) return '--'
  return formatEta(props.data.etaSeconds)
})

const elapsedFormatted = computed(() => {
  if (!props.data) return '00:00'
  return formatDuration(props.data.elapsedSeconds)
})

watch(
  () => props.data?.percent,
  async (pct) => {
    await nextTick()
    if (progressFillRef.value) {
      progressFillRef.value.style.setProperty('width', `${Math.min(100, Math.max(0, pct || 0))}%`)
    }
  },
  { immediate: true }
)

function handleBackdropClick() {
  // Prevent accidental closing on backdrop click while transferring
}
</script>
