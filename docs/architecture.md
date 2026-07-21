# PenEcho Architecture

## Overview

PenEcho is a Node.js application with a static browser client, one server-side image encoding dependency, and selectable API, Codex CLI, or Claude CLI model execution.

```text
Browser canvas
  -> sparse confirmed tiles + persistent animation scenes
  -> cropped visual request atlas with one fixed animation frame
  -> Node.js validation and model executor
  -> structured AI commands
  -> editable client-side draft layer
  -> confirmed sparse tiles or declarative animation objects
```

## Client

`public/app.js` owns the interactive runtime:

- A `20,000 x 20,000` logical coordinate system
- Sparse `512 x 512` tile allocation for confirmed content
- Pointer input, pressure-sensitive ink, erasing, pan, and zoom
- Undo/redo records for modified tiles and serialized animation scenes
- AI capture atlas generation and focus insets
- Command validation and rendering for text, formulas, plots, unified mixed drawings, declarative animation scenes, and erasure
- MathJax 3.2.2 LaTeX-to-SVG formula rendering from an explicitly allowed jsDelivr script, with local configuration and text fallback
- A fixed-screen text editor tool with movable/resizable dialogs, automatic best-effort Markdown and likely-LaTeX parsing on confirmation, an optional high-DPR Preview mode, keyboard confirmation, sparse-tile commits, and bounded sharp overlay caching
- Unconfirmed draft interactions and batch confirmation
- New-canvas workflow with overwrite, save-as-new, and discard choices backed by local snapshots
- Client-side PNG export cropped to confirmed ink with one tile of surrounding paper margin and bounded downscaling for unusually large regions
- Persisted Manual/Auto AI mode with a temporary 0–10 second delay control, plus a fixed-width clickable per-request reasoning menu
- A registry-driven Plugins menu. Each plugin declares its stable ID, localized copy, default state, optional model-request field, and enable/disable hook; all plugin states are persisted together under `penecho-plugins`. Animation scenes are the first plugin and default to enabled, while an explicitly saved disabled choice remains disabled.
- Freehand-lasso sparse-tile ink selection with local move, proportional resize, recolor, accept, cancel, undo, and redo behavior
- English-first UI state with Chinese copy isolated in `public/locales/zh.js`
- IndexedDB snapshot storage for tile PNGs plus validated animation scene JSON and playback state

The full logical canvas is never allocated as one bitmap. Rendering composites only visible sparse tiles into the viewport canvas.

Confirmed animations never enter the tile bitmap path. `public/animation.js` normalizes data-only `animate_scene` commands and renders them with the application-owned Canvas2D renderer. Scene-level backgrounds are discarded and never serialized or painted, so the canvas paper and existing content remain visible; the model prompt also forbids backdrop fields and full-scene background shapes. `public/app.js` keeps those scenes in a persistent object layer backed by a transparent viewport-sized canvas. Animation frames clear and redraw only merged dirty screen rectangles covering changed scenes, while resize performs a full redraw. A separate interaction canvas above it contains pen previews, lasso/selection UI, animation selection handles, and unconfirmed AI drafts so opaque animation content cannot cover transient controls. The runtime starts `requestAnimationFrame` only for visible playing scenes, caps ordinary rendering at 60 FPS, drops to 30 FPS when more than 24 objects must be redrawn, and stops frames while the document is hidden. At most 20 scenes are retained, and each scene accepts no more than 32 objects and 32 motions. AI-provided JavaScript is never executed.

The animation plugin is enabled by default, and the browser persists an explicit user choice to disable it. While disabled, saved animation JSON remains available for a later re-enable, but animations do not render, participate in request atlases, affect snapshot previews or PNG exports, accept pointer input, or appear as accepted AI commands. The browser omits the plugin request field, the server omits the animation system-prompt block, and both server and client filter `animate_scene` output. Enabling it adds the bounded animation protocol paragraph, approximately 500–600 input tokens per model request. A stable feature-tour step highlights the generic Plugins entry and explains the default state, request cost, and disabled behavior to both new and returning users. With the plugin enabled, primary mouse and pen hits select the animation immediately before text, ink, eraser, lasso, or pan handling; touch requires a one-second stationary hold so ordinary canvas panning does not activate it accidentally. AI animation drafts start playing immediately and expose playback controls alongside their accept, cancel, move, and resize controls. Confirmed scenes reuse the same edit affordances when selected. About ten seconds after the latest selection or control action, the entire animation edit chrome is removed together, including its toolbar, outline, action buttons, and resize handles; clicking with a mouse or pen, or holding with touch, reveals it again. Confirmed-scene controls also close immediately after an outside click, canvas navigation, tool switch, or pen stroke.

