<h1 align="center">
  <img src="public/penecho-readme-header.png" alt="PenEcho" width="760">
</h1>

<p align="center"><strong>Think with AI beyond the chat box.</strong></p>

<p align="center">PenEcho is a shared canvas where handwriting, equations, diagrams, and spatial context become part of the conversation.</p>

<p align="center">
  <a href="https://discord.gg/3jrPJ3mXdX">
    <img src="https://img.shields.io/badge/Discord-Join%20the%20community-5865F2?style=for-the-badge&amp;logo=discord&amp;logoColor=white" alt="Join the PenEcho Discord">
  </a>
  <a href="https://github.com/erickong/penecho/stargazers">
    <img src="https://img.shields.io/github/stars/erickong/penecho?style=for-the-badge&amp;logo=github&amp;logoColor=white&amp;color=f5b301" alt="Star PenEcho on GitHub">
  </a>
</p>

<p align="center"><em>Built in the open by a small community — <a href="https://discord.gg/3jrPJ3mXdX">come help shape it</a>.</em></p>

<p align="center">
  <img src="https://github.com/erickong/penecho/releases/download/v0.1.0/penecho-demo.gif" alt="PenEcho turning handwritten work into an editable visual answer" width="100%">
</p>

## Think on the canvas

Put a question, equation, diagram, or half-formed idea anywhere on the canvas and pause. PenEcho reads your marks and their spatial relationships, then answers beside them. You can work through a problem without translating every step into a chat message or rebuilding it with rigid diagram tools.

- Get answers, hints, explanations, continuations, formulas, plots, and diagrams directly on the canvas.
- Move, resize, accept, or discard every AI draft before it becomes part of your work.
- Draw naturally with a stylus or mouse, then pan and zoom across a sparse `20,000 x 20,000` canvas.
- Draw a freehand lasso around confirmed ink to move, resize, or recolor it locally; accepting or cancelling a selection never triggers an AI request.
- Choose Arcane, Sci-fi, or Research mode to match the kind of problem you are exploring.
- Save lightweight snapshots locally in your browser. Starting a new canvas can overwrite the current snapshot, save a new copy, or continue without saving; unconfirmed AI drafts are never included.
- Export confirmed canvas ink as a cropped PNG with one `512`-pixel tile of paper margin on every side.

PenEcho keeps a small local runtime and only allocates `512 x 512` tiles where ink exists, so the huge logical canvas does not become a huge bitmap.

## What's new in 0.5.0

- **Per-request reasoning control.** The canvas toolbar now provides six convenient levels for matching response quality and speed to the task: `Configured` keeps the saved model or CLI setting, `None` disables reasoning where the provider supports it, `Low` is the fastest lightweight option, `Medium` is the balanced everyday choice, `High` adds more depth for difficult work, and `Max` requests the provider's highest practical level (`xhigh` for OpenAI and `max` for Anthropic). The choice applies to the next requests without reopening the configuration center.
- **High-resolution PNG export.** Use `Export` in the toolbar to download the confirmed canvas as a crisp PNG. PenEcho crops to the smallest rectangle containing the ink and adds one paper tile of margin on every side, making the result easy to share or archive without exporting the entire sparse canvas.
- **Typed canvas text.** Select the `Text` tool, click anywhere on the paper, and enter text in one or more independent movable, resizable editors. Plain text is the default and preserves explicit line breaks. Each editor has an independent `MD+TeX` preview toggle for basic Markdown and inline LaTeX such as `$x^2$`, `A_x^y`, `\frac{a}{b}`, and `\sqrt{x}`; unsupported or incomplete markup stays literal. Use the `?` button beside `MD+TeX` for a short reference and examples. The editor keeps its default size and font in screen pixels while you pan or zoom, and becomes confirmed ink only after `Ctrl/Cmd + Enter` or the check button; either confirmation or cancellation returns to the pen tool. Automatic AI recognition starts after confirmation, never while you are still typing.
- **Persistent AI drafts.** AI results remain on the canvas while you continue writing. Accept or discard them explicitly; the check and close actions include a short input guard so an accidental follow-up tap does not immediately start another request.

