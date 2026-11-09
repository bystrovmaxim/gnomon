// packages/maxitor/maxitor-core/web/scripts/check-core.mjs
// The scenarios of specs/072-maxitor-core/quickstart.md in Chromium against the local stand
// (./scripts/core-stand.sh up): signing up with the code from the outbox, the consent step, registering an
// organization, signing out and in, a wrong password, resetting the password, someone else's organization, an
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
  await page.waitForURL(`**/w/${CODE}`);
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
  await p.waitForURL(`**/w/${CODE}`);
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

await browser.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures);
