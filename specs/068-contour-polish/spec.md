# Feature Specification: An easy fold control, and a room shares everything the contours do

**Feature Branch**: `feature/issue-63-contour-polish`

**Created**: 2026-11-06

**Status**: Draft

**Input**: Issue #63, after #55 (hovering a resource contour) and #56 (folding contours, the Data sources node).

## Clarifications

### Session 2026-11-06

- Q: How does the control keep its size? → A: It is drawn at screen size: the canvas keeps a CSS variable at one over its zoom, and the control's face and hit area scale by it from the contour's corner. The face is 16 px, the hit area 28 px, at every zoom.
- Q: Where does it stand? → A: Inside a contour's top right corner, growing inward, so it never reaches the name in the middle of the header. A folded box may be smaller on screen than the control, so there it stands outside, to the right of the box's top right corner.
- Q: The hint? → A: "Fold" or "Unfold", the control's own native hint; element tooltips stay taken off.
- Q: What does a room check? → A: The seven items of the issue, 1.2, each with two tabs, one following the other; what does not reach the follower is fixed, and every item gets a test.

## Requirements

- **FR-001**: The fold control's face is 16 px and its hit area 28 px on screen at every zoom; visible at rest; a hand cursor and the hint "Fold" or "Unfold".
- **FR-002**: Inside a contour the control grows inward from its top right corner; on a folded box it stands outside, to the right.
- **FR-003**: A room shares folding, the contour hover, a folded box's hover, a bundle's hover and card, a bundle's click, a Data sources diagram, and, in Side by side, a contour hover and a bundle by identity.
- **FR-004**: Every changed level raises its version; documentation and changelog.

## Success Criteria

- **SC-001**: At 14% and 100% zoom the control measures 16 px with a 28 px hit area in the browser, and a click on its edge folds the contour.
- **SC-002**: Each item of FR-003 has a test that fails when the item stops reaching the follower.
