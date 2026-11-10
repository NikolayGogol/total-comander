import { execFile } from 'child_process'

/**
 * Move file to Trash via AppleScript Finder integration.
 * Finder natively handles files in /Applications and system permissions.
 */
export function trashViaFinder(itemPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const escaped = itemPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const script = `tell application "Finder" to delete POSIX file "${escaped}"`
    execFile('/usr/bin/osascript', ['-e', script], (err) => {
      resolve(!err)
    })
  })
}

/**
 * Execute elevated deletion using macOS SecurityAgent authorization dialog.
 * Prompts user for Touch ID, Apple Watch, or administrator password.
 */
export function runPrivilegedRm(paths: string[]): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!paths || paths.length === 0) return resolve({ success: true })

    const quotedParts = paths
      .map((p) => `quoted form of "${p.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
      .join(' & " " & ')

    const script = `do shell script "chflags -R nouchg,noschg " & ${quotedParts} & " 2>/dev/null; rm -rf " & ${quotedParts} with administrator privileges`

    execFile('/usr/bin/osascript', ['-e', script], (err, _stdout, stderr) => {
      if (!err) {
        return resolve({ success: true })
      }
      const msg = (stderr || err.message || '').trim()
      if (msg.includes('-128') || msg.includes('User canceled')) {
        return resolve({ success: false, error: 'Скасовано користувачем (не підтверджено Touch ID або пароль)' })
      }
      return resolve({ success: false, error: msg || 'Помилка видалення з правами адміністратора' })
    })
  })
}

/**
 * Privileged move to Trash using macOS SecurityAgent authorization dialog.
 * Falls back to privileged rm if move to ~/.Trash fails.
 */
export function trashPrivileged(paths: string[]): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!paths || paths.length === 0) return resolve({ success: true })

    const quotedParts = paths
      .map((p) => `quoted form of "${p.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
      .join(' & " " & ')

    const script = `do shell script "mv -f " & ${quotedParts} & " \\"$HOME/.Trash/\\" 2>/dev/null" with administrator privileges`

    execFile('/usr/bin/osascript', ['-e', script], async (err, _stdout, stderr) => {
      if (!err) {
        return resolve({ success: true })
      }
      const msg = (stderr || err.message || '').trim()
      if (msg.includes('-128') || msg.includes('User canceled')) {
        return resolve({ success: false, error: 'Скасовано користувачем (не підтверджено Touch ID або пароль)' })
      }
      const rmResult = await runPrivilegedRm(paths)
      resolve(rmResult)
    })
  })
}

/**
 * Privileged move using macOS SecurityAgent authorization dialog.
 */
export function runPrivilegedMove(src: string, dest: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const qSrc = `quoted form of "${src.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    const qDest = `quoted form of "${dest.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    const script = `do shell script "mv -f " & ${qSrc} & " " & ${qDest} with administrator privileges`

    execFile('/usr/bin/osascript', ['-e', script], (err, _stdout, stderr) => {
      if (!err) return resolve({ success: true })
      const msg = (stderr || err.message || '').trim()
      if (msg.includes('-128') || msg.includes('User canceled')) {
        return resolve({ success: false, error: 'Скасовано користувачем' })
      }
      return resolve({ success: false, error: msg || 'Помилка переміщення з правами адміністратора' })
    })
  })
}

/**
 * Privileged mkdir using macOS SecurityAgent authorization dialog.
 */
export function runPrivilegedMkdir(targetPath: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const qTarget = `quoted form of "${targetPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    const script = `do shell script "mkdir -p " & ${qTarget} with administrator privileges`

    execFile('/usr/bin/osascript', ['-e', script], (err, _stdout, stderr) => {
      if (!err) return resolve({ success: true })
      const msg = (stderr || err.message || '').trim()
      if (msg.includes('-128') || msg.includes('User canceled')) {
        return resolve({ success: false, error: 'Скасовано користувачем' })
      }
      return resolve({ success: false, error: msg || 'Помилка створення папки з правами адміністратора' })
    })
  })
}

/**
 * Privileged touch using macOS SecurityAgent authorization dialog.
 */
export function runPrivilegedTouch(targetPath: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const qTarget = `quoted form of "${targetPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    const script = `do shell script "touch " & ${qTarget} with administrator privileges`

    execFile('/usr/bin/osascript', ['-e', script], (err, _stdout, stderr) => {
      if (!err) return resolve({ success: true })
      const msg = (stderr || err.message || '').trim()
      if (msg.includes('-128') || msg.includes('User canceled')) {
        return resolve({ success: false, error: 'Скасовано користувачем' })
      }
      return resolve({ success: false, error: msg || 'Помилка створення файлу з правами адміністратора' })
    })
  })
}

