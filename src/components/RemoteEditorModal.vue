<template>
  <div v-if="open" class="modal-overlay remote-editor-overlay" @click.self="requestClose">
    <div class="modal-card editor-card">
      <div class="modal-header">
        <div class="modal-title">
          <FileEdit :size="16" class="icon-amber" title="Редактор" />
          <span>{{ fileName }}</span>
          <span v-if="isDirty" class="dirty-badge" title="Є незбережені зміни">* Змінено</span>
        </div>
        <div class="editor-header-actions">
          <button
            class="btn-primary"
            :disabled="saving || !isDirty || loading"
            title="Зберегти зміни (Cmd+S)"
            @click="saveFile"
          >
            <Save :size="13" />
            <span>{{ saving ? 'Збереження...' : 'Зберегти (Cmd+S)' }}</span>
          </button>
          <button class="modal-close-btn" title="Закрити редактор (Esc)" @click="requestClose">
            <X :size="15" />
          </button>
        </div>
      </div>

      <div class="modal-body editor-body">
        <div v-if="loading" class="editor-status">Завантаження файлу з сервера...</div>
        <div v-else-if="error" class="editor-status error">{{ error }}</div>
        <div v-else class="editor-workspace">
          <div ref="lineNumbersRef" class="editor-line-numbers">
            <div v-for="line in lineCount" :key="line" class="editor-line-num">
              {{ line }}
            </div>
          </div>
          <textarea
            ref="textareaRef"
            v-model="content"
            class="editor-textarea"
            spellcheck="false"
            @scroll="syncScroll"
            @keydown="handleKeyDown"
          ></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <div class="editor-stats">
          <span>UTF-8</span>
          <span>{{ lineCount }} рядків</span>
          <span>{{ content.length }} симв.</span>
        </div>
        <div class="footer-actions">
          <button class="btn-secondary" @click="requestClose">Скасувати</button>
          <button class="btn-primary" :disabled="saving || !isDirty || loading" @click="saveFile">
            {{ saving ? 'Збереження...' : 'Зберегти' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { FileEdit, Save, X } from 'lucide-vue-next'
import type { RemoteConfig } from '@/types'

const props = defineProps<{
  open: boolean
  fileName: string
  remotePath: string
  config: RemoteConfig | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const content = ref('')
const originalContent = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const lineNumbersRef = ref<HTMLElement | null>(null)

const isDirty = computed(() => content.value !== originalContent.value)
const lineCount = computed(() => Math.max(1, content.value.split('\n').length))

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen && props.config && props.remotePath) {
      loading.value = true
      error.value = null
      content.value = ''
      originalContent.value = ''
      try {
        const res = await window.electronAPI.remoteReadText(props.config, props.remotePath)
        if (res.success && res.content !== undefined) {
          content.value = res.content
          originalContent.value = res.content
          await nextTick()
          if (textareaRef.value) {
            textareaRef.value.focus()
            textareaRef.value.setSelectionRange(0, 0)
          }
        } else {
          error.value = res.error || 'Не вдалося прочитати вміст файлу'
        }
      } catch (err: any) {
        error.value = err.message || 'Помилка при завантаженні файлу'
      } finally {
        loading.value = false
      }
    }
  },
  { immediate: true }
)

function syncScroll() {
  if (textareaRef.value && lineNumbersRef.value) {
    lineNumbersRef.value.scrollTop = textareaRef.value.scrollTop
  }
}

async function saveFile() {
  if (!isDirty.value || saving.value || !props.config) return
  saving.value = true
  error.value = null
  try {
    const res = await window.electronAPI.remoteWriteText(props.config, props.remotePath, content.value)
    if (res.success) {
      originalContent.value = content.value
      emit('saved')
    } else {
      error.value = res.error || 'Помилка при збереженні файлу на сервері'
    }
  } catch (err: any) {
    error.value = err.message || 'Не вдалося зберегти файл'
  } finally {
    saving.value = false
  }
}

function requestClose() {
  if (isDirty.value) {
    const confirmed = window.confirm('Файл було змінено. Вийти без збереження?')
    if (!confirmed) return
  }
  emit('close')
}

function handleKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    saveFile()
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    requestClose()
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    const textarea = textareaRef.value
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    content.value = content.value.substring(0, start) + '  ' + content.value.substring(end)
    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2
    })
  }
}
</script>
