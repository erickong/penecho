"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const net = require("net");
const { URL } = require("url");
const { callCodexCli } = require("./codex-cli.js");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
loadEnv(path.join(ROOT, ".env"));
const AI_PROVIDER = normalizeAiProvider(process.env.AI_PROVIDER);
const API_BASE_URL = process.env.OPENAI_API_URL;
const API_FORMAT = process.env.OPENAI_API_FORMAT?.toLowerCase();
const MAX_BODY = 9 * 1024 * 1024;
const LOG_DIR = process.env.PENECHO_STATE_DIR ? path.resolve(process.env.PENECHO_STATE_DIR, "logs") : path.join(ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, "penecho.log");
const MAX_LOG = 2 * 1024 * 1024;
const CANVAS_SIZE = 20000;
const debugRate = new Map();
const MODEL = process.env.OPENAI_MODEL;
const API = resolveApiConfig(API_BASE_URL, API_FORMAT);
const HEALTH_INTERVAL = 10 * 60 * 1000;
const HEALTH_TIMEOUT = 6000;
const autoDelayValue = process.env.AUTO_AI_DELAY_SECONDS?.trim();
const configuredAutoDelay = autoDelayValue ? Number(autoDelayValue) : NaN;
const AUTO_AI_DELAY_MS = Number.isFinite(configuredAutoDelay) && configuredAutoDelay >= 0 && configuredAutoDelay <= 60 ? Math.round(configuredAutoDelay * 1000) : 1200;
const debugArtifactsValue = optionalBoolean(process.env.PENECHO_DEBUG_ARTIFACTS);
const DEBUG_ARTIFACTS = debugArtifactsValue === true;
const codexTimeoutText = process.env.CODEX_CLI_TIMEOUT_SECONDS?.trim(),
  codexTimeoutValue = codexTimeoutText ? Number(codexTimeoutText) : 90,
  codexTimeoutValid = Number.isFinite(codexTimeoutValue) && codexTimeoutValue >= 10 && codexTimeoutValue <= 300,
  codexConcurrencyText = process.env.CODEX_CLI_MAX_CONCURRENCY?.trim(),
  codexConcurrencyValue = codexConcurrencyText ? Number(codexConcurrencyText) : 1,
  codexConcurrencyValid = Number.isInteger(codexConcurrencyValue) && codexConcurrencyValue >= 1 && codexConcurrencyValue <= 8;
const CODEX_CLI = {
  executable: process.env.CODEX_CLI_PATH?.trim() || "codex",
  model: process.env.CODEX_CLI_MODEL?.trim() || null,
  timeoutMs: codexTimeoutValid ? Math.round(codexTimeoutValue * 1000) : 90000,
  maxConcurrency: codexConcurrencyValid ? codexConcurrencyValue : 1,
};
const AI_REQUEST_TIMEOUT_MS = AI_PROVIDER === "codex-cli" ? CODEX_CLI.timeoutMs * 2 + 20000 : 190000;
const AI_SESSION_COOKIE_PREFIX = "penecho_ai_session";
const AI_SESSION_TOKEN = crypto.randomBytes(32).toString("base64url");
let activeApi = null, healthCheckPromise = null, activeCodexRequests = 0;
const activeCodexClientRequests = new Map(), pendingCodexClientRequests = new Set(), recentlyCancelledCodexRequests = new Map(), consumedCodexReplacements = new Map();

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

function normalizeAiProvider(value) {
  const provider = String(value || "api").trim().toLowerCase();
  if (provider === "api") return "api";
  if (["codex", "codex-cli"].includes(provider)) return "codex-cli";
  return null;
}

function optionalBoolean(value) {
  if (value === undefined || String(value).trim() === "") return false;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function providerConfigurationError() {
  if (!AI_PROVIDER) return "AI_PROVIDER must be api or codex-cli.";
  if (AI_PROVIDER === "api" && (!API || !MODEL)) return "Server must configure a valid OPENAI_API_URL base URL and OPENAI_MODEL. OPENAI_API_FORMAT, when set, must be openai or anthropic.";
  if (AI_PROVIDER === "api" && !process.env.OPENAI_API_KEY && !process.env.OPENAI_PRO_API_KEY) return "Server is missing API credentials.";
  if (debugArtifactsValue === null) return "PENECHO_DEBUG_ARTIFACTS must be true or false when set.";
  if (AI_PROVIDER === "codex-cli" && !codexTimeoutValid) return "CODEX_CLI_TIMEOUT_SECONDS must be between 10 and 300.";
  if (AI_PROVIDER === "codex-cli" && !codexConcurrencyValid) return "CODEX_CLI_MAX_CONCURRENCY must be an integer between 1 and 8.";
  return null;
}

function resolveApiConfig(value, formatOverride) {
  if (!value) return null;
  if (formatOverride && !["openai", "anthropic"].includes(formatOverride)) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    url.hash = "";
    const basePath = url.pathname.replace(/\/+$/, ""), path = basePath.toLowerCase();
    if (path.endsWith("/v1/messages")) {
      url.pathname = basePath;
      return { format: "anthropic", endpoint: url.href };
    }
    if (path.endsWith("/chat/completions")) {
      url.pathname = basePath;
      return { format: "openai", endpoint: url.href };
    }
    const openaiBase = path.endsWith("/v1") || /\/(?:v1beta\/)?openai$/i.test(path),
      format = formatOverride || (openaiBase ? "openai" : "anthropic");
    if (format === "openai") {
      url.pathname = `${basePath}/chat/completions`;
      return { format: "openai", endpoint: url.href };
    }
    url.pathname = `${basePath}/v1/messages`;
    return { format: "anthropic", endpoint: url.href };
  } catch {
    return null;
  }
}

function providerRequest(key, model, text, atlasImage = null) {
  if (API.format === "anthropic") {
    const content = atlasImage
      ? [
          { type: "text", text },
          { type: "image", source: { type: "base64", media_type: "image/png", data: atlasImage.slice(atlasImage.indexOf(",") + 1) } },
        ]
      : text;
    return {
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: atlasImage ? 4096 : 10, temperature: atlasImage ? 0.15 : 0, ...(atlasImage ? { system: ACTIVE_SYSTEM_PROMPT } : {}), messages: [{ role: "user", content }] }),
    };
  }
  const messages = atlasImage
    ? [{ role: "system", content: ACTIVE_SYSTEM_PROMPT }, { role: "user", content: [{ type: "text", text }, { type: "image_url", image_url: { url: atlasImage, detail: "high" } }] }]
    : [{ role: "user", content: text }];
  return {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, ...(atlasImage ? { temperature: 0.15, response_format: { type: "json_object" } } : { max_tokens: 10, temperature: 0 }), messages }),
  };
}

function providerResponseText(raw) {
  if (API.format === "anthropic") return Array.isArray(raw?.content) ? raw.content.filter((block) => block?.type === "text").map((block) => block.text || "").join("\n") : "";
  const content = raw?.choices?.[0]?.message?.content;
  return Array.isArray(content) ? content.map((part) => part?.text || "").join("\n") : content || "";
}

