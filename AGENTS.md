# 截码战维护指南

本仓库是一个独立的 Parti Room Package，不是完整 Web 应用。

## 首要约束

- `room.worker.js` 是唯一权威逻辑；客户端不得直接修改游戏状态。
- `index.html` 只能通过全局 `parti` API 订阅状态、订阅事件和提交 action。
- `ctx.state` 会广播给所有玩家。关键词、当前代码和未公开猜测必须始终留在 Worker 模块级私有变量 `secrets`，仅使用 `ctx.send()` 下发给有权限的玩家。
- Worker 只能保留 `import { defineRoom } from '@parti/worker-sdk'` 这一项 import；不得增加依赖或相对导入。
- action payload 一律视为不可信：校验阶段、身份、队伍、长度、数值范围与重复提交。
- 不得把 `credential`、密码、私密代码或关键词写入 state、日志、广播事件或文档样例。
- 视觉资源必须随房间包置于 `assets/`，以相对路径引用；不得为了装饰而引入网络资源、追踪脚本或运行时依赖。装饰性图片使用空 `alt`，重要操作仍须保留文字与可见焦点。
- 不要为装饰性效果建立高频 JS 轮询、全量重渲染或无限 CSS 动画。实机验证表明循环环境动效会造成过高 CPU 占用；倒计时只能更新自身文本节点，并应在页面处于后台时暂停；优先以静态贴图、背景与一次性状态更新表达游戏质感。

## 修改流程

1. 阅读 `docs/PROJECT_MEMORY.md` 与 `docs/DESIGN.md`。
2. 先调整 Worker 规则和 action 校验，再调整 UI。
3. 保持 `parti.room.json` 与 `defineRoom({ meta })` 的玩家人数、入口文件和权限一致。
4. UI 更新应保持表单控件节点稳定；不要在每个 `parti.onState()` 回调里重建整个页面。
5. 为每个新增 action 更新 manifest、设计文档和验证清单。
6. 在 Parti 的本地多人预览中测试至少两队、非法 payload、软性倒计时归零后的继续操作、离开、重连和房主刷新。

## 发布规则

- 公开发布前更新 `parti.room.json` 的 `version`、`CHANGELOG.md`（如新增）与 Release tag。
- 需要一键安装时，仓库根目录必须持续保留 manifest 与其声明的全部入口文件。
- 发布到 Parti 房间市场后，不要删除或改名 manifest 的入口文件。

更多背景和未决项见 `docs/PROJECT_MEMORY.md`。
