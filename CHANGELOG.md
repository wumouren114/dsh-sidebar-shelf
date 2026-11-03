# Changelog

## 0.2.1 — 2026-11-03

- **Adopt DOM-injected sidebar rows.** Plugins that bypass `sidebar.panellist` and inject a row into the sidebar root (the `data-dsh-*-entry` convention used by `dsh-webchat`, taskboard and ssh) are now hidden in place and listed at the top of the shelf with their own icon, label and `data-active` state. Choosing one calls that row's own `click()`, so its toggle/panel logic keeps working.
- Stop clicks inside the portalled card from bubbling through the React tree into the shell's panel row (which had raised `layout.selectPanel: main panel "dsh-sidebar-shelf-entry" is not registered` after choosing a tile).
- Test fixture now injects a fake `data-dsh-demo-entry` row; e2e grew to 23 checks covering adoption.

## 0.2.0 — 2026-11-03

- **Moved the entry into the panel column**: the shelf is now a native `sidebar.panellist` row between New Session and the workspace, exactly where the panel list was — no more footer row.
- Only sibling panel rows are hidden; the list element and our row keep the shell's own geometry, spacing, tooltip and 56px rail form.
- Row clicks are intercepted in the capture phase, so the shell never selects a main panel that does not exist for the shelf id.
- Rail shelf now opens beside the rail; the card drops directly under the row in wide mode.
- Removed the footer trigger, count badge and the trigger's "active panel" mirroring (the shelf itself still marks the active panel).

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
