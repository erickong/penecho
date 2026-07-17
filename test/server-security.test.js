"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const PERSONA = "Warm interdisciplinary knowledge guide. Favor intuition, memorable analogies, creative synthesis, conceptual connections across science and humanities, and exploratory alternatives while keeping facts and reasoning precise.";
const TEST_CODEX_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "penecho-test-codex-home-"));
const TEST_STATE_DIRS = [];
fs.writeFileSync(path.join(TEST_CODEX_HOME, "auth.json"), '{"auth_mode":"test"}');
test.after(() => {
  fs.rmSync(TEST_CODEX_HOME, { recursive:true, force:true });
  for (const directory of TEST_STATE_DIRS) fs.rmSync(directory, { recursive:true, force:true });
});

function testStateDir(overrides) {
  if (Object.hasOwn(overrides, "PENECHO_STATE_DIR")) return overrides.PENECHO_STATE_DIR;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "penecho-server-state-"));
  TEST_STATE_DIRS.push(directory);
  return directory;
}

function serverEnv(overrides = {}) {
  return {
    ...process.env,
    AI_PROVIDER: "codex-cli",
    HOST: "127.0.0.1",
    PORT: "0",
    CODEX_HOME: TEST_CODEX_HOME,
    CODEX_CLI_TIMEOUT_SECONDS: "",
    AI_EFFORT: "",
    PENECHO_STATE_DIR: testStateDir(overrides),
    ...overrides,
  };
}

function apiServerEnv(origin, overrides = {}) {
  return {
    ...process.env,
    AI_PROVIDER: "api",
    HOST: "127.0.0.1",
    PORT: "0",
    AI_API_KEY: "test-key",
    AI_API_URL: `${origin}/v1`,
    AI_API_MODEL: "test-model",
    AI_EFFORT: "",
    PENECHO_STATE_DIR: testStateDir(overrides),
    ...overrides,
  };
}

function claudeServerEnv(fakeCli, overrides = {}) {
  return {
    ...process.env,
    AI_PROVIDER:"claude-cli",
    HOST:"127.0.0.1",
    PORT:"0",
    CLAUDE_CLI_PATH:fakeCli,
    CLAUDE_CLI_MODEL:"sonnet",
    CLAUDE_CLI_TIMEOUT_SECONDS:"",
    AI_EFFORT:"",
    PENECHO_STATE_DIR:testStateDir(overrides),
    ...overrides,
  };
}

function startApiServer(responseContent = '{"intent":"none","commands":[]}', options = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      const requestBody=Buffer.concat(chunks).toString("utf8");
      requests.push(requestBody);
      const reply=()=>{
        if(res.destroyed)return;
        const configured=typeof options.response==="function"?options.response({index:requests.length-1,requestBody}):null,status=configured?.status||options.status||200,responseBody=configured?.body;
        res.writeHead(status, { "Content-Type":"application/json", "x-request-id":"test-upstream-request" });
        const successfulBody=options.format==="anthropic"?{id:"test-response-id",model:"test-upstream-model",stop_reason:"end_turn",content:[{type:"text",text:responseBody??responseContent}]}:{id:"test-response-id",model:"test-upstream-model",choices:[{finish_reason:"stop",message:{content:responseBody??responseContent}}]};
        res.end(status===200?JSON.stringify(successfulBody):responseBody??responseContent);
      };
      if(options.delayMs)setTimeout(reply,options.delayMs);
      else reply();
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, requests, origin:`http://127.0.0.1:${server.address().port}` }));
  });
}

function startServer(env) {
  const child = spawn(process.execPath, [path.join(ROOT, "server.js")], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  return new Promise((resolve, reject) => {
    let stdout = "", stderr = "";
    const timeout = setTimeout(() => finish(new Error(`Server did not start.\n${stdout}\n${stderr}`)), 10000);
    const finish = (error, value) => {
      clearTimeout(timeout);
      child.stdout.removeAllListeners("data");
      child.stderr.removeAllListeners("data");
      child.removeAllListeners("exit");
      if (error) reject(error);
      else resolve(value);
    };
    child.stdout.on("data", chunk => {
      stdout += chunk.toString("utf8");
      const match = stdout.match(/PenEcho: http:\/\/[^:]+:(\d+)/);
      if (match) finish(null, { child, origin: `http://127.0.0.1:${match[1]}`, stateDir:env.PENECHO_STATE_DIR });
    });
    child.stderr.on("data", chunk => { stderr += chunk.toString("utf8"); });
    child.once("exit", code => finish(new Error(`Server exited before listening (${code}).\n${stdout}\n${stderr}`)));
  });
}

function rawRequest(port, pathText, headers = {}) {
  const net = require("node:net");
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port }, () => {
      const headerLines = Object.entries(headers).map(([name, value]) => `${name}: ${value}`).join("\r\n");
      socket.write(`GET ${pathText} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n${headerLines}\r\n\r\n`);
    });
    let response = "";
    socket.setEncoding("utf8");
    socket.on("data", chunk => { response += chunk; });
    socket.on("end", () => resolve(response));
    socket.on("error", reject);
  });
}

function httpRequest(origin, { method = "GET", pathText = "/", headers = {}, body = "" } = {}) {
  const http = require("node:http"), target = new URL(origin);
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: target.hostname, port: target.port, method, path: pathText, headers }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject);
    request.end(body);
  });
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise(resolve => child.once("exit", resolve));
  child.kill();
  await closed;
}

function validPayload() {
  const box = { x: 0, y: 0, w: 1, h: 1 };
  return {
    atlasImage: PNG,
    atlasSize: { w: 1, h: 1 },
    imageScale: 1,
    changedBox: box,
    visibleRect: box,
    captureRect: box,
    sourceRect: box,
    focusInset: null,
    hotspotGrid: { columns: 8, rows: 8, order: "oldest-to-newest", hotspots: [{ cell: [0, 0], imageRect: box }] },
    trigger: "user_paused",
    userAction: "auto",
    canvasSize: { w: 20000, h: 20000 },
    uiTheme: "arcane",
    persona: PERSONA,
  };
}