The selection tool closes the user's freehand lasso path and clips only pixels inside that path into tile-sized fragments rather than allocating a bitmap for its whole bounding box. Pixels outside the path remain untouched even when they share the same tile or bounding box. The source pixels remain recoverable until cancel or commit; a commit records source and destination tiles as one undo step. Selection capture, movement, scaling, recoloring, confirmation, and cancellation invalidate stale recognition but never schedule or send an AI request. The text tool follows the same local-tool boundary: each editor is a DOM overlay positioned from logical canvas coordinates, keeps fixed screen-space dimensions during pan/zoom, and is removed permanently when confirmed or cancelled. Explicit input lines are preserved. Confirmation always parses a small safe Markdown subset plus delimited or conservative bare TeX such as `\pi`, `\vec{v}`, `\sum_{i=1}^{n}`, `\sin(x)`, and `A_x^2`; the Preview button only shows or hides that same final rendering. Formula segments render through MathJax, and unsupported syntax remains literal. Confirmed text records the unmodified typed source as request metadata so model transcription can use it authoritatively. Automatic requests remain exclusive to completed pen strokes and confirmed text edits, while the AI action menu remains the explicit manual request path.

## AI Request Flow

1. User input updates a dirty logical bounding box and hotspot trail.
2. After the configured post-stroke delay, the client cancels any older request and builds a white-background image around the latest user ink. Navigation and interface actions do not trigger this timer.
3. The request includes global geometry, an authoritative latest-input rectangle, an `8 x 8` hotspot grid, an optional magnified focus inset, an optional per-request reasoning selection, and only the request fields declared by enabled plugins.
4. `server.js` validates all geometry, image bounds, action/trigger pairing, reasoning selection, plugin booleans, theme/persona mapping, and payload limits. A missing reasoning field is the explicit `Configured` mode: the server keeps the configured custom effort or leaves local CLI effort unset. Missing plugin fields mean disabled. Local CLI modes first require an accepted Host, exact browser Origin, process-lifetime session cookie, and JSON content type; API mode preserves the original unrestricted HTTP request behavior. Accepted metadata is projected into fixed canonical shapes before model input, logging, or debug-artifact persistence.
5. The server maps an explicit page maximum to `xhigh` for OpenAI API/Codex CLI or `max` for Anthropic API/Claude CLI, while `Configured` passes the startup value through unchanged, then dispatches to the configured executor.
6. The server filters commands belonging to disabled plugins. The client validates commands again and displays them in an unconfirmed draft layer; enabled `animate_scene` output is normalized into bounded declarative data before preview.
7. Confirmation writes static results into sparse tiles or adds animation JSON to the persistent animation object layer. Rejection removes the draft without modifying confirmed content; continued handwriting leaves existing AI drafts visible and only appends later results to the draft batch.

Text editors are intentionally persistent until the user chooses the check or close action. `Ctrl/Cmd + Enter` confirms the focused editor, `Escape` cancels it, and a viewport hint is shown while any editor is open. The Preview button never changes the source or confirmation behavior; it only toggles a high-DPR view of the same automatic mixed-text rendering. Confirming or cancelling records a half-second canvas input guard, then confirmation schedules Auto AI using the configured delay. AI draft accept/reject controls retain their separate one-second guard to prevent an extra pointer tap from becoming a new stroke.

For responses containing multiple commands, a dashed union outline and four-way handle move all remaining items together while preserving their relative positions and keeping the group inside the logical canvas. Each draft item also has independent accept and discard controls in addition to move and resize controls. An individually accepted item is written immediately and creates its own undo record; discarding the remaining drafts never removes items that were already accepted. The toolbar-level actions still accept or discard all currently unconfirmed items.

API credentials are loaded only by the Node.js process. They are never serialized into client responses or static files. Both local CLI adapters use restricted child environments that omit PenEcho API credentials.

## Model Executors

