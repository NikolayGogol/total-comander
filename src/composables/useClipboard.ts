import { ref } from 'vue'

export function useClipboard(options: {
  getSelectedOrCursorPaths: () => string[]
  getActivePaneTargetDir: () => string
  refreshAllPanes: () => Promise<void>
  showToast: (message: string, type?: 'success' | 'error' | 'shortcut') => void
  showShortcutToast: (shortcut: string, message: string) => void
  runTransferWithProgress?: (
    type: 'copy' | 'move',
    sources: string[],
    destinationDir: string
  ) => Promise<{ success: boolean; canceled?: boolean; error?: string }>
}) {
  const { getSelectedOrCursorPaths, getActivePaneTargetDir, refreshAllPanes, showToast, showShortcutToast } = options

  const canPaste = ref(false)
  let lastCopyTime = 0

  async function checkCanPaste(): Promise<boolean> {
    try {
      const res = await window.electronAPI.getClipboardFiles()
      const available = Boolean(res.success && res.paths && res.paths.length > 0)
      canPaste.value = available
      return available
    } catch {
      canPaste.value = false
      return false
    }
  }

  async function copySelectedToClipboard(action: 'copy' | 'cut' = 'copy'): Promise<void> {
    const now = Date.now()
    if (now - lastCopyTime < 150) return
    lastCopyTime = now

    const paths = getSelectedOrCursorPaths()
    if (paths.length === 0) {
      showToast('Не вибрано жодного файлу для копіювання', 'error')
      return
    }

    try {
      const res = await window.electronAPI.copyFilesToClipboard(paths, action)
      if (res.success) {
        canPaste.value = true
        const count = paths.length
        const badge = action === 'copy' ? 'Ctrl + C' : 'Ctrl + X'
        if (count === 1) {
          const fileName = paths[0].split(/[/\\]/).filter(Boolean).pop() || paths[0]
          const text =
            action === 'copy' ? `Файл скопійовано у буфер: ${fileName}` : `Файл вирізано у буфер: ${fileName}`
          showShortcutToast(badge, text)
        } else {
          const text = action === 'copy' ? `Скопійовано ${count} файлів у буфер` : `Вирізано ${count} файлів у буфер`
          showShortcutToast(badge, text)
        }
      } else {
        showToast(res.error || 'Помилка копіювання у буфер', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Помилка копіювання у буфер', 'error')
    }
  }

  async function pasteFromClipboard(): Promise<void> {
    try {
      const res = await window.electronAPI.getClipboardFiles()
      if (!res.success || !res.paths || res.paths.length === 0) {
        showToast('Буфер обміну не містить файлів для вставки', 'error')
        return
      }

      const targetDir = getActivePaneTargetDir()
      const count = res.paths.length
      const action = res.action || 'copy'

      let opRes
      if (options.runTransferWithProgress) {
        opRes = await options.runTransferWithProgress(action === 'cut' ? 'move' : 'copy', res.paths, targetDir)
      } else if (action === 'cut') {
        opRes = await window.electronAPI.movePaths(res.paths, targetDir)
      } else {
        opRes = await window.electronAPI.copyPaths(res.paths, targetDir)
      }

      if (action === 'cut' && opRes.success) {
        await window.electronAPI.clearClipboard()
        canPaste.value = false
      }

      if (opRes.success) {
        await refreshAllPanes()
        const dirName = targetDir.split(/[/\\]/).filter(Boolean).pop() || targetDir
        const verb = action === 'cut' ? 'Переміщено' : 'Вставлено'
        const itemsWord = count === 1 ? 'елемент' : count < 5 ? 'елементи' : 'елементів'
        showShortcutToast('Ctrl + V', `${verb} ${count} ${itemsWord} у ${dirName}`)
      } else {
        showToast(opRes.error || 'Помилка вставки файлів', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Помилка вставки файлів', 'error')
    }
  }

  return {
    canPaste,
    checkCanPaste,
    copySelectedToClipboard,
    pasteFromClipboard,
  }
}
