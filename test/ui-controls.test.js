"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const functionSource = (source, name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const body = source.indexOf("{", start);
  let depth = 0;
  for (let index = body; index < source.length; index++) {
    if (source[index] === "{") depth++;
    else if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`unterminated function ${name}`);
};

test("New canvas controls are available in the toolbar and History panel", () => {
  const html = read("public/index.html"), app = read("public/app.js");
  assert.ok(html.indexOf('id="newCanvasBtn"') < html.indexOf('id="historyBtn"'));
  for (const id of ["historyNew", "newCanvasDialog", "newDiscard", "newSaveCopy", "newOverwrite"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /currentSnapshotId:\s*null/);
  assert.match(app, /saveSnapshot\(\{\s*overwriteId\s*=\s*null,\s*name\s*=\s*null\s*\}/);
  assert.match(app, /completeNewCanvas\("overwrite"\)/);
  assert.match(app, /function startBlankCanvas\(\)/);
});

test("New, Clear, and Debug are accessible theme-aware icon buttons", () => {
  const html = read("public/index.html"), css = read("public/style.css");
  for (const id of ["newCanvasBtn", "clearCanvasBtn", "debugBtn"]) {
    const button = html.match(new RegExp(`<button[^>]*id="${id}"[\\s\\S]*?<\\/button>`))?.[0] || "";
    assert.match(button, /class="[^"]*icon-button[^"]*utility-icon[^"]*"/);
    assert.match(button, /data-i18n-aria=/);
    assert.match(button, /data-i18n-title=/);
    assert.match(button, /<svg /);
    assert.doesNotMatch(button, />\s*(New|Clear|Debug)\s*</);
  }
  for (const theme of ["arcane", "scifi", "research"]) assert.match(html, new RegExp(`value="${theme}"`));
  assert.match(css, /button\.utility-icon:not\(\.active\).*var\(--ink\)/);
  assert.match(css, /button\.utility-icon\.danger:not\(\.active\).*var\(--danger\)/);
});

test("Auto AI exposes a persisted zero-to-ten-second delay control", () => {
  const html = read("public/index.html"), app = read("public/app.js"), css = read("public/style.css");
  assert.match(html, /id="autoDelayRange"[^>]*min="0"[^>]*max="10"[^>]*step="0\.1"/);
  assert.match(app, /penecho-auto-delay-ms/);
  assert.match(app, /penecho-auto-ai/);
  assert.match(app, /setTimeout\(hideAutoDelayControl,\s*5000\)/);
  assert.match(app, /if\s*\(state\.auto\)\s*setAutoEnabled\(false\)/);
  assert.match(app, /else\s*setAutoEnabled\(true,\s*true\)/);
  assert.match(css, /\.auto-delay-popover\[hidden\]\s*\{\s*display:\s*none/);
});

test("New canvas and Auto AI controls have English and Chinese copy", () => {
  const app = read("public/app.js"), zh = read("public/locales/zh.js");
  for (const key of ["autoDelay", "newCanvas", "newCanvasTitle", "saveAsNewAndCreate", "overwriteAndCreate", "newCanvasReady"]) {
    assert.match(app, new RegExp(`${key}:`));
    assert.match(zh, new RegExp(`${key}:`));
  }
});

test("eraser strokes never enter the AI recognition batch", () => {
  const app = read("public/app.js");
  assert.match(app, /const shouldRequest = !d\.erase/);
  assert.match(app, /if \(shouldRequest\) \{\s*for \(const point of d\.trail\) state\.hotspotTrail\.push\(point\)/);
  assert.match(app, /if \(shouldRequest && state\.autoEligible\) schedule\(\)/);
  assert.match(app, /const erasing = state\.mode === "eraser";\s*if \(erasing\) invalidateRecognition\(\)/);
  assert.match(app, /erase: erasing/);
  assert.match(app, /dot\(p, erasing, size, !erasing\)/);
  assert.match(app, /stroke\(a, p, d\.erase, size, !d\.erase\)/);
});

test("an uncapturable batch is discarded before later pen strokes", () => {
  const app = read("public/app.js");
  assert.match(app, /function discardUncapturableInput\(hotspotCount, usedDirty\)/);
  assert.match(app, /if \(hotspotCount\) state\.hotspotTrail\.splice\(0, hotspotCount\);\s*state\.dirty = null;\s*state\.autoEligible = false/);
  assert.match(app, /if \(!packed\) \{\s*discardUncapturableInput\(hotspotCount, Boolean\(dirtySnapshot\)\)/);
});

test("AI capture stays inside the current viewport when retained dirty ink is off-screen", () => {
  const app = read("public/app.js"), capture = functionSource(app, "captureRectFor"), build = functionSource(app, "buildViewportImage"), request = functionSource(app, "requestAI");
  assert.match(capture, /return visible/);
  assert.doesNotMatch(capture, /Math\.max\(3200|Math\.max\(2200/);
  assert.match(build, /const latestVisible = intersection\(latestBox, sourceRect\)/);
  assert.match(build, /changedBox: latestVisible/);
  assert.doesNotMatch(build, /containsRect\(sourceRect, latestBox\)/);
  assert.match(request, /const requestBox = packed\.changedBox/);
  assert.match(request, /normalizeCommandPlacements\(validate\(data\.commands \|\| \[\], aiColor\), packed, requestBox\)/);
});

test("the retained focus inset implementation is inactive", () => {
  const app = read("public/app.js");
  assert.match(app, /FOCUS_INSET_ENABLED = false/);
  assert.match(app, /FOCUS_INSET_ENABLED \? drawFocusInset\(out, latestVisible, sourceRect, imageScale\) : null/);
  assert.match(app, /function drawFocusInset\(out, latestBox, sourceRect, mainScale\)/);
});

test("lasso tool exposes local transform controls in both languages", () => {
  const html = read("public/index.html"), app = read("public/app.js"), zh = read("public/locales/zh.js");
  assert.match(html, /data-mode="select"/);
  assert.ok(html.indexOf('src="selection.js"') < html.indexOf('src="app.js"'));
  for (const key of ["select", "selectionTooSmall", "selectionReady", "selectionCommitted", "selectionCancelled", "selectionRecolored"]) {
    assert.match(app, new RegExp(`${key}:`));
    assert.match(zh, new RegExp(`${key}:`));
  }
  assert.match(app, /drawDraftActions\(ctx, selection\.box, size\)/);
  assert.match(app, /drawMoveHandle\(ctx, selection\.box, size, true\)/);
  assert.match(app, /drawResizeHandle\(ctx, selection\.box, size\)/);
  assert.match(app, /clippedContext\.clip\("evenodd"\)/);
  assert.match(app, /tileContext\.fill\("evenodd"\)/);
  assert.match(app, /MAX_LASSO_POINTS = 4096/);
});

test("selection edits never schedule or send AI requests", () => {
  const app = read("public/app.js");
  for (const name of ["captureSelection", "commitSelection", "cancelSelection", "applySelectionColor", "updateSelectionGesture"]) {
    const source = functionSource(app, name);
    assert.doesNotMatch(source, /\b(?:schedule|requestAI)\s*\(/, `${name} must stay local`);
  }
  assert.match(functionSource(app, "finishDrawing"), /schedule\(\)/);
  assert.match(functionSource(app, "invokeAIAction"), /requestAI\(action\)/);
});

test("manual actions and pen-down use non-blocking latest-request-wins cancellation", () => {
  const app = read("public/app.js"),
    manual = functionSource(app, "invokeAIAction"),
    supersede = functionSource(app, "supersedeActiveAI"),
    request = functionSource(app, "requestAI"),
    guard = functionSource(app, "checkAI");
  assert.ok(manual.indexOf('supersedeActiveAI("manual-action")') < manual.indexOf("requestAI(action)"));
  assert.match(app, /if \(!valid\(p\)\)[\s\S]*?return;\s*}\s*supersedeActiveAI\("user-input-started"\);\s*clearTimeout\(state\.timer\)/);
  assert.match(supersede, /active\.superseded = true;[\s\S]*?active\.controller\.abort\(\)/);
  assert.match(supersede, /discardPendingForNewAI\(\)/);
  assert.doesNotMatch(request, /if\s*\(state\.busy\)/);
  assert.match(guard, /run\.superseded \|\| state\.activeAI !== run/);
  assert.match(request, /animate\(commands\[0\], revision, meta, run\)/);
  assert.match(request, /preparePendingItem\(c, revision, meta, run\)/);
});
