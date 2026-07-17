# PenEcho Architecture

## Overview

PenEcho is a Node.js application with a static browser client, one server-side image encoding dependency, and selectable API, Codex CLI, or Claude CLI model execution.

```text
Browser canvas
  -> sparse confirmed tiles
  -> cropped visual request atlas
  -> Node.js validation and model executor
  -> structured AI commands
  -> editable client-side draft layer
  -> confirmed sparse tiles
```

## Client

`public/app.js` owns the interactive runtime:

- A `20,000 x 20,000` logical coordinate system
- Sparse `512 x 512` tile allocation for confirmed content
- Pointer input, pressure-sensitive ink, erasing, pan, and zoom
- Undo/redo records based on modified tiles
- AI capture atlas generation and focus insets
- Command validation and rendering for text, formulas, plots, unified mixed drawings, and erasure
- MathJax 3.2.2 LaTeX-to-SVG formula rendering from an explicitly allowed jsDelivr script, with local configuration and text fallback
- Unconfirmed draft interactions and batch confirmation
- New-canvas workflow with overwrite, save-as-new, and discard choices backed by local snapshots
- Persisted Manual/Auto AI mode with a temporary 0–10 second delay control
- Freehand-lasso sparse-tile ink selection with local move, proportional resize, recolor, accept, cancel, undo, and redo behavior
- English-first UI state with Chinese copy isolated in `public/locales/zh.js`
- IndexedDB snapshot storage

The full logical canvas is never allocated as one bitmap. Rendering composites only visible sparse tiles into the viewport canvas.

The selection tool closes the user's freehand lasso path and clips only pixels inside that path into tile-sized fragments rather than allocating a bitmap for its whole bounding box. Pixels outside the path remain untouched even when they share the same tile or bounding box. The source pixels remain recoverable until cancel or commit; a commit records source and destination tiles as one undo step. Selection capture, movement, scaling, recoloring, confirmation, and cancellation invalidate stale recognition but never schedule or send an AI request. Automatic requests remain exclusive to completed pen strokes, while the AI action menu remains the explicit manual request path.

## AI Request Flow

1. User input updates a dirty logical bounding box and hotspot trail.
2. After the configured post-stroke delay, the client cancels any older request and builds a white-background image around the latest user ink. Navigation and interface actions do not trigger this timer.
3. The request includes global geometry, an authoritative latest-input rectangle, an `8 x 8` hotspot grid, and an optional magnified focus inset.
4. `server.js` validates all geometry, image bounds, action/trigger pairing, theme/persona mapping, and payload limits. Local CLI modes first require an accepted Host, exact browser Origin, process-lifetime session cookie, and JSON content type; API mode preserves the original unrestricted HTTP request behavior. Accepted metadata is projected into fixed canonical shapes before model input, logging, or debug-artifact persistence.
5. The server dispatches to the configured executor: an adapted OpenAI Chat Completions/Anthropic Messages request, a non-interactive Codex CLI process, or a non-interactive Claude CLI process with the atlas image attached.
6. The client validates commands again and displays them in an unconfirmed draft layer.
7. Confirmation writes the result into sparse tiles. Rejection or continued handwriting removes the draft without modifying confirmed content.

For responses containing multiple commands, a dashed union outline and four-way handle move all remaining items together while preserving their relative positions and keeping the group inside the logical canvas. Each draft item also has independent accept and discard controls in addition to move and resize controls. An individually accepted item is written immediately and creates its own undo record; discarding the remaining drafts never removes items that were already accepted. The toolbar-level actions still accept or discard all currently unconfirmed items.

API credentials are loaded only by the Node.js process. They are never serialized into client responses or static files. Both local CLI adapters use restricted child environments that omit PenEcho API credentials.

## Model Executors

`AI_PROVIDER=api` retains the HTTP provider path. `AI_API_FORMAT=openai` selects Chat Completions-compatible payloads, while `AI_API_FORMAT=anthropic` selects Anthropic Messages payloads. The neutral `AI_API_URL`, `AI_API_MODEL`, and `AI_API_KEY` settings work for either format; the former `OPENAI_*` names remain compatibility fallbacks. Known global `AI_EFFORT` values are `low`, `medium`, `high`, `xhigh`, and `max`, but other non-empty strings pass through unchanged for model-specific or future levels. API mode defaults to `max` and sends the value as `reasoning_effort` for OpenAI-format requests or `output_config.effort` for Anthropic requests. The browser's validated PNG remains the source artifact. `PENECHO_AI_IMAGE_FORMAT` selects the upstream format and defaults to `webp` when omitted: WebP is encoded losslessly, PNG sends the source unchanged, and JPEG uses quality 95 with 4:4:4 chroma sampling after flattening onto white. If an HTTP 400, 415, or 422 response explicitly rejects a configured non-PNG image or media format, the same logical model call retries once with the original PNG. Timeouts, 5xx responses, and model-output parsing failures never trigger this transport fallback. It does not issue startup or periodic probe requests and does not switch credentials after a failure.

`AI_PROVIDER=codex-cli` routes the same model input through `codex-cli.js`. The adapter creates a unique temporary directory, writes the validated atlas PNG, starts the installed `codex exec` without shell string interpolation, passes the prompt over stdin, and reads the final response from `--output-last-message`. Every invocation uses private temporary home, Codex home, AppData, XDG config, and cache roots and copies only the existing Codex `auth.json`. User configuration, profiles, rules, skills, memories, plugins, MCP declarations, and project instructions are excluded, while strict runtime overrides empty or disable those surfaces. When `AI_EFFORT` is set, the adapter applies it through Codex's `model_reasoning_effort` configuration override; otherwise Codex chooses its configured default. Model attempts default to a 120-second timeout. It retains an ephemeral session, a read-only sandbox as defense in depth, bounded stdout/stderr, a restricted child environment without PenEcho API keys or proxy credentials, process-tree cancellation, timeout handling, and retried temporary-directory cleanup. Local CLI execution is latest-request-wins: every valid new request immediately invalidates and terminates the previous request, starts without waiting for the retiring process to finish cleanup, and discards every superseded response.

