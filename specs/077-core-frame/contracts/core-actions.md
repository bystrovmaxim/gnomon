# Contract: the core's actions and routes of the frame

| Route | Action | Who | Answer |
|---|---|---|---|
| `GET /api/v1/organizations/{code}/tree` | `ReadOrganizationTreeAction` | a member of `code` | `{ nodes: TreeNode[] }` (data-model), filtered by the person's roles |
| `GET /api/v1/organizations/{code}/watermark` | `ReadWatermarkAction` | a member of `code` | `{ at: string }`, the organization's watermark to the microsecond |

`OpenOrganizationAction` keeps answering the organization and the user; its `plugins` list is gone, as the tree answers it.

## Refusals

| Where | Reason | When |
|---|---|---|
| `CheckVersionAction` | `navigation` | the version's `navigation.yaml` breaks a rule of one file (R4, item 1) |
| `RequestInstallAction`, `EnablePluginAction` | `navigation` | the organization's tree with the version would not hold (R4, item 2) |
| the core's start | — | the core's own `navigation.yaml` does not hold: the core does not start |

## Pages of the core's application

| Address | Page |
|---|---|
| `/w/<code>` | the frame with the organization's root in the panel |
| `/w/<code>/core/settings/plugins` | Settings → Plugins, drawn in the panel |
| `/w/<code>/core/panel-test` | the panel's test page in the `iframe`, administrators only |
| `/w/<code>/<plugin>/<path>` | the plugin's page in the `iframe` at `/p/<plugin>/<code>/<path>` |
| `/w/<code>/settings/plugins` | redirects to `/w/<code>/core/settings/plugins` |
| `/panel-test/<code>` | the test page itself, drawn with `@maxitor/panel` |

## The gateway

- A request to `/p/<name>/<organization>/**` with `Sec-Fetch-Dest: document` is redirected to `/w/<organization>/<name>/**` with the same query.
- Every answer of `/p/**` carries `Content-Security-Policy: frame-ancestors 'self'`.