test("API, Codex, and Claude environment files enable localhost and LAN directly", () => {
  const api = fs.readFileSync(path.join(ROOT, ".env.api"), "utf8"), codex = fs.readFileSync(path.join(ROOT, ".env.codex"), "utf8"), claude=fs.readFileSync(path.join(ROOT,".env.claude"),"utf8"), generic=fs.readFileSync(path.join(ROOT,".env.example"),"utf8");
  assert.match(api, /^AI_PROVIDER=api$/m);
  assert.match(api, /^AI_EFFORT=max$/m);
  assert.match(codex, /^AI_PROVIDER=codex-cli$/m);
  assert.match(codex, /^AI_EFFORT=$/m);
  assert.match(codex, /^CODEX_CLI_TIMEOUT_SECONDS=120$/m);
  assert.match(claude, /^AI_PROVIDER=claude-cli$/m);
  assert.match(claude, /^AI_EFFORT=$/m);
  assert.match(claude, /^CLAUDE_CLI_MODEL=$/m);
  assert.match(claude, /^CLAUDE_CLI_TIMEOUT_SECONDS=120$/m);
  for(const example of [api,generic])assert.match(example,/^PENECHO_AI_IMAGE_FORMAT=webp$/m);
  for (const example of [api, codex, claude]) {
    assert.match(example, /^HOST=0\.0\.0\.0$/m);
    assert.match(example, /^PORT=3888$/m);
    assert.doesNotMatch(example, /PUBLIC_ORIGIN|ALLOW_REMOTE|LOCAL_PROVIDER|\bOSS\b/i);
  }
  assert.match(api, /^AI_API_FORMAT=openai$/m);
  assert.doesNotMatch(api, /^OPENAI_/m);
});

test("Codex CLI mode starts with no extra access or model-provider settings", { timeout: 10000 }, async () => {
  const {child,origin}=await startServer(serverEnv({HOST:"0.0.0.0"}));
  try {
    const localPage=await fetch(origin);
    assert.equal(localPage.status,200);
    assert.ok(localPage.headers.get("set-cookie"));
  } finally { await stopServer(child); }
});

test("Claude CLI mode sends the canvas to the authenticated local CLI with the selected model and effort", { timeout:20000 }, async () => {
  const directory=await fs.promises.mkdtemp(path.join(os.tmpdir(),"penecho-server-claude-")),fakeCli=path.join(directory,"fake-claude.js"),record=path.join(directory,"record.json");
  await fs.promises.writeFile(fakeCli, `"use strict";const fs=require("node:fs"),args=process.argv.slice(2),input=JSON.parse(fs.readFileSync(0,"utf8").trim()),image=input.message.content.find(part=>part.type==="image");fs.writeFileSync(${JSON.stringify(record)},JSON.stringify({args,mediaType:image?.source?.media_type,hasImage:Boolean(image?.source?.data)}));const result={intent:"answer",observedText:"hi",message:"hello",commands:[]};process.stdout.write(JSON.stringify({type:"result",subtype:"success",result:JSON.stringify(result)}));\n`);
  const {child,origin}=await startServer(claudeServerEnv(fakeCli,{AI_EFFORT:"max"}));
  try {
    const page=await fetch(origin),cookie=page.headers.get("set-cookie")?.split(";",1)[0];
    assert.ok(cookie);
    const response=await fetch(`${origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json",Origin:origin,Cookie:cookie},body:JSON.stringify(validPayload())}),body=await response.json(),saved=JSON.parse(await fs.promises.readFile(record,"utf8"));
    assert.equal(response.status,200);
    assert.equal(body.message,"hello");
    assert.equal(saved.mediaType,"image/png");
    assert.equal(saved.hasImage,true);
    assert.equal(saved.args[saved.args.indexOf("--model")+1],"sonnet");
    assert.equal(saved.args[saved.args.indexOf("--effort")+1],"max");
    assert.equal(saved.args[saved.args.indexOf("--tools")+1],"");
  } finally {
    await stopServer(child);
    await fs.promises.rm(directory,{recursive:true,force:true});
  }
});

test("Claude CLI failures expose the useful upstream diagnostic", { timeout:20000 }, async () => {
  const directory=await fs.promises.mkdtemp(path.join(os.tmpdir(),"penecho-server-claude-error-")),fakeCli=path.join(directory,"fake-claude.js");
  await fs.promises.writeFile(fakeCli, `process.stderr.write("invalid effort value: future-model-level");process.exit(1);\n`);
  const {child,origin}=await startServer(claudeServerEnv(fakeCli,{AI_EFFORT:"future-model-level"}));
  try {
    const page=await fetch(origin),cookie=page.headers.get("set-cookie")?.split(";",1)[0],response=await fetch(`${origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json",Origin:origin,Cookie:cookie},body:JSON.stringify(validPayload())}),body=await response.json();
    assert.equal(response.status,502);
    assert.match(body.error,/invalid effort value: future-model-level/);
  } finally { await stopServer(child); await fs.promises.rm(directory,{recursive:true,force:true}); }
});

test("global API effort maps to OpenAI and Anthropic request fields", { timeout:20000 }, async () => {
  const openai=await startApiServer(),openaiServer=await startServer(apiServerEnv(openai.origin));
  try {
    const response=await fetch(`${openaiServer.origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(validPayload())});
    assert.equal(response.status,200);
    assert.equal(JSON.parse(openai.requests[0]).reasoning_effort,"max");
  } finally { await stopServer(openaiServer.child); await new Promise(resolve=>openai.server.close(resolve)); }

  const anthropic=await startApiServer(undefined,{format:"anthropic"}),anthropicServer=await startServer(apiServerEnv(anthropic.origin,{AI_API_FORMAT:"anthropic",AI_API_URL:anthropic.origin,AI_EFFORT:"future-model-level"}));
  try {
    const response=await fetch(`${anthropicServer.origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(validPayload())});
    assert.equal(response.status,200);
    assert.equal(JSON.parse(anthropic.requests[0]).output_config.effort,"future-model-level");
  } finally { await stopServer(anthropicServer.child); await new Promise(resolve=>anthropic.server.close(resolve)); }
});

test("Codex process launches require a same-origin session and do not retain failed processes", { timeout: 20000 }, async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "penecho-server-test-"));
  const fakeCli = path.join(directory, "fake-codex.js");
  await fs.promises.writeFile(fakeCli, "process.stderr.write('expected test failure'); process.exit(2);\n");
  const { child, origin } = await startServer(serverEnv({ CODEX_CLI_PATH: fakeCli }));
  try {
    const page = await fetch(`${origin}/`), setCookie = page.headers.get("set-cookie"), cookie = setCookie?.split(";", 1)[0];
    assert.equal(page.status, 200);
    assert.match(setCookie || "", /HttpOnly/);
    assert.match(setCookie || "", /SameSite=Strict/);
    assert.ok(cookie);
    assert.match(page.headers.get("content-security-policy") || "", /script-src 'self'/);

    const wrongHost = await httpRequest(origin, { headers: { Host: "attacker.example" } });
    assert.equal(wrongHost.status, 421);
    assert.equal(wrongHost.headers["set-cookie"], undefined);

    const debugLog = await fetch(`${origin}/api/debug/log`);
    const debugAtlas = await fetch(`${origin}/api/debug/atlas`);
    assert.equal(debugLog.status, 404);
    assert.equal(debugAtlas.status, 404);

    const withoutSession = await fetch(`${origin}/api/ai/command`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: "{}" });
    assert.equal(withoutSession.status, 403);

    const wrongType = await fetch(`${origin}/api/ai/command`, { method: "POST", headers: { "Content-Type": "text/plain", Cookie: cookie, Origin: origin }, body: "{}" });
    assert.equal(wrongType.status, 415);

    const crossSite = await fetch(`${origin}/api/ai/command`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "https://evil.example" }, body: "{}" });
    assert.equal(crossSite.status, 403);

    const authorizedInvalid = await fetch(`${origin}/api/ai/command`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: origin }, body: "{}" });
    assert.equal(authorizedInvalid.status, 400);

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`${origin}/api/ai/command`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: origin }, body: JSON.stringify(validPayload()) });
      assert.equal(response.status, 502);
      const body = await response.json();
      assert.match(body.error, /exit code 2/);
    }

    const port = Number(new URL(origin).port), malformed = await rawRequest(port, "/%");
    assert.match(malformed, /^HTTP\/1\.1 400 /);
    const healthy = await fetch(`${origin}/`);
    assert.equal(healthy.status, 200);
  } finally {
    await stopServer(child);
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});

