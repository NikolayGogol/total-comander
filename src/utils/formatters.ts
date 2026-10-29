import dayjs from 'dayjs'
import numeral from 'numeral'

export function formatBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) return '0 B'
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

export type FileCategory =
  'folder' | 'exe' | 'archive' | 'image' | 'video' | 'audio' | 'code' | 'doc' | 'system' | 'default'

export interface CategoryInfo {
  category: FileCategory
  icon: string
  classModifier: string
}

export function getFileCategory(nameOrExt?: string | null, isDir?: boolean): CategoryInfo {
  if (isDir) {
    return { category: 'folder', icon: 'Folder', classModifier: 'icon-folder' }
  }

  const str = (typeof nameOrExt === 'string' ? nameOrExt : '').toLowerCase()
  const cleanExt = str.includes('.') ? str.split('.').filter(Boolean).pop()! : str.replace('.', '').trim()

  // Executables / Binaries / Scripts for Windows
  if (['exe', 'msi', 'bat', 'cmd', 'ps1', 'com', 'scr', 'vbs', 'wsf'].includes(cleanExt)) {
    return { category: 'exe', icon: 'Code', classModifier: 'icon-exe' }
  }

  // System / Drivers / Config / Logs
  if (['sys', 'dll', 'drv', 'tmp', 'log', 'ini', 'dat', 'blf', 'reg', 'bin', 'bak', 'swp'].includes(cleanExt)) {
    return { category: 'system', icon: 'File', classModifier: 'icon-system' }
  }

  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'ico', 'bmp', 'tiff'].includes(cleanExt)) {
    return { category: 'image', icon: 'Image', classModifier: 'icon-image' }
  }

  // Videos
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'].includes(cleanExt)) {
    return { category: 'video', icon: 'Film', classModifier: 'icon-video' }
  }

  // Audio
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'mid'].includes(cleanExt)) {
    return { category: 'audio', icon: 'Music', classModifier: 'icon-audio' }
  }

  // Code / Web / Config
  if (
    [
      'js',
      'ts',
      'vue',
      'jsx',
      'tsx',
      'html',
      'css',
      'scss',
      'json',
      'py',
      'go',
      'rs',
      'c',
      'cpp',
      'h',
      'hpp',
      'java',
      'cs',
      'php',
      'rb',
      'sh',
      'yaml',
      'yml',
      'toml',
      'sql',
      'xml',
    ].includes(cleanExt)
  ) {
    return { category: 'code', icon: 'Code', classModifier: 'icon-code' }
  }

  // Documents
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'md', 'rtf'].includes(cleanExt)) {
    return { category: 'doc', icon: 'FileText', classModifier: 'icon-doc' }
  }

  // Archives
  if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz', 'iso', 'cab', 'tgz', 'dmg'].includes(cleanExt)) {
    return { category: 'archive', icon: 'Archive', classModifier: 'icon-archive' }
  }

  return { category: 'default', icon: 'File', classModifier: 'icon-default' }
}

export function getFileTypeDescription(nameOrExt?: string | null, isDir?: boolean): string {
  if (isDir) return 'Папка'
  const str = (typeof nameOrExt === 'string' ? nameOrExt : '').toLowerCase()
  const cleanExt = str.includes('.') ? str.split('.').filter(Boolean).pop()! : str.replace('.', '').trim()

  if (cleanExt === 'exe') return 'Виконуваний файл Windows (.exe)'
  if (cleanExt === 'msi') return 'Інсталятор Windows (.msi)'
  if (cleanExt === 'bat' || cleanExt === 'cmd') return 'Пакетний файл Windows'
  if (cleanExt === 'ps1') return 'Скрипт PowerShell'
  if (cleanExt === 'sys') return 'Системний драйвер Windows (.sys)'
  if (cleanExt === 'dll') return 'Динамічна бібліотека (.dll)'
  if (['zip', 'tar', 'gz', '7z', 'rar', 'xz'].includes(cleanExt)) return 'Стиснений архів'
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(cleanExt)) return 'Графічне зображення'
  if (['mp4', 'mov', 'avi', 'mkv'].includes(cleanExt)) return 'Відеофайл'
  if (['mp3', 'wav', 'flac', 'aac'].includes(cleanExt)) return 'Аудіозапис'
  if (['ts', 'js', 'vue', 'py', 'json', 'yaml', 'yml', 'html', 'css', 'scss'].includes(cleanExt))
    return 'Вихідний код / Конфігурація'
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(cleanExt)) return 'Текстовий документ'
  return cleanExt ? `Файл (${cleanExt.toUpperCase()})` : 'Файл'
}
