// Check actual rendered filter rows, including absent statuses: colour alone is not a status icon.
import assert from "node:assert/strict";

export async function expectStatusDisks(frame, filter, signs) {
  const rows = frame.locator(`[data-filter="${filter}"] .mx-filter-row`);
  await rows.first().waitFor();
  const disks = await rows.evaluateAll((elements) => elements.map((row) => {
    const svg = row.querySelector(".mx-status-disk > svg");
    return {
      sign: svg?.getAttribute("data-sign") ?? "",
      radius: svg?.querySelector("circle")?.getAttribute("r"),
      viewBox: svg?.getAttribute("viewBox"),
      geometry: !!svg?.querySelector("path"),
      border: row.ownerDocument.defaultView.getComputedStyle(row.querySelector(".mx-status-disk")).borderTopWidth,
    };
  }));
  assert.deepEqual(disks.map((disk) => disk.sign), signs, `${filter}: every status needs its sign`);
  assert.ok(disks.every((disk) => disk.radius === "11" && disk.viewBox === "0 0 24 24" && disk.geometry && disk.border === "1px"), `${filter}: use the graph viewer's production SVG`);
}
