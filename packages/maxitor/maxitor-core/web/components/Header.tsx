// packages/maxitor/maxitor-core/web/components/Header.tsx
// The frame's header (mockup 4.2–4.5): the organization's name with its switch, the person's icon with the name
// and email on hover, and the icon's menu: organizations, registering one, the ways in, signing out.
"use client";

import { useState } from "react";

import { signOut } from "@/app/actions";
import { Icon } from "@/components/marks";
import { SignInMethods } from "@/components/SignInMethods";
import { colorOf, initials } from "@/lib/colors";
import type { Me } from "@/lib/core";

type Pop = "me" | "orgs" | "methods" | null;

export function Header({ account, current, methods }: { account: Me; current: { code: string; name: string } | null; methods: string | null }) {
  const [pop, setPop] = useState<Pop>(methods ? "methods" : null);
  const [tip, setTip] = useState(false);
  const orgs = account.organizations;

  const orgItems = orgs.map((o) => (
    <a key={o.code} className="mi" href={`/w/${o.code}`}>
      <span className="oa" style={{ background: colorOf(o.code) }}>{o.name[0]}</span>
      {o.name}
      {current?.code === o.code ? <span className="ck"><Icon.check /></span> : <span className="code">/w/{o.code}</span>}
    </a>
  ));

  return (
    <>
      <div className="hdr">
        <span className="logo"><span className="mk">M</span>Maxitor</span>
        {current ? (
          <span className="crumb">
            <span className="ct"><span className="lv">org</span>{current.name}</span>
            {orgs.length > 1 ? (
              <span className="cvr" role="button" tabIndex={0} title="Your organizations" aria-label="Your organizations" onClick={() => setPop(pop === "orgs" ? null : "orgs")}>
                <Icon.down />
              </span>
            ) : null}
          </span>
        ) : null}
        <span className="spacer" />
        <span
          className={`avatar${pop === "me" ? " on" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={`${account.name}, ${account.email}`}
          onMouseEnter={() => setTip(true)}
          onMouseLeave={() => setTip(false)}
          onClick={() => { setTip(false); setPop(pop === "me" ? null : "me"); }}
        >
          {initials(account.name)}
        </span>
        {tip && !pop ? <div className="tip">{account.name}<br /><span>{account.email}</span></div> : null}
        {pop === "me" ? (
          <div className="menu">
            <div className="who"><b>{account.name}</b><div>{account.email}</div></div>
            <div className="mg">Organizations</div>
            {orgItems}
            <a className="mi" href="/new"><Icon.plus />Register an organization</a>
            <hr />
            <button type="button" className="mi" onClick={() => setPop("methods")}><Icon.key />Sign-in methods</button>
            <button type="button" className="mi" onClick={() => void signOut()}><Icon.out />Sign out</button>
          </div>
        ) : null}
        {pop === "orgs" ? (
          <div className="menu" style={{ left: 150, right: "auto", width: 300 }}>
            <div className="mg">Your organizations</div>
            {orgItems}
            <hr />
            <a className="mi" href="/new"><Icon.plus />Register an organization</a>
          </div>
        ) : null}
      </div>
      {pop === "me" || pop === "orgs" ? <div style={{ position: "fixed", inset: 0, zIndex: 15 }} onClick={() => setPop(null)} /> : null}
      {pop === "methods" ? <SignInMethods account={account} back={current ? `/w/${current.code}` : "/w"} notice={methods} onClose={() => setPop(null)} /> : null}
    </>
  );
}
