"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const MAX_CAPTURE_BYTES = 1024 * 1024;
const MAX_AUTH_BYTES = 1024 * 1024;

function findOnPath(name, env = process.env) {
  const directories = String(env.PATH || env.Path || "").split(path.delimiter).filter(Boolean);
  const candidates = process.platform === "win32" && !path.extname(name) ? [`.exe`, `.com`, `.cmd`, `.bat`].map((extension) => `${name}${extension}`) : [name];
  for (const directory of directories) {
    for (const candidate of candidates) {
      const file = path.join(directory.replace(/^"|"$/g, ""), candidate);
      try {
        if (fs.statSync(file).isFile()) return file;
      } catch {}
    }
  }
  return null;
}

function resolveCodexLaunch(configuredPath = "codex", env = process.env) {
  const requested = String(configuredPath || "codex").trim();
  if (!requested || requested.includes("\0")) throw new Error("CODEX_CLI_PATH is invalid.");
  const hasDirectory = path.isAbsolute(requested) || requested.includes("/") || requested.includes("\\");
  const executable = hasDirectory ? path.resolve(requested) : findOnPath(requested, env);
  if (!executable) throw new Error(`Codex CLI was not found. Set CODEX_CLI_PATH to the installed executable.`);
  try {
    if (!fs.statSync(executable).isFile()) throw new Error();
  } catch {
    throw new Error(`Codex CLI path is not a file: ${executable}`);
  }
  const extension = path.extname(executable).toLowerCase();
  if (extension === ".js") return { command: process.execPath, prefixArgs: [executable] };
  if (process.platform === "win32" && [".cmd", ".bat"].includes(extension)) {
    const npmScript = path.join(path.dirname(executable), "node_modules", "@openai", "codex", "bin", "codex.js");
    if (fs.existsSync(npmScript)) return { command: process.execPath, prefixArgs: [npmScript] };
    throw new Error("Windows batch wrappers are unsupported. Set CODEX_CLI_PATH to codex.exe or the npm-installed codex.cmd wrapper.");
  }
  return { command: executable, prefixArgs: [] };
}

function sanitizeCodexEnv(env = process.env, isolated = null) {
  const clean = {},
    allowed = [
      "PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432",
      "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "LANG", "LC_ALL", "TERM", "COLORTERM", "NO_COLOR", "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS",
    ];
  for (const name of allowed) {
    const sourceName = Object.keys(env).find((key) => key.toLowerCase() === name.toLowerCase());
    if (sourceName && env[sourceName] !== undefined) clean[sourceName] = env[sourceName];
  }
  if (isolated) {
    clean.HOME = isolated.homeDir;
    clean.USERPROFILE = isolated.homeDir;
    clean.CODEX_HOME = isolated.codexHome;
    clean.APPDATA = isolated.appData;
    clean.LOCALAPPDATA = isolated.localAppData;
    clean.XDG_CONFIG_HOME = isolated.xdgConfigHome;
    clean.XDG_CACHE_HOME = isolated.xdgCacheHome;
  }
  return clean;
}