`penecho configure` is the interactive configuration center. Its main menu separates LLM source selection from runtime settings, and every provider page saves before checking the result. API and Claude CLI checks issue a small real request. The Codex CLI check does not invoke a model: after the version and login checks, it runs `codex debug models --bundled` with a five-second bound and verifies the configured model slug against the offline catalog. It never attaches an image, refreshes the online catalog, or consumes model tokens. Check failure never rolls back the saved values. The default store is `~/.penecho/config.env`; `--config FILE` replaces it for configuration, diagnostics, and startup. Project and package `.env` files are not loaded implicitly. A first interactive `penecho` launch opens the configuration center when no global file or explicit process configuration exists.

`AI_PROVIDER=api` retains the HTTP provider path. `AI_API_FORMAT=openai` selects Chat Completions-compatible payloads, while `AI_API_FORMAT=anthropic` selects Anthropic Messages payloads. The neutral `AI_API_URL`, `AI_API_MODEL`, and `AI_API_KEY` settings work for either format; the former `OPENAI_*` names remain read-only compatibility fallbacks and are removed on the next configuration save. The browser reasoning menu offers `Configured`, `none`, `low`, `medium`, `high`, and `max`; `Configured` omits the per-request field and preserves the startup effort verbatim, including custom names. An explicit page `max` maps to `xhigh` for OpenAI-format requests, while OpenAI sends the other selected values as `reasoning_effort`; supported levels remain model-dependent. PenEcho does not set `temperature` in API requests, connection checks, or CLI invocations, so each provider and model applies its own default. Anthropic-format API mode defaults to `medium`: `none` sends `thinking.type=disabled` without `output_config`, while every other effort sends `thinking.type=adaptive` plus `output_config.effort`; image requests allow up to 8192 response tokens for thinking and the compact final JSON. Effort `max` alone raises that hard total allowance to 16384 and appends a soft instruction to keep internal reasoning near or below roughly 7000 tokens, avoid unnecessary exploration, and reserve enough budget for one complete valid JSON response. The base system prompt still asks the model to keep its final JSON within approximately 4096 tokens, and a true `max_tokens` stop is reported explicitly rather than as a generic JSON parse failure. The small Test & Save probe keeps adaptive thinking disabled to avoid paying the full canvas reasoning cost. PenEcho does not issue startup or periodic probe requests and does not switch credentials after a failure.

`AI_PROVIDER=codex-cli` routes the same model input through `codex-cli.js`. The adapter creates a unique temporary directory, writes the selected atlas as `atlas.webp` or `atlas.png`, starts the installed `codex exec --json` without shell string interpolation, and passes the prompt over stdin. It incrementally parses JSONL output, retains the final `item.completed` agent message, and returns it as soon as `turn.completed` arrives. A CLI process that remains alive after the completed turn is terminated and cleaned up in the background, so process-exit cleanup cannot delay the canvas response. `--output-last-message` remains as a compatibility fallback when a CLI exits successfully without the expected final events. Every invocation uses private temporary home, Codex home, AppData, XDG config, and cache roots and copies only the existing Codex `auth.json`. User configuration, profiles, rules, skills, memories, plugins, MCP declarations, and project instructions are excluded, while strict runtime overrides empty or disable those surfaces. `CODEX_CLI_MODEL` applies an explicit model override; otherwise Codex chooses the default for the isolated session rather than loading `model` from the user's config. When `AI_EFFORT` is set, the adapter applies it through Codex's `model_reasoning_effort` configuration override; otherwise Codex chooses the isolated session's default effort. The installed `penecho` command exposes the same transient overrides as `--model` and `--effort`, with command-line values taking precedence over configuration. It retains an ephemeral session, a read-only sandbox as defense in depth, bounded event and stderr handling, a restricted child environment without PenEcho API keys or proxy credentials, immediate process-tree cancellation, timeout handling, and retried temporary-directory cleanup. Timeout and failure traces retain the bounded Codex event summary, stderr tail, and any generated `last-message.txt`. Local CLI execution is latest-request-wins: every valid new request immediately invalidates and terminates the previous request, starts without waiting for the retiring process to finish cleanup, and discards every superseded response.