test("API mode preserves unrestricted remote request behavior", { timeout: 20000 }, async () => {
  const upstream = await startApiServer(), { child, origin } = await startServer(apiServerEnv(upstream.origin));
  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(upstream.requests.length, 0);
    const page = await httpRequest(origin,{headers:{Host:"my-pc:3888"}}), before = upstream.requests.length, body=JSON.stringify(validPayload());
    assert.equal(page.status,200);
    assert.equal(page.headers["set-cookie"],undefined);
    const remote = await httpRequest(origin,{method:"POST",pathText:"/api/ai/command",headers:{Host:"my-pc:3888",Origin:"https://unrelated.example","Content-Type":"text/plain","Content-Length":Buffer.byteLength(body)},body});
    assert.equal(remote.status,200);
    assert.equal(upstream.requests.length, before + 1);
  } finally {
    await stopServer(child);
    await new Promise(resolve => upstream.server.close(resolve));
  }
});

test("debug mode captures the raw model exchange and upstream request identifiers locally", { timeout: 20000 }, async () => {
  const observedText="debug-observed-text",responseContent=JSON.stringify({intent:"answer",observedText,message:"debug reply",commands:[]}),upstream=await startApiServer(responseContent),{child,origin,stateDir}=await startServer(apiServerEnv(upstream.origin,{PENECHO_DEBUG_ARTIFACTS:"true"}));
  try {
    const response=await fetch(`${origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(validPayload())}),body=await response.json(),file=path.join(stateDir,"logs","latest-model.json"),deadline=Date.now()+3000;
    assert.equal(response.status,200);
    let exchange=null;
    while(Date.now()<deadline){try{exchange=JSON.parse(await fs.promises.readFile(file,"utf8"))}catch{}if(exchange?.requestId===body.requestId)break;await new Promise(resolve=>setTimeout(resolve,25))}
    assert.equal(exchange?.requestId,body.requestId);
    assert.equal(exchange?.response?.parsed?.observedText,observedText);
    assert.equal(exchange?.response?.rawContent,responseContent);
    assert.equal(exchange?.response?.upstream?.responseId,"test-response-id");
    assert.equal(exchange?.response?.upstream?.reportedModel,"test-upstream-model");
    assert.equal(exchange?.response?.upstream?.headers?.["x-request-id"],"test-upstream-request");
    const local=await fetch(`${origin}/api/debug/model`),localBody=await local.json();
    assert.equal(local.status,200);
    assert.equal(localBody.requestId,body.requestId);
    const remote=await httpRequest(origin,{pathText:"/api/debug/model",headers:{Host:"my-pc:3888"}});
    assert.equal(remote.status,404);
  } finally {
    await stopServer(child);
    await new Promise(resolve=>upstream.server.close(resolve));
  }
});

test("request tracing retains the configured number of complete image and model exchanges", { timeout: 20000 }, async () => {
  const directory=await fs.promises.mkdtemp(path.join(os.tmpdir(),"penecho-request-trace-")),responseContent=JSON.stringify({intent:"answer",observedText:"trace input",message:"trace reply",commands:[]}),upstream=await startApiServer(responseContent),{child,origin}=await startServer(apiServerEnv(upstream.origin,{PENECHO_STATE_DIR:directory,PENECHO_REQUEST_TRACE:"true",PENECHO_REQUEST_TRACE_LIMIT:"2",PENECHO_DEBUG_ARTIFACTS:"false"}));
  try {
    const responses=[];
    for(let index=0;index<3;index++){
      const response=await fetch(`${origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(validPayload())});
      assert.equal(response.status,200);
      responses.push(await response.json());
    }
    const root=path.join(directory,"logs","requests"),directories=(await fs.promises.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
    assert.equal(directories.length,2);
    assert.equal(directories.some(name=>name.endsWith(responses[0].requestId)),false);
    const newest=directories.find(name=>name.endsWith(responses[2].requestId));
    assert.ok(newest);
    const trace=JSON.parse(await fs.promises.readFile(path.join(root,newest,"trace.json"),"utf8")),serialized=JSON.stringify(trace);
    assert.equal(trace.status,"completed");
    assert.equal(trace.image.file,"atlas.png");
    assert.equal(trace.image.mimeType,"image/png");
    assert.ok(trace.image.bytes>0);
    assert.equal(trace.image.preferredFile,"atlas.webp");
    assert.equal(trace.image.preferredMimeType,"image/webp");
    assert.ok(trace.image.preferredBytes>0);
    assert.equal(trace.image.encoding.lossless,true);
    assert.ok((await fs.promises.stat(path.join(root,newest,"atlas.png"))).size>0);
    assert.ok((await fs.promises.stat(path.join(root,newest,"atlas.webp"))).size>0);
    const pngPixels=await sharp(await fs.promises.readFile(path.join(root,newest,"atlas.png"))).toColourspace("srgb").ensureAlpha().raw().toBuffer({resolveWithObject:true}),webpPixels=await sharp(await fs.promises.readFile(path.join(root,newest,"atlas.webp"))).toColourspace("srgb").ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.deepEqual(webpPixels.info,pngPixels.info);
    assert.deepEqual(webpPixels.data,pngPixels.data);
    assert.equal(trace.attempts.length,1);
    assert.equal(trace.attempts[0].outbound.provider,"api");
    assert.equal(trace.attempts[0].outbound.image,"atlas.webp");
    assert.equal(trace.attempts[0].outbound.imageMimeType,"image/webp");
    assert.equal(trace.attempts[0].outbound.imageBytes,trace.image.preferredBytes);
    assert.match(serialized,/<saved as atlas\.webp>/);
    assert.equal(serialized.includes("test-key"),false);
    assert.equal(trace.attempts[0].response.rawContent,responseContent);
    assert.equal(trace.attempts[0].response.parsed.observedText,"trace input");
    assert.equal(trace.final.httpStatus,200);
    assert.equal(trace.final.body.requestId,responses[2].requestId);
    const outbound=JSON.parse(upstream.requests.at(-1)),imageUrl=outbound.messages[1].content.find(part=>part.type==="image_url").image_url.url;
    assert.match(imageUrl,/^data:image\/webp;base64,/);
  } finally {
    await stopServer(child);
    await new Promise(resolve=>upstream.server.close(resolve));
    await fs.promises.rm(directory,{recursive:true,force:true});
  }
});

