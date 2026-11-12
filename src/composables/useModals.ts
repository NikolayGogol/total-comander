import { reactive, computed } from "vue";
import type { FileItem, TransferProgressData } from "@/types";

export function useModals() {
  const viewerModal = reactive({
    open: false,
    filePath: "",
    fileName: "",
    fileSize: 0,
  });

  const editorModal = reactive({
    open: false,
    filePath: "",
    fileName: "",
  });

  const operationModal = reactive<{
    open: boolean;
    opType: "copy" | "move" | "mkdir" | "newfile" | "delete" | "rename";
    sourceItems: string[];
    targetDir: string;
  }>({
    open: false,
    opType: "copy",
    sourceItems: [],
    targetDir: "",
  });

  const searchModal = reactive({
    open: false,
    initialDir: "",
  });

  const createArchiveModal = reactive<{
    open: boolean;
    sourceItems: string[];
    targetDir: string;
    loading: boolean;
  }>({
    open: false,
    sourceItems: [],
    targetDir: "",
    loading: false,
  });

  const archiveViewModal = reactive<{
    open: boolean;
    archivePath: string;
    destinationDir: string;
  }>({
    open: false,
    archivePath: "",
    destinationDir: "",
  });

  const largeFilesModal = reactive<{
    open: boolean;
    initialDir: string;
  }>({
    open: false,
    initialDir: "",
  });

  const folderSizeModal = reactive<{
    open: boolean;
    folderPath: string;
  }>({
    open: false,
    folderPath: "",
  });

  const unlockerModal = reactive<{
    open: boolean;
    targetPath: string;
    targetName: string;
    isDirectory: boolean;
    oppositePath: string;
  }>({
    open: false,
    targetPath: "",
    targetName: "",
    isDirectory: false,
    oppositePath: "",
  });

  const virtualDisksModal = reactive({
    open: false,
  });

  const operationProgressModal = reactive({
    open: false,
    targetDir: "",
    data: {
      operationId: "",
      type: "copy" as "copy" | "move",
      currentFile: "",
      currentDir: "",
      itemsDone: 0,
      totalItems: 0,
      bytesTransferred: 0,
      totalBytes: 0,
      bytesRemaining: 0,
      speedBytesPerSec: 0,
      etaSeconds: -1,
      elapsedSeconds: 0,
      percent: 0,
      isDone: false,
      canceled: false,
      error: undefined as string | undefined,
    } as TransferProgressData,
  });

  const openWithModal = reactive<{
    open: boolean;
    item: FileItem | null;
  }>({
    open: false,
    item: null,
  });

  const contextMenuState = reactive<{
    visible: boolean;
    x: number;
    y: number;
    item: FileItem | null;
    paneId: "left" | "right";
  }>({
    visible: false,
    x: 0,
    y: 0,
    item: null,
    paneId: "left",
  });

  const isAnyModalOpen = computed(() => {
    return (
      viewerModal.open ||
      editorModal.open ||
      operationModal.open ||
      searchModal.open ||
      createArchiveModal.open ||
      archiveViewModal.open ||
      largeFilesModal.open ||
      folderSizeModal.open ||
      unlockerModal.open ||
      virtualDisksModal.open ||
      operationProgressModal.open ||
      openWithModal.open
    );
  });

  function closeAllModals() {
    viewerModal.open = false;
    editorModal.open = false;
    operationModal.open = false;
    searchModal.open = false;
    createArchiveModal.open = false;
    archiveViewModal.open = false;
    largeFilesModal.open = false;
    folderSizeModal.open = false;
    unlockerModal.open = false;
    virtualDisksModal.open = false;
    operationProgressModal.open = false;
    openWithModal.open = false;
  }

  return {
    viewerModal,
    editorModal,
    operationModal,
    searchModal,
    createArchiveModal,
    archiveViewModal,
    largeFilesModal,
    folderSizeModal,
    unlockerModal,
    virtualDisksModal,
    operationProgressModal,
    openWithModal,
    contextMenuState,
    isAnyModalOpen,
    closeAllModals,
  };
}

export type ModalsState = ReturnType<typeof useModals>;
