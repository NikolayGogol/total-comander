<template>
  <div class="modal-overlay" @click.self="$emit('cancel')">
    <div class="modal-card op-card">
      <div class="modal-header">
        <div class="modal-title">
          <component
            :is="modalIcon"
            :size="16"
            :class="modalIconClass"
            :title="modalTitle"
          />
          <span>{{ modalTitle }}</span>
        </div>
        <button
          class="modal-close-btn"
          title="Cancel (Esc)"
          @click="$emit('cancel')"
        >
          <X :size="15" title="Close" />
        </button>
      </div>

      <div class="modal-body">
        <!-- New Folder (F7) -->
        <div v-if="opType === 'mkdir'">
          <label class="op-label"
            >Create directory in: <code>{{ targetDir }}</code></label
          >
          <input
            ref="inputRef"
            v-model="inputText"
            type="text"
            class="form-input"
            placeholder="New folder name"
            @keydown.enter="submit"
          />
        </div>

        <!-- New File -->
        <div v-else-if="opType === 'newfile'">
          <label class="op-label"
            >Create new file in: <code>{{ targetDir }}</code></label
          >
          <input
            ref="inputRef"
            v-model="inputText"
            type="text"
            class="form-input"
            placeholder="e.g. notes.txt or script.sh"
            @keydown.enter="submit"
          />
        </div>

        <!-- Rename (F2) -->
        <div v-else-if="opType === 'rename'">
          <label class="op-label"
            >Rename: <code>{{ sourceItems[0] }}</code></label
          >
          <input
            ref="inputRef"
            v-model="inputText"
            type="text"
            class="form-input"
            placeholder="New name"
            @keydown.enter="submit"
          />
        </div>

        <!-- Copy (F5) -->
        <div v-else-if="opType === 'copy'">
          <label class="op-label"
            >Copy {{ sourceItems.length }} item(s) to destination
            directory:</label
          >
          <input
            ref="inputRef"
            v-model="inputText"
            type="text"
            class="form-input"
            placeholder="Destination directory"
            @keydown.enter="submit"
          />
          <div class="items-preview-list">
            <div
              v-for="item in sourceItems.slice(0, 5)"
              :key="item"
              class="item-preview"
            >
              {{ item }}
            </div>
            <div v-if="sourceItems.length > 5" class="item-preview-more">
              + {{ sourceItems.length - 5 }} more item(s)
            </div>
          </div>
        </div>

        <!-- Move (F6) -->
        <div v-else-if="opType === 'move'">
          <label class="op-label"
            >Move {{ sourceItems.length }} item(s) to destination
            directory:</label
          >
          <input
            ref="inputRef"
            v-model="inputText"
            type="text"
            class="form-input"
            placeholder="Destination directory"
            @keydown.enter="submit"
          />
          <div class="items-preview-list">
            <div
              v-for="item in sourceItems.slice(0, 5)"
              :key="item"
              class="item-preview"
            >
              {{ item }}
            </div>
            <div v-if="sourceItems.length > 5" class="item-preview-more">
              + {{ sourceItems.length - 5 }} more item(s)
            </div>
          </div>
        </div>

        <!-- Create Archive (Alt+F5) -->
        <div v-else-if="opType === 'archive'">
          <label class="op-label"
            >Створити ZIP-архів ({{ sourceItems.length }} елемент(ів)):</label
          >
          <input
            ref="inputRef"
            v-model="inputText"
            type="text"
            class="form-input"
            placeholder="Назва архіву (наприклад: archive.zip)"
            @keydown.enter="submit"
          />
          <div class="items-preview-list">
            <div
              v-for="item in sourceItems.slice(0, 5)"
              :key="item"
              class="item-preview"
            >
              {{ item }}
            </div>
            <div v-if="sourceItems.length > 5" class="item-preview-more">
              + {{ sourceItems.length - 5 }} more item(s)
            </div>
          </div>
        </div>

        <!-- Delete (F8 / Shift+Delete) -->
        <div v-else-if="opType === 'delete'">
          <p class="delete-warning">
            <span v-if="targetDir === 'PERMANENT'">
              УВАГА! Ви дійсно бажаєте
              <strong
                >БЕЗПОВОРОТНО ВИДАЛИТИ
                {{ sourceItems.length }} елемент(ів)</strong
              >
              без можливості відновлення зі Смітника?
            </span>
            <span v-else>
              Ви впевнені, що хочете перемістити
              <strong>{{ sourceItems.length }} елемент(ів)</strong> у macOS
              Смітник?
            </span>
          </p>
          <div class="items-preview-list">
            <div
              v-for="item in sourceItems.slice(0, 6)"
              :key="item"
              class="item-preview"
            >
              {{ item }}
            </div>
            <div v-if="sourceItems.length > 6" class="item-preview-more">
              + {{ sourceItems.length - 6 }} more item(s)
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('cancel')">
          Cancel (Esc)
        </button>
        <button
          v-if="opType === 'delete'"
          ref="confirmBtnRef"
          class="btn-danger"
          :disabled="isProcessing"
          @click="submit"
        >
          {{
            isProcessing
              ? "Видалення..."
              : targetDir === "PERMANENT"
                ? "Безповоротно видалити (Shift+Del)"
                : "У Смітник (Delete)"
          }}
        </button>
        <button
          v-else
          ref="confirmBtnRef"
          class="btn-primary"
          :disabled="isProcessing || (opType !== 'delete' && !inputText.trim())"
          @click="submit"
        >
          {{ isProcessing ? "Processing..." : "Confirm (Enter)" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import {
  FolderPlus,
  FilePlus,
  Copy,
  Move,
  Trash2,
  Edit3,
  X,
} from "lucide-vue-next";

const props = defineProps<{
  opType: "copy" | "move" | "mkdir" | "newfile" | "delete" | "rename";
  sourceItems: string[];
  targetDir: string;
}>();

const emit = defineEmits<{
  (e: "confirm", payload: { opType: string; target: string }): void;
  (e: "cancel"): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const confirmBtnRef = ref<HTMLButtonElement | null>(null);
const inputText = ref("");
const isProcessing = ref(false);

const modalTitle = computed(() => {
  switch (props.opType) {
    case "mkdir":
      return "Create Directory (F7)";
    case "newfile":
      return "Create File (Shift+F4)";
    case "copy":
      return "Copy Files (F5)";
    case "move":
      return "Move / Rename (F6)";
    case "delete":
      return props.targetDir === "PERMANENT"
        ? "Permanent Delete (Shift+Del)"
        : "Delete Files (F8)";
    case "rename":
      return "Rename (F2)";
    default:
      return "Operation";
  }
});

const modalIcon = computed(() => {
  switch (props.opType) {
    case "mkdir":
      return FolderPlus;
    case "newfile":
      return FilePlus;
    case "copy":
      return Copy;
    case "move":
      return Move;
    case "delete":
      return Trash2;
    case "rename":
      return Edit3;
    default:
      return FilePlus;
  }
});

const modalIconClass = computed(() => {
  switch (props.opType) {
    case "mkdir":
      return "icon-emerald";
    case "newfile":
      return "icon-cyan";
    case "copy":
      return "icon-blue";
    case "move":
      return "icon-amber";
    case "delete":
      return "icon-rose";
    case "rename":
      return "icon-cyan";
    default:
      return "icon-blue";
  }
});

function submit() {
  if (isProcessing.value) return;
  if (props.opType !== "delete" && !inputText.value.trim()) return;
  isProcessing.value = true;
  emit("confirm", {
    opType: props.opType,
    target: inputText.value.trim(),
  });
}

function handleModalKeyDown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    submit();
  } else if (e.key === "Escape") {
    e.preventDefault();
    emit("cancel");
  }
}

onMounted(() => {
  if (props.opType === "mkdir") {
    inputText.value = "New Folder";
  } else if (props.opType === "newfile") {
    inputText.value = "new_file.txt";
  } else if (props.opType === "copy" || props.opType === "move") {
    inputText.value = props.targetDir;
  } else if (props.opType === "rename" && props.sourceItems[0]) {
    inputText.value =
      props.sourceItems[0].split("/").filter(Boolean).pop() || "";
  }

  nextTick(() => {
    if (props.opType === "delete") {
      confirmBtnRef.value?.focus();
    } else {
      inputRef.value?.focus();
      inputRef.value?.select();
    }
  });

  window.addEventListener("keydown", handleModalKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleModalKeyDown);
});
</script>
