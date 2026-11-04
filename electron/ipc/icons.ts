import { app, ipcMain } from 'electron'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'

// Extensions with embedded unique icons per file on macOS
const UNIQUE_ICON_EXTENSIONS = new Set(['app', 'dmg', 'pkg', 'iconset', 'prefPane', 'kext', 'plugin'])

// In-memory cache for shared file extension icons
const extensionIconCache = new Map<string, string>()

// In-memory cache for application bundle (.app) icons
const appIconCache = new Map<string, string>()

// Cache for specific files (with size limit)
const pathIconCache = new Map<string, string>()
const MAX_PATH_CACHE = 2000

function setPathCache(key: string, val: string): void {
  if (pathIconCache.size >= MAX_PATH_CACHE) {
    const firstKey = pathIconCache.keys().next().value
    if (firstKey) pathIconCache.delete(firstKey)
  }
  pathIconCache.set(key, val)
}

/**
 * Extracts authentic branded macOS icon for .app bundles by reading
 * embedded PNG chunks from .icns, running sips for legacy icns, or
 * locating direct bundle PNG icons.
 */
export async function extractAppIcon(appPath: string): Promise<string | undefined> {
  if (!appPath) return undefined
  if (appIconCache.has(appPath)) {
    return appIconCache.get(appPath)
  }

  try {
    let targetBundle = appPath
    const wrapped = path.join(appPath, 'WrappedBundle')
    if (fs.existsSync(wrapped)) {
      try {
        const real = fs.realpathSync(wrapped)
        if (fs.existsSync(real)) targetBundle = real
      } catch {}
    } else {
      const wrapperDir = path.join(appPath, 'Wrapper')
      if (fs.existsSync(wrapperDir)) {
        try {
          const sub = fs.readdirSync(wrapperDir).find((f) => f.endsWith('.app'))
          if (sub) targetBundle = path.join(wrapperDir, sub)
        } catch {}
      }
    }

    // 1. Look for Info.plist CFBundleIconFile or CFBundleIconName
    let icnsPath: string | null = null
    const plistPath = path.join(targetBundle, 'Contents', 'Info.plist')
    const altPlistPath = path.join(targetBundle, 'Info.plist')
    const activePlist = fs.existsSync(plistPath) ? plistPath : fs.existsSync(altPlistPath) ? altPlistPath : null

    if (activePlist) {
      try {
        const content = fs.readFileSync(activePlist, 'utf8')
        const match =
          content.match(/<key>CFBundleIconFile<\/key>\s*<string>([^<]+)<\/string>/i) ||
          content.match(/<key>CFBundleIconName<\/key>\s*<string>([^<]+)<\/string>/i)
        if (match) {
          let iconFile = match[1].trim()
          if (!iconFile.endsWith('.icns')) iconFile += '.icns'
          const res1 = path.join(targetBundle, 'Contents', 'Resources', iconFile)
          const res2 = path.join(targetBundle, iconFile)
          if (fs.existsSync(res1)) icnsPath = res1
          else if (fs.existsSync(res2)) icnsPath = res2
        }
      } catch {}
    }

    // 2. Check Resources directory for any .icns file
    if (!icnsPath) {
      const resDir = path.join(targetBundle, 'Contents', 'Resources')
      if (fs.existsSync(resDir)) {
        try {
          const files = fs.readdirSync(resDir)
          const icns = files.find((f) => f.endsWith('.icns'))
          if (icns) icnsPath = path.join(resDir, icns)
        } catch {}
      }
    }

    // 3. Extract embedded PNG chunks from .icns
    if (icnsPath && fs.existsSync(icnsPath)) {
      const data = fs.readFileSync(icnsPath)
      if (data.length > 8 && data.toString('latin1', 0, 4) === 'icns') {
        let pos = 8
        const pngChunks: Record<string, Buffer> = {}
        const preferred = ['ic11', 'icp5', 'ic12', 'ic07', 'ic08', 'ic13', 'ic14']
        const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

        while (pos + 8 <= data.length) {
          const tag = data.toString('latin1', pos, pos + 4)
          const length = data.readUInt32BE(pos + 4)
          if (length <= 8 || pos + length > data.length) break

          const chunk = data.subarray(pos + 8, pos + length)
          if (chunk.length > 8 && chunk.subarray(0, 8).equals(pngHeader)) {
            pngChunks[tag] = chunk
          }
          pos += length
        }

        for (const p of preferred) {
          if (pngChunks[p]) {
            const dataUrl = 'data:image/png;base64,' + pngChunks[p].toString('base64')
            appIconCache.set(appPath, dataUrl)
            return dataUrl
          }
        }
        const firstKey = Object.keys(pngChunks)[0]
        if (firstKey) {
          const dataUrl = 'data:image/png;base64,' + pngChunks[firstKey].toString('base64')
          appIconCache.set(appPath, dataUrl)
          return dataUrl
        }
      }

      // Fallback sips for older ICNS without raw PNG chunks (e.g. Caffeine.app)
      const tmpPng = path.join(os.tmpdir(), `tc_app_${Date.now()}_${Math.random().toString(36).slice(2)}.png`)
      const sipsRes = await new Promise<string | null>((resolve) => {
        execFile('/usr/bin/sips', ['-s', 'format', 'png', '-Z', '32', icnsPath!, '--out', tmpPng], (err) => {
          if (!err && fs.existsSync(tmpPng)) {
            try {
              const buf = fs.readFileSync(tmpPng)
              fs.unlinkSync(tmpPng)
              return resolve('data:image/png;base64,' + buf.toString('base64'))
            } catch {}
          }
          resolve(null)
        })
      })
      if (sipsRes) {
        appIconCache.set(appPath, sipsRes)
        return sipsRes
      }
    }

    // 4. Direct icon PNG for iOS / Catalyst bundles (e.g. LumaFusion)
    try {
      const bundleFiles = fs.readdirSync(targetBundle)
      const iconPng = bundleFiles.find((f) => /icon.*\.png$/i.test(f) && !f.includes('splash'))
      if (iconPng) {
        const fullIconPath = path.join(targetBundle, iconPng)
        const buf = fs.readFileSync(fullIconPath)
        const dataUrl = 'data:image/png;base64,' + buf.toString('base64')
        appIconCache.set(appPath, dataUrl)
        return dataUrl
      }
    } catch {}
  } catch {}

  // 5. Final fallback to Electron app.getFileIcon
  try {
    const fallback = await app.getFileIcon(appPath, { size: 'small' }).catch(() => null)
    if (fallback && !fallback.isEmpty()) {
      const dataUrl = fallback.toDataURL()
      appIconCache.set(appPath, dataUrl)
      return dataUrl
    }
  } catch {}

  return undefined
}

