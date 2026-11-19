# Plan

One implementation phase on `feature/issue-130-admin-pill-tabs`, based on PR #129, followed by a publication-fix phase if the closing checks expose a release mismatch.

Use the existing `PanelPage.layers` API. Administration pages publish plain layer choices through their parent shell, as they already publish actions. The shell owns selection through the existing `tab` parameter, fixed placement, keyboard behavior and counts. Keep the reusable pill renderer internal; remove its public content API and all inline page instances. Reserve vertical space above the canvas content for the shell controls.

Extend Layers with optional `param` and `label` and optional icons; existing drawing layers retain their defaults. Text-only page choices keep their labels on phones and existing administration type sizes.

Synchronize canonical styles through the existing administration mockup generator and update the Users/Plugins markup in the core and marketplace prototypes. Add targeted component, wiring and mockup regression coverage plus a live browser walk for selection, keyboard, reload, historical/A/B context, responsive dimensions and fixed coordinates during real canvas pan/zoom.

Constitution check: no schema, backend, authorization or graph changes. Existing platform tokens and components remain authoritative. No constitution or submodule edits. Checks precede final documentation and changelog; affected package versions are raised. The implementation is delivered in one phase commit and one PR for #130; CI owns the closing check run, and local browser checks run on the pushed commit.
