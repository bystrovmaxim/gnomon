// packages/maxitor/maxitor-core/web/components/PluginsPage.tsx
// Settings → Plugins (specs/073-plugin-marketplace/mockup 1.1–3.4, 5.1–5.11): the Installed and Marketplace tabs with
// one search, the details panel, installing with its checks, disabling and its refusal, enabling, a failed install
// retried or dropped, and a private plugin by a release's address or by uploading its wheel. While the installer has
// work on the page — an install or a private version's check — the page reads its state again every few seconds.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  addPrivatePlugin,
  changePlugin,
  listPlugins,
  pluginDetails,
  uploadPrivatePlugin,
  type Card,
  type Details,
  type Installed,
  type Listing,
} from "@/app/plugins";
import { Icon } from "@/components/marks";
import { colorOf } from "@/lib/colors";
import type { Refusal } from "@/lib/core";

const MAX_WHEEL = 50 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;

type Dialog =
  | { kind: "install"; passportId: string }
  | { kind: "disable"; row: Installed }
  | { kind: "needed"; row: Installed; dependents: { passport_id: string; title: string }[] }
  | { kind: "private"; mode: "release" | "upload" }
  | null;

/** The page's words for the backend's refusals. */
function refusalText(refusal: Refusal): string {
  switch (refusal.error) {
    case "missing_dependency":
      return `It needs ${(refusal.missing as string[]).join(", ")}, which is not installed here. Install it first.`;
    case "core_range":
      return `It needs core ${String(refusal.range)}; this Maxitor runs another version.`;
    case "already_installed":
      return "It is already installed here.";
    case "not_installable":
      return "It is not offered any more.";
    case "dependency_disabled":
      return `It needs ${(refusal.dependencies as string[]).join(", ")}, which is disabled. Enable it first.`;
    case "pypi_is_public":
      return "A package on PyPI is the public marketplace's. A private plugin comes from GitHub or GitLab.";
    case "not_a_purl":
      return "Not a Package URL of a release: pkg:github/<owner>/<repo>@<tag>?file=<wheel> or pkg:gitlab/…";
    case "no_file":
      return "Name the wheel: add ?file=<name>.whl — a release can carry several files.";
    case "sha256_form":
      return `A SHA-256 is 64 hexadecimal characters; this has ${String(refusal.length)}.`;
    case "too_large":
      return "A plugin's wheel may be at most 50 MB.";
    case "not_a_wheel":
      return "The file is not a wheel.";
    case "not_found":
      return "No such plugin here.";
    default:
      return "Something went wrong. Try again.";
  }
}

function initial(title: string): string {
  return (title.trim()[0] ?? "?").toUpperCase();
}