function buildCodexArgs({ workDir, imageFile, outputFile, model, effort }) {
  const disabledFeatures = [
      "apps", "auth_elicitation", "browser_use", "browser_use_external", "browser_use_full_cdp_access", "code_mode", "code_mode_host", "computer_use",
      "goals", "hooks", "image_generation", "in_app_browser", "memories", "multi_agent", "network_proxy", "plugins", "remote_plugin",
      "request_permissions_tool", "shell_snapshot", "shell_tool", "skill_mcp_dependency_install", "tool_call_mcp_elicitation", "tool_suggest", "unified_exec", "workspace_dependencies",
    ],
    args = ["exec", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules", "--strict-config", "--color", "never"];
  for (const feature of disabledFeatures) args.push("--disable", feature);
  args.push(
    "-c", 'approval_policy="never"',
    "-c", 'web_search="disabled"',
    "-c", "mcp_servers={}",
    "-c", "project_doc_max_bytes=0",
    "-c", "project_root_markers=[]",
    "-c", "include_environment_context=false",
    "-c", "include_apps_instructions=false",
    "-c", "include_collaboration_mode_instructions=false",
    "-c", "skills.include_instructions=false",
    "-c", "skills.bundled.enabled=false",
    "-c", "orchestrator.skills.enabled=false",
    "-c", "orchestrator.mcp.enabled=false",
    "-c", "memories.generate_memories=false",
    "-c", "memories.use_memories=false",
    "-c", "memories.dedicated_tools=false",
    "-c", "notify=[]",
    "-c", "check_for_update_on_startup=false",
    "-c", "analytics.enabled=false",
    "-c", "feedback.enabled=false",
    "-c", 'history.persistence="none"',
    "-C", workDir, "-i", imageFile, "-o", outputFile,
  );
  if (model) args.push("--model", model);
  if (effort) args.push("-c", `model_reasoning_effort=${JSON.stringify(effort)}`);
  args.push("-");
  return args;
}

function sourceCodexHome(env = process.env) {
  if (env.CODEX_HOME) return path.resolve(env.CODEX_HOME);
  const home = env.USERPROFILE || env.HOME;
  return home ? path.join(path.resolve(home), ".codex") : null;
}

async function prepareIsolatedRuntime(workDir, env = process.env) {
  const homeDir = path.join(workDir, "home"), codexHome = path.join(homeDir, ".codex"),
    appData = path.join(homeDir, "AppData", "Roaming"), localAppData = path.join(homeDir, "AppData", "Local"),
    xdgConfigHome = path.join(homeDir, ".config"), xdgCacheHome = path.join(homeDir, ".cache");
  for (const directory of [homeDir, codexHome, appData, localAppData, xdgConfigHome, xdgCacheHome]) await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
  const sourceHome = sourceCodexHome(env), sourceAuth = sourceHome && path.join(sourceHome, "auth.json"), stat = sourceAuth ? await fs.promises.stat(sourceAuth).catch(() => null) : null;
  if (!stat || !stat.isFile() || stat.size <= 0 || stat.size > MAX_AUTH_BYTES) throw new Error("Codex CLI requires a readable auth.json. Run `codex login` first.");
  const destination = path.join(codexHome, "auth.json");
  await fs.promises.copyFile(sourceAuth, destination, fs.constants.COPYFILE_EXCL);
  await fs.promises.chmod(destination, 0o600).catch(() => {});
  return sanitizeCodexEnv(env, { homeDir, codexHome, appData, localAppData, xdgConfigHome, xdgCacheHome });
}

function abortError() {
  return Object.assign(new Error("Codex CLI request aborted."), { name: "AbortError" });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function processGroupExists(pid) {
  try { process.kill(-pid, 0); return true; } catch { return false; }
}
async function stopProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32" && child.pid) {
    await new Promise((resolve) => {
      let settled = false;
      const fallback = () => { try { child.kill(); } catch {} };
      const finish = (fallbackNeeded = false) => { if (!settled) { settled = true; clearTimeout(timer); if(fallbackNeeded)fallback(); resolve(); } };
      const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true, shell: false });
      const timer=setTimeout(()=>{try{killer.kill()}catch{}finish(true)},2000);
      killer.once("error", () => finish(true));
      killer.once("close", code => finish(code !== 0));
    });
    const deadline=Date.now()+1000;
    while(child.exitCode===null&&child.signalCode===null&&Date.now()<deadline)await wait(40);
    if(child.exitCode===null&&child.signalCode===null)try{child.kill()}catch{}
    return;
  }
  if (!processGroupExists(child.pid)) {
    if (child.exitCode === null && child.signalCode === null) try { child.kill("SIGTERM"); } catch {}
    return;
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
  const deadline = Date.now() + 1000;
  while (processGroupExists(child.pid) && Date.now() < deadline) await wait(40);
  if (processGroupExists(child.pid)) {
    try { process.kill(-child.pid, "SIGKILL"); } catch {}
    const forceDeadline = Date.now() + 500;
    while (processGroupExists(child.pid) && Date.now() < forceDeadline) await wait(40);
  }
}

