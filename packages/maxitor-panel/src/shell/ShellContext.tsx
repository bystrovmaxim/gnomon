// @maxitor/panel — what the shell and the canvas inside it share: the canvas gives the shell its zoom, so the zoom
// stands first in the shell's bottom bar; the shell gives the canvas the room its controls take, so a fitted scene
// lies clear of them.
"use client";

import { createContext, useContext } from "react";

/** The zoom a canvas gives the shell's bottom bar. */
export type Zoom = { zoom: number; zoomIn: () => void; zoomOut: () => void; fit: () => void };

/** The room the shell's controls take at the edges of the panel, in screen pixels. */
export type Reserve = { left: number; top: number; bottom: number };

export type Shell = {
  /** Called by a canvas when it mounts, moves its zoom, and unmounts (with null). */
  setZoom: (zoom: Zoom | null) => void;
  /** The room the controls take now, measured. */
  reserve: () => Reserve;
};

export const ShellContext = createContext<Shell | null>(null);

/** The shell a canvas lies in, or null outside one. */
export function useShell(): Shell | null {
  return useContext(ShellContext);
}
