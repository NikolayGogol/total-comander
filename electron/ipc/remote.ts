import { ipcMain, dialog } from 'electron'
import { Client as SshClient, type SFTPWrapper } from 'ssh2'
import * as ftp from 'basic-ftp'
import { exec } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'
import fsPromises from 'fs/promises'
import type { RemoteConnectionConfig, RemoteFileEntry } from '@/types'

function safeHandle(channel: string, listener: (...args: any[]) => Promise<any>) {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener)
}

function buildSshConfig(config: RemoteConnectionConfig) {
  const sshConfig: any = {
    host: config.host,
    port: config.port || 22,
    username: config.username || 'root',
    readyTimeout: config.timeout || 12000,
  }

  if (config.authType === 'key') {
    if (config.privateKeyPath && fs.existsSync(config.privateKeyPath)) {
      sshConfig.privateKey = fs.readFileSync(config.privateKeyPath)
    } else if (config.privateKeyContent) {
      sshConfig.privateKey = config.privateKeyContent
    }
    if (config.passphrase) sshConfig.passphrase = config.passphrase
  } else {
    sshConfig.password = config.password || ''
  }
  return sshConfig
}

function getSftpSession(config: RemoteConnectionConfig): Promise<{ client: SshClient; sftp: SFTPWrapper }> {
  return new Promise((resolve, reject) => {
    const client = new SshClient()
    let isSettled = false

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true
        try {
          client.end()
        } catch {}
        reject(new Error('Час очікування підключення до SFTP вичерпано (timeout)'))
      }
    }, config.timeout || 15000)

    client.on('ready', () => {
      client.sftp((err, sftp) => {
        clearTimeout(timer)
        if (isSettled) return
        isSettled = true
        if (err) {
          try {
            client.end()
          } catch {}
          return reject(err)
        }
        resolve({ client, sftp })
      })
    })

    client.on('error', (err) => {
      clearTimeout(timer)
      if (isSettled) return
      isSettled = true
      reject(err)
    })

    try {
      client.connect(buildSshConfig(config))
    } catch (err) {
      clearTimeout(timer)
      if (isSettled) return
      isSettled = true
      reject(err)
    }
  })
}

async function getFtpSession(config: RemoteConnectionConfig): Promise<ftp.Client> {
  const client = new ftp.Client(config.timeout || 15000)
  client.ftp.verbose = false
  await client.access({
    host: config.host,
    port: config.port || 21,
    user: config.username || 'anonymous',
    password: config.password || '',
    secure: config.protocol === 'ftps',
  })
  return client
}

function formatUnixPermissions(p?: { user: number; group: number; world: number }, isDir?: boolean): string {
  if (!p) return '-'
  const modeToStr = (m: number) => `${m & 4 ? 'r' : '-'}${m & 2 ? 'w' : '-'}${m & 1 ? 'x' : '-'}`
  return `${isDir ? 'd' : '-'}${modeToStr(p.user || 0)}${modeToStr(p.group || 0)}${modeToStr(p.world || 0)}`
}

function isSsh(protocol?: string): boolean {
  return protocol === 'sftp' || protocol === 'ssh'
}

