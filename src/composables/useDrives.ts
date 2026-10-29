import { ref } from "vue";
import type { DriveItem, PaneState } from "@/types";

export function useDrives(
  showToast: (message: string, type?: "success" | "error" | "shortcut") => void,
) {
  const drives = ref<DriveItem[]>([]);
  const homeDir = ref("/");

  async function loadDrivesList() {
    try {
      const drivesRes = await window.electronAPI.getDrives();
      if (drivesRes.success && drivesRes.data) {
        drives.value = drivesRes.data;
      }
    } catch (err) {
      console.error("Failed to load drives:", err);
    }
  }

  async function ejectDrive(
    path: string,
    leftPane: PaneState,
    rightPane: PaneState,
    navigatePane: (paneKey: "left" | "right", path: string) => void,
  ) {
    try {
      const home = homeDir.value || "/";
      let navigated = false;

      // Release active file locks: navigate away from this drive if currently open in either pane
      if (leftPane.currentPath.startsWith(path)) {
        await navigatePane("left", home);
        navigated = true;
      }
      if (rightPane.currentPath.startsWith(path)) {
        await navigatePane("right", home);
        navigated = true;
      }

      for (const tab of leftPane.tabs) {
        if (tab.path.startsWith(path)) {
          tab.path = home;
          tab.title = "Home";
        }
      }
      for (const tab of rightPane.tabs) {
        if (tab.path.startsWith(path)) {
          tab.path = home;
          tab.title = "Home";
        }
      }

      if (navigated) {
        await new Promise((r) => setTimeout(r, 200));
      }

      const res = await window.electronAPI.ejectVolume(path);
      if (res.success) {
        drives.value = drives.value.filter((d) => !d.path.startsWith(path));
        showToast("Носій безпечно вилучено", "success");
        await loadDrivesList();
      } else {
        showToast(res.error || "Не вдалося вилучити носій", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Помилка вилучення носія", "error");
    }
  }

  return {
    drives,
    homeDir,
    loadDrivesList,
    ejectDrive,
  };
}
