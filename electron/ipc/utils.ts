import { ipcMain } from 'electron'
import os from 'os'

export function setupUtilsIpc() {
  // System Info
  ipcMain.handle('app:getSystemInfo', async () => {
    return {
      homeDir: os.homedir(),
      tmpDir: os.tmpdir(),
      platform: 'darwin',
      username: os.userInfo().username,
    }
  })

  // Build Info
  ipcMain.handle('app:getBuildInfo', async () => {
    return {
      version: '1.0.0',
      buildNumber: '2026.10.30.1',
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
    }
  })
}

