// packages/maxitor/maxitor-core/web/scripts/check-core.mjs
// The scenarios of specs/072-maxitor-core/quickstart.md and specs/073-plugin-marketplace/quickstart.md in Chromium
// against the local stand (./scripts/core-stand.sh up): signing up with the code from the outbox, the consent step,
// registering an organization, Settings → Plugins — the marketplace, the search, installing the plugin template and
// seeing its nodes in the tree, its items added, renamed and listed through the gateway (specs/076-template-own-items
// /quickstart.md), its notes page in the right panel with its controls in the shell of @maxitor/panel, Back and Forward,
// the panel's test page with the protocol, the canvas, the test drawing in the shell, a page without the shell and the
// tree's head — the arrow as Back (spec 085) — and a node that is entered with its head, its crumbs and a reload
// inside it (specs/077-core-frame/quickstart.md, specs/078-page-shell/quickstart.md, specs/085-entered-tree-node
// /spec.md), a second
// organization on the deployed version, disabling and enabling, a private plugin's dialog — an administrator's
// invitation and its letter with no link, the invited person signing up with the invited email and accepting, the new
// user inviting from the menu, who may invite switched and an invitation withdrawn by it, a user blocked and refused
// on the next request, the last administrator kept, the last place after signing in again (spec 086) — signing out
// and in, a wrong password, resetting the password, someone else's organization, an organization's address without a
// session, and the same pages and the frame on a phone.
//
//   node packages/maxitor/maxitor-core/web/scripts/check-core.mjs
//
// MAXITOR_STAND_URL (default http://localhost:3000) and MAXITOR_STAND_OUTBOX (default .core-stand/outbox) point
// it elsewhere. Each scenario prints OK or FAIL; the exit code is the number of failures.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "playwright";
import { expectStatusDisks } from "./check-status-disks.mjs";
import { assertIcons } from "./audit-icons.mjs";
import { checkScaleSelection, checkIntervalMove } from "./check-scale-selection.mjs";
import { checkScaleGestureSequence } from "./check-scale-gestures.mjs";
import { checkScaleLivePublication } from "./check-scale-live.mjs";
import { checkRootTreeAlignment, checkEnteredTreePosition } from "./check-root-tree.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const BASE = process.env.MAXITOR_STAND_URL ?? "http://localhost:3000";
const OUTBOX = process.env.MAXITOR_STAND_OUTBOX ?? join(ROOT, ".core-stand/outbox");
const RUN = Date.now().toString(36);
const EMAIL = `check-${RUN}@example.com`;
const PASSWORD = `Check-Horse-${RUN}`;
const NEW_PASSWORD = `Reset-Horse-${RUN}`;
const ORG = `Check ${RUN}`;
// The template's item the notes scenarios open, set when it is added.
let ITEM = "";
const CODE = `check-${RUN}`;
// The template's version, as the marketplace shows it: the passport's own.
const TEMPLATE_VERSION = readFileSync(join(ROOT, "packages/maxitor-plugin-template/src/maxitor_notes/maxitor-plugin.yaml"), "utf8").match(/^version: (\S+)$/m)[1];

