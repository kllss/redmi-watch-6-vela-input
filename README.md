# REDMI Watch 6 · Vela 输入能力实测研究

> 一台手表到底能给第三方 RPK 什么输入？官方文档说的、开源代码写的、和真机跑出来的，**三者并不一致**。
> 本仓库是从文档 → SDK/源码 → 四轮真机实测的完整记录，附可复现的探针 RPK。

本仓库解决的问题很具体：**在 REDMI Watch 6 上做一个不依赖触屏、也不容易误触的手表游戏，到底有哪些输入可用。**

---

## 结论速览

| 输入通道 | 真机结论 | 关键数据 |
|---|---|---|
| 触屏 | ✅ 可用 | `click` / `longpress` / `swipe` / `touch*` |
| 旋转表冠 | ✅ 可用（只能间接读） | 约 **3.1 px / scroll 事件**，拿不到角度与速度 |
| **加速度计** | ✅ **真实可用** | 约 **11 Hz**，三轴模长 9.6~12.1 m/s²（≈重力），**官方表标的是"不支持"** |
| 振动马达 | ✅ 两档 | `vibrate({mode:'short'|'long'})`；`start/stop` 不存在 |
| 实体返回键 | ❌ 不可用 | 四轮测试 `onBackPress` **全部未触发** |
| 陀螺仪 | ❌ 不存在 | 文档无 + openvela 源码无 + 真机 `NOFN` |
| 地磁罗盘 | ❌ 不可用 | 有回调，但值域只有 `0 ~ 0.107 rad`（≈6°），完全不跟手 |
| 计步 / 环境光 | ❌ 不存在 | 文档/源码里有，**这台固件把方法整个删了** |
| `@service.health` | ⚠️ 有壳无门 | 只暴露 `DATA_TYPES`（含 `HEART_RATE`）与 `isAvailable`，**没有读取方法** |

**一句话：这是一台"触屏 + 表冠滚动 + 加速度计"的设备，不是"可编程按键"的设备。**

---

## 三个反直觉的发现

### 1. 官方支持表是错的

官方 sensor 文档的"支持明细"把 **REDMI Watch 6 明确列在"不支持设备产品"**，但真机 `subscribeAccelerometer` 不仅回调，数值还是真的：

```
v1.3: n=35  first=4.86,7.55,8.10   last=-7.07,0.29,6.52   模长 12.09 / 9.62
v1.4: n=24  first=1.87,7.58,5.85   last=-7.66,1.74,5.91   模长 9.76 / 9.83
```

模长落在 9.6~12.1 m/s²，接近重力 9.8，且首尾明显变化 —— **不是桩、不是全 0**。

> 结论：判断某机型开不开放，**只能以真机为准**，官方表最多当参考。

### 2. `$canIUse` 返回 `true` 不代表有数据

罗盘 `canIUse` 为 `true`，也回调了 66~68 次，但方向值始终在 `0 ~ 0.107 rad` 之间，手腕怎么转都不跟手。

**判断传感器必须看数值，不能看回调次数。**

### 3. 文档写的方法，固件里可能根本没有

- 官方文档写了 `subscribeStepCounter` → 真机 `typeof === undefined`
- openvela 源码有 `subscribeLight` → 真机同样不存在
- `sensor.DATA_TYPES` 在 openvela 里是类型表 → 真机直接不存在

**这台机器跑的是裁剪过的运行时，不能拿 openvela 的方法清单当它的能力清单。**

---

## 实测数据

四轮探针，同一台设备（2026-10-24）：

| 项目 | v1.1 | v1.2 | v1.3 | v1.4 | 结论 |
|---|---|---|---|---|---|
| 陀螺仪 | `NOFN` | — | `NOFN` | `NOFN` | 不存在 |
| 加速度计 | `OK9` | 未跑 | `OK35` | `OK24` | **真实可用** |
| 地磁 | `OK41` | 未跑 | `OK68` | `OK66`，值域 6° | 不跟手 |
| 环境光 | `NOFN` | — | `NOFN` | `NOFN` | 不存在 |
| 计步 | `NOFN` | — | `NOFN` | `NOFN` | 不存在 |
| health | `K2` | — | `DATA_TYPES,isAvailable` | `HTYPES=HEART_RATE` | 有类型无读法 |
| 振动 | `OK/S0` | — | `OK/S0` | `OK/S0` | 两档 |
| 表冠 | `t88 d-800` | `t45/65` | `t20 1st=-640` | `t51 d=-160 1st=-1` | 3.1px/事件 |
| 返回键 | `N` | `N` | `N` | `N` | **四轮全部无响应** |

