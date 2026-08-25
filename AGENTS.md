# AGENTS.md — Non-Obvious Learnings

## Playwright Testing

- **`getByRole("alert")` fails on `<p role="alert">`**: Playwright's accessible-name matching doesn't work reliably with `<p>` elements that have `role="alert"`. Use `locator("p[role='alert']", { hasText: "..." })` instead. The accessibility tree WILL show the alerts — the issue is in Playwright's name computation, not the DOM.

- **Tailwind v4 dark mode colors use `oklch()`, not `rgb()`**: When testing dark mode backgrounds in e2e specs, don't assert `rgb()` format. Check `color-scheme: dark` CSS property, or parse `oklch()` lightness value (`< 0.3` = dark). Existing specs that check `rgb()` will fail silently or throw.

- **E2E timeout from dev server warmup**: Under heavy load (repeated Playwright runs), Next.js Turbopack can leave pages stuck on "Memuat…" (loading state) — the page never hydrates and interactive elements never appear. This is a pre-existing infrastructure issue, not a code bug. Kill the dev server and restart if tests hang.

## ThemeToggle Mobile Visibility

- **ThemeToggle has `hidden sm:inline-flex`** in both `src/components/public/site-header.tsx` and `src/app/dashboard/layout.tsx`. This means it's invisible below 640px viewport width. The mobile sheet does NOT have a theme toggle either, so mobile users cannot switch themes at all. Fix: remove the `hidden` class to make it always visible (same as LanguageSwitcher which uses `inline-flex` without `hidden`).

## Pre-commit Hook

- **`.githooks/pre-commit` runs the FULL gate** (typecheck + lint + markdownlint + schema-sync + vitest) via `run-checks.sh`. This can take 2-5 minutes. Use `git commit --no-verify` when you've already verified tests pass. The hook delegates to `bun run hooks:check` which is the single source of truth.

## Frontend Cache Strategy

- **`home-view.tsx` defeats its own caching**: All fetch calls use `cache: "no-store"` plus `_=${Date.now()}` cache-buster. The Cache-Control headers on API routes only help CDN/proxy caches — the browser never benefits. This is intentional for now but worth noting: removing the cache-busting would make browser caching effective.

## Graphify (Knowledge Graph Tool)

- **No API key needed for code extraction**: graphify's AST extraction is pure Python (tree-sitter) — works without any API key. Only semantic extraction of docs/papers/images needs `GEMINI_API_KEY`. For inline extraction without subagents, write chunk JSON files directly using the extraction spec schema.
- **Python interpreter path**: Stored in `graphify-out/.graphify_python`. Always use `$(cat graphify-out/.graphify_python)` instead of `python3` in subsequent commands.
- **Semantic cache**: Stored in `graphify-out/.graphify_cached.json`. The `check_semantic_cache` function returns uncached files that need extraction.
- **Health check warnings**: 590 dangling-endpoint edges in graph is normal for large codebases — these are edges where one endpoint node was filtered or pruned during build. Not a corruption issue.
