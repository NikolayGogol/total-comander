import { ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { exec, execFile } from 'child_process'
import { get7zPath, getRarPath, getUnrarPath, runPowerShell, safeEnsureDir } from '../utils'

export function registerArchiveIpc(): void {
  // Create ZIP Archive
  ipcMain.handle('fs:createZip', async (_, sources: string[], targetZipPath: string) => {
    try {
      if (!sources || sources.length === 0) {
        return { success: false, error: 'Не вибрано файли для архівування' }
      }

      const parentDir = path.dirname(sources[0])
      const basenames = sources.map((s) => path.basename(s))
      const sysRoot = process.env.SystemRoot || 'C:\\Windows'
      const sysTar = path.join(sysRoot, 'System32', 'tar.exe')
      const tarExe = fs.existsSync(sysTar) ? sysTar : null

      if (tarExe) {
        const escapedNames = basenames.map((b) => `"${b}"`).join(' ')
        const cmd = `"${tarExe}" -a -c -f "${targetZipPath}" -C "${parentDir}" ${escapedNames}`
        await new Promise<void>((resolve, reject) => {
          exec(cmd, { cwd: parentDir }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve()
          })
        })
        return { success: true }
      } else {
        const psList = sources.map((s) => `'${s.replace(/'/g, "''")}'`).join(', ')
        const psScript = `Compress-Archive -LiteralPath @(${psList}) -DestinationPath '${targetZipPath.replace(/'/g, "''")}' -Force`
        const { error } = await runPowerShell(psScript)
        if (error) return { success: false, error }
        return { success: true }
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка архівування' }
    }
  })

  // Extract ZIP Archive
  ipcMain.handle('fs:extractZip', async (_, zipPath: string, targetDir: string) => {
    try {
      if (!fs.existsSync(zipPath)) {
        return { success: false, error: 'Файл архіву не знайдено' }
      }

      await safeEnsureDir(targetDir)
      const sysRoot = process.env.SystemRoot || 'C:\\Windows'
      const sysTar = path.join(sysRoot, 'System32', 'tar.exe')
      const tarExe = fs.existsSync(sysTar) ? sysTar : null

      if (tarExe) {
        const cmd = `"${tarExe}" -xf "${zipPath}" -C "${targetDir}"`
        await new Promise<void>((resolve, reject) => {
          exec(cmd, { cwd: targetDir }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve()
          })
        })
        return { success: true }
      } else {
        const psScript = `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`
        const { error } = await runPowerShell(psScript)
        if (error) return { success: false, error }
        return { success: true }
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка розархівування' }
    }
  })

  // Create Archive (7Z, ZIP, RAR with optional password & compression level)
  ipcMain.handle(
    'fs:createArchive',
    async (
      _,
      options: {
        sources: string[]
        targetPath: string
        format: 'zip' | '7z' | 'rar'
        password?: string
        level?: number
        encryptHeader?: boolean
      }
    ) => {
      try {
        const { sources, targetPath, format, password, level = 5, encryptHeader } = options
        if (!sources || sources.length === 0) {
          return { success: false, error: 'Не вибрано файли для архівування' }
        }

        await safeEnsureDir(path.dirname(targetPath))
        const parentDir = path.dirname(sources[0])
        const basenames = sources.map((s) => path.basename(s))
        const sevenZip = get7zPath()
        const rarPath = getRarPath()

        if (format === 'rar') {
          if (!rarPath) {
            return { success: false, error: 'Архіватор RAR не знайдено на системі.' }
          }
          const rarLevel = level >= 9 ? '5' : level <= 1 ? '1' : '3'
          const args: string[] = ['a', '-ep1', '-y', `-m${rarLevel}`]
          if (password) {
            args.push(`-p${password}`)
            if (encryptHeader) {
              args.push(`-hp${password}`)
            }
          }
          args.push(targetPath)
          args.push(...basenames)

          await new Promise<void>((resolve, reject) => {
            execFile(rarPath, args, { cwd: parentDir }, (err, stdout, stderr) => {
              if (err) return reject(new Error(stderr || err.message))
              resolve()
            })
          })
          return { success: true, targetPath }
        }

        if (sevenZip) {
          const typeArg = format === '7z' ? '-t7z' : '-tzip'
          const args: string[] = ['a', typeArg, '-y', `-mx${level}`]
          if (password) {
            args.push(`-p${password}`)
          }
          if (format === '7z' && password && encryptHeader) {
            args.push('-mhe=on')
          }
          args.push(targetPath)
          args.push(...basenames)

          await new Promise<void>((resolve, reject) => {
            execFile(sevenZip, args, { cwd: parentDir }, (err, stdout, stderr) => {
              if (err) return reject(new Error(stderr || err.message))
              resolve()
            })
          })
          return { success: true, targetPath }
        }

        // Fallback for zip
        const sysRoot = process.env.SystemRoot || 'C:\\Windows'
        const tarExe = path.join(sysRoot, 'System32', 'tar.exe')
        if (fs.existsSync(tarExe) && !password && format === 'zip') {
          const args: string[] = ['-a', '-c', '-f', targetPath, '-C', parentDir, ...basenames]
          await new Promise<void>((resolve, reject) => {
            execFile(tarExe, args, { cwd: parentDir }, (err, stdout, stderr) => {
              if (err) return reject(new Error(stderr || err.message))
              resolve()
            })
          })
          return { success: true, targetPath }
        }

        return { success: false, error: 'Архіватор не знайдено' }
      } catch (err: any) {
        return { success: false, error: err.message || 'Помилка архівування' }
      }
    }
  )

  // List files inside archive (7Z, ZIP, RAR, TAR, GZ)
  ipcMain.handle('fs:listArchive', async (_, archivePath: string, password?: string) => {
    try {
      if (!fs.existsSync(archivePath)) {
        return { success: false, error: 'Архів не знайдено' }
      }

      const sevenZip = get7zPath()
      const ext = path.extname(archivePath).toLowerCase()

      if (sevenZip) {
        const passArg = password ? `-p"${password.replace(/"/g, '\\"')}"` : '-p-'
        const cmd = `"${sevenZip}" l -slt -ba ${passArg} "${archivePath}"`

        const output = await new Promise<string>((resolve, reject) => {
          exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (stdout) return resolve(stdout)
            if (err) {
              const str = (stderr || err.message || '').toLowerCase()
              if (
                str.includes('wrong password') ||
                str.includes('password') ||
                str.includes('can not open encrypted')
              ) {
                return reject(new Error('WRONG_PASSWORD'))
              }
              return reject(new Error(stderr || err.message))
            }
            resolve('')
          })
        }).catch((err) => {
          if (err.message === 'WRONG_PASSWORD') throw err
          return ''
        })

        if (output) {
          const entries: any[] = []
          const blocks = output.split(/\r?\n\r?\n/)

          for (const block of blocks) {
            const lines = block.split(/\r?\n/)
            let itemPath = ''
            let isFolder = false
            let size = 0
            let packedSize = 0
            let modified = ''
            let encrypted = false

            for (const line of lines) {
              const eq = line.indexOf('=')
              if (eq === -1) continue
              const key = line.slice(0, eq).trim()
              const val = line.slice(eq + 1).trim()

              if (key === 'Path') itemPath = val
              else if (key === 'Folder') isFolder = val === '+'
              else if (key === 'Size') size = parseInt(val, 10) || 0
              else if (key === 'Packed Size') packedSize = parseInt(val, 10) || 0
              else if (key === 'Modified') modified = val
              else if (key === 'Encrypted') encrypted = val === '+'
            }

            if (itemPath && itemPath !== path.basename(archivePath)) {
              entries.push({
                path: itemPath,
                name: itemPath.split(/[/\\]/).filter(Boolean).pop() || itemPath,
                isDirectory: isFolder,
                size,
                packedSize,
                modified,
                encrypted,
              })
            }
          }

          if (entries.length > 0) {
            return { success: true, entries }
          }
        }
      }

      // If RAR and 7za couldn't read (e.g. RAR5), try bundled unrar/rar
      const rarTool = getUnrarPath() || getRarPath()
      if (ext === '.rar' && rarTool) {
        const passArg = password ? `-p"${password.replace(/"/g, '\\"')}"` : '-p-'
        const cmd = `"${rarTool}" vb -c- ${passArg} "${archivePath}"`
        const out = await new Promise<string>((resolve, reject) => {
          exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve(stdout || '')
          })
        }).catch(() => '')

        if (out) {
          const lines = out
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)
          const entries = lines.map((l) => ({
            path: l,
            name: l.split(/[/\\]/).filter(Boolean).pop() || l,
            isDirectory: l.endsWith('/') || l.endsWith('\\'),
            size: 0,
          }))
          return { success: true, entries }
        }
      }

      return { success: false, error: 'Не вдалося прочитати вміст архіву' }
    } catch (err: any) {
      if (err.message === 'WRONG_PASSWORD') {
        return { success: false, error: 'Потрібен пароль або пароль некоректний', isEncrypted: true }
      }
      return { success: false, error: err.message || 'Помилка відкриття архіву' }
    }
  })

  // Extract Archive
  ipcMain.handle('fs:extractArchive', async (_, archivePath: string, targetDir: string, password?: string) => {
    try {
      if (!fs.existsSync(archivePath)) {
        return { success: false, error: 'Файл архіву не знайдено' }
      }

      await safeEnsureDir(targetDir)
      const ext = path.extname(archivePath).toLowerCase()
      const sevenZip = get7zPath()
      const rarTool = getUnrarPath() || getRarPath()

      if (ext === '.rar' && rarTool) {
        const passArg = password ? `-p"${password.replace(/"/g, '\\"')}"` : ''
        const cmd = `"${rarTool}" x -y -ep1 ${passArg} "${archivePath}" "${targetDir}\\"`
        await new Promise<void>((resolve, reject) => {
          exec(cmd, { cwd: targetDir }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve()
          })
        })
        return { success: true }
      }

      if (sevenZip) {
        const passArg = password ? `-p"${password.replace(/"/g, '\\"')}"` : ''
        const cmd = `"${sevenZip}" x -y -aoa ${passArg} -o"${targetDir}" "${archivePath}"`
        await new Promise<void>((resolve, reject) => {
          exec(cmd, { cwd: targetDir }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve()
          })
        })
        return { success: true }
      }

      const sysRoot = process.env.SystemRoot || 'C:\\Windows'
      const tarExe = path.join(sysRoot, 'System32', 'tar.exe')
      if (fs.existsSync(tarExe)) {
        const cmd = `"${tarExe}" -xf "${archivePath}" -C "${targetDir}"`
        await new Promise<void>((resolve, reject) => {
          exec(cmd, { cwd: targetDir }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message))
            resolve()
          })
        })
        return { success: true }
      }

      return { success: false, error: 'Утиліту для розпакування не знайдено' }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка розархівування' }
    }
  })
}
