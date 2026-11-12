<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card open-with-card">
      <div class="modal-header">
        <div class="modal-title">
          <AppWindow :size="16" class="icon-blue" />
          <span>Відкрити за допомогою...</span>
        </div>
        <button
          class="modal-close-btn"
          title="Закрити (Esc)"
          @click="$emit('close')"
        >
          <X :size="15" />
        </button>
      </div>

      <div class="modal-body open-with-body">
        <!-- File Info Bar -->
        <div class="file-info-header">
          <div class="file-info-icon-col">
            <Archive
              v-if="isArchive(item)"
              :size="24"
              class="item-icon icon-archive"
            />
            <component
              v-else
              :is="getIconComponent(item)"
              :size="24"
              :class="['item-icon', getIconModifier(item)]"
            />
          </div>
          <div class="file-info-details">
            <div class="file-info-name" :title="item.path">
              {{ item.name }}
            </div>
            <div class="file-info-meta">
              <span>{{ formatBytes(item.size) }}</span>
              <span class="meta-dot">•</span>
              <span>{{
                getFileTypeDescription(
                  item.extension || item.name,
                  item.isDirectory,
                )
              }}</span>
            </div>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="open-with-search">
          <Search :size="14" class="search-icon" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            class="form-input search-input"
            placeholder="Швидкий пошук програми (VS Code, TextEdit, Preview)..."
            @keydown.down.prevent="navigateList(1)"
            @keydown.up.prevent="navigateList(-1)"
            @keydown.enter.prevent="submitSelected"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="search-clear-btn"
            title="Очистити пошук"
            @click="searchQuery = ''"
          >
            <X :size="12" />
          </button>
        </div>

        <!-- App List -->
        <div class="open-with-list-wrapper">
          <div v-if="loading" class="open-with-state-box">
            <Loader2 :size="20" class="spin icon-blue" />
            <span>Пошук встановлених програм macOS...</span>
          </div>

          <div
            v-else-if="allFilteredApps.length === 0"
            class="open-with-state-box"
          >
            <AlertCircle :size="20" class="icon-rose" />
            <span>Програм за запитом "{{ searchQuery }}" не знайдено</span>
          </div>

          <div v-else class="open-with-sections">
            <!-- Recommended Apps Section -->
            <div
              v-if="recommendedApps.length > 0 && !searchQuery.trim()"
              class="app-section"
            >
              <div class="section-title">
                <Star :size="12" class="icon-amber" />
                <span>Рекомендовані для цього типу файлу</span>
              </div>
              <div class="app-list">
                <div
                  v-for="app in recommendedApps"
                  :key="'rec-' + app.path"
                  class="app-item"
                  :class="{ 'is-selected': selectedApp?.path === app.path }"
                  @click="selectedApp = app"
                  @dblclick="submit(app)"
                >
                  <div class="app-icon-wrapper">
                    <img
                      v-if="appIcons[app.path]"
                      :src="appIcons[app.path]"
                      class="app-icon-img"
                      :alt="app.name"
                      draggable="false"
                    />
                    <AppWindow v-else :size="20" class="app-icon-fallback" />
                  </div>
                  <div class="app-info">
                    <div class="app-name-row">
                      <span class="app-name">{{ app.name }}</span>
                      <span class="recommended-tag">Рекомендовано</span>
                    </div>
                    <div class="app-path" :title="app.path">{{ app.path }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- All Apps Section -->
            <div class="app-section">
              <div class="section-title">
                <span>
                  {{
                    searchQuery.trim()
                      ? "Результати пошуку"
                      : "Всі встановлені програми"
                  }}
                  ({{ allFilteredApps.length }})
                </span>
              </div>
              <div class="app-list">
                <div
                  v-for="app in allFilteredApps"
                  :key="'all-' + app.path"
                  class="app-item"
                  :class="{ 'is-selected': selectedApp?.path === app.path }"
                  @click="selectedApp = app"
                  @dblclick="submit(app)"
                >
                  <div class="app-icon-wrapper">
                    <img
                      v-if="appIcons[app.path]"
                      :src="appIcons[app.path]"
                      class="app-icon-img"
                      :alt="app.name"
                      draggable="false"
                    />
                    <AppWindow v-else :size="20" class="app-icon-fallback" />
                  </div>
                  <div class="app-info">
                    <div class="app-name-row">
                      <span class="app-name">{{ app.name }}</span>
                    </div>
                    <div class="app-path" :title="app.path">{{ app.path }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer open-with-footer">
        <button
          type="button"
          class="btn-secondary btn-browse-app"
          title="Вибрати будь-яку програму або утиліту у вікні Finder"
          @click="browseDisk"
        >
          <FolderOpen :size="14" />
          <span>Огляд на диску...</span>
        </button>

        <div class="footer-actions-right">
          <button type="button" class="btn-secondary" @click="$emit('close')">
            Скасувати (Esc)
          </button>
          <button
            type="button"
            class="btn-primary"
            :disabled="!selectedApp"
            @click="submitSelected"
          >
            <ExternalLink :size="14" />
            <span>Відкрити (Enter)</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import {
  AppWindow,
  X,
  Search,
  Loader2,
  AlertCircle,
  Star,
  FolderOpen,
  ExternalLink,
  Archive,
} from "lucide-vue-next";
import type { FileItem } from "@/types";
import {
  formatBytes,
  getFileTypeDescription,
  isArchive,
  getFileCategory,
} from "@/utils/formatters";
import { useFileIcons } from "@/composables/useFileIcons";

interface InstalledApp {
  name: string;
  path: string;
}

const props = defineProps<{
  item: FileItem;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "open-with", appPath: string): void;
}>();

const { getIconComponent, getIconModifier } = useFileIcons();

const searchInputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref("");
const apps = ref<InstalledApp[]>([]);
const appIcons = ref<Record<string, string>>({});
const loading = ref(true);
const selectedApp = ref<InstalledApp | null>(null);

const RECOMMENDATION_MAP: Record<string, string[]> = {
  code: [
    "visual studio code",
    "antigravity ide",
    "sublime text",
    "webstorm",
    "xcode",
    "textedit",
    "coteditor",
    "nova",
    "intellij idea",
    "pycharm",
    "cursor",
  ],
  image: [
    "preview",
    "pixelmator pro",
    "adobe photoshop",
    "figma",
    "safari",
    "google chrome",
    "firefox",
    "imageoptim",
    "gimp",
  ],
  video: [
    "quicktime player",
    "vlc",
    "iina",
    "mpv",
    "elmedia player",
    "compressor",
  ],
  audio: [
    "music",
    "quicktime player",
    "vlc",
    "audacity",
    "garageband",
    "spotify",
  ],
  doc: [
    "preview",
    "textedit",
    "pages",
    "microsoft word",
    "numbers",
    "microsoft excel",
    "keynote",
    "microsoft powerpoint",
    "adobe acrobat",
  ],
  archive: [
    "archive utility",
    "the unarchiver",
    "keka",
    "total commander",
    "betterzip",
    "diskimagemounter",
  ],
};

function getCategoryRecommendations(): string[] {
  if (isArchive(props.item)) return RECOMMENDATION_MAP.archive;
  const ext = (props.item.extension || "").toLowerCase();
  if (ext === "dmg" || ext === "iso")
    return ["diskimagemounter", "disk utility", "total commander"];
  const cat = getFileCategory(
    props.item.extension || props.item.name,
    props.item.isDirectory,
  ).category;
  return RECOMMENDATION_MAP[cat] || ["textedit", "preview"];
}

const recommendedApps = computed(() => {
  const recList = getCategoryRecommendations();
  return apps.value.filter((app) => {
    const lower = app.name.toLowerCase();
    return recList.some((r) => lower === r || lower.includes(r));
  });
});

const allFilteredApps = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return apps.value;
  return apps.value.filter(
    (app) =>
      app.name.toLowerCase().includes(q) || app.path.toLowerCase().includes(q),
  );
});

