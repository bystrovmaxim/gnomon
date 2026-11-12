# Contract: the build step and the author's command

The one step that turns a plugin version's frontend sources into a frontend image. The installer runs it on deployment and on an upgrade; `maxitor plugin build` runs it for an author. Both give the same result or the same first error (SC-005).

## Input

- The plugin's frontend folder (`frontend.source` of passport 3): `package.json`, `package-lock.json`, the sources.
- The core version: its builder image `maxitor-plugin-builder:<core version>`, its library under `/maxitor/lib/`, its npm list.

## Steps, in order — the first that fails ends the build with its error

1. **Lock present and matching**: `package-lock.json` exists and its root entry matches `package.json` — else `the lock file is missing or does not match package.json`.
2. **Library replaced**: every `@maxitor/*` entry of `package.json` and of the lock points to `/maxitor/lib/<name>`; a name the core does not carry fails: `@maxitor/<name> is not a package of the core <version>`.
3. **Names on the list**: every other package name in the lock is on the core's list — else `<name> is not on the core's list of npm packages`; every `resolved` URL is on `https://registry.npmjs.org/` — else `<name> is resolved from <host>, not from npm`.
4. **Fetch**: `npm ci --ignore-scripts` with the registry set to npm and the plugin's `.npmrc` left behind, as user 65534, filling npm's cache: npm downloads only the lock's URLs, each checked in step 3, and no code of the plugin or of its packages runs.
5. **Build**: in a container with no network, as user 65534: `npm ci --offline` with the development packages, then `next build` with only the core's variables (`NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`, `TZ=UTC`, `LANG=C.UTF-8`); the output must be `standalone`.
6. **Image**: `.next/standalone`, `.next/static` and `public/` copied into `maxitor-plugin/<schema>-frontend:<sha12>-<core version>` on `node:22-slim`, run as 65534 with `node server.js`.

## Errors

The error a build reports is the first error line of the failing step, as `EnvironmentInstallError` gives it today: npm's `npm error …`, Next.js's `Type error: …` or `Error: …` with its file and line.

## `maxitor plugin build <path> --core <version>`

- `<path>`: a plugin's folder (its `maxitor-plugin.yaml` and its frontend's sources).
- `--core <version>`: must equal the installed `maxitor` version; otherwise exit 2 with `maxitor <installed> is installed; pip install "maxitor[plugins]==<version>" to build for the core <version>`.
- Exit 0 and the image's name when built; exit 1 and the error of the failing step otherwise.
- Without the `plugins` extra or without Docker: exit 2 with what to install.
