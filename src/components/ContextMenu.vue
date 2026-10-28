<template>
  <Teleport to="body">
    <div 
      v-if="visible" 
      class="context-menu-backdrop" 
      @click="$emit('close')" 
      @contextmenu.prevent="$emit('close')"
    >
      <div ref="menuRef" class="context-menu" @click.stop>
        <template v-for="(menuItem, idx) in itemsList" :key="idx">
          <div v-if="menuItem.isDivider" class="menu-divider" />
          <button 
            v-else 
            type="button" 
            class="menu-item" 
            :class="{ 'is-danger': menuItem.isDanger }" 
            @click="trigger(menuItem.action)"
          >
            <component :is="menuItem.icon" :size="14" class="menu-item-icon" />
            <span class="menu-item-label">{{ menuItem.label }}</span>
            <span v-if="menuItem.shortcut" class="menu-item-shortcut">{{ menuItem.shortcut }}</span>
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { FileItem } from '../types'
import {
  ExternalLink,
  Eye,
  Edit3,
  Copy,
  Move,
  Pencil,
  ClipboardCopy,
  Scissors,
  ClipboardPaste,
  FolderSearch,
  Terminal,
  Trash2,
  FolderPlus,
  FilePlus,
  FolderOpen,
  RotateCw,
  CheckSquare,
} from 'lucide-vue-next'

interface ContextItemDef {
  action?: string
  label?: string
  icon?: any
  shortcut?: string
  isDanger?: boolean
  isDivider?: boolean
}

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  item: FileItem | null
  currentPath: string
  selectedCount: number
}>()

const emit = defineEmits<{
  (e: 'action', action: string, item: FileItem | null): void
  (e: 'close'): void
}>()

const menuRef = ref<HTMLElement | null>(null)

watch([() => props.x, () => props.y, () => props.visible], async () => {
  if (props.visible) {
    await nextTick()
    if (menuRef.value) {
      const w = 240
      const h = menuRef.value.offsetHeight || 320
      const px = Math.min(Math.max(8, props.x), window.innerWidth - w - 8)
      const py = Math.min(Math.max(8, props.y), window.innerHeight - h - 8)
      menuRef.value.style.setProperty('--menu-x', `${px}px`)
      menuRef.value.style.setProperty('--menu-y', `${py}px`)
    }
  }
})

function trigger(action?: string) {
  if (!action) return
  emit('action', action, props.item)
  emit('close')
}

const itemsList = computed<ContextItemDef[]>(() => {
  const cmd = '⌘'
  const finderLabel = 'Показати у Finder'

  if (props.item) {
    const isDir = props.item.isDirectory
    const list: ContextItemDef[] = []

    if (props.item.isApp) {
      list.push({ action: 'open', label: 'Запустити програму', icon: ExternalLink, shortcut: '↵' })
      list.push({ action: 'show-package-contents', label: 'Показати вміст пакета', icon: FolderOpen })
    } else if (isDir) {
      list.push({ action: 'open', label: 'Відкрити папку', icon: FolderOpen, shortcut: '↵' })
    } else {
      list.push({ action: 'open', label: 'Відкрити у програмі', icon: ExternalLink, shortcut: '↵' })
      list.push({ action: 'view', label: 'Перегляд (Quick Look)', icon: Eye, shortcut: 'F3' })
      list.push({ action: 'edit', label: 'Редагувати файл', icon: Edit3, shortcut: 'F4' })
    }

    list.push({ isDivider: true })
    list.push({ action: 'copy', label: 'Копіювати у ціль', icon: Copy, shortcut: 'F5' })
    list.push({ action: 'move', label: 'Перемістити у ціль', icon: Move, shortcut: 'F6' })
    list.push({ action: 'rename', label: 'Перейменувати...', icon: Pencil, shortcut: 'F2' })

    list.push({ isDivider: true })
    list.push({ action: 'clipboard-copy', label: 'Скопіювати', icon: ClipboardCopy, shortcut: `${cmd}C` })
    list.push({ action: 'clipboard-cut', label: 'Вирізати', icon: Scissors, shortcut: `${cmd}X` })

    list.push({ isDivider: true })
    list.push({ action: 'show-in-folder', label: finderLabel, icon: FolderSearch })
    list.push({ action: 'terminal', label: 'Відкрити у терміналі', icon: Terminal, shortcut: 'F9' })

    list.push({ isDivider: true })
    list.push({ action: 'delete', label: 'Видалити у Смітник', icon: Trash2, shortcut: 'F8', isDanger: true })

    return list
  }

  return [
    { action: 'mkdir', label: 'Створити папку...', icon: FolderPlus, shortcut: 'F7' },
    { action: 'newfile', label: 'Створити файл...', icon: FilePlus, shortcut: '⇧F4' },
    { isDivider: true },
    { action: 'paste', label: 'Вставити з буфера', icon: ClipboardPaste, shortcut: `${cmd}V` },
    { isDivider: true },
    { action: 'select-all', label: 'Виділити все', icon: CheckSquare, shortcut: `${cmd}A` },
    { action: 'refresh', label: 'Оновити', icon: RotateCw, shortcut: `${cmd}R` },
    { action: 'terminal', label: 'Термінал у цій папці', icon: Terminal, shortcut: 'F9' },
  ]
})
</script>
