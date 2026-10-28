<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card viewer-card">
      <div class="modal-header">
        <div class="modal-title">
          <Eye :size="16" class="icon-cyan" title="Preview" />
          <span>{{ fileName }}</span>
          <span class="file-size-tag" :title="'File size: ' + formatBytes(fileSize)">{{ formatBytes(fileSize) }}</span>
        </div>
        <div class="viewer-actions">
          <!-- macOS Quick Look trigger -->
          <button class="btn-secondary quicklook-btn" title="Відкрити у програмі за замовчуванням" @click="openSystemApp">
            <ExternalLink :size="13" title="QuickLook" />
            <span>Відкрити в системі</span>
          </button>

          <!-- Viewer Modes -->
          <div class="mode-switch">
            <button 
              class="mode-btn" 
              :class="{ active: viewMode === 'text' }"
              title="View as text/code"
              @click="viewMode = 'text'"
            >Text</button>
            <button 
              v-if="isImageFile"
              class="mode-btn" 
              :class="{ active: viewMode === 'image' }"
              title="View image preview"
              @click="viewMode = 'image'"
            >Image</button>
            <button 
              class="mode-btn" 
              :class="{ active: viewMode === 'hex' }"
              title="Inspect raw hexadecimal dump"
              @click="viewMode = 'hex'"
            >Hex</button>
          </div>

          <button class="modal-close-btn" title="Close viewer (Esc)" @click="$emit('close')">
            <X :size="15" title="Close" />
          </button>
        </div>
      </div>

      <div class="modal-body viewer-body">
        <div v-if="loading" class="viewer-status">Loading file content...</div>
        <div v-else-if="error" class="viewer-status error">{{ error }}</div>

        <!-- Image Mode -->
        <div v-else-if="viewMode === 'image' && isImageFile" class="image-viewer-container">
          <img :src="imageSrc" class="preview-image" alt="Preview" />
        </div>

        <!-- Hex Mode -->
        <div v-else-if="viewMode === 'hex'" class="hex-viewer-container">
          <pre class="hex-content">{{ hexRepresentation }}</pre>
        </div>

        <!-- Text Mode -->
        <div v-else class="text-viewer-container">
          <div class="line-numbers">
            <div v-for="line in lineCount" :key="line" class="line-num">{{ line }}</div>
          </div>
          <pre class="text-content"><code>{{ textContent }}</code></pre>
        </div>
      </div>

      <div class="modal-footer">
        <span class="viewer-filepath">{{ filePath }}</span>
        <button class="btn-secondary" @click="$emit('close')">Close (Esc)</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { formatBytes } from '../utils/formatters'
import { Eye, X, ExternalLink } from 'lucide-vue-next'

const props = defineProps<{
  filePath: string
  fileName: string
  fileSize: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const viewMode = ref<'text' | 'image' | 'hex'>('text')
const loading = ref(true)
const error = ref<string | null>(null)
const textContent = ref('')
const rawBase64 = ref('')
const isBinary = ref(false)

const isImageFile = computed(() => {
  const ext = props.fileName.split('.').pop()?.toLowerCase() || ''
  return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)
})

const imageSrc = computed(() => {
  if (!rawBase64.value && !textContent.value) return ''
  const ext = props.fileName.split('.').pop()?.toLowerCase() || 'png'
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`
  const data = rawBase64.value || btoa(textContent.value)
  return `data:${mime};base64,${data}`
})

const lineCount = computed(() => {
  return textContent.value.split('\n').length
})

const hexRepresentation = computed(() => {
  let str = textContent.value
  if (isBinary.value && rawBase64.value) {
    str = atob(rawBase64.value.slice(0, 16384))
  }
  const lines: string[] = []
  const maxBytes = Math.min(str.length, 4096)

  for (let i = 0; i < maxBytes; i += 16) {
    const chunk = str.slice(i, i + 16)
    const offset = i.toString(16).padStart(8, '0')
    const hex = Array.from(chunk)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(48, ' ')
    const ascii = Array.from(chunk)
      .map((c) => {
        const code = c.charCodeAt(0)
        return code >= 32 && code <= 126 ? c : '.'
      })
      .join('')

    lines.push(`${offset}  ${hex}  |${ascii}|`)
  }

  return lines.join('\n')
})

async function openSystemApp() {
  await window.electronAPI.openPath(props.filePath)
}

onMounted(async () => {
  if (isImageFile.value) {
    viewMode.value = 'image'
  }

  try {
    const res = await window.electronAPI.readFile(props.filePath)
    if (res.success) {
      if (res.isBinary) {
        isBinary.value = true
        rawBase64.value = res.content || ''
        if (!isImageFile.value) {
          viewMode.value = 'hex'
        }
      } else {
        textContent.value = res.content || ''
      }
    } else {
      error.value = res.error || 'Failed to read file'
    }
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})
</script>