let failures = 0;
async function scenario(name, run) {
  try {
    await run();
    await assertIcons(page);
    console.log(`OK   ${name}`);
  } catch (error) {
    failures += 1;
    // The first lines of Playwright's call log name the locator that did not hold.
    const lines = String(error?.message ?? error).split("\n").filter((line) => line.trim()).slice(0, 5);
    console.log(`FAIL ${name}\n     ${lines.join("\n     ")}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

/** The crumbs after the organization, as one line: each crumb stands after its separator (spec 079, FR-040). */
async function crumbsOf(at) {
  return (await at.locator(".mx-path").innerText()).replace(/\s+/g, " ").replace(/^›\s*/, "").trim();
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

/** The newest letter to an address whose subject has a word, as plain text: the .eml's text part decoded. */
async function letterText(email, after, word) {
  for (let i = 0; i < 50; i += 1) {
    const letters = readdirSync(OUTBOX)
      .map((name) => join(OUTBOX, name))
      .filter((path) => statSync(path).mtimeMs >= after)
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    for (const path of letters) {
      const raw = readFileSync(path, "utf8");
      if (!raw.includes(`To: ${email}`) || !raw.toLowerCase().includes(word)) continue;
      // Use the MIME parser for the multipart outbox letter, including its folded lines and transfer encoding.
      return execFileSync("python3", ["-c", [
        "import sys",
        "from email import policy",
        "from email.parser import Parser",
        "letter = Parser(policy=policy.default).parsestr(sys.stdin.read())",
        "sys.stdout.write(letter.get_body(preferencelist=('plain',)).get_content())",
      ].join("\n")], { input: raw, encoding: "utf8" });
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no "${word}" letter to ${email}`);
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
  await page.getByText("Choose a section in the tree").waitFor();
  expect((await page.locator(".mx-avatar").innerText()) === "CP", "the icon shows no initials");
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

await scenario("Settings at the foot of the tree is entered and holds Organization, Users and Plugins; the marketplace offers the template", async () => {
  await page.goto(`${BASE}/w/${CODE}`);
  await page.locator(".mx-tree-foot .mx-node", { hasText: "Settings" }).click();
  // Settings is entered (spec 085): the panel holds its children only, and Settings stands at its head.
  await page.locator(".mx-level-head", { hasText: "Settings" }).waitFor();
  const level = await page.locator(".mx-tree-scroll .mx-node").allInnerTexts();
  expect(JSON.stringify(level.map((t) => t.trim())) === JSON.stringify(["Organization", "Users", "Plugins"]), `the level of Settings holds ${level}`);
  await page.locator(".mx-tree-scroll .mx-node", { hasText: "Plugins" }).click();
  await page.waitForURL(`**/w/${CODE}/core/settings/plugins`);
  expect((await page.locator(".mx-path").innerText()).includes("Settings"), "the top row's path does not say Settings");
  await page.getByRole("tab", { name: /Marketplace/ }).click();
  await page.locator(".mcard", { hasText: "Notes" }).waitFor();
  await page.getByLabel("Search plugins").fill("nothing-like-it");
  await page.getByText("No plugin matches “nothing-like-it”").waitFor();
  await page.getByRole("button", { name: "Clear the search" }).first().click();
  await page.locator(".mcard", { hasText: "Notes" }).waitFor();
});

await scenario("installing the template builds its version and its nodes join the tree", async () => {
  await page.goto(`${BASE}/w/${CODE}/core/settings/plugins`);
  await page.getByRole("tab", { name: /Marketplace/ }).click();
  await page.locator(".mcard", { hasText: "Notes" }).getByRole("button", { name: "Install" }).click();
  await page.getByText(`Install Notes ${TEMPLATE_VERSION}`).waitFor();
  // The stand's first run deploys the version; a later run finds it deployed by an earlier one.
  await page.locator(".dlg", { hasText: /is deployed for the first time|is already deployed in Maxitor/ }).waitFor();
  await page.getByRole("button", { name: "Install Notes" }).click();
  await page.getByRole("tab", { name: /Installed/ }).waitFor();
  await waitForState("Notes", "enabled");
  await page.goto(`${BASE}/w/${CODE}`);
  await page.locator(".mx-node", { hasText: "Notes" }).first().waitFor();
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
  ITEM = itemId;
});

await scenario("the Draft page opens in the right panel from the tree, with its controls in the shell, Back and Forward", async () => {
  // The runner may still be starting the frontend's container just after the backend answered.
  for (let i = 0; i < 300; i += 1) {
    const answer = await page.request.get(`${BASE}/p/notes/${CODE}`, { headers: { "Sec-Fetch-Dest": "iframe" } });
    if (answer.status() === 200) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  await page.goto(`${BASE}/w/${CODE}`);
  await page.locator(".mx-node", { hasText: "Notes" }).first().click();
  await page.locator(".mx-node", { hasText: "Payments" }).click();
  // The item's own Draft: its address ends with the item, where Published notes goes on.
  await page.locator(`a.mx-node[href$="/items/${ITEM}"]`).click();
  await page.waitForURL(`**/w/${CODE}/notes/items/${ITEM}`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  const frame = page.frameLocator("iframe.mx-panel-frame");
  // The crumbs name the sections entered only: the item was passed by expanding, and a page inside a section adds
  // nothing (spec 079, FR-040).
  expect((await crumbsOf(page)) === "Notes", "the crumbs name more than the sections entered");
  // The note written through the gateway waits in the draft, marked new and seen by its writer alone.
  await frame.locator(".nt-card", { hasText: "Retry three times" }).waitFor();
  await frame.locator(".nt-kind", { hasText: "New" }).first().waitFor();
  await frame.locator(".nt-foot", { hasText: "Written by you; not published yet" }).first().waitFor();
  // The core draws nothing over the panel: the filters and the actions are the page's, in its shell; the time
  // scale's pill stands in the top row, not over the panel.
  expect((await page.locator(".mx-panel .mx-pill, .mx-panel .mx-filters, .mx-panel .mx-views, .mx-panel .mx-legend, .mx-panel .mx-bar").count()) === 0, "the core draws controls over the panel");
  await frame.locator(".mx-filters .mx-filter-row").first().waitFor();
  await expectStatusDisks(frame, "state", ["+", "~", "−"]);
  // The filters are the mockup's 148 px and stand clear of the page's content.
  const filters = await frame.locator(".mx-filters").boundingBox();
  const card = await frame.locator(".nt-card").first().boundingBox();
  expect(Math.round(filters.width) === 148, `the filters are ${filters.width} px wide, not 148`);
  expect(card.x >= filters.x + filters.width + 8, `the cards touch the filters: ${card.x} against ${filters.x + filters.width}`);
  // The State filter hides a state and the page says so; Back reads again with every state.
  await frame.getByRole("checkbox", { name: "New" }).click();
  await page.waitForURL(/state=/);
  await frame.locator(".mx-empty-state", { hasText: "The State filter hides every change" }).waitFor();
  await page.goBack();
  await frame.locator(".nt-card", { hasText: "Retry three times" }).waitFor();
  await page.goForward();
  await frame.locator(".mx-empty-state", { hasText: "The State filter hides every change" }).waitFor();
  await page.goBack();
  await frame.locator(".nt-card", { hasText: "Retry three times" }).waitFor();
  // The draft is on the scale as Published is (spec 079, FR-047, FR-048): its own changes and the publications, and
  // both comparisons.
  await page.locator(".mx-pill-main").click();
  await page.locator(".mx-modes [role=radio]", { hasText: "Diff" }).waitFor();
  expect((await page.locator(".mx-modes [role=radio]", { hasText: "Side by side" }).count()) === 1, "the draft offers no Side by side");
  await page.keyboard.press("Escape");
});

await scenario("the draft is mine alone: a new note, a change and a revert, and Published does not show it until publication", async () => {
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  const frame = page.frameLocator("iframe.mx-panel-frame");
  await frame.getByRole("button", { name: "New note" }).click();
  await frame.getByLabel("The note's text").fill("Alert on the third failure");
  await frame.getByRole("button", { name: "Write" }).click();
  await frame.locator(".nt-card", { hasText: "Alert on the third failure" }).waitFor();
  // Published shows nothing of it: nobody else sees the draft.
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}/published`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  const published = page.frameLocator("iframe.mx-panel-frame");
  await published.locator(".nt-revision", { hasText: "Nothing is published yet" }).waitFor();
  expect((await published.locator(".nt-card", { hasText: "Alert on the third failure" }).count()) === 0, "Published shows a change that was never published");
  // The card edits again in the draft; the words that changed are marked inside the one text.
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  const draft = page.frameLocator("iframe.mx-panel-frame");
  await draft.locator(".nt-card", { hasText: "Alert on the third failure" }).getByRole("button", { name: "Edit" }).click();
  const opened = draft.locator(".nt-card:has(.nt-edit)");
  await opened.getByLabel("The note's text").fill("Alert on the second failure");
  await opened.getByRole("button", { name: "Save" }).click();
  await draft.locator(".nt-card", { hasText: "Alert on the second failure" }).waitFor();
  // A revert of the new note removes it and leaves nothing on Published.
  const changed = draft.locator(".nt-card", { hasText: "Alert on the second failure" });
  await changed.getByRole("button", { name: "Revert" }).click();
  await draft.locator(".mx-dialog").getByRole("button", { name: "Remove" }).click();
  await draft.locator(".nt-card", { hasText: "Alert on the second failure" }).waitFor({ state: "detached" });
  // The change written through the gateway stays, and a revert of its dialog keeps it when the person says Keep.
  const kept = draft.locator(".nt-card", { hasText: "Retry three times" });
  await kept.getByRole("button", { name: "Revert" }).click();
  await draft.locator(".mx-dialog").getByRole("button", { name: "Keep" }).click();
  await kept.waitFor();
});

await scenario("the whole draft is published as one revision; Published marks my changes and Edit opens them in the draft", async () => {
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  let frame = page.frameLocator("iframe.mx-panel-frame");
  await frame.locator(".nt-card", { hasText: "Retry three times" }).waitFor();
  await frame.getByRole("button", { name: "Publish" }).click();
  await frame.getByLabel("Title").fill("First release");
  await frame.getByLabel("Comment").fill("The notes the team agreed on");
  await frame.getByLabel("Release, if any").fill("2026.11");
  await frame.locator(".mx-dialog").getByRole("button", { name: "Publish" }).click();
  // A publication opens Published, which shows it (spec 079, 1.4); the draft is empty after it.
  await page.waitForURL(/\/published/, { waitUntil: "commit" });
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  frame = page.frameLocator("iframe.mx-panel-frame");
  await frame.locator(".mx-empty-state", { hasText: "Your draft is empty" }).waitFor();
  // Publishing again with nothing in the draft is said in words.
  await frame.getByRole("button", { name: "Publish" }).click();
  await frame.getByLabel("Title").fill("Again");
  await frame.getByLabel("Comment").fill("Nothing new");
  await frame.locator(".mx-dialog").getByRole("button", { name: "Publish" }).click();
  await frame.locator(".nt-said", { hasText: "there is nothing to publish" }).waitFor();
  await frame.locator(".mx-dialog").getByRole("button", { name: "Cancel" }).first().click();
  // Everyone's notes of the revision in force, read only, with the Authors filter and the table.
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}/published`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  const published = page.frameLocator("iframe.mx-panel-frame");
  // The revision's head: its ref, its title, and who published it with the release (spec 079, 1.4).
  await published.locator(".nt-revision", { hasText: /v1\s*First release.*2026\.11/ }).waitFor();
  await published.locator(".nt-card", { hasText: "Retry three times" }).waitFor();
  // Published's bottom bar holds the zoom alone, as its mockup draws it (spec 079, 1.4); the table is the address's.
  expect((await published.getByRole("radio", { name: "Table" }).count()) === 0, "Published's bar offers more than the zoom");
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}/published?view=table`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  await page.frameLocator("iframe.mx-panel-frame").locator(".mx-list-row", { hasText: "Retry three times" }).waitFor();
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}/published`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  // Edit acts in my draft: nothing is published until the editor is saved, and a cancel writes nothing.
  const note = published.locator(".nt-card", { hasText: "Retry three times" });
  await note.getByRole("button", { name: "Edit" }).click();
  await page.waitForURL(/edit=/);
  const draft = page.frameLocator("iframe.mx-panel-frame");
  await draft.locator(".nt-card:has(.nt-edit)").getByRole("button", { name: "Cancel" }).click();
  await page.waitForURL((url) => !url.search.includes("edit="));
  await draft.locator(".mx-empty-state", { hasText: "Your draft is empty" }).waitFor();
  // Delete puts a deletion in my draft, marked on Published; a revert leaves the published note as it was.
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}/published`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  const again = page.frameLocator("iframe.mx-panel-frame");
  await again.locator(".nt-card", { hasText: "Retry three times" }).getByRole("button", { name: "Delete" }).first().click();
  await again.locator(".nt-mark", { hasText: "In your draft: deleted" }).waitFor();
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  const revert = page.frameLocator("iframe.mx-panel-frame");
  await revert.locator(".nt-kind", { hasText: "Deleted" }).waitFor();
  await revert.locator(".nt-card", { hasText: "Retry three times" }).getByRole("button", { name: "Revert" }).click();
  await revert.locator(".mx-dialog").getByRole("button", { name: "Give up" }).click();
  await revert.locator(".mx-empty-state", { hasText: "Your draft is empty" }).waitFor();
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}/published`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  await page.frameLocator("iframe.mx-panel-frame").locator(".nt-card", { hasText: "Retry three times" }).waitFor();
});

await scenario("Published's Changes filter keeps all four production signs, including absent statuses", async () => {
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}/published?mode=diff&from=2000-01-01T00:00:00Z`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  const frame = page.frameLocator("iframe.mx-panel-frame");
  await expectStatusDisks(frame, "change", ["+", "~", "−", "="]);
});

await scenario("Published on the scale: its publications as purple points, Roll back exactly on a past one, and the rollback a red point after them", async () => {
  // A second publication, so there is a past one to go back to.
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  const draft = page.frameLocator("iframe.mx-panel-frame");
  await draft.getByRole("button", { name: "New note" }).click();
  await draft.getByLabel("The note's text").fill("Payouts run twice a day");
  await draft.locator(".mx-dialog").getByRole("button", { name: "Write" }).click();
  await draft.locator(".nt-card", { hasText: "Payouts run twice a day" }).waitFor();
  await draft.getByRole("button", { name: "Publish" }).click();
  await draft.getByLabel("Title").fill("Payouts");
  await draft.getByLabel("Comment").fill("Payouts move to twice a day");
  await draft.locator(".mx-dialog").getByRole("button", { name: "Publish" }).click();
  await page.waitForURL(/\/published/, { waitUntil: "commit" });
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  await page.locator(".mx-pill-main").click();
  await page.locator(".mx-card .mx-point-ref", { hasText: "v2" }).waitFor();
  const fills = await page.locator(".mx-card .mx-point-filled").evaluateAll((points) => points.map((point) => point.style.fill));
  expect(fills.length === 2 && fills.every((fill) => fill.includes("--mx-tone-purple")), `the publications are not two purple points: ${fills}`);
  // Exactly on v1: the page offers Roll back to v1. The pill's arrow steps through the publications — first to v2,
  // the one in force, which offers nothing, then to v1.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "The previous change" }).click();
  await page.waitForURL(/at=/, { waitUntil: "commit" });
  const at = page.url();
  await page.getByRole("button", { name: "The previous change" }).click();
  await page.waitForURL((url) => url.href !== at && url.search.includes("at="), { waitUntil: "commit" });
  const past = page.frameLocator("iframe.mx-panel-frame");
  await past.getByRole("button", { name: "Roll back to v1" }).click();
  await past.getByLabel("Comment").fill("Payouts go back to once a day");
  await past.locator(".mx-dialog").getByRole("button", { name: "Roll back to v1" }).click();
  // Back to now: v3 is a red point after v1 and v2, which stay on the scale.
  await page.waitForURL((url) => !url.search.includes("at="));
  await page.locator(".mx-pill-main").click();
  await page.locator(".mx-card .mx-point-ref", { hasText: "v3" }).waitFor();
  const after = await page.locator(".mx-card .mx-point-filled").evaluateAll((points) => points.map((point) => point.style.fill));
  expect(after.length === 3 && after[2].includes("--mx-tone-red"), `the rollback is not a red point after two: ${after}`);
  await page.keyboard.press("Escape");
  const now = page.frameLocator("iframe.mx-panel-frame");
  await now.locator(".nt-card", { hasText: "Retry three times" }).waitFor();
  expect((await now.locator(".nt-card", { hasText: "Payouts run twice a day" }).count()) === 0, "the rollback kept a note v1 did not hold");
});

await scenario("a plugin's page opened by itself goes to its panel address", async () => {
  await page.goto(`${BASE}/p/notes/${CODE}/items/${ITEM}`);
  await page.waitForURL(`**/w/${CODE}/notes/items/${ITEM}`);
});

await scenario("an address with no moment or a moment to come says so and offers now", async () => {
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}/published?view=table&at=garbage`);
  await page.getByText("This address names no moment").waitFor();
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}/published?view=table&at=2099-01-01T00:00:00Z`);
  await page.getByText("This moment has not come yet").waitFor();
  await page.getByRole("link", { name: "Show now" }).click();
  await page.waitForURL((url) => url.search === "?view=table");
});

await scenario("the panel's test page: the protocol, a change of the core's names refused, the canvas's zoom in the shell", async () => {
  await page.goto(`${BASE}/w/${CODE}/core/panel-test`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor();
  const frame = page.frameLocator("iframe.mx-panel-frame");
  const before = await page.evaluate(() => history.length);
  await frame.getByRole("button", { name: "Push a step" }).click();
  await page.waitForURL(/step=1/);
  await frame.getByRole("button", { name: "Type a letter" }).click();
  await page.waitForURL(/search=a/);
  expect((await page.evaluate(() => history.length)) - before === 1, "a push and a replace did not make exactly one entry");
  await frame.getByRole("button", { name: "Open a stranger's page" }).click();
  await page.waitForTimeout(500);
  expect(page.url().includes("/core/panel-test"), "a stranger's page was opened");
  await frame.getByTestId("write-mode").click();
  await frame.getByTestId("refusal").filter({ hasText: '"mode"' }).waitFor();
  expect(!page.url().includes("mode="), "the page changed the core's mode");
  await page.goto(`${BASE}/w/${CODE}/core/panel-test/canvas`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor();
  const shell = page.frameLocator("iframe.mx-panel-frame");
  const canvas = shell.locator(".mx-canvas");
  const zoom = async () => Number(await canvas.getAttribute("data-zoom"));
  const fitted = await zoom();
  await shell.getByRole("button", { name: "Zoom in" }).click();
  expect((await zoom()) > fitted, "zoom in does not zoom");
  for (let i = 0; i < 20; i += 1) await shell.getByRole("button", { name: "Zoom in" }).click();
  expect((await zoom()) === 4, `the zoom passes its limit: ${await zoom()}`);
  await shell.getByRole("button", { name: "Fit" }).click();
  expect((await zoom()) === fitted, "fit does not show the scene again");
});

await scenario("the test drawing: layers with counts, filters, the bottom bar and the actions in their places", async () => {
  await page.goto(`${BASE}/w/${CODE}/core/panel-test/drawing`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor();
  const frame = page.frameLocator("iframe.mx-panel-frame");
  const panel = await page.locator(".mx-panel").boundingBox();
  const place = async (selector) => frame.locator(selector).boundingBox();
  await frame.locator(".mx-pill").waitFor();
  const pill = await place(".mx-pill");
  expect(Math.abs(pill.x + pill.width / 2 - (panel.x + panel.width / 2)) < 2, "the layer pills are not at the top centre");
  const filters = await place(".mx-filters");
  expect(filters.x < panel.x + panel.width / 4 && filters.y < panel.y + panel.height / 4, "the filters are not at the top left");
  const bar = await place(".mx-bar");
  expect(bar.x < panel.x + panel.width / 4 && bar.y > panel.y + panel.height / 2, "the bottom bar is not at the bottom left");
  const actions = await place(".mx-actions");
  expect(actions.x > panel.x + panel.width / 2 && actions.y < panel.y + panel.height / 4, "the actions are not at the top right");
  const labels = await frame.locator(".mx-bar").getByRole("button").evaluateAll((all) => all.map((b) => b.getAttribute("aria-label")));
  expect(labels[0] === "Zoom in" && labels.includes("Close every port"), `the zoom does not come first: ${labels}`);
  expect((await frame.getByRole("radio", { name: "Domains" }).innerText()).includes("2"), "the layer has no count");
  await frame.getByRole("radio", { name: "Events" }).click();
  await page.waitForURL(/layer=events/);
  await frame.getByRole("radio", { name: "Top to bottom" }).click();
  await page.waitForURL(/layout=tb/);
  expect((await frame.locator(".mx-filter-title", { hasText: "Changes" }).count()) === 0, "a comparison's section shows at now");
  await page.goto(`${BASE}/w/${CODE}/core/panel-test/drawing?mode=diff&from=2026-11-01T00:00:00Z`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor();
  await frame.locator(".mx-filter-title", { hasText: "Changes" }).waitFor();
  expect((await frame.locator(".mx-actions").count()) === 0, "the actions show in a comparison");
});

await scenario("a page gives its history; the core keeps what holds and refuses the rest by name", async () => {
  const errors = [];
  const listen = (message) => message.type() === "error" && errors.push(message.text());
  page.on("console", listen);
  await page.goto(`${BASE}/w/${CODE}/core/panel-test/drawing`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor();
  await page.waitForFunction(() => document.querySelector("iframe.mx-panel-frame")?.dataset.history?.includes("list_test_history"));
  const history = JSON.parse(await page.locator("iframe.mx-panel-frame").getAttribute("data-history"));
  page.off("console", listen);
  // The test page's passport offers both comparisons; a wider one is refused as the panel's unit tests check.
  expect(JSON.stringify(history) === JSON.stringify({ milestones: "list_test_history", compare: ["diff", "side_by_side"] }), `the core kept ${JSON.stringify(history)}`);
  expect(errors.some((text) => text.includes('card names "no_such_card"')), "the unknown name was not refused by name");
});

/** A moment some days back, to the minute, as the address writes it. */
const daysAgo = (days) => new Date(Math.floor((Date.now() - days * 86_400_000) / 60_000) * 60_000).toISOString().replace(/\.\d{3}Z$/, ".000000Z");

/** Open a fixture of the scale on the test page and its card. */
async function openScale(fixture, query = "") {
  await page.goto(`${BASE}/w/${CODE}/core/panel-test/history/${fixture}${query}`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").first().waitFor();
  await page.locator(".mx-pill-main").click();
  await page.locator(".mx-card .mx-track").waitFor();
}

await scenario("the scale: the card hangs 11 px under the pill, right edges aligned; a click writes a moment kept to the minute; a later one is refused", async () => {
  await openScale("milestones");
  const pill = await page.locator(".mx-pill").boundingBox();
  const card = await page.locator(".mx-card").boundingBox();
  expect(Math.abs(card.y - (pill.y + pill.height) - 11) <= 1, `the card stands ${card.y - pill.y - pill.height} px under the pill`);
  expect(Math.abs(card.x + card.width - (pill.x + pill.width)) <= 1, "the card's right edge is not under the pill's");
  const track = await page.locator(".mx-card .mx-track").boundingBox();
  await page.mouse.click(track.x + track.width * 0.4, track.y + track.height - 60);
  await page.waitForURL(/at=\d{4}-\d{2}-\d{2}T\d{2}%3A\d{2}%3A00\.000000Z/);
  expect(await page.locator(".mx-pill-past").isVisible(), "the pill does not show the past");
  await page.goto(`${BASE}/w/${CODE}/core/panel-test/history/milestones?at=2099-01-01T00:00:00.000000Z`);
  await page.getByText("This moment has not come yet").waitFor();
});

await scenario("the scale is set up by the page: its kinds on the lane, small points and flags only when promised, the legend from the setup, an undeclared kind named", async () => {
  const errors = [];
  const listen = (message) => message.type() === "error" && errors.push(message.text());
  page.on("console", listen);
  await openScale("graph");
  expect((await page.locator(".mx-card .mx-flag").count()) >= 1, "the graph's release has no flag");
  expect((await page.locator(".mx-card .mx-point-ref.small").count()) >= 1, "the graph's small point is not small");
  await page.getByRole("button", { name: "Reading the scale" }).click();
  // The legend's titles are capitals by their style: the words are compared as text, whatever their case.
  const legend = (await page.locator(".mx-legend").innerText()).toLowerCase();
  for (const word of ["Points", "Merged", "Review required", "Size", "Flag", "Three points", "Now", "The chosen moment"]) expect(legend.includes(word.toLowerCase()), `the graph's legend lacks ${word}`);
  await openScale("milestones");
  await page.getByRole("button", { name: "Reading the scale" }).click();
  const notes = (await page.locator(".mx-legend").innerText()).toLowerCase();
  expect(notes.includes("rolled back") && !notes.includes("size") && !notes.includes("flag") && !notes.includes("bars"), "the notes' legend speaks of what it did not promise");
  expect((await page.locator(".mx-card-small").count()) === 0, "the switch of small points stands without small");
  await openScale("undeclared");
  page.off("console", listen);
  expect(errors.some((text) => text.includes('"shiny"')), "the undeclared kind was not named");
  expect(errors.some((text) => text.includes("did not declare small")), "the small point without small was not named");
});

