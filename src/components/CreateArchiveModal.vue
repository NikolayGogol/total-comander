<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card archive-create-card">
      <div class="modal-header">
        <div class="modal-title">
          <Archive :size="16" class="icon-amber" />
          <span>Створення архіву (Alt+F5)</span>
        </div>
        <button class="modal-close-btn" title="Скасувати (Esc)" @click="$emit('close')">
          <X :size="15" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Target Archive Name -->
        <div class="archive-field-group">
          <label class="archive-label">Ім'я та шлях архіву:</label>
          <div class="archive-input-wrapper">
            <input 
              ref="nameInputRef"
              v-model="archiveName" 
              type="text" 
              class="form-input" 
              placeholder="archive_name"
              @keydown.enter="submit"
            />
            <span class="archive-ext-badge">.{{ selectedFormat }}</span>
          </div>
          <span class="archive-subtext">Папка: <code>{{ currentDir }}</code></span>
        </div>

        <!-- Format Selector (7z, zip, rar) -->
        <div class="archive-field-group">
          <label class="archive-label">Формат архівування:</label>
          <div class="archive-format-grid">
            <button 
              type="button" 
              class="format-btn" 
              :class="{ 'is-selected': selectedFormat === 'zip' }"
              @click="setFormat('zip')"
            >
              <span class="format-title">ZIP</span>
              <span class="format-desc">Вбудований / Швидкий</span>
            </button>
            <button 
              type="button" 
              class="format-btn" 
              :class="{ 'is-selected': selectedFormat === '7z' }"
              @click="setFormat('7z')"
            >
              <span class="format-title">7Z</span>
              <span class="format-desc">Вбудований / Макс. стиск</span>
            </button>
            <button 
              type="button" 
              class="format-btn" 
              :class="{ 'is-selected': selectedFormat === 'rar' }"
              @click="setFormat('rar')"
            >
              <span class="format-title">RAR</span>
              <span class="format-desc">Вбудований RAR</span>
            </button>
          </div>
        </div>

        <!-- Password Protection -->
        <div class="archive-field-group">
          <div class="archive-label-row">
            <label class="archive-label">
              <Lock :size="13" class="icon-blue" />
              <span>Захист паролем (необов'язково):</span>
            </label>
            <button 
              type="button" 
              class="btn-text-toggle" 
              @click="showPassword = !showPassword"
              tabindex="-1"
            >
              {{ showPassword ? 'Сховати' : 'Показати' }}
            </button>
          </div>
          <div class="archive-input-wrapper">
            <input 
              v-model="password" 
              :type="showPassword ? 'text' : 'password'" 
              class="form-input" 
              placeholder="Введіть пароль для шифрування..."
              @keydown.enter="submit"
            />
          </div>
          <label v-if="selectedFormat === '7z' && password" class="archive-checkbox-label">
            <input type="checkbox" v-model="encryptHeader" />
            <span>Шифрувати також імена файлів (Header Encryption)</span>
          </label>
        </div>

        <!-- Compression Level -->
        <div class="archive-field-group">
          <label class="archive-label">Рівень стиснення:</label>
          <div class="archive-level-selector">
            <label class="level-radio">
              <input type="radio" value="1" v-model.number="compressionLevel" />
              <span>Швидке (1)</span>
            </label>
            <label class="level-radio">
              <input type="radio" value="5" v-model.number="compressionLevel" />
              <span>Звичайне (5)</span>
            </label>
            <label class="level-radio">
              <input type="radio" value="9" v-model.number="compressionLevel" />
              <span>Максимальне (9)</span>
            </label>
          </div>
        </div>

        <!-- Items Preview -->
        <div class="archive-field-group">
          <span class="archive-label">Вибрано елементів: {{ sources.length }}</span>
          <div class="archive-items-list">
            <div v-for="item in sources.slice(0, 4)" :key="item" class="archive-item-preview">
              {{ item.split(/[/\\]/).filter(Boolean).pop() }}
            </div>
            <div v-if="sources.length > 4" class="archive-item-more">
              + ще {{ sources.length - 4 }} елемент(ів)
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('close')">Cancel (Esc)</button>
        <button 
          ref="confirmBtnRef"
          class="btn-primary" 
          :disabled="isProcessing || !archiveName.trim()"
          @click="submit"
        >
          {{ isProcessing ? 'Архівування...' : 'Архівувати (Enter)' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Archive, Lock, X } from 'lucide-vue-next'
import type { CreateArchiveOptions } from '../types'

const props = defineProps<{
  sources: string[]
  currentDir: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', targetPath: string): void
  (e: 'toast', message: string, type: 'info' | 'success' | 'error'): void
}>()

const archiveName = ref('archive')
const selectedFormat = ref<'zip' | '7z' | 'rar'>('zip')
const password = ref('')
const showPassword = ref(false)
const encryptHeader = ref(true)
const compressionLevel = ref(5)
const isProcessing = ref(false)
const nameInputRef = ref<HTMLInputElement | null>(null)
const confirmBtnRef = ref<HTMLButtonElement | null>(null)

function setFormat(fmt: 'zip' | '7z' | 'rar') {
  selectedFormat.value = fmt
}

async function submit() {
  if (isProcessing.value || !archiveName.value.trim()) return
  isProcessing.value = true

  const rawBase = archiveName.value.trim().replace(/\.(zip|7z|rar)$/i, '')
  const dir = props.currentDir.trim()
  const sep = dir.includes('/') ? '/' : '\\'
  const cleanDir = dir.endsWith('/') || dir.endsWith('\\') ? dir : `${dir}${sep}`
  const fullTargetPath = `${cleanDir}${rawBase}.${selectedFormat.value}`

  try {
    const cleanSources = Array.isArray(props.sources) ? Array.from(props.sources).map((s) => String(s)) : []
    const cleanOptions = {
      sources: cleanSources,
      targetPath: String(fullTargetPath),
      format: selectedFormat.value,
      password: password.value ? password.value.trim() : undefined,
      level: Number(compressionLevel.value) || 5,
      encryptHeader: Boolean(encryptHeader.value),
    }

    const res = await window.electronAPI.createArchive(JSON.parse(JSON.stringify(cleanOptions)))

    if (res.success) {
      emit('created', fullTargetPath)
      emit('close')
    } else {
      emit('toast', res.error || 'Помилка створення архіву', 'error')
    }
  } catch (err: any) {
    emit('toast', err.message || 'Помилка створення архіву', 'error')
  } finally {
    isProcessing.value = false
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    submit()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

onMounted(() => {
  if (props.sources.length === 1) {
    const s = props.sources[0].split(/[/\\]/).filter(Boolean).pop() || 'archive'
    archiveName.value = s.replace(/\.[^.]+$/, '')
  } else if (props.sources.length > 1) {
    const parentFolder = props.currentDir.split(/[/\\]/).filter(Boolean).pop() || 'archive'
    archiveName.value = parentFolder
  }

  nextTick(() => {
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  })

  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>