/** ``text`` with the search's match marked. */
function marked(text: string, query: string): ReactNode {
  const q = query.trim();
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

function Tile({ id, title, large }: { id: string; title: string; large?: boolean }) {
  return <span className={`ptile${large ? " lg" : ""}`} style={{ background: colorOf(id) }}>{initial(title)}</span>;
}

function StateBadge({ state }: { state: string }) {
  const busy = state === "installing" || state === "removing" || state === "draft";
  const label = state === "draft" ? "checking" : state;
  return <span className={`stt ${label}`}>{busy ? <span className="spin" /> : null}{label}</span>;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

async function sha256Of(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function base64Of(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

export function PluginsPage({ code, orgName, initial: first }: { code: string; orgName: string; initial: Listing }) {
  const [tab, setTab] = useState<"installed" | "market">("installed");
  const [query, setQuery] = useState("");
  const [listing, setListing] = useState<Listing>(first);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [panel, setPanel] = useState<Details | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const searched = useRef(query);

  const reload = useCallback(async () => {
    const answer = await listPlugins(code, searched.current);
    if (answer.ok) setListing(answer.data);
  }, [code]);

  useEffect(() => {
    searched.current = query;
    const timer = setTimeout(() => void reload(), 250);
    return () => clearTimeout(timer);
  }, [query, reload]);

  const waiting = listing.installed.some((r) => r.state === "installing" || r.state === "removing") || listing.private.some((c) => c.state === "draft");
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void reload(), 3000);
    return () => clearInterval(timer);
  }, [waiting, reload]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function change(row: { passport_id: string; title: string }, verb: "install" | "retry" | "drop" | "disable" | "enable", done: string) {
    setFailure(null);
    const answer = await changePlugin(code, row.passport_id, verb);
    if (!answer.ok) {
      if (answer.refusal.error === "needed_by" && "state" in row) {
        setDialog({ kind: "needed", row: row as Installed, dependents: answer.refusal.dependents as { passport_id: string; title: string }[] });
        return;
      }
      setDialog(null);
      setFailure(`${row.title}: ${refusalText(answer.refusal)}`);
      return;
    }
    setDialog(null);
    setPanel(null);
    if (verb === "install") setTab("installed");
    setToast(done);
    await reload();
  }

  async function openDetails(passportId: string) {
    const answer = await pluginDetails(code, passportId);
    if (answer.ok) setPanel(answer.data);
  }

  const rowActions = (row: Installed) => {
    switch (row.state) {
      case "enabled":
        return <button type="button" className="btn2" onClick={() => setDialog({ kind: "disable", row })}>Disable</button>;
      case "disabled":
        return <button type="button" className="btn2" onClick={() => void change(row, "enable", `${row.title} is enabled again.`)}>Enable</button>;
      case "failed":
        return (
          <>
            <button type="button" className="btn2 pri" onClick={() => void change(row, "retry", `${row.title} is being installed again.`)}>Retry</button>
            <button type="button" className="btn2 danger" onClick={() => void change(row, "drop", `The failed install of ${row.title} is dropped.`)}>Drop</button>
          </>
        );
      default:
        return null;
    }
  };

  const installedRow = (row: Installed) => (
    <div key={`${row.passport_id}-${row.installed_at}`} className={`prow${row.state === "removed" ? " gone" : ""}`}>
      <Tile id={row.passport_id} title={row.title} />
      <div className="pmain">
        <div className="ptitle">
          <button type="button" className="plink" onClick={() => void openDetails(row.passport_id)}>{marked(row.title, query)}</button>
          <span className="ver">{row.version}</span>
          <StateBadge state={row.state} />
          {row.private ? <span className="stt private">private</span> : null}
        </div>
        {query.trim() && !row.title.toLowerCase().includes(query.trim().toLowerCase()) ? (
          <div className="pmeta matched">{marked(row.description.toLowerCase().includes(query.trim().toLowerCase()) ? row.description : row.passport_id, query)}</div>
        ) : null}
        <div className="pmeta">
          <span className="mono">{row.purl}</span>
          <br />
          {row.state === "removed" ? `Removed — kept in ${orgName}'s history` : `Installed by ${row.installed_by} on ${day(row.installed_at)}`}
          {row.depends_on.length ? <> · needs <b>{row.depends_on.join(", ")}</b></> : null}
        </div>
        {row.state === "installing" ? <div className="prog"><div className="cur"><span className="spin" />The installer is building and enabling it…</div></div> : null}
        {row.state === "failed" ? <div className="pnote bad"><Icon.alert /><div><b>The install failed:</b> {row.reason}. Nothing of {orgName} was changed.</div></div> : null}
        {row.withdrawn && row.state !== "removed" ? (
          <div className="pnote warn"><Icon.info /><div><b>Withdrawn from the marketplace.</b> It keeps working here; no organization can install it anew.</div></div>
        ) : null}
      </div>
      <div className="pacts">{rowActions(row)}</div>
    </div>
  );

  const card = (c: Card) => (
    <div key={`${c.passport_id}-${c.version}`} className={`mcard${c.fits_core || c.state !== "active" ? "" : " dim"}`}>
      <div className="top">
        <Tile id={c.passport_id} title={c.title} />
        <div className="pmain">
          <div className="ptitle">
            {marked(c.title, query)}
            <span className="ver">{c.version}</span>
            {c.state !== "active" ? <StateBadge state={c.state} /> : null}
            {c.private ? <span className="stt private">private</span> : null}
          </div>
          <div className="by">{c.private ? `${orgName}'s own` : "Maxitor marketplace"} · <span className="mono">{c.state === "active" ? marked(c.passport_id, query) : c.purl}</span></div>
        </div>
      </div>
      {c.state === "active" ? (
        <>
          {c.description ? <div className="desc">{marked(c.description, query)}</div> : null}
          <div className="reqs">
            <div className={`req ${c.fits_core ? "ok" : "bad"}`}>{c.fits_core ? <Icon.check /> : <Icon.x />}{c.fits_core ? "Works with this Maxitor" : "Needs another version of the core"}</div>
            {c.dependencies.map((d) => (
              <div key={d.passport_id} className={`req ${d.installed ? "ok" : "bad"}`}>{d.installed ? <Icon.check /> : <Icon.x />}Needs {d.passport_id}{d.installed ? " — installed" : " — not installed"}</div>
            ))}
          </div>
          <div className="ft">
            <button type="button" className="lnk2" onClick={() => void openDetails(c.passport_id)}>Details</button>
            <button type="button" className="btn2 pri" disabled={!c.fits_core} onClick={() => setDialog({ kind: "install", passportId: c.passport_id })}>Install</button>
          </div>
        </>
      ) : c.state === "draft" ? (
        <div className="prog"><div className="cur"><span className="spin" />Maxitor downloads the wheel, compares its SHA-256, reads its passport and schema.yaml…</div>{c.reason ? <div className="todo">{c.reason}</div> : null}</div>
      ) : (
        <>
          <div className="pnote bad"><Icon.alert /><div><b>Rejected.</b> {c.reason}</div></div>
          <div className="ft">
            <span />
            {c.reason?.startsWith("closed_repository") ? (
              <button type="button" className="btn2 pri" onClick={() => setDialog({ kind: "private", mode: "upload" })}>Upload the wheel</button>
            ) : (
              <button type="button" className="btn2" onClick={() => setDialog({ kind: "private", mode: "release" })}>Add again</button>
            )}
          </div>
        </>
      )}
    </div>
  );

  const nothing = (
    <div className="empty-st">
      <b>No plugin matches “{query.trim()}”</b>The search looks through the name, the id and the description.
      <br />
      <button type="button" className="btn2" onClick={() => setQuery("")}>Clear the search</button>
    </div>
  );

  const searching = query.trim() !== "";
  let body: ReactNode;
  if (tab === "installed") {
    if (listing.installed.length === 0 && listing.removed.length === 0) {
      body = searching ? nothing : (
        <div className="empty-st">
          <b>No plugin is installed yet</b>{orgName} is empty. Plugins from the marketplace add their sections to the tree.
          <br />
          <button type="button" className="btn2 pri" onClick={() => setTab("market")}>Open the marketplace</button>
        </div>
      );
    } else {
      body = (
        <>
          {listing.installed.map(installedRow)}
          {listing.removed.length ? <><div className="sec">Removed <span>— kept in the history</span></div>{listing.removed.map(installedRow)}</> : null}
        </>
      );
    }
  } else if (listing.marketplace.length === 0 && listing.private.length === 0) {
    body = searching ? nothing : <div className="empty-st"><b>Everything is installed</b>{orgName} has every plugin of the marketplace.</div>;
  } else {
    body = (
      <>
        {listing.private.length ? <><div className="sec"><Icon.lock />Private to {orgName}</div><div className="grid">{listing.private.map(card)}</div></> : null}
        {listing.private.length ? <div className="sec" style={{ marginTop: 22 }}>Maxitor marketplace</div> : null}
        {listing.marketplace.length ? <div className="grid">{listing.marketplace.map(card)}</div> : <div className="empty-st">No plugin of the marketplace matches.</div>}
      </>
    );
  }

  return (
    <div className="page">
      <div className="inner">
        <div className="ph">
          <div className="tx"><h2>Plugins</h2><div className="sub">What {orgName} has installed and what the marketplace offers.</div></div>
          <button type="button" className="btn2" onClick={() => setDialog({ kind: "private", mode: "release" })}><Icon.plus />Add a private plugin</button>
        </div>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "installed"} className={tab === "installed" ? "on" : ""} onClick={() => setTab("installed")}>
            Installed<span className="cnt">{listing.counts.installed}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === "market"} className={tab === "market" ? "on" : ""} onClick={() => setTab("market")}>
            Marketplace<span className="cnt">{listing.counts.marketplace}</span>
          </button>
        </div>
        <label className="search">
          <Icon.search />
          <input type="search" placeholder="Search plugins by name, id or description" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search plugins" />
          {query ? <button type="button" className="clr" aria-label="Clear the search" onClick={() => setQuery("")}><Icon.x /></button> : null}
        </label>
        {failure ? <div className="alert bad"><Icon.alert /><div>{failure}</div></div> : null}
        {body}
      </div>
      {panel ? <DetailsPanel details={panel} orgName={orgName} onClose={() => setPanel(null)} onInstall={() => setDialog({ kind: "install", passportId: panel.passport_id })} /> : null}
      {dialog?.kind === "install" ? (
        <InstallDialog
          code={code}
          orgName={orgName}
          passportId={dialog.passportId}
          onClose={() => setDialog(null)}
          onInstall={(d) => void change({ passport_id: d.passport_id, title: d.title }, "install", `${d.title} ${d.version} is being installed; its sections appear in the tree once it is enabled.`)}
          onFirst={(passportId) => setDialog({ kind: "install", passportId })}
        />
      ) : null}
      {dialog?.kind === "disable" ? (
        <Sheet onClose={() => setDialog(null)}>
          <h3>Disable {dialog.row.title}?</h3>
          <div className="sub">For everyone in <b>{orgName}</b>.</div>
          <ul className="bul"><li>Its sections leave the tree.</li><li>Its data stays as it is. Enabling it brings everything back.</li></ul>
          <div className="ft">
            <button type="button" className="btn2" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn2 pri" onClick={() => void change(dialog.row, "disable", `${dialog.row.title} is disabled. Its data stays.`)}>Disable</button>
          </div>
        </Sheet>
      ) : null}
      {dialog?.kind === "needed" ? (
        <Sheet onClose={() => setDialog(null)}>
          <h3>{dialog.row.title} cannot be disabled yet</h3>
          <div className="sub">{dialog.dependents.map((d) => d.title).join(", ")} {dialog.dependents.length > 1 ? "need" : "needs"} {dialog.row.title} and {dialog.dependents.length > 1 ? "are" : "is"} enabled in {orgName}. Disable {dialog.dependents.length > 1 ? "them" : "it"} first.</div>
          {dialog.dependents.map((d) => {
            const dependent = listing.installed.find((r) => r.passport_id === d.passport_id);
            return (
              <div key={d.passport_id} className="dep">
                <Tile id={d.passport_id} title={d.title} />
                <div className="dn"><b>{d.title}</b><div>enabled · needs {dialog.row.title}</div></div>
                {dependent ? <button type="button" className="btn2" onClick={() => setDialog({ kind: "disable", row: dependent })}>Disable {d.title}</button> : null}
              </div>
            );
          })}
          <div className="ft"><button type="button" className="btn2 pri" onClick={() => setDialog(null)}>Close</button></div>
        </Sheet>
      ) : null}
      {dialog?.kind === "private" ? (
        <PrivateDialog
          code={code}
          orgName={orgName}
          mode={dialog.mode}
          onMode={(mode) => setDialog({ kind: "private", mode })}
          onClose={() => setDialog(null)}
          onAdded={() => {
            setDialog(null);
            setTab("market");
            setToast("The private plugin is added; Maxitor checks it now.");
            void reload();
          }}
        />
      ) : null}
      {toast ? <div className="toast" role="status"><Icon.check /><span>{toast}</span><button type="button" onClick={() => setToast(null)}>Close</button></div> : null}
    </div>
  );
}