await scenario("comparison boundaries: an upper click beside B moves A; an axis click beside A moves B", async () => {
  await openScale("both", `?mode=diff&from=${daysAgo(11)}&at=${daysAgo(2)}`);
  await checkScaleSelection({
    track: page.locator(".mx-track"), url: () => page.url(), click: (x, y) => page.mouse.click(x, y),
    observe: () => page.locator("iframe.mx-panel-frame:not(.waiting)").first().waitFor(),
  });
});

await scenario("comparison interval: its shading stops at the axis and its visible grip moves both boundaries", async () => {
  await openScale("both", `?mode=diff&from=${daysAgo(11)}&at=${daysAgo(2)}`);
  await checkIntervalMove({
    track: page.locator(".mx-track"), url: () => page.url(),
    leave: () => page.locator(".mx-card-span").click(),
    drag: async (from, to) => { await page.mouse.move(...from); await page.mouse.down(); await page.mouse.move(...to, { steps: 8 }); await page.mouse.up(); },
    observe: () => page.locator("iframe.mx-panel-frame:not(.waiting)").first().waitFor(),
  });
});

await scenario("scale gesture sequence: swipe, milestone, crossing A/B, overlap, close and reopen", async () => {
  await openScale("both", `?mode=diff&from=${daysAgo(11)}&at=${daysAgo(8)}`);
  await checkScaleGestureSequence({
    track: page.locator(".mx-track"), pill: page.locator(".mx-pill-main"),
    preset: page.getByRole("button", { name: "7 d", exact: true }), url: () => page.url(),
    click: (x, y) => page.mouse.click(x, y),
    drag: async (from, to) => { await page.mouse.move(...from); await page.mouse.down(); await page.mouse.move(...to, { steps: 8 }); await page.mouse.up(); },
    swipe: async (point, direction) => { await page.mouse.move(...point); await page.mouse.wheel(direction === "left" ? -72 : 72, 0); },
    observe: () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))),
  });
});

