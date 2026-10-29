import { ipcMain, clipboard } from 'electron'
import fs from 'fs'

let appClipboard: { paths: string[]; action: 'copy' | 'cut' } = { paths: [], action: 'copy' }

export function registerClipboardIpc(): void {
  // Copy Files to Clipboard
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
      clipboard.writeText(validPaths.join('\r\n'))

      return { success: true, count: validPaths.length, action }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Read Files from Clipboard
  ipcMain.handle('clipboard:getFiles', async () => {
    try {
      if (appClipboard.paths.length > 0) {
        const existing = appClipboard.paths.filter((p) => fs.existsSync(p))
        if (existing.length > 0) {
          return { success: true, paths: existing, action: appClipboard.action }
        }
      }

      const text = clipboard.readText().trim()
      if (text) {
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
        const valid = lines
          .map((l) => {
            let p = l.replace(/^file:\/\/\/?/, '')
            try {
              p = decodeURI(p)
            } catch {}
            return p
          })
          .filter((l) => fs.existsSync(l))

        if (valid.length > 0) {
          return { success: true, paths: valid, action: 'copy' }
        }
      }

      return { success: true, paths: [], action: 'copy' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Clear Clipboard
  ipcMain.handle('clipboard:clear', async () => {
    appClipboard = { paths: [], action: 'copy' }
    return { success: true }
  })
}
