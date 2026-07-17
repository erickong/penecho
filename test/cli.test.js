"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Writable } = require("node:stream");

const {
  apiConfigurationIssues,
  helpText,
  main,
  parseArgs,
  promptApiConfiguration,
  resolveConfiguration,
  runClaudePreflight,
  runCodexPreflight,
  runDoctor,
} = require("../cli.js");

const ROOT = path.resolve(__dirname, "..");

function temporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "penecho-cli-test-"));
  test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function capture() {
  let value = "";
  return {
    stream: new Writable({ write(chunk, _encoding, callback) { value += chunk.toString("utf8"); callback(); } }),
    text: () => value,
  };
}

function isolatedConfiguration(args = parseArgs([]), overrides = {}) {
  const directory = temporaryDirectory(), home = path.join(directory, "home"), cwd = path.join(directory, "cwd"), packageRoot = path.join(directory, "package");
  for (const item of [home, cwd, packageRoot]) fs.mkdirSync(item, { recursive: true });
  return resolveConfiguration(args, { env: overrides, home, cwd, packageRoot });
}

test("parses provider, doctor, and port options", () => {
  assert.deepEqual(parseArgs(["--api", "--port", "4000"]), { command: "start", provider: "api", port: 4000, help: false, version: false });
  assert.deepEqual(parseArgs(["doctor", "--codex", "--port=0"]), { command: "doctor", provider: "codex-cli", port: 0, help: false, version: false });
  assert.deepEqual(parseArgs(["doctor", "--claude"]), { command: "doctor", provider: "claude-cli", port: null, help: false, version: false });
  assert.throws(() => parseArgs(["--api", "--codex"]), /cannot be used together/);
  assert.throws(() => parseArgs(["--codex", "--claude"]), /cannot be used together/);
  assert.throws(() => parseArgs(["--port", "65536"]), /0 to 65535/);
  assert.throws(() => parseArgs(["--unknown"]), /Unknown option/);
});

test("configuration precedence is environment, cwd, user config, then package config", () => {
  const directory = temporaryDirectory(), home = path.join(directory, "home"), cwd = path.join(directory, "cwd"), packageRoot = path.join(directory, "package"), stateDir = path.join(home, ".penecho");
  for (const item of [stateDir, cwd, packageRoot]) fs.mkdirSync(item, { recursive: true });
  fs.writeFileSync(path.join(packageRoot, ".env"), "OPENAI_MODEL=package\nOPENAI_API_URL=https://package.test/v1\n");
  fs.writeFileSync(path.join(stateDir, "config.env"), "OPENAI_MODEL=home\n");
  fs.writeFileSync(path.join(cwd, ".env"), "OPENAI_MODEL=cwd\n");
  const configuration = resolveConfiguration(parseArgs(["--api", "--port", "4000"]), { env: { OPENAI_MODEL: "environment" }, home, cwd, packageRoot });
  assert.equal(configuration.env.OPENAI_MODEL, "environment");
  assert.equal(configuration.env.OPENAI_API_URL, "https://package.test/v1");
  assert.equal(configuration.env.AI_PROVIDER, "api");
  assert.equal(configuration.port, 4000);
});

test("API start never prompts and points incomplete configuration to doctor", async () => {
  const output = capture(), errors = capture();
  let started = false;
  const code = await main(["--api"], {
    env: {}, home: temporaryDirectory(), cwd: temporaryDirectory(), packageRoot: temporaryDirectory(),
    output: output.stream, errorOutput: errors.stream,
    startServer: async () => { started = true; },
  });
  assert.equal(code, 1);
  assert.equal(started, false);
  assert.match(errors.text(), /penecho doctor --api/);
  assert.equal(output.text(), "");
});

test("API configuration requires the single supported key", () => {
  assert.deepEqual(apiConfigurationIssues({ OPENAI_PRO_API_KEY:"legacy", AI_API_URL:"https://example.test/v1", AI_API_MODEL:"test-model" }), ["AI_API_KEY"]);
});

