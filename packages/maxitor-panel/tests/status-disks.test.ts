import assert from "node:assert/strict";
import { test } from "node:test";

import { statusDiskSvg, statusDiskUri } from "../../maxitor-tokens/status-disks.js";
import { checkStatusDisks, checkMockupDiskFrames, sharedDiskFrames } from "../../../scripts/sync-status-disks.mjs";

test("status signs use centred SVG geometry instead of font baselines", () => {
  for (const sign of ["+", "−", "~", "="]) {
    const svg = statusDiskSvg("#16a34a", sign);
    assert.ok(svg.includes('cx="12" cy="12" r="11"'));
    assert.ok(svg.includes("<path "));
    assert.ok(!svg.includes("<text"), "A font baseline shifts the sign away from the disk centre");
    assert.equal(decodeURIComponent(statusDiskUri("#16a34a", sign).split(",")[1]), svg);
  }
  assert.ok(statusDiskSvg("blue", "+").includes('d="M8 12h8M12 8v8"'));
  assert.ok(statusDiskSvg("blue", "CP", 9).includes('>CP</text>'));
});

test("a label cannot insert SVG markup or attributes into a shared disk", () => {
  const svg = statusDiskSvg('red" onload="alert(1)', "</text><script>bad</script>");
  assert.ok(svg.includes("&quot;"));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(!svg.includes("<script>"));
});

test("no application or standalone mockup brings back a private status disk", () => {
  assert.deepEqual(checkStatusDisks(), []);
});

test("every mockup style scope preserves the white gap and outer contour", () => {
  const frame = sharedDiskFrames();
  const valid = `<style>${frame}</style><style>${frame}</style>`;
  assert.deepEqual(checkMockupDiskFrames(valid), []);
  for (const lost of ["border: 1px solid", "background: #fff", "inset 0 0 0 2px #fff"]) {
    assert.equal(checkMockupDiskFrames(valid.replace(lost, "removed")).length, 1);
  }
  assert.equal(checkMockupDiskFrames(`<style></style><style>${frame}</style>`).length, 1);
});
