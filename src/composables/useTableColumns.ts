import type { Ref } from "vue";

export const DEFAULT_COL_WIDTHS: Record<string, string> = {
  name: "auto",
  ext: "70px",
  size: "90px",
  date: "140px",
  perms: "95px",
};

export function useTableColumns(wrapperRef: Ref<HTMLElement | null>) {
  function applyColWidths(widths: Record<string, string>) {
    if (!wrapperRef.value) return;
    for (const [col, val] of Object.entries(widths)) {
      wrapperRef.value.style.setProperty(`--col-${col}-w`, val);
    }
  }

  function saveColWidths() {
    if (!wrapperRef.value) return;
    const widths: Record<string, string> = {};
    for (const col of Object.keys(DEFAULT_COL_WIDTHS)) {
      const val = wrapperRef.value.style.getPropertyValue(`--col-${col}-w`);
      if (val) widths[col] = val;
    }
    try {
      localStorage.setItem("tc_col_widths", JSON.stringify(widths));
    } catch {}
  }

  function startResize(col: string, e: MouseEvent) {
    e.preventDefault();
    const th = (e.currentTarget as HTMLElement).closest("th");
    if (!th || !wrapperRef.value) return;
    const startX = e.clientX;
    const startWidth = th.offsetWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(40, startWidth + delta);
      wrapperRef.value?.style.setProperty(`--col-${col}-w`, `${newWidth}px`);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      saveColWidths();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function resetColWidth(col: string) {
    if (!wrapperRef.value) return;
    const def = DEFAULT_COL_WIDTHS[col] || "auto";
    wrapperRef.value.style.setProperty(`--col-${col}-w`, def);
    saveColWidths();
  }

  function loadSavedColWidths() {
    try {
      const saved = localStorage.getItem("tc_col_widths");
      if (saved) {
        applyColWidths(JSON.parse(saved));
      }
    } catch {}
  }

  return {
    startResize,
    resetColWidth,
    loadSavedColWidths,
    applyColWidths,
    saveColWidths,
  };
}
