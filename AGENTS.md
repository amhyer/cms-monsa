# AGENTS.md — Non-Obvious Learnings

## Playwright Testing

- **`getByRole("alert")` fails on `<p role="alert">`**: Playwright's accessible-name matching doesn't work reliably with `<p>` elements that have `role="alert"`. Use `locator("p[role='alert']", { hasText: "..." })` instead. The accessibility tree WILL show the alerts — the issue is in Playwright's name computation, not the DOM.

- **Tailwind v4 dark mode colors use `oklch()`, not `rgb()`**: When testing dark mode backgrounds in e2e specs, don't assert `rgb()` format. Check `color-scheme: dark` CSS property, or parse `oklch()` lightness value (`< 0.3` = dark). Existing specs that check `rgb()` will fail silently or throw.

- **E2E timeout from dev server warmup**: Under heavy load (repeated Playwright runs), Next.js Turbopack can leave pages stuck on "Memuat…" (loading state) — the page never hydrates and interactive elements never appear. This is a pre-existing infrastructure issue, not a code bug. Kill the dev server and restart if tests hang.

- **`next/image` breaks `img[src^='http']` selectors**: After the `<img>` → `next/image` migration, rendered `src` is rewritten to `/_next/image?url=…` (even for external URLs), so e2e specs asserting a raw-URL prefix fail (this exact regression failed 3 CI e2e jobs on 2026-09-22, fixed in `7a0febb`). Match both forms: `img[src^='http'], img[src^='/_next/image']`. Admin-pasted URLs from hosts outside `next.config.ts` `images.remotePatterns` render raw via `smart-image.tsx` (keeps `unoptimized`) — that's why the allowlist there and `OPTIMIZED_REMOTE_HOSTS` must stay in sync (pinned by `smart-image.test.ts`).

## ThemeToggle Mobile Visibility

- **RESOLVED 2026-09**: ThemeToggle is `inline-flex` (no `hidden sm:inline-flex`) in both `src/components/public/site-header.tsx` and `src/app/dashboard/layout.tsx`, and the mobile sheet also renders one — mobile users can switch themes. Don't re-add the `hidden` class.

## Pre-commit Hook

- **`.githooks/pre-commit` runs the FULL gate** (typecheck + lint + markdownlint + schema-sync + vitest) via `run-checks.sh`. This can take 2-5 minutes. Use `git commit --no-verify` when you've already verified tests pass. The hook delegates to `bun run hooks:check` which is the single source of truth.

## Frontend Cache Strategy

- **`home-view.tsx` now relies on Cache-Control** (resolved 2026-09): the `cache: "no-store"` + `_=${Date.now()}` cache-busters were removed; browser caching works through the `s-maxage`/`stale-while-revalidate` headers set on public API routes. Don't reintroduce per-request cache-busters — they silently defeat that strategy.

## Graphify (Knowledge Graph Tool)

- **No API key needed for code extraction**: graphify's AST extraction is pure Python (tree-sitter) — works without any API key. Only semantic extraction of docs/papers/images needs `GEMINI_API_KEY`. For inline extraction without subagents, write chunk JSON files directly using the extraction spec schema.
- **Python interpreter path**: Stored in `graphify-out/.graphify_python`. Always use `$(cat graphify-out/.graphify_python)` instead of `python3` in subsequent commands.
- **Semantic cache**: Stored in `graphify-out/.graphify_cached.json`. The `check_semantic_cache` function returns uncached files that need extraction.
- **Health check warnings**: 590 dangling-endpoint edges in graph is normal for large codebases — these are edges where one endpoint node was filtered or pruned during build. Not a corruption issue.
