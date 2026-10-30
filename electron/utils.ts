import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { exec, execSync } from 'child_process'

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

export function runPowerShell(script: string): Promise<{ stdout: string; stderr: string; error?: string }> {
  return new Promise((resolve) => {
    const defaultPs = path.join(
      process.env.SystemRoot || 'C:\\Windows',
      'System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    )
    const psExe = fs.existsSync(defaultPs) ? `"${defaultPs}"` : 'powershell.exe'
    const buffer = Buffer.from(script, 'utf16le')
    const base64Script = buffer.toString('base64')
    const cmd = `${psExe} -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${base64Script}`

    exec(cmd, { windowsHide: true, timeout: 8000 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || (error ? error.message : ''),
        error: error ? error.message : undefined,
      })
    })
  })
}

export function getAppIcon(): string | undefined {
  const possiblePaths = [
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, '../public/icon.ico'),
    path.join(process.env.DIST || '', 'icon.ico'),
    path.join(__dirname, 'icon.ico'),
    path.join(process.resourcesPath || '', 'build/icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico'),
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p
  }
  return undefined
}

export function get7zPath(): string | null {
  const possiblePaths = [
    path.join(__dirname, '../bin/7za.exe'),
    path.join(process.resourcesPath || '', 'bin/7za.exe'),
    path.join(process.resourcesPath || '', '7za.exe'),
    path.join(__dirname, '7za.exe'),
    path.join(process.cwd(), 'bin/7za.exe'),
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe',
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p
  }
  return null
}

export function getRarPath(): string | null {
  const possiblePaths = [
    path.join(__dirname, '../bin/rar.exe'),
    path.join(process.resourcesPath || '', 'bin/rar.exe'),
    path.join(process.resourcesPath || '', 'rar.exe'),
    path.join(process.cwd(), 'bin/rar.exe'),
    'C:\\Program Files\\WinRAR\\rar.exe',
    'C:\\Program Files (x86)\\WinRAR\\rar.exe',
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'WinRAR', 'rar.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'WinRAR', 'rar.exe'),
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p
  }
  return null
}

export function getUnrarPath(): string | null {
  const possiblePaths = [
    path.join(__dirname, '../bin/unrar.exe'),
    path.join(process.resourcesPath || '', 'bin/unrar.exe'),
    path.join(process.resourcesPath || '', 'unrar.exe'),
    path.join(process.cwd(), 'bin/unrar.exe'),
    'C:\\Program Files\\WinRAR\\UnRAR.exe',
    'C:\\Program Files (x86)\\WinRAR\\UnRAR.exe',
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'WinRAR', 'UnRAR.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'WinRAR', 'UnRAR.exe'),
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p
  }
  return null
}

export function getWindowsLockedFiles(driveRoot: string): Array<{
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

export async function safeEnsureDir(dirPath: string): Promise<void> {
  if (!dirPath) return
  const clean = dirPath.trim()
  if (/^[a-zA-Z]:[/\\]?$/.test(clean) || clean === '/' || clean === '\\') return
  if (!fs.existsSync(clean)) {
    try {
      await fsPromises.mkdir(clean, { recursive: true })
    } catch (e: any) {
      if (e.code !== 'EEXIST') throw e
    }
  }
}
