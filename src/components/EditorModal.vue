<template>
  <div class="modal-overlay" @click.self="requestClose">
    <div class="modal-card editor-card">
      <div class="modal-header">
        <div class="modal-title">
          <FileEdit :size="16" class="icon-amber" title="Editor" />
          <span>{{ fileName }}</span>
          <span v-if="isDirty" class="dirty-badge" title="Unsaved modifications"
            >* Modified</span
          >
        </div>
        <div class="editor-header-actions">
          <button
            class="btn-primary"
            :disabled="saving || !isDirty"
            title="Save changes (Cmd+S)"
            @click="saveFile"
          >
            <Save :size="13" title="Save" />
            <span>{{ saving ? "Saving..." : "Save (Cmd+S)" }}</span>
          </button>
          <button
            class="modal-close-btn"
            title="Close editor (Esc)"
            @click="requestClose"
          >
            <X :size="15" title="Close" />
          </button>
        </div>
      </div>

      <div class="modal-body editor-body">
        <div v-if="loading" class="editor-status">Loading file...</div>
        <div v-else-if="error" class="editor-status error">{{ error }}</div>
        <div v-else class="editor-workspace">
          <div class="editor-line-numbers" ref="lineNumbersRef">
            <div v-for="line in lineCount" :key="line" class="editor-line-num">
              {{ line }}
            </div>
          </div>
          <textarea
            ref="textareaRef"
            v-model="content"
            class="editor-textarea"
            spellcheck="false"
            @input="onInput"
            @scroll="syncScroll"
            @keydown="handleKeyDown"
          ></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <div class="editor-stats">
          <span>UTF-8</span>
          <span>{{ lineCount }} lines</span>
          <span>{{ content.length }} chars</span>
        </div>
        <div class="footer-actions">
          <button class="btn-secondary" @click="requestClose">Cancel</button>
          <button
            class="btn-primary"
            :disabled="saving || !isDirty"
            @click="saveFile"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { FileEdit, Save, X } from "lucide-vue-next";

const props = defineProps<{
  filePath: string;
  fileName: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "saved"): void;
}>();

const content = ref("");
const originalContent = ref("");
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const lineNumbersRef = ref<HTMLElement | null>(null);

const isDirty = computed(() => content.value !== originalContent.value);
const lineCount = computed(() => Math.max(1, content.value.split("\n").length));

function onInput() {
  // reactivity
}

function syncScroll() {
  if (textareaRef.value && lineNumbersRef.value) {
    lineNumbersRef.value.scrollTop = textareaRef.value.scrollTop;
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    saveFile();
  } else if (e.key === "Tab") {
    e.preventDefault();
    const textarea = textareaRef.value;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    content.value =
      content.value.substring(0, start) + "  " + content.value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + 2;
  }
}

async function saveFile() {
  saving.value = true;
  try {
    const res = await window.electronAPI.writeFile(
      props.filePath,
      content.value,
    );
    if (res.success) {
      originalContent.value = content.value;
      emit("saved");
    } else {
      alert(`Failed to save: ${res.error}`);
    }
  } catch (err: any) {
    alert(`Error: ${err.message}`);
  } finally {
    saving.value = false;
  }
}

function requestClose() {
  if (isDirty.value) {
    if (confirm("You have unsaved changes. Are you sure you want to exit?")) {
      emit("close");
    }
  } else {
    emit("close");
  }
}

onMounted(async () => {
  try {
    const res = await window.electronAPI.readFile(props.filePath);
    if (res.success) {
      if (res.isBinary) {
        error.value = "Cannot edit binary file in text editor.";
      } else {
        content.value = res.content || "";
        originalContent.value = content.value;
      }
    } else {
      error.value = res.error || "Failed to read file";
    }
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});
</script>