await scenario("phone scale gesture sequence: touch swipe, milestone, crossing A/B, overlap, close and reopen", async () => {
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  try {
    await phone.addInitScript(() => window.localStorage.setItem("maxitor_cookie_consent", "1"));
    await phone.addCookies(await context.cookies());
    const p = await phone.newPage();
    await p.goto(`${BASE}/w/${CODE}/core/panel-test/history/both?mode=diff&from=${daysAgo(11)}&at=${daysAgo(8)}`);
    await p.locator("iframe.mx-panel-frame:not(.waiting)").waitFor();
    await p.locator(".mx-pill-main").tap();
    const input = await phone.newCDPSession(p);
    const drag = async (from, to) => {
      const point = (x, y) => ({ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 });
      await input.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(...from)] });
      for (let i = 1; i <= 8; i++) {
        await input.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(
          from[0] + (to[0] - from[0]) * i / 8, from[1] + (to[1] - from[1]) * i / 8,
        )] });
      }
      await input.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await checkScaleGestureSequence({
      track: p.locator(".mx-track"), pill: { click: () => p.locator(".mx-pill-main").tap() },
      preset: { click: () => p.getByRole("button", { name: "7 d", exact: true }).tap() },
      url: () => p.url(), click: (x, y) => p.touchscreen.tap(x, y), drag, mobile: true,
      swipe: (point, direction) => drag(point, [point[0] + (direction === "left" ? 24 : -24), point[1]]),
      observe: () => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))),
    });
  } finally {
    await phone.close();
  }
});

await scenario("an open scale receives another tab's publication, bars and Now boundary within five seconds", async () => {
  const created = await page.request.post(`${BASE}/p/notes/api/${CODE}/items`, {
    headers: { Origin: BASE }, data: { title: `Live refresh ${RUN}` },
  });
  expect(created.ok(), `creating the isolated live-refresh item answered ${created.status()}`);
  const { item_id: item } = await created.json();
  const observer = await context.newPage(), editor = await context.newPage();
  try {
    const draftUrl = `${BASE}/w/${CODE}/notes/items/${item}`;
    await observer.goto(`${draftUrl}/published`);
    await observer.frameLocator('iframe.mx-panel-frame').getByText('Nothing is published yet', { exact: true }).waitFor();
    await observer.locator('.mx-pill-main').click();
    await observer.locator('.mx-track').waitFor();
    let navigations = 0;
    observer.on('framenavigated', frame => { if (frame === observer.mainFrame()) navigations++; });
    await editor.goto(draftUrl);
    let frame = editor.frameLocator('iframe.mx-panel-frame');
    await frame.getByRole('button', { name: 'New note', exact: true }).click();
    await frame.getByLabel("The note's text").fill('Live refresh baseline');
    await frame.getByRole('button', { name: 'Write', exact: true }).click();
    await frame.locator('.nt-card', { hasText: 'Live refresh baseline' }).waitFor();
    for (const number of [1, 2]) {
      if (number === 2) {
        await editor.waitForURL(/\/published$/);
        frame = editor.frameLocator('iframe.mx-panel-frame');
        await frame.getByRole('button', { name: 'Edit', exact: true }).click();
        await frame.getByLabel("The note's text").fill('Live refresh edited in another tab');
        await frame.getByRole('button', { name: 'Save', exact: true }).click();
        await frame.locator('.nt-edit').waitFor({ state: 'detached' });
      }
      await frame.getByRole('button', { name: 'Publish', exact: true }).click();
      await frame.getByLabel('Title', { exact: true }).fill(`Live refresh ${number}`);
      await frame.getByLabel('Comment', { exact: true }).fill('The observing scale stays open throughout the edit and publication.');
      await checkScaleLivePublication({
        track: observer.locator('.mx-track'), delta: number === 1 ? { added: 1 } : { changed: 1 },
        publish: () => frame.getByRole('button', { name: `Publish v${number}`, exact: true }).click(),
        navigationStamp: () => navigations,
        observe: () => observer.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))),
      });
    }
    let revision = 2;
    for (const mobile of [false, true]) {
      await observer.setViewportSize(mobile ? { width: 375, height: 812 } : { width: 1360, height: 840 });
      for (const mode of ['diff', 'side_by_side']) {
        const modeLabel = mode === 'diff' ? 'Diff' : mobile ? 'A / B' : 'Side by side';
        await observer.getByRole('radio', { name: modeLabel, exact: true }).click();
        const track = observer.locator('.mx-track');
        const geometry = () => track.evaluate(el => ({
          width: el.clientWidth, top: +el.querySelector('.mx-track-knob.hollow').getAttribute('cy'),
          base: +el.querySelector('.mx-track-knob:not(.hollow)').getAttribute('cy'),
          now: +el.querySelector('.mx-track-now').getAttribute('x1'),
          latest: +[...el.querySelectorAll('.mx-point-ref')].at(-1).parentElement.querySelector('circle').getAttribute('cx'),
          lane: +el.querySelector('.mx-lane').getAttribute('y1'),
        }));
        let g = await geometry();
        // Choose A manually and return B to Now through the lower handle, keeping the scale mounted.
        await track.click({ position: { x: g.width / 2, y: g.top } });
        await track.click({ position: { x: g.now + 2, y: g.base } });
        for (const fixed of [false, true]) {
          if (fixed) {
            g = await geometry();
            await track.click({ position: { x: g.latest, y: g.lane } });
            expect(new URL(observer.url()).searchParams.has('at'), 'Selecting a milestone did not fix B');
          }
          await editor.waitForURL(/\/published$/);
          frame = editor.frameLocator('iframe.mx-panel-frame');
          await frame.getByRole('button', { name: 'Edit', exact: true }).click();
          const body = `${mobile ? 'Phone' : 'Desktop'} ${mode} ${fixed ? 'fixed dates' : 'live B'} ${++revision}`;
          await frame.getByLabel("The note's text").fill(body);
          await frame.getByRole('button', { name: 'Save', exact: true }).click();
          await frame.locator('.nt-edit').waitFor({ state: 'detached' });
          await frame.getByRole('button', { name: 'Publish', exact: true }).click();
          await frame.getByLabel('Title', { exact: true }).fill(body);
          await frame.getByLabel('Comment', { exact: true }).fill('Only a live B follows publication; manually selected dates stay fixed.');
          const shown = observer.frameLocator(mode === 'side_by_side' ? 'iframe.mx-panel-frame[src*="_side=b"]' : 'iframe.mx-panel-frame');
          await checkScaleLivePublication({
            track, mobile, fixed, delta: { changed: 1 }, navigationStamp: () => navigations,
            publish: () => frame.getByRole('button', { name: `Publish v${revision}`, exact: true }).click(),
            observe: () => observer.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))),
            readContent: () => shown.locator('.nt-body').innerText(), expectedContent: body,
          });
        }
      }
    }
  } finally {
    await editor.close(); await observer.close();
  }
});

