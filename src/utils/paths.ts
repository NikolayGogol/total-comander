// ==========================================
// MACOS POSIX PATH UTILITIES
// ==========================================

export function isRootPath(p?: string | null): boolean {
  if (!p) return true
  return p.trim() === '/'
}

export function normalizePath(p?: string | null): string {
  if (!p) return '/'
  let clean = p.trim().replace(/\/+/g, '/')
  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1)
  }
  return clean || '/'
}

export function getParentPath(p?: string | null): string {
  if (!p || isRootPath(p)) return '/'
  const norm = normalizePath(p)
  const parts = norm.split('/').filter(Boolean)
  parts.pop()
  return parts.length === 0 ? '/' : '/' + parts.join('/')
}

export function getPathSegments(p?: string | null): { root: string; segments: string[] } {
  const norm = normalizePath(p)
  const segments = norm.split('/').filter(Boolean)
  return { root: '/', segments }
}

export function getSegmentFullPath(root: string, segments: string[], idx: number): string {
  const selected = segments.slice(0, idx + 1)
  return '/' + selected.join('/')
}

export function getPathLeafName(p?: string | null): string {
  const norm = normalizePath(p)
  if (isRootPath(norm)) {
    return 'Root'
  }
  return norm.split('/').filter(Boolean).pop() || norm
}
