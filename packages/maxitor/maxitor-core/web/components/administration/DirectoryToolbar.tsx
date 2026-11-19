"use client";
import type { ReactNode } from "react";

/** Directory search belongs to the canvas; view selection is owned by the core shell. */
export function DirectoryToolbar({ children }: { children: ReactNode }) {
  return <div className="directory-toolbar">{children}</div>;
}