function navigateList(dir: 1 | -1) {
  const list = allFilteredApps.value;
  if (!list.length) return;
  const curIdx = selectedApp.value
    ? list.findIndex((a) => a.path === selectedApp.value!.path)
    : -1;
  const nextIdx = Math.max(0, Math.min(list.length - 1, curIdx + dir));
  selectedApp.value = list[nextIdx];
}

function submit(app: InstalledApp | null) {
  if (!app) return;
  emit("open-with", app.path);
}

function submitSelected() {
  submit(selectedApp.value);
}

async function browseDisk() {
  try {
    const res = await window.electronAPI.selectAppDialog();
    if (!res.canceled && res.appPath) {
      emit("open-with", res.appPath);
    }
  } catch {}
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    emit("close");
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onKeyDown);
  nextTick(() => {
    searchInputRef.value?.focus();
  });

  try {
    const res = await window.electronAPI.getInstalledApps();
    if (res.success && res.apps) {
      apps.value = res.apps;
      if (recommendedApps.value.length > 0) {
        selectedApp.value = recommendedApps.value[0];
      } else if (apps.value.length > 0) {
        selectedApp.value = apps.value[0];
      }

      // Fetch native app icons in batch
      try {
        const toFetch = res.apps.map((a) => ({
          path: a.path,
          name: a.name + ".app",
          isDirectory: false,
          isApp: true,
          extension: "app",
        }));
        const icons = await window.electronAPI.getFileIcons(toFetch as any);
        if (icons && typeof icons === "object") {
          appIcons.value = icons;
        }
      } catch {}
    }
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
});
</script>

