// Test-only fixture: registers realistic-looking panels (nav entry + main page)
// so the shelf can be exercised without installing a pile of real plugins.
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

		const inject = ["slots"];

		function apply(ctx) {
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
