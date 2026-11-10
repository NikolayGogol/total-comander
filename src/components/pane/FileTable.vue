<template>
  <div
    class="file-table-wrapper"
    :class="{ 'is-drag-over': isDragOverTable }"
    ref="wrapperRef"
    tabindex="0"
    @click="handleWrapperClick"
    @keydown="handleKeyDown"
    @dragenter.prevent="onTableDragEnter"
    @dragover.prevent="onTableDragOver"
    @dragleave="onTableDragLeave"
    @drop.prevent="onTableDrop"
    @contextmenu.prevent="onTableContextMenu"
  >
    <table class="file-table">
      <thead>
        <tr>
          <th
            class="col-name"
            title="Сортувати за назвою (клік для перемикання A-Z / Z-A)"
            @click="$emit('sort', 'name')"
          >
            <span>Name</span>
            <span v-if="sortField === 'name'">{{
              sortOrder === "asc" ? "▲" : "▼"
            }}</span>
            <div
              class="col-resizer"
              title="Змінити ширину (подвійний клік для скидання)"
              @mousedown.stop="startResize('name', $event)"
              @dblclick.stop="resetColWidth('name')"
            />
          </th>
          <th
            class="col-ext"
            title="Сортувати за розширенням файлів"
            @click="$emit('sort', 'ext')"
          >
            <span>Ext</span>
            <span v-if="sortField === 'ext'">{{
              sortOrder === "asc" ? "▲" : "▼"
            }}</span>
            <div
              class="col-resizer"
              title="Змінити ширину (подвійний клік для скидання)"
              @mousedown.stop="startResize('ext', $event)"
              @dblclick.stop="resetColWidth('ext')"
            />
          </th>
          <th
            class="col-size"
            title="Сортувати за розміром файлів"
            @click="$emit('sort', 'size')"
          >
            <span>Size</span>
            <span v-if="sortField === 'size'">{{
              sortOrder === "asc" ? "▲" : "▼"
            }}</span>
            <div
              class="col-resizer"
              title="Змінити ширину (подвійний клік для скидання)"
              @mousedown.stop="startResize('size', $event)"
              @dblclick.stop="resetColWidth('size')"
            />
          </th>
          <th
            class="col-date"
            title="Сортувати за датою останньої модифікації"
            @click="$emit('sort', 'mtime')"
          >
            <span>Modified</span>
            <span v-if="sortField === 'mtime'">{{
              sortOrder === "asc" ? "▲" : "▼"
            }}</span>
            <div
              class="col-resizer"
              title="Змінити ширину (подвійний клік для скидання)"
              @mousedown.stop="startResize('date', $event)"
              @dblclick.stop="resetColWidth('date')"
            />
          </th>
          <th class="col-perms" title="Права доступу UNIX (POSIX permissions)">
            <span>Perms</span>
            <div
              class="col-resizer"
              title="Змінити ширину (подвійний клік для скидання)"
              @mousedown.stop="startResize('perms', $event)"
              @dblclick.stop="resetColWidth('perms')"
            />
          </th>
        </tr>
      </thead>
      <tbody>
        <!-- Parent Directory (..) -->
        <tr
          v-if="currentPath !== '/'"
          class="file-row is-parent"
          :class="{
            'is-cursor': cursorIndex === -1,
            'is-drag-target': dragTargetItemPath === '..',
          }"
          title="⤴ Перейти у батьківську директорію (Backspace або подвійний клік)"
          @click="setCursor(-1)"
          @dblclick="$emit('go-up')"
          @dragenter.prevent.stop="onParentDragEnter"
          @dragover.prevent.stop="onParentDragOver"
          @dragleave.stop="onParentDragLeave"
          @drop.prevent.stop="onParentDrop"
        >
          <td colspan="5">
            <div class="col-icon-name">
              <CornerLeftUp
                :size="14"
                class="parent-icon"
                title="Батьківська папка (..)"
              />
              <span>.. [Parent Directory]</span>
            </div>
          </td>
        </tr>

        <!-- File and Directory Rows -->
        <tr
          v-for="(item, index) in items"
          :key="item.path"
          class="file-row"
          :class="{
            'is-dir': item.isDirectory,
            'is-cursor': cursorIndex === index,
            'is-selected': isSelected(item.path),
            'is-hidden': item.isHidden,
            'is-drag-target': dragTargetItemPath === item.path,
          }"
          :draggable="true"
          :title="getItemTooltip(item)"
          @dragstart="onDragStart($event, item)"
          @dragend="onDragEnd"
          @dragenter.prevent.stop="onItemDragEnter($event, item)"
          @dragover.prevent.stop="onItemDragOver($event, item)"
          @dragleave.stop="onItemDragLeave($event, item)"
          @drop.prevent.stop="onItemDrop($event, item)"
          @click="handleRowClick($event, item, index)"
          @dblclick="handleRowDblClick(item)"
          @contextmenu.prevent.stop="onRowContextMenu($event, item, index)"
        >
          <td class="col-name">
            <div class="col-icon-name">
              <div class="item-icon-wrapper">
                <img
                  v-if="item.appIcon || getNativeIcon(item)"
                  :src="item.appIcon || getNativeIcon(item)"
                  class="item-icon item-icon-native"
                  :alt="item.name"
                  draggable="false"
                  :title="getItemIconTitle(item)"
                />
                <component
                  v-else
                  :is="getIconComponent(item)"
                  :size="14"
                  :class="['item-icon', getIconModifier(item)]"
                  :title="getItemIconTitle(item)"
                />
                <span
                  v-if="item.isAlias || item.isSymlink"
                  class="alias-arrow-badge"
                  title="Ярлик"
                >
                  ↗
                </span>
              </div>
              <span
                class="item-name"
                :class="{
                  'name-dir': item.isDirectory,
                  'name-alias': item.isAlias || item.isSymlink,
                }"
                :data-tooltip="getShortItemTooltip(item)"
                data-tooltip-pos="right"
                :title="getItemTooltip(item)"
              >
                {{ item.name }}
              </span>
            </div>
          </td>
          <td
            class="col-ext"
            :title="
              item.isAlias
                ? 'Ярлик до: ' + (item.aliasTarget || item.path)
                : item.isApp
                  ? 'Програма macOS'
                  : item.isDirectory
                    ? 'Папка'
                    : item.extension || 'Без розширення'
            "
          >
            <span v-if="item.isAlias" class="lnk-badge">&lt;LNK&gt;</span>
            <span v-else-if="item.isApp" class="app-badge">&lt;APP&gt;</span>
            <span
              v-else-if="!item.isDirectory && item.extension"
              class="ext-badge"
              :class="'ext-' + getCategory(item)"
            >
              {{ item.extension }}
            </span>
          </td>
          <td
            class="col-size"
            :title="
              item.isAlias
                ? 'Ярлик до: ' + (item.aliasTarget || item.path)
                : item.isApp
                  ? 'Програма macOS (.app)'
                  : item.isDirectory
                    ? 'Папка: клікніть Space для розрахунку розміру'
                    : formatNumber(item.size) + ' байт'
            "
          >
            <span
              v-if="calculatedDirSizes[item.path] !== undefined"
              class="calculated-size"
            >
              {{ formatBytes(calculatedDirSizes[item.path]) }}
            </span>
            <span
              v-else-if="calculatingDirs.has(item.path)"
              class="calculating-size"
            >
              <Loader2 :size="12" class="spin" />
            </span>
            <span v-else-if="item.isAlias" class="lnk-badge">&lt;LNK&gt;</span>
            <span v-else-if="item.isApp" class="app-badge">&lt;APP&gt;</span>
            <span v-else-if="item.isDirectory" class="dir-badge"
              >&lt;DIR&gt;</span
            >
            <span v-else class="file-size-text">{{
              formatBytes(item.size)
            }}</span>
          </td>
          <td class="col-date" :title="'Дата зміни: ' + formatDate(item.mtime)">
            {{ formatDate(item.mtime) }}
          </td>
          <td
            class="col-perms"
            :title="'Права доступу UNIX: ' + item.permissions"
          >
            {{ item.permissions }}
          </td>
        </tr>

        <!-- Empty State -->
        <tr v-if="items.length === 0 && !loading">
          <td colspan="5" class="empty-state">
            <span v-if="filterText"
              >Немає файлів за запитом "{{ filterText }}"</span
            >
            <span v-else>Директорія порожня</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Loading Overlay -->
    <div v-if="loading" class="loading-overlay">
      <span>Завантаження...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted, nextTick } from "vue";
