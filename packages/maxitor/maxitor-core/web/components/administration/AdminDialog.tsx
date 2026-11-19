"use client";
import { Dialog } from "@maxitor/panel";
import type { ReactNode } from "react";
import "./administration.css";
/** Administrative forms use the platform portal, scrim, Escape and mobile sheet. */
export function AdminDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <Dialog title={title} onClose={onClose} heading={false}><div className="mx-administration admin-dialog-content">{children}</div></Dialog>;
}
