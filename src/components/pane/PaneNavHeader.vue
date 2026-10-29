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
      :disabled="isRootPath(currentPath)"
      data-tooltip="Батьківська папка (..)"
      data-tooltip-pos="bottom"
      title="Перейти у батьківську директорію (Backspace або ..)"
      @click.stop="$emit('go-up')"
    >
      <ArrowUp :size="14" />
    </button>

    <!-- Path Bar / Breadcrumbs -->
    <div
      class="path-box"
      @click="startEditing"
      title="Клікніть для ручного введення шляху"
    >
      <input
        v-if="isEditing"
        ref="inputRef"
        v-model="editPath"
        type="text"
        class="path-input"
        placeholder="/шлях/до/папки"
        title="Натисніть Enter для переходу, Esc для скасування"
        @keydown.enter="submitEdit"
        @keydown.esc="cancelEdit"
        @blur="cancelEdit"
      />
      <div v-else class="breadcrumbs">
        <span
          class="crumb"
          :title="'Кореневий розділ (' + pathInfo.root + ')'"
          @click.stop="$emit('navigate', pathInfo.root)"
          >{{ pathInfo.root }}</span
        >
        <template v-for="(segment, idx) in pathInfo.segments" :key="idx">
          <span class="crumb-sep">{{ pathSep }}</span>
          <span
            class="crumb"
            :title="
              'Перейти до: ' +
              getSegmentFullPath(pathInfo.root, pathInfo.segments, idx)
            "
            @click.stop="
              $emit(
                'navigate',
                getSegmentFullPath(pathInfo.root, pathInfo.segments, idx),
              )
            "
          >
            {{ segment }}
          </span>
        </template>
      </div>
    </div>

    <button
      class="nav-btn"
      data-tooltip="Оновити папку (Cmd+R)"
      data-tooltip-pos="bottom"
      title="Оновити вміст директорії (Cmd+R)"
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
        @input="
          $emit('update:filterText', ($event.target as HTMLInputElement).value)
        "
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
import { ref, computed, nextTick } from "vue";
import { isRootPath, getPathSegments, getSegmentFullPath } from "@/utils/paths";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  RotateCw,
  Search,
  X,
} from "lucide-vue-next";

const props = defineProps<{
  currentPath: string;
  canGoBack: boolean;
  canGoForward: boolean;
  filterText: string;
}>();

const emit = defineEmits<{
  (e: "navigate", path: string): void;
  (e: "go-up"): void;
  (e: "go-back"): void;
  (e: "go-forward"): void;
  (e: "refresh"): void;
  (e: "update:filterText", value: string): void;
}>();

const isEditing = ref(false);
const editPath = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

const pathInfo = computed(() => {
  return getPathSegments(props.currentPath);
});

const pathSep = "/";

function startEditing() {
  editPath.value = props.currentPath;
  isEditing.value = true;
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
}

function submitEdit() {
  if (editPath.value.trim()) {
    emit("navigate", editPath.value.trim());
  }
  isEditing.value = false;
}

function cancelEdit() {
  isEditing.value = false;
}
</script>
