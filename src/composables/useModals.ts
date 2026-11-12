import { reactive, onMounted, onUnmounted, type ComputedRef } from 'vue'
import type { FileItem, PaneState, TransferProgressData } from '@/types'

export function useModals(options: {
  activePaneId: { value: 'left' | 'right' }
  activePaneState: ComputedRef<PaneState>
  oppositePaneState: ComputedRef<PaneState>
  navigatePane: (paneKey: 'left' | 'right', path: string) => Promise<void>
  refreshPane: (paneKey: 'left' | 'right') => void
  refreshAllPanes: () => Promise<void>
  getActiveCursorItem: () => FileItem | null
  getSelectedOrCursorPaths: () => string[]
  selectAllInActivePane: () => void
  canPaste: { value: boolean }
  checkCanPaste: () => Promise<boolean>
  copySelectedToClipboard: (action?: 'copy' | 'cut') => Promise<void>
  pasteFromClipboard: () => Promise<void>
  showToast: (message: string, type?: 'success' | 'error' | 'shortcut') => void
  showShortcutToast: (shortcut: string, message: string) => void
}) {
  const {
    activePaneId,
    activePaneState,
    oppositePaneState,
    navigatePane,
    refreshPane,
    refreshAllPanes,
    getActiveCursorItem,
    getSelectedOrCursorPaths,
    selectAllInActivePane,
    checkCanPaste,
    copySelectedToClipboard,
    pasteFromClipboard,
    showToast,
    showShortcutToast,
  } = options

  // Viewer Modal (F3)
  const viewerModal = reactive({
    open: false,
    filePath: '',
    fileName: '',
    fileSize: 0,
    mtime: 0,
    mode: 'text' as 'text' | 'image' | 'hex',
  })

  // Editor Modal (F4)
  const editorModal = reactive({
    open: false,
    filePath: '',
    fileName: '',
  })

  // Operation Modal (F2/F5/F6/F7/F8)
  const operationModal = reactive({
    open: false,
    opType: 'copy' as 'copy' | 'move' | 'mkdir' | 'delete' | 'rename' | 'newfile',
    sourceItems: [] as string[],
    targetDir: '',
    title: '',
  })

  // Search Modal (Alt+F7)
  const searchModal = reactive({
    open: false,
    initialDir: '',
  })

  // Large Files Modal (Disk Cleanup)
  const largeFilesModal = reactive({
    open: false,
    initialDir: '',
  })

  // Folder Size Modal (Space / Menu)
  const folderSizeModal = reactive({
    open: false,
    targetPath: '',
  })

  // Create Archive Modal (Alt+F5)
  const createArchiveModal = reactive({
    open: false,
    sources: [] as string[],
    currentDir: '',
  })

  // Archive Viewer Modal (Alt+F6 / Double-click)
  const archiveViewModal = reactive({
    open: false,
    archivePath: '',
    targetExtractDir: '',
    currentDir: '',
  })

  // Unlocker Modal
  const unlockerModal = reactive({
    open: false,
    targetPath: '',
    targetName: '',
    isDirectory: false,
    oppositePath: '',
  })

  function openUnlockerModal(item: FileItem) {
    if (!item) return
    unlockerModal.targetPath = item.path
    unlockerModal.targetName = item.name
    unlockerModal.isDirectory = item.isDirectory
    unlockerModal.oppositePath = oppositePaneState.value?.currentPath || ''
    unlockerModal.open = true
  }

  // Open With Modal (Windows apps & native dialog)
  const openWithModal = reactive<{
    open: boolean
    item: FileItem | null
  }>({
    open: false,
    item: null,
  })

  function openOpenWithModal(item: FileItem) {
    if (!item) return
    openWithModal.item = item
    openWithModal.open = true
  }

  async function handleOpenWithApp(appPath: string) {
    if (!openWithModal.item) return
    const filePath = openWithModal.item.path
    const fileName = openWithModal.item.name
    const appName = appPath
      ? appPath
          .split(/[/\\]/)
          .pop()
          ?.replace(/\.(exe|lnk|bat|cmd)$/i, '') || appPath
      : 'Windows'
    openWithModal.open = false
    try {
      const res = await window.electronAPI.openWith(filePath, appPath)
      if (res.success) {
        showToast(`Відкрито у ${appName}: ${fileName}`, 'success')
      } else {
        showToast(`Помилка відкриття: ${res.error}`, 'error')
      }
    } catch (err: any) {
      showToast(`Помилка: ${err.message}`, 'error')
    }
  }

  // Remote Connections Modal (SSH / SFTP / FTP)
  const remoteConnectionModal = reactive({
    open: false,
    minimized: false,
  })

  function openRemoteModal() {
    remoteConnectionModal.open = true
    remoteConnectionModal.minimized = false
  }

  function handleRemoteFileDownloaded(_targetDir: string) {
    refreshAllPanes()
    showToast("Файл успішно завантажено на комп'ютер", 'success')
  }

  // File Transfer Progress Modal (Real-time traffic, speed, ETA)
  const transferProgressModal = reactive({
    open: false,
    targetDir: '',
    data: {
      operationId: '',
      type: 'copy' as 'copy' | 'move',
      currentFile: '',
      currentDir: '',
      itemsDone: 0,
      totalItems: 0,
      bytesTransferred: 0,
      totalBytes: 0,
      bytesRemaining: 0,
      speedBytesPerSec: 0,
      etaSeconds: 0,
      elapsedSeconds: 0,
      percent: 0,
      isDone: false,
      canceled: false,
    } as TransferProgressData,
  })

  let unsubscribeTransferProgress: (() => void) | null = null

  onMounted(() => {
    if (window.electronAPI && typeof window.electronAPI.onTransferProgress === 'function') {
      unsubscribeTransferProgress = window.electronAPI.onTransferProgress((data) => {
        if (data.operationId === transferProgressModal.data.operationId) {
          Object.assign(transferProgressModal.data, data)
        }
      })
    }
  })

  onUnmounted(() => {
    if (unsubscribeTransferProgress) {
      unsubscribeTransferProgress()
      unsubscribeTransferProgress = null
    }
  })

  async function runTransferWithProgress(type: 'copy' | 'move', sources: string[], destinationDir: string) {
    const opId = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    transferProgressModal.targetDir = destinationDir
    transferProgressModal.data = {
      operationId: opId,
      type,
      currentFile: 'Підготовка...',
      currentDir: destinationDir,
      itemsDone: 0,
      totalItems: sources.length,
      bytesTransferred: 0,
      totalBytes: 0,
      bytesRemaining: 0,
      speedBytesPerSec: 0,
      etaSeconds: 0,
      elapsedSeconds: 0,
      percent: 0,
      isDone: false,
      canceled: false,
    }
    transferProgressModal.open = true

    const startTime = Date.now()
    const res =
      type === 'copy'
        ? await window.electronAPI.copyPaths(sources, destinationDir, opId)
        : await window.electronAPI.movePaths(sources, destinationDir, opId)

    const elapsed = Date.now() - startTime

    if (res.canceled) {
      transferProgressModal.data.canceled = true
      showToast('Операцію скасовано користувачем', 'error')
      setTimeout(() => {
        transferProgressModal.open = false
      }, 500)
      refreshAllPanes()
      return res
    }

    if (res.success) {
      transferProgressModal.data.isDone = true
      transferProgressModal.data.percent = 100
      const delay = elapsed < 400 ? 150 : 350
      setTimeout(() => {
        transferProgressModal.open = false
      }, delay)
      refreshAllPanes()
    } else {
      transferProgressModal.open = false
      showToast(res.error || `Помилка ${type === 'copy' ? 'копіювання' : 'переміщення'}`, 'error')
    }

    return res
  }

  async function cancelCurrentTransfer() {
    if (transferProgressModal.data.operationId && window.electronAPI.cancelTransfer) {
      await window.electronAPI.cancelTransfer(transferProgressModal.data.operationId)
      transferProgressModal.data.canceled = true
    }
  }

  // Right-Click Context Menu
  const contextMenu = reactive({
    open: false,
    x: 0,
    y: 0,
    item: null as FileItem | null,
    paneKey: 'left' as 'left' | 'right',
  })

  async function openContextMenu(payload: { x: number; y: number; item: FileItem | null; paneKey: 'left' | 'right' }) {
    activePaneId.value = payload.paneKey
    contextMenu.x = payload.x
    contextMenu.y = payload.y
    contextMenu.item = payload.item
    contextMenu.paneKey = payload.paneKey
    contextMenu.open = true
    await checkCanPaste()
  }

  function openViewer(item: FileItem) {
    viewerModal.filePath = item.path
    viewerModal.fileName = item.name
    viewerModal.fileSize = item.size
    viewerModal.open = true
  }

  function openEditor(item: FileItem) {
    editorModal.filePath = item.path
    editorModal.fileName = item.name
    editorModal.open = true
  }

  function openSearchModal() {
    searchModal.initialDir = activePaneState.value.currentPath
    searchModal.open = true
  }

  function openLargeFilesModal(targetPath?: string) {
    largeFilesModal.initialDir =
      typeof targetPath === 'string' && targetPath.trim() ? targetPath.trim() : activePaneState.value.currentPath
    largeFilesModal.open = true
  }

  function openCreateArchiveModal(sources: string[]) {
    createArchiveModal.sources = Array.isArray(sources) ? Array.from(sources).map((s) => String(s)) : []
    createArchiveModal.currentDir = activePaneState.value.currentPath
    createArchiveModal.open = true
  }

  function openArchiveViewer(archivePath: string) {
    archiveViewModal.archivePath = archivePath
    const parentDir = archivePath.replace(/[/\\][^/\\]+$/, '')
    archiveViewModal.currentDir = parentDir || activePaneState.value.currentPath
    archiveViewModal.targetExtractDir = oppositePaneState.value.currentPath || activePaneState.value.currentPath
    archiveViewModal.open = true
  }

  function openFolderSizeModal(targetPath: string) {
    folderSizeModal.targetPath = targetPath
    folderSizeModal.open = true
  }

  function jumpToSearchFile(filePath: string) {
    searchModal.open = false
    const lastSlashIdx = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'))
    const dir = lastSlashIdx !== -1 ? filePath.slice(0, lastSlashIdx) : filePath
    navigatePane(activePaneId.value, dir)
  }

  async function openActiveTerminal() {
    const currentDir = activePaneState.value.currentPath
    const res = await window.electronAPI.openInTerminal(currentDir)
    if (res.success) {
      const dirName = currentDir.split(/[/\\]/).filter(Boolean).pop() || currentDir
      showShortcutToast('F9', `Термінал відкрито у: ${dirName}`)
    } else {
      showToast(res.error || 'Не вдалося відкрити термінал', 'error')
    }
  }

  async function openFileNative(item: FileItem) {
    const ext = (item.extension || item.name.split('.').pop() || '').toLowerCase().replace(/^\./, '')
    if (['zip', '7z', 'rar', 'tar', 'gz', 'tgz', 'iso', 'bz2', 'xz'].includes(ext)) {
      openArchiveViewer(item.path)
      return
    }
    const res = await window.electronAPI.openPath(item.path)
    if (!res.success) {
      showToast(`Could not open file: ${res.error}`, 'error')
    }
  }

  function handleBottomAction(type: string) {
    const cursorItem = getActiveCursorItem()
    const selectedPaths = getSelectedOrCursorPaths()

    switch (type) {
      case 'rename':
        if (cursorItem) {
          operationModal.opType = 'rename'
          operationModal.sourceItems = [cursorItem.path]
          operationModal.targetDir = ''
          operationModal.open = true
        }
        break

      case 'view':
        if (cursorItem && !cursorItem.isDirectory) {
          viewerModal.filePath = cursorItem.path
          viewerModal.fileName = cursorItem.name
          viewerModal.fileSize = cursorItem.size
          viewerModal.open = true
        }
        break

      case 'edit':
        if (cursorItem && !cursorItem.isDirectory) {
          editorModal.filePath = cursorItem.path
          editorModal.fileName = cursorItem.name
          editorModal.open = true
        }
        break

      case 'copy':
        if (selectedPaths.length > 0) {
          operationModal.opType = 'copy'
          operationModal.sourceItems = selectedPaths
          operationModal.targetDir = oppositePaneState.value.currentPath
          operationModal.open = true
        }
        break

      case 'clone':
        if (cursorItem) {
          operationModal.opType = 'copy'
          operationModal.sourceItems = [cursorItem.path]
          operationModal.targetDir = activePaneState.value.currentPath
          operationModal.open = true
        }
        break

      case 'move':
        if (selectedPaths.length > 0) {
          operationModal.opType = 'move'
          operationModal.sourceItems = selectedPaths
          operationModal.targetDir = oppositePaneState.value.currentPath
          operationModal.open = true
        }
        break

      case 'mkdir':
        operationModal.opType = 'mkdir'
        operationModal.sourceItems = []
        operationModal.targetDir = activePaneState.value.currentPath
        operationModal.open = true
        break

      case 'newfile':
        operationModal.opType = 'newfile'
        operationModal.sourceItems = []
        operationModal.targetDir = activePaneState.value.currentPath
        operationModal.open = true
        break

      case 'delete':
        if (selectedPaths.length > 0) {
          operationModal.opType = 'delete'
          operationModal.sourceItems = selectedPaths
          operationModal.targetDir = ''
          operationModal.open = true
        }
        break

      case 'permanent-delete':
        if (selectedPaths.length > 0) {
          operationModal.opType = 'delete'
          operationModal.sourceItems = selectedPaths
          operationModal.targetDir = 'PERMANENT'
          operationModal.open = true
        }
        break

      case 'terminal':
        openActiveTerminal()
        break

      case 'search':
        openSearchModal()
        break
    }
  }

  async function handleContextMenuAction(action: string) {
    const item = contextMenu.item
    const paneKey = contextMenu.paneKey

    switch (action) {
      case 'open':
        if (item) {
          if (item.isDirectory) {
            navigatePane(paneKey, item.path)
          } else {
            openFileNative(item)
          }
        }
        break

      case 'view':
        if (item) {
          openViewer(item)
        } else {
          handleBottomAction('view')
        }
        break

      case 'edit':
        if (item && !item.isDirectory) {
          openEditor(item)
        } else {
          handleBottomAction('edit')
        }
        break

      case 'copy':
        handleBottomAction('copy')
        break

      case 'move':
        handleBottomAction('move')
        break

      case 'rename':
        handleBottomAction('rename')
        break

      case 'delete':
        handleBottomAction('delete')
        break

      case 'mkdir':
        handleBottomAction('mkdir')
        break

      case 'newfile':
        handleBottomAction('newfile')
        break

      case 'terminal':
        if (item && item.isDirectory) {
          window.electronAPI.openInTerminal(item.path)
        } else {
          openActiveTerminal()
        }
        break

      case 'refresh':
        refreshPane(paneKey)
        break

      case 'select-all':
        selectAllInActivePane()
        break

      case 'calculate-dir-size': {
        const p = item && item.isDirectory ? item.path : activePaneState.value.currentPath
        openFolderSizeModal(p)
        break
      }

      case 'large-files': {
        const p = item && item.isDirectory ? item.path : activePaneState.value.currentPath
        openLargeFilesModal(p)
        break
      }

      case 'zip': {
        const paths = getSelectedOrCursorPaths()
        const targets = paths.length > 0 ? paths : item ? [item.path] : []
        if (targets.length > 0) {
          openCreateArchiveModal(targets)
        } else {
          showToast('Не вибрано жодного файлу для архівування', 'error')
        }
        break
      }

      case 'unzip': {
        const targetItem = item || getActiveCursorItem()
        if (targetItem && !targetItem.isDirectory) {
          openArchiveViewer(targetItem.path)
        }
        break
      }

      case 'clipboard-copy':
        copySelectedToClipboard('copy')
        break

      case 'clipboard-cut':
        copySelectedToClipboard('cut')
        break

      case 'clipboard-paste':
        pasteFromClipboard()
        break

      case 'copy-path':
        if (item) {
          try {
            await navigator.clipboard.writeText(item.path)
            showShortcutToast('Ctrl + C', `Шлях скопійовано: ${item.name}`)
          } catch {
            window.electronAPI.copyFilesToClipboard([item.path], 'copy')
            showShortcutToast('Ctrl + C', `Шлях скопійовано: ${item.name}`)
          }
        }
        break

      case 'unlocker':
        if (item) {
          openUnlockerModal(item)
        }
        break

      case 'open-with':
        if (item) {
          openOpenWithModal(item)
        }
        break

      case 'show-in-folder':
        if (item) {
          window.electronAPI.showInFolder(item.path)
        }
        break
    }
  }

  async function onOperationConfirm(payload: { opType: string; target: string }) {
    operationModal.open = false
    const { opType, target } = payload
    const rawSources: string[] = JSON.parse(JSON.stringify(operationModal.sourceItems))

    try {
      if (opType === 'mkdir') {
        const cur = activePaneState.value.currentPath
        const sep = cur.endsWith('\\') || cur.endsWith('/') ? '' : cur.includes('\\') ? '\\' : '/'
        const fullPath = `${cur}${sep}${target}`
        const res = await window.electronAPI.createFolder(fullPath)
        if (res.success) {
          showToast(`Created directory "${target}"`, 'success')
          refreshPane(activePaneId.value)
        } else {
          showToast(`Error creating folder: ${res.error}`, 'error')
        }
      } else if (opType === 'newfile') {
        const cur = activePaneState.value.currentPath
        const sep = cur.endsWith('\\') || cur.endsWith('/') ? '' : cur.includes('\\') ? '\\' : '/'
        const fullPath = `${cur}${sep}${target}`
        const res = await window.electronAPI.createFile(fullPath)
        if (res.success) {
          showToast(`Created file "${target}"`, 'success')
          refreshPane(activePaneId.value)
        } else {
          showToast(`Error creating file: ${res.error}`, 'error')
        }
      } else if (opType === 'rename') {
        const oldPath = rawSources[0]
        const lastSlashIdx = Math.max(oldPath.lastIndexOf('\\'), oldPath.lastIndexOf('/'))
        const parentDir = lastSlashIdx !== -1 ? oldPath.slice(0, lastSlashIdx) : ''
        const sep = oldPath.includes('\\') ? '\\' : '/'

        const newPath = parentDir ? `${parentDir}${sep}${target}` : target
        const res = await window.electronAPI.renamePath(oldPath, newPath)
        if (res.success) {
          showToast(`Renamed to "${target}"`, 'success')
          refreshAllPanes()
        } else {
          showToast(`Rename error: ${res.error}`, 'error')
        }
      } else if (opType === 'copy') {
        const res = await runTransferWithProgress('copy', rawSources, target)
        if (res.success) {
          showToast(`Скопійовано ${rawSources.length} елемент(ів)`, 'success')
        }
      } else if (opType === 'move') {
        const res = await runTransferWithProgress('move', rawSources, target)
        if (res.success) {
          showToast(`Переміщено ${rawSources.length} елемент(ів)`, 'success')
        }
      } else if (opType === 'delete') {
        const isPermanent = operationModal.targetDir === 'PERMANENT'
        const res = await window.electronAPI.deletePaths(rawSources, !isPermanent)
        if (res.success) {
          showToast(
            isPermanent
              ? `Безповоротно видалено ${rawSources.length} елемент(ів)`
              : `Переміщено ${rawSources.length} елемент(ів) у Кошик`,
            'success'
          )
          refreshAllPanes()
        } else {
          showToast(`Delete error: ${res.error}`, 'error')
        }
      }
    } catch (err: any) {
      showToast(`Operation failed: ${err.message}`, 'error')
    }
  }

  function onArchiveCreated(targetPath: string) {
    const name = targetPath.split(/[/\\]/).filter(Boolean).pop() || targetPath
    showToast(`Архів створено: ${name}`, 'success')
    refreshAllPanes()
  }

  function onArchiveExtracted(targetPath?: string) {
    if (targetPath) {
      showToast(`Архів успішно розпаковано у: ${targetPath}`, 'success')
    } else {
      showToast('Архів успішно розархівовано', 'success')
    }
    refreshAllPanes()
  }

  function onFileSaved() {
    showToast('File saved successfully', 'success')
    refreshAllPanes()
  }

  function onUnlockerActionCompleted(payload: { action: string; targetPath: string }) {
    refreshAllPanes()
    const name = payload.targetPath.split(/[/\\]/).filter(Boolean).pop() || payload.targetPath
    if (payload.action === 'delete') {
      showToast(`Об'єкт "${name}" успішно розблоковано та видалено`, 'success')
    } else if (payload.action === 'move') {
      showToast(`Об'єкт "${name}" успішно розблоковано та переміщено`, 'success')
    } else if (payload.action === 'copy') {
      showToast(`Об'єкт "${name}" успішно скопійовано`, 'success')
    } else {
      showToast(`Процеси успішно завершено, об'єкт "${name}" розблоковано`, 'success')
    }
  }

  async function handleDragDrop(sourcePaths: string[], targetDir: string, isMove: boolean = false) {
    try {
      if (!sourcePaths || sourcePaths.length === 0) return
      const rawPaths: string[] = JSON.parse(JSON.stringify(sourcePaths))
      const targetName = targetDir.split(/[/\\]/).filter(Boolean).pop() || targetDir

      const firstParent = rawPaths[0].replace(/[/\\][^/\\]+$/, '')
      const normParent = firstParent.toLowerCase().replace(/[/\\]+$/, '')
      const normTarget = targetDir.toLowerCase().replace(/[/\\]+$/, '')
      if (normParent === normTarget) {
        showToast('Цільова папка збігається з вихідною', 'error')
        return
      }

      const res = await runTransferWithProgress(isMove ? 'move' : 'copy', rawPaths, targetDir)

      if (res.success) {
        const actionWord = isMove ? 'Переміщено' : 'Скопійовано'
        const itemsWord = rawPaths.length === 1 ? 'елемент' : rawPaths.length < 5 ? 'елементи' : 'елементів'
        showToast(`${actionWord} ${rawPaths.length} ${itemsWord} у "${targetName}"`, 'success')
      }
    } catch (err: any) {
      showToast(`Помилка drag & drop: ${err.message}`, 'error')
    }
  }

  return {
    viewerModal,
    editorModal,
    operationModal,
    searchModal,
    largeFilesModal,
    folderSizeModal,
    createArchiveModal,
    archiveViewModal,
    unlockerModal,
    openWithModal,
    remoteConnectionModal,
    transferProgressModal,
    contextMenu,
    openContextMenu,
    openViewer,
    openEditor,
    openSearchModal,
    openLargeFilesModal,
    openCreateArchiveModal,
    openArchiveViewer,
    openFolderSizeModal,
    openUnlockerModal,
    openOpenWithModal,
    openRemoteModal,
    handleOpenWithApp,
    handleRemoteFileDownloaded,
    jumpToSearchFile,
    openActiveTerminal,
    openFileNative,
    handleBottomAction,
    handleContextMenuAction,
    onOperationConfirm,
    onArchiveCreated,
    onArchiveExtracted,
    onFileSaved,
    onUnlockerActionCompleted,
    cancelCurrentTransfer,
    runTransferWithProgress,
    handleDragDrop,
  }
}
