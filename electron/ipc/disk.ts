import { ipcMain, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { execSync } from 'child_process'
import { runPowerShell } from '../utils'

export const driveInfoCache = new Map<string, { type: string; label: string }>()

export async function refreshDriveTypes(): Promise<void> {
  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
[System.IO.DriveInfo]::GetDrives() | ForEach-Object {
    $t = $_.DriveType.ToString()
    $n = $_.Name.TrimEnd('\\')
    $lbl = ''
    try { if ($_.IsReady) { $lbl = $_.VolumeLabel } } catch {}
    Write-Output "$n|$t|$lbl"
}
`
  const { stdout } = await runPowerShell(script)
  if (stdout) {
    const lines = stdout.split(/\r?\n/)
    for (const line of lines) {
      const parts = line.trim().split('|')
      if (parts.length >= 2) {
        const letter = parts[0].replace(/[:\\/]/g, '').toUpperCase()
        if (letter) {
          const rawLabel = parts[2] || ''
          const cleanLabel = rawLabel.replace(/[\uFFFD\0]/g, '').trim()
          driveInfoCache.set(letter, {
            type: parts[1] || 'Fixed',
            label: cleanLabel,
          })
        }
      }
    }
  }
}

export function setupVolumeWatcher(getMainWindow: () => BrowserWindow | null): () => void {
  let knownDrives = ''
  const timer = setInterval(async () => {
    try {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
      const current = letters.filter((l) => fs.existsSync(`${l}:\\`)).join(',')
      if (knownDrives && current !== knownDrives) {
        await refreshDriveTypes()
        const win = getMainWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('drives:changed')
        }
      }
      knownDrives = current
    } catch {}
  }, 2000)

  return () => clearInterval(timer)
}

function getWindowsLockedFiles(driveRoot: string): Array<{
  path: string
  name: string
  size: number
  mtime: number
  extension: string
  dir: string
}> {
  const list: Array<{
    path: string
    name: string
    size: number
    mtime: number
    extension: string
    dir: string
  }> = []
  if (process.platform !== 'win32') return list

  const cleanRoot = driveRoot.replace(/[/\\]+$/, '') + '\\'
  const lockedCandidates = ['hiberfil.sys', 'pagefile.sys', 'swapfile.sys', 'MEMORY.DMP']

  for (const fileName of lockedCandidates) {
    const full = path.join(cleanRoot, fileName)
    try {
      const out = execSync(`cmd /c dir /-c /a "${full}"`, { encoding: 'utf8', timeout: 800 })
      const match = out.match(/File\(s\)\s+(\d+)\s+bytes/i)
      if (match) {
        const sz = parseInt(match[1], 10)
        if (sz > 0) {
          list.push({
            path: full,
            name: fileName,
            size: sz,
            mtime: Date.now(),
            extension: fileName.split('.').pop() || 'sys',
            dir: cleanRoot,
          })
        }
      }
    } catch {}
  }
  return list
}

export function registerDiskIpc(getMainWindow: () => BrowserWindow | null): void {
  // Quick Access / Drives
  ipcMain.handle('fs:getDrives', async () => {
    try {
      if (driveInfoCache.size === 0) {
        await Promise.race([refreshDriveTypes(), new Promise((r) => setTimeout(r, 1500))])
      }

      const systemDrive = process.env.SystemDrive ? process.env.SystemDrive.toUpperCase() + '\\' : 'C:\\'
      const drives: any[] = []

      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
      for (const letter of letters) {
        const drivePath = `${letter}:\\`
        if (fs.existsSync(drivePath)) {
          const isSys = drivePath.toUpperCase() === systemDrive
          const info = driveInfoCache.get(letter)

          let dType = info?.type
          if (!dType) {
            dType = isSys || letter === 'D' ? 'Fixed' : 'Removable'
          }

          const isRemovable = dType === 'Removable' || dType === 'CDRom'

          let icon = 'HardDrive'
          let type = 'volume'
          if (isSys) {
            type = 'root'
            icon = 'HardDrive'
          } else if (dType === 'Removable') {
            type = 'usb'
            icon = 'Usb'
          } else if (dType === 'CDRom') {
            type = 'cdrom'
            icon = 'Disc'
          }

          const driveName = `Диск (${letter}:)`

          drives.push({
            name: driveName,
            path: drivePath,
            icon,
            type,
            label: info?.label || undefined,
            isRemovable,
          })
        }
      }

      // Calculate disk space
      for (const d of drives) {
        try {
          const stat = await fsPromises.statfs(d.path)
          d.totalSpace = stat.bsize * stat.blocks
          d.freeSpace = stat.bsize * stat.bavail
        } catch {
          // Virtual or unreadable filesystem
        }
      }

      return { success: true, data: drives }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get Disk Space for any path
  ipcMain.handle('fs:getDiskSpace', async (_, dirPath: string) => {
    try {
      const stats = await fsPromises.statfs(dirPath)
      return {
        success: true,
        total: stats.bsize * stats.blocks,
        free: stats.bsize * stats.bavail,
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Eject USB / External Volume / Virtual Disk
  ipcMain.handle('fs:ejectVolume', async (_, volumePath: string) => {
    try {
      const match = volumePath.match(/^([A-Za-z]):/)
      if (!match) {
        return { success: false, error: 'Некоректний шлях до носія' }
      }
      const letter = match[1].toUpperCase()
      const drivePath = `${letter}:\\`

      const sysDriveLetter = (process.env.SystemDrive || 'C:').charAt(0).toUpperCase()
      if (letter === sysDriveLetter) {
        return { success: false, error: 'Неможливо вилучити системний диск' }
      }

      const cachedInfo = driveInfoCache.get(letter)
      if (cachedInfo && cachedInfo.type === 'Fixed') {
        return { success: false, error: 'Неможливо вилучити вбудований фіксований диск' }
      }

      const ejectScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$target = '${letter}'
$drivePath = '${letter}:\\'

# 1. Dismount mounted ISO / Disk Image if applicable
try {
    $vol = Get-Volume -DriveLetter $target -ErrorAction SilentlyContinue
    if ($vol) {
        $img = Get-DiskImage -DevicePath $vol.Path -ErrorAction SilentlyContinue
        if ($img) {
            Dismount-DiskImage -DevicePath $vol.Path -ErrorAction SilentlyContinue
        }
    }
} catch {}

# 2. Shell COM: Direct folder item
try {
    $sh = New-Object -ComObject Shell.Application
    $driveFolder = $sh.NameSpace($drivePath)
    if ($driveFolder -and $driveFolder.Self) {
        $item = $driveFolder.Self
        $executed = $false
        foreach ($verb in $item.Verbs()) {
            $vName = $verb.Name.Replace('&', '').Trim()
            if ($vName -match '^(Eject|Вилучити|Витягнути|Извлечь|Wysuń|Auswerfen|Éjecter)') {
                $verb.DoIt()
                $executed = $true
                break
            }
        }
        if (-not $executed) {
            $item.InvokeVerb('Eject')
        }
    }
} catch {}

# 3. Shell COM: Search in 'This PC' (Namespace 17)
try {
    $sh = New-Object -ComObject Shell.Application
    $pc = $sh.Namespace(17)
    if ($pc) {
        foreach ($item in $pc.Items()) {
            $p = $item.Path
            $n = $item.Name
            if ($p -eq $drivePath -or $p -like ($target + ':*') -or $n -like ('*(' + $target + ':)*') -or $n -like ('*' + $target + ':*')) {
                foreach ($verb in $item.Verbs()) {
                    $vName = $verb.Name.Replace('&', '').Trim()
                    if ($vName -match '^(Eject|Вилучити|Витягнути|Извлечь|Wysuń|Auswerfen|Éjecter)') {
                        $verb.DoIt()
                        break
                    }
                }
                $item.InvokeVerb('Eject')
                break
            }
        }
    }
} catch {}

# 4. Fallback mountvol dismount
try {
    & mountvol.exe ($target + ':') /p 2>$null
} catch {}

Start-Sleep -Milliseconds 800
Write-Output "DONE"
`
      await runPowerShell(ejectScript)

      // Poll up to 3.5 seconds to confirm the drive is actually dismounted
      let dismounted = false
      for (let i = 0; i < 7; i++) {
        if (!fs.existsSync(drivePath)) {
          dismounted = true
          break
        }
        await new Promise((r) => setTimeout(r, 500))
      }

      if (dismounted) {
        driveInfoCache.delete(letter)
        const win = getMainWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('drives:changed')
        }
        return { success: true }
      } else {
        return {
          success: false,
          error: `Диск (${letter}:) зайнятий іншою програмою або системою Windows. Будь ласка, закрийте відкриті файли і спробуйте знову.`,
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка при вилученні носія' }
    }
  })

  // Calculate Directory Size
  ipcMain.handle('fs:getDirSize', async (_, dirPath: string) => {
    try {
      let totalSize = 0
      let totalCount = 0

      async function scan(current: string, depth = 0) {
        if (depth > 18) return
        let entries
        try {
          entries = await fsPromises.readdir(current, { withFileTypes: true })
        } catch {
          return
        }
        for (const e of entries) {
          const subPath = path.join(current, e.name)
          if (e.isDirectory()) {
            if (e.isSymbolicLink()) continue
            await scan(subPath, depth + 1)
          } else {
            try {
              const st = await fsPromises.stat(subPath)
              totalSize += st.size
              totalCount++
            } catch {}
          }
        }
      }

      await scan(dirPath)
      return { success: true, size: totalSize, count: totalCount }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Analyze Folder & Subfolders Sizes (Folder Size Modal)
  ipcMain.handle('fs:analyzeFolderSizes', async (_, targetPath: string) => {
    try {
      if (!fs.existsSync(targetPath)) {
        return { success: false, error: 'Папка не існує' }
      }

      const stat = await fsPromises.stat(targetPath)
      if (!stat.isDirectory()) {
        return { success: false, error: 'Вказаний шлях не є папкою' }
      }

      const entries = await fsPromises.readdir(targetPath, { withFileTypes: true })
      const subdirs = entries.filter((e) => e.isDirectory() && !e.isSymbolicLink())

      const foldersToScan: { name: string; path: string }[] = []
      for (const d of subdirs) {
        foldersToScan.push({
          name: d.name,
          path: path.join(targetPath, d.name),
        })
      }

      if (foldersToScan.length === 0) {
        foldersToScan.push({
          name: path.basename(targetPath) || targetPath,
          path: targetPath,
        })
      }

      const results: Array<{
        name: string
        path: string
        size: number
        fileCount: number
        dirCount: number
      }> = []

      let grandTotalSize = 0
      let grandTotalFiles = 0

      for (const f of foldersToScan) {
        let fSize = 0
        let fFiles = 0
        let fDirs = 0

        async function walk(cur: string, depth = 0) {
          if (depth > 18) return
          let subEntries
          try {
            subEntries = await fsPromises.readdir(cur, { withFileTypes: true })
          } catch {
            return
          }
          for (const se of subEntries) {
            if (se.isDirectory()) {
              if (se.isSymbolicLink()) continue
              fDirs++
              await walk(path.join(cur, se.name), depth + 1)
            } else if (se.isFile()) {
              try {
                const s = await fsPromises.stat(path.join(cur, se.name))
                fSize += s.size
                fFiles++
              } catch {}
            }
          }
        }

        await walk(f.path)
        results.push({
          name: f.name,
          path: f.path,
          size: fSize,
          fileCount: fFiles,
          dirCount: fDirs,
        })
        grandTotalSize += fSize
        grandTotalFiles += fFiles
      }

      if (/^[a-zA-Z]:[/\\]?$/.test(targetPath)) {
        const locked = getWindowsLockedFiles(targetPath)
        for (const lf of locked) {
          results.push({
            name: `${lf.name} (системний файл Windows)`,
            path: lf.path,
            size: lf.size,
            fileCount: 1,
            dirCount: 0,
          })
          grandTotalSize += lf.size
          grandTotalFiles += 1
        }
      }

      results.sort((a, b) => b.size - a.size)

      return {
        success: true,
        parentPath: targetPath,
        folders: results,
        totalSize: grandTotalSize,
        totalFiles: grandTotalFiles,
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Помилка аналізу розміру папок' }
    }
  })

  // Find Large Files (Disk Space Analyzer / Cleanup)
  ipcMain.handle(
    'fs:findLargeFiles',
    async (
      _,
      options: {
        targetDir: string
        minSizeBytes: number
        limit?: number
      }
    ) => {
      try {
        const { targetDir, minSizeBytes = 50 * 1024 * 1024, limit = 200 } = options
        if (!targetDir || !fs.existsSync(targetDir)) {
          return { success: false, error: 'Директорія або диск не існує' }
        }

        const largeFiles: Array<{
          path: string
          name: string
          size: number
          mtime: number
          extension: string
          dir: string
        }> = []

        let scannedCount = 0
        let totalSize = 0

        const isDriveRoot = /^[a-zA-Z]:[/\\]?$/.test(targetDir)
        if (isDriveRoot) {
          const locked = getWindowsLockedFiles(targetDir)
          for (const lf of locked) {
            if (lf.size >= minSizeBytes) {
              totalSize += lf.size
              largeFiles.push(lf)
            }
          }
        }

        const skipNames = new Set([
          '$recycle.bin',
          'system volume information',
          'recovery',
          'msocache',
          'winsxs',
          'assembly',
          'node_modules',
        ])

        const queue: { dir: string; depth: number }[] = [{ dir: targetDir, depth: 0 }]

        while (queue.length > 0 && scannedCount < 600000) {
          const current = queue.shift()!
          if (current.depth > 14) continue

          let entries: fs.Dirent[]
          try {
            entries = await fsPromises.readdir(current.dir, { withFileTypes: true })
          } catch {
            continue
          }

          if (current.depth === 0) {
            entries.sort((a, b) => {
              const aName = a.name.toLowerCase()
              const bName = b.name.toLowerCase()
              if (aName === 'users') return -1
              if (bName === 'users') return 1
              if (aName.includes('program')) return -1
              if (bName.includes('program')) return 1
              if (aName.includes('games') || aName.includes('xbox')) return -1
              if (bName.includes('games') || bName.includes('xbox')) return 1
              if (aName === 'windows') return 1
              if (bName === 'windows') return -1
              return 0
            })
          }

          for (const entry of entries) {
            scannedCount++
            const lowerName = entry.name.toLowerCase()

            if (entry.isDirectory()) {
              if (skipNames.has(lowerName)) continue
              if (entry.isSymbolicLink()) continue
              if (current.dir.toLowerCase().includes('\\windows') && current.depth >= 3) continue
              queue.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 })
            } else if (entry.isFile()) {
              try {
                const fullPath = path.join(current.dir, entry.name)
                const st = await fsPromises.stat(fullPath)
                if (st.size >= minSizeBytes) {
                  totalSize += st.size
                  largeFiles.push({
                    path: fullPath,
                    name: entry.name,
                    size: st.size,
                    mtime: st.mtimeMs,
                    extension: path.extname(entry.name).replace(/^\./, '').toLowerCase(),
                    dir: current.dir,
                  })
                }
              } catch {}
            }
          }
        }

        largeFiles.sort((a, b) => b.size - a.size)

        const resultFiles = limit > 0 ? largeFiles.slice(0, limit) : largeFiles
        return {
          success: true,
          files: resultFiles,
          totalSize,
          scannedCount,
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Помилка сканування великих файлів' }
      }
    }
  )

  // File Search (Total Commander Alt+F7)
  ipcMain.handle('fs:search', async (_, dirPath: string, query: string, recursive = true, contentSearch?: string) => {
    try {
      const results: any[] = []
      const lowerQuery = query.toLowerCase()
      const maxResults = 300

      async function searchDir(current: string, depth = 0) {
        if (results.length >= maxResults) return
        if (depth > 8) return

        let entries
        try {
          entries = await fsPromises.readdir(current, { withFileTypes: true })
        } catch {
          return
        }

        for (const entry of entries) {
          if (results.length >= maxResults) break
          const fullPath = path.join(current, entry.name)
          const nameMatches = !query || entry.name.toLowerCase().includes(lowerQuery)

          let contentMatchLine: string | undefined

          if (contentSearch && entry.isFile()) {
            try {
              const fileContent = await fsPromises.readFile(fullPath, 'utf8')
              const lines = fileContent.split(/\r?\n/)
              const foundLine = lines.find((l) => l.toLowerCase().includes(contentSearch.toLowerCase()))
              if (foundLine) {
                contentMatchLine = foundLine.trim().slice(0, 100)
              } else {
                continue
              }
            } catch {
              continue
            }
          }

          if (nameMatches || contentMatchLine) {
            let size = 0
            try {
              if (entry.isFile()) {
                const st = await fsPromises.lstat(fullPath)
                size = st.size
              }
            } catch {}

            results.push({
              name: entry.name,
              path: fullPath,
              isDirectory: entry.isDirectory(),
              size,
              matchLine: contentMatchLine,
            })
          }

          if (recursive && entry.isDirectory() && !entry.name.startsWith('.')) {
            await searchDir(fullPath, depth + 1)
          }
        }
      }

      await searchDir(dirPath)
      return { success: true, results }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
