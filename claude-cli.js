"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const MAX_CAPTURE_BYTES = 1024 * 1024;

function findOnPath(name, env = process.env) {
  const directories = String(env.PATH || env.Path || "").split(path.delimiter).filter(Boolean);
  const candidates = process.platform === "win32" && !path.extname(name) ? [".exe", ".com", ".cmd", ".bat"].map(extension => `${name}${extension}`) : [name];
  for (const directory of directories) {
    for (const candidate of candidates) {
      const file = path.join(directory.replace(/^"|"$/g, ""), candidate);
      try { if (fs.statSync(file).isFile()) return file; } catch {}
    }
  }
  return null;
}

function resolveClaudeLaunch(configuredPath = "claude", env = process.env) {
  const requested = String(configuredPath || "claude").trim();
  if (!requested || requested.includes("\0")) throw new Error("CLAUDE_CLI_PATH is invalid.");
  const hasDirectory = path.isAbsolute(requested) || requested.includes("/") || requested.includes("\\");
  const executable = hasDirectory ? path.resolve(requested) : findOnPath(requested, env);
  if (!executable) throw new Error("Claude CLI was not found. Install Claude Code or set CLAUDE_CLI_PATH to the executable.");
  try { if (!fs.statSync(executable).isFile()) throw new Error(); }
  catch { throw new Error(`Claude CLI path is not a file: ${executable}`); }
  const extension = path.extname(executable).toLowerCase();
  if ([".js", ".cjs", ".mjs"].includes(extension)) return { command: process.execPath, prefixArgs: [executable] };
  if (process.platform === "win32" && [".cmd", ".bat", ".ps1"].includes(extension)) {
    const packageRoot = path.join(path.dirname(executable), "node_modules", "@anthropic-ai", "claude-code"),
      native = path.join(packageRoot, "bin", "claude.exe"), wrapper = path.join(packageRoot, "cli-wrapper.cjs");
    if (fs.existsSync(native)) return { command: native, prefixArgs: [] };
    if (fs.existsSync(wrapper)) return { command: process.execPath, prefixArgs: [wrapper] };
    throw new Error("The Claude shell wrapper cannot be launched safely. Set CLAUDE_CLI_PATH to the Claude executable.");
  }
  return { command: executable, prefixArgs: [] };
}

function sanitizeClaudeEnv(env = process.env) {
  const clean = {}, allowed = [
    "PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432",
    "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "LANG", "LC_ALL", "TERM", "COLORTERM", "NO_COLOR",
    "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "CLAUDE_CONFIG_DIR", "CLAUDE_CODE_OAUTH_TOKEN",
  ];
  for (const name of allowed) {
    const sourceName = Object.keys(env).find(key => key.toLowerCase() === name.toLowerCase());
    if (sourceName && env[sourceName] !== undefined) clean[sourceName] = env[sourceName];
  }
  clean.CLAUDE_CODE_SKIP_PROMPT_HISTORY = "1";
  return clean;
}

function buildClaudeArgs({ systemPrompt, model, effort }) {
  const args = [
    "-p",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--no-session-persistence",
    "--safe-mode",
    "--disable-slash-commands",
    "--tools", "",
    "--strict-mcp-config",
    "--no-chrome",
    "--permission-mode", "dontAsk",
    "--system-prompt", systemPrompt,
  ];
  if (model) args.push("--model", model);
  if (effort) args.push("--effort", effort);
  return args;
}

