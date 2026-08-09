"use client";

import { useEffect, useRef, useState } from "react";
import type { LayoutCell } from "./seat-layout-editor";
import { HallLayoutPreview } from "./hall-layout-preview";

export function HallLayoutPreviewDialog({ cells, centerAfterColumn, label }: { cells: LayoutCell[]; centerAfterColumn: number | null; label: string }) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <>
    <button className="button" type="button" onClick={() => setOpen(true)}>预览</button>
    {open ? <div className="preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="saved-layout-preview-title">
        <div className="preview-dialog-header"><div><p className="eyebrow">已保存座位布局</p><h2 id="saved-layout-preview-title">{label}</h2></div><button className="button" type="button" ref={closeButtonRef} onClick={() => setOpen(false)}>关闭</button></div>
        <HallLayoutPreview cells={cells} centerAfterColumn={centerAfterColumn} />
      </section>
    </div> : null}
  </>;
}
