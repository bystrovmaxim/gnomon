"use client";
import { useCanvas } from "@maxitor/panel";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { pinnedColumnOffset } from "./pinnedColumn";

/** One real identity cell per row: counter the canvas translation, retaining row height and actions. */
export function UserTable({ children }: { children: ReactNode }) {
  const canvas = useCanvas();
  const table = useRef<HTMLTableElement>(null);
  const [offset, setOffset] = useState(0);
  const x = canvas?.camera.x ?? 0;
  const zoom = canvas?.camera.zoom ?? 1;
  useLayoutEffect(() => {
    const element = table.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const cell = element.querySelector("th")?.getBoundingClientRect();
      setOffset(cell ? pinnedColumnOffset(rect.left, rect.width, cell.width, zoom) : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [x, zoom, canvas?.viewport.width]);
  return <table ref={table} className="utbl user-directory" data-pinned={offset > 0 || undefined} style={{ "--user-pin-offset": `${offset}px` } as CSSProperties}>{children}</table>;
}