function createProgressTracker(
  sender: Electron.WebContents,
  type: 'upload' | 'download',
  fileName: string,
  totalBytes: number,
) {
  const startTime = Date.now()
  let lastTime = startTime
  let lastBytes = 0
  let speedBytesPerSec = 0

  function update(bytesTransferred: number, total = totalBytes) {
    const now = Date.now()
    const elapsedSeconds = Math.max(0.1, (now - startTime) / 1000)
    const timeDelta = (now - lastTime) / 1000

    if (timeDelta >= 0.12 || bytesTransferred >= total) {
      const bytesDelta = Math.max(0, bytesTransferred - lastBytes)
      if (timeDelta > 0) {
        const instantSpeed = bytesDelta / timeDelta
        speedBytesPerSec =
          speedBytesPerSec > 0
            ? Math.round(instantSpeed * 0.7 + speedBytesPerSec * 0.3)
            : Math.round(instantSpeed)
      }
      lastTime = now
      lastBytes = bytesTransferred
      const bytesRemaining = Math.max(0, total - bytesTransferred)
      const etaSeconds = speedBytesPerSec > 0 ? Math.ceil(bytesRemaining / speedBytesPerSec) : 0
      const percent = total > 0 ? Math.min(100, Math.round((bytesTransferred / total) * 100)) : 0

      try {
        if (!sender.isDestroyed()) {
          sender.send('remote:transfer-progress', {
            type,
            fileName,
            bytesTransferred,
            totalBytes: total,
            bytesRemaining,
            percent,
            speedBytesPerSec,
            etaSeconds,
            elapsedSeconds: Math.round(elapsedSeconds),
            isDone: false,
          })
        }
      } catch {}
    }
  }

  function finish(finalTotal = totalBytes) {
    try {
      if (!sender.isDestroyed()) {
        sender.send('remote:transfer-progress', {
          type,
          fileName,
          bytesTransferred: finalTotal,
          totalBytes: finalTotal,
          bytesRemaining: 0,
          percent: 100,
          speedBytesPerSec: 0,
          etaSeconds: 0,
          elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
          isDone: true,
        })
      }
    } catch {}
  }

  return { update, finish }
}

