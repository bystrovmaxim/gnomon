# Shared administration pill tabs

Issue: [#130](https://github.com/bystrovmaxim/gnomon/issues/130). Accepted 2026-11-19.

Users, Invitations and History and Installed and Marketplace are declared through the existing `PanelPage.layers` API. The core shell renders and fixes the selector outside the canvas transform; pages provide choices and counts.

- FR-001: Register administration choices through `PanelPage.layers`; never render a separate pill group inside page content. Exactly one tab is selected; counts and existing URL values remain unchanged.
- FR-002: Fix pills in the core shell. Panning or zooming the canvas must leave their screen coordinates and font sizes unchanged. Search remains on the canvas; controls must not overlap.
- FR-003: Preserve the 14 px labels and 11 px counts. Phone labels remain visible, touch targets are at least 44 px high, and controls fit the initial 375 px viewport without reducing type.
- FR-004: Native buttons never submit a surrounding form. Tabs expose selection and support click/tap and ArrowLeft/ArrowRight/Home/End, with focus following selection.
- FR-005: Extend the existing layer API with an optional query parameter and accessible label. Defaults retain the drawing layer parameter, icons and phone label collapse; text-only page choices keep readable labels.
- FR-006: Keep current, historical and A/B navigation, search and counters. All applicable standalone mockups use the canonical pill styling and matching markup.

Acceptance: desktop (1360 px) and phone (375 px) live Users/Invitations/History and Installed/Marketplace select the intended content, survive reload, preserve search/time parameters and keep their type sizes. API integration tests and mockup guards pass; a real pan-and-zoom browser regression rejects controls inside the transformed scene.
