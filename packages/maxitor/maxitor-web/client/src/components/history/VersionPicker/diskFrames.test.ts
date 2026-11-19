import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { statusDiskSvg } from "@maxitor/tokens/status-disks";

afterEach(() => { document.body.replaceChildren(); document.head.querySelectorAll('[data-disk-test]').forEach(el => el.remove()); });

it("status and initials disks retain a distinct outer contour and white separation", () => {
  const style = document.createElement("style");
  style.dataset.diskTest = "true";
  style.textContent = readFileSync(resolve(process.cwd(), "../../../maxitor-panel/src/shell/shell.css"), "utf8");
  document.head.append(style);
  for (const sign of ["+", "−", "=", "~", "CP"]) {
    const disk = document.createElement("span");
    disk.className = "mx-status-disk mx-disk";
    disk.innerHTML = statusDiskSvg("#2563eb", sign, sign === "CP" ? 9 : 14);
    document.body.append(disk);
    const frame = getComputedStyle(disk);
    expect(frame.borderTopWidth).toBe("1px");
    expect(frame.borderTopStyle).toBe("solid");
    expect(frame.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(frame.borderRadius).toBe("50%");
    expect(Number(disk.querySelector("circle")!.getAttribute("r"))).toBeLessThan(12);
  }
});