const SYSTEM_PROMPT = `You are the drawing brain for a general interactive handwritten visual Q&A board, not only a math board. Return strict JSON only: {"intent":"none|hint|continue|explain|plot|correct|erase|answer","observedText":"what you can read, optional","message":"short optional","commands":[...]}. Recognize and reason about handwritten natural-language questions (Chinese and English), mathematics, diagrams, charts, sketches, and mixed content. When content is a question, greeting, conversational message, or request, actively respond; do NOT return intent none simply because it is not mathematics. Inspect actual image pixels carefully. For auto, give a useful but short response when enough information exists. A manual action is a style preference, not permission to ignore content. Never draw system status, recognition failure, retry, or debugging messages. For an actual problem, hint gives a concise clue; continue continues the user's work; explain explains it; plot creates a relevant graph; answer answers directly. Use write_text for ordinary knowledge and conversation; draw_formula for math notation; draw or plot_function only when a visual helps. Keep each write_text response at no more than about 200 tokens and 800 characters.

The attached image is a clean white-background rendering of confirmed canvas content around the newest input. It may come from outside the user's current viewport. sourceRect is the image's full-resolution global canvas rectangle and imageScale maps global units to image pixels: imageX=(globalX-sourceRect.x)*imageScale and imageY=(globalY-sourceRect.y)*imageScale. latestInput.imageRect is the AUTHORITATIVE attention region for this request. First transcribe the newest user ink in that region and put only that transcription in observedText. Older content may overlap the rectangle, so use the current hotspot trajectory and visible stroke continuity to distinguish the newest writing. Pixels outside that rectangle are older context or confirmed AI output. Do not combine outside text into observedText unless the latest input visually refers to it. hotspotGrid.hotspots contains only the current unconsumed user-writing segment, ordered oldest to newest; use it only to refine reading order inside latestInput.imageRect. Confirmed AI output can appear in the image but is not part of the user hotspot trajectory. When focusInset is present, its imageRect is a magnified duplicate of the latest handwriting, not additional content. Use that inset as the primary transcription view, then cross-check the original latestInput.imageRect for spatial context.

Chinese handwriting requires deliberate character-by-character inspection. For likely Chinese text, inspect stroke groups, radicals, character spacing, punctuation, and neighboring semantic constraints before deciding each character. Prefer common Simplified Chinese forms unless the pixels clearly indicate Traditional Chinese. Distinguish visually similar characters instead of guessing from a single stroke, and use the magnified focusInset whenever available. Do not let interface language or older context replace pixel evidence. If one character remains ambiguous, resolve it from the full phrase and question structure rather than silently changing the sentence topic.

Interpret spatial editing gestures as instructions, not ordinary sentence text. A hand-drawn box or circle selects/references the content inside it. An arrow connects the selected source to a destination. Labels near the arrow such as "more", "detail", "expand", "explain", "why", "详细", "展开", or "解释" request a fuller explanation of the selected content; they should not be copied into the response. Respond in the language of the newest substantive user content. If the newest input is only a spatial control label such as "more" or "详细", follow the language of the selected or referenced content. Preserve intentional mixed-language terminology when useful. Never choose a response language from the interface language alone. Follow an arrow chain to its final arrowhead and place the explanation in the clear space immediately beyond that final arrowhead.

modelInput.persona is optional specialization guidance. Use it to choose technical emphasis, reasoning method, examples, terminology, and answer structure as well as tone. It must never override the user's request, the response-language policy, factual rigor, these instructions, or safety requirements.

For userAction plot, always return at least one visual command. If the handwriting contains y=f(x), f(x)=..., or a recognizable single-variable function, use plot_function rather than only draw_formula or write_text. plot_function.expression must be a browser-evaluable ASCII expression using x, numbers, + - * / ^, parentheses, pi, e, and supported functions sin, cos, tan, sqrt, abs, exp, log, or ln. Use explicit multiplication such as 3*x, not 3x. Make each plot_function at least 240 by 180, keep its aspect ratio between 1:6 and 6:1, and prefer a moderate size near 1200 by 800. For a requested non-function drawing or diagram, use draw. Never satisfy plot with prose alone.

You are responsible for text layout. Every write_text command MUST explicitly choose x and y as the top-left start position and maxWidth as the intended initial wrapping width. Inspect the image and choose the blank area where the response is most useful. Do not mechanically append text at the end of the newest handwriting. For arrow/box requests, align x/y with the arrow destination. For ordinary questions, choose a nearby blank area that preserves reading flow and avoids all existing writing. The chosen x/y must normally remain inside captureRect and near latestInput.globalRect or the final arrow destination. Never place an explanation at canvas y=0 or at the top edge merely because that area is blank when the referenced content is far below. maxWidth must fit the available blank region and should usually be wide enough for readable paragraphs; the user may freely resize the draft afterward. Match fontSize approximately to nearby handwriting; lineHeight is a multiplier such as 1.35, not pixels. Do not return color for write_text, draw_formula, plot_function, or draw; the client applies the user's selected AI color. The logical canvas is 20000 by 20000. ALL returned coordinates must be finite global logical coordinates, never image coordinates. If genuinely unreadable or incomplete, return {"intent":"none","commands":[]}. Every command MUST identify its tool with property "tool". Available tools: write_text {tool:"write_text",x,y,text,fontSize,maxWidth,lineHeight}; draw_formula {tool:"draw_formula",x,y,latex,fontSize}; plot_function {tool:"plot_function",x,y,w,h,expression}; draw {tool:"draw",origin:[x,y],types:["line|smooth|rect|ellipse|circle|arc",...],items:[[...],...],width?,tension?,closed?,fill?,arrows?}; erase {tool:"erase",mode:"rect",x,y,w,h} or {tool:"erase",mode:"path",points:[[x,y],...],size}. Keep within canvas, use at most 16 commands, short text/formula, and strict JSON only: no markdown, image, or prose outside JSON.`;

const ACTIVE_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

