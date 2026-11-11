# Research: running plugins

## R1. Where the gateway lives

**Decision**: in the core's Next.js application (`web/proxy.ts`), which already serves the site and passes `/api/**` to the core's backend.

**Rationale**: the site is one origin and the application is already in front of everything; a second front process would duplicate its routing. Every endpoint stays an action: the application only asks `PassRequestAction` and hands the request on with Next.js's rewrite and its request headers.

**Alternatives**: a hand-written proxy route in the core's FastAPI backend — refused, an endpoint that is not an action; an external proxy (nginx, Caddy) — refused, it cannot ask the core for a token per request without code of its own.

## R2. Who starts the processes

**Decision**: `maxitor-plugin-runner`, a process of its own beside `maxitor-plugin-installer`, connected as `maxitor_core`, running the domain `plugins`' actions in itself every round (10 s by default). One runner works at a time: it holds the advisory lock `plugin-runner` on a connection of its own; a second runner waits for it.

**Rationale**: the core's web process may run in several workers and must not own children; the installer holds the privileged role `maxitor_installer` and must not start untrusted code.

## R3. A version's images and containers

**Decision**: two images per version, built once: `maxitor-plugin/<schema>-backend:<sha>` from `python:<x.y>-slim` with `pip install --find-links /wheels <wheel>` (the folder `MAXITOR_PLUGIN_FIND_LINKS` copied in), run as `python -m uvicorn <backend.app> --factory` on port 8000; `maxitor-plugin/<schema>-frontend:<sha>` from `node:22-slim` with the wheel's `frontend.build`, run as `node /app/server.js` on 3000. A container `maxitor-<schema>-<kind>`: `--user 65534:65534 --cap-drop ALL --security-opt no-new-privileges --read-only --tmpfs /tmp`, memory, CPU and pids limits, the network `maxitor-<schema>`, `--publish 127.0.0.1::<port>`.

**Rationale**: processes of one operating-system user read each other's environment files and the runner's environment; a container sees only its own. Docker is already on the stand and the local stand (PostgreSQL).

## R4. Ports and addresses

**Decision**: Docker publishes the container's port on a free port of `127.0.0.1`; the runner waits up to 60 s for an HTTP answer there and records `http://127.0.0.1:<port>` and the container's name in `plugin_process`. A container that does not come up is removed, its failures counted, and the next start waits `min(5 s · 2^(failures−1), 300 s)`.

## R5. Signing

**Decision**: `PluginTokensController` loads the Ed25519 private key from `MAXITOR_GATEWAY_KEY_FILE` (PEM) once; tokens via PyJWT `EdDSA`; the JWKS is `{"keys": [{"kty": "OKP", "crv": "Ed25519", "x": …, "kid": …, "use": "sig", "alg": "EdDSA"}]}` with `kid` the key's SHA-256 thumbprint. A plugin checks by `JwtAuthCoordinator(jwks_url=…, algorithm="EdDSA", audience=<id>, issuer="maxitor")`.

**Rationale**: rule 56 (1.7.0); AOA's coordinator already takes `jwks_url`.

## R6. Which roles

**Decision**: `member` for an active user of the organization of the address, `administrator` added when `is_admin`, `service` for a service token; read by the pass from `organization."user"` at issue time. `maxitor-plugin-sdk` gives `MemberRole`, `AdministratorRole`, `ServiceRole`. A passport's `roles` and a node's `roles` other than `member`/`administrator` are refused by `maxitor-plugin-check` and by the core's check of a version.

## R7. Exchange and service tokens

**Decision**: `ExchangeTokenAction` reads the incoming token with the core's own key, takes the caller's passport id from `aud`, finds the caller's enabled version in the token's organization and refuses unless the callee's passport id is among that version's dependencies and the callee is enabled there. `ServiceTokenAction` finds a version by `sha256(service_key)`, refuses unless that version is the one enabled in the asked organization. The service key is `secrets.token_urlsafe(32)`, written as `MAXITOR_PLUGIN_SERVICE_KEY` into the version's environment file at deployment.

## R8. Keeping the decisions inside the site

**Decision**: `proxy.ts` answers `404` to any outside request for `/api/v1/gateway/pass` and `/api/v1/gateway/exchange`; it calls them itself at the backend's inner address. `/api/v1/gateway/service-token` and `/api/v1/jwks` stay reachable: the first is guarded by the key, the second is public by nature.

## R9. Testing the frontend process

**Decision**: the test builds a probe wheel whose backend is a tiny ASGI factory requiring `uvicorn` and whose frontend build is a `server.js` of a few lines; it builds both images, runs both containers and reads from the backend its environment and its user id. It runs where Docker is.
