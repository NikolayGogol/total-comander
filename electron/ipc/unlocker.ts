import { ipcMain, shell } from 'electron'
import { execFile } from 'child_process'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { trashViaFinder, trashPrivileged, runPrivilegedRm, runPrivilegedMove } from './fileSystem'

interface ProcInfo {
  pid: number
  name: string
  appName: string
}

function runExec(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 7000 }, (err, stdout) => {
      if (err) resolve('')
      else resolve(stdout || '')
    })
  })
}

function killPid(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      process.kill(pid, 'SIGKILL')
      resolve(true)
    } catch {
      execFile('kill', ['-9', String(pid)], (err) => {
        resolve(!err)
      })
    }
  })
}

function clearMacFlags(targetPath: string): Promise<void> {
  return new Promise((resolve) => {
    execFile('chflags', ['-R', 'nouchg,noschg', targetPath], () => {
      execFile('chmod', ['-R', 'u+w', targetPath], () => {
        resolve()
      })
    })
  })
}

function safeHandle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener)
}

export function registerUnlockerIpc(): void {
  // Find processes locking a file or directory on macOS
  safeHandle('unlocker:findLockingProcesses', async (_, targetPath: string) => {
    if (!targetPath) {
      return { success: false, error: 'Path is required', processes: [] }
    }

    try {
      if (!fs.existsSync(targetPath)) {
        return { success: false, error: 'Обʼєкт не знайдено', processes: [] }
      }

      const st = await fsPromises.stat(targetPath)
      const isDir = st.isDirectory()

      const args = isDir ? ['-F', 'pcn', '+D', targetPath] : ['-F', 'pcn', targetPath]
      const output = await runExec('/usr/sbin/lsof', args)

      const map = new Map<number, ProcInfo>()
      let currentPid: number | null = null
      let currentName = ''

      const lines = output.split('\n')
      for (const line of lines) {
        if (!line) continue
        const type = line[0]
        const val = line.slice(1).trim()

        if (type === 'p') {
          currentPid = parseInt(val, 10)
          if (!isNaN(currentPid) && !map.has(currentPid)) {
            map.set(currentPid, { pid: currentPid, name: '', appName: '' })
          }
        } else if (type === 'c' && currentPid !== null) {
          currentName = val
          const p = map.get(currentPid)
          if (p) {
            p.name = currentName
            p.appName = currentName
          }
        }
      }

      // Filter out our own process PID so the user doesn't kill Total Commander
      const ownPid = process.pid
      map.delete(ownPid)

      // Enhance app name for GUI applications
      for (const [pid, proc] of map.entries()) {
        try {
          const comm = await runExec('ps', ['-p', String(pid), '-o', 'comm='])
          const trimmedComm = comm.trim()
          if (trimmedComm.includes('.app/Contents/MacOS/')) {
            const match = trimmedComm.match(/([^/]+)\.app\/Contents\/MacOS\//)
            if (match && match[1]) {
              proc.appName = match[1]
            }
          } else if (trimmedComm) {
            proc.appName = path.basename(trimmedComm)
          }
        } catch {}
      }

      const processes = Array.from(map.values())
      return { success: true, processes }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка виявлення процесів', processes: [] }
    }
  })

  // Kill specific PIDs
  safeHandle('unlocker:killProcesses', async (_, pids: number[]) => {
    if (!Array.isArray(pids) || pids.length === 0) {
      return { success: true, killedCount: 0 }
    }

    let count = 0
    const errors: string[] = []

    for (const pid of pids) {
      if (pid === process.pid) continue
      const ok = await killPid(pid)
      if (ok) {
        count++
      } else {
        errors.push(`Не вдалося завершити процес PID ${pid}`)
      }
    }

    return { success: true, killedCount: count, errors: errors.length > 0 ? errors : undefined }
  })

  // Unlock and perform action (delete, move, copy, or unlock)
  safeHandle(
    'unlocker:unlockAndExecute',
    async (
      _,
      options: {
        targetPath: string
        action: 'delete' | 'move' | 'copy' | 'unlock'
        pidsToKill?: number[]
        destinationDir?: string
        permanentDelete?: boolean
      }
    ) => {
      const { targetPath, action, pidsToKill = [], destinationDir, permanentDelete } = options

      if (!targetPath) {
        return { success: false, error: 'Target path is required' }
      }

      // 1. Terminate locking processes
      if (Array.isArray(pidsToKill) && pidsToKill.length > 0) {
        for (const pid of pidsToKill) {
          if (pid !== process.pid) {
            await killPid(pid)
          }
        }
        await new Promise((r) => setTimeout(r, 200))
      }

      // 2. Clear macOS immutable flags and write permissions
      await clearMacFlags(targetPath)

      // 3. Execute requested file action
      try {
        if (action === 'unlock') {
          return { success: true, killedCount: pidsToKill.length, actionExecuted: 'unlock' }
        }

        if (action === 'delete') {
          if (permanentDelete) {
            try {
              await fsPromises.rm(targetPath, { recursive: true, force: true })
            } catch (err: any) {
              if (err.code === 'EACCES' || err.code === 'EPERM') {
                const privRm = await runPrivilegedRm([targetPath])
                if (!privRm.success) return privRm
              } else {
                throw err
              }
            }
          } else {
            try {
              await shell.trashItem(targetPath)
            } catch {
              const finderOk = await trashViaFinder(targetPath)
              if (!finderOk) {
                const privTrash = await trashPrivileged([targetPath])
                if (!privTrash.success) return privTrash
              }
            }
          }
          return { success: true, killedCount: pidsToKill.length, actionExecuted: 'delete' }
        }

        if (action === 'move') {
          if (!destinationDir) {
            return { success: false, error: 'Destination directory is required for move' }
          }
          await fsPromises.mkdir(destinationDir, { recursive: true })
          const baseName = path.basename(targetPath)
          const dest = path.join(destinationDir, baseName)

          try {
            await fsPromises.rename(targetPath, dest)
          } catch (renameErr: any) {
            if (renameErr.code === 'EXDEV') {
              await fsPromises.cp(targetPath, dest, { recursive: true })
              try {
                await fsPromises.rm(targetPath, { recursive: true, force: true })
              } catch (rmErr: any) {
                if (rmErr.code === 'EACCES' || rmErr.code === 'EPERM') {
                  await runPrivilegedRm([targetPath])
                } else {
                  throw rmErr
                }
              }
            } else if (renameErr.code === 'EACCES' || renameErr.code === 'EPERM') {
              const privMove = await runPrivilegedMove(targetPath, dest)
              if (!privMove.success) return privMove
            } else {
              throw renameErr
            }
          }
          return { success: true, killedCount: pidsToKill.length, actionExecuted: 'move' }
        }

        if (action === 'copy') {
          if (!destinationDir) {
            return { success: false, error: 'Destination directory is required for copy' }
          }
          await fsPromises.mkdir(destinationDir, { recursive: true })
          const baseName = path.basename(targetPath)
          const dest = path.join(destinationDir, baseName)
          await fsPromises.cp(targetPath, dest, { recursive: true })
          return { success: true, killedCount: pidsToKill.length, actionExecuted: 'copy' }
        }

        return { success: false, error: `Невідома дія: ${action}` }
      } catch (err: any) {
        return { success: false, error: err.message || 'Помилка виконання операції' }
      }
    }
  )
}

