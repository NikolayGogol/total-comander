import { ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { exec } from 'child_process'

export function setupArchiveIpc() {
  // Create ZIP Archive (Total Commander Alt+F5)
  ipcMain.handle('fs:createArchive', async (_, sources: string[], targetZipPath: string) => {
    try {
      if (!sources || sources.length === 0) {
        return { success: false, error: 'Не вибрано файлів для архівації' }
      }
      let dest = targetZipPath.trim()
      if (!dest.toLowerCase().endsWith('.zip')) {
        dest += '.zip'
      }

      const escapedDest = dest.replace(/"/g, '\\"')
      const escapedSources = sources.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(' ')

      await new Promise<void>((resolve, reject) => {
        // macOS ditto or zip utility
        const cmd = sources.length === 1
          ? `/usr/bin/ditto -c -k --sequesterRsrc --keepParent ${escapedSources} "${escapedDest}"`
          : `/usr/bin/zip -r -q "${escapedDest}" ${escapedSources}`

        exec(cmd, { maxBuffer: 20 * 1024 * 1024 }, (err, _stdout, stderr) => {
          if (err) {
            exec(`/usr/bin/ditto -c -k --sequesterRsrc ${escapedSources} "${escapedDest}"`, (err2) => {
              if (err2) reject(new Error(stderr || err.message))
              else resolve()
            })
          } else {
            resolve()
          }
        })
      })

      return { success: true, targetPath: dest }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // List Archive Entries (Total Commander ArchiveViewModal)
  ipcMain.handle('fs:listArchive', async (_, archivePath: string) => {
    try {
      if (!fs.existsSync(archivePath)) {
        return { success: false, error: 'Архів не знайдено' }
      }
      const ext = path.extname(archivePath).toLowerCase()
      const entries: Array<{ name: string; size: number; isDirectory: boolean }> = []

      if (ext === '.zip') {
        const stdout = await new Promise<string>((resolve, reject) => {
          exec(`/usr/bin/unzip -l "${archivePath.replace(/"/g, '\\"')}"`, { maxBuffer: 10 * 1024 * 1024 }, (err, out) => {
            if (err) reject(err)
            else resolve(out)
          })
        })

        const lines = stdout.split('\n')
        for (const line of lines) {
          const match = line.match(/^\s*(\d+)\s+[\d-]+\s+[\d:]+\s+(.+)$/)
          if (match) {
            const sz = parseInt(match[1], 10)
            const name = match[2].trim()
            if (name && !name.startsWith('Archive:') && !name.startsWith('---')) {
              entries.push({
                name,
                size: sz,
                isDirectory: name.endsWith('/'),
              })
            }
          }
        }
      } else {
        const stdout = await new Promise<string>((resolve, reject) => {
          exec(`/usr/bin/tar -tvf "${archivePath.replace(/"/g, '\\"')}"`, { maxBuffer: 10 * 1024 * 1024 }, (err, out) => {
            if (err) reject(err)
            else resolve(out)
          })
        })

        const lines = stdout.split('\n')
        for (const line of lines) {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 6) {
            const sz = parseInt(parts[4], 10) || 0
            const name = parts.slice(8).join(' ') || parts[parts.length - 1]
            if (name) {
              entries.push({
                name,
                size: sz,
                isDirectory: parts[0]?.startsWith('d') || name.endsWith('/'),
              })
            }
          }
        }
      }

      return { success: true, entries }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to list archive' }
    }
  })

  // Extract Archive (Total Commander Alt+F6)
  ipcMain.handle('fs:extractArchive', async (_, archivePath: string, destinationDir: string, selectedFiles?: string[]) => {
    try {
      if (!fs.existsSync(archivePath)) {
        return { success: false, error: 'Архів не знайдено' }
      }
      await fsPromises.mkdir(destinationDir, { recursive: true })
      const ext = path.extname(archivePath).toLowerCase()
      const base = path.basename(archivePath).toLowerCase()

      await new Promise<void>((resolve, reject) => {
        let cmd: string
        const hasSelected = Array.isArray(selectedFiles) && selectedFiles.length > 0
        const escapedFiles = hasSelected ? selectedFiles.map((f) => `"${f.replace(/"/g, '\\"')}"`).join(' ') : ''

        if (ext === '.zip') {
          if (hasSelected) {
            cmd = `/usr/bin/unzip -q -o "${archivePath}" ${escapedFiles} -d "${destinationDir}"`
          } else {
            cmd = `/usr/bin/ditto -x -k "${archivePath}" "${destinationDir}"`
          }
        } else if (base.endsWith('.tar.gz') || base.endsWith('.tgz') || ext === '.tar') {
          cmd = `/usr/bin/tar -xf "${archivePath}" -C "${destinationDir}" ${escapedFiles}`
        } else if (base.endsWith('.tar.bz2') || base.endsWith('.tbz2') || ext === '.bz2') {
          cmd = `/usr/bin/tar -xjf "${archivePath}" -C "${destinationDir}" ${escapedFiles}`
        } else if (base.endsWith('.tar.xz') || ext === '.xz') {
          cmd = `/usr/bin/tar -xJf "${archivePath}" -C "${destinationDir}" ${escapedFiles}`
        } else {
          cmd = `/usr/bin/open "${archivePath}"`
        }

        exec(cmd, (err, _stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message))
          else resolve()
        })
      })

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}

