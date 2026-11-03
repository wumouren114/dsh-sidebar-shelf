# Changelog

## 0.1.0 — 2026-11-03

First public release.

- Collapse every `sidebar.panellist` entry into one shelf row in `sidebar.footer.action`.
- Searchable two-column shelf with each panel's own registered icon (error-boundary fallback).
- Keyboard navigation: arrows, Home/End, Enter, Escape, type-to-filter.
- The trigger mirrors the active panel (icon + name) so the sidebar still shows where you are.
- 56px rail mode: 36px icon trigger, shelf opens beside the rail.
- Light/dark tokens only; reduced-motion support.
- No build step and no install scripts, so GitHub installs need no pnpm build approval.
- Tests: `test/smoke.mjs` (static + wiring), `test/e2e.cjs` (real UI, 17 checks, screenshots).
