import dayjs from "dayjs";
import numeral from "numeral";

export function formatBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0)
    return "0 B";
  // numeral '0.0 b' formats: 100 B, 1.2 KB, 45.6 MB, 1.8 GB
  return numeral(bytes).format("0.0 b").toUpperCase();
}

export function formatNumber(num?: number | null): string {
  if (num === undefined || num === null || isNaN(num) || num <= 0) return "0";
  return numeral(num).format("0,0");
}

export function formatDate(
  timestamp?: number | null,
  format = "YYYY-MM-DD HH:mm",
): string {
  if (!timestamp || isNaN(timestamp)) return "--";
  const d = dayjs(timestamp);
  if (!d.isValid()) return "--";
  return d.format(format);
}

export function formatDuration(seconds?: number | null): string {
  if (
    seconds === undefined ||
    seconds === null ||
    isNaN(seconds) ||
    seconds < 0
  )
    return "--";
  const s = Math.round(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatEta(seconds?: number | null): string {
  if (
    seconds === undefined ||
    seconds === null ||
    isNaN(seconds) ||
    seconds < 0
  )
    return "--";
  if (seconds === 0) return "майже готово";
  const s = Math.round(seconds);
  if (s < 60) return `${s} сек`;
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins < 60) {
    return secs > 0 ? `${mins} хв ${secs} сек` : `${mins} хв`;
  }
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs} год ${remMins} хв`;
}

export type FileCategory =
  | "folder"
  | "app"
  | "archive"
  | "image"
  | "video"
  | "audio"
  | "code"
  | "doc"
  | "system"
  | "default";

export interface CategoryInfo {
  category: FileCategory;
  icon: string;
  classModifier: string;
}

export function getFileCategory(
  nameOrExt?: string | null,
  isDir?: boolean,
): CategoryInfo {
  if (isDir) {
    return { category: "folder", icon: "Folder", classModifier: "icon-folder" };
  }

  const str = (typeof nameOrExt === "string" ? nameOrExt : "").toLowerCase();
  const cleanExt = str.includes(".")
    ? str.split(".").filter(Boolean).pop()!
    : str.replace(".", "").trim();

  // macOS Applications & Bundles
  if (["app", "action", "workflow", "prefPane", "plugin"].includes(cleanExt)) {
    return { category: "app", icon: "Code", classModifier: "icon-code" };
  }

  // System / Libraries / Plist
  if (
    [
      "dylib",
      "kext",
      "framework",
      "plist",
      "log",
      "tmp",
      "bak",
      "swp",
      "lock",
    ].includes(cleanExt)
  ) {
    return { category: "system", icon: "File", classModifier: "icon-system" };
  }

  // Images
  if (
    [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "svg",
      "webp",
      "avif",
      "ico",
      "bmp",
      "tiff",
      "heic",
      "heif",
      "icns",
    ].includes(cleanExt)
  ) {
    return { category: "image", icon: "Image", classModifier: "icon-image" };
  }

  // Videos
  if (["mp4", "mov", "avi", "mkv", "webm", "flv", "m4v"].includes(cleanExt)) {
    return { category: "video", icon: "Film", classModifier: "icon-video" };
  }

  // Audio
  if (["mp3", "wav", "flac", "aac", "ogg", "m4a", "aiff"].includes(cleanExt)) {
    return { category: "audio", icon: "Music", classModifier: "icon-audio" };
  }

  // Code / Web / Scripts
  if (
    [
      "js",
      "ts",
      "vue",
      "jsx",
      "tsx",
      "html",
      "css",
      "scss",
      "json",
      "py",
      "go",
      "rs",
      "c",
      "cpp",
      "h",
      "hpp",
      "java",
      "swift",
      "kt",
      "php",
      "rb",
      "sh",
      "zsh",
      "yaml",
      "yml",
      "toml",
      "sql",
      "xml",
    ].includes(cleanExt)
  ) {
    return { category: "code", icon: "Code", classModifier: "icon-code" };
  }

  // Documents
  if (
    [
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "csv",
      "ppt",
      "pptx",
      "txt",
      "md",
      "rtf",
    ].includes(cleanExt)
  ) {
    return { category: "doc", icon: "FileText", classModifier: "icon-doc" };
  }

  // Archives / Disk images
  if (
    [
      "zip",
      "tar",
      "gz",
      "bz2",
      "7z",
      "rar",
      "xz",
      "dmg",
      "iso",
      "pkg",
      "tgz",
      "blockmap",
    ].includes(cleanExt)
  ) {
    return {
      category: "archive",
      icon: "Archive",
      classModifier: "icon-archive",
    };
  }

  return { category: "default", icon: "File", classModifier: "icon-default" };
}

export function getFileTypeDescription(
  nameOrExt?: string | null,
  isDir?: boolean,
): string {
  if (isDir) return "Папка";
  const str = (typeof nameOrExt === "string" ? nameOrExt : "").toLowerCase();
  const cleanExt = str.includes(".")
    ? str.split(".").filter(Boolean).pop()!
    : str.replace(".", "").trim();
  if (cleanExt === "dmg") return "Образ диска Apple macOS (.dmg)";
  if (cleanExt === "app") return "Програма macOS (.app)";
  if (cleanExt === "pkg") return "Інсталяційний пакет macOS (.pkg)";
  if (["zip", "tar", "gz", "7z", "rar", "xz"].includes(cleanExt))
    return "Стиснений архів";
  if (
    ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "icns"].includes(
      cleanExt,
    )
  )
    return "Графічне зображення";
  if (["mp4", "mov", "avi", "mkv", "m4v"].includes(cleanExt))
    return "Відеофайл";
  if (["mp3", "wav", "flac", "aac", "m4a"].includes(cleanExt))
    return "Аудіозапис";
  if (
    [
      "ts",
      "js",
      "vue",
      "py",
      "json",
      "yaml",
      "yml",
      "html",
      "css",
      "scss",
      "swift",
    ].includes(cleanExt)
  )
    return "Вихідний код / Конфігурація";
  if (["pdf", "doc", "docx", "txt", "md", "rtf"].includes(cleanExt))
    return "Текстовий документ";
  return cleanExt ? `Файл (${cleanExt.toUpperCase()})` : "Файл";
}

export function isArchive(item?: any): boolean {
  if (!item) return false;
  if (typeof item === "object" && item.isDirectory) return false;
  const str =
    typeof item === "string" ? item : item.extension || item.name || "";
  const ext = (str.includes(".") ? str.split(".").pop()! : str)
    .toLowerCase()
    .replace(/^\./, "");
  return ["zip", "tar", "gz", "tgz", "bz2", "tbz2", "xz", "7z", "rar"].includes(
    ext,
  );
}

export function getItemIconTitle(item?: any): string {
  if (!item) return "";
  if (item.isAlias) return `Ярлик до: ${item.aliasTarget || item.name}`;
  if (item.isDirectory) return `Папка: ${item.name}`;
  if (isArchive(item))
    return `Архів: ${item.name} (${formatBytes(item.size)}) — подвійний клік щоб відкрити`;
  const ext = item.extension
    ? `${item.extension.toUpperCase().replace(/^\./, "")} `
    : "";
  return `${ext}Файл: ${item.name} (${formatBytes(item.size)})`;
}

export function getShortItemTooltip(item?: any): string {
  if (!item) return "";
  if (item.isAlias)
    return `↗ ${item.name} • Ярлик до ${item.aliasTarget || item.path}`;
  if (item.isApp) return `🚀 ${item.name} • Програма macOS`;
  if (item.isDirectory) return `📁 ${item.name} • Папка`;
  const ext = item.extension
    ? item.extension.toUpperCase().replace(".", "") + " • "
    : "";
  return `📄 ${item.name} • ${ext}${formatBytes(item.size)}`;
}

export function getItemTooltip(item?: any): string {
  if (!item) return "";
  if (item.isAlias) {
    return [
      `↗ Ярлик: ${item.name || ""}`,
      `Тип: Ярлик macOS (Alias / Shortcut)`,
      `Ціль: ${item.aliasTarget || item.path || ""}`,
      `Шлях: ${item.path || ""}`,
      `Змінено: ${formatDate(item.mtime)}`,
      `💡 Подвійний клік або Enter — відкрити цільовий об'єкт`,
    ].join("\n");
  }
  if (item.isApp) {
    return [
      `🚀 Програма: ${item.name || ""}`,
      `Тип: Програма Apple macOS (.app)`,
      `Шлях: ${item.path || ""}`,
      `Змінено: ${formatDate(item.mtime)}`,
      `Права доступу: ${item.permissions || "--"}`,
      `💡 Подвійний клік або Enter — запустити програму`,
    ].join("\n");
  }
  if (item.isDirectory) {
    return [
      `📁 Папка: ${item.name || ""}`,
      `Шлях: ${item.path || ""}`,
      `Змінено: ${formatDate(item.mtime)}`,
      `Права доступу: ${item.permissions || "--"}`,
      `💡 Подвійний клік — увійти у папку`,
    ].join("\n");
  }

  const extStr = item.extension ? ` (${item.extension.toUpperCase()})` : "";
  const sizeDetailed = `${formatBytes(item.size)} (${formatNumber(item.size)} байт)`;
  const typeDesc = getFileTypeDescription(item.extension, false);
  return [
    `📄 Файл: ${item.name || ""}${extStr}`,
    `Тип: ${typeDesc}`,
    `Розмір: ${sizeDetailed}`,
    `Шлях: ${item.path || ""}`,
    `Змінено: ${formatDate(item.mtime)}`,
    `Права доступу: ${item.permissions || "--"}`,
    `💡 Подвійний клік — відкрити у нативній програмі`,
  ].join("\n");
}
