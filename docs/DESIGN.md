# 截码战设计记录

## 玩法映射

本项目保留了双队、私密关键词、三位不重复代码、三条顺序线索、己方解码、敌方截获、误码与截获胜利条件等核心机制。

为适应移动端联机，采用“单轮顺序传讯”：琥珀队与紫罗兰队轮流发送一条完整讯号。这样每个阶段只有一类明确操作，且无需依赖语音同步。

```text
大厅分队
  → Worker 为两队抽取私密关键词与代码牌
  → 当前编码员私收代码
  → 编码员锁定三条线索
  → 公开线索
  → 本队解码 + 敌队截获（私密提交）
  → Worker 同时揭晓、计分、判胜
  → 切换下一队
```

## 信息可见性

| 数据 | 存放位置 | 可见者 |
| --- | --- | --- |
| 阶段、队伍、分数、公开历史 | `ctx.state` | 全部玩家 |
| 队伍关键词 | Worker `secrets` + `ctx.send` | 对应队伍 |
| 当前代码 | Worker `secrets` + `ctx.send` | 当前编码员 |
| 未公开线索 | Worker `secrets.current.clues` | Worker / 当前编码员知情 |
| 未公开猜测 | Worker `secrets.current.*Guess` | Worker / 提交者所在队的线下讨论 |

## 公开状态模型

```text
phase: lobby | cluing | guessing | finished
players[id]: { name, team, ready }
teams[team]: { intercepts, mistakes }
turn: { team, encoderId, clueCount, clues, ownSubmitted, interceptSubmitted }
history[]: 仅已揭晓的代码、线索和猜测
```

## 权威 action

| Action | 权限与验证 |
| --- | --- |
| `chooseTeam` | 仅大厅；限定队名、队伍上限和本人身份。 |
| `startGame` | 仅房主；全员已分队，且两队均为 2–4 人。 |
| `submitClue` | 仅当前编码员；限制长度、数字、控制字符和直写关键词。 |
| `submitGuess` | 仅猜测阶段；代码为 1–4 的三个不重复整数；同一方仅能提交一次。 |
| `restart` / `resetLobby` | 仅房主。 |

## 恢复与异常策略

- Action 的任何非法输入均不改 state，只私密提示发起者。
- 编码超时按己方误码处理；猜测超时按未提交方猜错处理。
- 玩家在对局中离开时立刻回到大厅，防止职位与私密状态不一致。
- 房主刷新后 `onRestore` 主动回到大厅，因为持久化 state 中不包含隐藏秘密。
