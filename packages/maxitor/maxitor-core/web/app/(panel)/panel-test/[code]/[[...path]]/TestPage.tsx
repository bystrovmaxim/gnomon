// packages/maxitor/maxitor-core/web/app/(panel)/panel-test/[code]/[[...path]]/TestPage.tsx
"use client";

import {
  DataTable,
  inRange,
  MaxitorCanvas,
  numberIn,
  openDatePicker,
  PanelPage,
  readRange,
  useOpenPanel,
  usePanelHidden,
  usePanelPath,
  usePanelQuery,
  usePanelRouter,
  useWatermark,
  type FilterSection,
  type Layers,
} from "@maxitor/panel";
import { useCallback, useMemo, useState } from "react";

export function TestPage() {
  const path = usePanelPath();
  const query = usePanelQuery();
  const router = usePanelRouter();
  const open = useOpenPanel();
  const [watermarks, setWatermarks] = useState<string[]>([]);
  useWatermark(useCallback((at: string) => setWatermarks((was) => [...was, at]), []));
  const { at, ...params } = query;
  const [refusal, setRefusal] = useState("");

  if (path === "/panel-test/canvas") return <TestScene />;
  if (path === "/panel-test/drawing") return <TestDrawing />;
  if (path === "/panel-test/unframed") return <Unframed />;
  if (path === "/panel-test/list") return <TestList />;

  return (
    <PanelPage title="Panel test">
      <output data-testid="location">{JSON.stringify({ path, query: params, at: at ?? null })}</output>
      <output data-testid="watermarks">{watermarks.length}</output>
      <div>
        <button type="button" onClick={() => router.push({ query: { ...params, step: String(Number(params.step ?? 0) + 1) } })}>Push a step</button>{" "}
        <button type="button" onClick={() => router.replace({ query: { ...params, search: `${params.search ?? ""}a` } })}>Type a letter</button>{" "}
        <button type="button" onClick={() => router.push({ path: "/panel-test/inner", query: {} })}>Open the inner page</button>{" "}
        <button type="button" onClick={() => open("core", "/settings/plugins")}>Open Settings → Plugins</button>{" "}
        <button type="button" onClick={() => open("stranger", "/")}>Open a stranger&apos;s page</button>{" "}
        <button type="button" onClick={() => router.push({ path: "/panel-test/canvas", query: {} })}>Open the canvas</button>{" "}
        <button type="button" onClick={() => router.push({ path: "/panel-test/drawing", query: {} })}>Open the drawing</button>{" "}
        <button type="button" onClick={() => router.push({ path: "/panel-test/unframed", query: {} })}>Open a page without the shell</button>{" "}
        <button type="button" onClick={() => router.push({ path: "/panel-test/list", query: {} })}>Open the list</button>{" "}
        <button type="button" data-testid="write-mode" onClick={() => { try { router.push({ query: { ...params, mode: "diff" } }); } catch (refused) { setRefusal(String(refused)); } }}>Write mode</button>
      </div>
      <output data-testid="refusal">{refusal}</output>
    </PanelPage>
  );
}

/** A scene of three boxes on the canvas, laid out in canvas coordinates. */
const BOXES = [
  { id: "a", x: 0, y: 0, label: "Payments" },
  { id: "b", x: 600, y: 120, label: "Stock" },
  { id: "c", x: 240, y: 520, label: "Orders" },
];

function TestScene() {
  return (
    <PanelPage title="Test scene">
    <MaxitorCanvas bounds={{ x: 0, y: 0, width: 800, height: 600 }} label="Test scene">
      {BOXES.map((box) => (
        <div key={box.id} data-room-anchor={`box:${box.id}`} className="mx-card" style={{ position: "absolute", left: box.x, top: box.y, width: 200 }}>
          {box.label}
        </div>
      ))}
    </MaxitorCanvas>
    </PanelPage>
  );
}

/** A drawing as a graph's page is (spec 078, FR-024): three layers with counts read from its data, a filter section
 * only in a comparison, a layout choice and a button of its own after the zoom. */
const NODES = [
  { id: "billing", layer: "domains", kind: "core", x: 0, y: 0 },
  { id: "stock", layer: "domains", kind: "edge", x: 320, y: 0 },
  { id: "paid", layer: "events", kind: "core", x: 0, y: 200 },
  { id: "shipped", layer: "events", kind: "edge", x: 320, y: 200 },
  { id: "refunded", layer: "events", kind: "core", x: 640, y: 200 },
  { id: "pay", layer: "actions", kind: "core", x: 0, y: 400 },
];

