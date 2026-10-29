import { ref } from 'vue'
import type { DriveItem, PaneState } from '@/types'

export function useDrives(options: {
  showToast: (message: string, type?: 'success' | 'error' | 'shortcut') => void
  homeDir: { value: string }
  leftPane: PaneState
  rightPane: PaneState
  navigatePane: (paneKey: 'left' | 'right', path: string) => Promise<void>
}) {
  const { showToast, homeDir, leftPane, rightPane, navigatePane } = options
  const drives = ref<DriveItem[]>([])

  async function loadDrivesList(): Promise<void> {
    try {
      const drivesRes = await window.electronAPI.getDrives()
      if (drivesRes.success && drivesRes.data) {
        drives.value = drivesRes.data
      }
    } catch (err) {
      console.error('Failed to load drives:', err)
    }
  }

  async function ejectDrive(path: string): Promise<void> {
    try {
      const match = path.match(/^([A-Za-z]):/)
      const letter = match ? match[1].toUpperCase() : ''
      const driveRoot = letter ? `${letter}:\\` : path

      // Release active file locks: navigate away if currently open in either pane
      const home = homeDir.value || 'C:\\'
      let navigated = false
      if (leftPane.currentPath.toUpperCase().startsWith(driveRoot.toUpperCase())) {
        await navigatePane('left', home)
        navigated = true
      }
      if (rightPane.currentPath.toUpperCase().startsWith(driveRoot.toUpperCase())) {
        await navigatePane('right', home)
        navigated = true
      }

      for (const tab of leftPane.tabs) {
        if (tab.path.toUpperCase().startsWith(driveRoot.toUpperCase())) {
          tab.path = home
          tab.title = 'C:'
        }
      }
      for (const tab of rightPane.tabs) {
        if (tab.path.toUpperCase().startsWith(driveRoot.toUpperCase())) {
          tab.path = home
          tab.title = 'C:'
        }
      }

      if (navigated) {
        await new Promise((r) => setTimeout(r, 250))
      }

      const res = await window.electronAPI.ejectVolume(path)
      if (res.success) {
        drives.value = drives.value.filter((d) => !d.path.toUpperCase().startsWith(driveRoot.toUpperCase()))
        showToast('Носій безпечно вилучено', 'success')
        await loadDrivesList()
      } else {
        showToast(res.error || 'Помилка при вилученні носія', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Помилка вилучення носія', 'error')
    }
  }

  return {
    drives,
    loadDrivesList,
    ejectDrive,
  }
}
