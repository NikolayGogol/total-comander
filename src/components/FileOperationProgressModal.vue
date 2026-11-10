<template>
  <div class="modal-overlay" @click.self="handleBackdropClick">
    <div class="modal-card op-progress-modal-card">
      <div class="modal-header">
        <div class="modal-title">
          <component :is="typeIcon" :size="16" class="modal-icon text-accent" />
          <span>{{ titleText }}</span>
        </div>
        <div class="op-status-badge" :class="statusBadgeClass">
          <span class="status-dot"></span>
          <span>{{ statusBadgeText }}</span>
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
            <span class="dest-path" :title="targetDir">{{ targetDir }}</span>
          </div>
        </div>

        <!-- Current File Being Transferred -->
        <div class="current-file-box">
          <div class="file-info-row">
            <div class="file-name-wrap">
              <FileText :size="15" class="file-icon" />
              <span class="file-name" :title="data.currentFile">{{
                data.currentFile || 'Підготовка списку файлів...'
              }}</span>
            </div>
            <div class="file-counter">
              <span>{{ data.itemsDone }} / {{ data.totalItems }} елемент(ів)</span>
            </div>
          </div>
        </div>

        <!-- Progress Bar & Traffic -->
        <div class="progress-section">
          <div class="progress-track">
            <div ref="progressFillRef" class="progress-fill"></div>
          </div>
          <div class="progress-meta-row">
            <span class="percent-label">{{ data.percent }}%</span>
            <span class="traffic-label">
              {{ formatBytes(data.bytesTransferred) }} з {{ formatBytes(data.totalBytes) }}
              <span v-if="data.bytesRemaining > 0" class="remaining-traffic">
                (Лишилося: {{ formatBytes(data.bytesRemaining) }})
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
        <span class="footer-hint">{{ footerHintText }}</span>
        <button type="button" class="btn-secondary btn-cancel-op" :disabled="data.isDone" @click="$emit('cancel')">
          <X :size="14" />
          <span>{{ data.isDone ? 'Закрити' : 'Скасувати' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { TransferProgressData } from '@/types'
import { formatBytes, formatDuration } from '@/utils/formatters'
import { Clock, Copy, FileText, Folder, Move, Timer, X, Zap } from 'lucide-vue-next'

const props = defineProps<{
  data: TransferProgressData
  targetDir: string
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'close'): void
}>()

const progressFillRef = ref<HTMLElement | null>(null)

// Update CSS Custom Property on progress bar DOM element (Rule 4: no inline styles in template!)
watch(
  () => props.data.percent,
  (pct) => {
    if (progressFillRef.value) {
      const safePct = Math.max(0, Math.min(100, pct || 0))
      progressFillRef.value.style.setProperty('--progress-width', `${safePct}%`)
    }
  },
  { immediate: true }
)

const isMove = computed(() => props.data.type === 'move')

const typeIcon = computed(() => (isMove.value ? Move : Copy))

const titleText = computed(() => (isMove.value ? 'Переміщення файлів' : 'Копіювання файлів'))

const statusBadgeClass = computed(() => {
  if (props.data.canceled) return 'is-canceled'
  if (props.data.isDone) return 'is-done'
  return 'is-running'
})

const statusBadgeText = computed(() => {
  if (props.data.canceled) return 'Скасовано'
  if (props.data.isDone) return 'Завершено'
  return 'В процесі'
})

// Stabilized speed display (updates at most every 600ms to eliminate decimal jitter)
const displayedSpeed = ref<number>(0)
let lastSpeedUpdateTime = 0

watch(
  () => props.data.speedBytesPerSec,
  (newSpeed) => {
    const now = Date.now()
    if (props.data.isDone || props.data.canceled || newSpeed === 0) {
      displayedSpeed.value = 0
      lastSpeedUpdateTime = now
      return
    }
    if (displayedSpeed.value === 0 || now - lastSpeedUpdateTime >= 600) {
      displayedSpeed.value = newSpeed
      lastSpeedUpdateTime = now
    }
  },
  { immediate: true }
)

const currentSpeedFormatted = computed(() => {
  if (props.data.isDone || props.data.canceled) return '0 B/с'
  if (!displayedSpeed.value || displayedSpeed.value <= 0) return 'Розрахунок...'
  return `${formatBytes(displayedSpeed.value)}/с`
})

// Stabilized, monotonic countdown for remaining time (ETA)
const localEta = ref<number>(-1)
let etaInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  etaInterval = setInterval(() => {
    if (localEta.value > 0 && !props.data.isDone && !props.data.canceled) {
      localEta.value -= 1
    }
  }, 1000)
})

onUnmounted(() => {
  if (etaInterval) {
    clearInterval(etaInterval)
    etaInterval = null
  }
})

watch(
  () => props.data.etaSeconds,
  (newEta) => {
    if (newEta === undefined || newEta === null || newEta < 0) {
      localEta.value = -1
      return
    }
    if (props.data.isDone) {
      localEta.value = 0
      return
    }
    if (localEta.value <= 0) {
      localEta.value = newEta
    } else {
      // If server ETA is close to current local countdown, preserve the smooth 1s tick
      if (Math.abs(localEta.value - newEta) > 3) {
        localEta.value = newEta
      }
    }
  },
  { immediate: true }
)

const etaFormatted = computed(() => {
  if (props.data.isDone) return '00:00'
  if (props.data.canceled) return '--'
  if (localEta.value < 0) return 'Розрахунок...'
  return formatDuration(localEta.value)
})

const elapsedFormatted = computed(() => {
  return formatDuration(props.data.elapsedSeconds || 0)
})

const footerHintText = computed(() => {
  if (props.data.canceled) return 'Операцію перервано користувачем'
  if (props.data.isDone) return 'Операцію успішно виконано'
  return 'Зачекайте, триває обробка файлів...'
})

function handleBackdropClick() {
  if (props.data.isDone || props.data.canceled) {
    emit('close')
  }
}
</script>
