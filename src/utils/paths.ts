// ==========================================
// MACOS POSIX PATH UTILITIES
// ==========================================

export function isRootPath(p?: string | null): boolean {
  if (!p) return true;
  return p.trim() === "/";
}

export function normalizePath(p?: string | null): string {
  if (!p) return "/";
  let clean = p.trim().replace(/\/+/g, "/");
  if (clean.length > 1 && clean.endsWith("/")) {
    clean = clean.slice(0, -1);
  }
  return clean || "/";
}

export function getParentPath(p?: string | null): string {
  if (!p || isRootPath(p)) return "/";
  const norm = normalizePath(p);
  const parts = norm.split("/").filter(Boolean);
  parts.pop();
  return parts.length === 0 ? "/" : "/" + parts.join("/");
}

export function getPathSegments(p?: string | null): {
  root: string;
  segments: string[];
} {
  const norm = normalizePath(p);
  const segments = norm.split("/").filter(Boolean);
  return { root: "/", segments };
}

export function getSegmentFullPath(
  root: string,
  segments: string[],
  idx: number,
): string {
  const selected = segments.slice(0, idx + 1);
  return "/" + selected.join("/");
}

export function getPathLeafName(p?: string | null): string {
  const norm = normalizePath(p);
  if (isRootPath(norm)) {
    return "Root";
  }
  return norm.split("/").filter(Boolean).pop() || norm;
}

export function extractDroppedPaths(e: DragEvent): string[] {
  if (!e.dataTransfer) return [];

  // 1. In-app drag
  for (const format of ["tc/paths", "application/json"]) {
    const raw = e.dataTransfer.getData(format);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
  }

  // 2. Native items from Finder / Desktop
  if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    const list: string[] = [];
    for (let i = 0; i < e.dataTransfer.items.length; i++) {
      const it = e.dataTransfer.items[i];
      if (it.kind === "file") {
        const file = it.getAsFile();
        if (file) {
          const p =
            window.electronAPI &&
            typeof window.electronAPI.getPathForFile === "function"
              ? window.electronAPI.getPathForFile(file)
              : (file as any).path || "";
          if (p) list.push(p);
        }
      }
    }
    if (list.length > 0) return list;
  }

  // 3. Fallback to dataTransfer.files
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const list: string[] = [];
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i];
      const p =
        window.electronAPI &&
        typeof window.electronAPI.getPathForFile === "function"
          ? window.electronAPI.getPathForFile(file)
          : (file as any).path || "";
      if (p) list.push(p);
    }
    if (list.length > 0) return list;
  }

  // 4. URI list / text
  const uriList = e.dataTransfer.getData("text/uri-list");
  if (uriList) {
    const uris = uriList
      .split(/[\r\n]+/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith("file://"))
      .map((u) => decodeURIComponent(u.replace(/^file:\/\//, "")));
    if (uris.length > 0) return uris;
  }

  const text = e.dataTransfer.getData("text/plain");
  if (text) {
    const lines = text
      .split(/[\r\n]+/)
      .map((l) => decodeURIComponent(l.trim().replace(/^["']|["']$/g, "")))
      .filter((l) => l.startsWith("/"));
    if (lines.length > 0) return lines;
  }

  return [];
}
