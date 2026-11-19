# Use the time scale

Every page in Maxitor can be read as it was at any past moment, and compared with another. One control does it for every page: the **pill** on the right of the top row.

## Read a past moment

1. Click the pill. A card opens under it with the page's history: bars of what changed — added green, changed amber, removed red — and, above them, points of what mattered, such as a publication.
2. Click a moment on the scale, or a point. The whole screen shows that moment: the page, the tree and anyone following you. The pill turns blue and names the moment; the address holds it as `at`, so a link or a reload gives the same.
3. To come back, click **Now** beside the pill.

The Now boundary marks the latest known time; what lies right of it is hatched and cannot be chosen. Bars stop at this boundary, including the unfinished current bar. In the past a page is read only: nothing can be written there, except what the page itself offers on a point — the template's **Roll back to v3**, which publishes v3's notes again as a new publication.

The core checks for new changes every five seconds. After the next successful check, the scale reloads its milestones and the current bars. **All** expands to include the new history; a zoomed viewport containing Now follows new changes while preserving its duration. A viewport panned into the past, or a historical selection, stays where you left it. Choose **All** to see the complete history again. Closing and reopening the scale preserves the selected dates and viewport, applying any new history received while it was closed.

Now follows the latest server time, including a publication made in another tab. In **All**, the boundary can remain at almost the same screen position because the displayed range expands with it; its time still advances. A deliberately selected past date remains fixed. Bar queries retain the server timestamp's seconds and microseconds, so the newest publication is included in both its marker and its counts.

Move on the scale as on a map: drag across a stretch to zoom into it, use the wheel to zoom round the pointer, Shift-wheel or a horizontal two-finger trackpad swipe to move; on a phone, drag to move and pinch to zoom. A sideways swipe keeps the visible duration and the selected moments unchanged, including when its momentum has a small vertical drift. A separate vertical wheel gesture zooms again. The presets 1 min, 10 min, 1 h, 1 d, 7 d, 30 d and All show a stretch at once. Hover a point to read its card; hover a bar to see what it counts. The "i" explains every mark the page uses. Shift + ← → step to the previous or the next change from anywhere.

## Compare two moments

The card's switch offers what the page can draw:

- **Diff** shows the later moment, B, with what changed since the earlier one, A: each changed element wears its colour and a soft halo, the rest is faded — point at a faded element and it is drawn whole again. The pill counts the changes, "+2 −1 ~1". A stepper in the page's corner walks them — Shift + ↑ ↓ from anywhere — and opens each one's card beside the element, as the graph viewer does.
- **Side by side** shows A on the left and B on the right, each with its head. With **Track** on, what you point at in one panel lights up in the other, and what you choose there is brought into view. When the other panel cannot show it, it says why: "Not in A", or "Hidden by the filters". On a phone one panel shows at a time, with an A / B switch.

A's handle stands on the scale's top edge, B's on its axis, so the two never hide each other. A click in the plot chooses whichever boundary is horizontally nearer. Equal distances, including coincident boundaries, use the upper half for A and the lower half for B. Press on the top edge to take A there, on the axis to take B there, and drag on.

B follows incoming publications only when it says **Now**. In Diff and Side by side, the scale and B's content refresh together; A remains at its selected date. Clicking a publication fixes B at that exact timestamp, even if it is the newest publication and initially coincides with Now. Its chip shows the date. Moving A does not turn a fixed B back into Now, and moving B does not round A's publication timestamp. These rules also apply to the phone's A / B switch and survive closing and reopening the scale.

Hover the grey interval to reveal **Move interval**, then drag that control to move both bounds while keeping their distance. The control hides when the pointer leaves the interval; it remains visible during a drag or keyboard focus. With the control focused, Left and Right move one bar at a time, or ten with Shift. Shift-drag also moves both bounds, even when started beside a handle; Shift-click outside the interval centres it on the pointer. The interval stops as a whole at the beginning of history or Now. Its grey shading ends at the axis, leaving the time labels clear. A drag elsewhere still zooms into a stretch; on a phone the scale still pans. To return to one moment, choose **One**.

The moment and the comparison stay with you as you move through the tree, Back and the crumbs, from one plugin's page to another's: a page that cannot compare shows the moment alone, and the next one that can compares again.

An upper click or grab selects A; a lower click or grab selects B. Crossing is allowed: when A is placed after B, or B before A, the bounds exchange places so A remains the earlier time and B the later time. Both selected times are preserved. This also applies to milestone clicks.

Under the comparison scale, only the milestone comments at A and B are shown. Intermediate versions remain points on the scale; there is no separate list below it.

Open **i** for scale gestures and keyboard shortcuts. These instructions appear only inside the information panel, leaving the area below the scale for the selected milestone comments.

In One mode, clicking inside the plot chooses the indicated date and leaves the scale open. The transient pointer guide is part of the scale; removing it during a gesture must not turn that gesture into an outside click.
