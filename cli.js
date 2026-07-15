#!/usr/bin/env node
"use strict";

const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const readline = require("readline/promises");
const { spawn } = require("child_process");
const { Writable } = require("stream");
const { resolveCodexLaunch } = require("./codex-cli.js");

const PACKAGE_ROOT = __dirname;
const PACKAGE_JSON = require("./package.json");
const DEFAULT_PORT = 3888;
const MAX_COMMAND_OUTPUT = 1024 * 1024;
const REQUIRED_ASSETS = ["server.js", "codex-cli.js", "public/index.html", "public/app.js", "public/draw.js", "public/style.css"];

function parsePort(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) throw new Error("--port must be an integer from 0 to 65535.");
  const port = Number(text);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("--port must be an integer from 0 to 65535.");
  return port;
}

function parseArgs(argv = []) {
  const result = { command: "start", provider: null, port: null, help: false, version: false };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "doctor") {
      if (result.command === "doctor") throw new Error("The doctor command may only be specified once.");
      result.command = "doctor";
    } else if (argument === "--api") {
      if (result.provider && result.provider !== "api") throw new Error("--api and --codex cannot be used together.");
      result.provider = "api";
    } else if (argument === "--codex") {
      if (result.provider && result.provider !== "codex-cli") throw new Error("--api and --codex cannot be used together.");
      result.provider = "codex-cli";
    } else if (argument === "--port") {
      if (index + 1 >= argv.length) throw new Error("--port requires a value.");
      result.port = parsePort(argv[++index]);
    } else if (argument.startsWith("--port=")) {
      result.port = parsePort(argument.slice("--port=".length));
    } else if (argument === "--help" || argument === "-h") {
      result.help = true;
    } else if (argument === "--version" || argument === "-v") {
      result.version = true;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      throw new Error(`Unknown command: ${argument}`);
    }
  }
  return result;
}

function parseEnvText(text) {
  const values = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (!match) continue;
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"')) {
      try { value = JSON.parse(value); } catch { value = value.slice(1, -1); }
    } else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

function loadEnvFile(file) {
  try { return parseEnvText(fs.readFileSync(file, "utf8")); } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function normalizeProvider(value) {
  const provider = String(value || "api").trim().toLowerCase();
  if (provider === "api") return "api";
  if (provider === "codex" || provider === "codex-cli") return "codex-cli";
  return null;
}

function resolveConfiguration(args, options = {}) {
  const sourceEnv = options.env || process.env,
    cwd = path.resolve(options.cwd || process.cwd()),
    home = path.resolve(options.home || os.homedir()),
    packageRoot = path.resolve(options.packageRoot || PACKAGE_ROOT),
    stateDir = sourceEnv.PENECHO_STATE_DIR ? path.resolve(cwd, sourceEnv.PENECHO_STATE_DIR) : path.join(home, ".penecho");
  const env = {
    ...loadEnvFile(path.join(packageRoot, ".env")),
    ...loadEnvFile(path.join(stateDir, "config.env")),
    ...loadEnvFile(path.join(cwd, ".env")),
    ...sourceEnv,
  };
  if (args.provider) env.AI_PROVIDER = args.provider;
  if (args.port !== null) env.PORT = String(args.port);
  env.PENECHO_STATE_DIR = stateDir;
  return {
    env,
    cwd,
    home,
    packageRoot,
    stateDir,
    configFile: path.join(stateDir, "config.env"),
    provider: normalizeProvider(env.AI_PROVIDER),
    port: env.PORT === undefined || env.PORT === "" ? DEFAULT_PORT : parsePort(env.PORT),
  };
}

function isPlaceholder(value) {
  return /^(?:your[_ -]|replace[_ -]|changeme|api[_ -]?key|sk-\.{3})/i.test(String(value || "").trim());
}

function apiConfigurationIssues(env) {
  const issues = [], key = String(env.OPENAI_API_KEY || env.OPENAI_PRO_API_KEY || "").trim(), model = String(env.OPENAI_MODEL || "").trim(), apiUrl = String(env.OPENAI_API_URL || "").trim();
  if (!key || isPlaceholder(key)) issues.push("OPENAI_API_KEY");
  if (!model || isPlaceholder(model)) issues.push("OPENAI_MODEL");
  if (!apiUrl || isPlaceholder(apiUrl)) issues.push("OPENAI_API_URL");
  else {
    try {
      const parsed = new URL(apiUrl);
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) issues.push("OPENAI_API_URL");
    } catch { issues.push("OPENAI_API_URL"); }
  }
  if (env.OPENAI_API_FORMAT && !["openai", "anthropic"].includes(String(env.OPENAI_API_FORMAT).trim().toLowerCase())) issues.push("OPENAI_API_FORMAT");
  return [...new Set(issues)];
}

