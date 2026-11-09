// packages/maxitor/maxitor-core/web/app/api/v1/sign-in/[provider]/callback/route.ts
// The provider sends the person back: the backend checks the region again and the answer, then this route puts
// the session into its cookie, or the consent token for a new person, and sends the person on.
import { NextResponse, type NextRequest } from "next/server";

import { CONSENT_COOKIE, OAUTH_COOKIE, SESSION_COOKIE, SESSION_SECONDS, core, forgotten, hidden, ownPath } from "@/lib/core";

type Kept = { provider: string; state: string; verifier: string; next: string | null; mode: "sign-in" | "link" };

function kept(request: NextRequest): Kept | null {
  const raw = request.cookies.get(OAUTH_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Kept;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const q = request.nextUrl.searchParams;
  const k = kept(request);
  const go = (where: string) => {
    const response = NextResponse.redirect(new URL(where, request.url));
    response.cookies.set(OAUTH_COOKIE, "", forgotten());
    return response;
  };
  if (!k || k.provider !== provider) return go("/?error=expired");
  const next = ownPath(k.next);
  if (q.get("error") || !q.get("code")) return go(k.mode === "link" ? `${next ?? "/w"}?methods=provider` : "/?error=provider");
  const body = { provider, code: q.get("code"), state: q.get("state") ?? "", expected_state: k.state, verifier: k.verifier };

  if (k.mode === "link") {
    const back = (word: string) => `${next ?? "/w"}${(next ?? "/w").includes("?") ? "&" : "?"}methods=${encodeURIComponent(word)}`;
    const linked = await core<{ linked: boolean }>("POST", "/api/v1/sign-ins/link", body);
    if (linked.ok) return go(back("linked"));
    if (linked.refusal.error === "region") return go(`/sign-in/refused?provider=${encodeURIComponent(provider)}`);
    return go(back(linked.refusal.error));
  }

  const answer = await core<{ session_token: string | null; policy_current: boolean; consent_token: string | null; name: string }>("POST", "/api/v1/sign-in/finish", body);
  if (!answer.ok) {
    if (answer.refusal.error === "region") return go(`/sign-in/refused?provider=${encodeURIComponent(provider)}`);
    return go(`/?error=${encodeURIComponent(answer.refusal.error)}`);
  }
  if (answer.data.session_token) {
    const target = answer.data.policy_current ? next ?? "/w" : `/sign-in/new-account?again=1&next=${encodeURIComponent(next ?? "/w")}`;
    const response = go(target);
    response.cookies.set(SESSION_COOKIE, answer.data.session_token, hidden(SESSION_SECONDS));
    return response;
  }
  const response = go(`/sign-in/new-account${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  response.cookies.set(CONSENT_COOKIE, answer.data.consent_token ?? "", hidden(15 * 60));
  return response;
}
