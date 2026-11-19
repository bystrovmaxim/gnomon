import { core } from "@/lib/core";
export type AdministrationRow = { id: string; title: string; fields: { name: string; value: string }[]; changed_at: string; author: string | null };
export function readAdministration(code: string, section: string, at?: string) {
  const query = new URLSearchParams({ section, ...(at ? { at } : {}) });
  return core<{ rows: AdministrationRow[] }>("GET", `/api/v1/organizations/${encodeURIComponent(code)}/administration?${query}`);
}