function runCaptured(launch, args, options = {}) {
  const timeoutMs = options.timeoutMs || 8000;
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(launch.command, [...launch.prefixArgs, ...args], {
        cwd: options.cwd || process.cwd(), env: options.env || process.env,
        stdio: ["ignore", "pipe", "pipe"], windowsHide: true, shell: false,
      });
    } catch (error) { reject(error); return; }
    let stdout = "", stderr = "", overflow = false, settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch {}
      reject(new Error(`Command timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
    const capture = (target) => chunk => {
      if (overflow) return;
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) + chunk.length > MAX_COMMAND_OUTPUT) {
        overflow = true;
        try { child.kill(); } catch {}
        return;
      }
      if (target === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
    };
    child.stdout.on("data", capture("stdout"));
    child.stderr.on("data", capture("stderr"));
    child.once("error", error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (overflow) reject(new Error("Command produced too much output."));
      else resolve({ code, stdout, stderr });
    });
  });
}

async function runCodexPreflight(configuration, options = {}) {
  const runner = options.runner || runCaptured;
  let launch;
  try { launch = resolveCodexLaunch(configuration.env.CODEX_CLI_PATH || "codex", configuration.env); }
  catch (error) { return { ok: false, error: error.message }; }
  try {
    const version = await runner(launch, ["--version"], { cwd: configuration.cwd, env: configuration.env, timeoutMs: 8000 });
    if (version.code !== 0) return { ok: false, error: "Codex CLI could not report its version." };
    const login = await runner(launch, ["login", "status"], { cwd: configuration.cwd, env: configuration.env, timeoutMs: 8000 });
    if (login.code !== 0) return { ok: false, error: "Codex CLI is not logged in. Run `codex login`." };
    return { ok: true, version: (version.stdout || version.stderr).trim().split(/\r?\n/, 1)[0] || "Codex CLI" };
  } catch (error) { return { ok: false, error: `Codex CLI check failed: ${error.message}` }; }
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split(".", 1)[0]);
  return Number.isInteger(major) && major >= 18;
}

function checkAssets(packageRoot = PACKAGE_ROOT) {
  return REQUIRED_ASSETS.filter(relative => {
    try { return !fs.statSync(path.join(packageRoot, relative)).isFile(); } catch { return true; }
  });
}

function checkPortAvailable(port, host = "0.0.0.0") {
  return new Promise(resolve => {
    const server = net.createServer();
    server.unref();
    server.once("error", error => resolve({ ok: false, error: error.code || error.message }));
    server.listen({ port, host, exclusive: true }, () => server.close(error => resolve(error ? { ok: false, error: error.message } : { ok: true })));
  });
}

function serializeEnvValue(value) {
  const text = String(value ?? "");
  return /^[A-Za-z0-9_./:@+\-=]+$/.test(text) ? text : JSON.stringify(text);
}

function writeConfigFile(file, values) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const lines = Object.keys(values).sort().map(key => `${key}=${serializeEnvValue(values[key])}`), temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, file);
  try { fs.chmodSync(file, 0o600); } catch (error) { if (process.platform !== "win32") throw error; }
}

function createPromptIo(input = process.stdin, output = process.stdout) {
  return {
    interactive: Boolean(input.isTTY && output.isTTY),
    async ask(label, defaultValue = "") {
      const terminal = readline.createInterface({ input, output });
      try {
        const suffix = defaultValue ? ` [${defaultValue}]` : "";
        const answer = await terminal.question(`${label}${suffix}: `);
        return answer.trim() || defaultValue;
      } finally { terminal.close(); }
    },
    async askHidden(label) {
      const sink = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
      output.write(`${label}: `);
      const terminal = readline.createInterface({ input, output: sink, terminal: Boolean(input.isTTY) });
      try { return (await terminal.question("")).trim(); }
      finally { terminal.close(); output.write("\n"); }
    },
  };
}

async function promptApiConfiguration(configuration, options = {}) {
  const prompt = options.prompt || createPromptIo(), output = options.output || process.stdout;
  if (!prompt.interactive && !options.allowNonInteractive) throw new Error("Interactive setup requires a terminal.");
  output.write(`PenEcho will save API configuration to:\n  ${configuration.configFile}\n`);
  output.write("The API key is stored locally in plaintext and will not be displayed. PenEcho sets owner-only permissions on POSIX systems; protect this file as a credential.\n\n");
  const apiUrl = await prompt.ask("API base URL", configuration.env.OPENAI_API_URL || "https://api.openai.com/v1"),
    model = await prompt.ask("Model", configuration.env.OPENAI_MODEL || "gpt-4o-mini"),
    apiKey = await prompt.askHidden("API key (hidden)");
  if (!apiKey) throw new Error("API key cannot be empty.");
  for (const [name, value] of Object.entries({ OPENAI_API_URL: apiUrl, OPENAI_MODEL: model, OPENAI_API_KEY: apiKey })) {
    if (/\r|\n|\0/.test(value)) throw new Error(`${name} contains invalid characters.`);
  }
  const saved = {
    ...loadEnvFile(configuration.configFile),
    AI_PROVIDER: "api",
    HOST: configuration.env.HOST || "0.0.0.0",
    PORT: String(configuration.port),
    OPENAI_API_KEY: apiKey,
    OPENAI_API_URL: apiUrl,
    OPENAI_MODEL: model,
  };
  writeConfigFile(configuration.configFile, saved);
  Object.assign(configuration.env, saved);
  output.write(`API configuration saved to ${configuration.configFile}.\n`);
  return saved;
}

async function runDoctor(args, configuration, options = {}) {
  const output = options.output || process.stdout, errorOutput = options.errorOutput || process.stderr;
  let ready = true;
  const report = (ok, message) => { output.write(`[${ok ? "ok" : "fail"}] ${message}\n`); if (!ok) ready = false; };
  report(checkNodeVersion(), `Node.js ${process.versions.node} (18+ required)`);
  const missingAssets = checkAssets(configuration.packageRoot);
  report(missingAssets.length === 0, missingAssets.length ? `Missing PenEcho assets: ${missingAssets.join(", ")}` : "PenEcho assets are present");
  const port = await (options.portChecker || checkPortAvailable)(configuration.port, configuration.env.HOST || "0.0.0.0");
  report(port.ok, port.ok ? `Port ${configuration.port} is available` : `Port ${configuration.port} is unavailable (${port.error})`);

  if (!configuration.provider) {
    report(false, "AI_PROVIDER must be api or codex-cli");
  } else if (configuration.provider === "api") {
    let issues = apiConfigurationIssues(configuration.env);
    if (issues.length) {
      try {
        await promptApiConfiguration(configuration, { prompt: options.prompt, output, allowNonInteractive: options.allowNonInteractive });
        issues = apiConfigurationIssues(configuration.env);
      } catch (error) { errorOutput.write(`API setup: ${error.message}\n`); }
    }
    report(issues.length === 0, issues.length ? `API configuration is incomplete: ${issues.join(", ")}` : "API configuration is ready (no paid request was made)");
  } else {
    const codex = await runCodexPreflight(configuration, { runner: options.runner });
    report(codex.ok, codex.ok ? `${codex.version}; login is ready (no model request was made)` : codex.error);
  }
  return ready;
}

function applyConfiguration(env) {
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value !== null) process.env[key] = String(value);
  }
}

function helpText() {
  return `PenEcho ${PACKAGE_JSON.version}\n\nUsage:\n  penecho --api [--port 3888]\n  penecho --codex [--port 3888]\n  penecho doctor [--api|--codex] [--port 3888]\n\nOptions:\n  --api          Use an API provider\n  --codex        Use the authenticated Codex CLI\n  --port <port>  Listen on a port from 0 to 65535\n  -h, --help     Show help\n  -v, --version  Show version\n\nSetup:\n  penecho doctor --api\n  penecho doctor --codex\n`;
}

async function main(argv = process.argv.slice(2), options = {}) {
  const output = options.output || process.stdout, errorOutput = options.errorOutput || process.stderr;
  let args;
  try { args = parseArgs(argv); }
  catch (error) { errorOutput.write(`PenEcho: ${error.message}\nRun \`penecho --help\` for usage.\n`); return 1; }
  if (args.help) { output.write(helpText()); return 0; }
  if (args.version) { output.write(`${PACKAGE_JSON.version}\n`); return 0; }
  let configuration;
  try { configuration = resolveConfiguration(args, options); }
  catch (error) { errorOutput.write(`PenEcho configuration error: ${error.message}\n`); return 1; }

  if (args.command === "doctor") return (await runDoctor(args, configuration, options)) ? 0 : 1;
  if (!configuration.provider) {
    errorOutput.write("PenEcho configuration error: AI_PROVIDER must be api or codex-cli.\n");
    return 1;
  }
  if (configuration.provider === "api") {
    const issues = apiConfigurationIssues(configuration.env);
    if (issues.length) {
      errorOutput.write(`PenEcho API configuration is incomplete: ${issues.join(", ")}.\nRun \`penecho doctor --api\` to configure it.\n`);
      return 1;
    }
  } else {
    const codex = await runCodexPreflight(configuration, { runner: options.runner });
    if (!codex.ok) {
      errorOutput.write(`PenEcho Codex check failed: ${codex.error}\nRun \`penecho doctor --codex\` for full diagnostics.\n`);
      return 1;
    }
  }
  applyConfiguration(configuration.env);
  if (options.startServer) await options.startServer(configuration);
  else require("./server.js");
  return 0;
}

if (require.main === module) {
  main().then(code => { if (code) process.exitCode = code; }).catch(error => {
    console.error(`PenEcho: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  apiConfigurationIssues,
  checkAssets,
  checkPortAvailable,
  createPromptIo,
  helpText,
  loadEnvFile,
  main,
  parseArgs,
  parseEnvText,
  promptApiConfiguration,
  resolveConfiguration,
  runCodexPreflight,
  runDoctor,
  writeConfigFile,
};