await scenario("bars: the page's changes stacked by kind under the lane", async () => {
  await openScale("bars");
  await page.locator(".mx-card .mx-bar-added").first().waitFor();
  expect((await page.locator(".mx-card .mx-lane").count()) === 0, "a page with bars alone has a lane");
});

await scenario("Diff: the counts on the pill, the stepper stepped by Shift + ↓ from the frame, and the change's card", async () => {
  await page.goto(`${BASE}/w/${CODE}/core/panel-test/history/both?mode=diff&from=${daysAgo(11)}`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor();
  await page.locator(".mx-pill-counts").waitFor();
  const frame = page.frameLocator("iframe.mx-panel-frame");
  await frame.locator(".mx-stepper").waitFor();
  await page.locator(".mx-top").click({ position: { x: 300, y: 20 } });
  await page.keyboard.press("Shift+ArrowDown");
  await frame.locator(".mx-stepper-middle b").filter({ hasText: /^1 of \d+$/ }).waitFor();
  await frame.locator(".mx-diff-card").waitFor();
});

await scenario("Side by side: two panels with their heads; Track lights in A what the pointer is on in B, or says why it cannot", async () => {
  await page.goto(`${BASE}/w/${CODE}/core/panel-test/history/both?mode=side_by_side&from=${daysAgo(11)}`);
  await page.locator(".mx-half-head").nth(1).waitFor();
  await page.locator("iframe.mx-panel-frame:not(.waiting)").nth(1).waitFor();
  const [a, b] = [page.frames().find((f) => f.url().includes("_side=a")), page.frames().find((f) => f.url().includes("_side=b"))];
  expect(a && b, "the two panels are not drawn");
  const point = (anchor) => b.evaluate((name) => {
    const element = document.querySelector(`[data-room-anchor="${name}"]`);
    const box = element.getBoundingClientRect();
    element.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: box.x + 3, clientY: box.y + 3 }));
  }, anchor);
  await point("table:Refund");
  await page.locator(".mx-half-note").filter({ hasText: "Not in A" }).waitFor();
  await point("field:Account.email");
  await page.locator(".mx-half-note").filter({ hasText: "is not in A · showing Account" }).waitFor();
  expect((await a.locator('[data-room-anchor="table:Account"][data-marked]').count()) === 1, "A does not light the table it holds");
});

await scenario("on a phone the pill fills the top row, its card is a sheet from below, and Side by side is one panel with an A / B switch", async () => {
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await phone.addInitScript(() => window.localStorage.setItem("maxitor_cookie_consent", "1"));
  await phone.addCookies(await context.cookies());
  const p = await phone.newPage();
  await p.goto(`${BASE}/w/${CODE}/core/panel-test/history/both?mode=side_by_side&from=${daysAgo(11)}`);
  // The panel not shown stays drawn under the other, hidden: the switch is the shown panel's.
  await p.locator(".mx-half.phone-shown .mx-flip").waitFor();
  expect((await p.locator(".mx-pill").boundingBox()).width >= 220, "the pill does not fill the top row");
  await p.locator(".mx-pill-main").click();
  const sheet = await p.locator(".mx-card").boundingBox();
  expect(sheet.width >= 370 && sheet.y + sheet.height >= 800, "the card is not a sheet from below");
  expect((await p.evaluate(() => document.documentElement.scrollWidth)) <= 375, "the page scrolls sideways on a phone");
  await phone.close();
});