function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dlg sheet" role="dialog" aria-modal="true"><div className="grab" />{children}</div>
    </>
  );
}

function DetailsPanel({ details: d, orgName, onClose, onInstall }: { details: Details; orgName: string; onClose: () => void; onInstall: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="panel" role="dialog" aria-modal="true" aria-label={d.title}>
        <div className="pb">
          <button type="button" className="pback" onClick={onClose}><Icon.left />Plugins</button>
          <div className="phd">
            <Tile id={d.passport_id} title={d.title} large />
            <div><h3>{d.title}</h3><div className="ver">{d.version} {d.state ? <StateBadge state={d.state} /> : null} {d.private ? <span className="stt private">private</span> : null}</div></div>
            <button type="button" className="close" aria-label="Close" onClick={onClose}><Icon.x /></button>
          </div>
          {d.description ? <div className="desc">{d.description}</div> : null}
          {d.withdrawn ? <div className="pnote warn"><Icon.info /><div>Withdrawn from the marketplace: installed copies keep working, new installs are closed.</div></div> : null}
          <div className="dsec">From its passport</div>
          <dl className="kv">
            <dt>Id</dt><dd className="mono">{d.passport_id}</dd>
            <dt>Name</dt><dd className="mono">{d.name}</dd>
            <dt>Core</dt><dd><span className="mono">{d.core_range}</span> {d.fits_core ? <span className="okt">— fits this core</span> : <span className="badt">— does not fit this core</span>}</dd>
            <dt>Needs</dt><dd>{d.dependencies.length ? d.dependencies.map((x) => `${x.passport_id} (${x.installed ? "installed" : "not installed"})`).join(", ") : "none"}</dd>
            <dt>Owner</dt><dd>{d.private ? `${orgName} — private` : "Maxitor marketplace — public"}</dd>
          </dl>
          <div className="dsec">Its wheel</div>
          <dl className="kv">
            <dt>Source</dt><dd className="mono">{d.purl}</dd>
            <dt>SHA-256</dt><dd className="mono">{d.sha256}</dd>
          </dl>
          <div className="dsec">Its tables, from schema.yaml</div>
          <dl className="kv">
            <dt>Tables</dt><dd><div className="tbl">{d.tables.length ? d.tables.map((t) => <span key={t}>{t}</span>) : "not read yet"}</div></dd>
            <dt>Schema</dt><dd className="mono">{d.schema_name}</dd>
            <dt>Database user</dt><dd className="mono">{d.database_user}</dd>
            <dt>Deployed</dt><dd>{d.deployed ? "Yes — shared by every organization on this version" : "Not yet — the first install builds it"}</dd>
          </dl>
          {d.sections.length ? <><div className="dsec">In the tree</div><div className="tbl">{d.sections.map((s) => <span key={s.title} className="word">{s.title}</span>)}</div></> : null}
        </div>
        <div className="pf">
          <button type="button" className="btn2" onClick={onClose}>Close</button>
          {d.state === null && d.fits_core ? <button type="button" className="btn2 pri" onClick={onInstall}>Install</button> : null}
        </div>
      </div>
    </>
  );
}

