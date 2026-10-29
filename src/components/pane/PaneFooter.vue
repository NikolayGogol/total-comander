<template>
  <div class="pane-footer">
    <div class="pane-footer-left">
      <span v-if="selectedCount > 0" class="pane-footer-selected">
        {{ selectedCount }} selected ({{ formatBytes(selectedSize) }})
      </span>
      <span v-else>
        {{ totalDirectories }} dirs, {{ totalFiles }} files ({{
          formatBytes(totalFileSize)
        }})
      </span>
    </div>

    <!-- Free & Total Disk Space for current pane -->
    <div
      v-if="
        totalSpace !== undefined &&
        (availableSpace !== undefined || freeSpace !== undefined)
      "
      class="pane-footer-space"
      :title="getSpaceDetailedTooltip()"
    >
      <HardDrive
        :size="12"
        class="pane-footer-space-icon"
        title="Дисковий простір APFS"
      />
      <span>{{ formatFooterSpaceText() }}</span>
    </div>

    <div class="pane-footer-right">
      <span>{{ itemCount }} items</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { HardDrive } from "lucide-vue-next";
import { formatBytes } from "@/utils/formatters";

const props = defineProps<{
  selectedCount: number;
  selectedSize: number;
  totalDirectories: number;
  totalFiles: number;
  totalFileSize: number;
  itemCount: number;
  freeSpace?: number;
  availableSpace?: number;
  purgeableSpace?: number;
  totalSpace?: number;
}>();

function formatFooterSpaceText(): string {
  const avail = props.availableSpace ?? props.freeSpace;
  if (avail === undefined || props.totalSpace === undefined) return "";
  return `${formatBytes(avail)} вільно з ${formatBytes(props.totalSpace)}`;
}

function getSpaceDetailedTooltip(): string {
  const lines: string[] = ["💾 Інформація про дисковий простір macOS (APFS):"];
  const avail = props.availableSpace ?? props.freeSpace;
  if (avail !== undefined) {
    lines.push(`• Доступно для запису (як у Finder): ${formatBytes(avail)}`);
  }
  if (props.freeSpace !== undefined) {
    lines.push(`• Фізично вільні блоки SSD: ${formatBytes(props.freeSpace)}`);
  }
  if (props.purgeableSpace && props.purgeableSpace > 50 * 1024 * 1024) {
    lines.push(
      `• Очищувані системні кеші (Purgeable): ${formatBytes(props.purgeableSpace)}`,
    );
    lines.push(
      `💡 macOS APFS автоматично вивільнить ${formatBytes(props.purgeableSpace)} кешу при записі нових файлів`,
    );
  }
  if (props.totalSpace !== undefined) {
    lines.push(`• Загальний обсяг тома: ${formatBytes(props.totalSpace)}`);
  }
  return lines.join("\n");
}
</script>