test("legacy OPENAI API names remain valid for existing installations", () => {
  assert.deepEqual(apiConfigurationIssues({ OPENAI_API_KEY:"test-key", OPENAI_API_URL:"https://example.test/v1", OPENAI_MODEL:"test-model", OPENAI_API_FORMAT:"openai" }), []);
});

test("API image format accepts WebP, PNG, JPEG, and the JPG alias", () => {
  const base={AI_API_KEY:"test-key",AI_API_URL:"https://example.test/v1",AI_API_MODEL:"test-model"};
  for(const format of [undefined,"webp","png","jpeg","jpg"]){
    assert.deepEqual(apiConfigurationIssues({...base,...(format?{PENECHO_AI_IMAGE_FORMAT:format}:{})}),[]);
  }
  assert.deepEqual(apiConfigurationIssues({...base,PENECHO_AI_IMAGE_FORMAT:"gif"}),["PENECHO_AI_IMAGE_FORMAT"]);
  for (const effort of [undefined, "low", "medium", "high", "xhigh", "max", "future-model-level"]) assert.deepEqual(apiConfigurationIssues({ ...base, ...(effort ? { AI_EFFORT:effort } : {}) }), []);
});

test("API doctor saves hidden credentials without printing them", async () => {
  const configuration = isolatedConfiguration(parseArgs(["doctor", "--api"]), { AI_PROVIDER: "api", PORT: "4000" }), output = capture();
  const secret = "sk-test-secret-that-must-not-echo";
  await promptApiConfiguration(configuration, {
    output: output.stream,
    prompt: {
      interactive: true,
      ask: async (label, fallback) => label === "Model" ? "test-model" : fallback,
      askHidden: async () => secret,
    },
  });
  const saved = fs.readFileSync(configuration.configFile, "utf8");
  assert.match(saved, /AI_API_FORMAT=openai/);
  assert.match(saved, /AI_API_MODEL=test-model/);
  assert.match(saved, /AI_EFFORT=max/);
  assert.doesNotMatch(saved, /OPENAI_(?:API_)?/);
  assert.match(saved, new RegExp(secret));
  assert.doesNotMatch(output.text(), new RegExp(secret));
  assert.deepEqual(apiConfigurationIssues(configuration.env), []);
});

test("API doctor lists known efforts and accepts model-specific strings", async () => {
  const configuration = isolatedConfiguration(parseArgs(["doctor", "--api"]), { AI_PROVIDER:"api", PORT:"4000" }), labels=[];
  await promptApiConfiguration(configuration, {
    output:capture().stream,
    prompt:{
      interactive:true,
      ask:async (label, fallback) => { labels.push(label); return label === "Model" ? "future-model" : label.startsWith("Reasoning effort") ? "future-model-level" : fallback; },
      askHidden:async () => "sk-custom-effort",
    },
  });
  const label=labels.find(value=>value.startsWith("Reasoning effort")) || "";
  assert.match(label, /low, medium, high, xhigh, max/);
  assert.match(label, /other model-specific strings are allowed/);
  assert.match(fs.readFileSync(configuration.configFile, "utf8"), /^AI_EFFORT=future-model-level$/m);
});

test("Codex preflight checks version and login status only", async () => {
  const directory = temporaryDirectory(), fakeCli = path.join(directory, "fake-codex.js"), calls = path.join(directory, "calls.txt");
  fs.writeFileSync(fakeCli, `const fs=require("fs");const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(calls)},args.join(" ")+"\\n");if(args[0]==="--version"){console.log("codex-cli test");process.exit(0)}if(args[0]==="login"&&args[1]==="status"){console.log("Logged in");process.exit(0)}process.exit(9);\n`);
  const configuration = isolatedConfiguration(parseArgs(["--codex"]), { AI_PROVIDER: "codex-cli", CODEX_CLI_PATH: fakeCli, PATH: process.env.PATH });
  const result = await runCodexPreflight(configuration);
  assert.equal(result.ok, true);
  assert.match(result.version, /codex-cli test/);
  assert.deepEqual(fs.readFileSync(calls, "utf8").trim().split(/\r?\n/), ["--version", "login status"]);
});

