<template>
  <div class="modal-overlay" @click.self="!isCreating && $emit('close')">
    <div class="modal-card archive-create-card">
      <div class="modal-header">
        <div class="modal-title">
          <Archive :size="16" class="icon-amber" />
          <span>Створення архіву (Alt+F5)</span>
        </div>
        <button
          class="modal-close-btn"
          title="Скасувати (Esc)"
          :disabled="isCreating"
          @click="$emit('close')"
        >
          <X :size="15" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Target Directory -->
        <div class="form-row">
          <label class="form-label">Цільова папка:</label>
          <div class="path-display-badge">
            <code>{{ targetDir }}</code>
          </div>
        </div>

        <!-- Archive Name -->
        <div class="form-row">
          <label class="form-label">Назва архіву:</label>
          <input
            ref="inputRef"
            v-model="archiveName"
            type="text"
            class="form-input"
            placeholder="Назва архіву"
            @keydown.enter="submit"
          />
        </div>

        <!-- Archive Format -->
        <div class="form-row">
          <label class="form-label">Формат архіву:</label>
          <div class="archive-format-options">
            <label
              class="radio-option"
              :class="{ 'is-selected': selectedFormat === 'zip' }"
            >
              <input
                v-model="selectedFormat"
                type="radio"
                value="zip"
                @change="onFormatChange"
              />
              <span>ZIP (.zip) — Apple Ditto / Сумісний</span>
            </label>
            <label
              class="radio-option"
              :class="{ 'is-selected': selectedFormat === 'tar.gz' }"
            >
              <input
                v-model="selectedFormat"
                type="radio"
                value="tar.gz"
                @change="onFormatChange"
              />
              <span>TAR GZ (.tar.gz) — Unix / Linux</span>
            </label>
          </div>
        </div>

        <!-- Password Protection -->
        <div class="form-row">
          <div class="label-with-action">
            <label class="form-label">
              <Lock :size="13" class="icon-blue" />
              <span>Захист паролем (необов'язково):</span>
            </label>
            <button
              type="button"
              class="btn-text-toggle"
              tabindex="-1"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? "Сховати" : "Показати" }}
            </button>
          </div>
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            class="form-input"
            placeholder="Введіть пароль для шифрування..."
            @keydown.enter="submit"
          />
        </div>

        <!-- Compression Level -->
        <div class="form-row">
          <label class="form-label">Рівень стиснення:</label>
          <div class="archive-level-options">
            <label
              class="radio-option"
              :class="{ 'is-selected': compressionLevel === 1 }"
            >
              <input v-model="compressionLevel" type="radio" :value="1" />
              <span>Швидкий (Fast)</span>
            </label>
            <label
              class="radio-option"
              :class="{ 'is-selected': compressionLevel === 6 }"
            >
              <input v-model="compressionLevel" type="radio" :value="6" />
              <span>Звичайний (Normal)</span>
            </label>
            <label
              class="radio-option"
              :class="{ 'is-selected': compressionLevel === 9 }"
            >
              <input v-model="compressionLevel" type="radio" :value="9" />
              <span>Максимальний (Maximum)</span>
            </label>
          </div>
        </div>

        <!-- Files Preview -->
        <div class="form-row">
          <label class="form-label">
            Файли для архівації ({{ sourceItems.length }}):
          </label>
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
        <button
          class="btn-secondary"
          :disabled="isCreating"
          @click="$emit('close')"
        >
          Скасувати (Esc)
        </button>
        <button
          class="btn-primary"
          :disabled="isCreating || !archiveName.trim()"
          @click="submit"
        >
          <Loader2 v-if="isCreating" :size="14" class="spin" />
          <Archive v-else :size="14" />
          <span>{{
            isCreating ? "Створення архіву..." : "Створити архів (Enter)"
          }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { Archive, Lock, X, Loader2 } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    sourceItems: string[];
    targetDir: string;
    isCreating?: boolean;
  }>(),
  {
    isCreating: false,
  },
);

const emit = defineEmits<{
  (
    e: "confirm",
    payload: {
      format: "zip" | "tar.gz";
      fullTarget: string;
      password?: string;
      level?: number;
    },
  ): void;
  (e: "close"): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const selectedFormat = ref<"zip" | "tar.gz">("zip");
const archiveName = ref("");
const password = ref("");
const showPassword = ref(false);
const compressionLevel = ref(6);
const isProcessing = ref(false);

function onFormatChange() {
  const base = archiveName.value.replace(/\.(zip|tar\.gz|tar|tgz)$/i, "");
  archiveName.value = `${base}.${selectedFormat.value}`;
}

function submit() {
  if (props.isCreating || isProcessing.value || !archiveName.value.trim()) return;
  isProcessing.value = true;
  let finalName = archiveName.value.trim();
  const expectedExt = `.${selectedFormat.value}`;
  if (!finalName.toLowerCase().endsWith(expectedExt)) {
    finalName += expectedExt;
  }
  const fullTarget = `${props.targetDir.replace(/\/+$/, "")}/${finalName}`;
  emit("confirm", {
    format: selectedFormat.value,
    fullTarget,
    password: password.value ? password.value.trim() : undefined,
    level: compressionLevel.value,
  });
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape" && !props.isCreating) {
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
