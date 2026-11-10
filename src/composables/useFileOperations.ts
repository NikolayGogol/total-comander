import { onMounted, onUnmounted, type Ref } from "vue";
import type { FileItem, PaneState, TransferProgressData } from "@/types";
import type { ModalsState } from "@/composables/useModals";

export interface FileOperationsContext extends ModalsState {
  activePaneId: Ref<"left" | "right">;
  activePaneState: Ref<PaneState>;
  oppositePaneState: Ref<PaneState>;
  leftPane: PaneState;
  rightPane: PaneState;
  leftPaneRef: Ref<any>;
  rightPaneRef: Ref<any>;
  getActiveCursorItem: () => FileItem | null;
  getSelectedOrCursorPaths: () => string[];
  loadDirectory: (pane: PaneState, dir: string) => Promise<void>;
  navigatePane: (paneKey: "left" | "right", dir: string) => void;
  refreshPane: (paneKey: "left" | "right") => void;
  refreshAllPanes: () => void;
  copySelectedToClipboard: (paths: string[], action: "copy" | "cut") => void;
  pasteFromClipboard: (
    targetDir: string,
    onSuccess: () => Promise<void> | void,
  ) => void;
  selectAllInActivePane: () => void;
  showToast: (
    message: string,
    type?: "success" | "error" | "shortcut",
    shortcut?: string,
  ) => void;
  showShortcutToast: (shortcut: string, message: string) => void;
}