import type { FileItem, SortField, SortOrder } from "@/types";
import {
  formatBytes,
  formatDate,
  formatNumber,
  getItemTooltip,
  getShortItemTooltip,
  getItemIconTitle,
  isArchive,
} from "@/utils/formatters";
import { useTableColumns } from "@/composables/useTableColumns";
import { useFileIcons } from "@/composables/useFileIcons";
import { extractDroppedPaths, getParentPath } from "@/utils/paths";
import { CornerLeftUp, Loader2 } from "lucide-vue-next";

const props = defineProps<{
  items: FileItem[];
  currentPath: string;
  cursorIndex: number;
  selectedPaths: Set<string>;
  sortField: SortField;
  sortOrder: SortOrder;
  filterText: string;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: "navigate", path: string): void;
  (e: "go-up"): void;
  (e: "open-native", item: FileItem): void;
  (e: "open-archive", item: FileItem): void;
  (e: "update-cursor", index: number): void;
  (e: "toggle-select", path: string): void;
  (e: "select-range", fromIndex: number, toIndex: number): void;
  (e: "clear-selection"): void;
  (e: "sort", field: SortField): void;
  (
    e: "drop-items",
    sourcePaths: string[],
    targetDir: string,
    isMove?: boolean,
  ): void;
  (
    e: "context-menu",
    payload: { x: number; y: number; item: FileItem | null },
  ): void;
}>();