function TestDrawing() {
  const query = usePanelQuery();
  const [closed, setClosed] = useState(0);
  const layer = query.layer ?? "domains";
  const layers: Layers = {
    default: "domains",
    options: [
      { value: "domains", label: "Domains", icon: "domain", count: NODES.filter((n) => n.layer === "domains").length },
      { value: "events", label: "Events", icon: "event", count: NODES.filter((n) => n.layer === "events").length },
      { value: "actions", label: "Actions", icon: "action", count: NODES.filter((n) => n.layer === "actions").length },
    ],
  };
  const shown = NODES.filter((n) => n.layer === layer);
  const filters = useMemo<FilterSection[]>(() => {
    const kinds: FilterSection = { title: "Kind", param: "kind", paints: true, rows: [{ key: "core", label: "Core", colour: "blue" }, { key: "edge", label: "Edge", colour: "amber", absent: !shown.some((n) => n.kind === "edge") }] };
    // The changes exist only in a comparison: the section is given only when the address has the time scale's mode.
    const changes: FilterSection = { title: "Changes", param: "change", paints: true, rows: [{ key: "added", label: "Added", colour: "green" }, { key: "removed", label: "Removed", colour: "red" }] };
    return query.mode ? [kinds, changes] : [kinds];
  }, [query.mode, shown]);
  return (
    <PanelPage
      title="Test drawing"
      layers={layers}
      filters={filters}
      bar={[
        { kind: "choice", param: "layout", default: "lr", options: [{ value: "lr", title: "Left to right", icon: "layout-lr" }, { value: "tb", title: "Top to bottom", icon: "layout-tb" }] },
        { kind: "button", items: [{ title: "Close every port", icon: "close-ports", onClick: () => setClosed((n) => n + 1) }] },
      ]}
      actions={[{ title: "New note", icon: "plus", onClick: () => setClosed((n) => n + 1) }]}
      // Its history, as a plugin's page gives it: one name the core does not know and one comparison wider than allowed.
      history={{ milestones: "list_test_history", card: "no_such_card", compare: ["diff", "side_by_side"] }}
    >
      <MaxitorCanvas bounds={{ x: 0, y: 0, width: 840, height: 480 }} label="Test drawing">
        {shown.map((node) => (
          <div key={node.id} data-room-anchor={`node:${node.id}`} className="mx-card" style={{ position: "absolute", left: node.x, top: node.y, width: 200 }}>
            {node.id}
          </div>
        ))}
      </MaxitorCanvas>
      <output data-testid="pressed" hidden>{closed}</output>
    </PanelPage>
  );
}

/** A page that does not render the shell: the frame marks it on the stand (spec 078, FR-021). */
function Unframed() {
  return <main data-testid="unframed">A page drawn without the shell.</main>;
}

/** The test list's accounts: 10,000 of them, made the same way every time from their number (spec 081, FR-022). */
type Account = { id: string; name: string; email: string; manager: string; status: string; domain: string; balance: number; created: string; blocked: boolean };

const FIRST = ["Anna", "Boris", "Clara", "Denis", "Elena", "Fedor", "Galina", "Igor", "Kira", "Lev", "Maria", "Nikita", "Olga", "Pavel", "Rita", "Sergei", "Tamara", "Viktor", "Yulia", "Zoya", "Artem", "Vera", "Gleb"];
const LAST = ["Volkova", "Orlov"];
/** 46 managers: a long choice with a search and "N more". */
const MANAGERS = FIRST.flatMap((first) => LAST.map((last) => `${first} ${last}`));
const STATUSES = [
  { key: "active", label: "Active", colour: "green" },
  { key: "trial", label: "Trial", colour: "amber" },
  { key: "closed", label: "Closed", colour: "grey" },
];
const DOMAINS = [
  { key: "billing", label: "Billing", colour: "blue" },
  { key: "stock", label: "Stock", colour: "violet" },
  { key: "orders", label: "Orders", colour: "teal" },
];
const PALETTE_OF_MANAGERS = ["blue", "green", "amber", "red", "violet", "teal", "pink"];

/** A number from 0 to 1 that depends only on ``seed``. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const ACCOUNTS: Account[] = Array.from({ length: 10_000 }, (_, index) => {
  const n = index + 1;
  const created = new Date(Date.UTC(2019, 0, 1) + Math.floor(noise(n * 7) * (Date.UTC(2026, 10, 1) - Date.UTC(2019, 0, 1))));
  return {
    id: `acc-${n}`,
    name: `Account ${String(n).padStart(5, "0")}`,
    email: `account${n}@example.org`,
    // Earlier managers hold more accounts, so the first values of the long choice are the largest.
    manager: MANAGERS[Math.floor(noise(n * 3) ** 2 * MANAGERS.length)],
    status: STATUSES[Math.floor(noise(n * 5) * STATUSES.length)].key,
    domain: DOMAINS[Math.floor(noise(n * 11) * DOMAINS.length)].key,
    balance: Math.round(noise(n * 13) * 100_000) / 100,
    created: created.toISOString().slice(0, 10),
    blocked: noise(n * 17) < 0.04,
  };
});

/** The managers in the order of how many accounts each holds, the most first. */
const MANAGER_ORDER = (() => {
  const counts = new Map<string, number>();
  for (const account of ACCOUNTS) counts.set(account.manager, (counts.get(account.manager) ?? 0) + 1);
  return MANAGERS.filter((name) => counts.has(name)).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
})();