export function setupRemoteIpc(): void {
  // 1. Test Connection
  safeHandle('remote:testConnection', async (_, config: RemoteConnectionConfig) => {
    try {
      if (isSsh(config.protocol)) {
        await new Promise<void>((resolve, reject) => {
          const client = new SshClient()
          let settled = false
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true
              try {
                client.end()
              } catch {}
              reject(new Error('Час очікування підключення вичерпано (timeout)'))
            }
          }, config.timeout || 10000)

          client.on('ready', () => {
            clearTimeout(timer)
            if (!settled) {
              settled = true
              client.end()
              resolve()
            }
          })
          client.on('error', (err) => {
            clearTimeout(timer)
            if (!settled) {
              settled = true
              reject(err)
            }
          })
          client.connect(buildSshConfig(config))
        })
        return {
          success: true,
          message: `Успішно підключено до ${config.protocol.toUpperCase()} сервера (${config.host}:${config.port || 22})`,
        }
      } else {
        const client = await getFtpSession(config)
        await client.pwd()
        client.close()
        return {
          success: true,
          message: `Успішно підключено до FTP сервера (${config.host}:${config.port || 21})`,
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Не вдалося встановити підключення' }
    }
  })

  // 2. List Directory
  safeHandle('remote:listDir', async (_, config: RemoteConnectionConfig, requestedPath?: string) => {
    if (isSsh(config.protocol)) {
      let session: { client: SshClient; sftp: SFTPWrapper } | null = null
      try {
        session = await getSftpSession(config)
        const { sftp } = session

        let currentPath = (requestedPath || '').trim()
        if (!currentPath || currentPath === '.') {
          currentPath = await new Promise<string>((resolve) => {
            sftp.realpath('.', (err, target) => {
              resolve(err || !target ? '/' : target)
            })
          })
        }

        const rawList = await new Promise<any[]>((resolve, reject) => {
          sftp.readdir(currentPath, (err, list) => {
            if (err) return reject(err)
            resolve(list || [])
          })
        })

        const entries: RemoteFileEntry[] = rawList.map((item) => {
          const isDir = Boolean((item.attrs?.mode && (item.attrs.mode & 0o170000) === 0o040000) || item.longname?.startsWith('d'))
          const isLink = Boolean((item.attrs?.mode && (item.attrs.mode & 0o170000) === 0o120000) || item.longname?.startsWith('l'))
          const ext = isDir ? '' : path.extname(item.filename).replace(/^\./, '').toLowerCase()

          return {
            name: item.filename,
            path: path.posix.join(currentPath, item.filename),
            isDirectory: isDir,
            isSymbolicLink: isLink,
            size: item.attrs?.size || 0,
            modified: (item.attrs?.mtime || 0) * 1000,
            permissions: item.longname ? item.longname.split(/\s+/)[0] : undefined,
            extension: ext,
          }
        })

        entries.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        })

        return { success: true, currentPath, entries }
      } catch (err: any) {
        return { success: false, currentPath: requestedPath || '/', error: err.message }
      } finally {
        if (session) {
          try {
            session.client.end()
          } catch {}
        }
      }
    } else if (config.protocol === 'ftp' || config.protocol === 'ftps') {
      let client: ftp.Client | null = null
      try {
        client = await getFtpSession(config)
        let currentPath = (requestedPath || '').trim()
        if (!currentPath) {
          currentPath = await client.pwd()
        }

        const list = await client.list(currentPath)
        const entries: RemoteFileEntry[] = list
          .filter((item) => item.name !== '.' && item.name !== '..')
          .map((item) => {
            const ext = item.isDirectory ? '' : path.extname(item.name).replace(/^\./, '').toLowerCase()
            return {
              name: item.name,
              path: path.posix.join(currentPath, item.name),
              isDirectory: item.isDirectory,
              isSymbolicLink: item.isSymbolicLink,
              size: item.size || 0,
              modified: item.modifiedAt
                ? new Date(item.modifiedAt).getTime()
                : item.rawModifiedAt
                  ? new Date(item.rawModifiedAt).getTime()
                  : 0,
              permissions: formatUnixPermissions(item.permissions, item.isDirectory),
              extension: ext,
            }
          })

        entries.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        })

        return { success: true, currentPath, entries }
      } catch (err: any) {
        return { success: false, currentPath: requestedPath || '/', error: err.message }
      } finally {
        if (client) {
          try {
            client.close()
          } catch {}
        }
      }
    } else {
      return { success: false, currentPath: requestedPath || '/', error: `Непідтримуваний протокол: ${config.protocol}` }
    }
  })

  // 3. Download Remote File
  safeHandle('remote:download', async (event, config: RemoteConnectionConfig, remoteFilePath: string, localDestinationDir: string) => {
    try {
      await fsPromises.mkdir(localDestinationDir, { recursive: true })
      const fileName = path.posix.basename(remoteFilePath)
      const localFilePath = path.join(localDestinationDir, fileName)

      if (isSsh(config.protocol)) {
        const session = await getSftpSession(config)
        try {
          let remoteSize = 0
          try {
            const stat = await new Promise<any>((resolve, reject) => {
              session.sftp.stat(remoteFilePath, (err, s) => (err ? reject(err) : resolve(s)))
            })
            remoteSize = stat.size || 0
          } catch {}

          const tracker = createProgressTracker(event.sender, 'download', fileName, remoteSize)

          await new Promise<void>((resolve, reject) => {
            session.sftp.fastGet(
              remoteFilePath,
              localFilePath,
              {
                step: (total_transferred, _chunk, total) => {
                  tracker.update(total_transferred, total || remoteSize)
                },
              },
              (err) => {
                if (err) return reject(err)
                tracker.finish(remoteSize)
                resolve()
              },
            )
          })
        } finally {
          session.client.end()
        }
      } else {
        const client = await getFtpSession(config)
        try {
          let remoteSize = 0
          try {
            remoteSize = await client.size(remoteFilePath)
          } catch {}

          const tracker = createProgressTracker(event.sender, 'download', fileName, remoteSize)
          client.trackProgress((info) => {
            tracker.update(info.bytesOverall, remoteSize)
          })

          await client.downloadTo(localFilePath, remoteFilePath)
          client.trackProgress()
          tracker.finish(remoteSize)
        } finally {
          client.close()
        }
      }

      return { success: true, localPath: localFilePath }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка завантаження файлу з сервера' }
    }
  })

  // 4. Upload Local File
  safeHandle('remote:upload', async (event, config: RemoteConnectionConfig, localFilePath: string, remoteDestinationDir: string) => {
    try {
      if (!fs.existsSync(localFilePath)) {
        return { success: false, error: 'Локальний файл не існує' }
      }

      const fileName = path.basename(localFilePath)
      const remoteFilePath = path.posix.join(remoteDestinationDir, fileName)
      const totalBytes = fs.statSync(localFilePath).size
      const tracker = createProgressTracker(event.sender, 'upload', fileName, totalBytes)

      if (isSsh(config.protocol)) {
        const session = await getSftpSession(config)
        try {
          await new Promise<void>((resolve, reject) => {
            session.sftp.fastPut(
              localFilePath,
              remoteFilePath,
              {
                step: (total_transferred, _chunk, total) => {
                  tracker.update(total_transferred, total || totalBytes)
                },
              },
              (err) => {
                if (err) return reject(err)
                tracker.finish(totalBytes)
                resolve()
              },
            )
          })
        } finally {
          session.client.end()
        }
      } else {
        const client = await getFtpSession(config)
        try {
          client.trackProgress((info) => {
            tracker.update(info.bytesOverall, totalBytes)
          })

          await client.uploadFrom(localFilePath, remoteFilePath)
          client.trackProgress()
          tracker.finish(totalBytes)
        } finally {
          client.close()
        }
      }

      return { success: true, remotePath: remoteFilePath }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка надсилання файлу на сервер' }
    }
  })

  // 5. Create Directory
  safeHandle('remote:mkdir', async (_, config: RemoteConnectionConfig, remotePath: string) => {
    try {
      if (isSsh(config.protocol)) {
        const session = await getSftpSession(config)
        try {
          await new Promise<void>((resolve, reject) => {
            session.sftp.mkdir(remotePath, (err) => {
              if (err) return reject(err)
              resolve()
            })
          })
        } finally {
          session.client.end()
        }
      } else {
        const client = await getFtpSession(config)
        try {
          await client.ensureDir(remotePath)
        } finally {
          client.close()
        }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка створення папки на сервері' }
    }
  })

  // 6. Create Empty / Text File
  safeHandle('remote:createFile', async (_, config: RemoteConnectionConfig, remotePath: string, content = '') => {
    try {
      if (isSsh(config.protocol)) {
        const session = await getSftpSession(config)
        try {
          await new Promise<void>((resolve, reject) => {
            const stream = session.sftp.createWriteStream(remotePath)
            stream.on('close', () => resolve())
            stream.on('error', (err: any) => reject(err))
            stream.end(Buffer.from(content, 'utf-8'))
          })
        } finally {
          session.client.end()
        }
      } else {
        const client = await getFtpSession(config)
        try {
          const { Readable } = await import('stream')
          await client.uploadFrom(Readable.from([content]), remotePath)
        } finally {
          client.close()
        }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка створення файлу на сервері' }
    }
  })

  // 7. Rename File or Directory
  safeHandle('remote:rename', async (_, config: RemoteConnectionConfig, oldPath: string, newPath: string) => {
    try {
      if (isSsh(config.protocol)) {
        const session = await getSftpSession(config)
        try {
          await new Promise<void>((resolve, reject) => {
            session.sftp.rename(oldPath, newPath, (err) => (err ? reject(err) : resolve()))
          })
        } finally {
          session.client.end()
        }
      } else {
        const client = await getFtpSession(config)
        try {
          await client.rename(oldPath, newPath)
        } finally {
          client.close()
        }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка перейменування' }
    }
  })

  // 8. Read Remote File Text (for viewing/editing)
  safeHandle('remote:readText', async (_, config: RemoteConnectionConfig, remoteFilePath: string) => {
    try {
      if (isSsh(config.protocol)) {
        const session = await getSftpSession(config)
        try {
          const content = await new Promise<string>((resolve, reject) => {
            const stream = session.sftp.createReadStream(remoteFilePath, { encoding: 'utf-8' })
            let text = ''
            stream.on('data', (chunk: any) => (text += chunk))
            stream.on('end', () => resolve(text))
            stream.on('error', (err: any) => reject(err))
          })
          return { success: true, content }
        } finally {
          session.client.end()
        }
      } else {
        const client = await getFtpSession(config)
        try {
          const { Writable } = await import('stream')
          const chunks: Buffer[] = []
          const stream = new Writable({
            write(chunk, _encoding, callback) {
              chunks.push(Buffer.from(chunk))
              callback()
            },
          })
          await client.downloadTo(stream, remoteFilePath)
          return { success: true, content: Buffer.concat(chunks).toString('utf-8') }
        } finally {
          client.close()
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка читання файлу' }
    }
  })

  // 9. Write Remote File Text (for saving edited file)
  safeHandle('remote:writeText', async (_, config: RemoteConnectionConfig, remoteFilePath: string, content: string) => {
    try {
      if (isSsh(config.protocol)) {
        const session = await getSftpSession(config)
        try {
          await new Promise<void>((resolve, reject) => {
            const stream = session.sftp.createWriteStream(remoteFilePath)
            stream.on('close', () => resolve())
            stream.on('error', (err: any) => reject(err))
            stream.end(Buffer.from(content, 'utf-8'))
          })
        } finally {
          session.client.end()
        }
      } else {
        const client = await getFtpSession(config)
        try {
          const { Readable } = await import('stream')
          await client.uploadFrom(Readable.from([content]), remoteFilePath)
        } finally {
          client.close()
        }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка збереження файлу на сервері' }
    }
  })

  // 10. Delete File or Directory
  safeHandle('remote:delete', async (_, config: RemoteConnectionConfig, remotePath: string, isDirectory: boolean) => {
    try {
      if (isSsh(config.protocol)) {
        const session = await getSftpSession(config)
        try {
          await new Promise<void>((resolve, reject) => {
            if (isDirectory) {
              session.sftp.rmdir(remotePath, (err) => (err ? reject(err) : resolve()))
            } else {
              session.sftp.unlink(remotePath, (err) => (err ? reject(err) : resolve()))
            }
          })
        } finally {
          session.client.end()
        }
      } else {
        const client = await getFtpSession(config)
        try {
          if (isDirectory) {
            await client.removeDir(remotePath)
          } else {
            await client.remove(remotePath)
          }
        } finally {
          client.close()
        }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка видалення об\'єкта на сервері' }
    }
  })

  // 7. Open Native SSH Terminal
  safeHandle('remote:openSshTerminal', async (_, config: RemoteConnectionConfig) => {
    try {
      const port = config.port || 22
      const portArg = port !== 22 ? `-p ${port}` : ''
      const keyArg = config.privateKeyPath ? `-i "${config.privateKeyPath.replace(/"/g, '\\"')}"` : ''
      const userHost = config.username ? `${config.username}@${config.host}` : config.host
      const sshCmd = `ssh ${portArg} ${keyArg} ${userHost}`.replace(/\s+/g, ' ').trim()

      const script = `tell application "Terminal"
        activate
        do script "${sshCmd.replace(/"/g, '\\"')}"
      end tell`

      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err) => {
        if (err) console.error('Failed to open SSH in Terminal:', err)
      })

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Не вдалося відкрити SSH термінал' }
    }
  })

  // 8. Select Private Key File Dialog
  safeHandle('remote:selectPrivateKeyDialog', async () => {
    try {
      const defaultSshDir = path.join(os.homedir(), '.ssh')
      const initialPath = fs.existsSync(defaultSshDir) ? defaultSshDir : os.homedir()

      const result = await dialog.showOpenDialog({
        title: 'Виберіть приватний ключ SSH (id_rsa, id_ed25519, .pem)',
        defaultPath: initialPath,
        properties: ['openFile', 'showHiddenFiles'],
      })

      if (result.canceled || !result.filePaths.length) {
        return { canceled: true }
      }

      return { canceled: false, filePath: result.filePaths[0] }
    } catch (err: any) {
      return { canceled: true, error: err.message }
    }
  })
}