原始屏拍与逐项判定见 [`docs/device-results-2026-10-24.md`](docs/device-results-2026-10-24.md)。

---

## 右滑返回能不能关掉（2026-10-25 追加）

这是做任何手表应用都绕不开的问题：**系统级的"从左边往右滑 = 返回"能不能在应用里关掉？**

四组包、三次对照实验，结论是**不能**：

| 场景 | 实测结果 |
|---|---|
| 栈深度 2 + 无字段 | 右滑**弹回上一页** |
| 栈深度 2 + `followHand: "disable"` | 右滑**照样弹回上一页** |
| 栈深度 1 + 无字段 | 右滑**退出应用** |
| 栈深度 1 + `followHand: "disable"` | 右滑**照样退出应用** |

`followHand: "disable"`（vivo 手表文档里的页面级字段）在小米 Vela 上**编译不报错、manifest 原样保留、运行期被忽略**——编译器接受 ≠ 运行时生效。

> **右滑返回无法用应用层手段关闭。栈深度 1 会退出应用，栈深度 ≥ 2 会弹回上一层。**

这也意味着：**横滑不能当主操作**（会被系统吃掉），而要退出/暂停只能靠页面内的软件按钮；单页应用则必须把状态放在页面外（`globalThis` / storage），因为被弹出去时页面会直接销毁。

完整的六节实验记录（含"为什么第一轮结论是错的"、守卫页方案、A/B 判读表、待补读数）见 [`docs/device-results-01-back-swipe.md`](docs/device-results-01-back-swipe.md)。

---

## 仓库结构

```
.
├── docs/
│   ├── research-report.md              # 完整研究报告（能力矩阵 / 接口证据 / 测试用例 / 结论）
│   ├── device-results-2026-10-24.md    # 四轮输入探针的原始读数与判定
│   ├── device-results-01-back-swipe.md # 右滑返回：四组包、三次对照实验
│   └── how-to-collect-data.md          # 没有 adb 时怎么把数据从手表取回来
├── probe/                              # 探针工程源码（Vela JS 应用）
│   ├── README.md                       # 编译、安装、测试步骤
│   ├── src/                            # manifest.json / app.ux / pages/Index/index.ux
│   └── snippets/crown-event-probe.ux.txt
├── experiments/                        # 后续的平台能力实验（同一套构建方式）
│   ├── gesture-lab/                    # A→B 两页对照：followHand 拦不拦"弹回上一页"
│   ├── guard-demo/                     # 守卫页 / 单页 / 单页关跟手，三包一组 A/B
│   ├── storage-probe/                  # @system.storage 可用性、弹栈写盘、4KB 写耗时
│   └── lib/png-icon.mjs                # 纯 Node 生成 PNG 图标（无第三方依赖）
└── releases/
    ├── probe-auto.rpk                  # v2.0 自适应排版（含 health）
    ├── probe-auto-lite.rpk             # v2.0 自适应排版（不含 health，通用）
    ├── probe-rw6-v1.4.rpk              # 最早一版，保留对照
    ├── probe-followhand-disable.rpk    # 单页 + followHand（第一轮，结论已作废）
    ├── glab-1-control.rpk              # 两页对照：无字段
    ├── glab-2-followhand.rpk           # 两页对照：B 页 followHand=disable
    ├── guard-demo.rpk                  # 守卫页 + 游戏页（深度 2）
    ├── guard-flat-control.rpk          # 单页对照（红叉）
    ├── guard-flat-followhand.rpk       # 单页 + followHand（青箭头）
    └── storage-probe.rpk               # 存档探针
```

三个实验工程都用同一套 `build.mjs`：先复制 `src` 到 `.build/`，再按变体改 `manifest.json`（包名、路由表、`followHand`），最后调 `aiot-toolkit build`，产物直接落到 `data/local/`（已忽略）。

