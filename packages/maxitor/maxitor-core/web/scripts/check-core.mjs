// packages/maxitor/maxitor-core/web/scripts/check-core.mjs
// The scenarios of specs/072-maxitor-core/quickstart.md and specs/073-plugin-marketplace/quickstart.md in Chromium
// against the local stand (./scripts/core-stand.sh up): signing up with the code from the outbox, the consent step,
// registering an organization, Settings → Plugins — the marketplace, the search, installing the plugin template and
// seeing its sections in the tree, its items added, renamed and listed through the gateway (specs/076-template-own-items
// /quickstart.md), a second organization on the deployed version, disabling and enabling, a private
// plugin's dialog — signing out and in, a wrong password, resetting the password, someone else's organization, an
// organization's address without a session, and the same pages on a phone.
//
//   node packages/maxitor/maxitor-core/web/scripts/check-core.mjs
//
// MAXITOR_STAND_URL (default http://localhost:3000) and MAXITOR_STAND_OUTBOX (default .core-stand/outbox) point
// it elsewhere. Each scenario prints OK or FAIL; the exit code is the number of failures.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const BASE = process.env.MAXITOR_STAND_URL ?? "http://localhost:3000";
const OUTBOX = process.env.MAXITOR_STAND_OUTBOX ?? join(ROOT, ".core-stand/outbox");
const RUN = Date.now().toString(36);
const EMAIL = `check-${RUN}@example.com`;
const PASSWORD = `Check-Horse-${RUN}`;
const NEW_PASSWORD = `Reset-Horse-${RUN}`;
const ORG = `Check ${RUN}`;
const CODE = `check-${RUN}`;
// The template's version, as the marketplace shows it: the passport's own.
const TEMPLATE_VERSION = readFileSync(join(ROOT, "packages/maxitor-plugin-template/src/maxitor_notes/maxitor-plugin.yaml"), "utf8").match(/^version: (\S+)$/m)[1];

let failures = 0;
async function scenario(name, run) {
  try {
    await run();
    console.log(`OK   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}\n     ${String(error?.message ?? error).split("\n")[0]}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

/** The code of the newest letter to an address, waiting for it to arrive. */
async function codeFor(email, after) {
  for (let i = 0; i < 50; i += 1) {
    const letters = readdirSync(OUTBOX)
      .map((name) => join(OUTBOX, name))
      .filter((path) => statSync(path).mtimeMs >= after)
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    for (const path of letters) {
      const text = readFileSync(path, "utf8");
      if (text.includes(`To: ${email}`)) {
        const found = text.match(/^Subject: (\d{3}) (\d{3})/m);
        if (found) return found[1] + found[2];
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no letter to ${email} in ${OUTBOX}`);
}

async function letterTo(email, after, word) {
  for (let i = 0; i < 50; i += 1) {
    const found = readdirSync(OUTBOX).some((name) => {
      const path = join(OUTBOX, name);
      if (statSync(path).mtimeMs < after) return false;
      const text = readFileSync(path, "utf8");
      return text.includes(`To: ${email}`) && text.toLowerCase().includes(word);
    });
    if (found) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no "${word}" letter to ${email}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 840 } });
await context.addInitScript(() => window.localStorage.setItem("maxitor_cookie_consent", "1"));
const page = await context.newPage();