test("request tracing records upstream failures without credentials", { timeout: 20000 }, async () => {
  const directory=await fs.promises.mkdtemp(path.join(os.tmpdir(),"penecho-request-trace-error-")),upstream=await startApiServer("upstream unavailable",{status:503}),{child,origin}=await startServer(apiServerEnv(upstream.origin,{PENECHO_STATE_DIR:directory,PENECHO_REQUEST_TRACE:"true",PENECHO_REQUEST_TRACE_LIMIT:"100"}));
  try {
    const response=await fetch(`${origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(validPayload())}),body=await response.json(),root=path.join(directory,"logs","requests"),directories=(await fs.promises.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name),name=directories.find(entry=>entry.endsWith(body.requestId));
    assert.equal(response.status,503);
    assert.ok(name);
    const trace=JSON.parse(await fs.promises.readFile(path.join(root,name,"trace.json"),"utf8")),serialized=JSON.stringify(trace);
    assert.equal(trace.status,"failed");
    assert.equal(trace.final.httpStatus,503);
    assert.equal(trace.attempts[0].error.status,503);
    assert.equal(trace.attempts[0].error.upstream.body,"upstream unavailable");
    assert.equal(upstream.requests.length,1);
    assert.equal(serialized.includes("test-key"),false);
  } finally {
    await stopServer(child);
    await new Promise(resolve=>upstream.server.close(resolve));
    await fs.promises.rm(directory,{recursive:true,force:true});
  }
});

test("API mode retries the original PNG only after an explicit WebP format rejection", { timeout: 20000 }, async () => {
  const directory=await fs.promises.mkdtemp(path.join(os.tmpdir(),"penecho-webp-fallback-")),responseContent=JSON.stringify({intent:"answer",observedText:"hi",message:"hello",commands:[]}),upstream=await startApiServer(responseContent,{response:({requestBody})=>{
    const request=JSON.parse(requestBody),imageUrl=request.messages[1].content.find(part=>part.type==="image_url").image_url.url;
    return imageUrl.startsWith("data:image/webp")?{status:415,body:'{"error":{"message":"Unsupported image format: webp"}}'}:{status:200};
  }}),{child,origin}=await startServer(apiServerEnv(upstream.origin,{PENECHO_STATE_DIR:directory,PENECHO_REQUEST_TRACE:"true"}));
  try {
    const response=await fetch(`${origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(validPayload())}),body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.attempts,2);
    assert.equal(upstream.requests.length,2);
    const imageUrls=upstream.requests.map(raw=>JSON.parse(raw).messages[1].content.find(part=>part.type==="image_url").image_url.url);
    assert.match(imageUrls[0],/^data:image\/webp;base64,/);
    assert.match(imageUrls[1],/^data:image\/png;base64,/);
    const root=path.join(directory,"logs","requests"),name=(await fs.promises.readdir(root)).find(entry=>entry.endsWith(body.requestId)),trace=JSON.parse(await fs.promises.readFile(path.join(root,name,"trace.json"),"utf8"));
    assert.equal(trace.status,"completed");
    assert.equal(trace.image.fallback.used,true);
    assert.equal(trace.image.fallback.reason,"upstream-webp-format-rejected");
    assert.equal(trace.image.fallback.upstreamStatus,415);
    assert.equal(trace.attempts.length,2);
    assert.equal(trace.attempts[0].outbound.imageMimeType,"image/webp");
    assert.equal(trace.attempts[0].error.status,415);
    assert.equal(trace.attempts[1].transportReason,"png-fallback-after-webp-rejection");
    assert.equal(trace.attempts[1].outbound.imageMimeType,"image/png");
    assert.equal(trace.attempts[1].response.parsed.observedText,"hi");
  } finally {
    await stopServer(child);
    await new Promise(resolve=>upstream.server.close(resolve));
    await fs.promises.rm(directory,{recursive:true,force:true});
  }
});

