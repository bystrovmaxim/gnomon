# Quickstart: a plugin behind the gateway on the local stand

```bash
./scripts/core-stand.sh up
```

The stand makes the gateway's key (`.core-stand/gateway-key.pem`) and the wheels folder (`.core-stand/find-links/`) the first time, then starts the backend, the installer, the runner and the application.

1. Open `http://localhost:3000`, create an account, register the organization `acme`.
2. Settings → Plugins: install `notes`. Within a minute the installer deploys it; within ten seconds more the runner starts its backend.
3. In the same browser call the template through the gateway:

   ```text
   http://localhost:3000/p/notes/api/acme/lists/list_note_authors
   ```

   The answer is the template's (an empty list). Signed out, the answer is `401`; with `beta` in place of `acme`, `404`.
4. Stop the template's backend by hand (`kill <pid>` from `plugin_process`); within two rounds it runs again.
5. Disable `notes` in `acme`: the call answers `404`, and the runner stops the backend.
