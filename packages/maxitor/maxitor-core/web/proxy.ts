// packages/maxitor/maxitor-core/web/proxy.ts
// The core's gateway and its session keeper, in front of every request to the site.
//
//   /p/<name>/api/<organization>/**  ──► the plugin's backend    after PassRequestAction says it may pass
//   /p/<name>/<organization>/**      ──► the plugin's frontend   the same
//   /api/v1/gateway/pass, /exchange  ──► 404 from outside: only the gateway itself asks them, at the backend's address
//   /api/**                          ──► the core's backend (next.config.ts)
//   every other page                 ──► the core's pages; the session is renewed when half of it is gone
//
// A request to a plugin loses the core's cookies and any Authorization it came with; the plugin gets the token
// the core issued for it. Whether it may pass and with which roles is decided by the core's action, never here.
// A plugin's page lives only inside the right panel (spec 077, R12): opened as a document of its own it is sent to
// its panel address /w/<organization>/<name>/..., and no other site may frame it.
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "__Host-maxitor_session";
const SESSION_SECONDS = 8 * 60 * 60;
const API = process.env.MAXITOR_CORE_API ?? "http://127.0.0.1:8020";
const PLUGIN_PATH = /^\/p\/([a-z][a-z0-9_]{0,30})\/(api\/)?([a-z0-9][a-z0-9-]{0,62})(?:\/|$)/;
// A plugin page's own scripts and styles: Next.js asks them under its basePath, with no organization in the path.
const PLUGIN_ASSET = /^\/p\/([a-z][a-z0-9_]{0,30})\/_next\//;
const DECISIONS = new Set(["/api/v1/gateway/pass", "/api/v1/gateway/exchange"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type Pass = { address: string; token?: string };

function refused(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

function forwardedFor(request: NextRequest): Record<string, string> {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? { "x-forwarded-for": forwarded } : {};
}

// The site's own origin: the public address when the site stands behind another proxy, the request's otherwise.
function siteOrigin(request: NextRequest): string {
  const configured = process.env.MAXITOR_PUBLIC_URL;
  return configured ? new URL(configured).origin : request.nextUrl.origin;
}

async function askPass(request: NextRequest, session: string, plugin: string, organization: string, kind: string): Promise<Response> {
  return fetch(`${API}/api/v1/gateway/pass`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${session}`, ...forwardedFor(request) },
    body: JSON.stringify({ plugin, organization, kind }),
    cache: "no-store",
  });
}

async function askExchange(request: NextRequest, token: string, plugin: string, organization: string, kind: string): Promise<Response> {
  return fetch(`${API}/api/v1/gateway/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json", ...forwardedFor(request) },
    body: JSON.stringify({ token, plugin, organization, kind }),
    cache: "no-store",
  });
}

/** Only the site itself may lay a plugin's page in a frame. */
const FRAME_ANCESTORS = "frame-ancestors 'self'";

async function gateway(request: NextRequest, match: RegExpExecArray): Promise<NextResponse> {
  const [whole, plugin, api, organization] = match;
  const kind = api ? "backend" : "frontend";
  if (kind === "frontend" && request.headers.get("sec-fetch-dest") === "document") {
    const rest = request.nextUrl.pathname.slice(whole.replace(/\/$/, "").length);
    const panel = new URL(`/w/${organization}/${plugin}${rest}${request.nextUrl.search}`, siteOrigin(request));
    return NextResponse.redirect(panel, 303);
  }
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const bearer = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  let answer: Response;
  try {
    if (session) {
      // A request carried by the browser's cookie must come from the site itself, or it may be forged elsewhere.
      const origin = request.headers.get("origin");
      if (!SAFE_METHODS.has(request.method) && origin !== siteOrigin(request)) return refused(403, "foreign_origin");
      answer = await askPass(request, session, plugin, organization, kind);
    } else if (bearer) {
      // A plugin calling a plugin it depends on, with the token it was given.
      answer = await askExchange(request, bearer, plugin, organization, kind);
    } else {
      return refused(401, "unauthorized");
    }
  } catch {
    return refused(502, "core_unreachable");
  }
  if (!answer.ok) {
    if (answer.status === 401) return refused(401, "unauthorized");
    if (answer.status === 502) return refused(502, "not_running");
    return refused(404, "not_found");
  }
  const pass = (await answer.json()) as Pass;
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("authorization");
  if (pass.token) headers.set("authorization", `Bearer ${pass.token}`);
  const target = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, pass.address);
  const response = NextResponse.rewrite(target, { request: { headers } });
  response.headers.set("content-security-policy", FRAME_ANCESTORS);
  return response;
}

function expiresAt(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: number };
    return payload.exp ?? 0;
  } catch {
    return 0;
  }
}

// Keeps an active session alive: when less than half of the token's eight hours is left, the backend's
// RenewSessionAction signs a new one, up to 30 days from signing in; a refused renewal ends the session.
async function keepSession(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.next();
  const left = expiresAt(token) - Date.now() / 1000;
  if (left > SESSION_SECONDS / 2) return NextResponse.next();
  let renewed: string | null = null;
  let ended = false;
  try {
    const answer = await fetch(`${API}/api/v1/session/renew`, {
      method: "POST",
      headers: { "content-type": "application/json", ...forwardedFor(request) },
      body: JSON.stringify({ session_token: token }),
      cache: "no-store",
    });
    if (answer.ok) renewed = ((await answer.json()) as { session_token: string }).session_token;
    else ended = answer.status === 401;
  } catch {
    return NextResponse.next();
  }
  if (renewed) {
    // The pages of this request already read the new token; the browser keeps it from the answer.
    request.cookies.set(SESSION_COOKIE, renewed);
    const response = NextResponse.next({ request });
    response.cookies.set(SESSION_COOKIE, renewed, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
    return response;
  }
  if (ended) {
    request.cookies.delete(SESSION_COOKIE);
    const response = NextResponse.next({ request });
    // A "__Host-" cookie goes only with Secure and Path=/ again.
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  }
  return NextResponse.next();
}

/** The plugin page a request for its scripts or styles comes from: its Referer, on this site, under the same plugin. */
function assetPage(request: NextRequest, plugin: string): RegExpExecArray | null {
  const referer = request.headers.get("referer");
  if (!referer) return null;
  let from: URL;
  try {
    from = new URL(referer);
  } catch {
    return null;
  }
  if (from.origin !== siteOrigin(request) && from.origin !== request.nextUrl.origin) return null;
  const page = PLUGIN_PATH.exec(from.pathname);
  if (!page || page[1] !== plugin || page[2]) return null;
  // The match keeps the asset's own path: only the plugin and the organization are taken from the page.
  page[0] = `/p/${plugin}/${page[3]}`;
  return page;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (DECISIONS.has(path)) return refused(404, "not_found");
  const asset = PLUGIN_ASSET.exec(path);
  if (asset) {
    // The organization is the one of the page that asks for them, as its address names it; the gateway then checks
    // the session and the membership as for the page itself.
    const page = assetPage(request, asset[1]);
    return page ? gateway(request, page) : refused(404, "not_found");
  }
  const plugin = PLUGIN_PATH.exec(path);
  if (plugin) return gateway(request, plugin);
  if (path.startsWith("/p/")) return refused(404, "not_found");
  if (path.startsWith("/api/")) return NextResponse.next();
  return keepSession(request);
}

export const config = {
  // Everything but Next.js's own files: the gateway sees /p/** and the decisions under /api/v1/gateway.
  matcher: ["/((?!_next|favicon.ico).*)"],
};