function initialsOf(name: string): string {
  return name.split(" ").map((word) => word[0]).join("");
}

function listed(value: string | undefined, key: string): boolean {
  return value === undefined || value.split(",").includes(key);
}

/** A list of 10,000 rows on the canvas, filtered by every kind of section, and the date picker called as a plugin would. */
function TestList() {
  const query = usePanelQuery();
  const [review, setReview] = useState<string | null>(null);
  const search = (query.q ?? "").toLowerCase();
  const rows = useMemo(
    () =>
      ACCOUNTS.filter(
        (account) =>
          listed(query.status, account.status) &&
          listed(query.domain, account.domain) &&
          listed(query.manager, account.manager) &&
          (query.blocked === undefined || !account.blocked) &&
          (!search || account.name.toLowerCase().includes(search) || account.email.includes(search)) &&
          numberIn(account.balance, query.balance) &&
          inRange(account.created, readRange(query.created)),
      ),
    [query.status, query.domain, query.manager, query.blocked, search, query.balance, query.created],
  );
  // What the page holds but its filters leave out: the core is told, so a pointer at one shows as hidden.
  const shownIds = useMemo(() => new Set(rows.map((row) => row.id)), [rows]);
  usePanelHidden(useMemo(() => ACCOUNTS.filter((account) => !shownIds.has(account.id)).map((account) => `account:${account.id}`), [shownIds]));
  const paint = query.paint === "domain" ? "domain" : "status";
  const filters: FilterSection[] = [
    { title: "Status", param: "status", paints: true, rows: STATUSES.map((status) => ({ ...status })) },
    { title: "Domain", param: "domain", paints: true, rows: DOMAINS.map((domain) => ({ ...domain })) },
    {
      title: "Manager",
      param: "manager",
      search: "Find a manager",
      rows: MANAGER_ORDER.map((name, index) => ({ key: name, label: name, mark: initialsOf(name), colour: PALETTE_OF_MANAGERS[index % PALETTE_OF_MANAGERS.length] })),
    },
    { kind: "text", title: "Search", param: "q", placeholder: "Account or email" },
    { kind: "range", title: "Balance", param: "balance", unit: "number" },
    { kind: "range", title: "Created", param: "created", unit: "date", min: "2019-01", max: "now", presets: [{ label: "Since the launch", from: "2019-01-01", to: "now" }] },
    { title: "Blocked", param: "blocked", rows: [{ key: "shown", label: "Show blocked", colour: "red" }] },
  ];
  const colours = Object.fromEntries([...STATUSES, ...DOMAINS].map((each) => [each.key, each.colour]));
  return (
    <PanelPage title="Test list" filters={filters}>
      <MaxitorCanvas bounds={{ x: 0, y: 0, width: 820, height: 72 + 16 * 36 }} label="Test list">
        <DataTable
          name="Accounts"
          rows={rows}
          total={ACCOUNTS.length}
          rowKey={(account) => account.id}
          anchor={(account) => `account:${account.id}`}
          columns={[
            { title: paint === "domain" ? "Domain" : "Status", kind: "status", width: 0.8, value: (account) => (paint === "domain" ? account.domain : account.status), colour: (account) => colours[paint === "domain" ? account.domain : account.status] },
            { title: "Account", value: (account) => account.name, width: 1.2 },
            { title: "Email", kind: "mono", value: (account) => account.email, width: 1.6 },
            { title: "Manager", kind: "person", value: (account) => account.manager, colour: (account) => PALETTE_OF_MANAGERS[MANAGER_ORDER.indexOf(account.manager) % PALETTE_OF_MANAGERS.length], width: 1.4 },
            { title: "Balance", kind: "number", value: (account) => account.balance.toFixed(2), width: 0.8 },
            { title: "Created", kind: "date", value: (account) => account.created, width: 0.9 },
          ]}
        />
      </MaxitorCanvas>
      <button
        type="button"
        className="mx-action"
        data-testid="review"
        style={{ position: "fixed", right: "var(--mx-space-5)", bottom: "var(--mx-space-5)", zIndex: "var(--mx-layer-shell)" }}
        onClick={async (event) => {
          const chosen = await openDatePicker({ anchor: event.currentTarget, min: "2019-01", max: "2027-12", value: review ?? "", presets: [{ label: "Next release", from: "2026-12-01" }] });
          if (chosen !== null) setReview(chosen);
        }}
      >
        Review on…
      </button>
      <output data-testid="reviewed" hidden>{review ?? ""}</output>
    </PanelPage>
  );
}

