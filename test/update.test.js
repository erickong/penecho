"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");
const {
  compareVersions,
  fetchLatestNpmVersion,
  maybeUpdateOnStart,
  updateCheckAllowed,
} = require("../update.js");

function capture() {
  let value = "";
  return {
    stream:new Writable({ write(chunk, _encoding, callback) { value += chunk.toString("utf8"); callback(); } }),
    text:() => value,
  };
}

test("semantic version comparison handles stable and prerelease npm versions", () => {
  assert.equal(compareVersions("0.5.2", "0.5.1"), 1);
  assert.equal(compareVersions("0.5.1", "0.5.1"), 0);
  assert.equal(compareVersions("0.5.0", "0.5.1"), -1);
  assert.equal(compareVersions("1.0.0", "1.0.0-beta.2"), 1);
  assert.equal(compareVersions("1.0.0-beta.2", "1.0.0-beta.10"), -1);
  assert.throws(() => compareVersions("latest", "0.5.1"), /invalid npm version/);
});

test("npm latest-version lookup uses the registry latest endpoint and validates its response", async () => {
  const calls = [];
  const latest = await fetchLatestNpmVersion("penecho", {
    timeoutMs:1000,
    fetchImpl:async (url, options) => {
      calls.push({ url, options });
      return { ok:true, status:200, json:async () => ({ version:"0.6.0" }) };
    },
  });
  assert.equal(latest, "0.6.0");
  assert.equal(calls[0].url, "https://registry.npmjs.org/penecho/latest");
  assert.equal(calls[0].options.redirect, "error");
  await assert.rejects(
    fetchLatestNpmVersion("penecho", { timeoutMs:1000, fetchImpl:async () => ({ ok:true, status:200, json:async () => ({ version:"invalid" }) }) }),
    /invalid PenEcho version/,
  );
});

test("update checks skip noninteractive sessions, source checkouts, and restarted processes", () => {
  const interactive = { ui:{ interactive:true }, env:{}, packageRoot:process.cwd() };
  assert.equal(updateCheckAllowed({ output:capture().stream, input:{ isTTY:false }, env:{}, packageRoot:process.cwd() }), false);
  assert.equal(updateCheckAllowed(interactive), false);
  assert.equal(updateCheckAllowed({ ...interactive, forceUpdateCheck:true }), true);
  assert.equal(updateCheckAllowed({ ...interactive, forceUpdateCheck:true, env:{ PENECHO_SKIP_UPDATE_CHECK:"1" } }), false);
});

test("available updates default to yes, install globally, and restart with the original arguments", async () => {
  const output = capture(), errors = capture(), events = [], argv = ["--port", "4111"];
  const result = await maybeUpdateOnStart(argv, {
    ui:{ interactive:true, confirm:async (_message, fallback) => fallback },
    output:output.stream,
    errorOutput:errors.stream,
    forceUpdateCheck:true,
    updateChecker:async () => { events.push("check"); return "99.0.0"; },
    updateInstaller:async version => { events.push(`install:${version}`); return true; },
    updateRestarter:async values => { events.push(`restart:${values.join(" ")}`); return true; },
  });
  assert.equal(result.restarted, true);
  assert.deepEqual(events, ["check", "install:99.0.0", "restart:--port 4111"]);
  assert.match(output.text(), /newer PenEcho version.*v99\.0\.0/i);
  assert.match(output.text(), /Updating PenEcho/);
  assert.match(output.text(), /Restarting/);
  assert.equal(errors.text(), "");
});

test("declining or failing an update keeps the current service running", async () => {
  let installed = false;
  const declinedOutput = capture();
  const declined = await maybeUpdateOnStart([], {
    ui:{ interactive:true, confirm:async () => false },
    output:declinedOutput.stream,
    errorOutput:capture().stream,
    forceUpdateCheck:true,
    updateChecker:async () => "99.0.0",
    updateInstaller:async () => { installed = true; return true; },
  });
  assert.equal(declined.restarted, false);
  assert.equal(installed, false);
  assert.match(declinedOutput.text(), /Continuing with PenEcho/);

  const failedErrors = capture();
  const failed = await maybeUpdateOnStart([], {
    ui:{ interactive:true, confirm:async () => true },
    output:capture().stream,
    errorOutput:failedErrors.stream,
    forceUpdateCheck:true,
    updateChecker:async () => "99.0.0",
    updateInstaller:async () => false,
  });
  assert.equal(failed.restarted, false);
  assert.match(failedErrors.text(), /update manually/);
});

test("offline or invalid update checks never block startup", async () => {
  const result = await maybeUpdateOnStart([], {
    ui:{ interactive:true },
    output:capture().stream,
    errorOutput:capture().stream,
    forceUpdateCheck:true,
    updateChecker:async () => { throw new Error("offline"); },
  });
  assert.deepEqual(result, { checked:false, restarted:false });
});