const wrapperRef = ref<HTMLElement | null>(null);
const isDragOverTable = ref(false);
const dragTargetItemPath = ref<string | null>(null);
const calculatedDirSizes = reactive<Record<string, number>>({});
const calculatingDirs = reactive<Set<string>>(new Set());

const { startResize, resetColWidth, loadSavedColWidths } =
  useTableColumns(wrapperRef);

const {
  getNativeIcon,
  fetchIconsForItems,
  getIconComponent,
  getIconModifier,
  getCategory,
} = useFileIcons();

watch(
  () => props.items,
  (newItems) => {
    if (newItems && newItems.length > 0) {
      fetchIconsForItems(newItems);
    }
  },
  { immediate: true },
);

async function calculateDirectorySize(dirPath: string) {
  if (calculatingDirs.has(dirPath)) return;
  calculatingDirs.add(dirPath);
  try {
    const res = await window.electronAPI.getDirSize(dirPath);
    if (res.success && res.size !== undefined) {
      calculatedDirSizes[dirPath] = res.size;
    }
  } catch {
  } finally {
    calculatingDirs.delete(dirPath);
  }
}

function isSelected(path: string): boolean {
  return props.selectedPaths.has(path);
}

function setCursor(idx: number) {
  emit("update-cursor", idx);
}

function handleWrapperClick(e: MouseEvent) {
  if ((e.target as HTMLElement)?.closest("tbody")) return;
  emit("clear-selection");
}

function onRowContextMenu(e: MouseEvent, item: FileItem, index: number) {
  if (!props.selectedPaths.has(item.path)) {
    setCursor(index);
  }
  emit("context-menu", { x: e.clientX, y: e.clientY, item });
}

function onTableContextMenu(e: MouseEvent) {
  emit("context-menu", { x: e.clientX, y: e.clientY, item: null });
}

function handleRowClick(e: MouseEvent, item: FileItem, index: number) {
  if (e.shiftKey) {
    emit("select-range", props.cursorIndex >= 0 ? props.cursorIndex : 0, index);
  } else if (e.metaKey || e.ctrlKey) {
    emit("toggle-select", item.path);
    setCursor(index);
  } else {
    setCursor(index);
  }
}