test("Codex preflight reports login failure", async () => {
  const configuration = isolatedConfiguration(parseArgs(["--codex"]), { AI_PROVIDER: "codex-cli", CODEX_CLI_PATH: path.join(temporaryDirectory(), "missing-codex") });
  const result = await runCodexPreflight(configuration);
  assert.equal(result.ok, false);
  assert.match(result.error, /not found|not a file/i);
});

test("Claude preflight checks version and auth status only", async () => {
  const directory = temporaryDirectory(), fakeCli = path.join(directory, "fake-claude.js"), calls = path.join(directory, "calls.txt");
  fs.writeFileSync(fakeCli, `const fs=require("fs");const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(calls)},args.join(" ")+"\\n");if(args[0]==="--version"){console.log("claude-cli test");process.exit(0)}if(args[0]==="auth"&&args[1]==="status"){console.log('{"loggedIn":true}');process.exit(0)}process.exit(9);\n`);
  const configuration = isolatedConfiguration(parseArgs(["--claude"]), { AI_PROVIDER:"claude-cli", CLAUDE_CLI_PATH:fakeCli, PATH:process.env.PATH });
  const result = await runClaudePreflight(configuration);
  assert.equal(result.ok, true);
  assert.match(result.version, /claude-cli test/);
  assert.deepEqual(fs.readFileSync(calls, "utf8").trim().split(/\r?\n/), ["--version", "auth status"]);
});

test("Codex doctor makes no inference request", async () => {
  const output = capture(), configuration = resolveConfiguration(parseArgs(["doctor", "--codex"]), {
    env: { AI_PROVIDER: "codex-cli", PORT: "3888", PATH: process.env.PATH }, home: temporaryDirectory(), cwd: ROOT, packageRoot: ROOT,
  });
  const calls = [];
  const ready = await runDoctor(parseArgs(["doctor", "--codex"]), configuration, {
    output: output.stream,
    errorOutput: capture().stream,
    portChecker: async () => ({ ok: true }),
    runner: async (_launch, args) => { calls.push(args.join(" ")); return { code: 0, stdout: args[0] === "--version" ? "codex-cli test\n" : "Logged in\n", stderr: "" }; },
  });
  assert.equal(ready, true);
  assert.deepEqual(calls, ["--version", "login status"]);
  assert.doesNotMatch(calls.join(" "), /exec/);
  assert.match(output.text(), /no model request was made/);
});

test("Claude doctor makes no inference request", async () => {
  const output = capture(), configuration = resolveConfiguration(parseArgs(["doctor", "--claude"]), {
    env:{ AI_PROVIDER:"claude-cli", PORT:"3888", PATH:process.env.PATH }, home:temporaryDirectory(), cwd:ROOT, packageRoot:ROOT,
  }), calls=[];
  const ready = await runDoctor(parseArgs(["doctor", "--claude"]), configuration, {
    output:output.stream,
    errorOutput:capture().stream,
    portChecker:async () => ({ ok:true }),
    runner:async (_launch, args) => { calls.push(args.join(" ")); return { code:0, stdout:args[0] === "--version" ? "claude-cli test\n" : '{"loggedIn":true}\n', stderr:"" }; },
  });
  assert.equal(ready, true);
  assert.deepEqual(calls, ["--version", "auth status"]);
  assert.match(output.text(), /no model request was made/);
});

test("help documents all public commands", () => {
  const help = helpText();
  assert.match(help, /penecho --api/);
  assert.match(help, /penecho --codex/);
  assert.match(help, /penecho --claude/);
  assert.match(help, /penecho doctor/);
  assert.match(help, /--port/);
});