test("API image format configuration can send the source PNG unchanged", { timeout: 20000 }, async () => {
  const upstream=await startApiServer(),{child,origin}=await startServer(apiServerEnv(upstream.origin,{PENECHO_AI_IMAGE_FORMAT:"png"}));
  try {
    const response=await fetch(`${origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(validPayload())}),body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.attempts,1);
    assert.equal(upstream.requests.length,1);
    const outbound=JSON.parse(upstream.requests[0]),imageUrl=outbound.messages[1].content.find(part=>part.type==="image_url").image_url.url;
    assert.equal(imageUrl,PNG);
  } finally {
    await stopServer(child);
    await new Promise(resolve=>upstream.server.close(resolve));
  }
});

test("API image format configuration sends high-quality JPEG with trace metadata", { timeout: 20000 }, async () => {
  const directory=await fs.promises.mkdtemp(path.join(os.tmpdir(),"penecho-jpeg-format-")),upstream=await startApiServer(),{child,origin}=await startServer(apiServerEnv(upstream.origin,{PENECHO_AI_IMAGE_FORMAT:"jpeg",PENECHO_STATE_DIR:directory,PENECHO_REQUEST_TRACE:"true"}));
  try {
    const response=await fetch(`${origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(validPayload())}),body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.attempts,1);
    const outbound=JSON.parse(upstream.requests[0]),imageUrl=outbound.messages[1].content.find(part=>part.type==="image_url").image_url.url,jpeg=Buffer.from(imageUrl.slice(imageUrl.indexOf(",")+1),"base64");
    assert.match(imageUrl,/^data:image\/jpeg;base64,/);
    assert.deepEqual([...jpeg.subarray(0,2)],[0xff,0xd8]);
    const root=path.join(directory,"logs","requests"),name=(await fs.promises.readdir(root)).find(entry=>entry.endsWith(body.requestId)),trace=JSON.parse(await fs.promises.readFile(path.join(root,name,"trace.json"),"utf8"));
    assert.equal(trace.image.preferredFile,"atlas.jpg");
    assert.equal(trace.image.preferredMimeType,"image/jpeg");
    assert.equal(trace.image.encoding.configuredFormat,"jpeg");
    assert.equal(trace.image.encoding.lossless,false);
    assert.equal(trace.attempts[0].outbound.imageEncoding,"jpeg-q95-444");
  } finally {
    await stopServer(child);
    await new Promise(resolve=>upstream.server.close(resolve));
    await fs.promises.rm(directory,{recursive:true,force:true});
  }
});

test("invalid API image format configuration fails before an upstream request", { timeout: 20000 }, async () => {
  const upstream=await startApiServer(),{child,origin}=await startServer(apiServerEnv(upstream.origin,{PENECHO_AI_IMAGE_FORMAT:"gif"}));
  try {
    const response=await fetch(`${origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(validPayload())}),body=await response.json();
    assert.equal(response.status,400);
    assert.match(body.error,/PENECHO_AI_IMAGE_FORMAT/);
    assert.equal(upstream.requests.length,0);
  } finally {
    await stopServer(child);
    await new Promise(resolve=>upstream.server.close(resolve));
  }
});

test("Anthropic API mode labels the lossless WebP payload with its matching media type", { timeout: 20000 }, async () => {
  const responseContent=JSON.stringify({intent:"answer",observedText:"hi",message:"hello",commands:[]}),upstream=await startApiServer(responseContent,{format:"anthropic"}),{child,origin}=await startServer(apiServerEnv(upstream.origin,{AI_API_FORMAT:"anthropic",AI_API_URL:upstream.origin}));
  try {
    const response=await fetch(`${origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(validPayload())}),body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.attempts,1);
    assert.equal(upstream.requests.length,1);
    const outbound=JSON.parse(upstream.requests[0]),image=outbound.messages[0].content.find(part=>part.type==="image");
    assert.equal(image.source.media_type,"image/webp");
    assert.equal(Buffer.from(image.source.data,"base64").toString("ascii",0,4),"RIFF");
  } finally {
    await stopServer(child);
    await new Promise(resolve=>upstream.server.close(resolve));
  }
});