function handleRowDblClick(item: FileItem) {
  if (item.isAlias && item.aliasTarget) {
    if (item.aliasTarget.endsWith(".app")) {
      emit("open-native", item);
      return;
    }
    if (item.isDirectory) {
      emit("navigate", item.aliasTarget);
      return;
    }
    emit("open-native", item);
    return;
  }
  if (item.isApp) {
    emit("open-native", item);
  } else if (isArchive(item)) {
    emit("open-archive", item);
  } else if (item.isDirectory) {
    emit("navigate", item.path);
  } else {
    emit("open-native", item);
  }
}

// Keyboard navigation
function handleKeyDown(e: KeyboardEvent) {
  const len = props.items.length;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (props.cursorIndex < len - 1) {
      setCursor(props.cursorIndex + 1);
      scrollToCursor();
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (props.cursorIndex > (props.currentPath !== "/" ? -1 : 0)) {
      setCursor(props.cursorIndex - 1);
      scrollToCursor();
    }
  } else if (e.key === "Home") {
    e.preventDefault();
    setCursor(props.currentPath !== "/" ? -1 : 0);
    scrollToCursor();
  } else if (e.key === "End") {
    e.preventDefault();
    if (len > 0) {
      setCursor(len - 1);
      scrollToCursor();
    }
  } else if (e.key === "PageUp") {
    e.preventDefault();
    setCursor(
      Math.max(props.currentPath !== "/" ? -1 : 0, props.cursorIndex - 15),
    );
    scrollToCursor();
  } else if (e.key === "PageDown") {
    e.preventDefault();
    setCursor(Math.min(len - 1, props.cursorIndex + 15));
    scrollToCursor();
  } else if (e.key === " " || e.key === "Insert") {
    e.preventDefault();
    if (props.cursorIndex >= 0 && props.cursorIndex < len) {
      const item = props.items[props.cursorIndex];
      if (e.key === " " && item.isDirectory && !item.isApp && !item.isAlias) {
        calculateDirectorySize(item.path);
      } else {
        emit("toggle-select", item.path);
        if (props.cursorIndex < len - 1) {
          setCursor(props.cursorIndex + 1);
          scrollToCursor();
        }
      }
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (props.cursorIndex === -1) {
      emit("go-up");
    } else if (props.cursorIndex >= 0 && props.cursorIndex < len) {
      const item = props.items[props.cursorIndex];
      if (item.isAlias && item.aliasTarget) {
        if (item.aliasTarget.endsWith(".app")) {
          emit("open-native", item);
        } else if (item.isDirectory) {
          emit("navigate", item.aliasTarget);
        } else {
          emit("open-native", item);
        }
      } else if (item.isApp) {
        emit("open-native", item);
      } else if (isArchive(item)) {
        emit("open-archive", item);
      } else if (item.isDirectory) {
        emit("navigate", item.path);
      } else {
        emit("open-native", item);
      }
    }
  } else if (e.key === "Backspace" && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    emit("go-up");
  }
}

function scrollToCursor() {
  nextTick(() => {
    const el = wrapperRef.value?.querySelector(".is-cursor") as HTMLElement;
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  });
}

// Drag and drop handlers
function onDragStart(e: DragEvent, item: FileItem) {
  if (item.name === "..") {
    e.preventDefault();
    return;
  }

  let paths: string[];
  if (isSelected(item.path)) {
    paths = Array.from(props.selectedPaths);
  } else {
    paths = [item.path];
    const idx = props.items.findIndex((it) => it.path === item.path);
    if (idx !== -1) {
      setCursor(idx);
    }
  }

  // 1. Shared in-app drag session (guarantees reliable drop between panes)
  (window as any).__TC_ACTIVE_DRAG__ = {
    sources: paths,
    fromPath: props.currentPath,
    time: Date.now(),
  };

  // 2. DataTransfer payload
  if (e.dataTransfer) {
    try {
      e.dataTransfer.setData("tc/paths", JSON.stringify(paths));
      e.dataTransfer.setData("application/json", JSON.stringify(paths));
      e.dataTransfer.setData("text/plain", paths.join("\n"));
      e.dataTransfer.effectAllowed = "copyMove";
    } catch {}
  }

  // 3. Native macOS drag to Desktop, Finder, and external apps
  if (
    window.electronAPI &&
    typeof window.electronAPI.startDrag === "function"
  ) {
    window.electronAPI.startDrag(paths);
  }
}

function onDragEnd() {
  setTimeout(() => {
    (window as any).__TC_ACTIVE_DRAG__ = null;
  }, 400);
}

function onTableDragEnter(e: DragEvent) {
  e.preventDefault();
  isDragOverTable.value = true;
}

function onTableDragOver(e: DragEvent) {
  e.preventDefault();
  isDragOverTable.value = true;
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = e.shiftKey || e.altKey ? "move" : "copy";
  }
}