`AI_PROVIDER=claude-cli` routes the same model input through `claude-cli.js`. It starts the authenticated Claude Code CLI in print mode, supplies the fixed PenEcho system prompt, and sends one streaming JSON user message containing request metadata plus the base64 atlas image. Runtime flags disable built-in tools, MCP configuration, slash commands, browser integration, and session persistence, and request JSON output. The adapter bounds stdout/stderr, removes API keys from the child environment, handles timeout and process-tree cancellation, ignores output as soon as a request is superseded, and removes its temporary working directory. `CLAUDE_CLI_MODEL` accepts an alias or full model ID; when omitted, Claude Code chooses its configured default. When `AI_EFFORT` is set the adapter passes Claude's `--effort` option; otherwise Claude keeps its native default. Model attempts default to a 120-second timeout.

All executors listen on the configured `HOST`, which defaults to `0.0.0.0`, so localhost and LAN access work without a public-origin setting. API mode preserves the original unrestricted Host, Origin, Cookie, and content-type behavior for local, LAN, proxy, and other remote deployments. Codex and Claude CLI modes share an automatic process-launch boundary: accepted Hosts must match loopback, an actual network-interface address, the computer hostname, or its `.local` form; the client address must be local or on a directly connected network. The root document issues a process-lifetime `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/ai/command`, and CLI launches require the matching canonical `Origin` and JSON content type. Static responses restrict scripts to the application itself and the jsDelivr origin used by the integrity-pinned MathJax bundle.

Codex CLI mode invokes Codex itself, and Claude CLI mode invokes Claude Code itself. Neither mode selects a local Ollama-style provider. Local or self-hosted model endpoints use `AI_PROVIDER=api` with an OpenAI-compatible URL.

## Unified Drawing Protocol

`public/draw.js` validates and renders the `draw` command independently of the main interaction runtime. A command contains one integer global `origin`, parallel `types` and `items` arrays, and optional index arrays for closure, translucent fill, and arrowheads. Primitive coordinates are integer offsets from the shared origin.

Supported item encodings are:

- `line` and `smooth`: flat point pairs `[x1,y1,x2,y2,...]`
- `rect`: top-left and size `[x,y,w,h]`
- `ellipse`: center and radii `[cx,cy,rx,ry]`
- `circle`: center and radius `[cx,cy,r]`
- `arc`: center, radii, start angle, and signed sweep `[cx,cy,rx,ry,startDeg,sweepDeg]`; angle `0` points right, positive sweeps are clockwise, and negative sweeps are counter-clockwise

The module computes one union bounding box across all primitives, smooth-curve extrema, arc extrema, stroke padding, and arrowheads. Neither the API response path nor the client rejects valid in-canvas drafts by aggregate logical area, destination-tile count, or backing-raster pixel count. Drawings and text may still downsample their backing bitmap while retaining logical dimensions so draft movement, independent width/height resizing, proportional scaling, confirmation, and sparse-tile commits preserve the intended canvas size. One mixed command therefore behaves as one draft item. Text and formula commands are allowed to overlap the drawing union so labels can remain inside diagrams.

## Local Snapshot Format

The browser uses IndexedDB database `penecho-canvas-history` with two stores:

- `snapshots`: metadata, preview blob, theme, timestamp, and view transform
- `snapshot-tiles`: one PNG blob per populated tile, indexed by snapshot ID

This keeps list rendering lightweight and avoids loading every full tile blob until a snapshot is selected. Snapshot loading invalidates active recognition state, discards unconfirmed drafts, clears undo/redo history, and reconstructs confirmed tiles.

The current loaded or saved snapshot is tracked for the lifetime of the page so the New action can overwrite it safely. Saving as new creates a distinct snapshot, while every New path cancels active recognition, removes unconfirmed drafts, clears undo/redo state, and recenters the blank canvas.

## Server

`server.js` provides:

- Static file serving from `public/`
- `.env` loading without exposing values to the browser
- Selectable API, Codex CLI, and Claude CLI model execution
- Single-key API execution without background probe requests
- Strict AI request validation and canonical metadata projection
- Same-origin, cookie-bound authorization before local CLI process launches
- Structured response retries and plot fallback
- Optional localhost-only debug endpoints plus credential-redacted per-request tracing, disabled by default; request traces retain source PNG and configured outbound image artifacts, MIME types and byte sizes, exact outbound bodies, transport/semantic attempts, raw/parsed responses, format fallback state, and terminal state with a configurable rolling limit of 100 by default
- Bounded log rotation

## Rendering Dependencies

The server uses Sharp to encode validated PNG atlases as lossless WebP or high-quality JPEG in API mode; PNG, Codex CLI, and Claude CLI paths keep the source image unchanged. Formula commands use MathJax 3.2.2 from a version-pinned jsDelivr URL, protected by a SHA-384 Subresource Integrity check and anonymous CORS mode. MathJax configuration stays in `public/mathjax-config.js`, and formula rendering falls back to local text if MathJax is unavailable. Static responses allow scripts only from the application itself and the pinned CDN origin.