## How it works

```mermaid
flowchart LR
  User["Handwriting, equations, and sketches"] --> Canvas["Browser canvas<br/>sparse confirmed tiles"]
  Canvas --> Atlas["Cropped visual atlas<br/>plus geometry"]
  Atlas --> Server["PenEcho server<br/>validation and prompt"]
  Server --> Executor{"Configured executor"}
  Executor --> API["API mode<br/>OpenAI-compatible or Anthropic"]
  Executor --> Codex["Codex CLI mode<br/>local codex exec"]
  Executor --> Claude["Claude CLI mode<br/>local claude -p"]
  API --> Draft["Structured editable draft"]
  Codex --> Draft
  Claude --> Draft
  Draft --> Canvas
```

The browser sends only the relevant canvas crop and geometry. The server validates the request, uses the selected executor, and returns a movable draft that stays separate from confirmed ink until you accept it.

## Quick start

You need [Node.js 18.17+](https://nodejs.org/) and one of the following: an API key, an authenticated [Codex CLI](https://developers.openai.com/codex/cli), or an authenticated [Claude Code CLI](https://code.claude.com/docs/en/overview).

```bash
npm install -g penecho
penecho configure
penecho
```

`penecho configure` opens the interactive configuration center. Its main menu contains `LLM source`, `Settings`, and `Exit`. Use the arrow keys and Enter to navigate:

- `LLM source -> Claude CLI` selects a detected, recommended, default, or manually entered model and an effort level. Opus 4.8 or newer is recommended; Sonnet and Opus 4.6 can respond but may produce weaker canvas results.
- `LLM source -> Codex CLI` selects a model and effort. GPT-5.5 or newer is required for good results, `gpt-5.6-sol` is recommended, and `xhigh` is the highest listed Codex effort.
- `LLM source -> API` selects the OpenAI-compatible or Anthropic/Claude-compatible request format, then asks for the URL, model, effort, and hidden key. Kimi K3 uses the OpenAI-compatible format with model `k3`; current testing recommends `medium`. Anthropic API offers `none` to disable thinking and defaults new configurations to the recommended `medium` adaptive-thinking level. PenEcho does not set `temperature` for API requests, connection checks, or CLI invocations; each provider and model uses its own default. Existing values are offered as defaults and a blank key keeps the saved key.
- `Settings` controls the unified model timeout, the image format sent to every model executor, request recording and retention, listening interface and port, and initial Auto AI delay. WebP is the default; PNG is also available. The delay can also be changed on the canvas.

Every LLM page ends with `Test & Save`, and PenEcho always saves before checking. Codex CLI uses a fast offline check: it verifies the executable and login, then reads `codex debug models --bundled` to confirm the selected model exists. It does not run inference, attach an image, refresh the online catalog, or consume model tokens. Claude CLI and API configuration still send one small real request to verify the selected endpoint/model settings. Whether a check passes or fails, the configuration remains saved and the UI returns to the parent menu with a clear diagnostic.

The canvas toolbar exposes a fixed-width clickable `Reasoning` menu beside Auto AI for frequent per-request changes: `Configured`, `none`, `low`, `medium`, `high`, and the provider's highest practical level. `Configured` omits the per-request effort field so the server preserves the configured custom effort or the underlying CLI default. The last explicit position maps to `xhigh` for OpenAI API and Codex CLI, and to `max` for Anthropic API and Claude CLI. `none` sends OpenAI `reasoning_effort=none`; for Claude it disables thinking. Model support remains provider-dependent, so an endpoint may reject a level its selected model does not implement. The saved `AI_EFFORT` initializes this control, while a toolbar change overrides it for subsequent canvas requests without rewriting the configuration file. The menu closes after a selection or five seconds of inactivity.

The default configuration is `~/.penecho/config.env`. API credentials are plaintext in this local file, receive owner-only permissions on POSIX systems, and are never sent to browser code. Protect it like any other credential. If `penecho` is started before this file exists, it opens the configuration center automatically in an interactive terminal.

Use a different env-style configuration file for a particular launch when needed:

```bash
penecho configure --config ./team.env
penecho --config ./team.env
```

An explicit `--config` file replaces the default global file for that command. PenEcho does not automatically read a project-directory `.env` or a package-directory `.env`.

### CLI prerequisites

Installing the Codex desktop app alone does not guarantee that a `codex` executable is available on the shell `PATH`. Install and authenticate the CLI separately before selecting Codex:

```bash
npm install -g @openai/codex@latest
hash -r
codex --version
codex login status
```

If needed, run `codex login`. Claude CLI mode similarly requires an installed and authenticated Claude Code CLI, normally through `claude auth login`.

PenEcho uses the selected CLI locally and does not need an API key for that source. Normal startup checks the executable and login without consuming model tokens. Codex `Test & Save` additionally verifies the selected model against the installed CLI's bundled catalog without making a model request; Claude `Test & Save` sends a small real request.

Canvas requests through Codex use `codex exec --json`. PenEcho returns as soon as Codex emits the final agent message and `turn.completed`; if the CLI process remains alive afterward, it is terminated and cleaned up in the background instead of delaying the canvas response.

Claude CLI requests use one isolated `claude -p` turn with tools, agents, MCP, prompt suggestions, session persistence, and other nonessential background traffic disabled. Selecting effort `none` sets `MAX_THINKING_TOKENS=0`, causing Claude Code to send `thinking.type=disabled`; because `none` is not a valid Claude CLI effort value, PenEcho also passes an internal `low` effort and per-process `--settings` override to neutralize any user-level `CLAUDE_CODE_EFFORT_LEVEL=max`. Selecting `low`, `medium`, `high`, or `max` leaves thinking enabled and applies the chosen value through both Claude's `--effort` flag and the same settings override. PenEcho incrementally validates the stream and returns as soon as Claude emits its successful final `result`; any attempted tool use aborts the request, while a CLI process that remains alive after the result is terminated and cleaned up in the background.

Transient launch overrides remain available:

```bash
penecho doctor --codex
penecho --codex --model gpt-5.6-sol --effort xhigh
penecho --claude --model opus --effort max
penecho --port 4000
```

`--model`, `--effort`, and `--port` apply only to that process and take precedence over the selected configuration file. Omit them to use the saved choice or the underlying CLI default. Other model-specific effort strings are accepted and passed through.

### Run from this source directory

Install dependencies, expose this checkout's `penecho` executable through npm, configure it, and start it through the same production entry point:

```bash
npm install
npm link
penecho configure
penecho
```

`npm link` creates the local command link; it does not publish the package. There is no separate build step and local development does not use `npm start`.

Open [http://localhost:3888](http://localhost:3888). Other devices on the same trusted LAN can use `http://<this-computer-LAN-IP>:3888`.

## Recommended model configurations

These recommendations balance answer quality against the latency of PenEcho's real canvas workload. They are based on current hands-on testing rather than synthetic benchmarks; actual response time still varies with the provider, canvas complexity, image size, and reasoning behavior.

| Model | Effort | Quality and speed | Recommended use |
| --- | --- | --- | --- |
| `claude-opus-4-8` | `medium` | Strong quality with a better latency balance | Recommended Opus default for everyday canvas work |
| `claude-opus-4-8` | `high` | Higher reasoning quality, with longer and more variable waits | Complex handwriting, mathematics, diagrams, or layout decisions where quality matters more than speed |
| Fable 5 (`claude-fable-5` or `fable`) | `medium` | Very good results; in current tests, often around half the response time of `gpt-5.6-sol` at `xhigh` | A fast, high-quality general-purpose choice |
| Kimi K3 (`k3`) | `medium` | Very good quality in the current comparison; `medium` keeps the quality/speed balance practical | Recommended Kimi/API default for demanding canvas work |
| `gpt-5.6-terra` | `low` to `high` | Surprisingly strong and responsive; current PenEcho canvas tests produced better results than `gpt-5.6-sol` with fast response times | Recommended OpenAI option across a flexible range of quality and latency targets |
| `gpt-5.6-luna` | `xhigh` | Very good canvas results with strong response speed | A responsive quality-first option when `xhigh` reasoning is appropriate |
| `gpt-5.6-sol` | `high` | Good enough for most requests and more responsive than `xhigh` | Recommended Sol default when responsiveness matters |
| `gpt-5.6-sol` | `xhigh` | Very good results, but slower and more variable | Quality-first Sol configuration for difficult canvas tasks |

Google models have not been tested yet. Contributions are welcome: if you try Gemini or another Google model, please share the model ID, provider or executor, reasoning configuration, approximate latency, and a representative canvas example in an issue.

## Token use and cost

For a typical PenEcho canvas request, total output usage—including hidden reasoning tokens when the provider reports them—roughly follows the selected effort level:

| Effort | Typical output usage | Practical guidance |
| --- | --- | --- |
| `low` | Around `1,000` tokens | Usually enough for most everyday canvas requests |
| `medium` | Around `3,000` tokens | More reasoning headroom for recognition, mathematics, diagrams, and layout |
| `xhigh` or `max` | Around `5,000–8,000` tokens | Common for quality-first `gpt-5.6-sol` and other maximum-effort requests; expect higher latency and cost |

These are practical estimates rather than enforced PenEcho limits. Actual usage can vary substantially by model, provider, canvas complexity, and reasoning behavior. The cost example below continues to use the typical `low` case: `10,000` input tokens and `1,000` output tokens. At standard short-context API rates, that would be:

- `gpt-5.6-sol`: `10,000 x $5.00 / 1M + 1,000 x $30.00 / 1M = $0.080`
- `gpt-5.6-terra`: `10,000 x $2.50 / 1M + 1,000 x $15.00 / 1M = $0.040`
- `gpt-5.6-luna`: `10,000 x $1.00 / 1M + 1,000 x $6.00 / 1M = $0.016`

At those example quantities, that is about 1.6 to 8 cents per request. Medium, `xhigh`, and `max` requests can cost more because their reasoning tokens are billed as output. Prices can change, so check the [OpenAI API pricing](https://developers.openai.com/api/docs/pricing) page for current rates.

If you sign in to Codex with ChatGPT, PenEcho uses the Codex usage included with your plan instead of an API key. Included limits vary by plan, and additional usage may require ChatGPT credits. See [Codex pricing](https://learn.chatgpt.com/docs/pricing) for current plans and limits. Claude CLI mode similarly uses the account authenticated by Claude Code; it is distinct from Anthropic API billing.

## Help test more models

PenEcho supports model selection independently for API, Codex CLI, and Claude CLI execution. Model behavior still varies. If you find a model-specific issue, please open an issue with the executor, model name, a reproducible canvas example, expected and actual results, and a screenshot with secrets removed.

## Safe deployment

PenEcho listens on `0.0.0.0:3888` by default so localhost and trusted-LAN access work immediately. Choose the deployment boundary that matches your executor:

- **Codex CLI and Claude CLI modes:** use them only on the local machine or a trusted, directly connected LAN. A valid request starts a local CLI process, so do not expose either mode directly to the public internet or an untrusted reverse proxy. Both work immediately from localhost and LAN addresses without a public-origin setting. PenEcho checks the Host, client network, exact Origin, process-lifetime session cookie, and JSON content type before launching the selected CLI. Each valid new request immediately supersedes the prior request; it never waits in a queue or returns a busy response.
- **API mode:** local, LAN, proxy, and remote requests are intentionally accepted without PenEcho-level Host or Origin restrictions. If you expose it publicly, place it behind HTTPS, authentication, rate limiting, and request-size controls. Keep the selected configuration file and provider keys private; credentials remain in the Node.js process and are never sent to browser code.

For either mode, keep debug artifacts and request tracing disabled in production unless you are actively diagnosing a problem, and never publish configuration files, logs, screenshots, or saved requests containing private content. When request recording is enabled in `Settings`, each valid AI request is stored under `~/.penecho/logs/requests` by default, including the source `atlas.png`, the outbound image, credential-redacted request body, raw and parsed responses, fallback details, and final status. The UI also displays this path and configures retention.

## Useful configuration

The configuration center writes these settings to `~/.penecho/config.env`, or to the file selected with `--config`:

| Setting | Purpose |
| --- | --- |
| `AI_PROVIDER` | Executor: `api`, `codex-cli`, or `claude-cli` |
| `AI_API_FORMAT` | API request format: `openai` (default example) or `anthropic` |
| `AI_API_URL` / `AI_API_KEY` | API endpoint and credential; used only in API mode |
| `AI_API_MODEL` | Model used in API mode |
| `AI_EFFORT` | Startup reasoning effort for the canvas control; the toolbar's `Configured` option preserves this value verbatim, including custom names, while an empty CLI value leaves the CLI default untouched; Anthropic API and Claude CLI support `none` (wire value `thinking.type=disabled`), while OpenAI sends `reasoning_effort=none`; explicit toolbar levels override this value per request without modifying the file |
| `AI_TIMEOUT_SECONDS` | Unified timeout for API, Codex CLI, and Claude CLI model attempts; default 180, allowed range 10–600 |
| `PENECHO_AI_IMAGE_FORMAT` | Image format sent to API, Codex CLI, and Claude CLI: `webp` (default) or `png` |
| `CODEX_CLI_MODEL` | Optional model override for Codex CLI mode |
| `CLAUDE_CLI_MODEL` | Optional alias or model-ID override for Claude CLI mode |
| `AUTO_AI_DELAY_SECONDS` | Initial delay before automatic recognition; the browser control can override it from 0 to 10 seconds |
| `PENECHO_REQUEST_TRACE` | Save local per-request image, outbound request, response, and outcome traces; disabled by default |
| `PENECHO_REQUEST_TRACE_LIMIT` | Number of local request traces retained, default 100 and maximum 1000 |
| `HOST` / `PORT` | Listening interface and port, default `0.0.0.0:3888` |

For installed CLI starts, `--model` overrides the selected executor's model setting and `--effort` overrides `AI_EFFORT` for that process only. Command-line options and process environment variables take precedence over the selected configuration file.

Run the checks before submitting a change:

```bash
npm run check
```

For implementation details, see the [architecture notes](docs/architecture.md).

## Build it with us

PenEcho is young and built in the open. The problems that matter most — handwriting recognition, on-canvas visual tools, wider model support, and natural pen interaction — are still open, and you do not need to write code to help move them forward.

Ways to help:

- **Use it and share what happened.** A canvas that worked well, or one that fell apart, tells us more than any benchmark. A screenshot with secrets removed is enough.
- **Test a model.** Try any model or provider and report the executor, model ID, effort, rough latency, and a sample result. Google/Gemini models are still untested and especially welcome.
- **Report rough edges.** Recognition misses, layout glitches, and awkward pen behavior are all worth an issue, however small.
- **Write code.** Recognition, visual tools, model adapters, and pen input each have room to grow. `npm run check` runs the full suite before you open a pull request.
- **Help more people read it.** The UI ships English and Chinese today; more translations and clearer docs are welcome.

Where to talk:

- [Discord](https://discord.gg/3jrPJ3mXdX) — real-time discussion, model-testing notes, and shared canvas workflows. New faces and works-in-progress are always welcome.
- [GitHub Discussions](https://github.com/erickong/penecho/discussions) — ideas and questions worth keeping searchable.
- [GitHub Issues](https://github.com/erickong/penecho/issues) — reproducible bugs and confirmed work.

New contributors start with [CONTRIBUTING.md](CONTRIBUTING.md). If PenEcho clicks for you, star the repo and share the demo — that visibility is what brings the next person in.

## License and commercial use

PenEcho is open source under [GNU AGPL v3.0 only](LICENSE). Commercial use is allowed under the AGPL. If you modify PenEcho and provide that version to users over a network, you must offer those users the corresponding source code as required by the license.

An alternative [commercial license](COMMERCIAL-LICENSE.md) is available for proprietary products and hosted services that cannot meet the AGPL requirements. The PenEcho name and logo are governed separately by the [PenEcho trademark policy](TRADEMARKS.md).

Contributors keep ownership of their work and grant the project the rights needed to offer both AGPL and commercial editions. See the [contributor agreement](CONTRIBUTOR-LICENSE-AGREEMENT.md).
