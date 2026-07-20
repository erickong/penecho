"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const selectionMath = require(path.join(ROOT, "public/selection.js"));
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
  assert.ok(html.indexOf('id="newCanvasBtn"') < html.indexOf('id="exportPngBtn"'));
  assert.ok(html.indexOf('id="exportPngBtn"') < html.indexOf('id="historyBtn"'));
  for (const id of ["historyNew", "newCanvasDialog", "newDiscard", "newSaveCopy", "newOverwrite"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /currentSnapshotId:\s*null/);
  assert.match(app, /saveSnapshot\(\{\s*overwriteId\s*=\s*null,\s*name\s*=\s*null\s*\}/);
  assert.match(app, /completeNewCanvas\("overwrite"\)/);
  assert.match(app, /function startBlankCanvas\(\)/);
  assert.match(functionSource(app, "startBlankCanvas"), /clearTextEditors\(\)/);
  assert.match(functionSource(app, "loadSnapshot"), /clearTextEditors\(\)/);
});

test("Save canvas exposes non-blocking progress and completion feedback", () => {
  const html = read("public/index.html"), app = read("public/app.js"), css = read("public/style.css"), zh = read("public/locales/zh.js");
  assert.match(html, /id="historyNotice"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(app, /async function saveSnapshotFromHistory\(\)/);
  assert.match(app, /showHistoryNoticeKey\("snapshotSaving", "busy", 0\)/);
  assert.match(app, /selectionBusyKey = selectionAIStatusKey\(\)/);
  assert.match(app, /showHistoryNoticeKey\(id \? "snapshotSaved" : selectionBusy \? selectionBusyKey : "emptyCanvas"/);
  assert.match(app, /historySave\"\)\.onclick = saveSnapshotFromHistory/);
  assert.match(app, /if \(event\.key === "Enter"\) saveSnapshotFromHistory\(\)/);
  assert.match(app, /button\.disabled = busy/);
  assert.match(css, /\.history-notice\s*\{[^}]*pointer-events:\s*none/);
  assert.match(css, /#historySave\.is-saving::before/);
  assert.match(zh, /snapshotSaving:/);
});

test("New, Export, Clear, and Debug are accessible theme-aware icon buttons", () => {
  const html = read("public/index.html"), css = read("public/style.css");
  for (const id of ["newCanvasBtn", "exportPngBtn", "clearCanvasBtn", "debugBtn"]) {
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

test("PNG export crops to all ink with one tile of padding", () => {
  const html = read("public/index.html"), app = read("public/app.js"), ink = functionSource(app, "exportInkBounds"), region = functionSource(app, "exportRegion"), render = functionSource(app, "renderExportCanvas"), run = functionSource(app, "exportCanvasPng");
  assert.match(ink, /inkBox\(tileCanvas/);
  assert.doesNotMatch(ink, /visibleInkBounds/);
  assert.match(region, /Math\.floor\(ink\.x\) - TILE/);
  assert.match(region, /Math\.ceil\(ink\.x \+ ink\.w\) \+ TILE/);
  assert.match(region, /Math\.ceil\(ink\.y \+ ink\.h\) \+ TILE/);
  assert.match(render, /state\.paint\.paper/);
  assert.match(render, /state\.gridVisible/);
  assert.match(render, /for \(const \[tileKey, tileCanvas\] of tiles\)/);
  assert.match(render, /selection\?\.phase === "active"/);
  assert.match(run, /canvasBlob\(canvas\)/);
  assert.match(run, /link\.download = exportFilename\(\)/);
  assert.match(app, /querySelector\("#exportPngBtn"\)\.onclick = exportCanvasPng/);
  assert.match(html, /id="exportPngBtn"[^>]*data-i18n-aria="exportPng"/);
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
  assert.match(css, /\.auto-delay-popover\s*\{[^}]*left:\s*0;[^}]*width:\s*190px/);
});

test("Auto AI waits for unsettled toolboxes while manual actions remain available", () => {
  const app = read("public/app.js"), zh = read("public/locales/zh.js"),
    unsettled = functionSource(app, "hasUnsettledToolbox"),
    launch = functionSource(app, "launchAutomaticAI"),
    schedule = functionSource(app, "schedule"),
    manual = functionSource(app, "invokeAIAction"),
    createText = functionSource(app, "createTextEditor");
  for (const toolbox of ["state.pending", "state.pendingGesture", "state.selection", "state.selectionGesture", "state.textEditors.size"]) assert.match(unsettled, new RegExp(toolbox.replace(".", "\\.")));
  assert.match(launch, /if \(hasUnsettledToolbox\(\)\)/);
  assert.match(launch, /state\.statusKey !== "autoToolboxPending"/);
  assert.ok(launch.indexOf("hasUnsettledToolbox()") < launch.indexOf('requestAI("auto")'));
  assert.doesNotMatch(schedule, /textEditors|hasUnsettledToolbox/);
  assert.match(schedule, /setTimeout\(\(\) =>/);
  assert.doesNotMatch(createText, /clearTimeout\(state\.timer\)/);
  assert.match(createText, /if \(!state\.timer && state\.auto && state\.dirty && state\.autoEligible\) schedule\(\)/);
  assert.match(manual, /requestAI\(action\)/);
  assert.doesNotMatch(manual, /hasUnsettledToolbox|autoToolboxPending/);
  assert.match(app, /autoToolboxPending:/);
  assert.match(zh, /autoToolboxPending:/);
});

test("toolbar exposes a fixed clickable reasoning menu before the drawing tools", () => {
  const html = read("public/index.html"), app = read("public/app.js"), css = read("public/style.css"), zh = read("public/locales/zh.js");
  const auto = html.indexOf('id="autoControl"'), effort = html.indexOf('id="effortControl"'), grid = html.indexOf('id="gridToggle"'), font = html.indexOf('id="aiFont"'), pen = html.indexOf('data-mode="pen"');
  assert.ok(auto < effort && effort < grid && grid < font && font < pen);
  assert.match(html, /id="aiEffortButton"[^>]*aria-haspopup="listbox"/);
  assert.match(html, /id="effortPopover"[^>]*hidden/);
  assert.equal((html.match(/class="effort-option"/g) || []).length, 6);
  assert.match(html, /data-effort="config"/);
  for (const mode of ["pen", "eraser", "select"]) {
    const button = html.match(new RegExp(`<button[^>]*data-mode="${mode}"[\\s\\S]*?<\\/button>`))?.[0] || "";
    assert.match(button, /class="[^"]*icon-button[^"]*"/);
    assert.match(button, /data-i18n-aria=/);
    assert.match(button, /data-i18n-title=/);
    assert.doesNotMatch(button, /<span/);
  }
  assert.match(app, /penecho-ai-effort/);
  assert.match(app, /reasoningEffort === "config" \? \{\} : \{ reasoningEffort: state\.reasoningEffort \}/);
  assert.match(app, /const EFFORT_LEVELS = \["none", "low", "medium", "high", "max"\]/);
  assert.match(app, /EFFORT_OPTIONS = \["config", \.\.\.EFFORT_LEVELS\]/);
  assert.match(css, /\.effort-control\s*\{[^}]*width:\s*172px;[^}]*flex:\s*0 0 172px/);
  assert.doesNotMatch(css, /effort-slider-shell|effort-thumb|effort-dots/);
  for (const key of ["reasoningEffort", "reasoningEffortDisplay", "effortConfigured", "effortConfiguredShort", "effortNone", "effortLow", "effortMedium", "effortMediumShort", "effortHigh", "effortMaximum"]) {
    assert.match(app, new RegExp(`${key}:`));
    assert.match(zh, new RegExp(`${key}:`));
  }
});

test("text editor corner scales its box and font while edge handles remain single-axis", () => {
  const app = read("public/app.js"),
    resize = vm.runInNewContext(`(${functionSource(app, "resizeTextEditorDimensions")})`),
    gesture = { startWidth: 320, startHeight: 168, startFontCss: 17 };
  const corner = resize(gesture, "corner", 160, 84, 170, 96, 900, 700);
  assert.equal(corner.widthCss, 480);
  assert.equal(corner.heightCss, 252);
  assert.equal(corner.fontCss, 25.5);
  assert.ok(Math.abs(corner.widthCss / gesture.startWidth - corner.heightCss / gesture.startHeight) < 1e-9);
  assert.ok(Math.abs(corner.fontCss / gesture.startFontCss - corner.widthCss / gesture.startWidth) < 1e-9);
  assert.deepEqual({ ...resize(gesture, "width", 90, 50, 170, 96, 900, 700) }, { widthCss: 410, heightCss: 168, fontCss: 17 });
  assert.deepEqual({ ...resize(gesture, "height", 90, 50, 170, 96, 900, 700) }, { widthCss: 320, heightCss: 218, fontCss: 17 });
  const minimum = resize(gesture, "corner", -400, -400, 170, 96, 900, 700);
  assert.equal(minimum.heightCss, 96);
  assert.ok(Math.abs(minimum.widthCss / gesture.startWidth - minimum.fontCss / gesture.startFontCss) < 1e-9);
  const maximum = resize(gesture, "corner", 2000, 2000, 170, 96, 400, 700);
  assert.equal(maximum.widthCss, 400);
  assert.ok(Math.abs(maximum.heightCss / gesture.startHeight - maximum.fontCss / gesture.startFontCss) < 1e-9);
  const resizedFirst = { startWidth: 500, startHeight: 120, startFontCss: 17 },
    resizedCorner = resize(resizedFirst, "corner", 250, 60, 170, 96, 1000, 700);
  assert.deepEqual({ ...resizedCorner }, { widthCss: 750, heightCss: 180, fontCss: 25.5 });
});

test("text tool toggles a real MD+TeX preview and confirms the unchanged source", () => {
  const html = read("public/index.html"), app = read("public/app.js"), css = read("public/style.css"), zh = read("public/locales/zh.js");
  const textButton = html.match(/<button[^>]*data-mode="text"[\s\S]*?<\/button>/)?.[0] || "";
  assert.match(textButton, /class="[^\"]*icon-button[^\"]*"/);
  assert.match(textButton, /data-i18n-aria="text"/);
  for (const id of ["textEditorLayer", "textInputHint", "textHelpDialog", "textHelpClose", "textHelpDone"]) assert.match(html, new RegExp(`id="${id}"`));
  for (const name of ["createTextEditor", "confirmTextEditor", "cancelTextEditor", "toggleTextEditorMixedMode", "updateTextEditorMixedMode", "renderTextEditorPreview", "scheduleTextEditorPreview", "cancelTextEditorPreview", "mixedTextImage", "positionTextEditors", "keepTextEditorVisible", "clearTextEditors", "setCanvasMode", "openTextHelp", "closeTextHelp", "restoreTextEditorAfterHelp"]) assert.match(app, new RegExp(`function ${name}\\(`));
  assert.ok(html.indexOf('src="mixed-text.js"') < html.indexOf('src="app.js"'));
  assert.match(app, /textEditorStyleSheet\(\)/);
  assert.match(app, /textInputBlockedUntil/);
  assert.match(app, /nextTextEditorZ/);
  assert.match(app, /textTap/);
  assert.match(app, /\(event\.ctrlKey \|\| event\.metaKey\) && event\.key === "Enter"/);
  assert.match(app, /\? \{ typedInput \}/);
  assert.match(app, /if \(state\.auto\) schedule\(Math\.max\(1000, state\.autoDelayMs\)\)/);
  assert.match(app, /mixedMode:\s*false/);
  assert.match(app, /fontCss:\s*TEXT_EDITOR_FONT_CSS/);
  assert.match(app, /startFontCss:\s*editor\.fontCss/);
  assert.match(app, /mixedModeButton\.setAttribute\("aria-pressed", "false"\)/);
  assert.match(app, /helpButton\.setAttribute\("aria-haspopup", "dialog"\)/);
  assert.match(app, /header\.append\(title, helpButton, mixedModeButton, acceptButton, cancelButton\)/);
  assert.match(app, /openTextHelp\(editor, helpButton\)/);
  assert.match(app, /editor\.mixedMode\s*\?\s*await mixedTextImage/);
  assert.match(app, /preview\.className = "text-editor-preview"/);
  assert.match(app, /mixedModeButton\.setAttribute\("aria-controls", preview\.id\)/);
  assert.match(app, /state\.latestTypedInput = \{ text: text\.slice\(0, TEXT_INPUT_MAX_LENGTH\), box \}/);
  const confirm = functionSource(app, "confirmTextEditor"),
    cancel = functionSource(app, "cancelTextEditor"),
    setMode = functionSource(app, "setCanvasMode"),
    openHelp = functionSource(app, "openTextHelp"),
    restoreHelp = functionSource(app, "restoreTextEditorAfterHelp"),
    toggle = functionSource(app, "toggleTextEditorMixedMode"),
    update = functionSource(app, "updateTextEditorMixedMode"),
    preview = functionSource(app, "renderTextEditorPreview");
  assert.match(app, /TEXT_INPUT_GUARD_MS\s*=\s*500/);
  assert.match(confirm, /blockCanvasInput\(TEXT_INPUT_GUARD_MS\)/);
  assert.match(cancel, /blockCanvasInput\(TEXT_INPUT_GUARD_MS\)/);
  assert.match(confirm, /editor\.cancelled \|\| state\.textEditors\.get\(editor\.id\) !== editor/);
  assert.match(confirm, /const fontSize = editor\.fontCss \/ Math\.max\(0\.03, state\.scale\)/);
  assert.ok(confirm.indexOf('setCanvasMode("pen")') > confirm.indexOf("if (!text.trim())"));
  assert.ok(confirm.indexOf('setCanvasMode("pen")') < confirm.indexOf("await mixedTextImage"));
  assert.match(cancel, /setCanvasMode\("pen"\)/);
  assert.match(setMode, /state\.mode = mode/);
  assert.match(setMode, /classList\.toggle\("active", item === button\)/);
  assert.match(app, /button\.onclick = \(\) => setCanvasMode\(button\.dataset\.mode\)/);
  assert.match(openHelp, /focusTextEditor\(editor\)/);
  assert.match(openHelp, /dialog\.showModal\(\)/);
  assert.match(restoreHelp, /blockCanvasInput\(300\)/);
  assert.match(restoreHelp, /invoker\?\.isConnected/);
  assert.match(app, /textHelpDialog"\)\.addEventListener\("close", restoreTextEditorAfterHelp\)/);
  assert.match(app, /newCanvasDialog"\)\.open \|\| document\.querySelector\("#textHelpDialog"\)\.open/);
  assert.match(toggle, /editor\.mixedMode = !editor\.mixedMode/);
  assert.match(toggle, /scheduleTextEditorPreview\(editor, 0\)/);
  assert.doesNotMatch(toggle, /textarea\.value\s*=|\bschedule\(|requestAI\(|userRevision/);
  assert.match(update, /editor\.textarea\.hidden = editor\.mixedMode/);
  assert.match(update, /editor\.preview\.hidden = !editor\.mixedMode/);
  assert.match(preview, /text = editor\.textarea\.value/);
  assert.match(preview, /image = await mixedTextImage\(text, fontCss, color, maxWidth/);
  assert.match(preview, /editor\.previewRevision !== revision/);
  assert.match(preview, /editor\.preview\.replaceChildren\(image\)/);
  assert.doesNotMatch(preview, /schedule\(|requestAI\(|userRevision/);
  assert.match(css, /\.text-editor\s*\{[^}]*pointer-events:\s*auto;[^}]*border:\s*1px solid rgba\(17,24,39,\.92\);[^}]*background:\s*transparent/);
  assert.match(css, /\.text-editor-header\s*\{[^}]*background:\s*transparent/);
  assert.match(css, /\.text-editor-body\s*\{[^}]*background:\s*transparent/);
  assert.match(css, /\.text-editor-preview\s*\{[^}]*background:\s*transparent/);
  assert.match(css, /\.text-editor-input\[hidden\]\s*\{[^}]*display:\s*none/);
  assert.match(css, /font:\s*var\(--text-editor-font-size\)\/1\.35/);
  assert.match(css, /\.text-editor-button\.mixed-mode\[aria-pressed="true"\]/);
  assert.match(css, /\.text-editor-button\.help/);
  assert.match(css, /\.text-help-dialog\s*\{[^}]*max-height:\s*calc\(100dvh - 24px\)[^}]*overflow:\s*auto/);
  assert.match(css, /\.text-help-example pre\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*white-space:\s*pre-wrap/);
  assert.match(css, /#textEditorLayer\s*\{[^}]*z-index:\s*6/);
  assert.match(css, /\.text-editor-handle\.width/);
  assert.match(css, /\.text-editor-handle\.height/);
  assert.match(css, /\.text-editor-handle\.corner/);
  for (const key of ["text", "textMixedMode", "textMixedModeShort", "textEditMode", "textPreview", "textMixedModeError", "textConfirm", "textCancel", "textPlaceholder", "textConfirmHint", "textEmpty", "textHelp", "textHelpTitle", "textHelpClose", "textHelpIntro", "textHelpMarkdown", "textHelpMath", "textHelpConfirm", "textHelpExampleTitle", "textHelpExample", "textHelpDone"]) {
    assert.match(app, new RegExp(`${key}:`));
    assert.match(zh, new RegExp(`${key}:`));
  }
});

test("text rendering preserves explicit lines and rejects MathJax error output", () => {
  const app = read("public/app.js"), layout = functionSource(app, "layoutText"), mixed = functionSource(app, "mixedTextImage"), math = functionSource(app, "mathJaxImage");
  assert.match(layout, /split\("\\n"\)/);
  assert.match(layout, /lines\.push\(\.\.\.wrapped\)/);
  assert.match(mixed, /MIXED_TEXT\.parse/);
  assert.match(mixed, /segment\.raw/);
  assert.match(mixed, /rows\.push\(row\)/);
  assert.match(mixed, /MIXED_FORMULA_MAX_LENGTH/);
  assert.match(math, /\[data-mml-node="merror"\], mjx-merror/);
  assert.match(math, /image\.revealRows = \[logicalWidth\]/);
});

test("New canvas, Export, and Auto AI controls have English and Chinese copy", () => {
  const app = read("public/app.js"), zh = read("public/locales/zh.js");
  for (const key of ["autoDelay", "newCanvas", "exportPng", "exportComplete", "exportError", "newCanvasTitle", "saveAsNewAndCreate", "overwriteAndCreate", "newCanvasReady"]) {
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

test("normalize sends the lasso bounding rectangle on a blank background", () => {
  const app = read("public/app.js"), source = functionSource(app, "buildSelectionImage");
  assert.match(source, /const sourceRect = \{\s*\.\.\.selection\.box\s*\}/);
  assert.doesNotMatch(source, /const padding|content\.x - padding|content\.y - padding/);
  assert.match(source, /q\.fillStyle = "#fff"/);
  assert.match(source, /for \(const fragment of selection\.fragments\)/);
  assert.match(source, /changedBox: \{ \.\.\.sourceRect \}/);
});

test("normalize preserves literal text, formulas, and function plots without inspecting their content", () => {
  const request = functionSource(read("public/app.js"), "requestAI"),
    filter = request.match(/if \(action === "normalize"\)[\s\S]*?debug\("ai-response"/)?.[0] || "";
  assert.match(filter, /\["write_text", "draw_formula", "plot_function"\]\.includes\(commands\[index\]\.tool\)/);
  assert.doesNotMatch(filter, /commands\[index\]\.(?:text|latex|expression)|observedText/);
});

test("selection AI tracks its action while Typeset remains available", () => {
  const app = read("public/app.js"),
    mode = functionSource(app, "setCanvasMode"),
    pointer = functionSource(app, "handleSelectionPointerDown"),
    complete = functionSource(app, "completeNewCanvas"),
    selectionRequest = functionSource(app, "requestSelectionAI"),
    toolbar = functionSource(app, "updateSelectionToolbar"),
    release = functionSource(app, "releaseSelectionAITransformLock"),
    isTypesetting = vm.runInNewContext(`(${functionSource(app, "selectionIsTypesetting")})`, { selectionAIRequest: (selection) => selection?.aiRequest || null });
  assert.equal(isTypesetting({ aiRequest: { action: "continue" } }), false);
  assert.equal(isTypesetting({ aiRequest: { action: "normalize" } }), true);
  assert.match(selectionRequest, /selection\.aiRequest = \{ token, action \}/);
  assert.match(selectionRequest, /selectionRequestToken: token/);
  assert.match(selectionRequest, /selection\.aiRequest\?\.token === token/);
  assert.match(toolbar, /selectionTypesetButton\.disabled = false/);
  assert.match(toolbar, /isTypesetting \? "selectionTypesetting" : "selectionTypeset"/);
  assert.match(release, /selection\.aiRequest\?\.token !== token/);
  assert.match(mode, /selectionAIBusy\(state\.selection\)/);
  assert.match(mode, /selectionAIStatusKey\(state\.selection\)/);
  assert.match(pointer, /selectionAIBusy\(selection\)/);
  assert.doesNotMatch(app, /selection\.typesetting|selection\?\.typesetting/);
  assert.match(complete, /saved === null/);
  assert.match(complete, /setNewCanvasDialogBusy\(false\)/);
});

test("cancelling after accepting an isolated draft does not restore the old selection tiles", () => {
  const app = read("public/app.js"), cancel = functionSource(app, "cancelSelection"), consume = functionSource(app, "consumePendingInput");
  assert.match(cancel, /selection\.phase === "active" && !selection\.acceptedDraft/);
  assert.match(consume, /p\.selection\.acceptedDraft = true/);
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
  assert.doesNotMatch(supersede, /discardPendingForNewAI\(\)/);
  assert.match(app, /appendPendingItems\(state\.pending, items, revision, meta, resolve\)/);
  assert.doesNotMatch(request, /if\s*\(state\.busy\)/);
  assert.match(guard, /run\.superseded \|\| state\.activeAI !== run/);
  assert.match(request, /animate\(commands\[0\], revision, meta, run\)/);
  assert.match(request, /preparePendingItem\(c, revision, meta, run\)/);
});

test("AI draft bodies move directly without plus handles", () => {
  const app = read("public/app.js"),
    draw = functionSource(app, "drawPending"),
    drawBatch = functionSource(app, "drawPendingBatch"),
    hit = functionSource(app, "pendingHit"),
    begin = functionSource(app, "beginPendingGesture"),
    pendingHit = vm.runInNewContext(`(${hit})`, {
      clientPoint: (event) => event,
      draftBounds: (pending) => pending.box,
      pendingItemBounds: (item) => item.box,
      draftActionPoints: () => ({}),
      pendingCopyable: () => false,
      state: { scale: 1 },
    }),
    grouped = {
      box: { x: 100, y: 100, w: 250, h: 200 },
      selectedIndex: 1,
      items: [
        { box: { x: 100, y: 100, w: 60, h: 50 } },
        { box: { x: 250, y: 200, w: 100, h: 100 } },
      ],
    };

  assert.doesNotMatch(draw, /drawMoveHandle\(/);
  assert.doesNotMatch(drawBatch, /drawMoveHandle\(|drawBatchMoveHandle\(/);
  assert.doesNotMatch(hit, /move-handle|batchMovePoint/);
  assert.match(hit, /frameOuter/);
  assert.match(hit, /frameInner/);
  assert.match(hit, /return \{ hit: "move", itemIndex: index \}/);
  assert.match(begin, /armed:\s*true/);
  assert.doesNotMatch(begin, /setTimeout\(/);
  assert.doesNotMatch(app, /e\.pointerType === "pen" && hit === "move"/);
  assert.deepEqual({ ...pendingHit(grouped, { x: 120, y: 120, pointerType: "mouse" }) }, { hit: "move", itemIndex: 0 });
  assert.deepEqual({ ...pendingHit(grouped, { x: 105, y: 120, pointerType: "mouse" }) }, { hit: "move", itemIndex: 0 });
  assert.deepEqual({ ...pendingHit(grouped, { x: 100, y: 120, pointerType: "mouse" }) }, { hit: "batch-move", itemIndex: null });
  assert.deepEqual({ ...pendingHit(grouped, { x: 200, y: 175, pointerType: "mouse" }) }, { hit: "batch-move", itemIndex: null });
  assert.deepEqual({ ...pendingHit(grouped, { x: 350, y: 300 }) }, { hit: "batch-resize", itemIndex: null });
});

test("AI write_text validates and rasterizes the same 1000 characters", () => {
  const app = read("public/app.js"),
    validate = functionSource(app, "validate"),
    rasterSource = functionSource(app, "textRasterMetrics"),
    imageSource = functionSource(app, "textImage"),
    capture = {},
    raster = vm.runInNewContext(`(${rasterSource})`, {
      AI_TEXT_MAX_LENGTH: 1000,
      SIZE: 20000,
      state: { aiFont: "system-ui" },
      offscreen: () => ({ getContext: () => ({}) }),
      layoutText: (content) => {
        capture.content = content;
        return { lines: [content], widths: [content.length] };
      },
    });

  raster("x".repeat(1100), 24);
  assert.equal(capture.content.length, 1000);
  assert.match(app, /AI_TEXT_MAX_LENGTH = 1000/);
  assert.match(validate, /c\.text = c\.text\.slice\(0, AI_TEXT_MAX_LENGTH\)/);
  assert.match(rasterSource, /maxLength = AI_TEXT_MAX_LENGTH/);
  assert.match(imageSource, /maxLength = AI_TEXT_MAX_LENGTH/);
});

test("AI text and formula drafts expose copy and axis-resize controls", () => {
  const app = read("public/app.js"),
    css = read("public/style.css"),
    zh = read("public/locales/zh.js"),
    points = vm.runInNewContext(`(${functionSource(app, "draftActionPoints")})`, { SIZE: 20000 }),
    copyTextForCommand = vm.runInNewContext(`(${functionSource(app, "copyTextForCommand")})`),
    draw = functionSource(app, "drawPending"),
    drawBatch = functionSource(app, "drawPendingBatch"),
    hit = functionSource(app, "pendingHit"),
    start = functionSource(app, "startPending"),
    prepare = functionSource(app, "preparePendingItem"),
    update = functionSource(app, "updatePendingGesture");
  const box = { x: 100, y: 120, w: 300, h: 180 },
    edge = points({ x: 0, y: 0, w: 300, h: 180 }, 14, true, true),
    radius = 14 * 0.54;

  assert.equal(copyTextForCommand({ tool: "write_text", text: "copy me" }), "copy me");
  assert.equal(copyTextForCommand({ tool: "draw_formula", latex: "x^2" }), "x^2");
  assert.equal(copyTextForCommand({ tool: "plot_function", expression: "x^2" }), null);
  assert.deepEqual(Object.keys(points(box, 14, false, true)).sort(), ["accept", "cancel"]);
  assert.deepEqual(Object.keys(points(box, 14, true, true)).sort(), ["accept", "cancel", "copy"]);
  assert.deepEqual(Object.keys(points(box, 14, false)).sort(), ["item-accept", "item-cancel"]);
  assert.deepEqual(Object.keys(points(box, 14, true)).sort(), ["item-accept", "item-cancel", "item-copy"]);
  assert.equal(points(box, 14, true, true).copy.x, box.x + box.w / 2);
  assert.ok(edge.copy.y > 0 && edge.copy.y >= radius);
  assert.ok(Object.values(edge).every((point) => point.x >= radius && point.x <= 20000 - radius));
  assert.match(draw, /if \(p\.textCommand\) drawTextDraftSurface\(ctx, b\)/);
  assert.match(draw, /drawDraftActions\(ctx, b, s, pendingCopyable\(p\), true\)/);
  assert.match(draw, /b\.x \+ b\.w \+ s \* 0\.08/);
  assert.match(draw, /b\.y \+ b\.h \+ s \* 0\.08/);
  assert.match(drawBatch, /if \(item\.textCommand\) drawTextDraftSurface\(ctx, box, index === p\.selectedIndex\)/);
  assert.match(drawBatch, /drawDraftActions\(ctx, box, s, pendingCopyable\(item\)\)/);
  assert.match(hit, /draftActionPoints\(box, s, pendingCopyable\(p\.items\[index\]\)\)/);
  assert.match(hit, /\.sort\(\(a, b\) => a\.distance - b\.distance \|\| b\.z - a\.z\)/);
  assert.match(start, /copyText = copyTextForCommand\(command\)/);
  assert.match(prepare, /copyText: copyTextForCommand\(c\)/);
  assert.match(update, /p\.scaleX = p\.scaleY = next/);
  assert.match(update, /g\.hit === "width"[\s\S]*?p\.scaleX = Math\.max/);
  assert.match(update, /g\.hit === "height"[\s\S]*?p\.scaleY = Math\.max/);
  assert.match(app, /hit === "copy" \|\| hit === "item-copy"/);
  assert.match(css, /\.clipboard-copy-fallback\s*\{[^}]*left:\s*-10000px/);
  for (const key of ["copyText", "textCopied", "textCopyFailed"]) {
    assert.match(app, new RegExp(`${key}:`));
    assert.match(zh, new RegExp(`${key}:`));
  }
});

test("canvas copy gestures arm on pointerdown and run once on a matching pointerup", () => {
  const app = read("public/app.js"),
    pointerDownStart = app.indexOf('screen.addEventListener("pointerdown"'),
    pointerDownEnd = app.indexOf('screen.addEventListener("pointermove"', pointerDownStart),
    pointerDown = app.slice(pointerDownStart, pointerDownEnd),
    end = functionSource(app, "end"),
    armSource = functionSource(app, "armPendingCopy"),
    matchesSource = functionSource(app, "pendingCopyMatches"),
    finishSource = functionSource(app, "finishPendingCopy");

  assert.match(pointerDown, /armPendingCopy\(e, hit, itemIndex\)/);
  assert.doesNotMatch(pointerDown, /copyPendingText\(itemIndex\)/);
  assert.match(end, /finishPendingCopy\(e\)/);

  function harness() {
    const pending = { copyText: "copy me" },
      state = { pending, pendingGesture: null },
      copied = [],
      context = {
        state,
        clientPoint: (event) => ({ x: event.clientX, y: event.clientY }),
        pendingHit: (_pending, event) => event.releaseHit ?? null,
        copyPendingText: (itemIndex) => {
          copied.push(itemIndex);
          return Promise.resolve(true);
        },
        render: () => {},
        requestRender: () => {},
        setCanvasCursor: () => {},
      };
    context.pendingCopyMatches = vm.runInNewContext(`(${matchesSource})`, context);
    return {
      arm: vm.runInNewContext(`(${armSource})`, context),
      copied,
      finish: vm.runInNewContext(`(${finishSource})`, context),
      pending,
      state,
    };
  }

  const matching = harness();
  matching.arm({ pointerId: 7, clientX: 10, clientY: 20 }, "copy", null);
  assert.deepEqual(matching.copied, []);
  matching.finish({ pointerId: 7, type: "pointerup", clientX: 10, clientY: 20, releaseHit: "copy" });
  matching.finish({ pointerId: 7, type: "pointerup", clientX: 10, clientY: 20, releaseHit: "copy" });
  assert.deepEqual(matching.copied, [null]);

  const cancelled = harness();
  cancelled.arm({ pointerId: 8, clientX: 10, clientY: 20 }, "copy", null);
  cancelled.finish({ pointerId: 8, type: "pointercancel", clientX: 10, clientY: 20, releaseHit: "copy" });
  assert.deepEqual(cancelled.copied, []);

  const outside = harness();
  outside.arm({ pointerId: 9, clientX: 10, clientY: 20 }, "copy", null);
  outside.finish({ pointerId: 9, type: "pointerup", clientX: 200, clientY: 220, releaseHit: null });
  assert.deepEqual(outside.copied, []);

  const replaced = harness();
  replaced.arm({ pointerId: 10, clientX: 10, clientY: 20 }, "copy", null);
  replaced.state.pending = { copyText: "replacement" };
  replaced.finish({ pointerId: 10, type: "pointerup", clientX: 10, clientY: 20, releaseHit: "copy" });
  assert.deepEqual(replaced.copied, []);
});

test("AI text copy uses the original command with an insecure-context fallback and local feedback", () => {
  const app = read("public/app.js"),
    clipboard = functionSource(app, "writeClipboardText"),
    fallback = functionSource(app, "fallbackCopyText"),
    copy = functionSource(app, "copyPendingText"),
    feedback = functionSource(app, "drawCopyFeedback");

  assert.match(clipboard, /navigator\.clipboard\?\.writeText/);
  assert.match(clipboard, /fallbackCopyText\(text\)/);
  assert.match(fallback, /document\.createElement\("textarea"\)/);
  assert.match(fallback, /field\.value = text/);
  assert.match(fallback, /document\.execCommand\?\.\("copy"\)/);
  assert.match(fallback, /field\.remove\(\)/);
  assert.match(copy, /pendingCopyValue\(target\)/);
  assert.doesNotMatch(copy, /\.message|observedText|textContent|innerText/);
  assert.match(copy, /generation = \+\+state\.copyGeneration/);
  assert.match(copy, /if \(!stillPending\(\)\) return copied/);
  assert.match(copy, /setStatusKey\("copyText"\)/);
  assert.match(copy, /target\.copyFeedbackUntil = performance\.now\(\) \+ COPY_FEEDBACK_MS/);
  assert.match(copy, /setStatusKey\("textCopied"\)/);
  assert.match(copy, /target\.copyFeedbackGeneration !== generation/);
  assert.match(feedback, /label = t\("textCopied"\)/);
});

test("clipboard fallback runs before awaiting a native clipboard attempt", async () => {
  const source = functionSource(read("public/app.js"), "writeClipboardText");
  function harness({ fallbackResult, nativePromise }) {
    const calls = [],
      context = {
        debug: () => calls.push("debug"),
        document: { hasFocus: () => true },
        fallbackCopyText: () => {
          calls.push("fallback");
          return fallbackResult;
        },
        navigator: {
          clipboard: {
            writeText: () => {
              calls.push("native");
              return nativePromise;
            },
          },
        },
        window: { isSecureContext: true },
      };
    return { calls, copy: vm.runInNewContext(`(async ${source})`, context) };
  }

  const synchronousFallback = harness({ fallbackResult: true, nativePromise: Promise.resolve() }),
    fallbackResult = synchronousFallback.copy("copy me");
  assert.deepEqual(synchronousFallback.calls, ["fallback"]);
  assert.equal(await fallbackResult, true);

  let resolveNative;
  const acceptedNative = new Promise((resolve) => {
      resolveNative = resolve;
    }),
    secureNative = harness({ fallbackResult: false, nativePromise: acceptedNative }),
    nativeResult = secureNative.copy("copy me");
  assert.deepEqual(secureNative.calls, ["fallback", "native"]);
  resolveNative();
  assert.equal(await nativeResult, true);

  let rejectNative;
  const rejectedNative = new Promise((_, reject) => {
      rejectNative = reject;
    }),
    failed = harness({ fallbackResult: false, nativePromise: rejectedNative }),
    failedResult = failed.copy("copy me");
  assert.deepEqual(failed.calls, ["fallback", "native"]);
  rejectNative(Error("permission denied"));
  assert.equal(await failedResult, false);
  assert.deepEqual(failed.calls, ["fallback", "native", "debug"]);
});

test("AI text copy ignores stale clipboard completions and stale feedback timers", async () => {
  const source = functionSource(read("public/app.js"), "copyPendingText");
  function harness(writeClipboardText) {
    const pending = { copyText: "copy me" },
      state = { pending, copyGeneration: 0, statusKey: "draftReady" },
      statuses = [],
      timers = [];
    return {
      pending,
      state,
      statuses,
      timers,
      copy: vm.runInNewContext(`(async ${source})`, {
        COPY_FEEDBACK_MS: 1600,
        performance: { now: () => 0 },
        pendingTextTarget: (value) => value,
        pendingCopyValue: (value) => value?.copyText,
        requestRender: () => {},
        setStatusKey: (key) => {
          state.statusKey = key;
          statuses.push(key);
        },
        setTimeout: (callback) => {
          timers.push(callback);
        },
        state,
        writeClipboardText,
      }),
    };
  }

  let finishStaleCopy;
  const stale = harness(() => new Promise((resolve) => {
    finishStaleCopy = resolve;
  }));
  const staleResult = stale.copy();
  stale.state.pending = null;
  stale.state.statusKey = "merged";
  finishStaleCopy(true);
  assert.equal(await staleResult, true);
  assert.deepEqual(stale.statuses, ["copyText"]);
  assert.equal(stale.state.statusKey, "merged");
  assert.equal(stale.timers.length, 0);

  const current = harness(async () => true);
  await current.copy();
  const firstTimer = current.timers[0];
  await current.copy();
  const statusesBeforeOldTimer = current.statuses.slice();
  firstTimer();
  assert.deepEqual(current.statuses, statusesBeforeOldTimer);
  assert.equal(current.pending.copyFeedbackGeneration, 2);
});

test("batch drafts paint every body before controls and keep selected controls on top", () => {
  const source = functionSource(read("public/app.js"), "drawPendingBatch"),
    events = [],
    context = {
      beginPath() {},
      clip() {},
      drawImage(image) {
        events.push(`body:${image.id}`);
      },
      lineTo() {},
      moveTo() {},
      rect() {},
      restore() {},
      save() {},
      setLineDash() {},
      stroke() {},
      strokeRect() {
        events.push("frame");
      },
    },
    draw = vm.runInNewContext(`(${source})`, {
      batchBounds: () => ({ x: 0, y: 0, w: 300, h: 180 }),
      ctx: context,
      drawCopyFeedback: (_ctx, box) => events.push(`feedback:${box.id}`),
      drawDraftActions: (_ctx, box) => events.push(`actions:${box.id}`),
      drawResizeHandle: () => {},
      drawTextDraftSurface: (_ctx, box) => events.push(`surface:${box.id}`),
      pendingItemBounds: (item) => item.box,
      pendingCopyable: (item) => Boolean(item.textCommand),
      state: { scale: 1 },
    }),
    pending = {
      selectedIndex: 0,
      items: [
        { box: { id: 0, x: 0, y: 0, w: 180, h: 120 }, image: { id: 0, width: 180, height: 120 }, scaleX: 1, scaleY: 1, textCommand: { text: "first" } },
        { box: { id: 1, x: 60, y: 30, w: 180, h: 120 }, image: { id: 1, width: 180, height: 120 }, scaleX: 1, scaleY: 1, textCommand: { text: "second" } },
      ],
    };

  draw(pending);
  const firstAction = Math.min(events.indexOf("actions:0"), events.indexOf("actions:1")),
    lastBody = Math.max(events.indexOf("body:0"), events.indexOf("body:1"));
  assert.ok(firstAction > lastBody);
  assert.ok(events.indexOf("actions:1") < events.indexOf("actions:0"));
  assert.ok(events.indexOf("feedback:1") < events.indexOf("feedback:0"));
});

test("batch draft action controls provide a 44px touch target", () => {
  const app = read("public/app.js"),
    points = vm.runInNewContext(`(${functionSource(app, "draftActionPoints")})`, { SIZE: 20000 }),
    hit = vm.runInNewContext(`(${functionSource(app, "pendingHit")})`, {
      clientPoint: (event) => event,
      draftActionPoints: points,
      draftBounds: (pending) => pending.box,
      pendingItemBounds: (item) => item.box,
      pendingCopyable: (item) => Boolean(item.copyText || item.textCommand?.text),
      state: { scale: 1 },
    }),
    box = { x: 100, y: 120, w: 300, h: 180 },
    pending = { box, selectedIndex: 0, items: [{ box, textCommand: { text: "copy" } }] },
    copy = points(box, 14, true)["item-copy"];

  assert.deepEqual({ ...hit(pending, { x: copy.x + 20, y: copy.y, pointerType: "touch" }) }, { hit: "item-copy", itemIndex: 0 });
  assert.equal(hit(pending, { x: copy.x + 20, y: copy.y, pointerType: "mouse" }), null);
});

test("a multi-tool AI draft has one uniform group corner resize", () => {
  const app = read("public/app.js"),
    drawBatch = functionSource(app, "drawPendingBatch"),
    hit = functionSource(app, "pendingHit"),
    resize = vm.runInNewContext(`(${functionSource(app, "resizePendingBatchItems")})`, { SELECT: selectionMath }),
    items = [
      { x: 100, y: 100, scaleX: 1, scaleY: 1 },
      { x: 300, y: 200, scaleX: 0.5, scaleY: 2 },
    ],
    starts = items.map((item) => ({ ...item })),
    startBox = { x: 100, y: 100, w: 300, h: 300 };

  assert.match(drawBatch, /drawResizeHandle\(ctx, batch, s\)/);
  assert.match(hit, /addControl\("batch-resize",\s*\{ x: b\.x \+ b\.w, y: b\.y \+ b\.h \}/);
  const target = resize(items, startBox, starts, { x: 700, y: 700 }, 40, 1000);
  assert.deepEqual({ ...target }, { x: 100, y: 100, w: 600, h: 600 });
  assert.deepEqual(items.map((item) => ({ ...item })), [
    { x: 100, y: 100, scaleX: 2, scaleY: 2 },
    { x: 500, y: 300, scaleX: 1, scaleY: 4 },
  ]);
  const bounded = resize(items, target, items.map((item) => ({ ...item })), { x: 5000, y: 5000 }, 40, 800);
  assert.ok(bounded.x + bounded.w <= 800 && bounded.y + bounded.h <= 800);
});
