// Read-only browser regression against an existing, populated local organization.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { auditStationaryPills } from "./audit-core-pills.mjs";
import { auditInvitationTabs } from "./audit-administration.mjs";

const base = process.env.MAXITOR_STAND_URL ?? "http://localhost:3013";
const code = process.env.MAXITOR_STAND_CODE;
const email = process.env.MAXITOR_STAND_EMAIL;
const password = process.env.MAXITOR_STAND_PASSWORD;
assert(code && email && password, "Set MAXITOR_STAND_CODE, MAXITOR_STAND_EMAIL and MAXITOR_STAND_PASSWORD");
const output = process.env.MAXITOR_PILLS_OUTPUT ?? ".core-stand/pill-tabs";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = [];
let currentPage;
try {
  const login = await browser.newContext();
  await login.addInitScript(() => localStorage.setItem("maxitor_cookie_consent", "1"));
  const signIn = await login.newPage();
  await signIn.goto(base);
  await signIn.getByLabel("Email", { exact: true }).fill(email);
  await signIn.getByLabel("Password", { exact: true }).fill(password);
  await signIn.getByRole("button", { name: "Sign in", exact: true }).click();
  await signIn.waitForURL("**/w/**");
  const cookies = await login.cookies();
  await login.close();
  for (const phone of [false, true]) {
    const device = phone ? "phone" : "desktop";
    const context = await browser.newContext({ viewport: phone ? { width: 375, height: 812 } : { width: 1360, height: 900 }, isMobile: phone, hasTouch: phone });
    await context.addCookies(cookies);
    await context.addInitScript(() => localStorage.setItem("maxitor_cookie_consent", "1"));
    const page = await context.newPage();
    currentPage = page;
    const frame = page.frameLocator("iframe.mx-panel-frame").first();
    for (const [section, values, names] of [["users", ["users", "invitations", "history"], ["Users", "Invitations", "History"]], ["plugins", ["installed", "market"], ["Installed", "Marketplace"]]]) {
      const fallback = section === "users" ? "users" : "market";
      await page.goto(`${base}/w/${code}/core/settings/${section}`);
      const pills = frame.locator("[data-shell=layers]");
      await pills.getByRole("radio").first().waitFor();
      for (let i = 0; i < values.length; i++) {
        const tab = pills.getByRole("radio", { name: new RegExp(`^${names[i]}`) });
        if (phone) await tab.tap(); else await tab.click();
        await page.waitForURL(url => (url.searchParams.get("tab") ?? fallback) === values[i]);
        await frame.locator(`[data-shell=layers] [aria-checked="true"]`).filter({ hasText: names[i] }).waitFor();
        const style = await pills.evaluate(el => {
          const button = el.querySelector('[aria-checked="true"]');
          const box = el.getBoundingClientRect();
          return { selected: el.querySelectorAll('[aria-checked="true"]').length, width: box.width, x: box.x, viewport: innerWidth,
            position: getComputedStyle(el).position, label: getComputedStyle(button).fontSize, count: getComputedStyle(button.querySelector('.mx-count')).fontSize,
            radius: getComputedStyle(el).borderRadius, background: getComputedStyle(button).backgroundColor, color: getComputedStyle(button).color,
            height: button.getBoundingClientRect().height };
        });
        assert.equal(style.selected, 1);
        assert.equal(style.label, "14px");
        assert.equal(style.count, "11px");
        assert.equal(style.background, "rgb(15, 23, 42)");
        assert.equal(style.color, "rgb(255, 255, 255)");
        assert.equal(style.position,"fixed");
        assert(style.width < 370, "Pills must not stretch across the canvas");
        assert(style.x >= 0 && style.x + style.width <= style.viewport, "All tabs must initially fit the viewport");
        if (phone) assert(style.height >= 44);
        if (section === "users") {
          assert.deepEqual((await auditInvitationTabs(frame)).problems, []);
          const count = Number(await tab.locator('.mx-count').innerText());
          assert.equal(await frame.locator('#people-list tbody tr[data-user], #people-list tbody tr[data-invitation]').count(), count);
        }
        report.push({ device, section, tab: values[i], ...style });
        // Let the browser's temporary touch highlight fade before recording the result.
        if (phone) await page.waitForTimeout(350);
        await page.screenshot({ path: `${output}/${device}-${section}-${values[i]}.png` });
        if (process.env.MAXITOR_PILLS_MUTATE === "1") await pills.evaluate(el => document.querySelector('.admin-scene').append(el));
        const cameraCheck = await auditStationaryPills(page, frame, phone);
        report.at(-1).camera = cameraCheck;
      }
      // Keyboard navigation keeps one selected tab and focus, with wrapping.
      await pills.getByRole("radio").last().focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForURL(url => (url.searchParams.get("tab") ?? fallback) === values[0]);
      await page.keyboard.press("End");
      await page.waitForURL(url => (url.searchParams.get("tab") ?? fallback) === values.at(-1));
      await page.reload();
      await frame.locator('[data-shell=layers] [aria-checked="true"]').filter({ hasText: names.at(-1) }).waitFor();
      assert.equal(new URL(page.url()).searchParams.get("tab") ?? fallback, values.at(-1));
      const search = frame.getByRole("searchbox");
      await search.fill("no-such-entry-pill-check");
      await page.waitForURL(url => url.searchParams.get("search") === "no-such-entry-pill-check");
      await pills.getByRole("radio").last().locator('.mx-count').filter({hasText:/^0$/}).waitFor();
      await pills.getByRole("radio").first().click();
      await page.waitForURL(url => (url.searchParams.get("tab") ?? fallback) === values[0]);
      assert.equal(new URL(page.url()).searchParams.get("search"), "no-such-entry-pill-check");
    }
    // Following an accepted invitation must survive the shell's switch back to Users.
    await page.goto(`${base}/w/${code}/core/settings/users?tab=history`);
    const accepted = frame.locator('tr[data-invitation]').filter({has:frame.locator('.st-accepted')}).first();
    await accepted.waitFor({state:'attached'});
    const invitedEmail = await accepted.getAttribute('data-invitation');
    await frame.getByRole('searchbox').fill(invitedEmail);
    await page.waitForURL(url=>url.searchParams.get('search')===invitedEmail);
    const invitation = frame.getByRole('button',{name:`Open invitation ${invitedEmail}`,exact:true});
    if (phone) await invitation.tap(); else await invitation.click();
    const link = frame.getByRole('dialog').locator('.lnk2');
    const person = await link.innerText();
    if (phone) await link.tap(); else await link.click();
    await page.waitForURL(url=>url.searchParams.get('tab')==='users');
    await frame.getByRole('dialog',{name:`User ${person}`,exact:true}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('tab'),'users');
    await frame.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
    report.push({device,acceptedInvitation:'opens the user through shell navigation'});
    // The same pills navigate historical Users/Invitations/History without losing A/B.
    const watermark = await (await page.request.get(`${base}/api/v1/organizations/${code}/watermark`)).json();
    const at = watermark.at;
    assert(at, "The organization must provide its watermark");
    const from = new Date(Date.parse(at) - 3_600_000).toISOString().replace(/(\.\d{3})Z$/, "$1000Z");
    for (const mode of [null, "diff", "side_by_side"]) {
      const query = new URLSearchParams({ at, ...(mode ? { mode, from } : {}) });
      await page.goto(`${base}/w/${code}/core/settings/users?${query}`);
      const historical = page.frameLocator(mode === "side_by_side" ? 'iframe.mx-panel-frame[src*="_side=b"]' : 'iframe.mx-panel-frame').first();
      for (const name of ["Invitations", "History", "Users"]) {
        const tab = historical.getByRole("radio", { name: new RegExp(`^${name}`) });
        if (phone) await tab.tap(); else await tab.click();
        await page.waitForURL(url => (url.searchParams.get("tab") ?? "users") === name.toLowerCase());
        const url = new URL(page.url());
        assert.equal(url.searchParams.get("at"), at);
        if (mode) { assert.equal(url.searchParams.get("from"), from); assert.equal(url.searchParams.get("mode"), mode); }
      }
      // Wait for the historical response to publish the selected view's actual count.
      await historical.getByRole("radio", {name:"Users",exact:true}).locator('.mx-count').filter({hasText:/\d/}).waitFor();
      const camera = await auditStationaryPills(page, historical, phone);
      report.push({ device, history: mode ?? "single", preserved: true, camera });
      await page.screenshot({path:`${output}/${device}-users-${mode ?? "past"}.png`});
    }
    await page.goto(`${base}/w/${code}/core/panel-test/drawing`);
    const layers = frame.getByRole("radiogroup", { name: "Layer" });
    await layers.getByRole("radio", { name: "Events", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("layer") === "events");
    assert.equal(await layers.getByRole("radio", { name: "Events", exact: true }).getAttribute("aria-checked"), "true");
    assert.equal(await layers.locator('.mx-pills-label').first().evaluate(el => getComputedStyle(el).display), phone ? "none" : "block");
    await layers.getByRole("radio", { name: "Domains", exact: true }).click();
    await page.waitForURL(url => !url.searchParams.has("layer"));
    report.push({ device, layers: "selection and default URL preserved" });
    console.log(`PASS: ${device} live tabs, keyboard, reload, search, history/A/B and Layers`);
    await context.close();
  }
  const prototypes = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
  const prototype = await prototypes.newPage();
  currentPage = prototype;
  for (const name of ["072-maxitor-core", "073-plugin-marketplace"]) {
    await prototype.goto(new URL(`../../../../../specs/${name}/mockup/index.html`, import.meta.url).href);
    const screens = await prototype.evaluate(() => SCREENS.flatMap(([, entries]) => entries).filter(([, , state]) =>
      typeof stateOf === "function" ? state.fpage === "users" : state.screen !== "org" && state.user !== "member").map(([id]) => id));
    for (const phone of [false, true]) {
      for (const id of screens) {
        await prototype.evaluate(({ id, phone }) => { openNum(id); go({ phone }); }, { id, phone });
        const style = await prototype.locator('[data-shell=layers]').evaluate(el => {
          const selected = el.querySelector('[aria-checked="true"]');
          return { count: el.querySelectorAll('[aria-checked="true"]').length, label: getComputedStyle(selected).fontSize,
            countSize: getComputedStyle(selected.querySelector('.mx-count')).fontSize, height: getComputedStyle(selected).height, radius: getComputedStyle(el).borderRadius, outside: !el.closest(".page,.mx-panel-own,.admin-mockup-canvas") };
        });
        assert.equal(style.count, 1, `${name}/${id}`);
        assert.equal(style.outside,true);
        assert.equal(style.label, "14px");
        assert.equal(style.countSize, "11px");
        if (phone) assert(parseFloat(style.height) >= 44);
        report.push({ mockup: name, screen: id, phone, ...style });
      }
      await prototype.evaluate(({ name, phone }) => { openNum(name.startsWith("072") ? "9.1" : "1.1"); go({ phone }); }, { name, phone });
      await prototype.locator('[data-shell=layers] [role="radio"]').last().click();
      await prototype.locator('[data-shell=layers] [role="radio"]').last().focus();
      await prototype.keyboard.press("Home");
      assert.equal(await prototype.locator('[data-shell=layers] [role="radio"]').first().getAttribute('aria-checked'), 'true');
      await prototype.locator('#app').screenshot({ path: `${output}/mockup-${name}-${phone ? "phone" : "desktop"}.png` });
    }
  }
  await prototypes.close();
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(`PASS: ${report.length} desktop/phone tab and historical checks; screenshots in ${output}`);
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: `${output}/failure.png` });
    console.error("Failed at", currentPage.url());
  }
  throw error;
} finally {
  await browser.close();
}