test("request tracing preserves an upstream response that fails model parsing", { timeout: 20000 }, async () => {
  const directory=await fs.promises.mkdtemp(path.join(os.tmpdir(),"penecho-request-trace-parse-")),upstream=await startApiServer("not-json"),{child,origin}=await startServer(apiServerEnv(upstream.origin,{PENECHO_STATE_DIR:directory,PENECHO_REQUEST_TRACE:"true"}));
  try {
    const response=await fetch(`${origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(validPayload())}),body=await response.json(),root=path.join(directory,"logs","requests"),directories=(await fs.promises.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name),name=directories.find(entry=>entry.endsWith(body.requestId));
    assert.equal(response.status,502);
    assert.ok(name);
    const trace=JSON.parse(await fs.promises.readFile(path.join(root,name,"trace.json"),"utf8"));
    assert.equal(trace.status,"failed");
    assert.equal(trace.attempts[0].error.upstream.rawContent,"not-json");
  } finally {
    await stopServer(child);
    await new Promise(resolve=>upstream.server.close(resolve));
    await fs.promises.rm(directory,{recursive:true,force:true});
  }
});

test("request tracing preserves a client-cancelled model attempt", { timeout: 20000 }, async () => {
  const directory=await fs.promises.mkdtemp(path.join(os.tmpdir(),"penecho-request-trace-cancel-")),upstream=await startApiServer('{"intent":"none","commands":[]}',{delayMs:1000}),{child,origin}=await startServer(apiServerEnv(upstream.origin,{PENECHO_STATE_DIR:directory,PENECHO_REQUEST_TRACE:"true"}));
  try {
    const controller=new AbortController(),pending=fetch(`${origin}/api/ai/command`,{signal:controller.signal,method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(validPayload())});
    const requestDeadline=Date.now()+2000;
    while(!upstream.requests.length&&Date.now()<requestDeadline)await new Promise(resolve=>setTimeout(resolve,20));
    controller.abort();
    await assert.rejects(pending,error=>error?.name==="AbortError");
    const root=path.join(directory,"logs","requests"),deadline=Date.now()+3000;
    let trace=null;
    while(Date.now()<deadline){
      try{
        const directories=(await fs.promises.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name);
        if(directories.length)trace=JSON.parse(await fs.promises.readFile(path.join(root,directories[0],"trace.json"),"utf8"));
      }catch{}
      if(trace?.status==="cancelled")break;
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    assert.equal(trace?.status,"cancelled");
    assert.equal(trace?.final?.httpStatus,499);
    assert.equal(trace?.attempts?.[0]?.error?.name,"AbortError");
  } finally {
    await stopServer(child);
    await new Promise(resolve=>upstream.server.close(resolve));
    await fs.promises.rm(directory,{recursive:true,force:true});
  }
});

test("API mode does not retry or reject a valid in-canvas draw because of aggregate area", { timeout: 20000 }, async () => {
  const responseContent=JSON.stringify({intent:"plot",commands:[{tool:"draw",origin:[100,100],types:["rect"],items:[[0,0,4000,4000]]}]}),upstream=await startApiServer(responseContent),{child,origin}=await startServer(apiServerEnv(upstream.origin));
  try {
    const payload=validPayload();payload.trigger="manual";payload.userAction="plot";
    const response=await fetch(`${origin}/api/ai/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}),body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.attempts,1);
    assert.equal(body.commands[0]?.tool,"draw");
  } finally {
    await stopServer(child);
    await new Promise(resolve=>upstream.server.close(resolve));
  }
});

test("a new Codex request immediately supersedes the running request", { timeout: 20000 }, async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "penecho-latest-wins-test-")), fakeCli = path.join(directory, "fake-codex.js"), countFile = path.join(directory, "count.txt"), startedFile = path.join(directory, "started.txt");
  await fs.promises.writeFile(fakeCli, `"use strict";const fs=require("node:fs"),path=require("node:path"),root=__dirname,countFile=path.join(root,"count.txt"),count=Number(fs.existsSync(countFile)?fs.readFileSync(countFile,"utf8"):0)+1;fs.writeFileSync(countFile,String(count));if(count===1){fs.writeFileSync(path.join(root,"started.txt"),"ready");setInterval(()=>{},1000);}else{const at=process.argv.indexOf("-o");fs.writeFileSync(process.argv[at+1],'{"intent":"none","commands":[]}');}\n`);
  const { child, origin } = await startServer(serverEnv({ CODEX_CLI_PATH:fakeCli }));
  try {
    const page = await fetch(origin), cookie = page.headers.get("set-cookie")?.split(";", 1)[0], headers = { "Content-Type":"application/json", Origin:origin, Cookie:cookie };
    const config=await fetch(`${origin}/api/config`).then(response=>response.json());
    assert.equal(config.aiRequestTimeoutMs,260000);
    const first = fetch(`${origin}/api/ai/command`, { method:"POST", headers, body:JSON.stringify(validPayload()) }).catch(error => error);
    const deadline = Date.now() + 5000;
    while (!fs.existsSync(startedFile) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.ok(fs.existsSync(startedFile));
    const replacement = await fetch(`${origin}/api/ai/command`, { method:"POST", headers, body:JSON.stringify(validPayload()) });
    assert.equal(replacement.status,200);
    const firstOutcome=await first;
    assert.ok(firstOutcome instanceof Error);
    assert.equal(await fs.promises.readFile(countFile, "utf8"), "2");
  } finally {
    await stopServer(child);
    await fs.promises.rm(directory, { recursive:true, force:true });
  }
});

