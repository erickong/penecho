"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const WEB = require("../web-mode.js");

const ROOT = path.join(__dirname, "..");
const DOC = "<!doctype html>\n<html><head><style>body{margin:0}</style></head><body><h1>Hi</h1></body></html>";

test("extractHtmlDocument accepts a plain document and trims surrounding prose", () => {
  assert.equal(WEB.extractHtmlDocument(DOC), DOC);
  assert.equal(WEB.extractHtmlDocument(`Here is your page:\n${DOC}\nLet me know!`), DOC);
  const noDoctype = "<html><body>x</body></html>";
  assert.equal(WEB.extractHtmlDocument(`prefix ${noDoctype}`), noDoctype);
});

test("extractHtmlDocument unwraps fenced blocks and rejects non-documents", () => {
  assert.equal(WEB.extractHtmlDocument("```html\n" + DOC + "\n```"), DOC);
  assert.equal(WEB.extractHtmlDocument("just some text"), null);
  assert.equal(WEB.extractHtmlDocument("<div>fragment</div>"), null);
  assert.equal(WEB.extractHtmlDocument(""), null);
  assert.equal(WEB.extractHtmlDocument("<html> no closing tag"), null);
});

test("buildWebPrompt shapes generate and edit requests", () => {
  const generated = WEB.buildWebPrompt({ mode: "generate", instruction: "a coffee shop landing page", languageName: "Russian" });
  assert.match(generated.system, /Return ONLY one complete standalone HTML document/);
  assert.match(generated.system, /Do not include JavaScript/);
  assert.match(generated.system, /Write the page copy in Russian/);
  assert.match(generated.prompt, /a coffee shop landing page/);
  const edited = WEB.buildWebPrompt({ mode: "edit", instruction: "make the title red", html: DOC, selector: "h1", selectedHtml: "<h1>Hi</h1>", languageName: null });
  assert.match(edited.prompt, /current page document/);
  assert.match(edited.prompt, /`h1`/);
  assert.match(edited.prompt, /<h1>Hi<\/h1>/);
  assert.match(edited.prompt, /FULL updated document/);
  assert.match(edited.system, /language of the instruction/);
});

test("validWebPayload enforces modes, sizes, and required fields", () => {
  assert.equal(WEB.validWebPayload({ mode: "generate", instruction: "hello" }), true);
  assert.equal(WEB.validWebPayload({ mode: "edit", instruction: "x", html: DOC, selector: "h1", selectedHtml: "<h1>Hi</h1>" }), true);
  assert.equal(WEB.validWebPayload({ mode: "edit", instruction: "x" }), false);
  assert.equal(WEB.validWebPayload({ mode: "generate", instruction: "x", html: DOC }), false);
  assert.equal(WEB.validWebPayload({ mode: "generate", instruction: "" }), false);
  assert.equal(WEB.validWebPayload({ mode: "other", instruction: "x" }), false);
  assert.equal(WEB.validWebPayload({ mode: "generate", instruction: "y".repeat(WEB.MAX_WEB_INSTRUCTION + 1) }), false);
  assert.equal(WEB.validWebPayload({ mode: "edit", instruction: "x", html: "z".repeat(WEB.MAX_WEB_HTML + 1) }), false);
  assert.equal(WEB.validWebPayload({ mode: "generate", instruction: "x", selector: 5 }), false);
  assert.equal(WEB.validWebPayload(null), false);
});

test("the web mode is wired into the client and server", () => {
  const app = fs.readFileSync(path.join(ROOT, "public", "app.js"), "utf8"),
    html = fs.readFileSync(path.join(ROOT, "public", "index.html"), "utf8"),
    server = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
  // Превью рендерится без выполнения скриптов: sandbox без allow-scripts.
  assert.match(html, /<iframe id="webFrame" sandbox="allow-same-origin"/);
  assert.match(html, /id="modeWebBtn"/);
  assert.match(app, /fetch\("\/api\/ai\/web"/);
  assert.match(app, /localStorage\.setItem\("penecho-web-html", html\)/);
  assert.match(server, /url\.pathname === "\/api\/ai\/web"/);
  assert.match(server, /validWebPayload\(body\)/);
  assert.match(server, /extractHtmlDocument\(content\)/);
  // Веб-эндпоинт в CLI-режимах защищён так же, как канвасный.
  const webBlock = server.slice(server.indexOf('url.pathname === "/api/ai/web"'), server.indexOf('url.pathname === "/api/debug/log"'));
  assert.match(webBlock, /isLanClient\(ip\)/);
  assert.match(webBlock, /browserRequestError\(req\)/);
  // Превью отдаётся сервером со своей CSP: инлайновые стили работают, скрипты запрещены.
  assert.match(server, /"\/api\/ai\/web\/preview"/);
  assert.match(server, /WEB_PREVIEW_CSP = "default-src 'none'; style-src 'unsafe-inline'/);
  assert.match(app, /fetch\("\/api\/ai\/web\/preview"/);
});
