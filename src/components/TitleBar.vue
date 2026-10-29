<template>
  <header class="title-bar">
    <div class="title-bar-left">
      <div class="app-brand">
        <span class="brand-badge">TC</span>
        <span class="brand-title">Total Commander</span>
        <span class="brand-version">Windows Edition</span>
        <span
          class="build-badge"
          :data-tooltip="'Дата збірки: ' + BUILD_DATE"
          data-tooltip-pos="bottom"
          :title="'Total Commander v' + APP_VERSION + ' (build ' + BUILD_NUMBER + ')\nДата збірки: ' + BUILD_DATE"
        >
          v{{ APP_VERSION }} (b{{ BUILD_NUMBER }})
        </span>
      </div>
    </div>

    <div class="title-bar-actions">
      <!-- Quick Search -->
      <button
        class="btn-icon"
        data-tooltip="Пошук файлів (Alt+F7 / F10)"
        data-tooltip-pos="bottom"
        title="Пошук файлів за назвою або вмістом (Alt+F7 або F10)"
        @click="$emit('open-search')"
      >
        <Search :size="15" />
      </button>

      <!-- Large Files Finder / Disk Cleanup -->
      <button
        class="btn-icon"
        data-tooltip="Пошук великих файлів (Звільнення місця на диску)"
        data-tooltip-pos="bottom"
        title="Аналізатор диска: Пошук великих файлів для звільнення місця на диску"
        @click="$emit('open-large-files')"
      >
        <PieChart :size="15" />
      </button>

      <!-- Toggle Hidden Files -->
      <button
        class="btn-icon"
        :class="{ active: showHidden }"
        :data-tooltip="showHidden ? 'Приховати файли (Ctrl+Shift+.)' : 'Показати приховані файли (Ctrl+Shift+.)'"
        data-tooltip-pos="bottom"
        :title="showHidden ? 'Приховати приховані файли (Ctrl+Shift+.)' : 'Показати приховані файли (Ctrl+Shift+.)'"
        @click="$emit('toggle-hidden')"
      >
        <Eye v-if="showHidden" :size="15" />
        <EyeOff v-else :size="15" />
      </button>

      <!-- Swap Panes -->
      <button
        class="btn-icon"
        data-tooltip="Поміняти панелі (Ctrl+U)"
        data-tooltip-pos="bottom"
        title="Поміняти ліву і праву панелі місцями (Ctrl+U)"
        @click="$emit('swap-panes')"
      >
        <ArrowLeftRight :size="15" />
      </button>

      <!-- Open Terminal -->
      <button
        class="btn-icon"
        data-tooltip="Відкрити Термінал (F9)"
        data-tooltip-pos="bottom"
        title="Відкрити активну папку в Терміналі Windows (F9)"
        @click="$emit('open-terminal')"
      >
        <Terminal :size="15" />
      </button>

      <!-- Refresh Panes -->
      <button
        class="btn-icon"
        data-tooltip="Оновити панелі (Ctrl+R)"
        data-tooltip-pos="bottom"
        title="Оновити вміст обох панелей (Ctrl+R)"
        @click="$emit('refresh-all')"
      >
        <RotateCw :size="15" />
      </button>

      <!-- Prominent Theme Switcher Button / Segmented Control -->
      <button
        type="button"
        class="theme-switcher-pill"
        :data-tooltip="
          currentTheme === 'dark' ? 'Увімкнути світлу тему (Ctrl+Shift+T)' : 'Увімкнути темну тему (Ctrl+Shift+T)'
        "
        data-tooltip-pos="bottom-left"
        :title="
          currentTheme === 'dark'
            ? 'Перемкнути на світлу тему (Ctrl+Shift+T)'
            : 'Перемкнути на темну тему (Ctrl+Shift+T)'
        "
        @click="$emit('toggle-theme')"
      >
        <span class="theme-option" :class="{ 'is-active': currentTheme === 'light' }">
          <Sun :size="13" class="theme-icon" />
          <span class="theme-label">Light</span>
        </span>
        <span class="theme-option" :class="{ 'is-active': currentTheme === 'dark' }">
          <Moon :size="13" class="theme-icon" />
          <span class="theme-label">Dark</span>
        </span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { APP_VERSION, BUILD_NUMBER, BUILD_DATE } from '../buildInfo'
import { Search, PieChart, Eye, EyeOff, ArrowLeftRight, Terminal, RotateCw, Sun, Moon } from 'lucide-vue-next'

defineProps<{
  showHidden: boolean
  currentTheme: 'dark' | 'light'
}>()

defineEmits<{
  (e: 'open-search'): void
  (e: 'open-large-files'): void
  (e: 'toggle-hidden'): void
  (e: 'swap-panes'): void
  (e: 'open-terminal'): void
  (e: 'refresh-all'): void
  (e: 'toggle-theme'): void
}>()
</script>
