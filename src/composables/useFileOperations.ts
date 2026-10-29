import type { Ref } from "vue";
import type { FileItem, PaneState } from "@/types";

export interface FileOperationsContext {
  activePaneId: Ref<"left" | "right">;
  activePaneState: Ref<PaneState>;
  oppositePaneState: Ref<PaneState>;
  leftPane: PaneState;
  rightPane: PaneState;
  leftPaneRef: Ref<any>;
  rightPaneRef: Ref<any>;
  operationModal: {
    open: boolean;
    opType: "copy" | "move" | "mkdir" | "newfile" | "delete" | "rename";
    sourceItems: string[];
    targetDir: string;
  };
  viewerModal: {
    open: boolean;
    filePath: string;
    fileName: string;
    fileSize: number;
  };
  editorModal: {
    open: boolean;
    filePath: string;
    fileName: string;
  };
  searchModal: {
    open: boolean;
    initialDir: string;
  };
  createArchiveModal: {
    open: boolean;
    sourceItems: string[];
    targetDir: string;
  };
  archiveViewModal: {
    open: boolean;
    archivePath: string;
    destinationDir: string;
  };
  largeFilesModal: {
    open: boolean;
    initialDir: string;
  };
  folderSizeModal: {
    open: boolean;
    folderPath: string;
  };
  contextMenuState: {
    visible: boolean;
    x: number;
    y: number;
    item: FileItem | null;
    paneId: "left" | "right";
  };
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
    const parts = filePath.split("/");
    parts.pop();
    const dir = parts.join("/") || "/";
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
        }
        break;

      case "view":
        if (cursorItem && !cursorItem.isDirectory) {
          ctx.viewerModal.filePath = cursorItem.path;
          ctx.viewerModal.fileName = cursorItem.name;
          ctx.viewerModal.fileSize = cursorItem.size;
          ctx.viewerModal.open = true;
        }
        break;

      case "edit":
        if (cursorItem && !cursorItem.isDirectory) {
          ctx.editorModal.filePath = cursorItem.path;
          ctx.editorModal.fileName = cursorItem.name;
          ctx.editorModal.open = true;
        }
        break;

      case "copy":
        if (selectedPaths.length > 0) {
          ctx.operationModal.opType = "copy";
          ctx.operationModal.sourceItems = selectedPaths;
          ctx.operationModal.targetDir =
            ctx.oppositePaneState.value.currentPath;
          ctx.operationModal.open = true;
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

      case "move":
        if (selectedPaths.length > 0) {
          ctx.operationModal.opType = "move";
          ctx.operationModal.sourceItems = selectedPaths;
          ctx.operationModal.targetDir =
            ctx.oppositePaneState.value.currentPath;
          ctx.operationModal.open = true;
        }
        break;

      case "mkdir":
        ctx.operationModal.opType = "mkdir";
        ctx.operationModal.sourceItems = [];
        ctx.operationModal.targetDir = ctx.activePaneState.value.currentPath;
        ctx.operationModal.open = true;
        break;

      case "newfile":
        ctx.operationModal.opType = "newfile";
        ctx.operationModal.sourceItems = [];
        ctx.operationModal.targetDir = ctx.activePaneState.value.currentPath;
        ctx.operationModal.open = true;
        break;

      case "delete":
        if (selectedPaths.length > 0) {
          ctx.operationModal.opType = "delete";
          ctx.operationModal.sourceItems = selectedPaths;
          ctx.operationModal.targetDir = "";
          ctx.operationModal.open = true;
        }
        break;

      case "permanent-delete":
        if (selectedPaths.length > 0) {
          ctx.operationModal.opType = "delete";
          ctx.operationModal.sourceItems = selectedPaths;
          ctx.operationModal.targetDir = "PERMANENT";
          ctx.operationModal.open = true;
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
  }) {
    ctx.createArchiveModal.open = false;
    ctx.showToast("Створення архіву...", "success");
    try {
      const rawSources = JSON.parse(
        JSON.stringify(ctx.createArchiveModal.sourceItems),
      );
      const res = await window.electronAPI.createArchive(
        rawSources,
        payload.fullTarget,
      );
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
          if (item.isApp) {
            await openFileNative(item);
          } else if (item.isDirectory) {
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
          if (ctx.contextMenuState.paneId === "left") {
            ctx.leftPaneRef.value?.calculateDirectorySize(item.path);
          } else {
            ctx.rightPaneRef.value?.calculateDirectorySize(item.path);
          }
        }
        break;

      case "folder-size-modal":
        if (item && item.isDirectory) {
          ctx.folderSizeModal.folderPath = item.path;
          ctx.folderSizeModal.open = true;
        }
        break;

      case "large-files": {
        const targetPath =
          item && item.isDirectory
            ? item.path
            : ctx.activePaneState.value.currentPath;
        ctx.largeFilesModal.initialDir = targetPath;
        ctx.largeFilesModal.open = true;
        break;
      }

      case "view":
        if (item && !item.isDirectory) {
          ctx.viewerModal.filePath = item.path;
          ctx.viewerModal.fileName = item.name;
          ctx.viewerModal.fileSize = item.size;
          ctx.viewerModal.open = true;
        }
        break;

      case "edit":
        if (item && !item.isDirectory) {
          ctx.editorModal.filePath = item.path;
          ctx.editorModal.fileName = item.name;
          ctx.editorModal.open = true;
        }
        break;

      case "copy":
        handleBottomAction("copy");
        break;

      case "move":
        handleBottomAction("move");
        break;

      case "rename":
        handleBottomAction("rename");
        break;

      case "delete":
        handleBottomAction("delete");
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
        ctx.pasteFromClipboard(ctx.activePaneState.value.currentPath, () =>
          Promise.all([
            ctx.loadDirectory(ctx.leftPane, ctx.leftPane.currentPath),
            ctx.loadDirectory(ctx.rightPane, ctx.rightPane.currentPath),
          ]).then(() => {}),
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
      if (opType === "mkdir") {
        const fullPath = `${ctx.activePaneState.value.currentPath}/${target}`;
        const res = await window.electronAPI.createFolder(fullPath);
        if (res.success) {
          ctx.showToast(`Created directory "${target}"`, "success");
          ctx.refreshPane(ctx.activePaneId.value);
        } else {
          ctx.showToast(`Error creating folder: ${res.error}`, "error");
        }
      } else if (opType === "newfile") {
        const fullPath = `${ctx.activePaneState.value.currentPath}/${target}`;
        const res = await window.electronAPI.createFile(fullPath);
        if (res.success) {
          ctx.showToast(`Created file "${target}"`, "success");
          ctx.refreshPane(ctx.activePaneId.value);
        } else {
          ctx.showToast(`Error creating file: ${res.error}`, "error");
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
        const res = await window.electronAPI.copyPaths(rawSources, target);
        if (res.success) {
          ctx.showToast(`Copied ${rawSources.length} item(s)`, "success");
          ctx.refreshAllPanes();
        } else {
          ctx.showToast(`Copy error: ${res.error}`, "error");
        }
      } else if (opType === "move") {
        const res = await window.electronAPI.movePaths(rawSources, target);
        if (res.success) {
          ctx.showToast(`Moved ${rawSources.length} item(s)`, "success");
          ctx.refreshAllPanes();
        } else {
          ctx.showToast(`Move error: ${res.error}`, "error");
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

      const res = isMove
        ? await window.electronAPI.movePaths(rawPaths, targetDir)
        : await window.electronAPI.copyPaths(rawPaths, targetDir);

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
        ctx.refreshAllPanes();
      } else {
        ctx.showToast(`Помилка drag & drop: ${res.error}`, "error");
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
  };
}
