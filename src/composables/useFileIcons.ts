import { reactive } from 'vue'
import type { FileItem } from '@/types'

// Extensions with embedded unique icons per file
const UNIQUE_EXTENSIONS = new Set(['exe', 'lnk', 'ico', 'cur', 'url', 'scr', 'cpl', 'dll'])

// Shared reactive cache across both panes and tabs
const iconCache = reactive<Record<string, string>>({})

// Track in-flight requests to avoid duplicate parallel calls
const inFlightPaths = new Set<string>()

export function useFileIcons() {
  function getNativeIcon(item: FileItem): string | undefined {
    // Folders always use the theme vector Folder icon
    if (!item || item.isDirectory) return undefined

    // 1. Direct path check (for executables, shortcuts, icons)
    if (iconCache[item.path]) {
      return iconCache[item.path]
    }

    // 2. Extension cache check for non-unique extensions
    const ext = (item.extension || '').toLowerCase()
    if (ext && !UNIQUE_EXTENSIONS.has(ext)) {
      const extKey = `ext:${ext}`
      if (iconCache[extKey]) {
        return iconCache[extKey]
      }
    }

    return undefined
  }

  async function fetchIconsForItems(items: FileItem[]): Promise<void> {
    if (!window.electronAPI || !Array.isArray(items) || items.length === 0) {
      return
    }

    const toRequest: Array<{
      path: string
      name: string
      isDirectory: boolean
      extension: string
    }> = []

    for (const item of items) {
      // Folders keep the classic folder icon
      if (!item.path || item.isDirectory) continue

      // Skip if already in memory cache or in-flight
      if (iconCache[item.path] || inFlightPaths.has(item.path)) {
        continue
      }

      const ext = (item.extension || '').toLowerCase()
      const isUnique = !ext || UNIQUE_EXTENSIONS.has(ext)
      if (!isUnique) {
        const extKey = `ext:${ext}`
        if (iconCache[extKey]) {
          continue
        }
        const alreadyQueued = toRequest.some((r) => r.extension === ext)
        if (alreadyQueued) {
          continue
        }
      }

      inFlightPaths.add(item.path)
      toRequest.push({
        path: item.path,
        name: item.name,
        isDirectory: false,
        extension: ext,
      })
    }

    if (toRequest.length === 0) return

    try {
      const icons = await window.electronAPI.getFileIcons(toRequest)
      if (icons && typeof icons === 'object') {
        for (const [p, dataUrl] of Object.entries(icons)) {
          if (dataUrl) {
            iconCache[p] = dataUrl
            const matchedItem = items.find((i) => i.path === p)
            if (matchedItem && !matchedItem.isDirectory) {
              const ext = (matchedItem.extension || '').toLowerCase()
              if (ext && !UNIQUE_EXTENSIONS.has(ext)) {
                iconCache[`ext:${ext}`] = dataUrl
              }
            }
          }
        }
      }
    } catch {
      // Non-critical: table retains fallback Lucide icons
    } finally {
      for (const req of toRequest) {
        inFlightPaths.delete(req.path)
      }
    }
  }

  return {
    iconCache,
    getNativeIcon,
    fetchIconsForItems,
  }
}
