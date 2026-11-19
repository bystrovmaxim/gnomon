import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { statusDiskSvg } from "@maxitor/tokens/status-disks";

afterEach(() => { document.body.replaceChildren(); document.head.querySelectorAll('[data-disk-test]').forEach(el => el.remove()); });

it("status and initials disks retain a distinct outer contour and white separation", () => {
  const style = document.createElement("style");
  style.dataset.diskTest = "true";
  // JSDOM does not resolve custom properties in computed styles; substitute the real theme values.
  const theme = readFileSync(resolve(process.cwd(), "../../../maxitor-tokens/tokens.css"), "utf8");
  const tokens = new Map([...theme.matchAll(/(--mx-[\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2]]));
  let css = readFileSync(resolve(process.cwd(), "../../../maxitor-panel/src/shell/shell.css"), "utf8");
  for (let pass = 0; pass < 4; pass++) css = css.replace(/var\((--mx-[\w-]+)\)/g, (value, name) => tokens.get(name) ?? value);
  style.textContent = css;
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