/**
 * Resolves macOS Finder Alias files (CFURL bookmarks) and POSIX symlinks.
 */
export function resolveAliasInfo(
  itemPath: string,
  stats?: fs.Stats | { isSymbolicLink: () => boolean; isFile: () => boolean; isDirectory: () => boolean; size: number }
): { isAlias: boolean; target: string; isApp: boolean; isDir: boolean } | null {
  try {
    const st = stats || fs.lstatSync(itemPath)
    if (st.isSymbolicLink()) {
      const real = fs.realpathSync(itemPath)
      if (fs.existsSync(real)) {
        const targetStat = fs.statSync(real)
        return {
          isAlias: true,
          target: real,
          isApp: real.endsWith('.app'),
          isDir: targetStat.isDirectory(),
        }
      }
    }
    if (st.isFile() && st.size > 0 && st.size < 65536) {
      let isBookmark = false
      const fd = fs.openSync(itemPath, 'r')
      const head = Buffer.alloc(16)
      fs.readSync(fd, head, 0, 16, 0)
      fs.closeSync(fd)

      if (head.subarray(0, 4).toString() === 'book' && head.subarray(8, 12).toString() === 'mark') {
        isBookmark = true
      }

      if (isBookmark) {
        const buf = fs.readFileSync(itemPath)
        const str = buf.toString('utf8')
        const m = str.match(/file:\/\/\/([a-zA-Z0-9_\-./%~+]+)/)
        if (m) {
          const raw = '/' + decodeURI(m[1]).replace(/\/+$/, '')
          if (fs.existsSync(raw)) {
            const targetStat = fs.statSync(raw)
            return {
              isAlias: true,
              target: raw,
              isApp: raw.endsWith('.app'),
              isDir: targetStat.isDirectory(),
            }
          }
        }
      }
    }
  } catch {}
  return null
}