async function signIn(email, password) {
  await page.getByLabel("Email").fill(email);
  await page.locator("#pw-current-password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

await scenario("the cookie banner holds the sign-in card until it is answered", async () => {
  const fresh = await browser.newPage();
  await fresh.goto(BASE);
  await fresh.getByRole("button", { name: "Accept" }).waitFor();
  expect((await fresh.evaluate(() => document.body.dataset.cookies)) === "pending", "the card is not held");
  await fresh.getByRole("button", { name: "Accept" }).click();
  expect((await fresh.evaluate(() => document.body.dataset.cookies)) === "answered", "the answer is not kept");
  await fresh.close();
});

await scenario("from an unknown address only email, Yandex ID and Mail.ru ID are offered", async () => {
  await page.goto(BASE);
  const offered = await page.locator(".icons a").evaluateAll((links) => links.map((a) => a.getAttribute("data-name")));
  expect(JSON.stringify(offered) === JSON.stringify(["Yandex ID", "Mail.ru ID"]), `offered ${offered}`);
});

await scenario("Google from an unknown address leads to the refusal, not to Google", async () => {
  await page.goto(`${BASE}/api/v1/sign-in/google/start`);
  await page.waitForURL("**/sign-in/refused?provider=google");
  await page.getByText("Google does not work from Russia.").waitFor();
});

await scenario("sign up by email, confirm with the letter's code, consent, register an organization", async () => {
  await page.goto(`${BASE}/sign-up`);
  const sent = Date.now() - 1000;
  await page.getByLabel("Email").fill(EMAIL);
  await page.locator("#pw-new-password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Confirm your email").waitFor();
  await page.getByLabel("Six-digit code").fill("000000");
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByText("The code is wrong.").waitFor();
  expect(await page.getByRole("button", { name: "Try again" }).isVisible(), "a wrong code does not offer to try again");
  // A new code clears the refusal, and the button confirms again.
  await page.getByLabel("Six-digit code").fill(await codeFor(EMAIL, sent));
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.waitForURL("**/sign-in/new-account");
  const create = page.getByRole("button", { name: "Create account" });
  expect(await create.isDisabled(), "the account can be created without consent");
  await page.getByLabel("Your name").fill("Check Person");
  await page.locator(".check").click();
  await create.click();
  await page.waitForURL("**/new");
  await page.getByLabel("Organization’s name").fill(ORG);
  await page.getByText("free").waitFor();
  expect((await page.getByLabel("Address").inputValue()) === CODE, "the code is not suggested from the name");
  await page.getByRole("button", { name: "Register and enter" }).click();
  await page.waitForURL(`**/w/${CODE}`);
  await page.getByText(`${ORG} is ready`).waitFor();
  expect((await page.locator(".avatar").innerText()) === "CP", "the icon shows no initials");
});

await scenario("a taken address and one with characters not allowed are named", async () => {
  await page.goto(`${BASE}/new`);
  await page.getByLabel("Organization’s name").fill(ORG);
  await page.getByText("taken").waitFor();
  await page.getByText("Another organization has this address.").waitFor();
  await page.getByLabel("Address").fill("Bad_Code");
  await page.getByText("not allowed").first().waitFor();
  await page.getByText("“B”, “_” and “C” are not allowed").waitFor();
});

const SECOND = `check-b-${RUN}`;

/** Wait until the Installed tab shows a plugin in a state, the page reading the installer's work by itself. */
async function waitForState(title, state) {
  for (let i = 0; i < 90; i += 1) {
    const row = page.locator(".prow", { hasText: title });
    if ((await row.count()) && (await row.locator(`.stt.${state}`).count())) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${title} never became ${state}`);
}

await scenario("Settings at the foot of the tree leads to Plugins; the marketplace offers the template", async () => {
  await page.goto(`${BASE}/w/${CODE}`);
  await page.locator(".sb-foot a", { hasText: "Settings" }).click();
  await page.waitForURL(`**/w/${CODE}/settings/plugins`);
  expect((await page.locator(".crumb").innerText()).includes("Settings"), "the header does not say Settings");
  await page.getByRole("tab", { name: /Marketplace/ }).click();
  await page.locator(".mcard", { hasText: "Notes" }).waitFor();
  await page.getByLabel("Search plugins").fill("nothing-like-it");
  await page.getByText("No plugin matches “nothing-like-it”").waitFor();
  await page.getByRole("button", { name: "Clear the search" }).first().click();
  await page.locator(".mcard", { hasText: "Notes" }).waitFor();
});

await scenario("installing the template builds its version and its sections join the tree", async () => {
  await page.goto(`${BASE}/w/${CODE}/settings/plugins`);
  await page.getByRole("tab", { name: /Marketplace/ }).click();
  await page.locator(".mcard", { hasText: "Notes" }).getByRole("button", { name: "Install" }).click();
  await page.getByText(`Install Notes ${TEMPLATE_VERSION}`).waitFor();
  // The stand's first run deploys the version; a later run finds it deployed by an earlier one.
  await page.locator(".dlg", { hasText: /is deployed for the first time|is already deployed in Maxitor/ }).waitFor();
  await page.getByRole("button", { name: "Install Notes" }).click();
  await page.getByRole("tab", { name: /Installed/ }).waitFor();
  await waitForState("Notes", "enabled");
  await page.goto(`${BASE}/w/${CODE}`);
  await page.locator(".tree .tg", { hasText: "Notes" }).waitFor();
});

await scenario("the template's items are added, renamed and listed through the gateway, and a note needs one", async () => {
  const api = `${BASE}/p/notes/api/${CODE}`;
  const send = { headers: { Origin: BASE } };
  // The runner may still be building the backend's image just after the plugin turned enabled: on a fresh stand the
  // first build installs every dependency and takes minutes.
  let added;
  for (let i = 0; i < 300; i += 1) {
    added = await page.request.post(`${api}/items`, { ...send, data: { title: "  Payment service " } });
    if (added.status() !== 502 && added.status() !== 503) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  expect(added.status() === 200, `adding an item answers ${added.status()}`);
  const { item_id: itemId, changed_at: addedAt } = await added.json();
  const listed = await (await page.request.get(`${api}/lists/list_items`)).json();
  expect(listed.entries.some((e) => e.key === itemId && e.title === "Payment service" && e.icon === "folder"), `the list holds ${JSON.stringify(listed)}`);
  const taken = await page.request.post(`${api}/items`, { ...send, data: { title: "Payment service" } });
  expect(taken.status() === 409 && (await taken.json()).error === "title_taken", `a taken title answers ${taken.status()}`);
  const renamed = await page.request.patch(`${api}/items`, { ...send, data: { item_id: itemId, title: "Payments", base_moment: addedAt } });
  expect(renamed.status() === 200, `renaming answers ${renamed.status()}`);
  const now = await (await page.request.get(`${api}/lists/list_items`)).json();
  const then = await (await page.request.get(`${api}/lists/list_items?at=${encodeURIComponent(addedAt)}`)).json();
  expect(now.entries.find((e) => e.key === itemId)?.title === "Payments", "the list now does not read the new title");
  expect(then.entries.find((e) => e.key === itemId)?.title === "Payment service", "the list at the moment of adding does not read the old title");
  const nowhere = await page.request.post(`${api}/notes`, { ...send, data: { item_id: "00000000-0000-4000-8000-000000000001", body: "x" } });
  expect(nowhere.status() === 404, `a note on no item answers ${nowhere.status()}`);
  const written = await page.request.post(`${api}/notes`, { ...send, data: { item_id: itemId, body: "Retry three times" } });
  expect(written.status() === 200, `a note on the item answers ${written.status()}`);
});

await scenario("a second organization installs the deployed version without building it", async () => {
  await page.goto(`${BASE}/new`);
  await page.getByLabel("Organization’s name").fill(`Check B ${RUN}`);
  await page.getByText("free").waitFor();
  await page.getByRole("button", { name: "Register and enter" }).click();
  await page.waitForURL(`**/w/${SECOND}`);
  await page.goto(`${BASE}/w/${SECOND}/settings/plugins`);
  await page.getByRole("tab", { name: /Marketplace/ }).click();
  await page.locator(".mcard", { hasText: "Notes" }).getByRole("button", { name: "Install" }).click();
  await page.getByText("is already deployed in Maxitor").waitFor();
  await page.getByRole("button", { name: "Install Notes" }).click();
  await waitForState("Notes", "enabled");
});

await scenario("disabling keeps the plugin, enabling brings its sections back", async () => {
  await page.goto(`${BASE}/w/${SECOND}/settings/plugins`);
  await page.locator(".prow", { hasText: "Notes" }).getByRole("button", { name: "Disable" }).click();
  await page.getByRole("button", { name: "Disable", exact: true }).last().click();
  await waitForState("Notes", "disabled");
  await page.goto(`${BASE}/w/${SECOND}`);
  expect((await page.locator(".tree .tg", { hasText: "Notes" }).count()) === 0, "a disabled plugin stays in the tree");
  await page.goto(`${BASE}/w/${SECOND}/settings/plugins`);
  await page.locator(".prow", { hasText: "Notes" }).getByRole("button", { name: "Enable" }).click();
  await waitForState("Notes", "enabled");
  await page.goto(`${BASE}/w/${CODE}/settings/plugins`);
  await page.locator(".prow", { hasText: "Notes" }).locator(".stt.enabled").waitFor(); // the first organization untouched
});

await scenario("the private plugin dialog refuses a PyPI address before sending it", async () => {
  await page.goto(`${BASE}/w/${CODE}/settings/plugins`);
  await page.getByRole("button", { name: "Add a private plugin" }).click();
  await page.getByLabel("Package URL").fill("pkg:pypi/sv-reports@0.3.0");
  await page.getByText("A package on PyPI is the public marketplace's.").waitFor();
  expect(await page.getByRole("button", { name: "Add and check" }).isDisabled(), "a PyPI address can be sent");
  await page.getByRole("button", { name: "Upload a wheel" }).click();
  await page.getByText("Choose a .whl file").waitFor();
});

await scenario("the settings of an organization one is not in answer No such page", async () => {
  await page.goto(`${BASE}/w/orbita-${RUN}/settings/plugins`);
  await page.getByText("No such page").waitFor();
});

await scenario("someone else's organization and a made-up one answer alike", async () => {
  await page.goto(`${BASE}/w/orbita-${RUN}`);
  await page.getByText("No such organization").waitFor();
  expect((await page.locator(".crumb").count()) === 0, "the header names an organization");
});

await scenario("sign out, then a wrong password is one message and the right one signs in", async () => {
  await page.goto(`${BASE}/w/${CODE}`);
  await page.locator(".avatar").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(`${BASE}/`);
  await signIn(EMAIL, "Wrong-Password-1");
  await page.getByText("Wrong email or password.").waitFor();
  await signIn("nobody-" + EMAIL, "Wrong-Password-1");
  await page.getByText("Wrong email or password.").waitFor();
  await signIn(EMAIL, PASSWORD);
  // The account has two organizations by now, so it lands on choosing one.
  await page.waitForURL(`${BASE}/w`);
  await page.getByText("Choose an organization").waitFor();
});

await scenario("an organization's address without a session signs in and lands there", async () => {
  const other = await browser.newContext();
  await other.addInitScript(() => window.localStorage.setItem("maxitor_cookie_consent", "1"));
  const p = await other.newPage();
  await p.goto(`${BASE}/w/${CODE}`);
  await p.getByText(`Sign in to open /w/${CODE}`).waitFor();
  await p.getByLabel("Email").fill(EMAIL);
  await p.locator("#pw-current-password").fill(PASSWORD);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL(`**/w/${CODE}`);
  await other.close();
});

await scenario("reset the password: the old one is refused, the new one works, a letter says so", async () => {
  const other = await browser.newContext();
  await other.addInitScript(() => window.localStorage.setItem("maxitor_cookie_consent", "1"));
  const p = await other.newPage();
  await p.goto(`${BASE}/reset-password`);
  await new Promise((r) => setTimeout(r, 61_000)); // one letter a minute to one address
  const sent = Date.now() - 1000;
  await p.getByLabel("Email").fill(EMAIL);
  await p.getByRole("button", { name: "Send me a code" }).click();
  await p.getByText("Set a new password").waitFor();
  await p.getByLabel("Six-digit code").fill(await codeFor(EMAIL, sent));
  await p.locator("#pw-new-password").fill(NEW_PASSWORD);
  await p.getByRole("button", { name: "Set new password" }).click();
  await p.getByText("Your password is changed.").waitFor();
  await letterTo(EMAIL, sent, "changed");
  await p.goto(BASE);
  await p.getByLabel("Email").fill(EMAIL);
  await p.locator("#pw-current-password").fill(PASSWORD);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.getByText("Wrong email or password.").waitFor();
  await p.locator("#pw-current-password").fill(NEW_PASSWORD);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL(`${BASE}/w`);
  await other.close();
});

await scenario("on a phone every page is one column without sideways scrolling", async () => {
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  for (const path of ["/", "/sign-up", "/reset-password", "/privacy", "/data-deletion"]) {
    await p.goto(`${BASE}${path}`);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth);
    expect(wide <= 375, `${path} is ${wide} px wide`);
  }
  await phone.close();
});

await scenario("on a phone Settings → Plugins is one column: tabs, cards, a sheet and the drawer", async () => {
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await phone.addInitScript(() => window.localStorage.setItem("maxitor_cookie_consent", "1"));
  await phone.addCookies(await context.cookies());
  const p = await phone.newPage();
  await p.goto(`${BASE}/w/${CODE}/settings/plugins`);
  await p.locator(".prow", { hasText: "Notes" }).waitFor();
  const wide = () => p.evaluate(() => document.documentElement.scrollWidth);
  expect((await wide()) <= 375, `the installed tab is ${await wide()} px wide`);
  await p.getByRole("tab", { name: /Marketplace/ }).click();
  expect((await wide()) <= 375, `the marketplace is ${await wide()} px wide`);
  await p.getByRole("button", { name: "Add a private plugin" }).click();
  const sheet = await p.locator(".dlg.sheet").boundingBox();
  expect(sheet && Math.round(sheet.y + sheet.height) >= 811 && sheet.width >= 370, "the dialog is not a sheet from the bottom");
  await p.getByRole("button", { name: "Cancel" }).click();
  await p.getByRole("button", { name: "The organization's tree" }).click();
  await p.locator(".sb.drawer a", { hasText: "Plugins" }).waitFor();
  await phone.close();
});

await browser.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures);
