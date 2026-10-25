# 存档探针（storage + 退出恢复）

回答三个问题，都是 M1 的前置条件：

1. `@system.storage` 在 REDMI Watch 6 上到底能不能用；
2. 右滑返回导致应用退出时，`onHide` / `onDestroy` 有没有机会把数据写下去；
3. 4KB 字符串写一次要多久（决定存档频率和数据规模）。

图标：黑底 + 绿色向下箭头（落盘），与手势实验的蓝箭头、橙禁止符区分开。

## 安装包

```
data/local/storage-probe.rpk
包名 com.klls.storeprobe
应用名 存档探针
```

## 页面说明

| 字段 | 含义 |
|---|---|
| 第一行 | `存储可用` / `存储不可用 code=x` / `存储异常` |
| 第 N 次启动 | 每次打开 +1，写在 `c_boot` |
| 页面 onHide | 页面级 `onHide` 是否写出过时间戳 |
| 页面 onDestroy | 页面级 `onDestroy` |
| 应用 onHide | `app.ux` 的 `onHide` |
| 应用 onDestroy | `app.ux` 的 `onDestroy` |
| onBackPress | 返回键 / 右滑是否走过应用回调 |
| 上次主动写入 | 上一次点「写 4KB 测试」的时间 |
| 4KB 写入耗时 | `storage.set` 从调用到 success 回调的毫秒数 |
| 读回长度 | 写完后立刻读回，应显示 `4096 / 4096` |

「清空探针数据」会把所有 key 删掉，方便反复测。

## 测试步骤

1. 安装、打开，确认第一行是「存储可用」，并记住启动次数；
2. 点「写 4KB 测试」，记下耗时和读回长度；
3. **不要点软件按钮**，直接用右滑（或返回键）退出应用；
4. 重新打开，看这几项：

| 现象 | 结论 |
|---|---|
| 启动次数 +1，`页面 onHide` 和 `应用 onHide` 有时间戳 | 退出前跑到了 onHide，且写入成功 → **可以在 onHide 自动存档** |
| 只有 `页面 onDestroy` / `应用 onDestroy` 有时间戳 | 只有 onDestroy 能写 → 也能兜底，但更晚 |
| 四个都没有 | 进程被直接杀掉 → **只能靠关键节点主动存档**，不能依赖生命周期 |
| `onBackPress` 有时间戳 | 返回会走应用回调，可能可以 `return true` 拦截（与 M0 结论冲突，需复核） |
| 第一行是「存储不可用」 | 存档方案必须改用 `@system.file` |
| 4KB 写入 > 200ms | 存档要控制体积或分块写 |

## 已知限制

- 只测 `storage`，不测 `@system.file`；后者是存储不可用时的备选，尚未验证；
- 「4KB 写入耗时」包含回调调度，不完全等于落盘时间；
- 反复「清空 → 右滑 → 重开」时，启动次数会从 1 重新开始，这是预期行为。

## 重新构建

```bash
node experiments/storage-probe/make-icon.mjs      # 生成图标（改了图标才需要）
node experiments/storage-probe/build.mjs          # 打包到 data/local/storage-probe.rpk
AIOT_TOOLKIT_BIN=/path/to/aiot-toolkit/lib/bin.js node experiments/storage-probe/build.mjs
```
