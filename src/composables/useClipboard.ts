export function useClipboard(
  showToast: (
    message: string,
    type?: "success" | "error" | "shortcut",
    shortcut?: string,
  ) => void,
  showShortcutToast: (shortcut: string, message: string) => void,
) {
  let lastCopyTime = 0;

  async function copySelectedToClipboard(
    paths: string[],
    action: "copy" | "cut" = "copy",
  ) {
    const now = Date.now();
    if (now - lastCopyTime < 150) return;
    lastCopyTime = now;

    if (!paths || paths.length === 0) {
      showToast("Не вибрано жодного файлу для копіювання", "error");
      return;
    }

    try {
      const res = await window.electronAPI.copyFilesToClipboard(paths, action);
      if (res.success) {
        const count = paths.length;
        const badge = action === "copy" ? "Cmd + C" : "Cmd + X";
        if (count === 1) {
          const fileName =
            paths[0].split("/").filter(Boolean).pop() || paths[0];
          const text =
            action === "copy"
              ? `Файл скопійовано у буфер: ${fileName}`
              : `Файл вирізано у буфер: ${fileName}`;
          showShortcutToast(badge, text);
        } else {
          const text =
            action === "copy"
              ? `Скопійовано ${count} файлів у буфер`
              : `Вирізано ${count} файлів у буфер`;
          showShortcutToast(badge, text);
        }
      } else {
        showToast(res.error || "Помилка копіювання у буфер", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Помилка копіювання у буфер", "error");
    }
  }

  async function pasteFromClipboard(
    targetDir: string,
    onSuccess: () => Promise<void> | void,
  ) {
    try {
      const res = await window.electronAPI.getClipboardFiles();
      if (!res.success || !res.paths || res.paths.length === 0) {
        showToast("Буфер обміну не містить файлів для вставки", "error");
        return;
      }

      const count = res.paths.length;
      const action = res.action || "copy";

      let opRes;
      if (action === "cut") {
        opRes = await window.electronAPI.movePaths(res.paths, targetDir);
        await window.electronAPI.clearClipboard();
      } else {
        opRes = await window.electronAPI.copyPaths(res.paths, targetDir);
      }

      if (opRes.success) {
        await onSuccess();
        const dirName =
          targetDir.split("/").filter(Boolean).pop() || "директорію";
        const verb = action === "cut" ? "Переміщено" : "Вставлено";
        const itemsWord =
          count === 1 ? "елемент" : count < 5 ? "елементи" : "елементів";
        showShortcutToast(
          "Cmd + V",
          `${verb} ${count} ${itemsWord} у ${dirName}`,
        );
      } else {
        showToast(opRes.error || "Помилка вставки файлів", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Помилка вставки файлів", "error");
    }
  }

  return {
    copySelectedToClipboard,
    pasteFromClipboard,
  };
}
