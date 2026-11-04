import { ipcMain, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { exec } from 'child_process'
import { isProtectedSystemFile } from './disk'
import { extractAppIcon, resolveAliasInfo } from './icons'

function safeHandle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener)
}

export function formatPermissions(mode: number, isDirectory: boolean): string {
  const type = isDirectory ? 'd' : '-'
  const perms = [
    mode & 0o400 ? 'r' : '-',
    mode & 0o200 ? 'w' : '-',
    mode & 0o100 ? 'x' : '-',
    mode & 0o040 ? 'r' : '-',
    mode & 0o020 ? 'w' : '-',
    mode & 0o010 ? 'x' : '-',
    mode & 0o004 ? 'r' : '-',
    mode & 0o002 ? 'w' : '-',
    mode & 0o001 ? 'x' : '-',
  ].join('')
  return type + perms
}

export async function getAppIcon(appPath: string): Promise<string | undefined> {
  return extractAppIcon(appPath)
}

export function setupFileSystemIpc() {
  // Read Directory (with macOS transparent aggregation of /System/Applications and /System/Applications/Utilities)
  safeHandle('fs:readDir', async (_, dirPath: string, showHidden = false) => {
    try {
      const resolvedPath = path.resolve(dirPath)
      const scanDirs = [resolvedPath]

      // Transparently aggregate macOS native system applications into /Applications and Utilities
      if (process.platform === 'darwin') {
        if (resolvedPath === '/Applications' && fs.existsSync('/System/Applications')) {
          scanDirs.push('/System/Applications')
        } else if (
          (resolvedPath === '/Applications/Utilities' || resolvedPath === '/System/Applications/Utilities') &&
          fs.existsSync('/System/Applications/Utilities')
        ) {
          if (!scanDirs.includes('/System/Applications/Utilities')) {
            scanDirs.push('/System/Applications/Utilities')
          }
        }
      }

      const items: any[] = []
      const seenNames = new Set<string>()

      for (const currentDir of scanDirs) {
        let entries: fs.Dirent[] = []
        try {
          entries = await fsPromises.readdir(currentDir, { withFileTypes: true })
        } catch {
          continue
        }

        for (const entry of entries) {
          const isHidden = entry.name.startsWith('.')
          if (isHidden && !showHidden) {
            continue
          }

          if (seenNames.has(entry.name)) {
            continue
          }
          seenNames.add(entry.name)

          const itemPath = path.join(currentDir, entry.name)
          let isApp = entry.name.endsWith('.app')
          let isAlias = false
          let aliasTarget: string | undefined = undefined

          try {
            const stats = await fsPromises.lstat(itemPath)
            let isDir = stats.isDirectory()

            const aliasInfo = resolveAliasInfo(itemPath, stats)
            if (aliasInfo) {
              isAlias = true
              aliasTarget = aliasInfo.target
              if (aliasInfo.isApp) {
                isApp = true
              }
              if (aliasInfo.isDir) {
                isDir = true
              }
            }

            const ext = isAlias
              ? 'lnk'
              : isApp
                ? 'app'
                : isDir
                  ? ''
                  : path.extname(entry.name).toLowerCase().replace('.', '')

            items.push({
              name: entry.name,
              path: itemPath,
              isDirectory: isDir,
              isFile: stats.isFile(),
              isSymlink: stats.isSymbolicLink() || isAlias,
              isApp,
              isAlias,
              aliasTarget,
              size: isDir && !isAlias ? 0 : stats.size,
              mtime: stats.mtimeMs,
              birthtime: stats.birthtimeMs,
              mode: stats.mode,
              permissions: formatPermissions(stats.mode, isDir),
              extension: ext,
              isHidden,
            })
          } catch {
            // If stat fails (e.g. broken symlink or protected system file)
            items.push({
              name: entry.name,
              path: itemPath,
              isDirectory: entry.isDirectory(),
              isFile: entry.isFile(),
              isSymlink: entry.isSymbolicLink(),
              isApp,
              isAlias: false,
              size: 0,
              mtime: 0,
              birthtime: 0,
              mode: 0,
              permissions: entry.isDirectory() ? 'drwxr-xr-x' : '-rw-r--r--',
              extension: isApp ? 'app' : path.extname(entry.name).toLowerCase(),
              isHidden,
            })
          }
        }
      }

      // Extract native macOS icons for all application bundles (.app) and application aliases
      const appItems = items.filter((i) => i.isApp || (i.isAlias && i.aliasTarget?.endsWith('.app')))
      if (appItems.length > 0) {
        await Promise.all(
          appItems.map(async (item: any) => {
            const target = item.isAlias && item.aliasTarget ? item.aliasTarget : item.path
            item.appIcon = await getAppIcon(target)
          })
        )
      }

      return { success: true, data: items }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to read directory' }
    }
  })

  // Create Folder
  safeHandle('fs:createFolder', async (_, targetPath: string) => {
    try {
      await fsPromises.mkdir(targetPath, { recursive: true })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Create File
  safeHandle('fs:createFile', async (_, targetPath: string) => {
    try {
      await fsPromises.writeFile(targetPath, '', { flag: 'wx' })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Delete Paths (Move to Trash by default, or permanent with fallback)
  safeHandle('fs:deletePaths', async (_, paths: string[], moveToTrash = true) => {
    try {
      for (const itemPath of paths) {
        const base = path.basename(itemPath)
        if (isProtectedSystemFile(base, itemPath)) {
          return {
            success: false,
            error: `Захищений системний файл або віртуальний диск: "${base}" не можна видаляти`,
          }
        }
        if (moveToTrash) {
          try {
            await shell.trashItem(itemPath)
          } catch {
            // Fallback to permanent removal if macOS Trash rejects path (e.g. external volumes or protected temp)
            await fsPromises.rm(itemPath, { recursive: true, force: true })
          }
        } else {
          await fsPromises.rm(itemPath, { recursive: true, force: true })
        }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Copy Paths
  safeHandle('fs:copyPaths', async (_, sources: string[], destinationDir: string) => {
    try {
      for (const src of sources) {
        const baseName = path.basename(src)
        const dest = path.join(destinationDir, baseName)
        if (src === dest) {
          // If copying to same directory, create copy name: filename - Copy.ext
          const ext = path.extname(baseName)
          const nameWithoutExt = path.basename(baseName, ext)
          const copyDest = path.join(destinationDir, `${nameWithoutExt} - Copy${ext}`)
          await fsPromises.cp(src, copyDest, { recursive: true })
        } else {
          await fsPromises.cp(src, dest, { recursive: true })
        }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Move Paths
  safeHandle('fs:movePaths', async (_, sources: string[], destinationDir: string) => {
    try {
      for (const src of sources) {
        const baseName = path.basename(src)
        const dest = path.join(destinationDir, baseName)
        if (src === dest) continue

        try {
          await fsPromises.rename(src, dest)
        } catch (renameErr: any) {
          // EXDEV fallback for cross-filesystem moves
          if (renameErr.code === 'EXDEV') {
            await fsPromises.cp(src, dest, { recursive: true })
            await fsPromises.rm(src, { recursive: true, force: true })
          } else {
            throw renameErr
          }
        }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Rename Single Path
  safeHandle('fs:renamePath', async (_, oldPath: string, newPath: string) => {
    try {
      await fsPromises.rename(oldPath, newPath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Read File Content (for F3 Viewer and F4 Editor)
  safeHandle('fs:readFile', async (_, filePath: string, maxBytes = 2 * 1024 * 1024) => {
    try {
      const stats = await fsPromises.stat(filePath)
      if (stats.size > maxBytes) {
        return {
          success: false,
          error: `File is too large to display directly (${(stats.size / (1024 * 1024)).toFixed(1)} MB). Limit is 2 MB.`,
        }
      }

      const buffer = await fsPromises.readFile(filePath)
      // Check if binary (null bytes test)
      let isBinary = false
      const checkLength = Math.min(buffer.length, 1024)
      for (let i = 0; i < checkLength; i++) {
        if (buffer[i] === 0) {
          isBinary = true
          break
        }
      }

      if (isBinary) {
        return {
          success: true,
          isBinary: true,
          content: buffer.toString('base64'),
        }
      }

      return {
        success: true,
        isBinary: false,
        content: buffer.toString('utf-8'),
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Write File Content (for F4 Editor)
  safeHandle('fs:writeFile', async (_, filePath: string, content: string) => {
    try {
      await fsPromises.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Open with system default app
  safeHandle('fs:openPath', async (_, filePath: string) => {
    try {
      const result = await shell.openPath(filePath)
      if (result) {
        return { success: false, error: result }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Show file in native macOS Finder
  safeHandle('fs:showInFolder', async (_, targetPath: string) => {
    try {
      shell.showItemInFolder(targetPath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Open Directory in macOS Terminal
  safeHandle('fs:openInTerminal', async (_, dirPath: string) => {
    try {
      exec(`open -a Terminal "${dirPath}"`, (err) => {
        if (err) console.error('Failed to open Terminal:', err)
      })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // macOS QuickLook (`qlmanage -p`)
  safeHandle('fs:quickLook', async (_, filePath: string) => {
    try {
      exec(`qlmanage -p "${filePath}" >/dev/null 2>&1 &`)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // File Search (Total Commander Alt+F7)
  safeHandle('fs:search', async (_, dirPath: string, query: string, recursive = true, contentSearch?: string) => {
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
              const lines = fileContent.split('\n')
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