function onTableDragLeave(e: DragEvent) {
  const currentTarget = e.currentTarget as HTMLElement | null;
  const related = e.relatedTarget as HTMLElement | null;
  if (currentTarget && related && currentTarget.contains(related)) {
    return;
  }
  isDragOverTable.value = false;
}

function onTableDrop(e: DragEvent) {
  isDragOverTable.value = false;
  dragTargetItemPath.value = null;
  const sources = extractDroppedPaths(e);
  if (sources.length > 0) {
    emit("drop-items", sources, props.currentPath, e.shiftKey || e.altKey);
  }
}

function onParentDragEnter(e: DragEvent) {
  e.preventDefault();
  dragTargetItemPath.value = "..";
}

function onParentDragOver(e: DragEvent) {
  e.preventDefault();
  dragTargetItemPath.value = "..";
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = e.shiftKey || e.altKey ? "move" : "copy";
  }
}

function onParentDragLeave(e: DragEvent) {
  const currentTarget = e.currentTarget as HTMLElement | null;
  const related = e.relatedTarget as HTMLElement | null;
  if (currentTarget && related && currentTarget.contains(related)) {
    return;
  }
  if (dragTargetItemPath.value === "..") {
    dragTargetItemPath.value = null;
  }
}

function onParentDrop(e: DragEvent) {
  dragTargetItemPath.value = null;
  isDragOverTable.value = false;
  const sources = extractDroppedPaths(e);
  if (sources.length > 0) {
    const parentPath = getParentPath(props.currentPath);
    emit("drop-items", sources, parentPath, e.shiftKey || e.altKey);
  }
}

function onItemDragEnter(e: DragEvent, item: FileItem) {
  e.preventDefault();
  if (item.isDirectory) {
    dragTargetItemPath.value = item.path;
  }
}

function onItemDragOver(e: DragEvent, item: FileItem) {
  e.preventDefault();
  if (item.isDirectory) {
    dragTargetItemPath.value = item.path;
  }
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = e.shiftKey || e.altKey ? "move" : "copy";
  }
}

function onItemDragLeave(e: DragEvent, item: FileItem) {
  const currentTarget = e.currentTarget as HTMLElement | null;
  const related = e.relatedTarget as HTMLElement | null;
  if (currentTarget && related && currentTarget.contains(related)) {
    return;
  }
  if (dragTargetItemPath.value === item.path) {
    dragTargetItemPath.value = null;
  }
}

function onItemDrop(e: DragEvent, item: FileItem) {
  dragTargetItemPath.value = null;
  isDragOverTable.value = false;
  const sources = extractDroppedPaths(e);
  if (sources.length > 0) {
    const target = item.isDirectory ? item.path : props.currentPath;
    emit("drop-items", sources, target, e.shiftKey || e.altKey);
  }
}

function onGlobalMouseUp() {
  if ((window as any).__TC_ACTIVE_DRAG__) {
    setTimeout(() => {
      (window as any).__TC_ACTIVE_DRAG__ = null;
    }, 400);
  }
}

onMounted(() => {
  loadSavedColWidths();
  window.addEventListener("mouseup", onGlobalMouseUp);
});

onUnmounted(() => {
  window.removeEventListener("mouseup", onGlobalMouseUp);
});

defineExpose({
  focus: () => wrapperRef.value?.focus(),
  scrollToCursor,
  calculateDirectorySize,
});
</script>
