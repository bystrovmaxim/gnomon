// packages/maxitor/maxitor-core/web/components/Paper.tsx
// A public page of text (mockup 6.1, 6.2): the mark, the title, the date it last changed, the links at its foot.
import type { ReactNode } from "react";

export function Paper({ title, children, version }: { title: string; children: ReactNode; version?: string }) {
  return (
    <div className="doc">
      <article className="paper">
        <div className="lg"><span className="mk">M</span>Maxitor</div>
        <h1>{title}</h1>
        <div className="upd">Last updated 9 November 2026</div>
        {version ? <p style={{ marginTop: -12, fontSize: 12, color: "var(--muted)" }}>Version {version}</p> : null}
        {children}
        <div className="foot"><a href="/">Sign in</a><a href="/privacy">Privacy</a><a href="/data-deletion">Delete my data</a></div>
      </article>
    </div>
  );
}