function claudeInput(prompt, atlasImage) {
  const match = /^data:(image\/(?:png|webp|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(String(atlasImage || ""));
  if (!match) throw new Error("Claude CLI received an invalid canvas image.");
  return `${JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [
        { type: "text", text: String(prompt || "") },
        { type: "image", source: { type: "base64", media_type: match[1].toLowerCase(), data: match[2] } },
      ],
    },
    parent_tool_use_id: null,
  })}\n`;
}

function claudeResult(stdout) {
  let records;
  try { records = String(stdout || "").trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); }
  catch { throw new Error("Claude CLI returned invalid JSON output."); }
  const raw = records.findLast(record => record?.type === "result");
  if (!raw) throw new Error("Claude CLI returned no result event.");
  if (raw?.type !== "result" || raw?.subtype !== "success") throw new Error(`Claude CLI did not complete successfully${raw?.subtype ? ` (${raw.subtype})` : ""}.`);
  if (raw.structured_output && typeof raw.structured_output === "object") return JSON.stringify(raw.structured_output);
  if (typeof raw.result !== "string" || !raw.result.trim()) throw new Error("Claude CLI returned an empty result.");
  return raw.result;
}

function abortError() { return Object.assign(new Error("Claude CLI request aborted."), { name: "AbortError" }); }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function processGroupExists(pid) { try { process.kill(-pid, 0); return true; } catch { return false; } }
async function stopProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    await new Promise(resolve => {
      let settled = false;
      const fallback = () => { try { child.kill(); } catch {} };
      const finish = (fallbackNeeded = false) => { if (!settled) { settled = true; clearTimeout(timer); if (fallbackNeeded) fallback(); resolve(); } };
      const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true, shell: false });
      const timer = setTimeout(() => { try { killer.kill(); } catch {} finish(true); }, 2000);
      killer.once("error", () => finish(true));
      killer.once("close", code => finish(code !== 0));
    });
    return;
  }
  if (!processGroupExists(child.pid)) { if (child.exitCode === null && child.signalCode === null) try { child.kill("SIGTERM"); } catch {} return; }
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
  const deadline = Date.now() + 1000;
  while (processGroupExists(child.pid) && Date.now() < deadline) await wait(40);
  if (processGroupExists(child.pid)) try { process.kill(-child.pid, "SIGKILL"); } catch {}
}

function runProcess(launch, args, input, cwd, env, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    let child;
    try { child = spawn(launch.command, [...launch.prefixArgs, ...args], { cwd, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, shell: false, detached: process.platform !== "win32" }); }
    catch (error) { reject(error); return; }
    let overflow = false, aborted = false, termination = null, settled = false;
    const terminate = () => termination ||= stopProcessTree(child), stdout = { value: "" }, stderr = { value: "" };
    const capture = target => chunk => {
      if (aborted || overflow) return;
      if (Buffer.byteLength(target.value) + chunk.length > MAX_CAPTURE_BYTES) { overflow = true; void terminate(); return; }
      target.value += chunk.toString("utf8");
    };
    child.stdout.on("data", capture(stdout));
    child.stderr.on("data", capture(stderr));
    const onAbort = () => { aborted = true; void (async () => { await terminate(); if (settled) return; settled = true; signal?.removeEventListener("abort", onAbort); reject(abortError()); })(); };
    signal?.addEventListener("abort", onAbort, { once: true });
    child.once("error", async error => { if (settled) return; settled = true; signal?.removeEventListener("abort", onAbort); if (termination) await termination; reject(error); });
    child.once("close", async code => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      if (termination) await termination;
      if (aborted || signal?.aborted) return reject(abortError());
      if (overflow) return reject(new Error("Claude CLI produced too much output."));
      resolve({ code, stdout: stdout.value, stderr: stderr.value });
    });
    child.stdin.on("error", error => { if (error.code !== "EPIPE") void terminate(); });
    child.stdin.end(input);
  });
}

async function callClaudeCli({ executable, model, effort, systemPrompt, prompt, atlasImage, signal, env = process.env }) {
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "penecho-claude-"));
  let caughtError = null;
  try {
    await fs.promises.chmod(workDir, 0o700).catch(() => {});
    const launch = resolveClaudeLaunch(executable, env), args = buildClaudeArgs({ systemPrompt, model, effort }), input = claudeInput(prompt, atlasImage), childEnv = sanitizeClaudeEnv(env), result = await runProcess(launch, args, input, workDir, childEnv, signal);
    if (signal?.aborted) throw abortError();
    if (result.code !== 0) {
      const error = new Error(`Claude CLI failed with exit code ${result.code}.`);
      error.diagnostic = result.stderr.slice(-4000);
      throw error;
    }
    const content = claudeResult(result.stdout);
    if (signal?.aborted) throw abortError();
    return content;
  } catch (error) { caughtError = error; throw error; }
  finally {
    try { await fs.promises.rm(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
    catch (cleanupError) { if (caughtError) caughtError.cleanupDiagnostic = cleanupError.message; else throw new Error(`Claude CLI temporary directory cleanup failed: ${cleanupError.message}`); }
  }
}

module.exports = { buildClaudeArgs, callClaudeCli, claudeInput, claudeResult, resolveClaudeLaunch, sanitizeClaudeEnv };
