// packages/maxitor/maxitor-core/web/app/plugins.ts
// The server actions of Settings → Plugins (specs/073-plugin-marketplace/contracts/actions.md): each calls one action
// of the core's backend with the person's session; the page's scripts never see a token.
"use server";

import { core, type Refusal } from "@/lib/core";

export type Dependency = { passport_id: string; installed: boolean };

export type Installed = {
  passport_id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  state: "installing" | "enabled" | "disabled" | "failed" | "removing" | "removed";
  reason: string | null;
  purl: string;
  installed_by: string;
  installed_at: string;
  depends_on: string[];
  withdrawn: boolean;
  private: boolean;
};

export type Card = {
  passport_id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  purl: string;
  private: boolean;
  state: "active" | "draft" | "rejected";
  reason: string | null;
  fits_core: boolean;
  dependencies: Dependency[];
};

export type Listing = {
  installed: Installed[];
  removed: Installed[];
  marketplace: Card[];
  private: Card[];
  counts: { installed: number; marketplace: number };
};

export type Details = {
  passport_id: string;
  name: string;
  title: string;
  description: string;
  private: boolean;
  withdrawn: boolean;
  version: string;
  purl: string;
  sha256: string;
  core_range: string | null;
  fits_core: boolean;
  dependencies: Dependency[];
  sections: { title: string; path: string }[];
  tables: string[];
  schema_name: string;
  database_user: string;
  deployed: boolean;
  state: string | null;
};

export type Outcome<T> = { ok: true; data: T } | { ok: false; refusal: Refusal };

function outcome<T>(answer: { ok: true; data: T } | { ok: false; refusal: Refusal }): Outcome<T> {
  return answer.ok ? { ok: true, data: answer.data } : { ok: false, refusal: answer.refusal };
}

export async function listPlugins(code: string, query: string): Promise<Outcome<Listing>> {
  return outcome(await core<Listing>("GET", `/api/v1/organizations/${encodeURIComponent(code)}/plugins?query=${encodeURIComponent(query)}`));
}

export async function pluginDetails(code: string, passportId: string): Promise<Outcome<Details>> {
  return outcome(await core<Details>("GET", `/api/v1/organizations/${encodeURIComponent(code)}/plugins/${encodeURIComponent(passportId)}`));
}

/** install, retry, drop, disable or enable. */
export async function changePlugin(code: string, passportId: string, verb: "install" | "retry" | "drop" | "disable" | "enable"): Promise<Outcome<{ state: string }>> {
  return outcome(await core<{ state: string }>("POST", `/api/v1/plugins/${verb}`, { code, passport_id: passportId }));
}

export type Added = { version_id: string; sha256: string; purl: string; state: string };

export async function addPrivatePlugin(code: string, purl: string, sha256: string): Promise<Outcome<Added>> {
  return outcome(await core<Added>("POST", "/api/v1/plugins/private", { code, purl, sha256 }));
}

export async function uploadPrivatePlugin(code: string, fileName: string, contentBase64: string): Promise<Outcome<Added>> {
  return outcome(await core<Added>("POST", "/api/v1/plugins/private/upload", { code, file_name: fileName, content_base64: contentBase64 }));
}
