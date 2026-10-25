# 返回手势实验（守卫页 / 单页 / followHand）

三个包，同一份页面代码，只有路由表和 `followHand` 不同。

| 包 | 包名 | 应用名 | 图标 | 页面栈 | `followHand` |
|---|---|---|---|---|---|
| `guard-demo.rpk` | `com.klls.guarddemo` | 守卫页 | 紫色暂停条 | Guard → Game（深度 2） | 无 |
| `guard-flat-control.rpk` | `com.klls.guardflat` | 单页对照 | 红色叉 | 只有 Game（深度 1） | 无 |
| `guard-flat-followhand.rpk` | `com.klls.guardflatfh` | 单页关跟手 | 青色箭头撞墙 | 只有 Game（深度 1） | `disable` |

后两个包 `pages/Game/index.js` **字节完全一致**，只有 `manifest.json` 差一个字段。

---

## 一、最终结论（2026-10-25 实测完毕）

| 场景 | 结果 |
|---|---|
| 栈深度 2 + 无字段 | 右滑 → 弹回上一页 |
| 栈深度 2 + `followHand: disable` | 右滑 → 照样弹回上一页 |
| 栈深度 1 + 无字段 | 右滑 → **退出应用** |
| 栈深度 1 + `followHand: disable` | 右滑 → **照样退出应用** |

> **`followHand: "disable"` 在深度 1 和 2 都无效。右滑返回无法用应用层手段关闭。**

第一轮探针"单页 + 字段不退出"的记录已作废（最可能是手势没落到系统识别区）。

## 二、那还剩什么办法

只剩结构手段：**让页面栈深度 ≥ 2，右滑落在"上一层"，而不是"退出应用"。**

但垫层只能是**一层**，而且它自己是栈底——在上面再右滑照样退出（已验证）。所以真正的问题不是"怎么拦住右滑"，而是"**右滑应该退到哪一页才算合理**"。

答案：**标题页**。

```
启动 → Title（栈底）→ 点「继续/开始」→ push Game    栈：[Title, Game]
游戏中右滑 → pop 掉 Game → 回到 Title             栈：[Title]
玩家再右滑 → 退出应用（可接受，玩家已经在主菜单）
```

比垫一个空白"已暂停"页好在：标题页本来就要存在，右滑语义是"退回主菜单"，返回时正好触发一次自动存档。详见 `docs/地图移动与手势规避方案.md` 7.6。

## 三、返回标题即存档（已实现在守卫页包里）

守卫页包现在会在"从游戏页右滑回来"的那一刻存一次，并在页面上显示结果：

- `store.inGame` 由游戏页 `onShow` 置 true；
- 守卫页 `onShow` 看到 true，就置回 false 并写 `storage`；
- 成功后显示 `已自动保存 · 计数 N · HH:MM:SS`，失败显示 `保存失败 code=x`。

**为什么这个时机可靠**：此时进程确定还活着，`storage.set` 几毫秒就能落地；而"栈底右滑退出"是进程直接结束，写一半就没了。

所以不依赖"用户不会连滑两次"——即使第二次右滑立即退出，上一步的写入已经完成。

验证方法：进游戏点几次 +1 → 右滑回守卫页 → 那行字应显示最新计数和时间。

## 四、状态共享：一次误判的排查记录

最初把共享状态放在 `src/store.js`，用 `import store from '../../store.js'`，结果编译产物里出现过：

```js
"./src/store.js" () {}
```

页面拿到 `undefined`，一访问就崩。当时据此判定"本地 `.js` 模块不可用"，改成每个页面各自挂 `globalThis`。

**后来专门做了对照实验，这个判定是错的**：

| 写法 | 结果 |
|---|---|
| `import a from '../../core/a.js'`（ESM 默认） | 正常 |
| `import { b } from '../../core/b.js'`（ESM 命名） | 正常 |
| `require('../../core/c.js')`（CJS） | 正常 |
| `import d from '../../core/d'`（无扩展名） | 正常 |
| 两个页面同时 import 同一模块 | 正常 |
| 与 `@system.router` / `@system.storage` 混用 | 正常 |
| 模块放在 `src/` 根目录 | 正常 |

空模块**一次都复现不出来**。最可能的原因是第一次构建时文件刚写完、还没真正落盘，编译器把空内容缓存了，之后一直在用缓存。

**结论：本地模块可以用——但只有「页面直接 import 的模块」会被打包，间接 import 的数据模块会被整块丢掉**（详见 `docs/构建与模块验证.md`）。所以构建脚本必须做哨兵校验——编译后解包，检查每个模块里的特征字符串是否真的进了页面 bundle，缺了就让构建失败。这比在手表上崩溃再排查便宜得多。

当前守卫页仍把状态挂在 `globalThis`，因为"跨页面共享"这个需求用 `globalThis` 更直接，不依赖模块实例是否共享（模块可能是每个页面各一份）。

## 五、这个实验包的用途

三个包的行为验证已经跑完，结论写进了文档，不再需要继续测。保留它们是为了：

- 换设备 / 换系统版本时，可以重跑一遍确认结论没变；
- 新加入的人可以直接装包看现象，不用读文档。

## 六、重新构建

```bash
node experiments/guard-demo/make-icon.mjs     # 图标（改了才需要）
node experiments/guard-demo/build.mjs         # 三个包
AIOT_TOOLKIT_BIN=/path/to/aiot-toolkit/lib/bin.js node experiments/guard-demo/build.mjs
```
