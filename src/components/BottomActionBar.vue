<template>
  <footer class="bottom-action-bar">
    <!-- F2 Rename -->
    <button
      class="fn-button"
      :disabled="!hasCursorItem"
      data-tooltip="Перейменувати вибраний елемент (F2)"
      data-tooltip-pos="top"
      title="Перейменувати вибраний файл або папку (F2)"
      @click="$emit('action', 'rename')"
    >
      <span class="fn-key">F2</span>
      <span>Rename</span>
    </button>

    <!-- F5 Copy -->
    <button
      class="fn-button"
      :disabled="selectedCount === 0 && !hasCursorItem"
      data-tooltip="Копіювати у сусідню панель (F5)"
      data-tooltip-pos="top"
      title="Копіювати вибрані елементи у цільову панель (F5)"
      @click="$emit('action', 'copy')"
    >
      <span class="fn-key">F5</span>
      <span>Copy</span>
    </button>

    <!-- F6 Move -->
    <button
      class="fn-button"
      :disabled="selectedCount === 0 && !hasCursorItem"
      data-tooltip="Перемістити у сусідню панель (F6)"
      data-tooltip-pos="top"
      title="Перемістити вибрані елементи у цільову панель (F6)"
      @click="$emit('action', 'move')"
    >
      <span class="fn-key">F6</span>
      <span>Move</span>
    </button>

    <!-- F7 Folder (New Folder / Mkdir) -->
    <button
      class="fn-button"
      data-tooltip="Створити нову папку (F7)"
      data-tooltip-pos="top"
      title="Створити нову папку (F7)"
      @click="$emit('action', 'mkdir')"
    >
      <span class="fn-key">F7</span>
      <span>Folder</span>
    </button>

    <!-- Shift+F4 / New File -->
    <button
      class="fn-button"
      data-tooltip="Створити новий файл (Shift+F4)"
      data-tooltip-pos="top"
      title="Створити новий файл (Shift+F4)"
      @click="$emit('action', 'newfile')"
    >
      <span class="fn-key">+File</span>
      <span>File</span>
    </button>

    <!-- F8 Delete -->
    <button
      class="fn-button"
      :disabled="selectedCount === 0 && !hasCursorItem"
      data-tooltip="Видалити у Кошик (F8 / Delete)"
      data-tooltip-pos="top"
      title="Перемістити вибрані файли у Кошик Windows (F8 або Delete)"
      @click="$emit('action', 'delete')"
    >
      <span class="fn-key">F8</span>
      <span>Delete</span>
    </button>

    <!-- F9 Terminal -->
    <button
      class="fn-button"
      data-tooltip="Відкрити Термінал (F9)"
      data-tooltip-pos="top"
      title="Відкрити активну папку в Терміналі (F9)"
      @click="$emit('action', 'terminal')"
    >
      <span class="fn-key">F9</span>
      <span>Terminal</span>
    </button>
  </footer>
</template>

<script setup lang="ts">
defineProps<{
  hasCursorItem: boolean
  selectedCount: number
}>()

defineEmits<{
  (
    e: 'action',
    type: 'rename' | 'view' | 'edit' | 'copy' | 'move' | 'mkdir' | 'newfile' | 'delete' | 'terminal' | 'search'
  ): void
}>()
</script>
