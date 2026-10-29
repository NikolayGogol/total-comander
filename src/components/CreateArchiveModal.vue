<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card archive-create-card">
      <div class="modal-header">
        <div class="modal-title">
          <Archive :size="16" class="icon-blue" title="Create Archive" />
          <span>Створити архів (Alt+F5)</span>
        </div>
        <button
          class="modal-close-btn"
          title="Скасувати (Esc)"
          @click="$emit('close')"
        >
          <X :size="15" />
        </button>
      </div>

      <div class="modal-body">
        <div class="form-row">
          <label class="form-label">Цільова папка:</label>
          <div class="path-display-badge">
            <code>{{ targetDir }}</code>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">Назва архіву:</label>
          <input
            ref="inputRef"
            v-model="archiveName"
            type="text"
            class="form-input"
            placeholder="Назва архіву (наприклад: archive.zip)"
            @keydown.enter="submit"
          />
        </div>

        <div class="form-row">
          <label class="form-label">Формат архіву:</label>
          <div class="archive-format-options">
            <label class="radio-option">
              <input
                type="radio"
                value="zip"
                v-model="selectedFormat"
                @change="onFormatChange"
              />
              <span>ZIP (.zip) — Apple Ditto / Сумісний</span>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                value="tar.gz"
                v-model="selectedFormat"
                @change="onFormatChange"
              />
              <span>TAR GZ (.tar.gz) — Unix / Linux</span>
            </label>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label"
            >Файли для архівації ({{ sourceItems.length }}):</label
          >
          <div class="items-preview-list">
            <div
              v-for="item in sourceItems.slice(0, 5)"
              :key="item"
              class="item-preview"
            >
              {{ item }}
            </div>
            <div v-if="sourceItems.length > 5" class="item-preview-more">
              + ще {{ sourceItems.length - 5 }} елемент(ів)
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('close')">
          Скасувати (Esc)
        </button>
        <button
          class="btn-primary"
          :disabled="isProcessing || !archiveName.trim()"
          @click="submit"
        >
          <Archive :size="14" />
          <span>{{
            isProcessing ? "Створення..." : "Створити архів (Enter)"
          }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { Archive, X } from "lucide-vue-next";

const props = defineProps<{
  sourceItems: string[];
  targetDir: string;
}>();

const emit = defineEmits<{
  (
    e: "confirm",
    payload: { format: "zip" | "tar.gz"; fullTarget: string },
  ): void;
  (e: "close"): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const selectedFormat = ref<"zip" | "tar.gz">("zip");
const archiveName = ref("");
const isProcessing = ref(false);

function onFormatChange() {
  const base = archiveName.value.replace(/\.(zip|tar\.gz|tar|tgz)$/i, "");
  archiveName.value = `${base}.${selectedFormat.value}`;
}

function submit() {
  if (isProcessing.value || !archiveName.value.trim()) return;
  isProcessing.value = true;
  let finalName = archiveName.value.trim();
  const expectedExt = `.${selectedFormat.value}`;
  if (!finalName.toLowerCase().endsWith(expectedExt)) {
    finalName += expectedExt;
  }
  const fullTarget = `${props.targetDir.replace(/\/+$/, "")}/${finalName}`;
  emit("confirm", { format: selectedFormat.value, fullTarget });
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    emit("close");
  }
}

onMounted(() => {
  const first =
    props.sourceItems[0]?.split("/").filter(Boolean).pop() || "archive";
  const cleanBase = first.replace(/\.[^/.]+$/, "");
  archiveName.value = `${cleanBase}.zip`;
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
  window.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
});
</script>
