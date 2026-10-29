<template>
  <div class="context-menu-backdrop" @click="$emit('close')" @contextmenu.prevent="$emit('close')">
    <div ref="menuRef" class="context-menu" @click.stop>
      <!-- Optional Item Header if right-clicked on an item -->
      <div v-if="item" class="context-menu-header">
        {{ item.name }}
      </div>

      <!-- Item context actions -->
      <template v-if="item">
        <button class="context-menu-item" @click="trigger('open')">
          <FolderOpen :size="14" class="item-icon" />
          <span class="item-label">Відкрити</span>
          <span class="item-shortcut">Enter</span>
        </button>

        <button class="context-menu-item" @click="trigger('view')">
          <Eye :size="14" class="item-icon" />
          <span class="item-label">Переглянути</span>
          <span class="item-shortcut">F3</span>
        </button>

        <button v-if="!item.isDirectory" class="context-menu-item" @click="trigger('edit')">
          <Edit3 :size="14" class="item-icon" />
          <span class="item-label">Редагувати</span>
          <span class="item-shortcut">F4</span>
        </button>

        <div class="context-menu-separator"></div>

        <button class="context-menu-item" @click="trigger('copy')">
          <Copy :size="14" class="item-icon" />
          <span class="item-label">Копіювати в іншу панель</span>
          <span class="item-shortcut">F5</span>
        </button>

        <button class="context-menu-item" @click="trigger('move')">
          <Move :size="14" class="item-icon" />
          <span class="item-label">Перемістити в іншу панель</span>
          <span class="item-shortcut">F6</span>
        </button>

        <button class="context-menu-item" @click="trigger('rename')">
          <Edit2 :size="14" class="item-icon" />
          <span class="item-label">Перейменувати</span>
          <span class="item-shortcut">F2</span>
        </button>

        <button v-if="item.isDirectory" class="context-menu-item" @click="trigger('calculate-dir-size')">
          <HardDrive :size="14" class="item-icon" />
          <span class="item-label">Порахувати розмір папки</span>
          <span class="item-shortcut">Space</span>
        </button>

        <button v-if="item.isDirectory" class="context-menu-item" @click="trigger('large-files')">
          <PieChart :size="14" class="item-icon" />
          <span class="item-label">Пошук великих файлів...</span>
        </button>

        <button class="context-menu-item" @click="trigger('zip')">
          <Archive :size="14" class="item-icon" />
          <span class="item-label">Архівувати (ZIP / 7Z / RAR)</span>
          <span class="item-shortcut">Alt+F5</span>
        </button>

        <button v-if="isArchive(item)" class="context-menu-item" @click="trigger('unzip')">
          <FolderArchive :size="14" class="item-icon" />
          <span class="item-label">Розархівувати вміст</span>
          <span class="item-shortcut">Alt+F6</span>
        </button>

        <div class="context-menu-separator"></div>

        <button class="context-menu-item" @click="trigger('clipboard-copy')">
          <Files :size="14" class="item-icon" />
          <span class="item-label">Скопіювати у буфер</span>
          <span class="item-shortcut">Ctrl+C</span>
        </button>

        <button class="context-menu-item" @click="trigger('clipboard-cut')">
          <Scissors :size="14" class="item-icon" />
          <span class="item-label">Вирізати у буфер</span>
          <span class="item-shortcut">Ctrl+X</span>
        </button>

        <button class="context-menu-item" @click="trigger('copy-path')">
          <Link :size="14" class="item-icon" />
          <span class="item-label">Скопіювати повний шлях</span>
        </button>

        <div class="context-menu-separator"></div>

        <button class="context-menu-item" @click="trigger('show-in-folder')">
          <ExternalLink :size="14" class="item-icon" />
          <span class="item-label">Показати у Провіднику</span>
        </button>

        <button class="context-menu-item is-danger" @click="trigger('delete')">
          <Trash2 :size="14" class="item-icon" />
          <span class="item-label">Видалити у Кошик</span>
          <span class="item-shortcut">Delete</span>
        </button>
      </template>

      <!-- Empty area context actions -->
      <template v-else>
        <button class="context-menu-item" @click="trigger('mkdir')">
          <FolderPlus :size="14" class="item-icon" />
          <span class="item-label">Нова папка</span>
          <span class="item-shortcut">F7</span>
        </button>

        <button class="context-menu-item" @click="trigger('newfile')">
          <FilePlus :size="14" class="item-icon" />
          <span class="item-label">Новий файл</span>
          <span class="item-shortcut">Shift+F4</span>
        </button>

        <div class="context-menu-separator"></div>

        <button class="context-menu-item" :disabled="!canPaste" @click="trigger('clipboard-paste')">
          <ClipboardPaste :size="14" class="item-icon" />
          <span class="item-label">Вставити</span>
          <span class="item-shortcut">Ctrl+V</span>
        </button>

        <button class="context-menu-item" @click="trigger('select-all')">
          <CheckSquare :size="14" class="item-icon" />
          <span class="item-label">Виділити все</span>
          <span class="item-shortcut">Ctrl+A</span>
        </button>

        <div class="context-menu-separator"></div>

        <button class="context-menu-item" @click="trigger('terminal')">
          <Terminal :size="14" class="item-icon" />
          <span class="item-label">Відкрити у Терміналі</span>
          <span class="item-shortcut">F9</span>
        </button>

        <button class="context-menu-item" @click="trigger('large-files')">
          <PieChart :size="14" class="item-icon" />
          <span class="item-label">Пошук великих файлів...</span>
        </button>

        <button class="context-menu-item" @click="trigger('refresh')">
          <RotateCw :size="14" class="item-icon" />
          <span class="item-label">Оновити</span>
          <span class="item-shortcut">Ctrl+R</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import type { FileItem } from '../types'
import {
  FolderOpen,
  Eye,
  Edit3,
  Edit2,
  Copy,
  Move,
  Files,
  Scissors,
  Link,
  ExternalLink,
  Trash2,
  FolderPlus,
  FilePlus,
  ClipboardPaste,
  CheckSquare,
  Terminal,
  RotateCw,
  Archive,
  FolderArchive,
  HardDrive,
  PieChart
} from 'lucide-vue-next'

const props = defineProps<{
  x: number
  y: number
  item: FileItem | null
  canPaste: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'action', actionName: string): void
}>()

const menuRef = ref<HTMLElement | null>(null)

function isArchive(item: FileItem | null): boolean {
  if (!item || item.isDirectory) return false
  const ext = (item.extension || item.name.split('.').pop() || '').toLowerCase().replace(/^\./, '')
  return ['zip', '7z', 'rar', 'tar', 'gz', 'tgz', 'iso', 'bz2', 'xz'].includes(ext)
}

function trigger(action: string) {
  emit('action', action)
  emit('close')
}

onMounted(() => {
  nextTick(() => {
    if (!menuRef.value) return
    const menuWidth = menuRef.value.offsetWidth || 220
    const menuHeight = menuRef.value.offsetHeight || 300
    const clampedX = Math.max(8, Math.min(props.x, window.innerWidth - menuWidth - 8))
    const clampedY = Math.max(8, Math.min(props.y, window.innerHeight - menuHeight - 8))
    menuRef.value.style.setProperty('--pos-x', `${clampedX}px`)
    menuRef.value.style.setProperty('--pos-y', `${clampedY}px`)
  })
})
</script>