function InstallDialog({
  code,
  orgName,
  passportId,
  onClose,
  onInstall,
  onFirst,
}: {
  code: string;
  orgName: string;
  passportId: string;
  onClose: () => void;
  onInstall: (d: Details) => void;
  onFirst: (passportId: string) => void;
}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  useEffect(() => {
    void pluginDetails(code, passportId).then((answer) => (answer.ok ? setDetails(answer.data) : setRefused(refusalText(answer.refusal))));
  }, [code, passportId]);
  const missing = useMemo(() => details?.dependencies.filter((d) => !d.installed) ?? [], [details]);
  if (!details) {
    return <Sheet onClose={onClose}>{refused ? <div className="alert bad"><Icon.alert /><div>{refused}</div></div> : <div className="sub">Reading the plugin…</div>}</Sheet>;
  }
  return (
    <Sheet onClose={onClose}>
      <h3>Install {details.title} {details.version}</h3>
      <div className="sub">Into <b>{orgName}</b>, from <span className="mono">{details.purl}</span></div>
      {missing.length ? <div className="alert bad"><Icon.alert /><div><b>{details.title} cannot be installed yet:</b> it needs {missing.map((d) => d.passport_id).join(", ")}.</div></div> : null}
      <div className="dsec">Checks</div>
      <div className={`chk ${details.fits_core ? "ok" : "bad"}`}>{details.fits_core ? <Icon.check /> : <Icon.x />}<div>Works with this Maxitor<div className="d">The core is within <code>{details.core_range}</code> of its passport.</div></div></div>
      {details.dependencies.map((d) => (
        <div key={d.passport_id} className={`chk ${d.installed ? "ok" : "bad"}`}>{d.installed ? <Icon.check /> : <Icon.x />}<div>Needs {d.passport_id}<div className="d">{d.installed ? `Installed in ${orgName}.` : `Not installed in ${orgName}. Install it first; then come back.`}</div></div></div>
      ))}
      {missing.length === 0 ? (
        <>
          <div className="dsec">What happens</div>
          {details.deployed ? (
            <div className="alert info"><Icon.info /><div>Version {details.version} is already deployed in Maxitor. Installing only adds it to {orgName}: nothing new is built in the database.</div></div>
          ) : (
            <ul className="bul">
              <li>Version {details.version} is deployed for the first time: the schema <code>{details.schema_name}</code>, the database user <code>{details.database_user}</code>, and {details.tables.length || "its"} tables from its <code>schema.yaml</code> with their version tables.</li>
              <li>The user reads and writes its own schema only.</li>
              <li>Once enabled, everyone in {orgName} sees its sections in the tree.</li>
            </ul>
          )}
        </>
      ) : null}
      <div className="ft">
        <button type="button" className="btn2" onClick={onClose}>Cancel</button>
        {missing.length ? (
          <button type="button" className="btn2 pri" onClick={() => onFirst(missing[0].passport_id)}>Install {missing[0].passport_id} first</button>
        ) : (
          <button type="button" className="btn2 pri" disabled={!details.fits_core} onClick={() => onInstall(details)}>Install {details.title}</button>
        )}
      </div>
    </Sheet>
  );
}

