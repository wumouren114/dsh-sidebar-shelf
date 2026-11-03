# dsh-sidebar-shelf · 侧栏收纳架

**把 DSH 左侧栏的空间还回来。** 所有面板入口收进侧栏里的一个收纳架——就放在原来面板列表的位置，工作区上方。需要某个面板时再展开。

[English](README.md) | [简体中文](README.zh-CN.md)

[![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-8A2BE2)](https://github.com/topics/dsh-plugin)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![收起后的侧栏：新会话与工作区之间只剩一行「面板」](https://raw.githubusercontent.com/wumouren114/dsh-sidebar-shelf/HEAD/docs/collapsed.png)

![展开收纳架：全部面板、搜索与键盘提示](https://raw.githubusercontent.com/wumouren114/dsh-sidebar-shelf/HEAD/docs/shelf-open.png)

## 为什么

DSH Web / 桌面端的左侧栏从上到下是：品牌行 → **新会话** → **每个全局面板入口** → 工作区 → 设置。每装一个带面板的插件，这一列就多一行：插件、插件市场、定时任务、MCP Studio、上下文、技能管理、系统监控…… 十行大约 400px，工作区被挤得只剩两三个会话。

`dsh-sidebar-shelf` 把**所有面板入口**收成同一列里的一行——就在工作区正上方，想用哪个再展开。

- **一行就在原面板列表的位置**：宽度、间距、悬浮态都和原生面板行一致，工作区直接上移。
- **用的是原生行**，不是自绘按钮：外壳自己的按钮、56px 轨道形态、Tooltip 都沿用，只隐藏它的兄弟行。
- **两列面板架**，每个面板用它自己注册的图标。
- **面板超过 7 个自动出现搜索框**。
- **键盘优先**：`↑`/`↓` 移动、`Enter` 打开、`Esc` 关闭，直接打字就是过滤。
- **窄栏适配**：侧栏收成 56px 轨道时，这一行仍是外壳的 36px 图标，收纳架在轨道右侧展开，不盖住轨道。
- **跟随主题**：只用 `--dsw-alias-*` / `--dsw-radius-*` / `--dsw-shadow-*` 主题变量，明暗主题都一致。

| 打开面板后 | 56px 轨道 | 暗色主题 |
| --- | --- | --- |
| ![](https://raw.githubusercontent.com/wumouren114/dsh-sidebar-shelf/HEAD/docs/panel-active.png) | ![](https://raw.githubusercontent.com/wumouren114/dsh-sidebar-shelf/HEAD/docs/rail.png) | ![](https://raw.githubusercontent.com/wumouren114/dsh-sidebar-shelf/HEAD/docs/dark.png) |

## 安装

需要带 `web` profile 的 DSH（DeepSeek Harness）——桌面端用的是同一套客户端。

```sh
# 直接从 GitHub 安装（无构建步骤，不需要 allowBuilds 授权）
dsh plugin --profile desktop add github:wumouren114/dsh-sidebar-shelf

# 或者从本地 clone
git clone https://github.com/wumouren114/dsh-sidebar-shelf.git
dsh plugin --profile desktop add ./dsh-sidebar-shelf
```

`desktop` 只是示例 profile 名，换成你实际运行的 `web`、`tui` 等即可。装完后在 **设置 → 插件** 里启用它（会写进 `dsh.profile.bundles`），刷新页面。

**验证方式：** 整列面板入口变成 **新会话** 与 **工作区** 之间的一行 **面板**。点它——所有已注册面板都在里面（包括「插件」）。选一个即打开，收纳架自动关闭。

> 本包直接提交手写的 `lib/client.js`，**没有 `prepare` / `postinstall` 脚本**，所以从 GitHub 安装不会卡在 pnpm 的 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` 或 `ERR_PNPM_IGNORED_BUILDS`。

环境要求：DSH 0.2.x 客户端；安装它的命令行需要 Node.js ≥ 20。

## 实现原理

DSH 的左侧栏由 `@deepseek-ai/dsh-client-ui-sidebar` 拥有。第三方插件不能重新声明这个列表，但外壳公开了一组稳定契约：

| 契约 | 用途 |
| --- | --- |
| `sidebar.panellist` 槽（root 作用域，list） | 每个面板在这里注册 `id` / `order` / `label` 和图标组件。收纳架自己也在这里注册一行（`order: -1000`），其余注册项就是它的数据源。 |
| 注册行所在的 DOM | 外壳把我们的图标包进它自己的 `<button class="panelRow">`。我们从图标向上找到这个按钮，标记 `data-dsh-shelf-row`，并在捕获阶段拦截它的点击。 |
| `ctx.layout.selectPanel(id)` | 官方选中面板的方式；收纳架从不伪造点击别的行。 |
| `ctx.layout.panelInfo` | 当前选中面板，用于收纳架里的「当前」标记。 |

具体到 `lib/client.js`：

1. 在 `sidebar.panellist` 注册自己的一行（`id: dsh-sidebar-shelf-entry`、`order: -1000`、label `面板` / `Panels`）；
2. 从图标向上找到外壳的面板行按钮，打标记，并挂捕获阶段的 click 处理器——既打开收纳架，也阻止外壳对一个没有主面板的 id 调用 `selectPanel`；
3. 用一条作用域受限的规则隐藏兄弟行：`[data-dsh-shelf="on"] > *:not([data-dsh-shelf-row]) { display: none !important }`——列表元素本身保持挂载，所以这一行保留外壳原生的位置、间距和轨道几何；
4. 读 `ctx.slots.entriesOfSlot("sidebar.panellist")` 作为收纳架内容，复刻侧栏自己的排序（`order`，再按注册顺序），每格直接用面板**自己注册的图标组件**（外层错误边界，失败时退回首字母）；
5. 选中格子时调用 `ctx.layout.selectPanel(id)`。

其它什么都不碰：不动工作区、品牌行、设置，不加宿主行为，也不改 DSH 的任何文件。插件卸载时标记、监听与样式一并移除，原生面板列自动回来。

## 已验证

- DSH `0.2.1-rc.3` / Windows / Chromium 1440×900 —— 18/18 端到端检查：入口位于工作区上方、只隐藏兄弟行、搜索、键盘、切换面板、当前标记、Esc、56px 轨道、暗色主题、无页面报错。
- `node test/smoke.mjs` —— 10 项清单 / bundle / 接线检查，零依赖。

上面的截图由 `test/e2e.cjs` 在一次性测试 profile 里产生；截图里的面板来自仅用于测试的 fixture（`test/demo-panels`），不随包发布。

## 已知限制

- **其它面板行全部隐藏**，包括外壳自带的「更多」菜单（浏览更多插件 / 创建你的插件）。「插件」面板仍在收纳架里一步可达。
- 一个插件只做一件事：暂时没有「固定某几个面板留在侧栏」的策略。需要的话请开 issue，这是下一步最自然的方向。
- 不要和另一个同样隐藏该列表的插件（如 `dsh-toomuch-plugins`、`dsh-sidebar-organizer`）同时使用，二选一。
- DOM 契约是列表里那枚外壳面板行按钮。如果未来 DSH 改了结构，最坏情况是列表没被隐藏，而不会把侧栏弄坏。

## 开发

```sh
node test/smoke.mjs                  # 静态 + 接线检查，不需要浏览器
node test/e2e.cjs <dsh-web-url>     # 真实 UI 检查 + 截图（需要 puppeteer-core）
```

`test/e2e.cjs` 要求 `NODE_PATH` 指向含 `puppeteer-core` 的 `node_modules`，并准备 Chromium / Edge（可用 `DSH_SHOT_BROWSER` 覆盖）。仓库没有构建步骤：`lib/client.js` 就是发布产物。

## 许可证

MIT © wumouren114 —— 见 [LICENSE](LICENSE)。
