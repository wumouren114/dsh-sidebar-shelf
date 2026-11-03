// dsh-sidebar-shelf — browser half.
//
// What it does
//   Every DSH panel that registers an entry in the root `sidebar.panellist` list
//   normally gets a permanent row in the left sidebar. This plugin hides that
//   whole list and replaces it with one calm "Panels" button in the sidebar
//   footer (`sidebar.footer.action`). Pressing it opens a searchable shelf with
//   every registered panel; picking one calls the official
//   `ctx.layout.selectPanel(id)` and the shelf closes.
//
// Why it is built this way
//   The panel list is owned by @deepseek-ai/dsh-client-ui-sidebar, so no
//   third-party plugin can re-declare or re-order it. The stable contract we do
//   get is: registrations live in the `sidebar.panellist` slot, each entry is an
//   icon component with an `id` / `label` / `order`, the list is the sidebar's
//   direct `<nav>` child, and selection goes through `ctx.layout.selectPanel`.
//   The shelf therefore reads the slot registry for truth (no hard-coded names)
//   and only toggles one attribute on the sidebar root to hide that `<nav>`.
//
// Distribution
//   Hand-written browser bundle: no build step, no prepare script, so installing
//   straight from GitHub never needs a pnpm build-approval.

window.__ModuleLoader__.load({
	id: "dsh-sidebar-shelf",
	factory: (require) => {
		const React = require("react");
		const ReactDOM = require("react-dom");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const slotsCore = require("@deepseek-ai/dsh-client-ui-slots");

		const h = React.createElement;
		const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } = React;

		const NS = "sidebarShelf";
		const ATTR = "data-dsh-shelf";
		const STYLE_ID = "dsh-sidebar-shelf/style";
		const SEARCH_FROM = 7; // show the search box once there are more than 7 panels
		const POP_WIDTH = 300;
		const VIEWPORT_MARGIN = 12;

		// ---------------------------------------------------------------- copy

		const zh = {
			title: "面板",
			"title.count": "个面板",
			search: "搜索面板…",
			empty: "没有匹配的面板",
			hint: "↑↓ 选择 · ↵ 打开 · Esc 关闭",
			open: "打开",
			button: "面板收纳架",
		};

		const en = {
			title: "Panels",
			"title.count": "panels",
			search: "Search panels…",
			empty: "No matching panels",
			hint: "↑↓ move · ↵ open · Esc close",
			open: "Open",
			button: "Panel shelf",
		};

		// ----------------------------------------------------------------- css

		const CSS = [
			// Hide only the sidebar's own panel list; nothing else is touched.
			'[' + ATTR + '="on"] > nav { display: none !important; }',
			".dshs-root { display: block; width: 100%; }",
			// Trigger row, visually a sibling of the Settings row.
			".dshs-trigger {",
			"  box-sizing: border-box; display: flex; align-items: center; gap: 8px;",
			"  width: 100%; min-height: 36px; margin: 0 2px 2px; padding: 7px 8px;",
			"  border: 0; border-radius: var(--dsw-radius-md); background: transparent;",
			"  color: var(--dsw-alias-label-primary); font: inherit; line-height: 22px;",
			"  text-align: left; cursor: pointer;",
			"  transition: background .12s var(--ds-ease-in-out);",
			"}",
			".dshs-trigger:hover, .dshs-trigger[data-open='true'] { background: var(--dsw-alias-interactive-bg-hover); }",
			".dshs-trigger:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: -2px; }",
			".dshs-trigger-icon { display: inline-flex; flex: none; color: var(--dsw-alias-label-secondary); }",
			".dshs-trigger[data-open='true'] .dshs-trigger-icon { color: var(--dsw-alias-label-primary); }",
			".dshs-trigger-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
			".dshs-count {",
			"  flex: none; min-width: 20px; height: 18px; padding: 0 6px; border-radius: 9px;",
			"  font-size: 11px; font-variant-numeric: tabular-nums; line-height: 17px; text-align: center;",
			"  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2);",
			"  border: .5px solid var(--dsw-alias-border-l2); box-sizing: border-box;",
			"}",
			// Rail (56px) form.
			".dshs-root[data-rail='true'] .dshs-trigger { width: 36px; height: 36px; min-height: 0; margin: 0; padding: 0; justify-content: center; }",
			".dshs-root[data-rail='true'] .dshs-trigger-label, .dshs-root[data-rail='true'] .dshs-count { display: none; }",
			// Popover card.
			".dshs-pop {",
			"  position: fixed; z-index: 2147483000; box-sizing: border-box;",
			"  padding: 6px; border-radius: var(--dsw-radius-lg);",
			"  background: var(--dsw-alias-bg-layer-1);",
			"  border: .5px solid var(--dsw-alias-border-l2);",
			"  box-shadow: var(--dsw-shadow-lv3);",
			"  color: var(--dsw-alias-label-primary); font: inherit;",
			"  animation: dshs-in .14s var(--ds-ease-in-out);",
			"}",
			".dshs-pop:focus { outline: none; }",
			"@keyframes dshs-in { from { opacity: 0; transform: translateY(4px) scale(.985); } to { opacity: 1; transform: none; } }",
			".dshs-head { display: flex; align-items: baseline; gap: 8px; padding: 6px 8px 7px; }",
			".dshs-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; letter-spacing: .01em; }",
			".dshs-meta { flex: none; font-size: 11px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }",
			".dshs-search { padding: 0 4px 6px; }",
			".dshs-search input {",
			"  box-sizing: border-box; width: 100%; height: 32px; padding: 0 10px;",
			"  border-radius: var(--dsw-radius-md); border: .5px solid var(--dsw-alias-border-l2);",
			"  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);",
			"  font: inherit; font-size: 13px; outline: none;",
			"}",
			".dshs-search input::placeholder { color: var(--dsw-alias-label-tertiary); }",
			".dshs-search input:focus { border-color: var(--dsw-alias-state-business-primary); }",
			".dshs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; max-height: min(58vh, 420px); overflow: auto; padding: 2px; overscroll-behavior: contain; }",
			".dshs-tile {",
			"  display: flex; align-items: center; gap: 8px; min-width: 0; height: 38px;",
			"  padding: 0 9px; border: 0; border-radius: var(--dsw-radius-md);",
			"  background: transparent; color: var(--dsw-alias-label-primary);",
			"  font: inherit; font-size: 13px; text-align: left; cursor: pointer;",
			"  transition: background .1s var(--ds-ease-in-out);",
			"}",
			".dshs-tile:hover, .dshs-tile[data-focus='true'] { background: var(--dsw-alias-interactive-bg-hover); }",
			".dshs-tile:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: -2px; }",
			".dshs-tile[data-active='true'] { color: var(--dsw-alias-brand-primary); }",
			".dshs-tile-icon { display: inline-flex; flex: none; width: 18px; justify-content: center; color: var(--dsw-alias-label-secondary); }",
			".dshs-tile[data-active='true'] .dshs-tile-icon { color: var(--dsw-alias-brand-primary); }",
			".dshs-tile-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
			".dshs-tile-dot { flex: none; width: 5px; height: 5px; border-radius: 50%; background: var(--dsw-alias-brand-primary); }",
			".dshs-fallback {",
			"  display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px;",
			"  border-radius: 5px; font-size: 10px; font-weight: 600; line-height: 1;",
			"  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-3);",
			"}",
			".dshs-empty { grid-column: 1 / -1; padding: 14px 8px 16px; text-align: center; font-size: 12px; color: var(--dsw-alias-label-tertiary); }",
			".dshs-foot { padding: 7px 8px 3px; font-size: 11px; color: var(--dsw-alias-label-tertiary); }",
			"@media (prefers-reduced-motion: reduce) { .dshs-pop { animation: none; } .dshs-trigger, .dshs-tile { transition: none; } }",
		].join("\n");

		function ensureStyle() {
			if (typeof document === "undefined") return;
			if (document.getElementById(STYLE_ID) !== null) return;
			const tag = document.createElement("style");
			tag.id = STYLE_ID;
			tag.dataset.plugin = "dsh-sidebar-shelf";
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		function removeStyle() {
			if (typeof document === "undefined") return;
			document.getElementById(STYLE_ID)?.remove();
		}

		// ------------------------------------------------------------- entries

		/**
		 * Snapshot the live panel registrations.
		 * Mirrors the sidebar's own sort (order, then registration order) so the
		 * shelf lists panels in exactly the order the shell would have drawn them.
		 */
		function readPanels(slotsApi) {
			let registered;
			try {
				registered = slotsApi.entriesOfSlot("sidebar.panellist") ?? [];
			} catch (error) {
				console.warn("[dsh-sidebar-shelf] cannot read sidebar.panellist", error);
				return [];
			}
			const seen = new Set();
			const panels = [];
			for (const entry of registered) {
				const id = entry?.options?.id;
				if (typeof id !== "string" || seen.has(id)) continue;
				seen.add(id);
				let label = id;
				try {
					label = slotsCore.resolveSlotLabel(entry.options.label) ?? id;
				} catch {
					// A malformed label must never hide a panel.
				}
				panels.push({
					id,
					order: entry.options.order ?? 0,
					label: typeof label === "string" && label.length > 0 ? label : id,
					icon: entry.component,
				});
			}
			panels.sort((a, b) => a.order - b.order);
			return panels;
		}

		/** One glyph from the panel's own slot component, with a safe fallback. */
		class GlyphBoundary extends React.Component {
			constructor(props) {
				super(props);
				this.state = { failed: false };
			}
			static getDerivedStateFromError() {
				return { failed: true };
			}
			componentDidCatch(error) {
				console.warn("[dsh-sidebar-shelf] panel icon failed, using fallback", error);
			}
			render() {
				return this.state.failed === true ? this.props.fallback : this.props.children;
			}
		}

		function PanelGlyph({ panel, active, size }) {
			const initial = typeof panel.label === "string" && panel.label.length > 0 ? panel.label.trim().slice(0, 1).toUpperCase() : "?";
			const fallback = h("span", { className: "dshs-fallback", "aria-hidden": "true" }, initial);
			if (typeof panel.icon !== "function" && (typeof panel.icon !== "object" || panel.icon === null)) return fallback;
			return h(
				GlyphBoundary,
				{ fallback },
				h(panel.icon, { size: size ?? 18, active: active === true }),
			);
		}

		// -------------------------------------------------------------- trigger

		function ShelfRoot({ wide, t, slotsApi, selectPanel, useActivePanel, localeApi }) {
			// `useActivePanel` is the documented `hooks` share (layout's panelInfo
			// source). Keep the fallback stable so the hook order never changes.
			const useActivePanelId = typeof useActivePanel === "function" ? useActivePanel : () => null;
			const activeId = useActivePanelId((info) => info?.activePanelId ?? null);

			const [panels, setPanels] = useState(() => readPanels(slotsApi));
			const [open, setOpen] = useState(false);
			const [query, setQuery] = useState("");
			const [focusIndex, setFocusIndex] = useState(-1);
			const [position, setPosition] = useState(null);

			const rootRef = useRef(null);
			const triggerRef = useRef(null);
			const popRef = useRef(null);
			const cardRef = useRef(null);
			const inputRef = useRef(null);
			const tileRefs = useRef([]);

			// Keep the shelf in sync with plugins enabled/disabled at runtime.
			useEffect(() => {
				const sync = () => setPanels(readPanels(slotsApi));
				sync();
				const disposers = [];
				const subscribe = (target, listener) => {
					try {
						const dispose = target?.subscribe?.(listener);
						if (typeof dispose === "function") disposers.push(dispose);
					} catch (error) {
						console.warn("[dsh-sidebar-shelf] cannot subscribe to panel changes", error);
					}
				};
				subscribe(slotsApi, sync);
				// Labels are locale thunks: re-read them when the language changes.
				subscribe(localeApi, sync);
				return () => {
					for (const dispose of disposers) {
						try {
							dispose();
						} catch {
							// Disposal races are harmless.
						}
					}
				};
			}, [slotsApi, localeApi]);

			// Mark the sidebar root so the CSS can hide its direct <nav> child.
			useEffect(() => {
				if (panels.length === 0) return undefined;
				let marked = null;
				let frame = 0;
				const locate = () => {
					let node = rootRef.current;
					while (node !== null && node !== undefined && node !== document.body) {
						if (typeof node.querySelector === "function" && node.querySelector(":scope > nav") !== null) return node;
						node = node.parentElement;
					}
					return null;
				};
				const mark = () => {
					if (marked !== null) return true;
					const root = locate();
					if (root === null) return false;
					root.setAttribute(ATTR, "on");
					marked = root;
					return true;
				};
				if (mark()) {
					return () => marked?.removeAttribute(ATTR);
				}
				const observer = new MutationObserver(() => {
					if (frame !== 0) return;
					frame = requestAnimationFrame(() => {
						frame = 0;
						if (mark()) observer.disconnect();
					});
				});
				observer.observe(document.body, { childList: true, subtree: true });
				return () => {
					observer.disconnect();
					if (frame !== 0) cancelAnimationFrame(frame);
					marked?.removeAttribute(ATTR);
				};
			}, [panels.length]);

			const close = useCallback(() => {
				setOpen(false);
				setQuery("");
				setFocusIndex(-1);
				triggerRef.current?.focus({ preventScroll: true });
			}, []);

			const activate = useCallback(
				(id) => {
					setOpen(false);
					setQuery("");
					setFocusIndex(-1);
					try {
						selectPanel(id);
					} catch (error) {
						console.warn("[dsh-sidebar-shelf] cannot open panel " + id, error);
					}
				},
				[selectPanel],
			);

			const filtered = useMemo(() => {
				const needle = query.trim().toLowerCase();
				if (needle.length === 0) return panels;
				return panels.filter((panel) => panel.label.toLowerCase().includes(needle) || panel.id.toLowerCase().includes(needle));
			}, [panels, query]);

			useEffect(() => {
				setFocusIndex(-1);
			}, [query, open]);

			// Place the portalled card next to the trigger; flip below when short on room.
			useLayoutEffect(() => {
				if (!open) {
					setPosition(null);
					return undefined;
				}
				const place = () => {
					const trigger = triggerRef.current;
					if (trigger === null) return;
					const rect = trigger.getBoundingClientRect();
					const viewportWidth = window.innerWidth;
					const viewportHeight = window.innerHeight;
					const width = Math.min(POP_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2);
					// In the 56px rail, open beside the rail instead of on top of it.
					const rail = rootRef.current?.getAttribute("data-rail") === "true";
					const preferredLeft = rail ? rect.right + 10 : rect.left;
					const left = Math.min(Math.max(preferredLeft, VIEWPORT_MARGIN), viewportWidth - width - VIEWPORT_MARGIN);
					if (rect.top > 360) {
						setPosition({ left, bottom: viewportHeight - rect.top + 6, width });
					} else {
						setPosition({ left, top: rect.bottom + 6, width });
					}
				};
				place();
				window.addEventListener("resize", place);
				window.addEventListener("scroll", place, true);
				return () => {
					window.removeEventListener("resize", place);
					window.removeEventListener("scroll", place, true);
				};
			}, [open]);

			// Dismiss on outside pointer / Escape anywhere.
			useEffect(() => {
				if (!open) return undefined;
				const onPointerDown = (event) => {
					const target = event.target;
					if (popRef.current?.contains(target) === true) return;
					if (triggerRef.current?.contains(target) === true) return;
					setOpen(false);
					setQuery("");
				};
				const onKey = (event) => {
					if (event.key === "Escape") {
						event.stopPropagation();
						close();
					}
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				document.addEventListener("keydown", onKey, true);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown, true);
					document.removeEventListener("keydown", onKey, true);
				};
			}, [open, close]);

			// Keep the keyboard on the card itself: no visible focus ring on a
			// mouse-opened shelf, but arrow keys still drive the highlighted tile.
			useEffect(() => {
				if (!open) return;
				if (panels.length > SEARCH_FROM) {
					inputRef.current?.focus({ preventScroll: true });
				} else {
					cardRef.current?.focus({ preventScroll: true });
				}
			}, [open, panels.length]);

			const moveFocus = useCallback(
				(delta) => {
					if (filtered.length === 0) return;
					setFocusIndex((current) => {
						if (current < 0) return delta > 0 ? 0 : filtered.length - 1;
						const next = current + delta;
						if (next < 0) return filtered.length - 1;
						if (next >= filtered.length) return 0;
						return next;
					});
				},
				[filtered.length],
			);

			// Follow the keyboard highlight inside the scrollable grid.
			useEffect(() => {
				if (focusIndex < 0) return;
				tileRefs.current[focusIndex]?.scrollIntoView({ block: "nearest" });
			}, [focusIndex]);

			const onPopoverKeyDown = (event) => {
				if (event.key === "Enter" && event.target === cardRef.current) {
					event.preventDefault();
					const panel = filtered[focusIndex];
					if (panel !== undefined) activate(panel.id);
					return;
				}
				if (event.key === "Enter" && showSearch && event.target === inputRef.current) {
					event.preventDefault();
					const panel = filtered[focusIndex];
					if (panel !== undefined) activate(panel.id);
					return;
				}
				if (event.key === "ArrowDown") {
					event.preventDefault();
					moveFocus(1);
					return;
				}
				if (event.key === "ArrowUp") {
					event.preventDefault();
					moveFocus(-1);
					return;
				}
				if (event.key === "Home") {
					event.preventDefault();
					setFocusIndex(0);
					return;
				}
				if (event.key === "End") {
					event.preventDefault();
					setFocusIndex(Math.max(0, filtered.length - 1));
				}
			};

			if (panels.length === 0) return null;

			const showSearch = panels.length > SEARCH_FROM;
			const rail = wide !== true;
			// When a panel is open, the trigger doubles as a "you are here" marker.
			const activePanel = activeId === null ? null : panels.find((panel) => panel.id === activeId);
			const triggerLabel = activePanel === null || activePanel === undefined ? t("title") : activePanel.label;
			const triggerGlyph =
				activePanel === null || activePanel === undefined
					? h(primitives.IconAppsAddOutlineRegular, { size: rail ? 18 : 16 })
					: h(PanelGlyph, { panel: activePanel, active: true, size: rail ? 18 : 16 });

			const popover =
				open === true
					? ReactDOM.createPortal(
							h(
								"div",
								{
									ref: (node) => {
										popRef.current = node;
										cardRef.current = node;
									},
									className: "dshs-pop",
									style: position ?? { left: -9999, top: -9999, width: POP_WIDTH, outline: "none" },
									role: "dialog",
									"aria-modal": "false",
									"aria-label": t("button"),
									tabIndex: -1,
									onKeyDown: onPopoverKeyDown,
								},
								h(
									"div",
									{ className: "dshs-head" },
									h("span", { className: "dshs-title" }, t("title")),
									h("span", { className: "dshs-meta" }, panels.length + " " + t("title.count")),
								),
								showSearch
									? h(
											"div",
											{ className: "dshs-search" },
											h("input", {
												ref: inputRef,
												type: "search",
												value: query,
												placeholder: t("search"),
												"aria-label": t("search"),
												onChange: (event) => setQuery(event.target.value),
											}),
										)
									: null,
								h(
									"div",
									{ className: "dshs-grid", role: "menu" },
									filtered.length === 0
										? h("div", { className: "dshs-empty" }, t("empty"))
										: filtered.map((panel, index) =>
												h(
													"button",
													{
														key: panel.id,
														ref: (node) => {
															tileRefs.current[index] = node;
														},
														type: "button",
														role: "menuitem",
														className: "dshs-tile",
														"data-active": panel.id === activeId ? "true" : undefined,
														"data-focus": index === focusIndex ? "true" : undefined,
														"aria-current": panel.id === activeId ? "page" : undefined,
														title: panel.label,
														onMouseEnter: () => setFocusIndex(index),
														onClick: () => activate(panel.id),
													},
													h("span", { className: "dshs-tile-icon", "aria-hidden": "true" }, h(PanelGlyph, { panel, active: panel.id === activeId })),
													h("span", { className: "dshs-tile-label" }, panel.label),
													panel.id === activeId ? h("span", { className: "dshs-tile-dot", "aria-hidden": "true" }) : null,
												),
											),
								),
								h("div", { className: "dshs-foot" }, t("hint")),
							),
							document.body,
						)
					: null;

			return h(
				"div",
				{ className: "dshs-root", ref: rootRef, "data-rail": rail ? "true" : "false" },
				h(
					"button",
					{
						ref: triggerRef,
						type: "button",
						className: "dshs-trigger",
						"data-open": open ? "true" : undefined,
						"aria-haspopup": "dialog",
						"aria-expanded": open ? "true" : "false",
						"aria-label": t("button"),
						title: rail ? t("button") : undefined,
						onClick: () => setOpen((value) => !value),
					},
					h("span", { className: "dshs-trigger-icon", "aria-hidden": "true" }, triggerGlyph),
					rail ? null : h("span", { className: "dshs-trigger-label" }, triggerLabel),
					rail ? null : h("span", { className: "dshs-count" }, String(panels.length)),
				),
				popover,
			);
		}

		// ---------------------------------------------------------------- apply

		const inject = ["slots", "layout", "locale"];

		function apply(ctx) {
			ctx.effect(() => {
				ensureStyle();
				return () => removeStyle();
			}, "dsh-sidebar-shelf: styles");

			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-sidebar-shelf: dictionaries");
			const t = ctx.locale.bind(NS);

			ctx.slots.inject("sidebar.footer.action", () =>
				ctx.slots.register(
					{
						name: "sidebar.footer.action",
						id: "dsh-sidebar-shelf",
						order: 20,
						locale: NS,
						inject: () => ({
							slotsApi: ctx.slots,
							localeApi: ctx.locale,
							selectPanel: (id) => ctx.layout.selectPanel(id),
							hooks: { activePanel: ctx.layout.panelInfo },
						}),
					},
					ShelfRoot,
				),
			);
		}

		const module = { exports: { name: "dsh-sidebar-shelf", inject, apply } };
		return module.exports;
	},
});
