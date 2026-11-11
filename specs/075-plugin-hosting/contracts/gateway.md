# Contract: the gateway's actions

All under the core's backend; `pass` and `exchange` are refused from outside the site by `proxy.ts`.

## POST /api/v1/gateway/pass — PassRequestAction

Who: a signed-in account (the session cookie). Decides membership in `@access_decide`.

```json
// in
{ "plugin": "notes", "organization": "acme", "kind": "backend" }
// out
{ "token": "<EdDSA JWT for io.github.bystrovmaxim.notes>", "address": "http://127.0.0.1:41873" }
```

Refusals: no session → `401`; not an active member, plugin unknown or not enabled there → `404 {"error": "not_found"}`; enabled but its process not running → `502 {"error": "not_running"}`.

## POST /api/v1/gateway/exchange — ExchangeTokenAction

Who: anyone holding a plugin token (no session).

```json
// in
{ "token": "<token issued for the caller>", "plugin": "tags", "organization": "acme", "kind": "backend" }
// out
{ "token": "<token for the callee, same sub, sid, org, roles>", "address": "http://127.0.0.1:41990" }
```

Refusals: a token that fails the core's own check, or whose `org` is not `organization` → `401`; the callee not a direct dependency of the caller's version enabled there, or not enabled there → `404`; not running → `502`.

## POST /api/v1/gateway/service-token — ServiceTokenAction

```json
// in
{ "service_key": "<the version's key>", "organization": "acme" }
// out
{ "token": "<token with sub plugin:<id>, roles [service]>" }
```

Refusals: an unknown key, or a version not the one enabled in `organization` → `401`.

## GET /api/v1/jwks — CoreJwksAction

```json
{ "keys": [ { "kty": "OKP", "crv": "Ed25519", "x": "…", "kid": "…", "use": "sig", "alg": "EdDSA" } ] }
```

## The gateway (proxy.ts)

| Request | What happens |
|---|---|
| `/p/<name>/api/<org>/…` with the session cookie | `pass` with `kind: backend`, then rewrite to `address` with `Authorization: Bearer <token>`, no cookie |
| `/p/<name>/<org>/…` with the session cookie | the same with `kind: frontend` |
| `/p/<name>/…` with `Authorization: Bearer` and no cookie | `exchange`, then the same rewrite |
| a changing request with the cookie and a foreign `Origin` | `403` |
| `/api/v1/gateway/pass`, `/api/v1/gateway/exchange` from outside | `404` |