Use only this unified draw syntax; do not invent alternate shape tools. One draw command may mix many primitives and is edited as one draft. origin is one global [x,y] integer pair near the diagram; coordinate and size values in items are integers relative to that origin, while arc angles are integer degrees. types and items must have the same length and matching zero-based indices. Encodings: line and smooth use [x1,y1,x2,y2,...] with at least two points; rect uses [x,y,w,h] from its top-left with positive w/h; ellipse uses [cx,cy,rx,ry] with positive radii; circle uses [cx,cy,r]; arc uses [cx,cy,rx,ry,startDeg,sweepDeg] with positive radii and nonzero signed sweep. Arc angle 0 points right; because canvas y increases downward, a positive sweep is clockwise and a negative sweep is counter-clockwise. line connects points in order. smooth automatically passes through its points. closed lists line/smooth item indices to close. fill lists closed line/smooth, rect, ellipse, or circle indices to fill translucently. arrows lists line, smooth, or arc indices that receive an arrowhead at the end; an arrowed path must have a nonzero final direction. Omit empty index arrays. width is an optional integer 2..200, default 30. tension is an optional integer 0..100 for smooth items, default 50. Use at most 64 items. Keep all resulting geometry inside the 20000 by 20000 canvas. Prefer exactly one draw command for a coherent diagram to avoid repeated JSON and global coordinates. Example: {"tool":"draw","origin":[9000,7000],"types":["line","smooth","rect","ellipse","circle","arc"],"items":[[0,0,300,0,300,200],[400,200,500,100,600,200],[700,0,300,200],[1200,100,180,100],[1600,100,90],[1900,100,160,100,180,180]],"arrows":[0],"fill":[2]}.`;

const THEME_PERSONAS = {
  research: "Rigorous mathematical-physics research and teaching mentor. Prioritize assumptions, derivations, units, physical interpretation, proofs, and verifiable code or numerical checks when useful. Be concise but academically precise; never claim to literally be Einstein unless asked for roleplay.",
  scifi: "Pragmatic futuristic engineering copilot. Prioritize programming, debugging, algorithms, architecture, systems thinking, quantitative tradeoffs, and plausible emerging technology. Give concise, actionable answers rather than decorative sci-fi prose.",
  arcane: "Warm interdisciplinary knowledge guide. Favor intuition, memorable analogies, creative synthesis, conceptual connections across science and humanities, and exploratory alternatives while keeping facts and reasoning precise.",
};

function send(res, code, data, type = "application/json; charset=utf-8") { res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(typeof data === "string" ? data : JSON.stringify(data)); }
function readJson(req, limit = MAX_BODY) { return new Promise((resolve, reject) => { let size = 0, chunks = []; req.on("data", c => { size += c.length; if (size > limit) { reject(new Error("Request too large")); req.destroy(); } else chunks.push(c); }); req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new Error("Invalid JSON")); } }); req.on("error", reject); }); }
function log(entry) { try { fs.mkdirSync(LOG_DIR, { recursive:true }); if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size >= MAX_LOG) { try { fs.renameSync(LOG_FILE, `${LOG_FILE}.1`); } catch { fs.truncateSync(LOG_FILE, 0); } } fs.appendFileSync(LOG_FILE, JSON.stringify({ time:new Date().toISOString(), ...entry }) + "\n"); } catch (error) { console.error("PenEcho log error:", error.message); } }
function short(value, length = 20000) { return typeof value === "string" ? value.slice(0, length) : value; }
function allowDebug(ip) { const now=Date.now(), item=debugRate.get(ip); if (!item || now-item.started > 60000) { debugRate.set(ip,{started:now,count:1}); return true; } item.count++; return item.count <= 60; }
const DEBUG_TOOLS = new Set(["write_text", "draw_formula", "plot_function", "draw", "erase"]),
  DEBUG_ACTIONS = new Set(["auto", "hint", "continue", "explain", "plot", "answer"]),
  DEBUG_INTENTS = new Set(["none", "hint", "continue", "explain", "plot", "correct", "erase", "answer"]),
  DEBUG_REASONS = new Set(["new-stroke-deadline", "user-revision-changed", "request-superseded", "stale-request-error", "animation-cancelled"]),
  DEBUG_ERRORS = new Set(["timeout", "http-error", "request-error", "render-error"]);
function finiteDebugNumber(value) { return Number.isFinite(value) ? value : undefined; }
function finiteDebugBox(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const box = {};
  for (const key of ["x", "y", "w", "h"]) if (Number.isFinite(value[key])) box[key] = value[key];
  return Object.keys(box).length ? box : undefined;
}
function finiteDebugSize(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const size = {};
  for (const key of ["w", "h", "min", "max"]) if (Number.isFinite(value[key])) size[key] = value[key];
  return Object.keys(size).length ? size : undefined;
}
function sanitizedDebugDetails(event, details) {
  const requestId = typeof details.requestId === "string" && /^[0-9a-f-]{36}$/i.test(details.requestId) ? details.requestId : undefined,
    tool = DEBUG_TOOLS.has(details.tool) ? details.tool : undefined,
    number = key => finiteDebugNumber(details[key]), box = key => finiteDebugBox(details[key]);
  if (event === "atlas-built") return { scope:"visible-content", visibleRect:box("visibleRect"), captureRect:box("captureRect"), sourceRect:box("sourceRect"), imageSize:finiteDebugSize(details.imageSize), imageScale:number("imageScale"), latestBox:box("latestBox"), hotspots:number("hotspots") };
  if (event === "ai-response") return { requestId, intent:DEBUG_INTENTS.has(details.intent)?details.intent:undefined, rawCount:number("rawCount"), attempts:number("attempts") };
  if (event === "ai-error") return { requestId, action:DEBUG_ACTIONS.has(details.action)?details.action:undefined, error:DEBUG_ERRORS.has(details.error)?details.error:"request-error" };
  if (event === "commands-validated") return { requestId, rawCount:number("rawCount"), validCount:number("validCount"), rejectedCount:number("rejectedCount"), tools:Array.isArray(details.tools)?details.tools.filter(item=>DEBUG_TOOLS.has(item)).slice(0,16):[] };
  if (event === "tool-start") return { requestId, tool, x:number("x"), y:number("y"), fontSize:number("fontSize"), maxWidth:number("maxWidth"), batch:details.batch===true };
  if (event === "tool-complete") return { requestId, tool, x:number("x"), y:number("y"), batch:details.batch===true, acceptedCount:number("acceptedCount"), discardedCount:number("discardedCount") };
  if (event === "tool-error") return { requestId, tool, error:"render-error" };
  if (event === "tool-layout-adjusted") return { requestId, tool, x:number("x"), originalY:number("originalY"), y:number("y"), width:number("width"), height:number("height") };
  if (event === "stroke-summary") return { pointerType:["mouse","pen","touch"].includes(details.pointerType)?details.pointerType:undefined, points:number("points"), screenDistance:number("screenDistance"), logicalBbox:box("logicalBbox"), scale:number("scale"), widthCss:finiteDebugSize(details.widthCss) };
  if (event === "stroke-outside-canvas") return { x:number("x"), y:number("y"), scale:number("scale") };
  if (event === "ai-deferred") return { requestId, reason:DEBUG_REASONS.has(details.reason)?details.reason:undefined };
  return {};
}
async function testApiKey(key, label, externalSignal = null) {
  if (!key) return false;
  const started=Date.now(),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),HEALTH_TIMEOUT);
  const abortFromClient=()=>controller.abort();
  if(externalSignal?.aborted)controller.abort();
  else externalSignal?.addEventListener("abort",abortFromClient,{once:true});
  try {
    const request = providerRequest(key, MODEL, "hi"),
      response=await fetch(API.endpoint,{signal:controller.signal,method:"POST",redirect:"error",...request});
    log({type:"api-health",label,format:API.format,model:MODEL,ok:response.ok,status:response.status,elapsedMs:Date.now()-started});
    return response.ok;
  } catch(error) {
    if(externalSignal?.aborted)throw error;
    log({type:"api-health",label,model:MODEL,ok:false,elapsedMs:Date.now()-started,error:error?.name==="AbortError"?"timeout":"request-failed"});
    return false;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort",abortFromClient);
  }
}
function refreshApiConfig(skipLabel = null, externalSignal = null) {
  if (!API || !MODEL) {
    activeApi = null;
    return Promise.resolve(null);
  }
  if (!externalSignal && healthCheckPromise) return healthCheckPromise;
  const check=(async()=>{
    const candidates=[{label:"primary",key:process.env.OPENAI_API_KEY},{label:"pro",key:process.env.OPENAI_PRO_API_KEY}].filter(candidate=>candidate.label!==skipLabel);
    let selected=null;
    for(const candidate of candidates){
      if(externalSignal?.aborted)throw Object.assign(Error("Request aborted"),{name:"AbortError"});
      if(await testApiKey(candidate.key,candidate.label,externalSignal)){selected={...candidate,model:MODEL};break}
    }
    if(externalSignal?.aborted)throw Object.assign(Error("Request aborted"),{name:"AbortError"});
    activeApi=selected;
    log({type:"api-selection",label:selected?.label||null,model:MODEL,available:Boolean(selected)});
    return selected;
  })();
  if(externalSignal)return check;
  healthCheckPromise=check.finally(()=>{healthCheckPromise=null});
  return healthCheckPromise;
}
async function ensureApiConfig(signal){if(!API||!MODEL)throw Error("OPENAI_API_URL must be a valid base URL, OPENAI_API_FORMAT must be openai or anthropic when set, and OPENAI_MODEL must be configured.");return activeApi||await refreshApiConfig(null,signal)}
function validPayload(p) {
  const validImage = value => typeof value === "string" && value.length <= 8 * 1024 * 1024 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
  const image = validImage(p?.atlasImage);
  const validBox = b => b && typeof b === "object" && [b.x,b.y,b.w,b.h].every(Number.isFinite) && b.x >= 0 && b.y >= 0 && b.w > 0 && b.h > 0 && b.x + b.w <= CANVAS_SIZE && b.y + b.h <= CANVAS_SIZE;
  const grid=p?.hotspotGrid,size=p?.atlasSize,source=p?.sourceRect,capture=p?.captureRect,contains=(outer,inner)=>inner.x>=outer.x&&inner.y>=outer.y&&inner.x+inner.w<=outer.x+outer.w+.001&&inner.y+inner.h<=outer.y+outer.h+.001,validGrid=grid&&grid.columns===8&&grid.rows===8&&grid.order==="oldest-to-newest"&&Array.isArray(grid.hotspots)&&grid.hotspots.length<=64&&grid.hotspots.every(h=>Array.isArray(h?.cell)&&h.cell.length===2&&Number.isInteger(h.cell[0])&&Number.isInteger(h.cell[1])&&h.cell[0]>=0&&h.cell[0]<8&&h.cell[1]>=0&&h.cell[1]<8&&h.imageRect&&[h.imageRect.x,h.imageRect.y,h.imageRect.w,h.imageRect.h].every(Number.isFinite)&&h.imageRect.x>=0&&h.imageRect.y>=0&&h.imageRect.w>0&&h.imageRect.h>0&&h.imageRect.x+h.imageRect.w<=size?.w+1&&h.imageRect.y+h.imageRect.h<=size?.h+1),validGeometry=validBox(p?.changedBox)&&validBox(p?.visibleRect)&&validBox(capture)&&validBox(source)&&contains(capture,source)&&contains(source,p.changedBox),validSize=validGeometry&&Number.isFinite(p.imageScale)&&p.imageScale>0&&p.imageScale<=1&&Number.isInteger(size?.w)&&Number.isInteger(size?.h)&&size.w>0&&size.w<=2048&&size.h>0&&size.h<=1536&&size.w===Math.ceil(source.w*p.imageScale)&&size.h===Math.ceil(source.h*p.imageScale),inset=p?.focusInset,validInset=inset===null||inset===undefined||(validBox(inset.sourceRect)&&contains(source,inset.sourceRect)&&inset.imageRect&&[inset.imageRect.x,inset.imageRect.y,inset.imageRect.w,inset.imageRect.h].every(Number.isFinite)&&inset.imageRect.x>=0&&inset.imageRect.y>=0&&inset.imageRect.w>0&&inset.imageRect.h>0&&inset.imageRect.x+inset.imageRect.w<=size?.w&&inset.imageRect.y+inset.imageRect.h<=size?.h&&Number.isFinite(inset.imageScale)&&inset.imageScale>p.imageScale&&inset.imageScale<=3),validTheme=Object.hasOwn(THEME_PERSONAS,p?.uiTheme),validPersona=validTheme&&p?.persona===THEME_PERSONAS[p.uiTheme],validAction=DEBUG_ACTIONS.has(p?.userAction),validTrigger=p?.trigger==="user_paused"&&p.userAction==="auto"||p?.trigger==="manual"&&validAction&&p.userAction!=="auto";
  return p && typeof p === "object" && p.canvasSize?.w === CANVAS_SIZE && p.canvasSize?.h === CANVAS_SIZE && validGeometry && validSize && validGrid && validInset && validTheme && validPersona && validAction && validTrigger && image;
}
function canonicalPayload(p) {
  const box = value => ({ x:value.x, y:value.y, w:value.w, h:value.h });
  return {
    atlasImage:p.atlasImage,
    atlasSize:{ w:p.atlasSize.w, h:p.atlasSize.h },
    imageScale:p.imageScale,
    changedBox:box(p.changedBox),
    visibleRect:box(p.visibleRect),
    captureRect:box(p.captureRect),
    sourceRect:box(p.sourceRect),
    focusInset:p.focusInset ? { sourceRect:box(p.focusInset.sourceRect), imageRect:box(p.focusInset.imageRect), imageScale:p.focusInset.imageScale, purpose:"magnified duplicate of latestInput for handwriting transcription only" } : null,
    hotspotGrid:{ columns:8, rows:8, order:"oldest-to-newest", attention:"use only to refine reading order inside latestInput.imageRect", hotspots:p.hotspotGrid.hotspots.map(h=>({ cell:[h.cell[0],h.cell[1]], imageRect:box(h.imageRect) })) },
    trigger:p.trigger,
    userAction:p.userAction,
    canvasSize:{ w:CANVAS_SIZE, h:CANVAS_SIZE },
    uiTheme:p.uiTheme,
    persona:THEME_PERSONAS[p.uiTheme],
  };
}
function encodedImageSize(dataUrl){
  const buffer=Buffer.from(dataUrl.slice(dataUrl.indexOf(",")+1),"base64");
  if(dataUrl.startsWith("data:image/png")&&buffer.length>=24&&buffer.toString("ascii",1,4)==="PNG")return{w:buffer.readUInt32BE(16),h:buffer.readUInt32BE(20)};
  return null;
}
function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function latestInputMetadata(changedBox,sourceRect,imageScale,imageSize){
  const left=Math.max(changedBox.x,sourceRect.x),top=Math.max(changedBox.y,sourceRect.y),right=Math.min(changedBox.x+changedBox.w,sourceRect.x+sourceRect.w),bottom=Math.min(changedBox.y+changedBox.h,sourceRect.y+sourceRect.h);
  if(right<=left||bottom<=top)return null;
  const pad=4,x=Math.max(0,Math.floor((left-sourceRect.x)*imageScale)-pad),y=Math.max(0,Math.floor((top-sourceRect.y)*imageScale)-pad),imageRight=Math.min(imageSize.w,Math.ceil((right-sourceRect.x)*imageScale)+pad),imageBottom=Math.min(imageSize.h,Math.ceil((bottom-sourceRect.y)*imageScale)+pad);
  return{globalRect:changedBox,imageRect:{x,y,w:Math.max(1,imageRight-x),h:Math.max(1,imageBottom-y)}};
}
function isLoopback(address) { return address === "::1" || address === "127.0.0.1" || address === "::ffff:127.0.0.1"; }
function isLoopbackHostname(hostname) { return ["localhost", "127.0.0.1", "::1", "[::1]", "::ffff:127.0.0.1", "[::ffff:127.0.0.1]"].includes(String(hostname || "").toLowerCase().replace(/\.$/, "")); }
const LOCAL_HOSTNAMES = new Set([os.hostname(), `${os.hostname()}.local`].map(value => value.toLowerCase().replace(/\.$/, "")));
const LOCAL_INTERFACE_ADDRESSES = new Set();
const LOCAL_NETWORKS = new net.BlockList();
for (const entries of Object.values(os.networkInterfaces())) {
  for (const entry of entries || []) {
    const family = entry.family === 4 || entry.family === "IPv4" ? "ipv4" : entry.family === 6 || entry.family === "IPv6" ? "ipv6" : null,
      address = String(entry.address || "").split("%", 1)[0];
    if (!family || !address) continue;
    LOCAL_INTERFACE_ADDRESSES.add(address.toLowerCase());
    const prefix = Number(String(entry.cidr || "").split("/")[1]);
    if (Number.isInteger(prefix)) {
      try { LOCAL_NETWORKS.addSubnet(address, prefix, family); } catch {}
    }
  }
}
function normalizedIp(value) {
  const address = String(value || "").toLowerCase().split("%", 1)[0];
  return address.startsWith("::ffff:") && net.isIP(address.slice(7)) === 4 ? address.slice(7) : address;
}
function isLanClient(address) {
  const ip = normalizedIp(address), version = net.isIP(ip);
  if (!version) return false;
  if (isLoopback(ip)) return true;
  return LOCAL_NETWORKS.check(ip, version === 4 ? "ipv4" : "ipv6");
}
function isAllowedCodexHost(hostname) {
  const value = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "").split("%", 1)[0];
  return isLoopbackHostname(value) || LOCAL_HOSTNAMES.has(value) || LOCAL_INTERFACE_ADDRESSES.has(value);
}
function requestHost(req) {
  const value = typeof req.headers.host === "string" ? req.headers.host.trim() : "";
  if (!value || value.includes("/") || value.includes("\\") || value.includes("@")) return null;
  try {
    const url = new URL(`http://${value}`);
    return url.pathname === "/" && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}
