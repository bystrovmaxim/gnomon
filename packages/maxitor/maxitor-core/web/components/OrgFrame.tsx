// packages/maxitor/maxitor-core/web/components/OrgFrame.tsx
// The organization's frame (mockups 072 4.1 and 073 1.5, 7.1, 7.2): the header, the column on the left — the tree with
// the enabled plugins' groups and a quiet "Settings" at its foot for an administrator, or in Settings the settings'
// own column — and the page. On a phone the column is a drawer the header's button opens.
"use client";

import { useState, type ReactNode } from "react";

import { Header } from "@/components/Header";
import { Icon } from "@/components/marks";
import type { Me } from "@/lib/core";

export type TreePlugin = { passport_id: string; name: string; title: string; sections: { title: string; path: string }[] };

function OrgTree({ code, plugins, isAdmin }: { code: string; plugins: TreePlugin[]; isAdmin: boolean }) {
  return (
    <>
      <div className="tree">
        {plugins.length === 0 ? <div className="sb-empty">Nothing here yet.<br />Plugins add their sections to this tree.</div> : null}
        {plugins.map((plugin) => (
          <div key={plugin.passport_id}>
            <div className="tg"><span className="slot"><Icon.chevron /></span><span className="lb">{plugin.title}</span></div>
            {plugin.sections.map((section) => (
              <a key={section.title} className="ti" href={`/w/${code}/p/${plugin.name}${section.path}`}>
                <span className="slot"><Icon.page /></span><span className="lb">{section.title}</span>
              </a>
            ))}
          </div>
        ))}
      </div>
      {isAdmin ? (
        <div className="sb-foot">
          <a className="ti" href={`/w/${code}/settings/plugins`}><span className="slot"><Icon.gear /></span><span className="lb">Settings</span></a>
        </div>
      ) : null}
    </>
  );
}

function SettingsNav({ code }: { code: string }) {
  return (
    <div className="tree">
      <div className="tg"><span className="slot"><Icon.chevron /></span><span className="lb">Settings</span></div>
      <a className="ti on" href={`/w/${code}/settings/plugins`} aria-current="page"><span className="slot"><Icon.puzzle /></span><span className="lb">Plugins</span></a>
    </div>
  );
}

export function OrgFrame({
  account,
  current,
  isAdmin,
  plugins,
  settings = false,
  methods = null,
  children,
}: {
  account: Me;
  current: { code: string; name: string };
  isAdmin: boolean;
  plugins: TreePlugin[];
  settings?: boolean;
  /** The sign-in methods dialog to open on arrival, as the address asks after linking a way in. */
  methods?: string | null;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const column = settings ? <SettingsNav code={current.code} /> : <OrgTree code={current.code} plugins={plugins} isAdmin={isAdmin} />;
  return (
    <div className="frame">
      <Header account={account} current={current} methods={methods} trail={settings ? "Settings" : null} onMenu={() => setDrawer(true)} />
      <div className="body">
        <aside className="sb">{column}</aside>
        {children}
        {drawer ? (
          <>
            <div className="scrim" onClick={() => setDrawer(false)} />
            <aside className="sb drawer">{column}</aside>
          </>
        ) : null}
      </div>
    </div>
  );
}
