// packages/maxitor/maxitor-core/web/app/actions.ts
// The application's server actions: each calls one action of the core's backend. Those that sign in put the session
// into the HttpOnly cookie; the page's scripts never see a token.
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CONSENT_COOKIE, SESSION_COOKIE, claims, core, forgotten, hidden, keepSession, ownPath, type Refusal } from "@/lib/core";

/** What a form gets back when the backend refuses. */
export type Refused = { refused: Refusal };

const CONSENT_SECONDS = 15 * 60;

/** Where a signed-in person goes: the address asked for, or their organizations. */
function landing(next: string | null | undefined): string {
  return ownPath(next) ?? "/w";
}

export async function signInWithPassword(email: string, password: string, next: string | null): Promise<Refused> {
  const answer = await core<{ session_token: string; policy_current: boolean }>("POST", "/api/v1/sign-in/password", { email, password });
  if (!answer.ok) return { refused: answer.refusal };
  await keepSession(answer.data.session_token);
  redirect(answer.data.policy_current ? landing(next) : `/sign-in/new-account?again=1&next=${encodeURIComponent(landing(next))}`);
}

export async function startSignUp(email: string, password: string): Promise<Refused | { sent: true }> {
  const answer = await core<{ sent: boolean }>("POST", "/api/v1/sign-up", { email, password });
  return answer.ok ? { sent: true } : { refused: answer.refusal };
}

export async function confirmEmail(email: string, code: string): Promise<Refused> {
  const answer = await core<{ consent_token: string; name: string }>("POST", "/api/v1/sign-up/confirm", { email, code });
  if (!answer.ok) return { refused: answer.refusal };
  (await cookies()).set(CONSENT_COOKIE, answer.data.consent_token, hidden(CONSENT_SECONDS));
  redirect("/sign-in/new-account");
}

export async function createAccount(name: string, accepted: boolean, next: string | null): Promise<Refused> {
  const jar = await cookies();
  const consent = jar.get(CONSENT_COOKIE)?.value;
  if (!consent) return { refused: { error: "expired" } };
  const answer = await core<{ session_token: string }>("POST", "/api/v1/account", { consent_token: consent, name, accepted });
  if (!answer.ok) return { refused: answer.refusal };
  jar.set(CONSENT_COOKIE, "", forgotten());
  await keepSession(answer.data.session_token);
  redirect(landing(next));
}

export async function acceptPolicy(next: string | null): Promise<Refused> {
  const answer = await core<{ policy_version: number }>("POST", "/api/v1/session/accept-policy", { accepted: true });
  if (!answer.ok) return { refused: answer.refusal };
  redirect(landing(next));
}

export async function requestPasswordReset(email: string): Promise<Refused | { sent: true }> {
  const answer = await core<{ sent: boolean }>("POST", "/api/v1/password-reset", { email });
  return answer.ok ? { sent: true } : { refused: answer.refusal };
}

export async function resetPassword(email: string, code: string, password: string): Promise<Refused | { changed: true }> {
  const answer = await core<{ changed: boolean }>("POST", "/api/v1/password-reset/confirm", { email, code, password });
  return answer.ok ? { changed: true } : { refused: answer.refusal };
}

export async function signOut(): Promise<void> {
  await core("POST", "/api/v1/sign-out", {});
  (await cookies()).set(SESSION_COOKIE, "", forgotten());
  redirect("/");
}

export type CodeCheck = { state: "free" | "taken" | "not_allowed"; bad_chars: string[]; suggestions: string[] };

export async function checkAddressCode(code: string, name: string): Promise<CodeCheck | Refused> {
  const query = new URLSearchParams({ code, name }).toString();
  const answer = await core<CodeCheck>("GET", `/api/v1/organizations/code-check?${query}`);
  return answer.ok ? answer.data : { refused: answer.refusal };
}

export async function registerOrganization(name: string, code: string): Promise<Refused> {
  const answer = await core<{ code: string }>("POST", "/api/v1/organizations", { name, code });
  if (!answer.ok) return { refused: answer.refusal };
  redirect(`/w/${answer.data.code}`);
}

export type SignIn = { id: string; provider: string; email: string | null; added_at: string; added_country: string | null };

export async function listSignIns(): Promise<{ sign_ins: SignIn[]; offer: string[] } | Refused> {
  const answer = await core<{ sign_ins: SignIn[]; offer: string[] }>("GET", "/api/v1/sign-ins");
  return answer.ok ? answer.data : { refused: answer.refusal };
}

export async function linkEmail(email: string, password: string, code: string | null): Promise<{ sent: boolean; linked: boolean } | Refused> {
  const answer = await core<{ sent: boolean; linked: boolean }>("POST", "/api/v1/sign-ins/email", { email, password, code });
  return answer.ok ? answer.data : { refused: answer.refusal };
}

export async function unlinkSignIn(signInId: string): Promise<{ linked: boolean } | Refused> {
  const answer = await core<{ linked: boolean }>("POST", "/api/v1/sign-ins/unlink", { sign_in_id: signInId });
  return answer.ok ? answer.data : { refused: answer.refusal };
}

/** The email and name the consent step shows, read from the consent token the server keeps. */
export async function consentPerson(): Promise<{ email: string; name: string; provider: string | null } | null> {
  const token = (await cookies()).get(CONSENT_COOKIE)?.value;
  if (!token) return null;
  const c = claims(token);
  return {
    email: String(c.email ?? ""),
    name: String(c.name ?? ""),
    provider: c.kind === "provider" ? String(c.provider ?? "") : null,
  };
}
