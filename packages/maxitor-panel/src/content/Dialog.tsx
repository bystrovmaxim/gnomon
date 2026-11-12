// @maxitor/panel — a dialog of a page: over the canvas and the page's content, under nothing of the frame; a sheet
// from below on a phone. A page may place nothing fixed of its own (spec 078, FR-019), so a dialog is the shell's.
// Escape and a press on the scrim close it. It is drawn in the document's body: inside the canvas's moved and zoomed
// scene a fixed box would follow the scene, not the screen.
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => setBody(document.body), []);
  if (!body) return null;
  return createPortal(
    <>
      {/* A portal's events still rise through the page's tree: they stop here, or a canvas around would take the pointer. */}
      <div className="mx-dialog-scrim" onClick={onClose} onPointerDown={(event) => event.stopPropagation()} />
      <div
        className="mx-dialog"
        role="dialog"
        aria-label={title}
        onWheel={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <b className="mx-dialog-title">{title}</b>
        {children}
      </div>
    </>,
    body,
  );
}
