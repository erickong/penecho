"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { buildClaudeArgs, callClaudeCli, claudeInput, claudeResult, sanitizeClaudeEnv } = require("../claude-cli.js");

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function temporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "penecho-claude-test-"));
  test.after(() => fs.rmSync(directory, { recursive:true, force:true }));
  return directory;
}

test("Claude CLI arguments select one non-interactive image-analysis turn", () => {
  const args = buildClaudeArgs({ systemPrompt:"system instructions", model:"sonnet", effort:"max" });
  assert.deepEqual(args.slice(0, 5), ["-p", "--input-format", "stream-json", "--output-format", "stream-json"]);
  assert.ok(args.includes("--verbose"));
  assert.equal(args[args.indexOf("--tools") + 1], "");
  assert.equal(args[args.indexOf("--system-prompt") + 1], "system instructions");
  assert.equal(args[args.indexOf("--model") + 1], "sonnet");
  assert.equal(args[args.indexOf("--effort") + 1], "max");
  for (const flag of ["--no-session-persistence", "--safe-mode", "--disable-slash-commands", "--strict-mcp-config", "--no-chrome"]) assert.ok(args.includes(flag));
});

test("leaves Claude effort unset when the global value is empty", () => {
  const args = buildClaudeArgs({ systemPrompt:"system instructions", model:null, effort:null });
  assert.equal(args.includes("--effort"), false);
});

test("Claude CLI input carries text and the canvas image in one streaming user message", () => {
  const payload = JSON.parse(claudeInput("request metadata", PNG));
  assert.equal(payload.type, "user");
  assert.equal(payload.message.content[0].text, "request metadata");
  assert.equal(payload.message.content[1].source.media_type, "image/png");
  assert.match(payload.message.content[1].source.data, /^[A-Za-z0-9+/]+=*$/);
});

test("Claude CLI child environment keeps login context but removes API credentials", () => {
  const clean = sanitizeClaudeEnv({ PATH:"bin", HOME:"home", CLAUDE_CODE_OAUTH_TOKEN:"login-token", AI_API_KEY:"secret", OPENAI_API_KEY:"legacy-secret", ANTHROPIC_API_KEY:"anthropic-secret", UNRELATED_SECRET:"private" });
  assert.equal(clean.PATH, "bin");
  assert.equal(clean.HOME, "home");
  assert.equal(clean.CLAUDE_CODE_OAUTH_TOKEN, "login-token");
  for (const name of ["AI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "UNRELATED_SECRET"]) assert.equal(clean[name], undefined);
  assert.equal(clean.CLAUDE_CODE_SKIP_PROMPT_HISTORY, "1");
});

test("Claude CLI JSON result parsing accepts text and structured output", () => {
  assert.equal(claudeResult(JSON.stringify({ type:"result", subtype:"success", result:"{\"commands\":[]}" })), '{"commands":[]}');
  assert.equal(claudeResult(`${JSON.stringify({ type:"system", subtype:"init" })}\n${JSON.stringify({ type:"result", subtype:"success", result:"{\"commands\":[]}" })}`), '{"commands":[]}');
  assert.equal(claudeResult(JSON.stringify({ type:"result", subtype:"success", structured_output:{ commands:[] } })), '{"commands":[]}');
  assert.throws(() => claudeResult("not-json"), /invalid JSON/);
  assert.throws(() => claudeResult(JSON.stringify({ type:"result", subtype:"error" })), /did not complete/);
});

test("Claude CLI adapter sends the image, system prompt, model, and no API key", async () => {
  const directory = temporaryDirectory(), fakeCli = path.join(directory, "fake-claude.js"), record = path.join(directory, "record.json");
  fs.writeFileSync(fakeCli, `"use strict";const fs=require("node:fs");const args=process.argv.slice(2),input=JSON.parse(fs.readFileSync(0,"utf8").trim()),systemIndex=args.indexOf("--system-prompt"),systemPrompt=args[systemIndex+1],image=input.message.content.find(part=>part.type==="image");fs.writeFileSync(${JSON.stringify(record)},JSON.stringify({args,systemPrompt,mediaType:image?.source?.media_type,hasImage:Boolean(image?.source?.data)}));const result={intent:"answer",observedText:"image",message:process.env.AI_API_KEY?"leaked":"ok",commands:[]};process.stdout.write(JSON.stringify({type:"result",subtype:"success",result:JSON.stringify(result)}));\n`);
  const content = await callClaudeCli({ executable:fakeCli, model:"sonnet", systemPrompt:"system instructions", prompt:"request metadata", atlasImage:PNG, env:{ ...process.env, AI_API_KEY:"must-not-leak" } });
  const result = JSON.parse(content), saved = JSON.parse(fs.readFileSync(record, "utf8"));
  assert.equal(result.message, "ok");
  assert.equal(saved.systemPrompt, "system instructions");
  assert.equal(saved.mediaType, "image/png");
  assert.equal(saved.hasImage, true);
  assert.equal(saved.args[saved.args.indexOf("--model") + 1], "sonnet");
});

test("Claude CLI abort stops the process and discards its output", async () => {
  const directory = temporaryDirectory(), fakeCli = path.join(directory, "fake-claude.js"), marker = path.join(directory, "started.txt");
  fs.writeFileSync(fakeCli, `"use strict";const fs=require("node:fs");fs.writeFileSync(${JSON.stringify(marker)},process.cwd());process.stdout.write('{"type":"result","subtype":"success","result":"');setInterval(()=>process.stdout.write('stale'),10);\n`);
  const controller = new AbortController(), request = callClaudeCli({ executable:fakeCli, systemPrompt:"system", prompt:"wait", atlasImage:PNG, signal:controller.signal });
  const deadline = Date.now() + 5000;
  while (!fs.existsSync(marker) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(fs.existsSync(marker));
  const workDir = fs.readFileSync(marker, "utf8");
  controller.abort();
  await assert.rejects(request, error => error?.name === "AbortError");
  assert.equal(fs.existsSync(workDir), false);
});
