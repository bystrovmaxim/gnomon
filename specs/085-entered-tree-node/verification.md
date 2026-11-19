# Root tree alignment — 2026-11-19

Root entry icons now share the collapse icon's right edge. The live tree marks only root containers with `mx-tree-root`; CSS removes their empty fold slots and uses the existing slot/icon tokens for the left padding. Expansion controls and entered-level indentation retain their gutters. The equivalent root states in mockups 072 and 085 were updated. The phone drawer in mockup 072 also explicitly displays inside a simulated phone, independent of the outer desktop viewport.

In the localhost:3013 demo, Notes and Settings previously ended at x = 46 px while collapse ended at x = 24 px. All three now end at x = 24 px. At 375 px, the drawer's 1 px border places both entry edges at x = 25 px. Existing row fonts remain 13 px on desktop and 14 px on the phone. Entering Notes removes the root alignment class; its child hierarchy remains indented.

`web/scripts/check-root-tree.mjs` measures actual rendered SVG bounds and requires a visible tree. The core browser runner contains desktop/phone production and standalone-mockup scenarios. The helper passed in the demo at desktop and phone widths and in mockup 085 in both device modes. Mockup 072's root Settings edge matched collapse on desktop and the shared icon column on the simulated phone. The full runner was not executed end to end; these UI steps were verified through browser automation. TypeScript, script syntax and diff whitespace checks passed.

Adversarial verification temporarily removed the two live root CSS rules. The browser regression failed with `Notes: icon right edge 46 differs from collapse 24`. Restoring the rules returned it to green. The mobile mockup's previously hidden drawer was reproduced as an unavailable Back control, then verified visible and aligned after correction.

Evidence: `.core-stand/admin-canvas/root-tree-alignment.json`, `root-tree-desktop.jpg` and `root-tree-phone.jpg`. No commit, push or pull request was made.


## Stationary first section — 2026-11-19

Entering Notes previously moved its icon center from y = 110 to y = 96 CSS px on desktop. In the phone drawer the empty controls row was only 6 px high at the root, growing to 38 px when Back appeared; the icon moved from y = 78 to y = 96. Its label also moved left by 2 px, and the phone label changed from 14 to 13 px.

The controls row now reserves 38 px in both states. The level heading shares the first root row's leading space, row height, icon slot and line height; its bottom border is accounted for outside that row height. In the live demo both states place the icon center at y = 110. The label stays at x = 32 on desktop and x = 33 in the phone drawer (its 1 px border), with the established 13 px and 14 px type sizes respectively. Children appear below the stationary heading. The corresponding geometry is updated in mockups 072 and 085; no navigation or time-selection logic changed.

The browser helper `checkEnteredTreePosition(tree)` runs Enter → Back twice, comparing the actual horizontal positions and vertical centers of the icon and label to a 0.1 px tolerance and requiring the same icon size. On a phone it reopens the drawer after page navigation, matching the existing close-on-selection behavior. The same helper is included in the core browser runner for the live tree and the standalone entered-tree mockup. The core mockup additionally checks that entering Settings does not resize its controls row.

Verification passed in the localhost:3013 demo at 1280 × 720 and 375 × 812, and in mockup 085's desktop and phone modes. Every visit and return had zero positional drift. Mockup 072's controls stayed at 38 CSS px (26.041 px after the desktop stage's scale), including its phone root and entered state. Mobile verification used a browser viewport, not a physical handset. The shared helpers and scenario steps ran through browser automation; the complete sign-in and plugin-installation runner was not rerun for this CSS change. Core TypeScript, both browser scripts' syntax and diff whitespace checks passed.

Adversarial verification restored the actual previous stylesheet. The new regression failed on desktop with `Enter: icon y moved from 110 to 96` and on phone with `Enter: icon y moved from 78 to 96`; the existing icon-edge alignment checks still passed at both sizes. Restoring the corrected stylesheet returned both repeated-transition checks to green.

Evidence: `.core-stand/admin-canvas/stable-tree-heading.json`, `stable-tree-root-desktop.jpg`, `stable-tree-entered-desktop.jpg` and `stable-tree-entered-phone.jpg`. No commit, push or pull request was made.
