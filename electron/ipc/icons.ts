import { app, ipcMain, shell } from 'electron'
import fsPromises from 'fs/promises'

// Extensions that have unique embedded icons per file
const UNIQUE_ICON_EXTENSIONS = new Set(['exe', 'lnk', 'ico', 'cur', 'url', 'scr', 'cpl', 'dll'])

// In-memory cache for shared file extension icons
const extensionIconCache = new Map<string, string>()

// Cache for specific files (with size limit)
const pathIconCache = new Map<string, string>()
const MAX_PATH_CACHE = 2000

function setPathCache(key: string, val: string): void {
  if (pathIconCache.size >= MAX_PATH_CACHE) {
    const firstKey = pathIconCache.keys().next().value
    if (firstKey) pathIconCache.delete(firstKey)
  }
  pathIconCache.set(key, val)
}

export function registerIconsIpc(): void {
  // Get single file icon
  ipcMain.handle('fs:getFileIcon', async (_, filePath: string) => {
    try {
      if (!filePath) return null
      const cached = pathIconCache.get(filePath)
      if (cached) return cached

      const icon = await app.getFileIcon(filePath, { size: 'small' })
      if (icon) {
        const dataUrl = icon.toDataURL()
        setPathCache(filePath, dataUrl)
        return dataUrl
      }
    } catch {}
    return null
  })

  // Get batch of icons for items in a directory
  ipcMain.handle(
    'fs:getFileIcons',
    async (_, items: Array<{ path: string; name?: string; isDirectory: boolean; extension: string }>) => {
      const result: Record<string, string> = {}
      if (!Array.isArray(items) || items.length === 0) {
        return result
      }

      // Distinct requests to process in parallel
      const toFetch: Array<{
        key: string
        itemPath: string
        isExtCache: boolean
        extKey?: string
      }> = []

      for (const it of items) {
        if (!it.path || it.isDirectory) continue

        const ext = (it.extension || '').toLowerCase()
        const isUnique = !ext || UNIQUE_ICON_EXTENSIONS.has(ext)

        if (isUnique) {
          const cached = pathIconCache.get(it.path)
          if (cached) {
            result[it.path] = cached
          } else {
            toFetch.push({
              key: it.path,
              itemPath: it.path,
              isExtCache: false,
            })
          }
        } else {
          const extKey = `ext:${ext}`
          const cached = extensionIconCache.get(extKey)
          if (cached) {
            result[it.path] = cached
          } else {
            // Avoid queuing multiple requests for the same extension in this batch
            const alreadyQueued = toFetch.find((q) => q.extKey === extKey)
            if (!alreadyQueued) {
              toFetch.push({
                key: it.path,
                itemPath: it.path,
                isExtCache: true,
                extKey,
              })
            }
          }
        }
      }

      // Process pending icons concurrently
      if (toFetch.length > 0) {
        await Promise.all(
          toFetch.map(async (task) => {
            try {
              const icon = await app.getFileIcon(task.itemPath, { size: 'small' })
              if (icon) {
                const dataUrl = icon.toDataURL()
                result[task.key] = dataUrl

                if (task.isExtCache && task.extKey) {
                  extensionIconCache.set(task.extKey, dataUrl)
                  // Also set result for any other item in this batch with same extension
                  for (const it of items) {
                    if (!it.isDirectory && (it.extension || '').toLowerCase() === task.extKey.slice(4)) {
                      result[it.path] = dataUrl
                    }
                  }
                } else {
                  setPathCache(task.itemPath, dataUrl)
                }
              }
            } catch {}
          })
        )
      }

      return result
    }
  )

  // Resolve Windows Shortcut (.lnk)
  ipcMain.handle('fs:resolveShortcut', async (_, shortcutPath: string) => {
    try {
      if (!shortcutPath || !shortcutPath.toLowerCase().endsWith('.lnk')) {
        return null
      }
      const link = shell.readShortcutLink(shortcutPath)
      if (link && link.target) {
        let isDir = false
        try {
          const stats = await fsPromises.stat(link.target)
          isDir = stats.isDirectory()
        } catch {}

        return {
          target: link.target,
          arguments: link.args,
          isDirectory: isDir,
          description: link.description,
          iconPath: link.icon,
        }
      }
    } catch {}
    return null
  })
}
