// @maxitor/panel — the content box of a page; its title goes to the core's top row and the browser tab.
"use client";

import { useEffect, type ReactNode } from "react";

import { usePanel } from "./PanelProvider";

export function PanelPage({ title, children }: { title: string; children: ReactNode }) {
  const { send } = usePanel();
  useEffect(() => send({ type: "panel.title", text: title }), [send, title]);
  return <div className="mx-page">{children}</div>;
}
