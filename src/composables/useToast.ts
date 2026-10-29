import { ref } from "vue";

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "shortcut";
  shortcut?: string;
}

export function useToast() {
  const toasts = ref<ToastItem[]>([]);
  let toastCounter = 0;

  function showToast(
    message: string,
    type: "success" | "error" | "shortcut" = "success",
    shortcut?: string,
  ) {
    const id = ++toastCounter;
    if (type === "shortcut") {
      toasts.value = toasts.value.filter((t) => t.type !== "shortcut");
    }
    toasts.value.push({ id, message, type, shortcut });
    setTimeout(
      () => {
        toasts.value = toasts.value.filter((t) => t.id !== id);
      },
      type === "shortcut" ? 2200 : 3500,
    );
  }

  function showShortcutToast(shortcut: string, message: string) {
    showToast(message, "shortcut", shortcut);
  }

  return {
    toasts,
    showToast,
    showShortcutToast,
  };
}