function PrivateDialog({
  code,
  orgName,
  mode,
  onMode,
  onClose,
  onAdded,
}: {
  code: string;
  orgName: string;
  mode: "release" | "upload";
  onMode: (mode: "release" | "upload") => void;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [purl, setPurl] = useState("");
  const [sha, setSha] = useState("");
  const [file, setFile] = useState<{ name: string; size: number; data: ArrayBuffer; sha256: string } | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const purlHint = purl.startsWith("pkg:pypi/")
    ? { bad: true, text: "A package on PyPI is the public marketplace's. A private plugin comes from GitHub or GitLab." }
    : /^pkg:(github|gitlab)\//.test(purl) && !/[?&]file=[^&]+\.whl/.test(purl)
      ? { bad: true, text: "Name the wheel: add ?file=<name>.whl — a release can carry several files." }
      : { bad: false, text: "A release on GitHub or GitLab that downloads without signing in, with the wheel's file name." };
  const shaBad = sha !== "" && !SHA256.test(sha.trim().toLowerCase());
  const tooLarge = file !== null && file.size > MAX_WHEEL;
  const ready = mode === "release" ? purl !== "" && !purlHint.bad && sha !== "" && !shaBad : file !== null && !tooLarge;

  async function choose(chosen: File | undefined) {
    setRefused(null);
    if (!chosen) return;
    if (chosen.size > MAX_WHEEL) {
      setFile({ name: chosen.name, size: chosen.size, data: new ArrayBuffer(0), sha256: "" });
      return;
    }
    const data = await chosen.arrayBuffer();
    setFile({ name: chosen.name, size: chosen.size, data, sha256: await sha256Of(data) });
  }

  async function submit() {
    setBusy(true);
    setRefused(null);
    const answer =
      mode === "release"
        ? await addPrivatePlugin(code, purl.trim(), sha.trim())
        : await uploadPrivatePlugin(code, file!.name, base64Of(file!.data));
    setBusy(false);
    if (answer.ok) onAdded();
    else setRefused(refusalText(answer.refusal));
  }

  return (
    <Sheet onClose={onClose}>
      <h3>Add a private plugin</h3>
      <div className="sub">A wheel of your own. Only <b>{orgName}</b> sees it; it goes through the same checks as the marketplace&apos;s plugins.</div>
      <div className="seg">
        <button type="button" className={mode === "release" ? "on" : ""} onClick={() => onMode("release")}>From a release</button>
        <button type="button" className={mode === "upload" ? "on" : ""} onClick={() => onMode("upload")}>Upload a wheel</button>
      </div>
      {refused ? <div className="alert bad"><Icon.alert /><div>{refused}</div></div> : null}
      {mode === "release" ? (
        <>
          <div className="lab">Package URL</div>
          <div className={`inp mono${purlHint.bad ? " bad" : ""}`}><input value={purl} onChange={(e) => setPurl(e.target.value)} placeholder="pkg:github/acme/maxitor-notes@v1.2.0?file=…whl" aria-label="Package URL" /></div>
          <div className={`hintl${purlHint.bad ? " bad" : ""}`}>{purlHint.text}</div>
          <div className="lab">SHA-256 of the wheel</div>
          <div className={`inp mono${shaBad ? " bad" : ""}`}><input value={sha} onChange={(e) => setSha(e.target.value)} placeholder="64 hexadecimal characters" aria-label="SHA-256 of the wheel" /></div>
          <div className={`hintl${shaBad ? " bad" : ""}`}>{shaBad ? `64 hexadecimal characters; this has ${sha.trim().length}.` : "Of the .whl file: shasum -a 256 <wheel>. Maxitor installs only a wheel with this hash."}</div>
        </>
      ) : (
        <>
          <label className="drop">
            <input type="file" accept=".whl" onChange={(e) => void choose(e.target.files?.[0])} aria-label="Choose a wheel" />
            <Icon.plus /> <b>Choose a .whl file</b>
            <br />
            <span>Up to 50 MB. For a closed repository, a CI artifact or any other source.</span>
          </label>
          {file ? (
            <div className={`frow${tooLarge ? " bad" : ""}`}>
              {tooLarge ? <Icon.alert /> : <Icon.page />}
              <div className="fn"><b>{file.name}</b><div>{tooLarge ? `${(file.size / 1048576).toFixed(1)} MB — larger than the 50 MB a plugin's wheel may be` : `${Math.max(1, Math.round(file.size / 1024))} KB`}</div></div>
            </div>
          ) : null}
          {file && !tooLarge ? (
            <>
              <div className="lab">SHA-256, computed by Maxitor</div>
              <div className="inp mono ok">{file.sha256}</div>
              <div className="hintl">Compare it with the hash of your build.</div>
            </>
          ) : null}
        </>
      )}
      <div className="ft">
        <button type="button" className="btn2" onClick={onClose}>Cancel</button>
        <button type="button" className="btn2 pri" disabled={!ready || busy} onClick={() => void submit()}>{busy ? "Adding…" : "Add and check"}</button>
      </div>
    </Sheet>
  );
}