```bash
node experiments/gesture-lab/make-icons.mjs
node experiments/gesture-lab/build.mjs

node experiments/guard-demo/build.mjs
AIOT_TOOLKIT_BIN=/path/to/aiot-toolkit/lib/bin.js node experiments/guard-demo/build.mjs
```


---

## 快速复现

1. 下载 [`releases/probe-auto.rpk`](releases/probe-auto.rpk)
2. 用 **AstroBox**（蓝牙 SPP）侧载到手表 —— 电脑端直接把 rpk **拖进窗口**，不要点"安装快应用"按钮（它的原生文件框在 2.2.0 上会死锁）
3. 打开应用后按顺序：
   - **只转表冠**：向上 3 格 → 向下 3 格（测步长与方向）
   - 按一次返回区域（测 `onBackPress`）
   - 点绿色「一键全测」，等 10 秒
   - 自动跳到汇总页：先拍 12 行大字，再用表冠往下滚拍 `D1~D9` 详情
4. 底部有一行 `CODE`，形如 `NOFN|OK35|OK66|NOFN|NOFN|K2|OK/S0|51|0`，**照片糊了就只抄这一行**

---

## 探针设计要点

### 为什么要"一键全测 + 一屏汇总"

这台表**没有 adb、没有 USB 调试、没有 logcat**，`console.log` 传不出来，**屏幕是唯一遥测通道**。所以探针把结果压成 12 行大字 + 9 行详情，拍一张照片就能回传。

### v2.0 的自动排版

`designWidth` 在 Vela 里是**等比缩放基准**（官方原文："原理类似于 rem"），如果写死一套 px，换到 192 宽的手环上字号会缩成 1/2.25。

官方文档同时说明：**不支持后代选择器**，也只承诺了类/id/标签/并列选择，没承诺同一元素多 class 的复合选择器。所以本工程走**运行时计算 + 内联样式绑定**这条确定可用的路：

```js
k  = 432 / screenWidth          // 设计px → 物理px 的倒数
dv = (v) => Math.round(v * k)   // 把"期望物理像素"换算成设计px

// 汇总页行高按屏幕高度算，保证 12 行铺满一屏
lhDev = Math.floor(screenHeight * 0.66 / 12)
lineH = dv(lhDev)
lineF = dv(Math.round(lhDev * 0.56))
```

模板里用 `style="font-size: {{lay.title}}px"` 绑定，编译后会变成动态样式函数，不依赖任何选择器组合。

### 表冠为什么要"累加阈值"

实测约 **3.1 px / 事件**，转一格会连续产生多个事件。菜单**不能一个事件翻一项**，要累加到 **24 px** 再翻。

---

## 证据分级

仓库内所有结论都标注了等级，避免"文档没写"被当成"一定不存在"：

| 等级 | 含义 |
|---|---|
| **A** | 官方文档 / 产品规格 |
| **B** | 官方 SDK / openvela 源码 |
| **C** | 可复核的社区材料 |
| **D** | 合理推测（有间接依据） |
| **E** | 未找到证据（≠ 不存在） |

**本仓库把"真机实测"视为高于 A 级的证据** —— 因为已经出现过至少一次官方文档与真机相反的情况。

---

## 已知边界

- 全部数据来自**一台** REDMI Watch 6、**一版**固件；不同批次/固件可能不同
- `device.getInfo` 在这版固件返回的是**占位值**（`brand=Vela` / `model=ap` / `os=0.0.0`），只有分辨率可信（432×514）
- 表冠的**反向符号**四轮都没捕获到（记录到的 `dy` 全为负），菜单建议直接用绝对值
- 自适应排版只对**竖屏手表/手环**做过推算，横屏（tv/car）未验证
- 未进行固件解包、签名绕过或系统修改；所有"逆向"建议都限定在公开资料与自有设备调试范围内

## 免责声明

本项目为**个人互操作性研究**，与小米 / Redmi 官方无关。所有接口调用均基于公开文档与自有设备的调试行为，不包含任何破解、绕过授权或分发官方固件的内容。探针程序仅用于读取本机传感器与输入事件，不采集、不上传任何数据。

## License

- 代码（`probe/`）: MIT
- 文档（`docs/`、本 README）: CC BY 4.0
