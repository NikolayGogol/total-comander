import { ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { exec } from 'child_process'
import type { ArchiveEntry, CreateArchiveOptions } from '@/types'

export function setupArchiveIpc(): void {
  // Create Archive (Total Commander Alt+F5)
  ipcMain.handle(
    'fs:createArchive',
    async (_, optionsOrSources: CreateArchiveOptions | string[], targetZipPath?: string) => {
      try {
        let sources: string[] = []
        let dest = ''
        let format: 'zip' | 'tar.gz' = 'zip'
        let password = ''
        let level = 6

        if (Array.isArray(optionsOrSources)) {
          sources = optionsOrSources
          dest = (targetZipPath || '').trim()
        } else if (optionsOrSources && typeof optionsOrSources === 'object') {
          sources = optionsOrSources.sources || []
          dest = (optionsOrSources.targetPath || '').trim()
          format = optionsOrSources.format === 'tar.gz' ? 'tar.gz' : 'zip'
          password = optionsOrSources.password || ''
          level = optionsOrSources.level || 6
        }

        if (!sources || sources.length === 0) {
          return { success: false, error: 'Не вибрано файлів для архівації' }
        }

        if (format === 'zip' && !dest.toLowerCase().endsWith('.zip')) {
          dest += '.zip'
        } else if (format === 'tar.gz' && !dest.toLowerCase().endsWith('.tar.gz')) {
          dest += '.tar.gz'
        }

        const parentDir = path.dirname(sources[0])
        const basenames = sources.map((s) => path.basename(s))
        const escapedDest = dest.replace(/"/g, '\\"')

        await new Promise<void>((resolve, reject) => {
          let cmd: string
          if (format === 'tar.gz') {
            const escapedNames = basenames.map((b) => `"${b.replace(/"/g, '\\"')}"`).join(' ')
            cmd = `/usr/bin/tar -czf "${escapedDest}" -C "${parentDir.replace(/"/g, '\\"')}" ${escapedNames}`
          } else {
            // ZIP
            const escapedNames = basenames.map((b) => `"${b.replace(/"/g, '\\"')}"`).join(' ')
            if (password) {
              const passArg = `-P "${password.replace(/"/g, '\\"')}"`
              cmd = `cd "${parentDir.replace(/"/g, '\\"')}" && /usr/bin/zip -r -q -${level} ${passArg} "${escapedDest}" ${escapedNames}`
            } else if (sources.length === 1) {
              const singleSource = sources[0].replace(/"/g, '\\"')
              cmd = `/usr/bin/ditto -c -k --sequesterRsrc --keepParent "${singleSource}" "${escapedDest}"`
            } else {
              cmd = `cd "${parentDir.replace(/"/g, '\\"')}" && /usr/bin/zip -r -q -${level} "${escapedDest}" ${escapedNames}`
            }
          }

          exec(cmd, { maxBuffer: 30 * 1024 * 1024 }, (err, _stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message))
            else resolve()
          })
        })

        return { success: true, targetPath: dest }
      } catch (err: any) {
        return { success: false, error: err.message || 'Помилка створення архіву' }
      }
    }
  )

  // List Archive Entries (Total Commander ArchiveViewModal)
  ipcMain.handle('fs:listArchive', async (_, archivePath: string, password?: string) => {
    try {
      if (!fs.existsSync(archivePath)) {
        return { success: false, error: 'Архів не знайдено' }
      }

      const ext = path.extname(archivePath).toLowerCase()
      const entries: ArchiveEntry[] = []
      let isEncrypted = false

      if (ext === '.zip') {
        const stdout = await new Promise<string>((resolve, reject) => {
          exec(
            `/usr/bin/zipinfo -l "${archivePath.replace(/"/g, '\\"')}"`,
            { maxBuffer: 20 * 1024 * 1024 },
            (err, out) => {
              if (err) reject(err)
              else resolve(out)
            }
          )
        })

        const lines = stdout.split('\n')
        for (const line of lines) {
          // Format: -rw-r--r--  3.0 unx     3621 tx     1155 defN 26-Nov-01 19:59 package.json
          const match = line.match(/^([drwxst-]{10})\s+[\d.]+\s+\w+\s+(\d+)\s+([tTbB][xX\s])\s+(\d+)\s+\w+\s+([\d-]+ \d+:\d+)\s+(.+)$/)
          if (match) {
            const perms = match[1]
            const sz = parseInt(match[2], 10)
            const encFlag = match[3]
            const packed = parseInt(match[4], 10)
            const modDate = match[5]
            const entryPath = match[6].trim()
            const isDir = perms.startsWith('d') || entryPath.endsWith('/')
            const hasEnc = encFlag.startsWith('T') || encFlag.startsWith('B')
            if (hasEnc) isEncrypted = true

            entries.push({
              path: entryPath,
              name: entryPath.split(/[/\\]/).filter(Boolean).pop() || entryPath,
              size: sz,
              packedSize: packed,
              modified: modDate,
              isDirectory: isDir,
              encrypted: hasEnc,
            })
          } else {
            // Fallback for non-standard lines
            const simpleMatch = line.match(/^\s*(\d+)\s+[\d-]+\s+[\d:]+\s+(.+)$/)
            if (simpleMatch) {
              const sz = parseInt(simpleMatch[1], 10)
              const entryPath = simpleMatch[2].trim()
              if (entryPath && !entryPath.startsWith('Archive:') && !entryPath.startsWith('---')) {
                entries.push({
                  path: entryPath,
                  name: entryPath.split(/[/\\]/).filter(Boolean).pop() || entryPath,
                  size: sz,
                  isDirectory: entryPath.endsWith('/'),
                })
              }
            }
          }
        }

        // Verify password if archive is encrypted
        if (isEncrypted && password) {
          try {
            await new Promise<void>((resolve, reject) => {
              exec(
                `/usr/bin/unzip -t -P "${password.replace(/"/g, '\\"')}" "${archivePath.replace(/"/g, '\\"')}"`,
                (err, _out, stderr) => {
                  if (err || (stderr && stderr.includes('incorrect password'))) {
                    reject(new Error('WRONG_PASSWORD'))
                  } else {
                    resolve()
                  }
                }
              )
            })
          } catch (err: any) {
            if (err.message === 'WRONG_PASSWORD') {
              return { success: false, error: 'Потрібен пароль або пароль некоректний', isEncrypted: true }
            }
          }
        }
      } else {
        // TAR / TAR.GZ
        const stdout = await new Promise<string>((resolve, reject) => {
          exec(
            `/usr/bin/tar -tvf "${archivePath.replace(/"/g, '\\"')}"`,
            { maxBuffer: 20 * 1024 * 1024 },
            (err, out) => {
              if (err) reject(err)
              else resolve(out)
            }
          )
        })

        const lines = stdout.split('\n')
        for (const line of lines) {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 6) {
            const sz = parseInt(parts[4], 10) || 0
            const modDate = `${parts[5]} ${parts[6] || ''}`
            const entryPath = parts.slice(8).join(' ') || parts[parts.length - 1]
            if (entryPath) {
              entries.push({
                path: entryPath,
                name: entryPath.split(/[/\\]/).filter(Boolean).pop() || entryPath,
                size: sz,
                modified: modDate,
                isDirectory: parts[0]?.startsWith('d') || entryPath.endsWith('/'),
              })
            }
          }
        }
      }

      return { success: true, entries, isEncrypted }
    } catch (err: any) {
      return { success: false, error: err.message || 'Не вдалося відкрити вміст архіву' }
    }
  })

  // Extract Archive (Total Commander Alt+F6)
  ipcMain.handle(
    'fs:extractArchive',
    async (_, archivePath: string, destinationDir: string, passwordOrSelected?: string | string[]) => {
      try {
        if (!fs.existsSync(archivePath)) {
          return { success: false, error: 'Архів не знайдено' }
        }

        await fsPromises.mkdir(destinationDir, { recursive: true })
        const ext = path.extname(archivePath).toLowerCase()
        const base = path.basename(archivePath).toLowerCase()

        let password = ''
        let selectedFiles: string[] = []

        if (typeof passwordOrSelected === 'string') {
          password = passwordOrSelected
        } else if (Array.isArray(passwordOrSelected)) {
          selectedFiles = passwordOrSelected
        }

        await new Promise<void>((resolve, reject) => {
          let cmd: string
          const hasSelected = selectedFiles.length > 0
          const escapedFiles = hasSelected
            ? selectedFiles.map((f) => `"${f.replace(/"/g, '\\"')}"`).join(' ')
            : ''

          if (ext === '.zip') {
            const passArg = password ? `-P "${password.replace(/"/g, '\\"')}"` : ''
            if (password || hasSelected) {
              cmd = `/usr/bin/unzip -q -o ${passArg} "${archivePath.replace(/"/g, '\\"')}" ${escapedFiles} -d "${destinationDir.replace(/"/g, '\\"')}"`
            } else {
              cmd = `/usr/bin/ditto -x -k "${archivePath.replace(/"/g, '\\"')}" "${destinationDir.replace(/"/g, '\\"')}"`
            }
          } else if (base.endsWith('.tar.gz') || base.endsWith('.tgz') || ext === '.tar') {
            cmd = `/usr/bin/tar -xf "${archivePath.replace(/"/g, '\\"')}" -C "${destinationDir.replace(/"/g, '\\"')}" ${escapedFiles}`
          } else if (base.endsWith('.tar.bz2') || base.endsWith('.tbz2') || ext === '.bz2') {
            cmd = `/usr/bin/tar -xjf "${archivePath.replace(/"/g, '\\"')}" -C "${destinationDir.replace(/"/g, '\\"')}" ${escapedFiles}`
          } else if (base.endsWith('.tar.xz') || ext === '.xz') {
            cmd = `/usr/bin/tar -xJf "${archivePath.replace(/"/g, '\\"')}" -C "${destinationDir.replace(/"/g, '\\"')}" ${escapedFiles}`
          } else {
            cmd = `/usr/bin/open "${archivePath.replace(/"/g, '\\"')}"`
          }

          exec(cmd, (err, _stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message))
            else resolve()
          })
        })

        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message || 'Помилка розархівування' }
      }
    }
  )
}