function hostMatchesOrigin(host, origin) {
  if (!host || !origin || host.hostname.toLowerCase() !== origin.hostname.toLowerCase()) return false;
  if (origin.port) return host.port === origin.port;
  const defaultPort = origin.protocol === "https:" ? "443" : "80";
  return !host.port || host.port === defaultPort;
}
function canonicalRequestOrigin(req) {
  const host = requestHost(req);
  if (!host) return null;
  if (AI_PROVIDER !== "codex-cli") return new URL(`http://${host.host}`);
  return isAllowedCodexHost(host.hostname) ? new URL(`http://${host.host}`) : null;
}
function aiSessionCookieName(req) {
  const host = canonicalRequestOrigin(req)?.host.toLowerCase();
  if (!host) return null;
  return `${AI_SESSION_COOKIE_PREFIX}_${crypto.createHash("sha256").update(host).digest("hex").slice(0, 12)}`;
}
function hasAiSession(req) {
  const name = aiSessionCookieName(req);
  if (!name) return false;
  const cookie = String(req.headers.cookie || "").split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  if (!cookie) return false;
  const value = cookie.slice(name.length + 1), actual = Buffer.from(value), expected = Buffer.from(AI_SESSION_TOKEN);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function browserRequestError(req, requireSession = true) {
  const host = requestHost(req), expectedOrigin = canonicalRequestOrigin(req), originText = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  if (!expectedOrigin) return "AI requests require the configured PenEcho host.";
  let origin;
  try { origin = new URL(originText); } catch { return "AI requests require a same-origin PenEcho browser session."; }
  const sameOrigin = isLoopbackHostname(host.hostname) ? isLoopbackHostname(origin.hostname) && hostMatchesOrigin(host, origin) : origin.origin === expectedOrigin.origin;
  if (!sameOrigin || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || requireSession && !hasAiSession(req)) return "AI requests require a same-origin PenEcho browser session.";
  return null;
}
function aiSessionCookie(req) {
  const name = aiSessionCookieName(req);
  if (!name) return null;
  const secure = canonicalRequestOrigin(req)?.protocol === "https:" ? "; Secure" : "";
  return `${name}=${AI_SESSION_TOKEN}; Path=/api/ai/command; HttpOnly; SameSite=Strict${secure}`;
}
function codexBusyError() {
  const error = new Error("Codex CLI is busy. Try again after the current local request finishes.");
  error.status = 503;
  return error;
}
function pruneCodexReplacementTokens() {
  const now=Date.now();
  for(const [id,expires] of recentlyCancelledCodexRequests)if(expires<=now)recentlyCancelledCodexRequests.delete(id);
  for(const [id,expires] of consumedCodexReplacements)if(expires<=now)consumedCodexReplacements.delete(id);
}
async function waitForCodexCondition(signal, deadline, condition) {
  while (!condition()) {
    if (signal.aborted) throw Object.assign(new Error("Request aborted"), { name:"AbortError" });
    if (Date.now() >= deadline) throw codexBusyError();
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
async function acquireCodexSlot(controller, clientRequestId, replacementId) {
  const signal=controller.signal;
  pruneCodexReplacementTokens();
  const validReplacement=replacementId&&!consumedCodexReplacements.has(replacementId)&&(activeCodexClientRequests.has(replacementId)||recentlyCancelledCodexRequests.has(replacementId));
  if(clientRequestId&&(activeCodexClientRequests.has(clientRequestId)||recentlyCancelledCodexRequests.has(clientRequestId)||consumedCodexReplacements.has(clientRequestId))){const error=new Error("Client request ID is already in use.");error.status=409;throw error}
  if(replacementId&&!validReplacement){const error=new Error("Replacement request is no longer eligible.");error.status=409;throw error}
  if(validReplacement){consumedCodexReplacements.set(replacementId,Date.now()+15000);recentlyCancelledCodexRequests.delete(replacementId);const previous=activeCodexClientRequests.get(replacementId);if(previous&&!previous.signal.aborted)previous.abort()}
  if(clientRequestId)activeCodexClientRequests.set(clientRequestId,controller);
  if (activeCodexRequests < CODEX_CLI.maxConcurrency) {
    activeCodexRequests++;return;
  }
  if (!validReplacement) throw codexBusyError();
  const deadline = Date.now() + Math.min(10000, CODEX_CLI.timeoutMs);
  if(pendingCodexClientRequests.size>=CODEX_CLI.maxConcurrency){
    if(!pendingCodexClientRequests.has(replacementId))throw codexBusyError();
    await waitForCodexCondition(signal,deadline,()=>!pendingCodexClientRequests.has(replacementId)&&pendingCodexClientRequests.size<CODEX_CLI.maxConcurrency);
  }
  pendingCodexClientRequests.add(clientRequestId);
  try {
    await waitForCodexCondition(signal,deadline,()=>activeCodexRequests<CODEX_CLI.maxConcurrency);
    if (signal.aborted) throw Object.assign(new Error("Request aborted"), { name:"AbortError" });
    activeCodexRequests++;
  } finally { pendingCodexClientRequests.delete(clientRequestId); }
}
function extractJson(text) { const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i); const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1); return JSON.parse(candidate); }
function parsedModelResponse(content) {
  const result=extractJson(content);
  if (!result || typeof result!=="object" || Array.isArray(result)) throw new Error("Model returned a non-object JSON response.");
  if (result.commands===undefined) result.commands=[];
  if (!Array.isArray(result.commands)) throw new Error("Model response commands must be an array.");
  return result;
}
function saveLatestAtlas(dataUrl, metadata) {
  if (!DEBUG_ARTIFACTS) return;
  setImmediate(() => {
    try {
      fs.mkdirSync(LOG_DIR, { recursive:true });
      const base64=dataUrl.slice(dataUrl.indexOf(",")+1);
      fs.writeFile(path.join(LOG_DIR,"latest-atlas.png"),Buffer.from(base64,"base64"),error=>{if(error)log({type:"debug-atlas-error",error:"write-failed"})});
      fs.writeFile(path.join(LOG_DIR,"latest-atlas.json"),JSON.stringify(metadata,null,2),error=>{if(error)log({type:"debug-atlas-error",error:"write-failed"})});
    } catch { log({type:"debug-atlas-error",error:"write-failed"}); }
  });
}
async function callModel(modelInput, atlasImage, retryInstruction="", externalSignal = null) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), AI_PROVIDER === "codex-cli" ? CODEX_CLI.timeoutMs : 90000);
  const abortFromClient = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener("abort", abortFromClient, { once: true });
  try {
    const text = retryInstruction ? `${JSON.stringify(modelInput)}\n\n${retryInstruction}` : JSON.stringify(modelInput);
    if (AI_PROVIDER === "codex-cli") {
      const prompt = `${ACTIVE_SYSTEM_PROMPT}\n\nOperate only as an image-analysis model for PenEcho. Do not inspect files, run commands, or modify the temporary workspace. Analyze the attached canvas image and return only the requested JSON object as your final response.\n\nRequest metadata:\n${text}`;
      try {
        const content=await callCodexCli({ ...CODEX_CLI, prompt, atlasImage, signal:controller.signal });
        return {content,result:parsedModelResponse(content),status:200,provider:"codex-cli",model:CODEX_CLI.model||"configured-default",label:"codex-cli"};
      } catch (error) {
        if (DEBUG_ARTIFACTS && error.diagnostic) log({type:"codex-cli-error",error:"process-failed",diagnosticBytes:Buffer.byteLength(error.diagnostic)});
        if (error.cleanupDiagnostic) log({type:"codex-cli-cleanup-error",error:"cleanup-failed"});
        throw error;
      }
    }
    let api=await ensureApiConfig(controller.signal);if(!api)throw Error("No healthy API key is currently available.");
    for(let attempt=0;attempt<2;attempt++){
      let response;
      try {
        response=await fetch(API.endpoint,{signal:controller.signal,method:"POST",redirect:"error",...providerRequest(api.key,api.model,text,atlasImage)});
      } catch(error) {
        if(attempt||error?.name==="AbortError")throw error;
        log({type:"api-runtime-failure",label:api.label,model:api.model,error:"request-failed"});
        activeApi=null;api=await refreshApiConfig(api.label,controller.signal);if(!api)throw error;continue;
      }
      if(!response.ok){
        const errorText=short(await response.text(),400),retryable=[401,403,408,429].includes(response.status)||response.status>=500;
        if(!attempt&&retryable){
          log({type:"api-runtime-failure",label:api.label,model:api.model,status:response.status});
          activeApi=null;const fallback=await refreshApiConfig(api.label,controller.signal);if(fallback){api=fallback;continue}
        }
        const error = new Error(`Model request failed (${response.status}): ${errorText}`);
        error.status = response.status;
        throw error;
      }
      const raw=await response.json(),content=providerResponseText(raw),result=parsedModelResponse(content);
      return {content,result,status:response.status,provider:"api",model:api.model,label:api.label};
    }
    throw Error("No healthy API key is currently available.");
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromClient);
  }
}
function responsePlacement(changedBox) {
  if (!changedBox) return null;
  const padding=Math.max(60,Math.min(180,changedBox.h*.08));
  const right={x:Math.min(CANVAS_SIZE-200,changedBox.x+changedBox.w+padding),y:Math.max(0,changedBox.y+changedBox.h*.25)};
  const below={x:Math.max(0,changedBox.x),y:Math.min(CANVAS_SIZE-200,changedBox.y+changedBox.h+padding)};
  return {right,below,instruction:"For an unfinished expression ending in =, append only the missing result at right.x/right.y. For longer prose use below.x/below.y. Do not rewrite the user's entire expression."};
}
function normalizeMathText(value) { return String(value||"").replace(/\\left|\\right/g,"").replace(/\s+/g,"").replace(/[{}]/g,""); }
function normalizeCommands(result) {
  return result.commands.map(command => {
    if (!command || typeof command !== "object") return command;
    const tool = command.tool || command.type || command.name;
    return tool ? { ...command, tool } : command;
  });
}
function normalizeCommandPlacements(commands,payload){
  if(commands.length!==1)return commands;
  const capture=payload.captureRect,latest=payload.changedBox,padding=Math.max(80,Math.min(320,latest.h*.15));
  const command=commands[0];
  if(!command||!["write_text","draw_formula"].includes(command.tool)||!Number.isFinite(command.x)||!Number.isFinite(command.y))return commands;
  const fontSize=Math.max(24,Math.min(650,+command.fontSize||180)),width=command.tool==="write_text"&&Number.isFinite(command.maxWidth)?command.maxWidth:fontSize,lineHeight=command.tool==="write_text"?Math.max(1,Math.min(2.2,+command.lineHeight||1.35)):1.8,height=fontSize*lineHeight*(command.tool==="write_text"?2:1),farAbove=command.y+Math.max(fontSize,120)<capture.y,suspiciousTop=command.y<capture.y+Math.max(200,capture.h*.04)&&command.y+Math.max(fontSize,120)<latest.y-Math.max(400,capture.h*.12),farOutside=command.y>capture.y+capture.h||command.x>capture.x+capture.w||command.x+width<capture.x;
  if(!farAbove&&!suspiciousTop&&!farOutside)return commands;
  const x=Math.max(capture.x,Math.min(capture.x+capture.w-Math.min(width,capture.w),latest.x)),y=Math.max(0,Math.min(CANVAS_SIZE-height,Math.max(capture.y,Math.min(capture.y+capture.h-Math.min(height,capture.h),latest.y+latest.h+padding)))),next={...command,x,y};
  if(command.tool==="write_text")next.maxWidth=Math.max(fontSize,Math.min(width,CANVAS_SIZE-x));
  return[next];
}
function hasInvalidTextLayout(result){return result.commands.some(command=>{const tool=command?.tool||command?.type||command?.name;return tool==="write_text"&&(!Number.isFinite(command.x)||!Number.isFinite(command.y)||!Number.isFinite(command.maxWidth))})}
function hasVisualCommand(result){
  return result.commands.some(command=>["plot_function","draw"].includes(command?.tool||command?.type||command?.name));
}
function plotFallback(result,changedBox){
  const text=String(result?.observedText||"").replace(/[−–—]/g,"-").replace(/[×·]/g,"*").replace(/÷/g,"/").replace(/π/gi,"pi"),match=text.match(/(?:y|f\s*\(\s*x\s*\))\s*=\s*([^\n,，;；。？！?!]+)/i);
  if(!match)return null;
  let expression=match[1].trim().replace(/√\s*\(([^()]*)\)/g,"sqrt($1)").replace(/√\s*([A-Za-z0-9_.]+)/g,"sqrt($1)").replace(/(\d|\)|x(?![A-Za-z_])|pi(?![A-Za-z_])|e(?![A-Za-z_]))\s*(?=x|pi|e(?![+\-]?\d)|sin|cos|tan|sqrt|abs|exp|log|ln|\()/gi,"$1*");
  if(!expression||expression.length>180||!/^[\d\sA-Za-z_+\-*/^().]+$/.test(expression))return null;
  const allowed=new Set(["x","pi","e","sin","cos","tan","sqrt","abs","exp","log","ln"]);
  if((expression.match(/[A-Za-z_]+/g)||[]).some(token=>!allowed.has(token.toLowerCase())))return null;
  const w=Math.min(3200,CANVAS_SIZE),h=Math.min(2000,CANVAS_SIZE),gap=Math.max(100,Math.min(300,changedBox.h*.12)),x=Math.max(0,Math.min(CANVAS_SIZE-w,changedBox.x)),y=Math.max(0,Math.min(CANVAS_SIZE-h,changedBox.y+changedBox.h+gap));
  return{tool:"plot_function",x,y,w,h,expression};
}

