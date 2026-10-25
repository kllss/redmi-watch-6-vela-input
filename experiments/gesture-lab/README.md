# 手势实验（右滑返回对照测试）

用来回答一个问题：**`followHand: "disable"` 到底能不能关掉右滑返回。**

## 为什么需要两个包

单页应用测不出结论。右滑返回的语义是"弹出页面栈的上一层"；栈深度为 1 时，系统本来就没有可返回的页面，所以"横滑不退出"既可能是字段生效，也可能是本来就没有这个手势。

所以这里做成 A → B 两页，栈深度 2，并且做**对照组**：

| 包 | 包名 | 应用名 | 图标 | B 页 `followHand` |
|---|---|---|---|---|
| `glab-1-control.rpk` | `com.klls.glab.ctrl` | 对照 | 黑底 + 蓝色右箭头 | 无 |
| `glab-2-followhand.rpk` | `com.klls.glab.fh` | 关跟手 | 黑底 + 橙色禁止符 | `disable` |

两个包除上表后两列外完全相同（已核对 RPK 内容：`app.js` 只有 package 名不同，`pages/Index/index.js` 字节一致，`pages/Detail/index.js` 只差 B 页顶部那行标签的 1 字节）。

## 图标

图标由 `make-icons.mjs` 用代码画出来，不依赖任何绘图库：

```bash
node experiments/gesture-lab/make-icons.mjs            # 192×192，装进 RPK
ICON_SIZE=40 node experiments/gesture-lab/make-icons.mjs   # 生成 40px 预览，判断可辨识度
```

- 规格与现有 probe 图标一致：192×192、RGB（colortype 2）、无 alpha、全幅底色；
- 区分方式是"**颜色 + 轮廓**"双保险：蓝/橙在灰度下亮度差 63（103 vs 166），箭头/禁止符在小尺寸下轮廓完全不同；
- `assets/preview-40-*.png` 是 40px 版本，已经肉眼确认仍可分辨；
- 应用名也一并缩短为「对照」「关跟手」，避免表盘上被截断。

## 页面说明

**A 页**：`onShow` / `onHide` / `onBackPress` 次数、页面栈深度、事件日志、「进入 B 页」按钮。

**B 页**：

- 顶部一行标签，写明本包是"对照组"还是"实验组"；
- 绿色测试区（贴左边缘、整宽 130px 高）；
- `touchstart` / `touchend` 次数、最后一滑 `dx/dy`、`onBackPress` 次数、栈深度；
- 「点按返回 A」软件按钮；
- 事件日志。

`onBackPress` **只记录、不消费**（`return false`），否则会挡住系统返回，实验就失效了。

## 测试步骤

两个包各做一遍，顺序随意，但**不要在同一分钟内混着滑**，容易记混。

1. 打开应用，点「进入 B 页」；
2. 确认 B 页"栈深度 = 2"；
3. 在绿色测试区**中间**向右滑 5 次，每次滑过 80px；
4. 在绿色测试区**最左边缘**起手（手指贴屏幕左沿）向右滑 5 次；
5. 记录：是否回到 A 页 / 是否退回表盘 / 是否毫无反应；以及 B 页的 `touchstart`、`touchend`、`dx`、`onBackPress` 读数。

## 判读

| 对照组 | 实验组 | 结论 |
|---|---|---|
| 回到 A 或退回表盘 | 留在 B | `followHand` 生效，全应用页面都加，横滑可放开 |
| 回到 A 或退回表盘 | 也返回 | 字段被忽略，按规避方案做 |
| 都没反应 | 都没反应 | 该机型 JS 应用没有右滑返回，横滑无风险 |
| `touchend` < `touchstart` | — | 手势被系统中途抢走，横滑不可用 |
| `onBackPress` > 0 | — | 返回会走应用回调，可以拦截 |

## 重新构建

```bash
node experiments/gesture-lab/build.mjs
# 或指定工具链
AIOT_TOOLKIT_BIN=/path/to/aiot-toolkit/lib/bin.js node experiments/gesture-lab/build.mjs
```

构建脚本会按变体把对应图标复制进 `src/Common/icon.png`；图标缺失会直接报错并提示先跑 `make-icons.mjs`。

产物写到 `data/local/`（已被 `.gitignore` 忽略），中间工程在 `experiments/gesture-lab/.build/`。

## 已知限制

- 只在 REDMI Watch 6 普通版上测过一次单页场景，两页对照尚未实测；
- 若系统手势的起手热区比 72px 更宽，最左边缘那 5 次可能根本不进应用，读数里 `touchstart` 不增加就是这种情况；
- 本实验只回答"会不会返回"，不回答"返回时会不会先播动画"。
