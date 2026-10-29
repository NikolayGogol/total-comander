<template>
  <div
    class="pane-card"
    :class="{ 'is-active': isActive }"
    @focus="$emit('activate')"
    @click="$emit('activate')"
  >
    <!-- Pane Tabs -->
    <PaneTabs
      :tabs="pane.tabs"
      :active-tab-id="pane.activeTabId"
      @switch-tab="(id) => $emit('switch-tab', id)"
      @close-tab="(id) => $emit('close-tab', id)"
      @new-tab="$emit('new-tab')"
    />

    <!-- Navigation Header -->
    <PaneNavHeader
      :current-path="pane.currentPath"
      :can-go-back="canGoBack"
      :can-go-forward="canGoForward"
      v-model:filter-text="filterText"
      @navigate="(p) => $emit('navigate', p)"
      @go-up="$emit('go-up')"
      @go-back="$emit('go-back')"
      @go-forward="$emit('go-forward')"
      @refresh="$emit('refresh')"
    />

    <!-- File Table -->
    <FileTable
      ref="fileTableRef"
      :items="filteredItems"
      :current-path="pane.currentPath"
      :cursor-index="pane.cursorIndex"
      :selected-paths="pane.selectedPaths"
      :sort-field="pane.sortField"
      :sort-order="pane.sortOrder"
      :filter-text="filterText"
      :loading="pane.loading"
      @navigate="(p) => $emit('navigate', p)"
      @go-up="$emit('go-up')"
      @open-native="(item) => $emit('open-native', item)"
      @open-archive="(item) => $emit('open-archive', item)"
      @update-cursor="(idx) => $emit('update-cursor', idx)"
      @toggle-select="(p) => $emit('toggle-select', p)"
      @select-range="(from, to) => $emit('select-range', from, to)"
      @clear-selection="$emit('clear-selection')"
      @sort="(field) => $emit('sort', field)"
      @drop-items="
        (sources, target, isMove) =>
          $emit('drag-drop-items', sources, target, isMove)
      "
      @context-menu="(payload) => $emit('context-menu', payload)"
    />

    <!-- Pane Footer / Stats -->
    <PaneFooter
      :selected-count="pane.selectedPaths.size"
      :selected-size="selectedSize"
      :total-directories="totalDirectories"
      :total-files="totalFiles"
      :total-file-size="totalFileSize"
      :item-count="filteredItems.length"
      :free-space="pane.freeSpace"
      :available-space="pane.availableSpace"
      :purgeable-space="pane.purgeableSpace"
      :total-space="pane.totalSpace"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { PaneState, FileItem, SortField } from "@/types";
import PaneTabs from "@/components/pane/PaneTabs.vue";
import PaneNavHeader from "@/components/pane/PaneNavHeader.vue";
import FileTable from "@/components/pane/FileTable.vue";
import PaneFooter from "@/components/pane/PaneFooter.vue";

const props = defineProps<{
  pane: PaneState;
  isActive: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}>();

defineEmits<{
  (e: "activate"): void;
  (e: "navigate", path: string): void;
  (e: "go-up"): void;
  (e: "go-back"): void;
  (e: "go-forward"): void;
  (e: "refresh"): void;
  (e: "switch-tab", tabId: string): void;
  (e: "new-tab"): void;
  (e: "close-tab", tabId: string): void;
  (e: "update-cursor", index: number): void;
  (e: "toggle-select", path: string): void;
  (e: "select-range", fromIndex: number, toIndex: number): void;
  (e: "clear-selection"): void;
  (e: "sort", field: SortField): void;
  (e: "open-native", item: FileItem): void;
  (e: "open-archive", item: FileItem): void;
  (
    e: "drag-drop-items",
    sourcePaths: string[],
    targetDir: string,
    isMove?: boolean,
  ): void;
  (
    e: "context-menu",
    payload: { x: number; y: number; item: FileItem | null },
  ): void;
}>();

const filterText = ref("");
const fileTableRef = ref<InstanceType<typeof FileTable> | null>(null);

function calculateDirectorySize(dirPath: string) {
  fileTableRef.value?.calculateDirectorySize(dirPath);
}

defineExpose({
  focus: () => fileTableRef.value?.focus(),
  calculateDirectorySize,
});

const filteredItems = computed(() => {
  let list = props.pane.items;
  if (filterText.value.trim()) {
    const q = filterText.value.toLowerCase();
    list = list.filter((i) => i.name.toLowerCase().includes(q));
  }
  return list;
});

const totalDirectories = computed(
  () => props.pane.items.filter((i) => i.isDirectory).length,
);
const totalFiles = computed(
  () => props.pane.items.filter((i) => !i.isDirectory).length,
);
const totalFileSize = computed(() =>
  props.pane.items.reduce((acc, i) => acc + (i.size || 0), 0),
);
const selectedSize = computed(() => {
  return props.pane.items
    .filter((i) => props.pane.selectedPaths.has(i.path))
    .reduce((acc, i) => acc + (i.size || 0), 0);
});

watch(
  () => props.isActive,
  (active) => {
    if (active) {
      fileTableRef.value?.focus();
    }
  },
);
</script>
