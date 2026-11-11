# 6. The backend

**Builds on**: [5. Writing](05-writing.md). **Next**: chapter 7, written with bystrovmaxim/gnomon#103.

`app.py` is the passport's `backend.app`: every route is an action under `/p/<name>/api/{organization}`, and every request comes through Maxitor's gateway with a token the core issued for this plugin alone.

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/app.py -->
```python
    tokens = JwtAuthCoordinator(
        jwks_url=keys,
        algorithm="EdDSA",
        audience=passport["id"],
        issuer="maxitor",
        role_registry=CORE_ROLES,
        session_id_claim="sid",
    )
    adapter = FastApiAdapter(
        machine=ActionProductMachine(graph_coordinator=create_node_graph_coordinator()),
        auth_coordinator=OrganizationAuthCoordinator(tokens),
        title=passport["title"],
        version=passport["version"],
    )
    prefix = f"/p/{passport['name']}/api/{{organization}}"
```

- The token is signed with `EdDSA` by the core's key and checked by the core's JWKS (`MAXITOR_CORE_JWKS_URL`); a token for another plugin, another key or older than 60 seconds is refused.
- The plugin never sees the person's session: the gateway removes the core's cookies.
- The organization comes from the address, which the gateway has checked; the template's `OrganizationAuthCoordinator` puts it beside the person.

## The core's roles

A plugin has no roles of its own. The token carries the person's role in the core in that organization — `member` for every active user, `administrator` for its administrators — and `service` for the plugin's own call with no person. Actions check them with the SDK's classes:

```python
from maxitor_plugin_sdk.roles import MemberRole

@check_roles(MemberRole)
```

A missing role is answered 403; another organization's object 404, as if it did not exist:

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/app.py -->
```python
    @app.exception_handler(AccessDenied)
    async def denied(_request: Request, error: AccessDenied) -> JSONResponse:
        """A role the token lacks is 403; another organization's object is 404, as if it did not exist."""
        if error.verdict.gate == Gate.ACCESS_DECIDE:
            return JSONResponse(status_code=404, content={"error": "not_found"})
        return JSONResponse(status_code=403, content={"error": "forbidden"})
```

## Check it

On the local stand, signed in as a member: the reading of chapter 4 answers `200`. Signed out: `401`. With another organization's code: `404`. Maxitor's runner keeps the backend running in its container: `docker kill maxitor-notes_0_6_0-backend`, and within a round it answers again.
