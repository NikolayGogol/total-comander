import { ipcMain, shell } from 'electron'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

export interface VirtualDiskInfo {
  name: string
  mountPoint: string
  devEntry: string
  imagePath: string
  imageType: string
  totalSpace: number
  freeSpace: number
  usedSpace: number
  sourceExists: boolean
  sourceSize: number
}

/**
 * Retrieves all currently mounted macOS disk images (DMG, ISO, sparse images).
 */
export function getVirtualDisks(): Promise<VirtualDiskInfo[]> {
  return new Promise((resolve) => {
    exec('hdiutil info -plist', (err, stdout) => {
      if (err || !stdout) return resolve([])

      const results: VirtualDiskInfo[] = []
      const blocks = stdout.split(/<key>autodiskmount<\/key>/i)

      for (const block of blocks.slice(1)) {
        const imgMatch = block.match(/<key>image-path<\/key>\s*<string>([^<]+)<\/string>/i)
        const imagePath = imgMatch ? imgMatch[1].trim() : ''

        const mountMatch = block.match(/<key>mount-point<\/key>\s*<string>([^<]+)<\/string>/i)
        const mountPoint = mountMatch ? mountMatch[1].trim() : ''

        const devMatch = block.match(/<key>dev-entry<\/key>\s*<string>([^<]+)<\/string>/i)
        const devEntry = devMatch ? devMatch[1].trim() : ''

        const typeMatch = block.match(/<key>image-type<\/key>\s*<string>([^<]+)<\/string>/i)
        const imageType = typeMatch ? typeMatch[1].trim() : 'Disk Image'

        if (mountPoint && mountPoint.startsWith('/Volumes/')) {
          const name = path.basename(mountPoint)
          let totalSpace = 0
          let freeSpace = 0
          try {
            const stats = fs.statfsSync(mountPoint)
            const bsize = stats.bsize
            totalSpace = stats.blocks * bsize
            freeSpace = stats.bfree * bsize
          } catch {}

          let sourceExists = false
          let sourceSize = 0
          if (imagePath && fs.existsSync(imagePath)) {
            sourceExists = true
            try {
              sourceSize = fs.statSync(imagePath).size
            } catch {}
          }

          results.push({
            name,
            mountPoint,
            devEntry,
            imagePath,
            imageType,
            totalSpace,
            freeSpace,
            usedSpace: totalSpace > freeSpace ? totalSpace - freeSpace : 0,
            sourceExists,
            sourceSize,
          })
        }
      }
      resolve(results)
    })
  })
}

/**
 * Safely unmounts and ejects a virtual disk device.
 */
export function ejectVirtualDisk(target: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    exec(`diskutil eject "${target}"`, (err, _stdout, stderr) => {
      if (!err) return resolve({ success: true })
      exec(`hdiutil detach "${target}" -force`, (err2, _stdout2, stderr2) => {
        if (!err2) return resolve({ success: true })
        exec(`diskutil unmountDisk force "${target}"`, (err3) => {
          if (!err3) return resolve({ success: true })
          resolve({ success: false, error: stderr || stderr2 || err.message })
        })
      })
    })
  })
}

/**
 * Unmounts all active virtual disks at once.
 */
export async function ejectAllVirtualDisks(): Promise<{ success: boolean; count: number }> {
  const disks = await getVirtualDisks()
  let count = 0
  for (const d of disks) {
    const res = await ejectVirtualDisk(d.mountPoint || d.devEntry)
    if (res.success) count++
  }
  return { success: true, count }
}

function safeHandle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener)
}

export function registerVirtualDisksIpc(): void {
  safeHandle('fs:getVirtualDisks', async () => {
    try {
      const disks = await getVirtualDisks()
      return { success: true, data: disks }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to list virtual disks' }
    }
  })

  safeHandle('fs:ejectVirtualDisk', async (_, target: string) => {
    try {
      if (!target) return { success: false, error: 'Target is required' }
      const res = await ejectVirtualDisk(target)
      return res
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to eject virtual disk' }
    }
  })

  safeHandle('fs:ejectAllVirtualDisks', async () => {
    try {
      const res = await ejectAllVirtualDisks()
      return res
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to eject all virtual disks' }
    }
  })

  safeHandle('fs:deleteVirtualDiskSource', async (_, payload: { imagePath: string; mountPoint?: string }) => {
    try {
      if (payload.mountPoint) {
        await ejectVirtualDisk(payload.mountPoint)
      }
      if (payload.imagePath && fs.existsSync(payload.imagePath)) {
        await shell.trashItem(payload.imagePath)
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete disk image source' }
    }
  })
}
