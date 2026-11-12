<template>
  <div v-if="open" class="modal-overlay remote-prompt-overlay" @click.self="$emit('cancel')">
    <div class="modal-card remote-prompt-card">
      <div class="modal-header">
        <div class="modal-title">
          <component :is="iconComponent" :size="16" :class="iconClass" />
          <span>{{ title }}</span>
        </div>
        <button class="modal-close-btn" title="Скасувати (Esc)" @click="$emit('cancel')">
          <X :size="15" />
        </button>
      </div>

      <div class="modal-body">
        <p v-if="message" class="prompt-message">{{ message }}</p>

        <div v-if="mode !== 'confirm'" class="form-group">
          <label v-if="label" class="form-label">{{ label }}</label>
          <input
            ref="inputRef"
            v-model="inputValue"
            type="text"
            class="form-input"
            :placeholder="placeholder"
            spellcheck="false"
            @keydown.enter="handleSubmit"
            @keydown.esc="$emit('cancel')"
          />
        </div>
      </div>

      <div class="modal-footer">
        <div class="footer-left">
          <span v-if="hint" class="prompt-hint">{{ hint }}</span>
        </div>
        <div class="footer-actions">
          <button type="button" class="btn-secondary" @click="$emit('cancel')">Скасувати (Esc)</button>
          <button
            type="button"
            :class="mode === 'confirm' ? 'btn-danger' : 'btn-primary'"
            :disabled="mode !== 'confirm' && !inputValue.trim()"
            @click="handleSubmit"
          >
            {{ submitLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { FolderPlus, FilePlus, Pencil, Trash2, X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  mode: 'folder' | 'file' | 'rename' | 'confirm'
  title: string
  message?: string
  label?: string
  initialValue?: string
  placeholder?: string
  submitText?: string
  hint?: string
}>()

const emit = defineEmits<{
  (e: 'submit', value: string): void
  (e: 'cancel'): void
}>()

const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const iconComponent = computed(() => {
  switch (props.mode) {
    case 'folder':
      return FolderPlus
    case 'file':
      return FilePlus
    case 'rename':
      return Pencil
    case 'confirm':
      return Trash2
    default:
      return FolderPlus
  }
})

const iconClass = computed(() => {
  return props.mode === 'confirm' ? 'icon-rose' : 'icon-amber'
})

const submitLabel = computed(() => {
  if (props.submitText) return props.submitText
  if (props.mode === 'confirm') return 'Видалити'
  return 'Підтвердити (Enter)'
})

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      inputValue.value = props.initialValue || ''
      await nextTick()
      if (inputRef.value) {
        inputRef.value.focus()
        inputRef.value.select()
      }
    }
  },
  { immediate: true }
)

function handleSubmit() {
  if (props.mode !== 'confirm' && !inputValue.value.trim()) return
  emit('submit', inputValue.value.trim())
}
</script>