await scenario("a page without the shell is marked by a red strip on the stand", async () => {
  await page.goto(`${BASE}/w/${CODE}/core/panel-test/unframed`);
  await page.locator(".mx-unframed", { hasText: "This page has no Maxitor frame" }).waitFor();
  await page.goto(`${BASE}/w/${CODE}/core/panel-test/drawing`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor();
  expect((await page.locator(".mx-unframed").count()) === 0, "a page in the shell is marked");
});

await scenario("a node that is entered holds its children only; its head, its crumbs and a reload inside it", async () => {
  await page.goto(`${BASE}/w/${CODE}`);
  expect((await page.locator(".mx-node", { hasText: "Notes" }).first().locator(".mx-node-enter").count()) === 1, "Notes carries no mark of an entered node");
  expect((await page.locator(".mx-node", { hasText: "Payments" }).count()) === 0, "an entered node shows its children before the click");
  await page.locator(".mx-node", { hasText: "Notes" }).first().click();
  await page.locator(".mx-level-head", { hasText: "Notes" }).waitFor();
  await page.locator(".mx-node", { hasText: "Payments" }).waitFor();
  expect((await crumbsOf(page)) === "Notes", "the crumbs do not name the entered level");
  // An item expands where it stands, inside the level; Back returns to the root and opens nothing.
  await page.locator(".mx-node", { hasText: "Payments" }).click();
  await page.locator(`a.mx-node[href$="/items/${ITEM}"]`).waitFor();
  const address = page.url();
  await page.getByRole("button", { name: "Back" }).click();
  await page.locator(".mx-level-head").waitFor({ state: "detached" });
  await page.locator(".mx-tree-foot .mx-node", { hasText: "Settings" }).waitFor();
  expect(page.url() === address, "Back changed the address");
  // At the root there is no level above: Back is not drawn at all, neither shown nor greyed out.
  expect((await page.locator(".mx-body > .mx-tree .mx-tree-head button").count()) === 1, "the tree's head at the root holds more than the collapse button");
  expect((await page.getByRole("button", { name: "Back" }).count()) === 0, "Back is drawn at the root");
  // What was expanded in the level lives in the page's memory: entering Notes again finds the item still expanded.
  await page.locator(".mx-node", { hasText: "Notes" }).first().click();
  await page.locator(".mx-level-head", { hasText: "Notes" }).waitFor();
  await page.locator(`a.mx-node[href$="/items/${ITEM}"]`).waitFor();
  // A reload on a page inside Notes enters Notes again from the address, and the page's own line is expanded.
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}`);
  await page.locator(".mx-level-head", { hasText: "Notes" }).waitFor();
  expect((await crumbsOf(page)) === "Notes", "the crumbs do not name the entered level, or name the page inside it");
  // Back steps out of the deepest section through the address: the organization's root (spec 079, FR-041).
  await page.getByRole("button", { name: "Back" }).click();
  await page.locator(".mx-level-head").waitFor({ state: "detached" });
  await page.waitForURL(new RegExp(`/w/${CODE}$`), { waitUntil: "commit" });
});

await scenario("root icons align with collapse and the first section stays in place through entry and Back", async () => {
  await page.goto(`${BASE}/w/${CODE}`);
  await page.locator('.mx-tree-foot .mx-node').waitFor();
  await checkRootTreeAlignment(page.locator('.mx-body > .mx-tree'));
  await checkEnteredTreePosition(page.locator('.mx-body > .mx-tree'));
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  try {
    await phone.addCookies(await context.cookies());
    const p = await phone.newPage();
    await p.goto(`${BASE}/w/${CODE}`);
    await p.getByRole('button', { name: "The organization's tree", exact: true }).click();
    await checkRootTreeAlignment(p.locator('.mx-tree.drawer'));
    const reopenTree = async () => {
      await p.locator('.mx-body > .mx-tree .mx-level-head').waitFor({ state: 'attached' });
      if (!await p.locator('.mx-tree.drawer').isVisible()) await p.getByRole('button', { name: "The organization's tree", exact: true }).click();
    };
    const position = await checkEnteredTreePosition(p.locator('.mx-tree.drawer'), { afterEnter: reopenTree });
    expect(position.visits.every(visit => visit.entered.title.font === position.before.title.font), 'Entering a section shrank the phone title');
    await p.locator('.drawer .mx-node', { hasText: 'Notes' }).click();
    await reopenTree();
    await p.locator('.drawer .mx-level-head').waitFor();
    expect(await p.locator('.drawer .mx-tree-root').count() === 0, 'Root alignment leaked into an entered level');
  } finally { await phone.close(); }
});

await scenario("standalone core and tree mockups align root icons on desktop and phone", async () => {
  const mock = await context.newPage();
  const url = name => pathToFileURL(join(ROOT, 'specs', name, 'mockup/index.html')).href;
  try {
    await mock.goto(url('085-entered-tree-node'));
    const selectors = { rows: '.root-entry', icon: '.slot svg', toggle: '.sbh .sbb svg' };
    await checkRootTreeAlignment(mock.locator('.sb'), selectors);
    const positionSelectors = { entry: '.tree .root-entry', entryIcon: '.slot svg', entryTitle: '.lb', heading: '.lvhead', headingIcon: 'svg', headingTitle: '.lb' };
    await checkEnteredTreePosition(mock.locator('.sb'), positionSelectors);
    await mock.getByRole('button', { name: 'Phone', exact: true }).click();
    await mock.getByRole('button', { name: "The organization's tree", exact: true }).click();
    await checkRootTreeAlignment(mock.locator('.drawer'), selectors);
    const reopenMockTree = async () => {
      if (!await mock.locator('.drawer').isVisible()) await mock.getByRole('button', { name: "The organization's tree", exact: true }).click();
    };
    await checkEnteredTreePosition(mock.locator('.drawer'), { ...positionSelectors, afterEnter: reopenMockTree });
    await mock.locator('.drawer .root-entry').filter({ hasText: 'Notes' }).click();
    await reopenMockTree();
    expect(await mock.locator('.drawer .root-entry').count() === 0, 'Mockup root alignment leaked into an entered level');
    await mock.goto(`${url('072-maxitor-core')}?screen=9.1`);
    await mock.getByRole('button', { name: 'Back', exact: true }).click();
    await checkRootTreeAlignment(mock.locator('.mx-tree'), { minimum: 1 });
    const desktopHead = await mock.locator('.mx-tree-head').evaluate(el => el.getBoundingClientRect().height);
    await mock.locator('.mx-tree-foot .mx-node').click();
    expect(Math.abs(await mock.locator('.mx-tree-head').evaluate(el => el.getBoundingClientRect().height) - desktopHead) < 0.1, 'Mockup tree controls moved on entering Settings');
    await mock.goto(`${url('072-maxitor-core')}?screen=M15`);
    await mock.getByRole('button', { name: "The organization's tree", exact: true }).click();
    expect(await mock.locator('.mx-tree.drawer').isVisible(), 'The phone mockup opened a hidden tree');
    await mock.getByRole('button', { name: 'Back', exact: true }).click();
    await checkRootTreeAlignment(mock.locator('.mx-tree.drawer'), { minimum: 1 });
    const phoneHead = await mock.locator('.drawer .mx-tree-head').evaluate(el => el.getBoundingClientRect().height);
    await mock.locator('.drawer .mx-tree-foot .mx-node').click();
    await mock.getByRole('button', { name: "The organization's tree", exact: true }).click();
    expect(Math.abs(await mock.locator('.drawer .mx-tree-head').evaluate(el => el.getBoundingClientRect().height) - phoneHead) < 0.1, 'Mockup phone Back button shifted the section heading');
  } finally { await mock.close(); }
});

await scenario("the tree's head: collapse folds the tree, the arrow is Back and steps out of the entered level", async () => {
  await page.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  expect((await page.locator(".mx-body > .mx-tree.collapsed .mx-node").count()) === 0, "the collapsed tree still shows its nodes");
  // Inside an entered level Back exists, yet the collapsed strip holds the expand button alone.
  const strip = await page.locator(".mx-body > .mx-tree.collapsed button").evaluateAll((all) => all.map((b) => b.getAttribute("aria-label")));
  expect(JSON.stringify(strip) === JSON.stringify(["Expand sidebar"]), `the collapsed strip holds ${JSON.stringify(strip)}`);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await page.locator(".mx-body > .mx-tree .mx-node").first().waitFor();
  // Back steps out of the entered level through the address: the tree, the crumbs, the address and the panel agree.
  await page.getByRole("button", { name: "Back" }).click();
  await page.locator(".mx-level-head").waitFor({ state: "detached" });
  expect((await page.locator(".mx-node", { hasText: "Notes" }).count()) === 1, "the root of the tree is not back");
  await page.waitForURL(new RegExp(`/w/${CODE}$`), { waitUntil: "commit" });
  // At the root there is no level above: Back is not drawn.
  expect((await page.locator(".mx-tree-head [aria-label='Back']").count()) === 0, "Back stands at the root");
});

await scenario("a second organization installs the deployed version without building it", async () => {
  await page.goto(`${BASE}/new`);
  await page.getByLabel("Organization’s name").fill(`Check B ${RUN}`);
  await page.getByText("free").waitFor();
  await page.getByRole("button", { name: "Register and enter" }).click();
  await page.waitForURL(`**/w/${SECOND}`);
  await page.goto(`${BASE}/w/${SECOND}/core/settings/plugins`);
  await page.getByRole("tab", { name: /Marketplace/ }).click();
  await page.locator(".mcard", { hasText: "Notes" }).getByRole("button", { name: "Install" }).click();
  await page.getByText("is already deployed in Maxitor").waitFor();
  await page.getByRole("button", { name: "Install Notes" }).click();
  await waitForState("Notes", "enabled");
});

await scenario("disabling keeps the plugin, enabling brings its sections back", async () => {
  await page.goto(`${BASE}/w/${SECOND}/core/settings/plugins`);
  await page.locator(".prow", { hasText: "Notes" }).getByRole("button", { name: "Disable" }).click();
  await page.getByRole("button", { name: "Disable", exact: true }).last().click();
  await waitForState("Notes", "disabled");
  await page.goto(`${BASE}/w/${SECOND}`);
  expect((await page.locator(".mx-node", { hasText: "Notes" }).count()) === 0, "a disabled plugin stays in the tree");
  await page.goto(`${BASE}/w/${SECOND}/core/settings/plugins`);
  await page.locator(".prow", { hasText: "Notes" }).getByRole("button", { name: "Enable" }).click();
  await waitForState("Notes", "enabled");
  await page.goto(`${BASE}/w/${CODE}/core/settings/plugins`);
  await page.locator(".prow", { hasText: "Notes" }).locator(".stt.enabled").waitFor(); // the first organization untouched
});

const INVITED = `invited-${RUN}@example.com`;
const INVITED_PASSWORD = `Invited-Horse-${RUN}`;
const BY_USER = `colleague-${RUN}@example.com`;
let invitationSentAt = 0;
// The invited person's own browser: signed up with the invited email, kept open across the scenarios below.
const guest = await browser.newContext({ viewport: { width: 1360, height: 840 } });
await guest.addInitScript(() => window.localStorage.setItem("maxitor_cookie_consent", "1"));
const g = await guest.newPage();

await scenario("an administrator invites from Settings → Users; the letter names the organization and holds no link", async () => {
  await page.goto(`${BASE}/w/${CODE}`);
  await page.locator(".mx-tree-foot .mx-node", { hasText: "Settings" }).click();
  await page.locator(".mx-tree-scroll .mx-node", { hasText: "Users" }).click();
  await page.waitForURL(`**/w/${CODE}/core/settings/users`);
  // Spec 079, FR-040: the crumbs name entered sections; the Users page adds no level inside Settings.
  expect((await crumbsOf(page)) === "Settings", `the crumbs say ${await crumbsOf(page)}`);
  await page.locator(`.utbl tr[data-user="${EMAIL}"]`).waitFor();
  const sent = Date.now() - 1000;
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  expect(!(await page.getByLabel("Organization administrator").isChecked()), "the administrator mark is on when the form opens");
  await page.getByLabel("Email", { exact: true }).fill(INVITED);
  await page.getByRole("button", { name: "Send the invitation" }).click();
  await page.locator(".drawer", { hasText: "will be an ordinary user" }).waitFor();
  await page.locator(".utbl tr", { hasText: INVITED }).getByText("Sent").waitFor();
  invitationSentAt = Date.now();
  const text = await letterText(INVITED, sent, "invites you");
  expect(text.includes(`Check Person`) && text.includes(ORG), "the letter does not name the inviter and the organization");
  expect(!/https?:\/\//.test(text), "the letter holds a link");
  expect(text.includes("waits until"), "the letter does not say until when the invitation waits");
  // The same email again is refused while the invitation is sent.
  await page.locator(".drawer").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(INVITED);
  await page.getByRole("button", { name: "Send the invitation" }).click();
  await page.getByText("An invitation to this email is already sent").waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
});

await scenario("the invited person signs up with the invited email, sees the invitation and accepts", async () => {
  await g.goto(`${BASE}/sign-up`);
  const sent = Date.now() - 1000;
  await g.getByLabel("Email").fill(INVITED);
  await g.locator("#pw-new-password").fill(INVITED_PASSWORD);
  await g.getByRole("button", { name: "Continue" }).click();
  await g.getByLabel("Six-digit code").fill(await codeFor(INVITED, sent));
  await g.getByRole("button", { name: "Confirm" }).click();
  await g.waitForURL("**/sign-in/new-account");
  await g.getByLabel("Your name").fill("Invited Person");
  await g.locator(".check").click();
  await g.getByRole("button", { name: "Create account" }).click();
  await g.waitForURL(`${BASE}/w`);
  await g.getByText("You are invited").waitFor();
  const row = g.locator(".orow.inv", { hasText: ORG });
  await row.getByText("Check Person invites you · as a user").waitFor();
  await row.getByRole("button", { name: "Accept" }).click();
  await g.waitForURL(`**/w/${CODE}`);
  await g.getByText("Choose a section in the tree").waitFor();
  expect((await g.locator(".mx-tree-foot .mx-node").count()) === 0, "an ordinary user sees Settings");
});

await scenario("the new user invites from the menu under the icon; the administrator sees the user and the invitations", async () => {
  await g.locator(".mx-avatar").click();
  await g.getByRole("button", { name: `Invite to ${ORG}` }).click();
  expect((await g.getByLabel("Organization administrator").count()) === 0, "an ordinary user is offered the administrator mark");
  await g.getByLabel("Email").fill(BY_USER);
  await g.getByRole("button", { name: "Send the invitation" }).click();
  await g.getByText(`The invitation is sent to ${BY_USER}`).waitFor();
  await g.locator(".arow", { hasText: BY_USER }).getByText("Sent").waitFor();
  await g.getByRole("button", { name: "Done" }).click();
  await page.goto(`${BASE}/w/${CODE}/core/settings/users`);
  const user = page.locator(".utbl tr", { hasText: "Invited Person" });
  await user.getByText("Active").waitFor();
  await user.getByText("invited by Check Person").waitFor();
  await page.getByRole("tab", { name: /Invitations/ }).click();
  await page.locator(".utbl tr", { hasText: BY_USER }).getByText("Invited Person").waitFor();
  await page.locator(".utbl tr", { hasText: INVITED }).getByText("Accepted", { exact: true }).waitFor();
});

await scenario("administrators only withdraws the user's invitation and takes Invite from their menu", async () => {
  await page.goto(`${BASE}/w/${CODE}/core/settings/organization`);
  await page.locator(".choice.on", { hasText: "Any user of the organization" }).waitFor();
  await page.locator(".choice", { hasText: "Administrators only" }).click();
  await page.locator(".dlg", { hasText: "Administrators only?" }).locator(".arow", { hasText: BY_USER }).waitFor();
  await page.getByRole("button", { name: "Switch and withdraw 1" }).click();
  await page.getByText("Administrators only since").waitFor();
  await page.locator(".choice.on", { hasText: "Administrators only" }).waitFor();
  await page.goto(`${BASE}/w/${CODE}/core/settings/users?tab=invitations`);
  await page.locator(".utbl tr", { hasText: BY_USER }).getByText("Withdrawn", { exact: true }).waitFor();
  await g.goto(`${BASE}/w/${CODE}`);
  await g.locator(".mx-avatar").click();
  await g.getByRole("button", { name: "Sign out" }).waitFor();
  expect((await g.getByRole("button", { name: `Invite to ${ORG}` }).count()) === 0, "an ordinary user may still invite");
  await g.keyboard.press("Escape");
});

await scenario("a blocked user is a stranger from the next request; the last administrator cannot be blocked", async () => {
  await page.goto(`${BASE}/w/${CODE}/core/settings/users`);
  await page.locator(".utbl tr", { hasText: "Invited Person" }).click();
  const card = page.locator(".drawer", { hasText: "Invited Person" });
  await card.getByRole("button", { name: "Block" }).click();
  await card.locator(".life .on", { hasText: "Blocked" }).waitFor();
  await g.goto(`${BASE}/w/${CODE}`);
  await g.getByText("No such organization").waitFor();
  await card.getByRole("button", { name: "Unblock" }).click();
  await card.locator(".life .on", { hasText: "Active" }).waitFor();
  await page.locator(`.utbl tr[data-user="${EMAIL}"]`).click();
  const own = page.locator(".drawer", { hasText: "Check Person" });
  await own.getByText("The last active administrator").waitFor();
  expect(await own.getByRole("button", { name: "Block" }).isDisabled(), "the last administrator can be blocked");
  expect(await own.getByLabel("Administrator").isDisabled(), "the last administrator can lose the mark");
});

await scenario("signing in again opens where the person stopped", async () => {
  await page.goto(`${BASE}/w/${CODE}/core/settings/users`);
  await page.locator(`.utbl tr[data-user="${EMAIL}"]`).waitFor();
  await page.locator(".mx-avatar").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(`${BASE}/`);
  await signIn(EMAIL, PASSWORD);
  await page.waitForURL(`**/w/${CODE}/core/settings/users`);
  await page.locator(`.utbl tr[data-user="${EMAIL}"]`).waitFor();
});

await scenario("the private plugin dialog refuses a PyPI address before sending it", async () => {
  await page.goto(`${BASE}/w/${CODE}/core/settings/plugins`);
  await page.getByRole("button", { name: "Add a private plugin" }).click();
  await page.getByLabel("Package URL").fill("pkg:pypi/sv-reports@0.3.0");
  await page.getByText("A package on PyPI is the public marketplace's.").waitFor();
  expect(await page.getByRole("button", { name: "Add and check" }).isDisabled(), "a PyPI address can be sent");
  await page.getByRole("button", { name: "Upload a wheel" }).click();
  await page.getByText("Choose a .whl file").waitFor();
});

await scenario("the settings of an organization one is not in answer alike, at the old address too", async () => {
  await page.goto(`${BASE}/w/orbita-${RUN}/core/settings/plugins`);
  await page.getByText("No such organization").waitFor();
  await page.goto(`${BASE}/w/orbita-${RUN}/settings/plugins`);
  await page.getByText("No such organization").waitFor();
});

await scenario("someone else's organization and a made-up one answer alike", async () => {
  await page.goto(`${BASE}/w/orbita-${RUN}`);
  await page.getByText("No such organization").waitFor();
  expect((await page.locator(".mx-org").count()) === 0, "the top row names an organization");
});

await scenario("sign out, then a wrong password is one message and the right one signs in", async () => {
  await page.goto(`${BASE}/w/${CODE}`);
  await page.locator(".mx-avatar").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(`${BASE}/`);
  await signIn(EMAIL, "Wrong-Password-1");
  await page.getByText("Wrong email or password.").waitFor();
  await signIn("nobody-" + EMAIL, "Wrong-Password-1");
  await page.getByText("Wrong email or password.").waitFor();
  await signIn(EMAIL, PASSWORD);
  // The account has two organizations, and its last place was the first one's root: signing in opens there.
  await page.waitForURL(`**/w/${CODE}`);
  await page.getByText("Choose a section in the tree").waitFor();
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
  await p.goto(`${BASE}/w/${CODE}/core/settings/plugins`);
  await p.locator(".prow", { hasText: "Notes" }).waitFor();
  const wide = () => p.evaluate(() => document.documentElement.scrollWidth);
  expect((await wide()) <= 375, `the installed tab is ${await wide()} px wide`);
  await p.getByRole("tab", { name: /Marketplace/ }).click();
  expect((await wide()) <= 375, `the marketplace is ${await wide()} px wide`);
  await p.getByRole("button", { name: "Add a private plugin" }).click();
  const sheet = await p.locator(".dlg.sheet").boundingBox();
  expect(sheet && Math.round(sheet.y + sheet.height) >= 811 && sheet.width >= 370, "the dialog is not a sheet from the bottom");
  await p.getByRole("button", { name: "Cancel" }).click();
  // The address is inside Settings, so the drawer arrives at the level of Settings already: head and Plugins only.
  await p.getByRole("button", { name: "The organization's tree" }).click();
  const drawer = async () => JSON.stringify(await p.locator(".mx-tree.drawer").innerText().catch(() => "no drawer"));
  expect((await drawer()).includes("Plugins"), `the drawer of the address inside Settings: ${await drawer()} at ${p.url()}`);
  // Back in the drawer steps out to the root, and Settings is a row there again — entered.
  await p.locator(".mx-tree.drawer").getByRole("button", { name: "Back" }).click();
  await p.locator(".mx-tree.drawer .mx-level-head").waitFor({ state: "detached" });
  await p.locator(".mx-tree.drawer .mx-node", { hasText: "Settings" }).click();
  await p.locator(".mx-tree.drawer .mx-level-head", { hasText: "Settings" }).waitFor();
  await phone.close();
});

await scenario("on a phone the shell folds: the filters into a button, the pills to icons, the actions to the bottom", async () => {
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await phone.addInitScript(() => window.localStorage.setItem("maxitor_cookie_consent", "1"));
  await phone.addCookies(await context.cookies());
  const p = await phone.newPage();
  // The draft is empty after the publication above: a new note gives the phone a card of the draft to open.
  const written = await p.request.post(`${BASE}/p/notes/api/${CODE}/notes`, { headers: { Origin: BASE }, data: { item_id: ITEM, body: "Check the limits on a phone" } });
  expect(written.status() === 200, `a note for the phone answers ${written.status()}`);
  await p.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}`);
  await p.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  const frame = p.frameLocator("iframe.mx-panel-frame");
  await frame.locator(".mx-filters-button").waitFor();
  expect(!(await frame.locator(".mx-filters-body").isVisible()), "the filters are not folded");
  await frame.locator(".mx-filters-button").click();
  await frame.locator(".mx-filters-body").waitFor();
  await frame.getByRole("button", { name: "Done" }).click();
  expect((await p.evaluate(() => document.documentElement.scrollWidth)) <= 375, "the frame is wider than the phone");
  await p.goto(`${BASE}/w/${CODE}/core/panel-test/drawing`);
  await p.locator("iframe.mx-panel-frame:not(.waiting)").waitFor();
  expect(!(await frame.locator(".mx-pill-label").first().isVisible()), "the pills keep their labels on a phone");
  const actions = await frame.locator(".mx-actions").boundingBox();
  expect(actions.y > 812 / 2, "the actions are not at the bottom on a phone");
  await phone.close();
});

