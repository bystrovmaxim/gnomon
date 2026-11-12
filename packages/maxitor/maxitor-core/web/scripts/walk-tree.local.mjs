// A local walk of #121's 1.6 by two people, Anna and Olga, in one organization: not part of the repository's checks.
// Olga becomes a member by a row written into the stand's database, as invitations come only with #13.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.MAXITOR_STAND_URL;
const OUTBOX = process.env.MAXITOR_STAND_OUTBOX;
const DB = process.env.MAXITOR_STAND_CONTAINER;
const SHOTS = process.env.SHOTS;
const RUN = Date.now().toString(36);
const CODE = `walk-${RUN}`;
const PASSWORD = `Walk-Horse-${RUN}`;
const say = (...a) => console.log(...a);
const expect = (ok, what) => { if (!ok) throw new Error(what); say(`OK   ${what}`); };

async function codeFor(email, after) {
  for (let i = 0; i < 100; i += 1) {
    for (const name of readdirSync(OUTBOX)) {
      const path = join(OUTBOX, name);
      if (statSync(path).mtimeMs < after) continue;
      const text = readFileSync(path, "utf8");
      const found = text.includes(`To: ${email}`) && text.match(/^Subject: (\d{3}) (\d{3})/m);
      if (found) return found[1] + found[2];
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no letter to ${email}`);
}

async function signUp(page, email, name) {
  await page.goto(`${BASE}/sign-up`);
  const sent = Date.now() - 1000;
  await page.getByLabel("Email").fill(email);
  await page.locator("#pw-new-password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Six-digit code").fill(await codeFor(email, sent));
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.waitForURL("**/sign-in/new-account");
  await page.getByLabel("Your name").fill(name);
  await page.locator(".check").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/new");
}

const sql = (query) => execFileSync("docker", ["exec", DB, "psql", "-U", "postgres", "-d", "maxitor", "-tA", "-c", query], { encoding: "utf8" }).trim();
const browser = await chromium.launch();
const open = async () => {
  const context = await browser.newContext({ viewport: { width: 1360, height: 840 } });
  await context.addInitScript(() => window.localStorage.setItem("maxitor_cookie_consent", "1"));
  return context.newPage();
};
const anna = await open();
const api = `${BASE}/p/notes/api/${CODE}`;
const send = { headers: { Origin: BASE } };
const shot = (page, name) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
const frameOf = async (page) => {
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 60_000 });
  return page.frameLocator("iframe.mx-panel-frame");
};

await signUp(anna, `tree-${RUN}@example.com`, "Anna Kovaleva");
await anna.getByLabel("Organization’s name").fill(`Walk ${RUN}`);
await anna.getByText("free").waitFor();
await anna.getByRole("button", { name: "Register and enter" }).click();
await anna.waitForURL(`**/w/${CODE}`);
await anna.goto(`${BASE}/w/${CODE}/core/settings/plugins`);
await anna.getByRole("tab", { name: /Marketplace/ }).click();
await anna.locator(".mcard", { hasText: "Notes" }).getByRole("button", { name: "Install" }).click();
await anna.getByRole("button", { name: "Install Notes" }).click();
let added;
for (let i = 0; i < 600; i += 1) {
  added = await anna.request.post(`${api}/items`, { ...send, data: { title: "Payments" } });
  if (added.status() === 200) break;
  await new Promise((r) => setTimeout(r, 1000));
}
await anna.request.post(`${api}/items`, { ...send, data: { title: "Ledger" } });
const { item_id: ITEM } = await added.json();
await anna.request.post(`${api}/notes`, { ...send, data: { item_id: ITEM, body: "Retry three times." } });
await anna.goto(`${BASE}/w/${CODE}`);
await anna.locator(".mx-node", { hasText: "Notes" }).first().waitFor();
await shot(anna, "1-root");
await anna.locator(".mx-node", { hasText: "Notes" }).first().click();
await anna.locator(".mx-level-head").waitFor();
await shot(anna, "2-entered-notes");
await anna.locator(".mx-node", { hasText: "Payments" }).click();
await anna.locator(`a.mx-node[href$="/items/${ITEM}"]`).click();
await anna.waitForURL(`**/items/${ITEM}`);
await frameOf(anna);
await new Promise((r) => setTimeout(r, 1500));
await shot(anna, "3-draft-in-notes");
await anna.getByRole("button", { name: "Back" }).click();
await new Promise((r) => setTimeout(r, 500));
await shot(anna, "4-back-to-root");
await anna.locator(".mx-tree-foot .mx-node", { hasText: "Settings" }).click();
await new Promise((r) => setTimeout(r, 800));
await shot(anna, "5-settings-entered");
const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
await phone.addCookies(await anna.context().cookies());
await phone.addInitScript(() => window.localStorage.setItem("maxitor_cookie_consent", "1"));
const p = await phone.newPage();
await p.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}`);
await frameOf(p);
await p.locator(".mx-burger").click();
await new Promise((r) => setTimeout(r, 800));
await shot(p, "6-phone-drawer");
await browser.close();