`AI_PROVIDER=claude-cli` routes the same model input through `claude-cli.js`. It starts the authenticated Claude Code CLI in print mode, supplies the fixed PenEcho system prompt, and sends one streaming JSON user message containing request metadata plus the selected base64 atlas image and matching PNG or WebP MIME type. Runtime flags disable built-in tools, explicitly deny Agent and Task, provide no custom agents, disable MCP configuration, slash commands, browser integration, prompt suggestions, and session persistence, while child-environment overrides suppress nonessential traffic and terminal-title requests. `AI_EFFORT=none` additionally sets `MAX_THINKING_TOKENS=0`, which makes Claude Code send `thinking.type=disabled`; because `none` is not accepted by the CLI effort parser, the process receives an internal `--effort low` plus a flag-level `--settings` override setting `CLAUDE_CODE_EFFORT_LEVEL=low`, preventing a user-level `max` from competing with the disabled-thinking request. Other non-empty efforts leave extended thinking enabled and are applied through both `--effort` and the same settings override, while an empty effort preserves Claude Code's native behavior. The adapter incrementally parses stream JSON, requires an empty tool and MCP initialization, aborts on any tool-use event, and returns immediately when the successful final `result` arrives; a process still alive afterward is terminated and its temporary directory is cleaned in the background. Bounded event summaries and stderr tails are retained on failures and timeouts without recording prompts. `CLAUDE_CLI_MODEL` accepts an alias or full model ID; when omitted, Claude Code chooses its configured default. The installed `penecho` command exposes the same transient overrides as `--model` and `--effort`, with command-line values taking precedence over configuration.

`PENECHO_AI_IMAGE_FORMAT` applies to API, Codex CLI, and Claude CLI. The browser's validated PNG remains the source artifact; `webp`, the default, is encoded losslessly with Sharp before dispatch, while `png` sends the source unchanged. API providers that explicitly reject WebP with HTTP 400, 415, or 422 are retried once with the original PNG. Timeouts, 5xx responses, and model-output parsing failures never trigger this transport fallback. Request traces retain both the source PNG and selected outbound artifact when they differ.

`AI_TIMEOUT_SECONDS` applies to API, Codex CLI, and Claude CLI model attempts. It defaults to 180 seconds and accepts integer values from 10 through 600. `Settings` also owns image format, request tracing, trace retention, `HOST`, `PORT`, and the initial `AUTO_AI_DELAY_SECONDS`; request traces default to `~/.penecho/logs/requests`.

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

- `snapshots`: metadata, preview blob, theme, timestamp, view transform, animation scene JSON, renderer version, transform, playhead, and paused state
- `snapshot-tiles`: one PNG blob per populated tile, indexed by snapshot ID

This keeps list rendering lightweight and avoids loading every full tile blob until a snapshot is selected. Snapshot loading invalidates active recognition state, discards unconfirmed drafts, clears undo/redo history, reconstructs confirmed tiles, validates animation JSON again, and resumes each scene from its saved playhead without accumulating time while the application was closed.

The current loaded or saved snapshot is tracked for the lifetime of the page so the New action can overwrite it safely. Saving as new creates a distinct snapshot, while every New path cancels active recognition, removes unconfirmed drafts, clears undo/redo state, and recenters the blank canvas.

## Server

`server.js` provides:

- Static file serving from `public/`
- Configuration supplied by the `penecho` launcher without exposing values to the browser
- Selectable API, Codex CLI, and Claude CLI model execution
- Single-key API execution without background probe requests
- Strict AI request validation and canonical metadata projection
- Same-origin, cookie-bound authorization before local CLI process launches
- Structured response retries and plot fallback
- Optional localhost-only debug endpoints plus credential-redacted per-request tracing, disabled by default; request traces retain source PNG and configured outbound image artifacts, MIME types and byte sizes, exact outbound bodies, transport/semantic attempts, raw/parsed responses, format fallback state, and terminal state with a configurable rolling limit of 100 by default
- Bounded log rotation

## Rendering Dependencies

The server uses Sharp to encode validated PNG atlases as lossless WebP for every model executor when WebP is selected. Formula commands use MathJax 3.2.2 from a version-pinned jsDelivr URL, protected by a SHA-384 Subresource Integrity check and anonymous CORS mode. MathJax configuration stays in `public/mathjax-config.js`, and formula rendering falls back to local text if MathJax is unavailable. Static responses allow scripts only from the application itself and the pinned CDN origin.
