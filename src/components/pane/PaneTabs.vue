<template>
  <div class="pane-tabs-bar">
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="pane-tab"
      :class="{ 'is-active': tab.id === activeTabId }"
      :title="'Вкладка: ' + tab.title + ' (' + tab.path + ')'"
      @click.stop="$emit('switch-tab', tab.id)"
    >
      <Folder :size="12" class="tab-icon" :title="'Папка: ' + tab.title" />
      <span class="tab-title">{{ tab.title }}</span>
      <span
        v-if="tabs.length > 1"
        class="tab-close"
        title="Закрити вкладку (Cmd+W)"
        @click.stop="$emit('close-tab', tab.id)"
      >
        <X :size="10" title="Закрити вкладку" />
      </span>
    </div>

    <button class="tab-add-btn" title="Відкрити нову вкладку (Cmd+T)" @click.stop="$emit('new-tab')">
      <Plus :size="13" title="Нова вкладка (Cmd+T)" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { TabItem } from '../../types'
import { Folder, Plus, X } from 'lucide-vue-next'

defineProps<{
  tabs: TabItem[]
  activeTabId: string
}>()

defineEmits<{
  (e: 'switch-tab', tabId: string): void
  (e: 'close-tab', tabId: string): void
  (e: 'new-tab'): void
}>()
</script>
