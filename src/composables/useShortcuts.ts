import type { ComputedRef } from 'vue'
import type { DriveItem, FileItem, PaneState } from '@/types'

export function useShortcuts(options: {
  activePaneId: { value: 'left' | 'right' }
  activePaneState: ComputedRef<PaneState>
  drives: { value: DriveItem[] }
  modals: {
    contextMenu: { open: boolean }
    viewerModal: { open: boolean }
    editorModal: { open: boolean }
    operationModal: { open: boolean }
    searchModal: { open: boolean }
  }
  switchNextTab: (paneKey: 'left' | 'right', direction?: 1 | -1) => void
  swapPanes: () => void
  handleBottomAction: (type: string) => void
  getSelectedOrCursorPaths: () => string[]
  getActiveCursorItem: () => FileItem | null
  openCreateArchiveModal: (sources: string[]) => void
  openArchiveViewer: (path: string) => void
  openSearchModal: () => void
  canGoBack: (paneKey: 'left' | 'right') => boolean
  canGoForward: (paneKey: 'left' | 'right') => boolean
  goBack: (paneKey: 'left' | 'right') => void
  goForward: (paneKey: 'left' | 'right') => void
  goUp: (paneKey: 'left' | 'right') => void
  refreshAllPanes: () => Promise<void>
  toggleHiddenFiles: () => void
  newTab: (paneKey: 'left' | 'right') => void
  closeTab: (paneKey: 'left' | 'right', tabId: string) => void
  selectAllInActivePane: () => void
  invertSelectionInActivePane: () => void
  deselectAllInActivePane: () => void
  copySelectedToClipboard: (action?: 'copy' | 'cut') => Promise<void>
  pasteFromClipboard: () => Promise<void>
  toggleTheme: () => void
  showToast: (message: string, type?: 'success' | 'error' | 'shortcut') => void
  showShortcutToast: (shortcut: string, message: string) => void
}) {
  const {
    activePaneId,
    activePaneState,
    drives,
    modals,
    switchNextTab,
    swapPanes,
    handleBottomAction,
    getSelectedOrCursorPaths,
    getActiveCursorItem,
    openCreateArchiveModal,
    openArchiveViewer,
    openSearchModal,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    goUp,
    refreshAllPanes,
    toggleHiddenFiles,
    newTab,
    closeTab,
    selectAllInActivePane,
    invertSelectionInActivePane,
    deselectAllInActivePane,
    copySelectedToClipboard,
    pasteFromClipboard,
    toggleTheme,
    showToast,
    showShortcutToast,
  } = options

  function handleGlobalShortcuts(e: KeyboardEvent): void {
    if (modals.contextMenu.open) {
      if (e.key === 'Escape') {
        modals.contextMenu.open = false
        return
      }
    }

    if (modals.viewerModal.open || modals.editorModal.open || modals.operationModal.open || modals.searchModal.open) {
      if (e.key === 'Escape') {
        modals.viewerModal.open = false
        modals.editorModal.open = false
        modals.operationModal.open = false
        modals.searchModal.open = false
        showShortcutToast('Esc', 'Закрито активне модальне вікно')
      }
      return
    }

    const activeEl = document.activeElement as HTMLElement
    const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')

    // Switch tabs in active pane with Ctrl+Tab / Ctrl+Shift+Tab
    if (e.ctrlKey && e.key === 'Tab') {
      e.preventDefault()
      switchNextTab(activePaneId.value, e.shiftKey ? -1 : 1)
      return
    }

    // Switch Active Pane with Tab
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      activePaneId.value = activePaneId.value === 'left' ? 'right' : 'left'
      showShortcutToast('Tab', `Активна панель: ${activePaneId.value === 'left' ? 'Ліва' : 'Права'}`)
      return
    }

    // Swap Left & Right Panes with Ctrl+U
    if (
      (e.metaKey || e.ctrlKey) &&
      (e.code === 'KeyU' || e.key === 'u' || e.key === 'U' || e.key === 'г' || e.key === 'Г')
    ) {
      e.preventDefault()
      swapPanes()
      return
    }

    // Help / Shortcut Cheat Sheet (F1)
    if (e.key === 'F1') {
      e.preventDefault()
      showShortcutToast(
        'F1',
        'Довідка: Tab, F2-F10, Shift+F4..F8, Alt+F7, Ctrl+A/C/X/V/R/T/W/U, Alt+Enter/←/→/↑, Space, Ins, *'
      )
      return
    }

    // F2 or Shift+F6 - Rename
    if (e.key === 'F2' || (e.shiftKey && e.key === 'F6')) {
      e.preventDefault()
      showShortcutToast(e.key === 'F2' ? 'F2' : 'Shift + F6', 'Перейменування файлу або папки')
      handleBottomAction('rename')
      return
    }

    // F3 - View
    if (e.key === 'F3') {
      e.preventDefault()
      showShortcutToast('F3', 'Швидкий перегляд файлу')
      handleBottomAction('view')
      return
    }

    // F4 - Edit / Shift+F4 - New File
    if (e.key === 'F4') {
      if (e.shiftKey) {
        e.preventDefault()
        showShortcutToast('Shift + F4', 'Створення нового файлу')
        handleBottomAction('newfile')
      } else {
        e.preventDefault()
        showShortcutToast('F4', 'Редагування у вбудованому редакторі')
        handleBottomAction('edit')
      }
      return
    }

    // F5 - Copy (Shift+F5: Duplicate/Clone; Alt+F5: Create Archive ZIP/7Z/RAR)
    if (e.key === 'F5') {
      e.preventDefault()
      if (e.altKey) {
        const paths = getSelectedOrCursorPaths()
        if (paths.length > 0) {
          openCreateArchiveModal(paths)
        } else {
          showToast('Не вибрано файли для архівування', 'error')
        }
      } else if (e.shiftKey) {
        showShortcutToast('Shift + F5', 'Копіювання у поточну папку (Clone)')
        handleBottomAction('clone')
      } else {
        showShortcutToast('F5', 'Копіювання у цільову панель')
        handleBottomAction('copy')
      }
      return
    }

    // F6 - Move (Alt+F6: View / Unpack Archive)
    if (e.key === 'F6') {
      e.preventDefault()
      if (e.altKey) {
        const cursor = getActiveCursorItem()
        if (cursor && !cursor.isDirectory) {
          openArchiveViewer(cursor.path)
        } else {
          showToast('Виберіть архів для перегляду та розпакування', 'error')
        }
      } else {
        showShortcutToast('F6', 'Переміщення у цільову панель')
        handleBottomAction('move')
      }
      return
    }

    // F7 - New Folder / Alt+F7 Search / Shift+F7 New File
    if (e.key === 'F7') {
      if (e.altKey) {
        e.preventDefault()
        showShortcutToast('Alt + F7', 'Пошук файлів за назвою та текстом')
        openSearchModal()
      } else if (e.shiftKey) {
        e.preventDefault()
        showShortcutToast('Shift + F7', 'Створення нового файлу')
        handleBottomAction('newfile')
      } else {
        e.preventDefault()
        showShortcutToast('F7', 'Створення нової папки')
        handleBottomAction('mkdir')
      }
      return
    }

    // Permanent Delete (Shift+Delete or Shift+F8)
    if (e.shiftKey && (e.key === 'Delete' || e.key === 'F8')) {
      e.preventDefault()
      showShortcutToast('Shift + Del', 'Безповоротне видалення файлів (без Кошика)')
      handleBottomAction('permanent-delete')
      return
    }

    // F8 or Delete or Ctrl+Backspace - Move to Recycle Bin
    if (e.key === 'F8' || e.key === 'Delete' || ((e.metaKey || e.ctrlKey) && e.key === 'Backspace')) {
      if (isInputActive && e.key !== 'F8') return
      e.preventDefault()
      const badge = e.key === 'F8' ? 'F8' : e.key === 'Delete' ? 'Delete' : 'Ctrl + ⌫'
      showShortcutToast(badge, 'Переміщення у Кошик Windows')
      handleBottomAction('delete')
      return
    }

    // F9 - Terminal
    if (e.key === 'F9') {
      e.preventDefault()
      showShortcutToast('F9', 'Відкриття Термінала Windows у поточній папці')
      handleBottomAction('terminal')
      return
    }

    // F10 - Search
    if (e.key === 'F10') {
      e.preventDefault()
      showShortcutToast('F10', 'Пошук файлів за назвою та текстом')
      openSearchModal()
      return
    }

    // Alt+Enter - Show in Windows Explorer
    if (e.altKey && e.key === 'Enter') {
      e.preventDefault()
      const cursor = getActiveCursorItem()
      if (cursor) {
        window.electronAPI.showInFolder(cursor.path)
        showShortcutToast('Alt + Enter', `Показано у Провіднику: ${cursor.name}`)
      }
      return
    }

    // Alt+ArrowLeft - Directory history back
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault()
      if (canGoBack(activePaneId.value)) {
        goBack(activePaneId.value)
        showShortcutToast('Alt + ←', 'Назад по історії')
      }
      return
    }

    // Alt+ArrowRight - Directory history forward
    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault()
      if (canGoForward(activePaneId.value)) {
        goForward(activePaneId.value)
        showShortcutToast('Alt + →', 'Вперед по історії')
      }
      return
    }

    // Alt+ArrowUp - Parent directory
    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault()
      goUp(activePaneId.value)
      showShortcutToast('Alt + ↑', 'Батьківська директорія')
      return
    }

    // Ctrl+R - Refresh
    if (
      (e.metaKey || e.ctrlKey) &&
      (e.code === 'KeyR' || e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К')
    ) {
      e.preventDefault()
      showShortcutToast('Ctrl + R', 'Оновлення вмісту обох панелей')
      refreshAllPanes()
      return
    }

    // Ctrl+Shift+. or Ctrl+H - Toggle Hidden Files
    if (
      ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '.') ||
      (!isInputActive &&
        (e.metaKey || e.ctrlKey) &&
        (e.code === 'KeyH' || e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р'))
    ) {
      e.preventDefault()
      toggleHiddenFiles()
      return
    }

    // Ctrl+D - Quick drives info
    if (
      !isInputActive &&
      (e.metaKey || e.ctrlKey) &&
      (e.code === 'KeyD' || e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В')
    ) {
      e.preventDefault()
      const driveList = drives.value.map((d) => d.name).join(', ')
      showShortcutToast('Ctrl + D', `Диски: ${driveList || 'C:\\'}`)
      return
    }

    // Ctrl+T - New Tab
    if (
      (e.metaKey || e.ctrlKey) &&
      (e.code === 'KeyT' || e.key === 't' || e.key === 'T' || e.key === 'е' || e.key === 'Е')
    ) {
      e.preventDefault()
      newTab(activePaneId.value)
      showShortcutToast('Ctrl + T', 'Відкрито нову вкладку')
      return
    }

    // Ctrl+W - Close Tab
    if (
      (e.metaKey || e.ctrlKey) &&
      (e.code === 'KeyW' || e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц')
    ) {
      e.preventDefault()
      closeTab(activePaneId.value, activePaneState.value.activeTabId)
      showShortcutToast('Ctrl + W', 'Закрито поточну вкладку')
      return
    }

    // Ctrl+A - Select All (supports any layout via e.code)
    if (
      (e.metaKey || e.ctrlKey) &&
      (e.code === 'KeyA' || e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф')
    ) {
      if (isInputActive) return
      e.preventDefault()
      selectAllInActivePane()
      return
    }

    // Numeric * or * - Invert selection (TC standard)
    if (!isInputActive && (e.key === '*' || e.code === 'NumpadMultiply')) {
      e.preventDefault()
      invertSelectionInActivePane()
      return
    }

    // Numeric + or + - Select all
    if (!isInputActive && (e.key === '+' || e.code === 'NumpadAdd')) {
      e.preventDefault()
      selectAllInActivePane()
      return
    }

    // Numeric - or - Deselect all
    if (!isInputActive && (e.key === '-' || e.code === 'NumpadSubtract')) {
      e.preventDefault()
      deselectAllInActivePane()
      return
    }

    // Ctrl+C - Copy selected files to clipboard
    if (
      (e.metaKey || e.ctrlKey) &&
      (e.code === 'KeyC' || e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С')
    ) {
      if (isInputActive) {
        const input = activeEl as HTMLInputElement | HTMLTextAreaElement
        if (input.selectionStart !== input.selectionEnd) return
      }
      e.preventDefault()
      copySelectedToClipboard('copy')
      return
    }

    // Ctrl+X - Cut selected files to clipboard
    if (
      (e.metaKey || e.ctrlKey) &&
      (e.code === 'KeyX' || e.key === 'x' || e.key === 'X' || e.key === 'ч' || e.key === 'Ч')
    ) {
      if (isInputActive) {
        const input = activeEl as HTMLInputElement | HTMLTextAreaElement
        if (input.selectionStart !== input.selectionEnd) return
      }
      e.preventDefault()
      copySelectedToClipboard('cut')
      return
    }

    // Ctrl+V - Paste files from clipboard
    if (
      (e.metaKey || e.ctrlKey) &&
      (e.code === 'KeyV' || e.key === 'v' || e.key === 'V' || e.key === 'м' || e.key === 'М')
    ) {
      if (isInputActive) return
      e.preventDefault()
      pasteFromClipboard()
      return
    }

    // Ctrl+Shift+T - Toggle Light/Dark Theme
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault()
      toggleTheme()
      return
    }

    // Backspace - Parent directory
    if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey) {
      if (isInputActive) return
      e.preventDefault()
      goUp(activePaneId.value)
      showShortcutToast('Backspace', 'Перехід у батьківську директорію (..)')
      return
    }
  }

  return {
    handleGlobalShortcuts,
  }
}
