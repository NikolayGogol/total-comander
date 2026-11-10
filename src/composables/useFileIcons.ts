import { reactive } from "vue";
import type { Component } from "vue";
import type { FileItem } from "@/types";
import { getFileCategory } from "@/utils/formatters";
import {
  Folder,
  File,
  Image,
  Film,
  Music,
  FileText,
  Archive,
  AppWindow,
} from "lucide-vue-next";

// Extensions with embedded unique icons per file
const UNIQUE_EXTENSIONS = new Set([
  "app",
  "dmg",
  "pkg",
  "iconset",
  "prefPane",
  "kext",
  "plugin",
]);

// Shared reactive cache across both panes and tabs
const iconCache = reactive<Record<string, string>>({});

// Track in-flight requests to avoid duplicate parallel calls
const inFlightPaths = new Set<string>();

export function useFileIcons() {
  function getNativeIcon(item: FileItem): string | undefined {
    if (!item) return undefined;
    const isApp =
      item.isApp ||
      item.name?.endsWith(".app") ||
      item.extension === "app" ||
      (item.isAlias && item.aliasTarget?.endsWith(".app"));
    if (item.isDirectory && !isApp && !item.isAlias) return undefined;

    // 1. Direct appIcon from readDir
    if (item.appIcon) {
      return item.appIcon;
    }

    // 2. Direct path check (for apps, packages, dmg, aliases)
    if (iconCache[item.path]) {
      return iconCache[item.path];
    }

    // 3. Check target path for aliases
    if (item.aliasTarget && iconCache[item.aliasTarget]) {
      return iconCache[item.aliasTarget];
    }

    // 4. Extension cache check for non-unique extensions
    const ext = (item.extension || "").toLowerCase();
    if (ext && !UNIQUE_EXTENSIONS.has(ext)) {
      const extKey = `ext:${ext}`;
      if (iconCache[extKey]) {
        return iconCache[extKey];
      }
    }

    return undefined;
  }

  async function fetchIconsForItems(items: FileItem[]): Promise<void> {
    if (!window.electronAPI || !Array.isArray(items) || items.length === 0) {
      return;
    }

    const toRequest: Array<{
      path: string;
      name: string;
      isDirectory: boolean;
      extension: string;
      isApp?: boolean;
      isAlias?: boolean;
      aliasTarget?: string;
    }> = [];

    for (const item of items) {
      if (!item.path) continue;
      const isApp =
        item.isApp ||
        item.name?.endsWith(".app") ||
        item.extension === "app" ||
        (item.isAlias && item.aliasTarget?.endsWith(".app"));
      if (item.isDirectory && !isApp && !item.isAlias) continue;

      if (iconCache[item.path] || inFlightPaths.has(item.path)) {
        continue;
      }

      const ext = (item.extension || "").toLowerCase();
      const isUnique =
        isApp || item.isAlias || !ext || UNIQUE_EXTENSIONS.has(ext);
      if (!isUnique) {
        const extKey = `ext:${ext}`;
        if (iconCache[extKey]) {
          continue;
        }
        const alreadyQueued = toRequest.some((r) => r.extension === ext);
        if (alreadyQueued) {
          continue;
        }
      }

      inFlightPaths.add(item.path);
      toRequest.push({
        path: item.path,
        name: item.name,
        isDirectory: false,
        extension: ext,
        isApp,
        isAlias: item.isAlias,
        aliasTarget: item.aliasTarget,
      });
    }

    if (toRequest.length === 0) return;

    try {
      const icons = await window.electronAPI.getFileIcons(toRequest);
      if (icons && typeof icons === "object") {
        for (const [p, dataUrl] of Object.entries(icons)) {
          if (dataUrl) {
            iconCache[p] = dataUrl;
            const matchedItem = items.find((i) => i.path === p);
            if (matchedItem && !matchedItem.isDirectory) {
              const ext = (matchedItem.extension || "").toLowerCase();
              if (ext && !UNIQUE_EXTENSIONS.has(ext)) {
                iconCache[`ext:${ext}`] = dataUrl;
              }
            }
          }
        }
      }
    } catch {
      // Retains fallback vector icons
    } finally {
      for (const req of toRequest) {
        inFlightPaths.delete(req.path);
      }
    }
  }

  function getIconComponent(item: FileItem): Component {
    if (item.isApp) return AppWindow;
    if (item.isDirectory) return Folder;
    const cat = getFileCategory(
      item.extension || item.name,
      item.isDirectory,
    ).category;
    switch (cat) {
      case "code":
      case "app":
        return AppWindow;
      case "image":
        return Image;
      case "video":
        return Film;
      case "audio":
        return Music;
      case "doc":
        return FileText;
      case "archive":
        return Archive;
      default:
        return File;
    }
  }

  function getCategory(item: FileItem): string {
    return getFileCategory(item.extension || item.name, item.isDirectory)
      .category;
  }

  function getIconModifier(item: FileItem): string {
    if (item.isApp) return "icon-code";
    return getFileCategory(item.extension || item.name, item.isDirectory)
      .classModifier;
  }

  return {
    iconCache,
    getNativeIcon,
    fetchIconsForItems,
    getIconComponent,
    getIconModifier,
    getCategory,
  };
}
