<template>
  <Teleport to="body">
    <div v-if="visible" class="context-menu-backdrop" @click="$emit('close')" @contextmenu.prevent="$emit('close')">
      <div ref="menuRef" class="context-menu remote-context-menu" @click.stop>
        <!-- Item Actions (File or Folder) -->
        <template v-if="targetType === 'item' && item">
          <button type="button" class="menu-item" @click="trigger('open')">
            <FolderOpen v-if="item.isDirectory" :size="14" class="menu-item-icon" />
            <Download v-else :size="14" class="menu-item-icon" />
            <span class="menu-item-label">{{ item.isDirectory ? 'Відкрити папку' : 'Завантажити у TC' }}</span>
          </button>

          <button v-if="!item.isDirectory" type="button" class="menu-item" @click="trigger('edit')">
            <Edit3 :size="14" class="menu-item-icon" />
            <span class="menu-item-label">Редагувати на сервері</span>
            <span class="menu-item-shortcut">F4</span>
          </button>

          <button type="button" class="menu-item" @click="trigger('rename')">
            <Pencil :size="14" class="menu-item-icon" />
            <span class="menu-item-label">Перейменувати</span>
            <span class="menu-item-shortcut">F2</span>
          </button>

          <div class="menu-divider" />

          <button type="button" class="menu-item" @click="trigger('copy-path')">
            <Copy :size="14" class="menu-item-icon" />
            <span class="menu-item-label">Скопіювати шлях</span>
          </button>

          <div class="menu-divider" />

          <button type="button" class="menu-item is-danger" @click="trigger('delete')">
            <Trash2 :size="14" class="menu-item-icon" />
            <span class="menu-item-label">Видалити з сервера</span>
            <span class="menu-item-shortcut">⌫</span>
          </button>
        </template>

        <!-- Blank Space Actions (Table background) -->
        <template v-else-if="targetType === 'blank'">
          <button type="button" class="menu-item" @click="trigger('new-folder')">
            <FolderPlus :size="14" class="menu-item-icon" />
            <span class="menu-item-label">Створити нову папку</span>
            <span class="menu-item-shortcut">F7</span>
          </button>

          <button type="button" class="menu-item" @click="trigger('new-file')">
            <FilePlus :size="14" class="menu-item-icon" />
            <span class="menu-item-label">Створити новий файл</span>
            <span class="menu-item-shortcut">Shift+F4</span>
          </button>

          <button v-if="hasLocalSelected" type="button" class="menu-item" @click="trigger('upload')">
            <Upload :size="14" class="menu-item-icon" />
            <span class="menu-item-label">Надіслати вибране з TC</span>
          </button>

          <div class="menu-divider" />

          <button type="button" class="menu-item" @click="trigger('refresh')">
            <RotateCw :size="14" class="menu-item-icon" />
            <span class="menu-item-label">Оновити вміст</span>
            <span class="menu-item-shortcut">⌘R</span>
          </button>

          <button type="button" class="menu-item" @click="trigger('copy-dir-path')">
            <Copy :size="14" class="menu-item-icon" />
            <span class="menu-item-label">Скопіювати шлях папки</span>
          </button>
        </template>

        <!-- Profile Actions (Left Sidebar) -->
        <template v-else-if="targetType === 'profile' && profile">
          <button type="button" class="menu-item" @click="trigger('connect-profile')">
            <CornerDownRight :size="14" class="menu-item-icon" />
            <span class="menu-item-label">Підключитися</span>
          </button>

          <button type="button" class="menu-item" @click="trigger('duplicate-profile')">
            <Copy :size="14" class="menu-item-icon" />
            <span class="menu-item-label">Дублювати профіль</span>
          </button>

          <div class="menu-divider" />

          <button type="button" class="menu-item is-danger" @click="trigger('delete-profile')">
            <Trash2 :size="14" class="menu-item-icon" />
            <span class="menu-item-label">Видалити профіль</span>
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import {
  FolderOpen,
  Download,
  Edit3,
  Pencil,
  Copy,
  Trash2,
  FolderPlus,
  FilePlus,
  Upload,
  RotateCw,
  CornerDownRight,
} from 'lucide-vue-next'
import type { RemoteFileEntry, RemoteProfile } from '@/types'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  targetType: 'item' | 'blank' | 'profile'
  item?: RemoteFileEntry | null
  profile?: RemoteProfile | null
  hasLocalSelected?: boolean
}>()

const emit = defineEmits<{
  (e: 'action', action: string, item?: RemoteFileEntry | null): void
  (e: 'close'): void
}>()

const menuRef = ref<HTMLElement | null>(null)

watch([() => props.x, () => props.y, () => props.visible], async () => {
  if (props.visible) {
    await nextTick()
    if (menuRef.value) {
      const w = 230
      const h = menuRef.value.offsetHeight || 220
      const px = Math.min(Math.max(8, props.x), window.innerWidth - w - 8)
      const py = Math.min(Math.max(8, props.y), window.innerHeight - h - 8)
      menuRef.value.style.setProperty('--menu-x', `${px}px`)
      menuRef.value.style.setProperty('--menu-y', `${py}px`)
    }
  }
})

function trigger(action: string) {
  emit('action', action, props.item)
  emit('close')
}
</script>