await scenario("a list of 10,000 rows lies whole on the canvas: rows in view only, the head sticking, the camera moving it", async () => {
  await page.goto(`${BASE}/w/${CODE}/core/panel-test/list`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor();
  const frame = page.frameLocator("iframe.mx-panel-frame");
  await frame.locator(".mx-list-row").first().waitFor();
  expect((await frame.locator(".mx-list").getAttribute("data-rows")) === "10000", "the list does not hold 10,000 rows");
  const drawn = await frame.locator(".mx-list-row").count();
  expect(drawn > 0 && drawn < 80, `the page draws ${drawn} rows, not those in view`);
  const head = async () => (await frame.locator(".mx-list-head").boundingBox()).y;
  const before = await head();
  const canvas = await frame.locator(".mx-canvas").boundingBox();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  for (let i = 0; i < 20; i += 1) await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  expect(Math.abs((await head()) - before) < 40, "the head does not stick to the top of the view");
  const first = await frame.locator(".mx-list-row").first().innerText();
  expect(!first.includes("Account 00001"), "the wheel did not move the list");
  expect((await frame.locator(".mx-list-row").count()) < 80, "moving the camera draws more than the view");
});

await scenario("the three kinds of filter write the address, and the address gives the same rows in a new tab", async () => {
  await page.goto(`${BASE}/w/${CODE}/core/panel-test/list`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor();
  const frame = page.frameLocator("iframe.mx-panel-frame");
  const count = () => frame.locator(".mx-list-count").innerText();
  await frame.locator(".mx-filter-title", { hasText: "Manager" }).click();
  await frame.getByText("38 more").waitFor();
  await frame.getByPlaceholder("Find a manager").fill("orlov");
  expect((await frame.locator('[data-filter="manager"] [role="checkbox"]').count()) === 23, "the search does not keep the matching values");
  await frame.locator(".mx-filter-title", { hasText: "Search" }).click();
  await frame.getByPlaceholder("Account or email").fill("account1@");
  await page.waitForURL(/q=account1/);
  expect((await count()) === "1 of 10000 rows", `the text did not filter: ${await count()}`);
  await frame.getByPlaceholder("Account or email").fill("");
  await page.waitForURL((url) => !url.search.includes("q="));
  await frame.locator(".mx-filter-title", { hasText: "Balance" }).click();
  await frame.getByLabel("Balance from").fill("100");
  await frame.getByLabel("Balance to").fill("250");
  await frame.getByLabel("Balance to").press("Enter");
  await page.waitForURL(/balance=100\.\.250/);
  const filtered = await count();
  const again = await context.newPage();
  await again.goto(page.url());
  await again.locator("iframe.mx-panel-frame:not(.waiting)").waitFor();
  const copy = again.frameLocator("iframe.mx-panel-frame");
  await copy.locator(".mx-list-count").waitFor();
  expect((await copy.locator(".mx-list-count").innerText()) === filtered, "the address does not give the same rows in a new tab");
  await again.close();
  expect(Number(await page.locator("iframe.mx-panel-frame").getAttribute("data-hidden")) > 0, "the page did not report its hidden rows");
});

await scenario("the date range picker: a ready stretch, Apply, Cancel and Escape; the date picker called as a plugin would", async () => {
  await page.goto(`${BASE}/w/${CODE}/core/panel-test/list`);
  await page.locator("iframe.mx-panel-frame:not(.waiting)").waitFor();
  const frame = page.frameLocator("iframe.mx-panel-frame");
  await frame.locator(".mx-filter-title", { hasText: "Created" }).click();
  await frame.locator('[data-filter="created"] [data-bound="from"]').click();
  await frame.locator(".mx-cal").waitFor();
  expect((await frame.locator(".mx-cal-month").count()) === 2, "the range picker does not show two months");
  await frame.getByRole("button", { name: "Last 90 days" }).click();
  await frame.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL(/created=now-90d\.\.now/);
  await frame.locator('[data-filter="created"]', { hasText: "90 days ago" }).waitFor();
  await frame.locator('[data-filter="created"] [data-bound="from"]').click();
  await frame.getByRole("button", { name: "This year" }).click();
  await frame.getByRole("button", { name: "Cancel" }).click();
  expect(page.url().includes("created=now-90d..now"), "Cancel changed the range");
  await frame.locator('[data-filter="created"] [data-bound="from"]').click();
  await frame.getByRole("button", { name: "This year" }).click();
  await frame.locator(".mx-cal").press("Escape");
  expect(page.url().includes("created=now-90d..now"), "Escape changed the range");
  await frame.getByTestId("review").click();
  await frame.getByRole("button", { name: "A week ago" }).click();
  await frame.getByRole("button", { name: "Apply" }).click();
  expect((await frame.getByTestId("reviewed").textContent()) === "now-7d", "the date picker did not give its date back");
});

await scenario("on a phone the filters are a sheet from below and the pickers sheets with chips and one month", async () => {
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await phone.addInitScript(() => window.localStorage.setItem("maxitor_cookie_consent", "1"));
  await phone.addCookies(await context.cookies());
  const p = await phone.newPage();
  await p.goto(`${BASE}/w/${CODE}/core/panel-test/list?created=now-90d..now`);
  await p.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  const frame = p.frameLocator("iframe.mx-panel-frame");
  await frame.locator(".mx-filters-button", { hasText: "1" }).click();
  const sheet = await frame.locator(".mx-filters-body").boundingBox();
  expect(sheet.width >= 370 && sheet.y + sheet.height >= 700, "the filters are not a sheet from below");
  await frame.getByRole("button", { name: "Done" }).click();
  await frame.getByTestId("review").click();
  const picker = await frame.locator(".mx-cal.sheet").boundingBox();
  expect(picker.width <= 375 && (await frame.locator(".mx-cal-month").count()) === 1, "the picker is not a sheet with one month");
  expect((await p.evaluate(() => document.documentElement.scrollWidth)) <= 375, "the page scrolls sideways on a phone");
  await phone.close();
});

await scenario("on a phone the invited person's screen wraps its buttons, the invitation form is a sheet and the users are rows", async () => {
  // The second organization invites the invited person: their phone shows the invitation with full-width buttons.
  // The address-wide limit also applies across organizations: wait out the first invitation's minute.
  const wait = invitationSentAt + 61_000 - Date.now();
  if (wait > 0) await new Promise((done) => setTimeout(done, wait));
  await page.goto(`${BASE}/w/${SECOND}/core/settings/users`);
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(INVITED);
  await page.getByRole("button", { name: "Send the invitation" }).click();
  await page.locator(".utbl tr", { hasText: INVITED }).getByText("Sent").waitFor();
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await phone.addInitScript(() => window.localStorage.setItem("maxitor_cookie_consent", "1"));
  await phone.addCookies(await guest.cookies());
  const p = await phone.newPage();
  await p.goto(`${BASE}/w`);
  await p.getByText("Choose an organization").waitFor();
  const accept = await p.locator(".orow.inv").getByRole("button", { name: "Accept" }).boundingBox();
  expect(accept.width >= 150, "Accept does not take its half of a full row on a phone");
  expect((await p.evaluate(() => document.documentElement.scrollWidth)) <= 375, "the organizations' screen scrolls sideways on a phone");
  await phone.addCookies(await context.cookies());
  await p.goto(`${BASE}/w/${CODE}/core/settings/users`);
  await p.locator(`.utbl tr[data-user="${EMAIL}"]`).waitFor();
  expect((await p.evaluate(() => document.documentElement.scrollWidth)) <= 375, "the users' page scrolls sideways on a phone");
  await p.getByRole("button", { name: "Invite", exact: true }).click();
  const sheet = await p.locator(".dlg").boundingBox();
  expect(sheet.width >= 370 && sheet.y + sheet.height >= 700, "the invitation form is not a sheet from below");
  await phone.close();
  await guest.close();
});

await scenario("on a phone the template's notes fill the screen, a note's actions are a sheet behind ⋯ and the dialogs are sheets", async () => {
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await phone.addInitScript(() => window.localStorage.setItem("maxitor_cookie_consent", "1"));
  await phone.addCookies(await context.cookies());
  const p = await phone.newPage();
  await p.goto(`${BASE}/w/${CODE}/notes/items/${ITEM}`);
  await p.locator("iframe.mx-panel-frame:not(.waiting)").waitFor({ timeout: 30_000 });
  const frame = p.frameLocator("iframe.mx-panel-frame");
  await frame.locator(".nt-card").first().waitFor();
  await frame.getByRole("button", { name: "Change actions" }).first().click();
  const sheet = await frame.locator(".mx-dialog").boundingBox();
  expect(sheet.width >= 370 && sheet.y + sheet.height >= 700, "a change's actions are not a sheet from below");
  await frame.locator(".mx-dialog").getByRole("button", { name: "Revert" }).waitFor();
  await frame.locator(".mx-dialog-scrim").click({ position: { x: 10, y: 10 } });
  await frame.getByRole("button", { name: "New note" }).click();
  const dialog = await frame.locator(".mx-dialog").boundingBox();
  expect(dialog.width >= 370, "the New note dialog is not a sheet on a phone");
  expect((await p.evaluate(() => document.documentElement.scrollWidth)) <= 375, "the page scrolls sideways on a phone");
  await phone.close();
});

await browser.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures);
