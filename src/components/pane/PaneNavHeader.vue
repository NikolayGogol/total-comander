<template>
  <div class="pane-header">
    <button 
      class="nav-btn" 
      :disabled="!canGoBack" 
      data-tooltip="Назад в історії"
      data-tooltip-pos="bottom"
      title="Назад в історії переходів"
      @click.stop="$emit('go-back')"
    >
      <ChevronLeft :size="14" />
    </button>

    <button 
      class="nav-btn" 
      :disabled="!canGoForward" 
      data-tooltip="Вперед в історії"
      data-tooltip-pos="bottom"
      title="Вперед в історії переходів"
      @click.stop="$emit('go-forward')"
    >
      <ChevronRight :size="14" />
    </button>

    <button 
      class="nav-btn" 
      :disabled="isRootPath" 
      data-tooltip="Батьківська папка (..)"
      data-tooltip-pos="bottom"
      title="Перейти у батьківську директорію (Backspace або ..)"
      @click.stop="$emit('go-up')"
    >
      <ArrowUp :size="14" />
    </button>

    <!-- Path Bar / Breadcrumbs -->
    <div class="path-box" @click="startEditing" title="Клікніть для ручного введення шляху">
      <input 
        v-if="isEditing" 
        ref="inputRef"
        v-model="editPath" 
        type="text" 
        class="path-input"
        placeholder="C:\шлях\до\папки"
        title="Натисніть Enter для переходу, Esc для скасування"
        @keydown.enter="submitEdit"
        @keydown.esc="cancelEdit"
        @blur="cancelEdit"
      />
      <div v-else class="breadcrumbs">
        <template v-for="(segment, idx) in pathSegments" :key="idx">
          <span v-if="idx > 0" class="crumb-sep">\</span>
          <span 
            class="crumb" 
            :title="'Перейти до: ' + segment.fullPath"
            @click.stop="$emit('navigate', segment.fullPath)"
          >
            {{ segment.label }}
          </span>
        </template>
      </div>
    </div>

    <button 
      class="nav-btn" 
      data-tooltip="Оновити папку (Ctrl+R)"
      data-tooltip-pos="bottom"
      title="Оновити вміст директорії (Ctrl+R)" 
      @click.stop="$emit('refresh')"
    >
      <RotateCw :size="13" />
    </button>

    <!-- Quick Filter -->
    <div class="filter-box" title="Фільтрація файлів у поточній папці">
      <Search :size="12" class="filter-icon" />
      <input 
        :value="filterText"
        type="text" 
        class="filter-input" 
        placeholder="Filter..."
        title="Введіть назву для швидкої фільтрації (Esc для очищення)"
        @input="$emit('update:filterText', ($event.target as HTMLInputElement).value)"
        @keydown.esc="$emit('update:filterText', '')"
      />
      <X 
        v-if="filterText" 
        :size="11" 
        class="filter-clear-btn"
        data-tooltip="Очистити (Esc)"
        data-tooltip-pos="bottom"
        title="Очистити фільтр (Esc)"
        @click="$emit('update:filterText', '')" 
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowUp, 
  RotateCw, 
  Search, 
  X 
} from 'lucide-vue-next'

const props = defineProps<{
  currentPath: string
  canGoBack: boolean
  canGoForward: boolean
  filterText: string
}>()

const emit = defineEmits<{
  (e: 'navigate', path: string): void
  (e: 'go-up'): void
  (e: 'go-back'): void
  (e: 'go-forward'): void
  (e: 'refresh'): void
  (e: 'update:filterText', value: string): void
}>()

const isEditing = ref(false)
const editPath = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const isRootPath = computed(() => {
  const p = props.currentPath.trim()
  return !p || /^[a-zA-Z]:\\?$/.test(p) || p === '/' || p === '\\'
})

interface PathSegment {
  label: string
  fullPath: string
}

const pathSegments = computed<PathSegment[]>(() => {
  const p = props.currentPath.trim()
  if (!p) return []

  // Check if Windows drive path (e.g. C:\... or C:)
  const driveMatch = p.match(/^([a-zA-Z]:)[/\\]?(.*)$/)
  if (driveMatch) {
    const driveLetter = driveMatch[1].toUpperCase()
    const rest = driveMatch[2]
    const list: PathSegment[] = [
      { label: driveLetter, fullPath: `${driveLetter}\\` }
    ]

    const subParts = rest.split(/[/\\]/).filter(Boolean)
    let current = `${driveLetter}\\`
    for (const part of subParts) {
      current = current.endsWith('\\') ? `${current}${part}` : `${current}\\${part}`
      list.push({ label: part, fullPath: current })
    }
    return list
  }

  // Fallback
  const parts = p.split(/[/\\]/).filter(Boolean)
  const list: PathSegment[] = []
  let current = ''
  for (const part of parts) {
    current += '\\' + part
    list.push({ label: part, fullPath: current })
  }
  return list
})

function startEditing() {
  editPath.value = props.currentPath
  isEditing.value = true
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

function submitEdit() {
  if (editPath.value.trim()) {
    emit('navigate', editPath.value.trim())
  }
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
}
</script>
