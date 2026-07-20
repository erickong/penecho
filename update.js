"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");
const { spawn } = require("child_process");
const PACKAGE_JSON = require("./package.json");

const UPDATE_CHECK_TIMEOUT_MS = 3500;
const UPDATE_SKIP_ENV = "PENECHO_SKIP_UPDATE_CHECK";

function parsedVersion(value) {
  const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return { numbers:match.slice(1, 4).map(Number), prerelease:match[4] ? match[4].split(".") : [] };
}

function compareVersions(left, right) {
  const a = parsedVersion(left), b = parsedVersion(right);
  if (!a || !b) throw new Error("PenEcho received an invalid npm version.");
  for (let index = 0; index < 3; index++) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] > b.numbers[index] ? 1 : -1;
  }
  if (!a.prerelease.length || !b.prerelease.length) return a.prerelease.length === b.prerelease.length ? 0 : a.prerelease.length ? -1 : 1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index++) {
    if (a.prerelease[index] === undefined || b.prerelease[index] === undefined) return a.prerelease[index] === undefined ? -1 : 1;
    if (a.prerelease[index] === b.prerelease[index]) continue;
    const aNumber = /^\d+$/.test(a.prerelease[index]) ? Number(a.prerelease[index]) : null,
      bNumber = /^\d+$/.test(b.prerelease[index]) ? Number(b.prerelease[index]) : null;
    if (aNumber !== null && bNumber !== null) return aNumber > bNumber ? 1 : -1;
    if (aNumber !== null || bNumber !== null) return aNumber !== null ? -1 : 1;
    return a.prerelease[index] > b.prerelease[index] ? 1 : -1;
  }
  return 0;
}

async function fetchLatestNpmVersion(packageName = PACKAGE_JSON.name, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("This Node.js version does not provide fetch().");
  const controller = new AbortController(), timeoutMs = options.timeoutMs || UPDATE_CHECK_TIMEOUT_MS,
    timer = setTimeout(() => controller.abort(), timeoutMs),
    url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
  try {
    const response = await fetchImpl(url, { headers:{ Accept:"application/json" }, redirect:"error", signal:controller.signal });
    if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}.`);
    const latest = String((await response.json())?.version || "").trim();
    if (!parsedVersion(latest)) throw new Error("npm registry returned an invalid PenEcho version.");
    return latest.replace(/^v/, "");
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`npm update check timed out after ${timeoutMs} ms.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function confirmUpdate(message, options = {}) {
  if (typeof options.confirmUpdate === "function") return Boolean(await options.confirmUpdate(message, true));
  if (typeof options.ui?.confirm === "function") return Boolean(await options.ui.confirm(message, true));
  const input = options.input || process.stdin, output = options.output || process.stdout,
    prompt = readline.createInterface({ input, output });
  try {
    const answer = String(await prompt.question(`${message} [Y/n] `)).trim();
    return !/^(?:n|no)$/i.test(answer);
  } finally {
    prompt.close();
  }
}

function runNpmGlobalUpdate(version, options = {}) {
  const spawnImpl = options.spawnImpl || spawn,
    command = process.platform === "win32" ? "npm.cmd" : "npm";
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnImpl(command, ["install", "--global", `${PACKAGE_JSON.name}@${version}`], {
        cwd:options.cwd || process.cwd(),
        env:options.env || process.env,
        stdio:"inherit",
        windowsHide:false,
        shell:false,
      });
    } catch (error) {
      reject(error);
      return;
    }
    child.once("error", reject);
    child.once("close", code => resolve(code === 0));
  });
}

function restartUpdatedCli(argv, options = {}) {
  const spawnImpl = options.spawnImpl || spawn,
    scriptPath = options.scriptPath || process.argv[1];
  if (!scriptPath) return Promise.reject(new Error("PenEcho could not determine its CLI entry point."));
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnImpl(process.execPath, [scriptPath, ...argv], {
        cwd:options.cwd || process.cwd(),
        env:{ ...(options.env || process.env), [UPDATE_SKIP_ENV]:"1" },
        stdio:"inherit",
        windowsHide:false,
        shell:false,
      });
    } catch (error) {
      reject(error);
      return;
    }
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

function updateCheckAllowed(options = {}) {
  const env = options.env || process.env,
    input = options.input || process.stdin,
    output = options.output || process.stdout,
    interactive = Boolean(options.ui?.interactive || input.isTTY && output.isTTY),
    packageRoot = path.resolve(options.packageRoot || __dirname);
  if (!interactive || /^(?:1|true|yes|on)$/i.test(String(env[UPDATE_SKIP_ENV] || "").trim())) return false;
  if (!options.forceUpdateCheck && fs.existsSync(path.join(packageRoot, ".git"))) return false;
  return options.updateCheck !== false;
}

async function maybeUpdateOnStart(argv, options = {}) {
  if (!updateCheckAllowed(options)) return { checked:false, restarted:false };
  const output = options.output || process.stdout,
    errorOutput = options.errorOutput || process.stderr,
    checker = options.updateChecker || (() => fetchLatestNpmVersion(PACKAGE_JSON.name, {
      fetchImpl:options.updateFetch,
      timeoutMs:options.updateTimeoutMs,
    }));
  let latest;
  try {
    latest = await checker();
    if (compareVersions(latest, PACKAGE_JSON.version) <= 0) return { checked:true, latest, restarted:false };
  } catch {
    return { checked:false, restarted:false };
  }

  output.write(`A newer PenEcho version is available: v${latest} (current v${PACKAGE_JSON.version}).\n`);
  if (!await confirmUpdate("Update PenEcho now?", options)) {
    output.write(`Continuing with PenEcho v${PACKAGE_JSON.version}.\n`);
    return { checked:true, latest, restarted:false };
  }

  output.write(`Updating PenEcho to v${latest}...\n`);
  const installer = options.updateInstaller || (version => runNpmGlobalUpdate(version, { cwd:options.cwd, env:options.env }));
  let installed = false;
  try {
    installed = Boolean(await installer(latest));
  } catch (error) {
    errorOutput.write(`PenEcho update failed: ${error.message}\n`);
  }
  if (!installed) {
    errorOutput.write(`Continuing with v${PACKAGE_JSON.version}. You can update manually with \`npm install --global ${PACKAGE_JSON.name}@latest\`.\n`);
    return { checked:true, latest, restarted:false };
  }

  output.write(`PenEcho v${latest} installed. Restarting...\n`);
  const restarter = options.updateRestarter || (values => restartUpdatedCli(values, { cwd:options.cwd, env:options.env }));
  try {
    await restarter(argv);
    return { checked:true, latest, restarted:true };
  } catch (error) {
    errorOutput.write(`PenEcho was updated, but automatic restart failed: ${error.message}\nRun \`penecho\` again to start v${latest}.\n`);
    return { checked:true, latest, restarted:false, exitCode:1 };
  }
}

module.exports = {
  compareVersions,
  fetchLatestNpmVersion,
  maybeUpdateOnStart,
  restartUpdatedCli,
  runNpmGlobalUpdate,
  updateCheckAllowed,
};
