import { ipcMain, clipboard } from 'electron'
import fs from 'fs'

let appClipboard: { paths: string[]; action: 'copy' | 'cut' } = { paths: [], action: 'copy' }

export function setupClipboardIpc() {
  // Copy Files to System Clipboard & In-App Store
  ipcMain.handle('clipboard:copyFiles', async (_, paths: string[], action: 'copy' | 'cut' = 'copy') => {
    try {
      if (!paths || paths.length === 0) {
        return { success: false, error: 'Не вибрано файлів' }
      }

      const validPaths = paths.filter((p) => fs.existsSync(p))
      if (validPaths.length === 0) {
        return { success: false, error: 'Файли не знайдено на диску' }
      }

      appClipboard = { paths: validPaths, action }

      // 1. Text format (for pasting in terminal, notes, editors, web)
      clipboard.writeText(validPaths.join('\n'))

      // 2. Native macOS NSFilenamesPboardType (standard Apple pasteboard for files)
      const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
${validPaths.map((p) => `  <string>${p}</string>`).join('\n')}
</array>
</plist>`
      clipboard.writeBuffer('NSFilenamesPboardType', Buffer.from(plist, 'utf-8'))

      return { success: true, count: validPaths.length, action }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Read Files from Clipboard
  ipcMain.handle('clipboard:getFiles', async () => {
    try {
      // 1. Check in-app clipboard first
      if (appClipboard.paths.length > 0) {
        const existing = appClipboard.paths.filter((p) => fs.existsSync(p))
        if (existing.length > 0) {
          return { success: true, paths: existing, action: appClipboard.action }
        }
      }

      // 2. Check native NSFilenamesPboardType
      const buffer = clipboard.readBuffer('NSFilenamesPboardType')
      if (buffer && buffer.length > 0) {
        const xml = buffer.toString('utf-8')
        const matches = xml.match(/<string>(.*?)<\/string>/g)
        if (matches) {
          const paths = matches
            .map((m) => m.replace(/<\/?string>/g, '').trim())
            .filter((p) => fs.existsSync(p))
          if (paths.length > 0) {
            return { success: true, paths, action: 'copy' }
          }
        }
      }

      // 3. Fallback: check text clipboard lines
      const text = clipboard.readText().trim()
      if (text) {
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
        const valid = lines
          .map((l) => l.replace(/^file:\/\//, ''))
          .filter((l) => l.startsWith('/') && fs.existsSync(l))
        if (valid.length > 0) {
          return { success: true, paths: valid, action: 'copy' }
        }
      }

      return { success: true, paths: [], action: 'copy' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Clear In-App Clipboard
  ipcMain.handle('clipboard:clear', async () => {
    appClipboard = { paths: [], action: 'copy' }
    return { success: true }
  })
}