test("rapid Codex requests leave only the newest request active", { timeout: 20000 }, async () => {
  const directory=await fs.promises.mkdtemp(path.join(os.tmpdir(),"penecho-latest-chain-test-")),fakeCli=path.join(directory,"fake-codex.js"),countFile=path.join(directory,"count.txt"),startedFile=path.join(directory,"started.txt");
  await fs.promises.writeFile(fakeCli,`"use strict";const fs=require("node:fs"),path=require("node:path"),countFile=path.join(__dirname,"count.txt"),count=Number(fs.existsSync(countFile)?fs.readFileSync(countFile,"utf8"):0)+1;fs.writeFileSync(countFile,String(count));fs.appendFileSync(path.join(__dirname,"started.txt"),String(count));if(count<3)setInterval(()=>{},1000);else{const at=process.argv.indexOf("-o");fs.writeFileSync(process.argv[at+1],'{"intent":"none","commands":[]}')}\n`);
  const {child,origin}=await startServer(serverEnv({CODEX_CLI_PATH:fakeCli}));
  try{
    const page=await fetch(origin),cookie=page.headers.get("set-cookie")?.split(";",1)[0],base={"Content-Type":"application/json",Origin:origin,Cookie:cookie};
    const first=fetch(`${origin}/api/ai/command`,{method:"POST",headers:base,body:JSON.stringify(validPayload())}).catch(error=>error);
    let deadline=Date.now()+5000;while((!fs.existsSync(startedFile)||fs.readFileSync(startedFile,"utf8").length<1)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
    const second=fetch(`${origin}/api/ai/command`,{method:"POST",headers:base,body:JSON.stringify(validPayload())}).catch(error=>error);
    deadline=Date.now()+5000;while((!fs.existsSync(startedFile)||fs.readFileSync(startedFile,"utf8").length<2)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
    assert.ok(fs.existsSync(startedFile));
    const thirdResponse=await fetch(`${origin}/api/ai/command`,{method:"POST",headers:base,body:JSON.stringify(validPayload())});
    assert.equal(thirdResponse.status,200);
    const firstOutcome=await first,secondOutcome=await second;
    assert.ok(firstOutcome instanceof Error);
    assert.ok(secondOutcome instanceof Error);
    assert.equal(await fs.promises.readFile(countFile,"utf8"),"3");
  }finally{await stopServer(child);await fs.promises.rm(directory,{recursive:true,force:true})}
});

test("Codex LAN mode accepts the machine address and rejects attacker-selected Hosts and origins", { timeout: 20000 }, async () => {
  const lanAddress = Object.values(os.networkInterfaces()).flat().find(entry => !entry.internal && (entry.family === 4 || entry.family === "IPv4"))?.address || os.hostname();
  const { child, origin } = await startServer(serverEnv({ HOST: "0.0.0.0" }));
  try {
    const port = new URL(origin).port;
    const attackerPage = await httpRequest(origin, { headers: { Host: `attacker.example:${port}` } });
    assert.equal(attackerPage.status, 421);
    assert.equal(attackerPage.headers["set-cookie"], undefined);

    const canonicalPage = await httpRequest(origin, { headers: { Host: `${lanAddress}:3888` } }), setCookie = canonicalPage.headers["set-cookie"]?.[0], cookie = setCookie?.split(";", 1)[0];
    assert.equal(canonicalPage.status, 200);
    assert.ok(cookie);

    const firstLocalCookie = (await httpRequest(origin, { headers: { Host:"localhost:3888" } })).headers["set-cookie"]?.[0].split("=",1)[0],
      secondLocalCookie = (await httpRequest(origin, { headers: { Host:"localhost:4000" } })).headers["set-cookie"]?.[0].split("=",1)[0];
    assert.ok(firstLocalCookie);
    assert.ok(secondLocalCookie);
    assert.notEqual(firstLocalCookie,secondLocalCookie);

    const attackerPost = await httpRequest(origin, { method: "POST", pathText: "/api/ai/command", headers: { Host: `attacker.example:${port}`, Origin: `http://attacker.example:${port}`, Cookie: cookie, "Content-Type": "application/json", "Content-Length": 2 }, body: "{}" });
    assert.equal(attackerPost.status, 421);

    const wrongOrigin = await httpRequest(origin, { method: "POST", pathText: "/api/ai/command", headers: { Host: `${lanAddress}:3888`, Origin: "http://attacker.example", Cookie: cookie, "Content-Type": "application/json", "Content-Length": 2 }, body: "{}" });
    assert.equal(wrongOrigin.status, 403);

    const authorized = await httpRequest(origin, { method: "POST", pathText: "/api/ai/command", headers: { Host: `${lanAddress}:3888`, Origin: `http://${lanAddress}:3888`, Cookie: cookie, "Content-Type": "application/json", "Content-Length": 2 }, body: "{}" });
    assert.equal(authorized.status, 400);
  } finally {
    await stopServer(child);
  }
});

test("debug persistence redacts recognized and generated text", { timeout: 20000 }, async () => {
  const marker = `sensitive-${Date.now()}-${Math.random()}`;
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "penecho-redaction-test-")), fakeCli = path.join(directory, "fake-codex.js"), promptFile = path.join(directory, "prompt.txt");
  await fs.promises.writeFile(fakeCli, `"use strict";const fs=require("node:fs"),path=require("node:path");let input="";process.stdin.setEncoding("utf8");process.stdin.on("data",chunk=>input+=chunk);process.stdin.on("end",()=>{fs.writeFileSync(path.join(__dirname,"prompt.txt"),input);const at=process.argv.indexOf("-o");fs.writeFileSync(process.argv[at+1],'{"intent":"none","commands":[]}');});\n`);
  const { child, origin, stateDir } = await startServer(serverEnv({ PENECHO_DEBUG_ARTIFACTS: "true", CODEX_CLI_PATH: fakeCli }));
  try {
    const events = [
      { event: "ai-response", details: { requestId: "10000000-0000-4000-8000-000000000001", intent: "answer", rawCount: 1, attempts: 1, observedText: marker, text: marker, latex: marker } },
      { event: "ai-error", details: { requestId: "10000000-0000-4000-8000-000000000002", action: "answer", error: marker, nested: { value: marker } } },
      { event: "tool-error", details: { requestId: "10000000-0000-4000-8000-000000000003", tool: "write_text", error: marker } },
    ];
    for (const event of events) {
      const response = await fetch(`${origin}/api/debug/client`, { method: "POST", headers: { "Content-Type": "application/json", Origin:origin }, body: JSON.stringify(event) });
      assert.equal(response.status, 204);
    }
    const page = await fetch(origin), cookie = page.headers.get("set-cookie")?.split(";", 1)[0], malformed = validPayload();
    malformed.userAction = { value: marker };
    const malformedResponse = await fetch(`${origin}/api/ai/command`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie }, body: JSON.stringify(malformed) });
    assert.equal(malformedResponse.status, 400);
    const extra = validPayload(), nested = { value: marker };
    extra.atlasSize.extra = nested;
    extra.changedBox.extra = nested;
    extra.visibleRect.extra = nested;
    extra.captureRect.extra = nested;
    extra.sourceRect.extra = nested;
    extra.hotspotGrid.attention = marker;
    extra.hotspotGrid.extra = nested;
    extra.hotspotGrid.hotspots[0].extra = nested;
    extra.hotspotGrid.hotspots[0].imageRect.extra = nested;
    extra.focusInset = { sourceRect:{ x:0, y:0, w:1, h:1, extra:nested }, imageRect:{ x:0, y:0, w:1, h:1, extra:nested }, imageScale:2, purpose:marker, extra:nested };
    const extraResponse = await fetch(`${origin}/api/ai/command`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie }, body: JSON.stringify(extra) }), extraBody = await extraResponse.json();
    assert.equal(extraResponse.status, 200);
    const prompt = await fs.promises.readFile(promptFile, "utf8");
    assert.equal(prompt.includes(marker), false);
    const atlasMetadataPath = path.join(stateDir, "logs", "latest-atlas.json"), deadline = Date.now() + 3000;
    let atlasMetadata = "";
    while (Date.now() < deadline) {
      try { atlasMetadata = await fs.promises.readFile(atlasMetadataPath, "utf8"); } catch {}
      if (atlasMetadata.includes(extraBody.requestId)) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.match(atlasMetadata, new RegExp(extraBody.requestId));
    assert.equal(atlasMetadata.includes(marker), false);
    const log = await fetch(`${origin}/api/debug/log`), text = await log.text();
    assert.equal(log.status, 200);
    assert.match(text, /10000000-0000-4000-8000-000000000001/);
    assert.equal(text.includes(marker), false);
  } finally {
    await stopServer(child);
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});

