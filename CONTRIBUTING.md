# Contributing to PenEcho

Thank you for improving PenEcho.

## Development Setup

1. Install Node.js 18 or newer.
2. Choose one execution mode:

   **API mode**

   ```bash
   # macOS or Linux
   cp .env.api .env

   # Windows PowerShell
   Copy-Item .env.api .env
   ```

   Replace `AI_API_KEY`, `AI_API_URL`, and `AI_API_MODEL` in `.env` with your provider key, endpoint, and model.

   **Codex CLI mode**

   ```bash
   codex login

   # macOS or Linux
   cp .env.codex .env

   # Windows PowerShell
   Copy-Item .env.codex .env
   ```

   Codex mode uses the installed and authenticated Codex CLI. It does not require an API key and is not a local-model configuration.

   **Claude CLI mode**

   ```bash
   claude auth login

   # macOS or Linux
   cp .env.claude .env

   # Windows PowerShell
   Copy-Item .env.claude .env
   ```

   Claude mode uses the installed and authenticated Claude Code CLI and does not require an API key.

3. Run `npm start`.
4. Open `http://localhost:3888`, or use this computer's LAN IP from another device on the same trusted network.

## Before Submitting Changes

Run:

```bash
npm run check
```

For browser-facing changes, verify desktop and mobile layouts and test stylus/mouse drawing, touch navigation, Manual/Auto AI delay controls, AI draft confirmation, New canvas choices, and local snapshots.

## Engineering Guidelines

- Keep server secrets out of `public/`, logs, screenshots, and test fixtures.
- Preserve the sparse tile architecture. Do not allocate a full 20k canvas bitmap.
- Keep English as the default interface and source-facing language. Add user-visible Chinese copy through the localization table.
- Do not persist unconfirmed AI drafts in local snapshots.
- Use dependencies only when their licenses explicitly permit commercial use.
- Keep changes focused and document new data formats or external services.

## Contribution Licensing

PenEcho is offered under `AGPL-3.0-only` and may also be offered under separate commercial terms. To keep both paths possible, every copyrightable contribution is subject to the [PenEcho Contributor License Agreement](CONTRIBUTOR-LICENSE-AGREEMENT.md).

You retain ownership of your contribution. You grant the Project Owner a non-exclusive license to include it in the public AGPL project and in commercially licensed PenEcho editions. Any accepted contribution used in a commercial edition must also remain available in the canonical repository under `AGPL-3.0-only`.

By opening a pull request and confirming the contributor-agreement checkbox, you accept those terms. Do not submit code owned by an employer or another party unless you have permission to grant these rights.

## Pull Requests

Describe the user-visible behavior, implementation approach, validation performed, and any known limitations. Avoid committing `.env`, logs, browser test output, local agent state, or generated dependency directories.
