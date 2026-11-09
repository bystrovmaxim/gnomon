// packages/maxitor/maxitor-core/web/app/api/v1/sign-in/[provider]/start/route.ts
// Going to a provider: the backend checks the region and answers the consent page's address; the state and the
// PKCE verifier wait in a short HttpOnly cookie until the provider sends the person back.
import { NextResponse, type NextRequest } from "next/server";

import { OAUTH_COOKIE, core, hidden, ownPath } from "@/lib/core";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const next = ownPath(request.nextUrl.searchParams.get("next"));
  const mode = request.nextUrl.searchParams.get("mode") === "link" ? "link" : "sign-in";
  const answer = await core<{ authorize_url: string; state: string; verifier: string }>("POST", "/api/v1/sign-in/start", { provider });
  if (!answer.ok) {
    const where = answer.refusal.error === "region" ? `/sign-in/refused?provider=${encodeURIComponent(provider)}` : `/?error=${encodeURIComponent(answer.refusal.error)}`;
    return NextResponse.redirect(new URL(where, request.url));
  }
  const response = NextResponse.redirect(answer.data.authorize_url);
  const kept = JSON.stringify({ provider, state: answer.data.state, verifier: answer.data.verifier, next, mode });
  response.cookies.set(OAUTH_COOKIE, Buffer.from(kept).toString("base64url"), hidden(10 * 60));
  return response;
}
