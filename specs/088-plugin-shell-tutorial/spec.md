# Plugin tutorial: shell controls and canvas content

Issue: [#132](https://github.com/bystrovmaxim/gnomon/issues/132). Accepted 2026-11-19.

Document the existing panel 0.8.0 / Maxitor 4.12.1 API introduced by #130. No runtime, schema or authorization behavior changes.

- FR-001: Chapter 8 shows a complete client-component example declaring page choices through `PanelPage.layers`, including selection from `usePanelQuery`, counts, defaults and a dedicated query parameter.
- FR-002: Distinguish fixed shell controls, canvas content, contextual buttons and core dialogs. Explain initial camera spacing, phone behavior and the prohibition on a plugin's own fixed-position controls.
- FR-003: Audit every existing tutorial chapter; correct related navigation, history, A/B, verification and compatibility omissions, with an accurate index.
- FR-004: Verify the example against the real package types, existing source quotations and local links. Demonstrate that a broken example or quotation fails validation.
- FR-005: Publish one documentation phase commit with a documentation changelog and a PR closing #132. Keep unrelated launch configuration unchanged.

Success: readers can declare Cards/Table pills, observe `?view=table` and the omitted Cards default, and distinguish stationary controls from moving content on desktop, phone and A/B. Validation passes on the final text. No unresolved product decision is required.
