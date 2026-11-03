// dsh-sidebar-shelf Node half.
//
// 这个插件完全跑在浏览器半侧：面板列表由 client 端从 slot 注册表读取，
// 折叠状态只存在 localStorage。Node 半侧不消费任何宿主服务，只为满足
// DSH 的 bundle 插件契约（name / inject / apply）。
//
// 契约来源：仓库根 package.json 的 dsh.bundle + dsh.client，
// client 产物是 lib/client.js。

export const name = 'dsh-sidebar-shelf'

export const inject = []

export function apply() {
  // 无宿主侧行为。
}
