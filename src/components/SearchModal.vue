<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card search-card">
      <div class="modal-header">
        <div class="modal-title">
          <Search :size="16" class="icon-blue" title="Search" />
          <span>Search Files (Total Commander Search)</span>
        </div>
        <button
          class="modal-close-btn"
          title="Close (Esc)"
          @click="$emit('close')"
        >
          <X :size="15" title="Close" />
        </button>
      </div>

      <div class="modal-body search-body">
        <div class="search-form">
          <div class="form-row">
            <label class="form-label">Search in:</label>
            <input v-model="searchDir" type="text" class="form-input" />
          </div>

          <div class="form-row-grid">
            <div class="form-row">
              <label class="form-label">File name / Pattern:</label>
              <input
                ref="nameInputRef"
                v-model="nameQuery"
                type="text"
                class="form-input"
                placeholder="e.g. *.ts or config"
                @keydown.enter="runSearch"
              />
            </div>

            <div class="form-row">
              <label class="form-label">Containing text:</label>
              <input
                v-model="contentQuery"
                type="text"
                class="form-input"
                placeholder="Find text inside files..."
                @keydown.enter="runSearch"
              />
            </div>
          </div>

          <div class="form-options">
            <label class="checkbox-label">
              <input type="checkbox" v-model="recursive" />
              <span>Шукати у підпапках (рекурсивно)</span>
            </label>

            <div class="search-actions-group">
              <button
                type="button"
                class="btn-secondary"
                title="Пошук великих файлів для звільнення місця (>50MB, >1GB)"
                @click="openLargeFiles"
              >
                <PieChart :size="13" />
                <span>Аналізатор диска...</span>
              </button>
              <button
                class="btn-primary"
                :disabled="searching"
                @click="runSearch"
              >
                <Search :size="13" />
                <span>{{ searching ? "Пошук..." : "Почати пошук" }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Search Results List -->
        <div class="search-results-wrapper">
          <table class="search-table" v-if="results.length > 0">
            <thead>
              <tr>
                <th class="search-col-name">File Name</th>
                <th class="search-col-path">Location</th>
                <th class="search-col-size">Size</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in results"
                :key="item.path"
                class="search-row"
                :title="'Double-click to open in pane: ' + item.path"
                @dblclick="jumpToFile(item)"
              >
                <td>
                  <div class="search-item-name">
                    <component
                      :is="item.isDirectory ? Folder : File"
                      :size="13"
                      class="icon-cyan"
                      :title="item.isDirectory ? 'Folder' : 'File'"
                    />
                    <span>{{ item.name }}</span>
                  </div>
                  <div
                    v-if="item.matchLine"
                    class="match-line-snippet"
                    :title="'Matched content: ' + item.matchLine"
                  >
                    "{{ item.matchLine }}"
                  </div>
                </td>
                <td class="search-item-path" :title="item.path">
                  {{ item.path }}
                </td>
                <td class="search-size-cell">
                  <span v-if="item.isDirectory" class="dir-badge"
                    >&lt;DIR&gt;</span
                  >
                  <span v-else>{{ formatBytes(item.size) }}</span>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else-if="!searching" class="search-empty">
            <span v-if="hasSearched">No results found for current query</span>
            <span v-else>Enter search criteria and click Start Search</span>
          </div>

          <div v-else class="search-empty">
            <span>Searching files...</span>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <span class="search-stats"> {{ results.length }} result(s) found </span>
        <button class="btn-secondary" @click="$emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import type { SearchResult } from "@/types";
import { formatBytes } from "@/utils/formatters";
import { Search, X, Folder, File, PieChart } from "lucide-vue-next";

const props = defineProps<{
  initialDir: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "jump-to", filePath: string): void;
  (e: "open-large-files", searchDir: string): void;
}>();

const searchDir = ref("");
const nameQuery = ref("");
const contentQuery = ref("");
const recursive = ref(true);
const searching = ref(false);
const hasSearched = ref(false);
const results = ref<SearchResult[]>([]);
const nameInputRef = ref<HTMLInputElement | null>(null);

function openLargeFiles() {
  emit("open-large-files", searchDir.value.trim() || props.initialDir);
  emit("close");
}

async function runSearch() {
  if (!searchDir.value.trim()) return;
  searching.value = true;
  hasSearched.value = true;
  results.value = [];

  try {
    const res = await window.electronAPI.search(
      searchDir.value.trim(),
      nameQuery.value.trim(),
      recursive.value,
      contentQuery.value.trim() || undefined,
    );
    if (res.success && res.results) {
      results.value = res.results;
    }
  } catch (err: any) {
    console.error(err);
  } finally {
    searching.value = false;
  }
}

function jumpToFile(item: SearchResult) {
  emit("jump-to", item.path);
}

onMounted(() => {
  searchDir.value = props.initialDir;
  nextTick(() => {
    nameInputRef.value?.focus();
  });
});
</script>
