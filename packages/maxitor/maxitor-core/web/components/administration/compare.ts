import type { AdministrationRow } from "./read";
export function compareAdministration(rows: AdministrationRow[], against: AdministrationRow[] | null): { row: AdministrationRow; before: AdministrationRow | undefined; kind: "added" | "removed" | "changed" | "unchanged" }[] {
  const before = new Map((against ?? []).map(row => [row.id, row]));
  const current = new Set(rows.map(row => row.id));
  const value = (row: AdministrationRow) => JSON.stringify([row.title, [...row.fields].sort((a,b) => a.name.localeCompare(b.name))]);
  return [
    ...rows.map(row => ({ row, before: before.get(row.id), kind: against === null ? "unchanged" : !before.has(row.id) ? "added" : value(row) === value(before.get(row.id)!) ? "unchanged" : "changed" } as const)),
    ...(against ?? []).filter(row => !current.has(row.id)).map(row => ({ row, before: row, kind: "removed" } as const)),
  ];
}

/** Both halves classify changes from A to B, but each renders its own values. */
export function administrationView(snapshot: AdministrationRow[], against: AdministrationRow[] | null, side: "a" | "b" | null, filter?: string) {
  const compared = side === "a" && against ? compareAdministration(against, snapshot) : compareAdministration(snapshot, against);
  const own = new Map(snapshot.map(row => [row.id, row]));
  const rows = side ? compared.filter(entry => own.has(entry.row.id)).map(entry => ({ ...entry, row: own.get(entry.row.id)! })) : compared;
  const visible = rows.filter(entry => !filter || filter.split(",").includes(entry.kind));
  return { compared, rows, visible, hidden: rows.filter(entry => !visible.includes(entry)).map(entry => entry.row.id) };
}

/** Split invitations without losing their original records or accepted-user links. */
export function invitationLists<T extends { state: string; email: string }>(items: readonly T[], search = "") {
  const q = search.trim().toLowerCase();
  const matches = items.filter(item => item.email.toLowerCase().includes(q));
  return { pending: matches.filter(item => item.state === "sent"), history: matches.filter(item => item.state !== "sent") };
}

/** The bare Plugins address opens the catalog; an explicit installed tab survives reload. */
export function pluginTab(tab?: string): "installed" | "market" {
  return tab === "installed" ? "installed" : "market";
}

/** Adapt only values from the selected snapshot; never fill gaps from the current user. */
export function snapshotUser(row: AdministrationRow) {
  const fields = Object.fromEntries(row.fields.map(field => [field.name, field.value]));
  const value = (name: string) => fields[name] && fields[name] !== "—" ? fields[name] : null;
  return {
    id: row.id, account_id: value("account_id") ?? "", name: row.title,
    email: value("email") ?? "—", state: fields.status as "active" | "blocked" | "removed",
    is_admin: fields.is_admin === "Yes", job_title: value("job_title"),
    appeared: (value("invited_by") ? "invited" : "registered") as "invited" | "registered",
    invited_by: value("invited_by") ? { id: fields.invited_by, name: value("invited_by_name") ?? "—" } : null,
    created_at: value("created_at") ?? "", changed_at: row.changed_at,
    changed_by: row.author ? { id: "", name: row.author } : null, last_sign_in_at: null,
  };
}

/** Invitation identity and lifecycle values belong to the selected snapshot only. */
export function snapshotInvitation(row: AdministrationRow): import("@/lib/core").Invitation {
  const fields = Object.fromEntries(row.fields.map(field => [field.name, field.value]));
  const value = (name: string) => fields[name] && fields[name] !== "—" ? fields[name] : null;
  const person = (key: string) => value(key) ? { id: fields[key], name: value(`${key}_name`) ?? "—" } : null;
  return { id: row.id, email: row.title, state: fields.status as import("@/lib/core").Invitation["state"],
    is_admin: fields.is_admin === "Yes", job_title: value("job_title"),
    invited_by: person("invited_by") ?? {id:"",name:"Not recorded"},
    sent_at: value("sent_at") ?? "", letter_sent_at: value("letter_sent_at") ?? value("sent_at") ?? "",
    expires_at: value("expires_at") ?? "", decided_at: value("decided_at"),
    decided_by: person("decided_by"), by_setting: fields.by_setting === "Yes", accepted_user: person("accepted_user_id") };
}
