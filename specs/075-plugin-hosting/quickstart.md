# Quickstart: a plugin behind the gateway on the local stand

```bash
./scripts/core-stand.sh up
```

The stand makes the gateway's key (`.core-stand/gateway-key.pem`) and the wheels folder (`.core-stand/find-links/`) the first time, then starts the backend, the installer, the runner and the application.

1. Open `http://localhost:3000`, create an account, register the organization `acme`.
2. Settings → Plugins: install `notes`. Within seconds the installer deploys it; the runner builds its image the first time (about a minute) and starts `maxitor-notes_0_6_0-backend`.
3. In the same browser call the template through the gateway:

   ```text
   http://localhost:3000/p/notes/api/acme/items/00000000-0000-4000-8000-000000000001/notes
   ```

   The answer is the template's: `{"notes":[],"bars":[]}`. Signed out, the answer is `401`; with `beta` in place of `acme`, `404`.
4. Stop the template's backend by hand (`docker kill maxitor-notes_0_6_0-backend`); within two rounds it runs again.
5. Disable `notes` in `acme`: the call answers `404`, and the runner removes its container.
