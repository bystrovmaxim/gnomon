import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(new URL("../../maxitor/maxitor-core/web/package.json", import.meta.url));
const ts = require("typescript");
function compile(path: string, imports: Record<string, unknown> = {}) {
  const exports: Record<string, any> = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (id: string) => id.endsWith(".css") ? {} : imports[id] ?? require(id) });
  return exports;
}
const { Pills } = compile("../src/content/Pills.tsx");
const options = [{ value: "users", label: "Users", count: 9 }, { value: "invitations", label: "Invitations", count: 0 }, { value: "history", label: "History" }];
const render = require("react-dom/server").renderToStaticMarkup;

test("pills expose one selected non-submitting tab, preserve zero and omit unknown counts", () => {
  const writes: string[] = [];
  const tree = Pills({ options, value: "invitations", label: "People views", id: "people-tabs", panelId: "people-list", onChange: (value: string) => writes.push(value) });
  const buttons = tree.props.children;
  assert.equal(tree.props.role, "tablist");
  assert.equal(buttons.filter((b: any) => b.props["aria-selected"]).length, 1);
  assert.equal(buttons.filter((b: any) => b.props.tabIndex === 0).length, 1);
  for (const button of buttons) {
    assert.equal(button.props.type, "button");
    assert.equal(button.props.role, "tab");
    assert.equal(button.props["aria-controls"], "people-list");
  }
  assert.equal(buttons[1].props.children.at(-1).props.children, 0);
  assert.equal(buttons[2].props.children.at(-1).props.children, "");
  buttons[2].props.onClick();
  assert.deepEqual(writes, ["history"]);
  assert.match(render(tree), /id="people-tabs-invitations"[^>]*aria-selected="true"/);
});

test("arrow keys wrap, Home and End select, and keyboard focus follows the chosen pill", () => {
  for (const [index, key, next] of [[0, "ArrowLeft", 2], [2, "ArrowRight", 0], [0, "End", 2], [2, "Home", 0]] as const) {
    let chosen = "", focused = -1, prevented = false;
    const tree = Pills({ options, value: options[index].value, label: "People views", onChange: (v: string) => { chosen = v; } });
    const buttons = options.map((_, i) => ({ focus: () => { focused = i; } }));
    tree.props.children[index].props.onKeyDown({ key, preventDefault: () => { prevented = true; }, currentTarget: { parentElement: { querySelectorAll: () => buttons } } });
    assert.equal(chosen, options[next].value);
    assert.equal(focused, next);
    assert.equal(prevented, true);
  }
  const tree = Pills({ options, value: "users", label: "People views", onChange: () => assert.fail("Tab must retain native focus movement") });
  tree.props.children[0].props.onKeyDown({ key: "Tab" });
});

test("layers reuse the same pills and retain their default URL choice and radio semantics", () => {
  const { Layers } = compile("../src/shell/Layers.tsx", {
    "../content/Pills": { Pills }, "./icons": { Icon: "svg" },
    "./address": { LAYER: "layer", chosen: (value: string | undefined, fallback: string) => value ?? fallback, writeChoice: (value: string, fallback: string) => value === fallback ? null : value },
  });
  const writes: unknown[] = [];
  const tree = Layers({ layers: { default: "users", options: options.map(option => ({...option,icon:"table"})) }, query: {}, write: (...args: unknown[]) => writes.push(args) });
  assert.equal(tree.type, Pills);
  assert.equal(tree.props.className, "mx-layer-pill with-icons");
  const rendered = Pills(tree.props);
  assert.equal(rendered.props.role, "radiogroup");
  assert.equal(rendered.props["data-shell"], "layers");
  assert.equal(rendered.props.children[0].props["aria-checked"], true);
  assert.equal(rendered.props.children[0].props["aria-selected"], undefined);
  rendered.props.children[0].props.onClick();
  assert.deepEqual(writes, [["layer", null]]);
});

test("page choices are created by the shell API and write their own query parameter", () => {
  const { Layers } = compile("../src/shell/Layers.tsx", {
    "../content/Pills": { Pills }, "./icons": { Icon: "svg" },
    "./address": { LAYER: "layer", chosen: (value: string | undefined, fallback: string) => value ?? fallback, writeChoice: (value: string, fallback: string) => value === fallback ? null : value },
  });
  const writes: unknown[] = [];
  const tree = Layers({ layers: { param: "tab", label: "People views", default: "users", options }, query: {tab:"invitations",layer:"history"}, write: (...args:unknown[]) => writes.push(args) });
  assert.equal(tree.props.className, "mx-layer-pill with-labels");
  const rendered = Pills(tree.props);
  assert.equal(rendered.props["aria-label"], "People views");
  assert.equal(rendered.props["data-shell"], "layers");
  assert.equal(rendered.props.children[1].props["aria-checked"], true);
  rendered.props.children[2].props.onClick();
  rendered.props.children[0].props.onClick();
  assert.deepEqual(writes, [["tab","history"],["tab",null]]);
});

test("administration registers choices with PanelPage.layers and renders none inside the canvas", () => {
  for (const name of ["UsersPage", "PluginsPage"]) {
    const source = readFileSync(new URL("../../maxitor/maxitor-core/web/components/" + name + ".tsx", import.meta.url), "utf8");
    assert.match(source, /useAdministrationLayers\(\{ param: "tab"/);
    assert.doesNotMatch(source, /<Pills|className="(?:tabs|admin-tabs)"/);
  }
  const parent = readFileSync(new URL("../../maxitor/maxitor-core/web/components/administration/AdministrationPanel.tsx", import.meta.url), "utf8");
  assert.match(parent, /<PanelPage[^>]* layers=\{layers\}/);
  const shell = readFileSync(new URL("../src/PanelPage.tsx", import.meta.url), "utf8");
  assert.match(shell, /param: layers.param \?\? LAYER/);
  assert.ok(shell.indexOf("{children}</div>") < shell.indexOf("<Layers layers={layers}"));
  for (const name of ["072-maxitor-core", "073-plugin-marketplace"]) {
    const source = readFileSync(new URL("../../../specs/" + name + "/mockup/index.html", import.meta.url), "utf8");
    assert.match(source, /data-shell="layers" role="radiogroup"/);
    assert.doesNotMatch(source, /class="mx-pills admin-tabs"/);
  }
});
