# 发布前验证清单

## 静态检查

- [ ] `parti.room.json` 是合法 JSON。
- [ ] manifest 的 `entry.ui` 是 `index.html`，`entry.worker` 是 `room.worker.js`。
- [ ] 如设置 manifest `cover`，其文件已提交到房间包内；使用静态资源时 `packageMode` 为 `filesystem`。
- [ ] `assets/amber-scout.png`、`assets/violet-scout.png` 和 `assets/cipher-cards.png` 可由 `index.html` 相对加载，且无需网络权限。
- [ ] `assets/gameboard-mat.jpg`、`assets/signal-route.png` 与 `assets/secret-seal.png` 可由 `index.html` 相对加载，且无无限动画或高频脚本依赖。
- [ ] manifest 与 Worker meta 都是 4–8 人。
- [ ] Worker 只有 `@parti/worker-sdk` 的 canonical import，且默认导出 `defineRoom(...)`。
- [ ] `ctx.state` 中不存在当前的 `keywords`、代码、`ownGuess`、`interceptGuess` 或未公开 clue 文本；已揭晓记录除外。

## 本地多人预览

- [ ] 四人完成 2v2 分队并正常开始。
- [ ] 编码员只看见自己的代码；队友只看见己方关键词。
- [ ] 三条线索完成前，其他玩家只看见已锁定数量。
- [ ] 双方提交前，另一方猜测值不进入公开 UI/state。
- [ ] 正确解码、错误解码、正确截获、错误截获都正确计分。
- [ ] 两次误码和两次截获都能立即结束游戏。
- [ ] 编码、猜测的建议倒计时归零后，当前环节不会自动结算，合法操作仍能正常提交并推进。
- [ ] 在桌面与窄屏都确认角色、密码牌、比分、表单与齿轮菜单不互相遮挡；开启系统“减少动态效果”后，操作与信息读取仍清晰。
- [ ] 在编码/猜测阶段打开性能面板：无 500ms 全量传讯 DOM 重建；倒计时只更新一个文本节点，切到后台后不继续调度刷新。
- [ ] 非法代码、重复代码、越权 action 和满员分队都被拒绝。
- [ ] 对局中离开与房主刷新都会安全返回大厅。

## 发布检查

- [ ] 在 Parti 在线版通过 GitHub URL 导入成功。
- [ ] 导入后创建私密房间，至少由两台设备完成一次真实联机。
- [ ] Release 含 `parti.room.zip` 和同版本 `parti.room.json`。
- [ ] Parti 市场 Issue 标题为 `[parti-room] owner/repo`。