const MIME = { ".html":"text/html; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png" };
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, "http://localhost"); } catch { return send(res, 400, "Bad Request", "text/plain; charset=utf-8"); }
  if (AI_PROVIDER === "codex-cli" && !canonicalRequestOrigin(req)) return send(res, 421, { error:"Request Host does not match the configured PenEcho origin." });
  if (req.method === "GET" && url.pathname === "/api/config") return send(res, 200, { autoAiDelayMs: AUTO_AI_DELAY_MS, aiRequestTimeoutMs:AI_REQUEST_TIMEOUT_MS, aiProvider: AI_PROVIDER || "invalid" });
  if (req.method === "GET" && url.pathname === "/api/config.js") return send(res, 200, `window.PENECHO_CONFIG=${JSON.stringify({ autoAiDelayMs: AUTO_AI_DELAY_MS, aiRequestTimeoutMs:AI_REQUEST_TIMEOUT_MS, aiProvider: AI_PROVIDER || "invalid" })};`, "application/javascript; charset=utf-8");
  if (req.method === "GET" && url.pathname === "/api/debug/log") {
    if (!DEBUG_ARTIFACTS || !isLoopback(req.socket.remoteAddress) || !isLoopbackHostname(requestHost(req)?.hostname)) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    if (!fs.existsSync(LOG_FILE)) return send(res, 200, "No debug log yet.\n", "text/plain; charset=utf-8");
    const text = fs.readFileSync(LOG_FILE, "utf8");
    return send(res, 200, text.slice(-MAX_LOG), "text/plain; charset=utf-8");
  }
  if (req.method === "GET" && url.pathname === "/api/debug/atlas") {
    if (!DEBUG_ARTIFACTS || !isLoopback(req.socket.remoteAddress) || !isLoopbackHostname(requestHost(req)?.hostname)) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    const file = path.join(LOG_DIR, "latest-atlas.png");
    if (!fs.existsSync(file)) return send(res, 404, "No debug atlas yet.\n", "text/plain; charset=utf-8");
    res.writeHead(200, { "Content-Type":"image/png", "Cache-Control":"no-store" });
    return fs.createReadStream(file).pipe(res);
  }
  if (req.method === "POST" && url.pathname === "/api/debug/client") {
    if (!DEBUG_ARTIFACTS) return send(res, 204, "");
    if (!isLoopback(req.socket.remoteAddress) || !isLoopbackHostname(requestHost(req)?.hostname)) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    if (browserRequestError(req, false)) return send(res, 403, { error:"Debug events require the same PenEcho origin." });
    const eventId = crypto.randomUUID();
    try {
      if (!allowDebug(req.socket.remoteAddress)) throw new Error("Debug event rate limit exceeded");
      const body = await readJson(req, 64 * 1024);
      const events = new Set(["atlas-built","ai-response","ai-error","commands-validated","tool-start","tool-complete","tool-error","tool-layout-adjusted","stroke-summary","stroke-outside-canvas","ai-deferred"]);
      if (!body || !events.has(body.event) || (body.details !== undefined && (typeof body.details !== "object" || Array.isArray(body.details)))) throw new Error("Invalid debug event");
      log({ type:"client", eventId, ip:req.socket.remoteAddress, event:body.event, details:sanitizedDebugDetails(body.event,body.details || {}) });
      return send(res, 204, "");
    } catch (error) { const category=error.message==="Debug event rate limit exceeded"?"rate-limit":error.message==="Invalid debug event"?"invalid-event":error.message==="Invalid JSON"?"invalid-json":error.message==="Request too large"?"request-too-large":"request-error";log({ type:"client-error", eventId, ip:req.socket.remoteAddress, error:category }); return send(res, 400, { error:error.message, eventId }); }
  }
  if (req.method === "POST" && url.pathname === "/api/ai/command") {
    const requestId = crypto.randomUUID(), started = Date.now(), ip = req.socket.remoteAddress,
      clientController = new AbortController(),
      abortForDisconnect = () => { if (!res.writableEnded) clientController.abort(); };
    let codexSlotAcquired=false,codexRequestRegistered=false,clientRequestId=null;
    req.once("aborted", abortForDisconnect);
    res.once("close", abortForDisconnect);
    try {
      let replacementHeader=null;
      if (AI_PROVIDER === "codex-cli") {
        if (!isLanClient(ip)) return send(res, 403, { error:"Codex CLI requests are available only from this computer or its local network.", requestId });
        const authorizationError = browserRequestError(req);
        if (authorizationError) return send(res, 403, { error:authorizationError, requestId });
        if (String(req.headers["content-type"] || "").split(";",1)[0].trim().toLowerCase() !== "application/json") return send(res, 415, { error:"AI requests require application/json.", requestId });
        const clientRequestHeader=req.headers["x-penecho-client-request"],candidateReplacement=req.headers["x-penecho-replaces"],uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if(clientRequestHeader!==undefined&&(typeof clientRequestHeader!=="string"||!uuid.test(clientRequestHeader)))return send(res,400,{error:"Invalid client request ID.",requestId});
        if(candidateReplacement!==undefined&&(typeof candidateReplacement!=="string"||!uuid.test(candidateReplacement)||candidateReplacement===clientRequestHeader))return send(res,400,{error:"Invalid replacement request ID.",requestId});
        clientRequestId=clientRequestHeader||null;
        replacementHeader=candidateReplacement||null;
        if(replacementHeader&&!clientRequestId)return send(res,400,{error:"Replacement requests require a client request ID.",requestId});
      }
      const submittedPayload = await readJson(req);
      if (!validPayload(submittedPayload)) { log({ type:"ai", requestId, ip, status:400, error:"Invalid viewport-image payload." }); return send(res, 400, { error: "Invalid viewport-image payload.", requestId }); }
      const payload = canonicalPayload(submittedPayload);
      const configurationError=providerConfigurationError();
      if (configurationError) { log({ type:"ai", requestId, ip, status:400, error:configurationError }); return send(res, 400, { error:configurationError, requestId }); }
      if (AI_PROVIDER === "codex-cli") {
        codexRequestRegistered=Boolean(clientRequestId);
        await acquireCodexSlot(clientController,clientRequestId,replacementHeader);
        codexSlotAcquired=true;
      }
      const encodedSize=encodedImageSize(payload.atlasImage);
      if(!encodedSize||encodedSize.w!==payload.atlasSize.w||encodedSize.h!==payload.atlasSize.h){log({type:"ai",requestId,ip,status:400,error:"Image dimensions do not match atlasSize."});return send(res,400,{error:"Image dimensions do not match atlasSize.",requestId})}
      const latestInput=latestInputMetadata(payload.changedBox,payload.sourceRect,payload.imageScale,payload.atlasSize);
      if(!latestInput){log({type:"ai",requestId,ip,status:400,error:"Latest input is outside the source image."});return send(res,400,{error:"Latest input is outside the source image.",requestId})}
      if(!payload.hotspotGrid.hotspots.every(h=>overlaps(h.imageRect,latestInput.imageRect))){log({type:"ai",requestId,ip,status:400,error:"Hotspots must intersect latest input."});return send(res,400,{error:"Hotspots must intersect latest input.",requestId})}
      const modelInput = { trigger:payload.trigger, userAction:payload.userAction, actionMeaning:{auto:"respond naturally to the newest meaningful handwriting or spatial editing gesture",hint:"for an actual problem offer a clue; for conversation respond naturally",continue:"continue the newest user content",explain:"explain the newest content or the content referenced by a box and arrow",plot:"produce at least one renderable visual command; use plot_function for y=f(x), otherwise draw for a diagram",answer:"directly answer the newest question or spatial request"}[payload.userAction]||"respond appropriately",languagePolicy:"follow the newest substantive user content; for control-only gestures follow the referenced content",uiTheme:payload.uiTheme,persona:THEME_PERSONAS[payload.uiTheme],personaPolicy:"Use persona to guide technical emphasis, reasoning method, examples, terminology, answer structure, and tone. It must not override user intent, response language, factual rigor, or safety requirements.",canvasSize:payload.canvasSize,visibleRect:payload.visibleRect,captureRect:payload.captureRect,sourceRect:payload.sourceRect,imageSize:payload.atlasSize,imageScale:payload.imageScale,latestInput,focusInset:payload.focusInset||null,hotspotGrid:payload.hotspotGrid,note:"latestInput.imageRect is the authoritative attention region for the newest user input. focusInset, when present, is a magnified duplicate for transcription only. captureRect may be outside visibleRect. Use current hotspots and visual arrows/selection frames to identify referenced content and the intended response destination."};
      saveLatestAtlas(payload.atlasImage,{requestId,action:payload.userAction,atlasSize:payload.atlasSize,visibleRect:payload.visibleRect,captureRect:payload.captureRect,sourceRect:payload.sourceRect,imageScale:payload.imageScale,latestInput,focusInset:payload.focusInset||null,hotspotGrid:payload.hotspotGrid,changedBox:payload.changedBox});
      let attempts=0;
      let model=await callModel(modelInput,payload.atlasImage,"",clientController.signal);
      attempts++;
      const invalidTextLayout=hasInvalidTextLayout(model.result),manualEmpty=payload.userAction!=="auto"&&model.result.commands.length===0,plotMissing=payload.userAction==="plot"&&!hasVisualCommand(model.result);
      if(invalidTextLayout||manualEmpty||plotMissing){
        const reason=invalidTextLayout?"invalid-text-layout":manualEmpty?"empty-commands":"plot-without-visual";
        log({type:"ai-retry",requestId,ip,action:payload.userAction,reason});
        const retry=plotMissing?"Perform a second independent inspection using focusInset for transcription if available. The user explicitly selected plot. Return at least one renderable visual command. For a single-variable function, return plot_function with an ASCII expression using explicit multiplication such as 3*x. For other requested visuals, return one unified draw command. Do not answer with prose or draw_formula alone.":"Perform a second independent inspection. Use focusInset as the primary transcription view when present, especially for Chinese handwriting, then cross-check latestInput.imageRect. Inspect any box/circle-selected content and arrow chain it visually references outside that rectangle. Follow the final arrowhead as the intended destination. Every write_text command must include finite global x and y for its top-left start plus a finite maxWidth chosen from the available blank space.";
        model=await callModel(modelInput,payload.atlasImage,retry,clientController.signal);
        attempts++;
      }
      const result=model.result;
      result.commands=normalizeCommands(result);
      if(payload.userAction==="plot"&&!hasVisualCommand(result)){
        const fallback=plotFallback(result,payload.changedBox);
        if(fallback){result.commands.push(fallback);log({type:"ai-plot-fallback",requestId,ip})}
      }
      result.commands=normalizeCommandPlacements(result.commands,payload);
      const loggedIntent=DEBUG_INTENTS.has(result.intent)?result.intent:"invalid",loggedTools=result.commands.map(c=>c?.tool).filter(tool=>DEBUG_TOOLS.has(tool));
      log({ type:"ai", requestId, ip, action:payload.userAction, uiTheme:payload.uiTheme, provider:model.provider,model:model.model,providerLabel:model.label,atlasSize:payload.atlasSize,visibleRect:payload.visibleRect,captureRect:payload.captureRect,sourceRect:payload.sourceRect,imageScale:payload.imageScale,latestInput,hotspots:payload.hotspotGrid.hotspots.length,changedBox:payload.changedBox,upstreamStatus:model.status,status:200,elapsedMs:Date.now()-started,attempts,intent:loggedIntent,commandCount:result.commands.length,tools:loggedTools });
      send(res, 200, { ...result, requestId, attempts });
    } catch (error) {
      if (clientController.signal.aborted) {
        log({ type:"ai", requestId, ip, status:499, elapsedMs:Date.now()-started, error:"Client cancelled request." });
        if(!res.writableEnded&&!res.destroyed)send(res,409,{error:"Request was superseded or cancelled.",requestId});
        return;
      }
      const clientError = error.message === "Invalid JSON" || error.message === "Request too large";
      const timedOut=error?.name==="AbortError"||error?.message==="This operation was aborted";
      const upstreamStatus = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : null,
        code = clientError ? 400 : timedOut ? 504 : upstreamStatus || 502;
      log({ type:"ai", requestId, ip, status:code, elapsedMs:Date.now()-started, error:clientError?"client-error":timedOut?"timeout":upstreamStatus?"upstream-error":"model-error" });
      const message = error.message || "Unable to process request.", userMessage = AI_PROVIDER === "codex-cli" && !clientError ? `${message} Run \`penecho doctor --codex\` for diagnostics.` : message;
      send(res, code, { error:userMessage, requestId });
    } finally {
      if(codexSlotAcquired)activeCodexRequests--;
      if(codexRequestRegistered&&clientRequestId){activeCodexClientRequests.delete(clientRequestId);pendingCodexClientRequests.delete(clientRequestId);if(clientController.signal.aborted)recentlyCancelledCodexRequests.set(clientRequestId,Date.now()+2000)}
      req.removeListener("aborted", abortForDisconnect);
      res.removeListener("close", abortForDisconnect);
    }
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method Not Allowed", "text/plain");
  let requested;
  try { requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname); } catch { return send(res, 400, "Bad Request", "text/plain; charset=utf-8"); }
  const file = path.resolve(PUBLIC, "." + requested);
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, "Not found", "text/plain");
  const headers = { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control":"no-store", "Content-Security-Policy":"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'", "Referrer-Policy":"no-referrer", "X-Content-Type-Options":"nosniff", "Cross-Origin-Resource-Policy":"same-origin" };
  if (AI_PROVIDER === "codex-cli" && requested === "/index.html") headers["Set-Cookie"] = aiSessionCookie(req);
  res.writeHead(200, headers);
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
});
const configuredPort = Number(process.env.PORT), PORT = Number.isInteger(configuredPort) && configuredPort >= 0 && configuredPort <= 65535 ? configuredPort : 3888;
const HOST = process.env.HOST || "0.0.0.0";
const startupConfigurationError = AI_PROVIDER === "codex-cli" ? providerConfigurationError() : null;
if (startupConfigurationError) {
  console.error(`PenEcho configuration error: ${startupConfigurationError}`);
  log({ type:"server-start-error", provider:AI_PROVIDER, error:startupConfigurationError });
  process.exitCode = 1;
} else server.listen(PORT, HOST, () => {
  const address = server.address(), listeningPort = typeof address === "object" && address ? address.port : PORT;
  console.log(`PenEcho: http://${HOST}:${listeningPort} (${AI_PROVIDER || "invalid provider"})`);
  log({ type:"server-start", host:HOST, port:listeningPort, provider:AI_PROVIDER });
});
if (!startupConfigurationError && AI_PROVIDER === "api") {
  refreshApiConfig();
  setInterval(refreshApiConfig,HEALTH_INTERVAL).unref();
}