function safeHandle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener)
}

export function registerIconsIpc(): void {
  // Get single file icon
  safeHandle('fs:getFileIcon', async (_, filePath: string) => {
    try {
      if (!filePath) return null
      const cached = pathIconCache.get(filePath)
      if (cached) return cached

      const aliasInfo = resolveAliasInfo(filePath)
      const targetPath = aliasInfo?.target || filePath

      if (targetPath.endsWith('.app')) {
        const appIcon = await extractAppIcon(targetPath)
        if (appIcon) {
          setPathCache(filePath, appIcon)
          return appIcon
        }
      }

      const icon = await app.getFileIcon(targetPath, { size: 'small' })
      if (icon) {
        const dataUrl = icon.toDataURL()
        setPathCache(filePath, dataUrl)
        return dataUrl
      }
    } catch {}
    return null
  })

  // Get batch of icons for items in a directory
  safeHandle(
    'fs:getFileIcons',
    async (_, items: Array<{ path: string; name?: string; isDirectory: boolean; extension: string }>) => {
      const result: Record<string, string> = {}
      if (!Array.isArray(items) || items.length === 0) {
        return result
      }

      const toFetch: Array<{
        key: string
        itemPath: string
        isExtCache: boolean
        isApp: boolean
        extKey?: string
      }> = []

      for (const it of items) {
        if (!it.path) continue
        const isApp = (it as any).isApp || it.name?.endsWith('.app') || it.extension === 'app'
        const isAlias = (it as any).isAlias || it.extension === 'lnk'
        const targetPath = (it as any).aliasTarget || it.path

        if (it.isDirectory && !isApp && !isAlias) continue

        const ext = (it.extension || '').toLowerCase()
        const isUnique = isApp || isAlias || !ext || UNIQUE_ICON_EXTENSIONS.has(ext)

        if (isUnique) {
          const cached =
            isApp || isAlias
              ? appIconCache.get(targetPath) || pathIconCache.get(it.path)
              : pathIconCache.get(it.path)
          if (cached) {
            result[it.path] = cached
          } else {
            toFetch.push({
              key: it.path,
              itemPath: targetPath,
              isExtCache: false,
              isApp: isApp || (targetPath.endsWith('.app') ?? false),
            })
          }
        } else {
          const extKey = `ext:${ext}`
          const cached = extensionIconCache.get(extKey)
          if (cached) {
            result[it.path] = cached
          } else {
            const alreadyQueued = toFetch.find((q) => q.extKey === extKey)
            if (!alreadyQueued) {
              toFetch.push({
                key: it.path,
                itemPath: targetPath,
                isExtCache: true,
                isApp: false,
                extKey,
              })
            }
          }
        }
      }

      if (toFetch.length > 0) {
        await Promise.all(
          toFetch.map(async (task) => {
            try {
              if (task.isApp) {
                const appIcon = await extractAppIcon(task.itemPath)
                if (appIcon) {
                  result[task.key] = appIcon
                  setPathCache(task.key, appIcon)
                  return
                }
              }

              const icon = await app.getFileIcon(task.itemPath, { size: 'small' })
              if (icon) {
                const dataUrl = icon.toDataURL()
                result[task.key] = dataUrl

                if (task.isExtCache && task.extKey) {
                  extensionIconCache.set(task.extKey, dataUrl)
                  for (const it of items) {
                    if (!it.isDirectory && (it.extension || '').toLowerCase() === task.extKey.slice(4)) {
                      result[it.path] = dataUrl
                    }
                  }
                } else {
                  setPathCache(task.key, dataUrl)
                }
              }
            } catch {}
          })
        )
      }

      return result
    }
  )

  // Resolve macOS symlinks / aliases
  ipcMain.handle('fs:resolveShortcut', async (_, filePath: string) => {
    try {
      if (!filePath) return null
      const aliasInfo = resolveAliasInfo(filePath)
      if (aliasInfo) {
        return {
          target: aliasInfo.target,
          isDirectory: aliasInfo.isDir,
          description: path.basename(aliasInfo.target),
        }
      }
      const real = await fsPromises.realpath(filePath)
      const st = await fsPromises.stat(real)
      return {
        target: real,
        isDirectory: st.isDirectory(),
        description: path.basename(real),
      }
    } catch {}
    return null
  })
}