test("static page keeps strict styles while allowing the pinned MathJax CDN", () => {
  const html = fs.readFileSync(path.join(ROOT, "public", "index.html"), "utf8"), css = fs.readFileSync(path.join(ROOT, "public", "style.css"), "utf8"), app = fs.readFileSync(path.join(ROOT, "public", "app.js"), "utf8"), config=fs.readFileSync(path.join(ROOT,"public","mathjax-config.js"),"utf8"), server=fs.readFileSync(path.join(ROOT,"server.js"),"utf8");
  assert.doesNotMatch(html, /\sstyle=/i);
  assert.match(css, /\.color-blue\s*\{/);
  assert.doesNotMatch(app, /\.style\.|setAttribute\(\s*["']style["']/);
  assert.match(html, /https:\/\/cdn\.jsdelivr\.net\/npm\/mathjax@3\.2\.2\/es5\/tex-svg\.js/);
  assert.match(html, /integrity="sha384-KKWa9jJ1MZvssLeOoXG6FiOAZfAgmzsIIfw8BXwI9\+kYm0lPCbC6yTQPBC00F1\/L"/);
  assert.match(html, /crossorigin="anonymous"/);
  assert.match(config, /fontCache:\s*"none"/);
  assert.match(app, /MathJax\?\.tex2svgPromise/);
  assert.match(server, /script-src 'self' https:\/\/cdn\.jsdelivr\.net/);
  assert.doesNotMatch(app, /newClientRequestId|X-PenEcho-Client-Request|X-PenEcho-Replaces/);
  assert.doesNotMatch(server, /activeCliRequests|pendingCli|cliBusyError|MAX_CONCURRENCY|X-PenEcho-Replaces/);
});

test("API mode uses one configured key without probes or fallback credentials", () => {
  const server=fs.readFileSync(path.join(ROOT,"server.js"),"utf8"),cli=fs.readFileSync(path.join(ROOT,"cli.js"),"utf8"),example=fs.readFileSync(path.join(ROOT,".env.example"),"utf8");
  for(const source of [server,cli,example])assert.doesNotMatch(source,/OPENAI_PRO_API_KEY/);
  assert.doesNotMatch(server,/api-health|api-selection|api-runtime-failure|refreshApiConfig|testApiKey|HEALTH_INTERVAL|HEALTH_TIMEOUT/);
  assert.match(server,/providerRequest\(API_KEY,MODEL,text,atlasImage\)/);
});

test("client and server contain no aggregate draft rejection budget", () => {
  const app=fs.readFileSync(path.join(ROOT,"public","app.js"),"utf8"),draw=fs.readFileSync(path.join(ROOT,"public","draw.js"),"utf8"),server=fs.readFileSync(path.join(ROOT,"server.js"),"utf8");
  for(const source of [app,draw,server])assert.doesNotMatch(source,/Draft destination budget|Draft raster budget|MAX_DRAFT_RASTER_PIXELS|MAX_LOGICAL_PIXELS|MAX_DESTINATION_TILES/);
  assert.doesNotMatch(server,/padded union bounds may total at most|intersect at most 64/);
});