function runProcess(launch, args, prompt, cwd, env, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    let child;
    try {
      child = spawn(launch.command, [...launch.prefixArgs, ...args], { cwd, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, shell: false, detached: process.platform !== "win32" });
    } catch (error) {
      return reject(error);
    }
    let overflow = false, aborted = false, termination = null, settled = false;
    const terminate = () => termination ||= stopProcessTree(child);
    const capture = (target) => (chunk) => {
      if (aborted || overflow) return;
      if (Buffer.byteLength(target.value) + chunk.length > MAX_CAPTURE_BYTES) {
        overflow = true;
        void terminate();
        return;
      }
      target.value += chunk.toString("utf8");
    };
    const stdoutTarget = { value: "" }, stderrTarget = { value: "" };
    child.stdout.on("data", capture(stdoutTarget));
    child.stderr.on("data", capture(stderrTarget));
    const onAbort = () => {
      aborted = true;
      void (async()=>{await terminate();if(settled)return;settled=true;signal?.removeEventListener("abort",onAbort);reject(abortError())})();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    child.on("error", async (error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      if (termination) await termination;
      reject(error);
    });
    child.on("close", async (code) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      if (termination) await termination;
      if (aborted || signal?.aborted) return reject(abortError());
      if (overflow) return reject(new Error("Codex CLI produced too much diagnostic output."));
      resolve({ code, stdout: stdoutTarget.value, stderr: stderrTarget.value });
    });
    child.stdin.on("error", (error) => {
      if (error.code !== "EPIPE") void terminate();
    });
    child.stdin.end(prompt);
  });
}

function decodeAtlasImage(dataUrl) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(dataUrl || ""));
  if (!match) throw new Error("Codex CLI received an invalid PNG image.");
  return Buffer.from(match[1], "base64");
}

async function callCodexCli({ executable, model, effort, prompt, atlasImage, signal, env = process.env }) {
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "penecho-codex-"));
  const imageFile = path.join(workDir, "atlas.png"), outputFile = path.join(workDir, "last-message.txt");
  let caughtError = null;
  try {
    await fs.promises.chmod(workDir, 0o700).catch(() => {});
    await fs.promises.writeFile(imageFile, decodeAtlasImage(atlasImage), { mode: 0o600 });
    const launch = resolveCodexLaunch(executable, env),
      args = buildCodexArgs({ workDir, imageFile, outputFile, model, effort }),
      childEnv = await prepareIsolatedRuntime(workDir, env),
      result = await runProcess(launch, args, prompt, workDir, childEnv, signal);
    if (signal?.aborted) throw abortError();
    if (result.code !== 0) {
      const error = new Error(`Codex CLI failed with exit code ${result.code}.`);
      error.diagnostic = result.stderr.slice(-4000);
      throw error;
    }
    const stat = await fs.promises.stat(outputFile).catch(() => null);
    if (signal?.aborted) throw abortError();
    if (!stat || !stat.isFile() || stat.size <= 0) throw new Error("Codex CLI did not produce a final response.");
    if (stat.size > MAX_CAPTURE_BYTES) throw new Error("Codex CLI final response is too large.");
    const content = await fs.promises.readFile(outputFile, { encoding:"utf8", signal });
    if (signal?.aborted) throw abortError();
    return content;
  } catch (error) {
    caughtError = error;
    throw error;
  } finally {
    try {
      await fs.promises.rm(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (cleanupError) {
      if (caughtError) caughtError.cleanupDiagnostic = cleanupError.message;
      else throw new Error(`Codex CLI temporary directory cleanup failed: ${cleanupError.message}`);
    }
  }
}

module.exports = { buildCodexArgs, callCodexCli, decodeAtlasImage, prepareIsolatedRuntime, resolveCodexLaunch, sanitizeCodexEnv, sourceCodexHome };
