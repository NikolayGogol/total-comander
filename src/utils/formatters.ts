import dayjs from 'dayjs'
import numeral from 'numeral'

export function formatBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) return '0 B'
  // numeral '0.0 b' formats: 100 B, 1.2 KB, 45.6 MB, 1.8 GB
  return numeral(bytes).format('0.0 b').toUpperCase()
}

export function formatNumber(num?: number | null): string {
  if (num === undefined || num === null || isNaN(num) || num <= 0) return '0'
  return numeral(num).format('0,0')
}

export function formatDate(timestamp?: number | null, format = 'YYYY-MM-DD HH:mm'): string {
  if (!timestamp || isNaN(timestamp)) return '--'
  const d = dayjs(timestamp)
  if (!d.isValid()) return '--'
  return d.format(format)
}

export function getFileCategory(ext?: string | null, isDir?: boolean): {
  icon: string
  classModifier: string
} {
  if (isDir) {
    return { icon: 'Folder', classModifier: 'icon-folder' }
  }

  const cleanExt = (typeof ext === 'string' ? ext : '').toLowerCase().replace('.', '').trim()

  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'ico', 'bmp'].includes(cleanExt)) {
    return { icon: 'Image', classModifier: 'icon-image' }
  }

  // Videos
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'].includes(cleanExt)) {
    return { icon: 'Film', classModifier: 'icon-video' }
  }

  // Audio
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(cleanExt)) {
    return { icon: 'Music', classModifier: 'icon-audio' }
  }

  // Code / Web
  if (['js', 'ts', 'vue', 'jsx', 'tsx', 'html', 'css', 'scss', 'json', 'py', 'go', 'rs', 'c', 'cpp', 'java', 'php', 'rb', 'sh', 'zsh', 'yaml', 'yml', 'toml'].includes(cleanExt)) {
    return { icon: 'Code', classModifier: 'icon-code' }
  }

  // Documents
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'rtf'].includes(cleanExt)) {
    return { icon: 'FileText', classModifier: 'icon-doc' }
  }

  // Archives
  if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz', 'dmg', 'iso', 'blockmap'].includes(cleanExt)) {
    return { icon: 'Archive', classModifier: 'icon-archive' }
  }

  return { icon: 'File', classModifier: 'icon-default' }
}

export function getFileTypeDescription(ext?: string | null, isDir?: boolean): string {
  if (isDir) return 'Папка'
  const cleanExt = (typeof ext === 'string' ? ext : '').toLowerCase().replace('.', '').trim()
  if (cleanExt === 'dmg') return 'Образ диска Apple macOS (.dmg)'
  if (cleanExt === 'app') return 'Програма macOS (.app)'
  if (['zip', 'tar', 'gz', '7z', 'rar', 'xz'].includes(cleanExt)) return 'Стиснений архів'
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(cleanExt)) return 'Графічне зображення'
  if (['mp4', 'mov', 'avi', 'mkv'].includes(cleanExt)) return 'Відеофайл'
  if (['mp3', 'wav', 'flac', 'aac'].includes(cleanExt)) return 'Аудіозапис'
  if (['ts', 'js', 'vue', 'py', 'json', 'yaml', 'yml', 'html', 'css', 'scss'].includes(cleanExt)) return 'Вихідний код / Конфігурація'
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(cleanExt)) return 'Текстовий документ'
  return cleanExt ? `Файл (${cleanExt.toUpperCase()})` : 'Файл'
}
