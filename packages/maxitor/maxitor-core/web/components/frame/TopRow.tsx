// packages/maxitor/maxitor-core/web/components/frame/TopRow.tsx
// The frame's top row (spec 077, FR-004): the organization with its switch, the path to the open node, the places of
// the time scale (#98) and of who is on the page (#76), and the person's icon with its menu.
"use client";

import Link from "next/link";
import { useState } from "react";

import { signOut } from "@/app/actions";
import { SignInMethods } from "@/components/SignInMethods";
import { Icon } from "@/components/marks";
import { colorOf, initials } from "@/lib/colors";
import type { Me } from "@/lib/core";

type Pop = "me" | "orgs" | "methods" | null;

export function TopRow({
  account,
  current,
  path,
  methods,
  switchTo,
  onMenu,
}: {
  account: Me;
  current: { code: string; name: string };
  /** The titles from the tree's root to the open node. */
  path: string[];
  /** The sign-in methods dialog to open on arrival, as the address asks after linking a way in. */
  methods: string | null;
  /** The address of the same page in another organization. */
  switchTo: (code: string) => string;
  onMenu: () => void;
}) {
  const [pop, setPop] = useState<Pop>(methods ? "methods" : null);
  const orgs = account.organizations;

  const orgItems = orgs.map((o) => (
    <Link key={o.code} className="mx-menu-item" href={switchTo(o.code)} onClick={() => setPop(null)}>
      <span className="mx-menu-mark" style={{ background: colorOf(o.code) }}>{o.name[0]}</span>
      {o.name}
      {current.code === o.code ? <span className="mx-tick"><Icon.check /></span> : <span className="mx-code">/w/{o.code}</span>}
    </Link>
  ));

  return (
    <>
      <div className="mx-top">
        <button type="button" className="mx-burger" aria-label="The organization's tree" onClick={onMenu}>
          <Icon.menu />
        </button>
        <span className="mx-logo"><span className="mx-logo-mark">M</span><span className="mx-logo-name">Maxitor</span></span>
        <span className="mx-org">
          <Link className="mx-org-name" href={`/w/${current.code}`}><span className="mx-org-kind">org</span>{current.name}</Link>
          {orgs.length > 1 ? (
            <button type="button" className="mx-org-switch" title="Your organizations" aria-label="Your organizations" onClick={() => setPop(pop === "orgs" ? null : "orgs")}>
              <Icon.down />
            </button>
          ) : null}
        </span>
        <nav className="mx-path" aria-label="Path">
          {path.map((title, index) => (
            <span key={`${index}-${title}`} style={{ display: "contents" }}>
              {index > 0 ? <span className="mx-path-sep">›</span> : null}
              <span className="mx-path-step">{title}</span>
            </span>
          ))}
        </nav>
        {/* The time scale of #98 stands here. */}
        <span className="mx-slot" data-slot="moment" />
        {/* Who is on the page, #76, stands here. */}
        <span className="mx-slot" data-slot="presence" />
        <button
          type="button"
          className={`mx-avatar${pop === "me" ? " on" : ""}`}
          title={`${account.name}\n${account.email}`}
          aria-label={`${account.name}, ${account.email}`}
          onClick={() => setPop(pop === "me" ? null : "me")}
        >
          {initials(account.name)}
        </button>
        {pop === "me" ? (
          <div className="mx-menu">
            <div className="mx-menu-who"><b>{account.name}</b>{account.email}</div>
            <div className="mx-menu-group">Organizations</div>
            {orgItems}
            <a className="mx-menu-item" href="/new"><Icon.plus />Register an organization</a>
            <hr />
            <button type="button" className="mx-menu-item" onClick={() => setPop("methods")}><Icon.key />Sign-in methods</button>
            <button type="button" className="mx-menu-item" onClick={() => void signOut()}><Icon.out />Sign out</button>
          </div>
        ) : null}
        {pop === "orgs" ? (
          <div className="mx-menu left">
            <div className="mx-menu-group">Your organizations</div>
            {orgItems}
            <hr />
            <a className="mx-menu-item" href="/new"><Icon.plus />Register an organization</a>
          </div>
        ) : null}
      </div>
      {pop === "me" || pop === "orgs" ? <div className="mx-veil" onClick={() => setPop(null)} /> : null}
      {pop === "methods" ? <SignInMethods account={account} back={`/w/${current.code}`} notice={methods} onClose={() => setPop(null)} /> : null}
    </>
  );
}