export function useFileOperations(ctx: FileOperationsContext) {
  async function openActiveTerminal() {
    await window.electronAPI.openInTerminal(
      ctx.activePaneState.value.currentPath,
    );
  }

  async function openFileNative(item: FileItem) {
    const res = await window.electronAPI.openPath(item.path);
    if (!res.success) {
      ctx.showToast(`Could not open file: ${res.error}`, "error");
    }
  }

  function openSearchModal() {
    ctx.searchModal.initialDir = ctx.activePaneState.value.currentPath;
    ctx.searchModal.open = true;
  }

  function jumpToSearchFile(filePath: string) {
    ctx.searchModal.open = false;
    const dir = filePath.substring(0, filePath.lastIndexOf("/")) || "/";
    ctx.navigatePane(ctx.activePaneId.value, dir);
  }

  function openCreateArchiveModal() {
    const selectedPaths = ctx.getSelectedOrCursorPaths();
    if (selectedPaths.length === 0) {
      ctx.showToast(
        "Виберіть хоча б один файл або папку для створення архіву",
        "error",
      );
      return;
    }
    ctx.createArchiveModal.sourceItems = selectedPaths;
    ctx.createArchiveModal.targetDir = ctx.activePaneState.value.currentPath;
    ctx.createArchiveModal.open = true;
  }

  function openArchiveInViewer(item: FileItem) {
    ctx.archiveViewModal.archivePath = item.path;
    ctx.archiveViewModal.destinationDir =
      ctx.oppositePaneState.value.currentPath;
    ctx.archiveViewModal.open = true;
  }

  function openLargeFilesModal() {
    ctx.largeFilesModal.initialDir = ctx.activePaneState.value.currentPath;
    ctx.largeFilesModal.open = true;
  }

  function handleBottomAction(type: string) {
    const cursorItem = ctx.getActiveCursorItem();
    const selectedPaths = ctx.getSelectedOrCursorPaths();

    switch (type) {
      case "rename":
        if (cursorItem) {
          ctx.operationModal.opType = "rename";
          ctx.operationModal.sourceItems = [cursorItem.path];
          ctx.operationModal.targetDir = "";
          ctx.operationModal.open = true;
        } else {
          ctx.showToast("Виберіть файл або папку для перейменування", "error");
        }
        break;

      case "view":
        if (cursorItem && !cursorItem.isDirectory) {
          Object.assign(ctx.viewerModal, {
            filePath: cursorItem.path,
            fileName: cursorItem.name,
            fileSize: cursorItem.size,
            open: true,
          });
        } else if (cursorItem?.isDirectory) {
          ctx.showToast("Перегляд вмісту доступний тільки для файлів", "error");
        }
        break;

      case "edit":
        if (cursorItem && !cursorItem.isDirectory) {
          Object.assign(ctx.editorModal, {
            filePath: cursorItem.path,
            fileName: cursorItem.name,
            open: true,
          });
        } else if (cursorItem?.isDirectory) {
          ctx.showToast("Редагування доступне тільки для файлів", "error");
        }
        break;

      case "copy":
      case "move":
        if (selectedPaths.length > 0) {
          ctx.operationModal.opType = type as "copy" | "move";
          ctx.operationModal.sourceItems = selectedPaths;
          ctx.operationModal.targetDir =
            ctx.oppositePaneState.value.currentPath;
          ctx.operationModal.open = true;
        } else {
          ctx.showToast(
            `Виберіть елементи для ${type === "copy" ? "копіювання" : "переміщення"}`,
            "error",
          );
        }
        break;

      case "clone":
        if (cursorItem) {
          ctx.operationModal.opType = "copy";
          ctx.operationModal.sourceItems = [cursorItem.path];
          ctx.operationModal.targetDir = ctx.activePaneState.value.currentPath;
          ctx.operationModal.open = true;
        }
        break;

      case "mkdir":
      case "newfile":
        ctx.operationModal.opType = type;
        ctx.operationModal.sourceItems = [];
        ctx.operationModal.targetDir = ctx.activePaneState.value.currentPath;
        ctx.operationModal.open = true;
        break;

      case "delete":
      case "permanent-delete":
        if (selectedPaths.length > 0) {
          ctx.operationModal.opType = "delete";
          ctx.operationModal.sourceItems = selectedPaths;
          ctx.operationModal.targetDir =
            type === "permanent-delete" ? "PERMANENT" : "";
          ctx.operationModal.open = true;
        } else {
          ctx.showToast("Виберіть елементи для видалення", "error");
        }
        break;

      case "terminal":
        openActiveTerminal();
        break;

      case "search":
        openSearchModal();
        break;
    }
  }

  async function onArchiveCreateConfirm(payload: {
    format: "zip" | "tar.gz";
    fullTarget: string;
    password?: string;
    level?: number;
  }) {
    ctx.createArchiveModal.open = false;
    ctx.showToast("Створення архіву...", "success");
    try {
      const rawSources = JSON.parse(
        JSON.stringify(ctx.createArchiveModal.sourceItems),
      );
      const res = await window.electronAPI.createArchive({
        sources: rawSources,
        targetPath: payload.fullTarget,
        format: payload.format,
        password: payload.password,
        level: payload.level,
      });
      if (res.success) {
        ctx.showToast(
          `Архів створено: ${payload.fullTarget.split("/").pop()}`,
          "success",
        );
        ctx.refreshAllPanes();
      } else {
        ctx.showToast(`Помилка створення архіву: ${res.error}`, "error");
      }
    } catch (err: any) {
      ctx.showToast(`Помилка: ${err.message}`, "error");
    }
  }

  async function onArchiveExtractConfirm(payload: {
    archivePath: string;
    targetDir: string;
    selectedFiles?: string[];
  }) {
    ctx.archiveViewModal.open = false;
    ctx.showToast("Розпакування архіву...", "success");
    try {
      const res = await window.electronAPI.extractArchive(
        payload.archivePath,
        payload.targetDir,
        payload.selectedFiles,
      );
      if (res.success) {
        ctx.showToast("Архів успішно розпаковано", "success");
        ctx.refreshAllPanes();
      } else {
        ctx.showToast(`Помилка розпакування: ${res.error}`, "error");
      }
    } catch (err: any) {
      ctx.showToast(`Помилка: ${err.message}`, "error");
    }
  }

  function handleContextMenu(
    paneId: "left" | "right",
    payload: { x: number; y: number; item: FileItem | null },
  ) {
    ctx.activePaneId.value = paneId;
    const p = paneId === "left" ? ctx.leftPane : ctx.rightPane;
    if (payload.item) {
      const idx = p.items.findIndex((i) => i.path === payload.item!.path);
      if (idx !== -1 && !p.selectedPaths.has(payload.item.path)) {
        p.cursorIndex = idx;
      }
    }
    ctx.contextMenuState.visible = true;
    ctx.contextMenuState.x = payload.x;
    ctx.contextMenuState.y = payload.y;
    ctx.contextMenuState.item = payload.item;
    ctx.contextMenuState.paneId = paneId;
  }

  async function handleContextMenuAction(
    action: string,
    item: FileItem | null,
  ) {
    switch (action) {
      case "open":
        if (item) {
          if (item.isDirectory && !item.isApp) {
            ctx.navigatePane(ctx.contextMenuState.paneId, item.path);
          } else {
            await openFileNative(item);
          }
        }
        break;

      case "show-package-contents":
        if (item) {
          ctx.navigatePane(ctx.contextMenuState.paneId, item.path);
        }
        break;

      case "view-archive":
        if (item) {
          openArchiveInViewer(item);
        }
        break;

      case "extract-archive":
        if (item) {
          onArchiveExtractConfirm({
            archivePath: item.path,
            targetDir: ctx.oppositePaneState.value.currentPath,
          });
        }
        break;

      case "archive-create":
        openCreateArchiveModal();
        break;

      case "calculate-dir-size":
        if (item && item.isDirectory) {
          const paneRef =
            ctx.contextMenuState.paneId === "left"
              ? ctx.leftPaneRef
              : ctx.rightPaneRef;
          paneRef.value?.calculateDirectorySize(item.path);
        }
        break;

      case "folder-size-modal":
        if (item && item.isDirectory) {
          ctx.folderSizeModal.folderPath = item.path;
          ctx.folderSizeModal.open = true;
        }
        break;

      case "large-files": {
        ctx.largeFilesModal.initialDir =
          item && item.isDirectory
            ? item.path
            : ctx.activePaneState.value.currentPath;
        ctx.largeFilesModal.open = true;
        break;
      }

      case "unlocker": {
        const target = item || ctx.getActiveCursorItem();
        if (target) {
          ctx.unlockerModal.targetPath = target.path;
          ctx.unlockerModal.targetName = target.name;
          ctx.unlockerModal.isDirectory = target.isDirectory;
          ctx.unlockerModal.oppositePath =
            ctx.oppositePaneState.value.currentPath;
          ctx.unlockerModal.open = true;
        }
        break;
      }

      case "view":
        if (item && !item.isDirectory) {
          Object.assign(ctx.viewerModal, {
            filePath: item.path,
            fileName: item.name,
            fileSize: item.size,
            open: true,
          });
        }
        break;

      case "edit":
        if (item && !item.isDirectory) {
          Object.assign(ctx.editorModal, {
            filePath: item.path,
            fileName: item.name,
            open: true,
          });
        }
        break;

      case "copy":
      case "move":
      case "rename":
      case "delete":
        handleBottomAction(action);
        break;

      case "clipboard-copy":
        ctx.copySelectedToClipboard(ctx.getSelectedOrCursorPaths(), "copy");
        break;

      case "clipboard-cut":
        ctx.copySelectedToClipboard(ctx.getSelectedOrCursorPaths(), "cut");
        break;

      case "copy-path":
        if (item) {
          try {
            await navigator.clipboard.writeText(item.path);
            ctx.showShortcutToast("Link", `Шлях скопійовано: ${item.name}`);
          } catch {
            ctx.showToast("Не вдалося скопіювати шлях", "error");
          }
        }
        break;

      case "paste":
        ctx.pasteFromClipboard(
          ctx.activePaneState.value.currentPath,
          ctx.refreshAllPanes,
        );
        break;

      case "show-in-folder":
        if (item) {
          try {
            await window.electronAPI.showInFolder(item.path);
            ctx.showShortcutToast("Finder", `Показано у Finder: ${item.name}`);
          } catch (err: any) {
            ctx.showToast(err.message, "error");
          }
        }
        break;

      case "terminal":
        openActiveTerminal();
        break;

      case "mkdir":
        handleBottomAction("mkdir");
        break;

      case "newfile":
        handleBottomAction("newfile");
        break;

      case "select-all":
        ctx.selectAllInActivePane();
        break;

      case "refresh":
        ctx.refreshPane(ctx.contextMenuState.paneId);
        break;
    }
  }

  onMounted(() => {
    if (
      window.electronAPI &&
      typeof window.electronAPI.onTransferProgress === "function"
    ) {
      const unsub = window.electronAPI.onTransferProgress(
        (data: TransferProgressData) => {
          if (
            ctx.operationProgressModal.data.operationId === data.operationId
          ) {
            Object.assign(ctx.operationProgressModal.data, data);
          }
        },
      );
      onUnmounted(() => {
        unsub();
      });
    }
  });

  async function runTransferWithProgress(
    type: "copy" | "move",
    sources: string[],
    targetDir: string,
  ): Promise<{ success: boolean; canceled?: boolean; error?: string }> {
    const opId =
      "transfer-" +
      Date.now() +
      "-" +
      Math.random().toString(36).substring(2, 7);

    Object.assign(ctx.operationProgressModal.data, {
      operationId: opId,
      type,
      currentFile: "",
      currentDir: targetDir,
      itemsDone: 0,
      totalItems: sources.length,
      bytesTransferred: 0,
      totalBytes: 0,
      bytesRemaining: 0,
      speedBytesPerSec: 0,
      etaSeconds: -1,
      elapsedSeconds: 0,
      percent: 0,
      isDone: false,
      canceled: false,
      error: undefined,
    });
    ctx.operationProgressModal.targetDir = targetDir;
    ctx.operationProgressModal.open = true;

    const startTime = Date.now();
    const res = await window.electronAPI.runTransfer({
      type,
      sources,
      destinationDir: targetDir,
      operationId: opId,
    });

    if (res.canceled) {
      ctx.operationProgressModal.data.canceled = true;
      ctx.showToast(
        `Операцію ${type === "copy" ? "копіювання" : "переміщення"} скасовано`,
        "shortcut",
      );
      setTimeout(() => {
        ctx.operationProgressModal.open = false;
      }, 400);
      ctx.refreshAllPanes();
    } else if (res.success) {
      ctx.operationProgressModal.data.isDone = true;
      const elapsed = Date.now() - startTime;
      const delay = elapsed < 400 ? 150 : 350;
      setTimeout(() => {
        ctx.operationProgressModal.open = false;
      }, delay);
      ctx.refreshAllPanes();
    } else {
      ctx.operationProgressModal.open = false;
      ctx.showToast(
        res.error ||
          `Помилка ${type === "copy" ? "копіювання" : "переміщення"}`,
        "error",
      );
    }

    return res;
  }

  async function cancelCurrentTransfer() {
    if (
      ctx.operationProgressModal.data.operationId &&
      window.electronAPI.cancelTransfer
    ) {
      await window.electronAPI.cancelTransfer(
        ctx.operationProgressModal.data.operationId,
      );
      ctx.operationProgressModal.data.canceled = true;
    }
  }

  async function onOperationConfirm(payload: {
    opType: string;
    target: string;
  }) {
    ctx.operationModal.open = false;
    const { opType, target } = payload;
    const rawSources: string[] = JSON.parse(
      JSON.stringify(ctx.operationModal.sourceItems),
    );

    try {
      if (opType === "mkdir" || opType === "newfile") {
        const current =
          ctx.activePaneState.value.currentPath === "/"
            ? ""
            : ctx.activePaneState.value.currentPath;
        const fullPath = `${current}/${target.replace(/^\/+/, "")}`;
        const res =
          opType === "mkdir"
            ? await window.electronAPI.createFolder(fullPath)
            : await window.electronAPI.createFile(fullPath);
        if (res.success) {
          ctx.showToast(
            `Створено ${opType === "mkdir" ? "папку" : "файл"} "${target}"`,
            "success",
          );
          ctx.refreshPane(ctx.activePaneId.value);
        } else {
          ctx.showToast(`Помилка створення: ${res.error}`, "error");
        }
      } else if (opType === "rename") {
        const oldPath = rawSources[0];
        const dirParts = oldPath.split("/");
        dirParts.pop();
        const newPath = `${dirParts.join("/")}/${target}`;
        const res = await window.electronAPI.renamePath(oldPath, newPath);
        if (res.success) {
          ctx.showToast(`Renamed to "${target}"`, "success");
          ctx.refreshAllPanes();
        } else {
          ctx.showToast(`Rename error: ${res.error}`, "error");
        }
      } else if (opType === "copy") {
        const res = await runTransferWithProgress("copy", rawSources, target);
        if (res.success) {
          ctx.showToast(
            `Скопійовано ${rawSources.length} елемент(ів)`,
            "success",
          );
        }
      } else if (opType === "move") {
        const res = await runTransferWithProgress("move", rawSources, target);
        if (res.success) {
          ctx.showToast(
            `Переміщено ${rawSources.length} елемент(ів)`,
            "success",
          );
        }
      } else if (opType === "delete") {
        const isPermanent = ctx.operationModal.targetDir === "PERMANENT";
        const res = await window.electronAPI.deletePaths(
          rawSources,
          !isPermanent,
        );
        if (res.success) {
          const msg = isPermanent
            ? `Безповоротно видалено ${rawSources.length} елемент(ів)`
            : `Переміщено ${rawSources.length} елемент(ів) у macOS Смітник`;
          ctx.showToast(msg, "success");
          ctx.refreshAllPanes();
        } else {
          ctx.showToast(`Помилка видалення: ${res.error}`, "error");
        }
      }
    } catch (err: any) {
      ctx.showToast(`Operation failed: ${err.message}`, "error");
    }
  }

  function onFileSaved() {
    ctx.showToast("File saved successfully", "success");
    ctx.refreshAllPanes();
  }

  async function handleDragDrop(
    sourcePaths: string[],
    targetDir: string,
    isMove: boolean = false,
  ) {
    try {
      if (!sourcePaths || sourcePaths.length === 0) return;
      const rawPaths: string[] = JSON.parse(JSON.stringify(sourcePaths));
      const targetName =
        targetDir.split("/").filter(Boolean).pop() || targetDir;

      const firstParent =
        rawPaths[0].substring(0, rawPaths[0].lastIndexOf("/")) || "/";
      if (
        rawPaths.length === 1 &&
        (firstParent === targetDir.replace(/\/+$/, "") ||
          firstParent === targetDir)
      ) {
        ctx.showToast("Цільова папка збігається з вихідною", "error");
        return;
      }

      const res = await runTransferWithProgress(
        isMove ? "move" : "copy",
        rawPaths,
        targetDir,
      );

      if (res.success) {
        const actionWord = isMove ? "Переміщено" : "Скопійовано";
        const itemsWord =
          rawPaths.length === 1
            ? "елемент"
            : rawPaths.length < 5
              ? "елементи"
              : "елементів";
        ctx.showToast(
          `${actionWord} ${rawPaths.length} ${itemsWord} у "${targetName}"`,
          "success",
        );
      }
    } catch (err: any) {
      ctx.showToast(`Помилка drag & drop: ${err.message}`, "error");
    }
  }

  return {
    openActiveTerminal,
    openFileNative,
    openSearchModal,
    jumpToSearchFile,
    openCreateArchiveModal,
    openArchiveInViewer,
    openLargeFilesModal,
    handleBottomAction,
    onArchiveCreateConfirm,
    onArchiveExtractConfirm,
    handleContextMenu,
    handleContextMenuAction,
    onOperationConfirm,
    onFileSaved,
    handleDragDrop,
    cancelCurrentTransfer,
    runTransferWithProgress,
  };
}
