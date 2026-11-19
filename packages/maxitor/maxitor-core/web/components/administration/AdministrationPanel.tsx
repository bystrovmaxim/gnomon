"use client";
import { Button } from "@maxitor/panel";
import { PanelPage, StatusIcon, changeFilterRows, usePanelQuery, useBackToNow, useMoment, useCounts, usePanelHidden } from "@maxitor/panel";
import { createContext, useCallback, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useWatermark } from "@maxitor/panel";
import type { PageAction, Layers } from "@maxitor/panel";
import type { AdministrationRow } from "./read";
import { AdminCanvas } from "./AdminCanvas";
import { administrationView } from "./compare";
import { AdministrationLayers } from "./AdministrationLayers";
import "../../app/globals.css";
import "./administration.css";

export const AdministrationComparison = createContext<{ historical: boolean; entries: ReturnType<typeof administrationView>["visible"]; compared: boolean }>({ historical: false, entries: [], compared: false });

export const AdministrationActions = createContext<Dispatch<SetStateAction<PageAction[]>>>(() => {});

export function AdministrationPanel({ section, snapshot, against, children }: { section: string; snapshot: AdministrationRow[]; against: AdministrationRow[] | null; children: ReactNode }) {
  const [actions, setActions] = useState<PageAction[]>([]);
  const [layers, setLayers] = useState<Layers>();
  const moment = useMoment();
  const query = Object.fromEntries(Object.entries(usePanelQuery()).filter(([key]) => key !== "at" && !key.startsWith("_")));
  const now = useBackToNow();
  const router = useRouter();
  useWatermark(useCallback(() => router.refresh(), [router]));
  const { compared, rows, visible: filtered } = administrationView(snapshot, against, moment.side, query.changes);
  const visible = section === "invitations" ? filtered.filter(entry => (entry.row.fields.find(field => field.name === "status")?.value === "sent") !== (query.tab === "history")) : filtered;
  usePanelHidden(rows.filter(entry => !visible.includes(entry)).map(entry => `${section}:${entry.row.id}`));
  const counts = { added: compared.filter(r => r.kind === "added").length, removed: compared.filter(r => r.kind === "removed").length, changed: compared.filter(r => r.kind === "changed").length };
  useCounts(against ? counts : null);
  const historical = Boolean(moment.at || moment.against);
  const title = section[0].toUpperCase() + section.slice(1);
  return <AdministrationActions.Provider value={setActions}><AdministrationLayers.Provider value={setLayers}><div className="mx-administration">
    <PanelPage title={title} actions={actions} layers={layers} filters={against ? [{ title: "Changes", param: "changes", rows: changeFilterRows(compared.map(row => row.kind)) }] : []} history={{ read: "administration_history", bars: "administration_history", compare: ["diff", "side_by_side"] }}>
      <AdministrationComparison.Provider value={{ historical, entries: visible, compared: Boolean(against) }}><AdminCanvas minWidth={["users", "invitations"].includes(section) ? 1150 : 280} filters={Boolean(against)} layers={["users", "invitations"].includes(section) || (section === "plugins" && !historical)} fullWidth={section === "plugins"}>{historical ? <>
        <div className="admin-history-notice" role="status"><span>{against && !moment.side ? "Comparing A and B · read only" : "Viewing history · read only"}</span><Button type="button" variant="secondary" onClick={now}>Return to Now</Button></div>

        {["users", "invitations"].includes(section) ? children : <div className="admin-cards">
          {visible.map(({ row, before, kind }) => <article className="admin-object" key={row.id} data-room-anchor={`${section}:${row.id}`} data-change={against ? kind : undefined}>
            <h3>{row.title}</h3>
            {against && !moment.side ? <span className="admin-change"><StatusIcon status={kind} /> {kind}</span> : null}
            <dl>{row.fields.map(field => { const old = before?.fields.find(f => f.name === field.name)?.value; return <div key={field.name} data-room-anchor={`${section}:${row.id}:${field.name}`}><dt>{field.name.replaceAll("_", " ")}</dt><dd>{against && !moment.side && old !== undefined && old !== field.value ? <><del>{displayValue(old)}</del> → </> : null}{displayValue(field.value)}</dd></div>; })}</dl>
            <p className="admin-meta">{row.author ?? "System"} · {new Date(row.changed_at).toLocaleString("en-GB")}</p>
          </article>)}
          {!visible.length ? <p role="status">{rows.length ? "No records match these filters." : "No records at this moment."}</p> : null}
        </div>}
      </> : children}</AdminCanvas></AdministrationComparison.Provider>
    </PanelPage>
  </div></AdministrationLayers.Provider></AdministrationActions.Provider>;
}

function displayValue(value: string): string { return ({ any_user: "Any active user", administrators: "Administrators only" } as Record<string,string>)[value] ?? value; }
