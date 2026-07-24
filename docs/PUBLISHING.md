# 发布与更新流程

## 首次发布

1. 将完整 Room Package 提交到仓库根目录。
2. 创建 tag，例如 `v1.0.0`。
3. 创建 GitHub Release，上传 `parti.room.zip` 和 `parti.room.json`。
4. 在 `glink25/Parti` 创建 Issue，标题为：

   ```text
   [parti-room] kchen0x/parti-decrypto
   ```

5. Issue 正文说明游戏、玩家人数、仓库地址和测试方式。
6. 等待市场 triage 验证并加上 `parti-room` 标签。

## 更新

1. 更新 `parti.room.json` 的版本号和相关文档。
2. 若新增静态资源（封面、图片或音频），使用 `packageMode: "filesystem"`，并确认资源已提交且 manifest 的相对路径正确。
3. 完成验证后推送代码、创建新 tag 和 Release。
4. 编辑市场登记 Issue，使 triage 重新读取 manifest。
5. 已安装玩家可在 Parti 中选择重新安装。

## 注意

- 房间市场通过 GitHub 仓库读取 manifest 与入口文件；不要仅上传 Release ZIP。
- `parti.room.zip` 是手动导入的后备渠道。
- 市场封面由 manifest 的可选 `cover` 字段提供。使用包内相对路径时，图片必须和 manifest 位于同一个可分发的包内。
- 市场条目默认应使用原创文本、图片和素材；不要上传原版桌游的扫描件、卡牌或商标视觉素材。
