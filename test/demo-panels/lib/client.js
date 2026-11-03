// Test-only fixture: registers realistic-looking panels (nav entry + main page)
// so the shelf can be exercised without installing a pile of real plugins.
// It also injects one sidebar row the way dsh-webchat does (a direct child of
// the sidebar root carrying a `data-dsh-*-entry` attribute), so the shelf's
// adoption path is covered.
window.__ModuleLoader__.load({
	id: "dsh-sidebar-shelf-demo-panels",
	factory: (require) => {
		const React = require("react");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const h = React.createElement;

		const PANELS = [
			{ id: "demo-market", order: 10, label: "插件市场", icon: primitives.IconPluginPinwheelOutlineRegular, tint: "#6b5cff" },
			{ id: "demo-mcp", order: 20, label: "MCP Studio", icon: primitives.IconApiOutlineRegular, tint: "#0ea5e9" },
			{ id: "demo-context", order: 30, label: "上下文", icon: primitives.IconContextInjectionOutlineRegular, tint: "#10b981" },
			{ id: "demo-skills", order: 40, label: "技能管理", icon: primitives.IconSkillOutlineRegular, tint: "#f59e0b" },
			{ id: "demo-monitor", order: 50, label: "系统监控", icon: primitives.IconGaugeOutlineRegular, tint: "#ef4444" },
			{ id: "demo-terminal", order: 60, label: "终端", icon: primitives.IconCodeOutlineRegular, tint: "#64748b" },
			{ id: "demo-database", order: 70, label: "数据库", icon: primitives.IconDatabaseOutlineRegular, tint: "#8b5cf6" },
			{ id: "demo-pet", order: 80, label: "桌宠工坊", icon: primitives.IconSparkleRegular, tint: "#ec4899" },
			{ id: "demo-voice", order: 90, label: "语音输入", icon: primitives.IconMicrophoneOutlineRegular, tint: "#14b8a6" },
			{ id: "demo-usage", order: 100, label: "用量与余额", icon: primitives.IconGaugeOutlineRegular, tint: "#f97316" },
		];

		function Placeholder({ panel }) {
			return h(
				"div",
				{
					style: {
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						gap: 12,
						height: "100%",
						minHeight: 320,
						color: "var(--dsw-alias-label-secondary)",
					},
				},
				h("div", { style: { color: panel.tint } }, h(panel.icon, { size: 44 })),
				h("div", { style: { fontSize: 20, fontWeight: 600, color: "var(--dsw-alias-label-primary)" } }, panel.label),
				h("div", { style: { fontSize: 13 } }, "Demo panel registered by the test fixture"),
			);
		}

		// Mimics dsh-webchat: a row inserted straight into the sidebar root, with
		// its own click handler and `data-active` state.
		function mountExternalEntry() {
			let entry = null;
			const ensure = () => {
				if (entry !== null && entry.isConnected) return;
				const nav = document.querySelector("nav");
				const root = nav?.parentElement ?? null;
				if (root === null) return;
				entry = document.createElement("button");
				entry.type = "button";
				entry.setAttribute("data-dsh-demo-entry", "");
				entry.style.cssText = "display:flex;align-items:center;gap:8px;height:36px;margin:0 2px 8px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer;";
				entry.innerHTML =
					'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M8 2.5a5.5 5.5 0 0 1 4.7 8.3L13.5 13.5l-2.8-.8A5.5 5.5 0 1 1 8 2.5z"/><circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none"/></svg><span>网页聊天</span>';
				entry.addEventListener("click", () => {
					window.__demoEntryClicks = (window.__demoEntryClicks ?? 0) + 1;
					if (entry.getAttribute("data-active") === "true") entry.removeAttribute("data-active");
					else entry.setAttribute("data-active", "true");
				});
				const newSession = root.querySelector('button[aria-label="新建会话"]');
				const logoRow = newSession?.closest('[class*="logoRow"]') ?? null;
				const anchor = logoRow !== null && logoRow.parentElement === root ? logoRow.nextElementSibling : null;
				root.insertBefore(entry, anchor);
			};
			ensure();
			const observer = new MutationObserver(ensure);
			observer.observe(document.body, { childList: true, subtree: true });
			return () => observer.disconnect();
		}

		const inject = ["slots"];

		function apply(ctx) {
			ctx.effect(() => mountExternalEntry(), "demo-panels: external sidebar entry");
			for (const panel of PANELS) {
				ctx.slots.inject("sidebar.panellist", () =>
					ctx.slots.register(
						{ name: "sidebar.panellist", id: panel.id, order: panel.order, label: () => panel.label },
						panel.icon,
					),
				);
				ctx.slots.inject("main", () =>
					ctx.slots.register({ name: "main", key: panel.id, order: panel.order }, () => h(Placeholder, { panel })),
				);
			}
		}

		return { name: "dsh-sidebar-shelf-demo-panels", inject, apply };
	},
});
