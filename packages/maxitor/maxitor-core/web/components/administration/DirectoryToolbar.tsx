"use client";
import type { ReactNode } from "react";

/** Like Plugins, directory navigation belongs to the canvas content. */
export function DirectoryToolbar({ children }: { children: ReactNode }) {
  return <div className="directory-toolbar">{children}</div>;
}
