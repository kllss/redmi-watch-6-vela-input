# rpk-input-probe — REDMI Watch 6 硬件输入最小探针

一个只做"取证"的 Vela RPK 工程：不做游戏，只把**表冠 / 返回键 / 传感器 / 振动 / health** 的真实可用性打到屏幕上。
所有结论以真机屏幕日志为准；模拟器结果不算数（AIoT 的模拟器其实是 Android AVD，里面有 `hw.gyroscope=yes`，但那和 Vela 的 JS 接口无关）。

> **本工程已在 2026-10-24 用本机 `aiot-toolkit@2.0.5` 实际编译通过，产出 `dist/com.probe.rw6input.debug.1.0.0.rpk`（16,371 字节）。未安装、未运行。**

## 1. 目录

```
rpk-input-probe/
├── package.json
├── README.md
├── dist/                             # 已编译出的 debug rpk（可删）
├── snippets/
│   └── crown-event-probe.ux.txt     # 可选：单独验证"表冠事件"是否存在
└── src/
    ├── manifest.json                # 声明 5 个 feature
    ├── app.ux
    ├── Common/icon.png
    └── pages/Index/index.ux         # 主探针页
```

## 2. 前置条件

- Node.js 18+；`aiot-toolkit@2.0.5`（本机已有两套，见第 3 节）
- 手表：REDMI Watch 6（M2523W1），开启开发者相关设置
- 侧载工具：AstroBox（官方说明中 REDMI Watch 6 为"完整支持"）
  或 米坛"表盘自定义工具"
- 手表空间：快应用安装数建议 < 20 个（社区经验），否则可能装不上

## 3. 编译

**方式 A（本机已验证，不需要 AIoT-IDE 图形界面）**

用你现有工程里的 CLI 直接编译：

```bash
cd rpk-input-probe
node "D:/实验/chess_engine/jsapp/node_modules/aiot-toolkit/lib/bin.js" build
# 或 D:/开发/galgame/node_modules/aiot-toolkit/lib/bin.js
```

实测输出：

```
✅ build success: 627ms
产物：dist/com.probe.rw6input.debug.1.0.0.rpk（16,371 字节）
```

**方式 B（标准做法）**

```bash
npm i                  # 安装 aiot-toolkit ^2.0.5
npm run build          # 产物在 dist/*.debug.rpk
# 正式包：npm run release（需要 sign/private.pem 与 certificate.pem）
```

> 依赖名是 **`aiot-toolkit`**，不是 `@aiot-toolkit/cli`。
> 若 `aiot` 命令不存在，直接用方式 A 指向本机已有的 CLI。

**路由路径坑（编译器实测）：** `router.entry` 必须写成 `pages/Index`（对应 `src/pages/Index/index.ux`）。
写成 `Index` 时编译器会去找 `src/Index/index.ux` 并报 `path ... does not exist`。

## 4. 安装到手表

先确认设备是否连上：

```bash
node "D:/实验/chess_engine/jsapp/node_modules/aiot-toolkit/lib/bin.js" getConnectedDevices
```

返回 `null` 说明没连上（本机当前就是 `null`，且 PATH 里没有 adb）。连上后可以试：

1. 手表：`设置 → 我的设备 → 连接新手机`（RW6 及之后机型路径；RW5 及之前是"系统操作"）
2. AstroBox：登录小米账号 → 同步设备 → 连接 → `安装快应用` → 选 dist 里的 rpk
3. 手表应用列表里会出现"输入探针"

## 5. 怎么测（按顺序做，边做边看屏幕日志）

### A. 表冠旋转
1. 进入探针页，等出现 `probe armed（可以开始转表冠）`
2. **手指离开屏幕**，只转表冠
3. 看是否出现 `SCROLL(no touch) dy=… total=… ticks=…`

判读：
- 有 `SCROLL(no touch)` 且 `dy` 随表冠方向变号 → **表冠能驱动滚动容器**，应用能"间接"读到旋转（只有滚动位移，没有角度/速度/状态）
- 完全没有 → 这个容器没拿到表冠；再试主页面下方的 slider 焦点探针
- 只有手指滑动才出现 → 表冠事件没有下发到应用

### B. 表冠按压 / 返回键
1. 保持 `返回键拦截: 开`
2. 按一下表冠（或副按键），观察是否出现 `*** onBackPress 触发`
3. 若出现且页面没有退出 → 应用成功消费了这次"返回"

判读：
- 表冠按压触发 `onBackPress` → 可以当"返回/暂停"用
- 触发但页面仍退出 → 拦截失败（检查是否 return true）
- 完全不触发 → 该按键在系统层被吞掉，应用拿不到

### C. 传感器
- 点"加速度"：看是 `accel #n x=…`（可用）还是 `accel fail code=…`（不可用）
- 点"罗盘"：绕手腕画 8 字校准，看 `dir=` 是否跟手；`acc=3` 表示高精度
- 点"health"：看 `health keys=…`，以及 `getRecentSamples / getTodaySteps` 是否存在

### D. 振动
- "振动 short" / "振动 long"：应各震一下
- "start 参数"：预期打印 `typeof vibrator.start=undefined`（官方支持表：RW6 不支持 start）

### E. 电池事件
进页面后应打印 `battery event subscribed`；插拔充电器应出现 `BATTERY_CHANGED`。

### F. 陀螺仪与"运行时真实传感器表"（重点，30 秒）

这一组是为"社区有人用陀螺仪"这条线索加的。不要先信文档，直接问运行时。

1. 进页面先看第一屏：`typeof gyro=… | DATA_TYPES=…`
   - `undefined` → 这台固件没有 `subscribeGyroscope`（与 openvela 源码一致）
   - `function` → 继续点"陀螺仪"
2. 点"陀螺仪"：
   - `=> 方法不存在` = 没有这个接口
   - `GYRO fail code=…` = 有方法、设备拒绝
   - `GYRO x=… y=… z=…` = **真的能读**（请记录固件版本，这推翻了报告的结论）
3. 点"传感器表"：打印 `DATA_TYPES keys=…` 和每个类型的 `checkAvailable`
   - 这是**运行时自己报的清单**，比任何文档都权威
   - 同时会试 `subscribeStepCounter`，预期 `fail code=203`
4. 点"环境光"：`subscribeLight` 未文档化，但在 openvela 源码里存在；有数据就是隐藏能力可用。

> 判读原则：**真机 > 源码 > 文档**。三者冲突时，以你在 RW6 上看到的那一行日志为准，并把固件版本记下来。

## 6. 补充实验：表冠事件是否存在

见 `snippets/crown-event-probe.ux.txt`。它绑定了 `crownrotationchanged`（来自安卓快应用手表规范，不是 Vela 文档）。
编译失败 = 编译期不认；编译通过但无日志 = 运行期不派发；有日志 = 挖到隐藏接口。

## 7. 常见问题

| 现象 | 处理 |
|---|---|
| 打包报 `service.health` 非法 | 删掉 `src/manifest.json` 里 `{ "name": "service.health" }`，并删掉 `probeHealth()` 里的 `require` 段 |
| 打包报未知事件 `crownrotationchanged` | 正常，说明 Vela 不支持；不要放进主工程 |
| `$canIUse` 是 undefined | 固件 APILevel < 3；忽略，直接看后续 fail 回调 |
| 点"陀螺仪"提示方法不存在 | 正常；openvela 的 `sensor_impl.cpp` 里没有 gyro 实现 |
| `DATA_TYPES` 不存在 | 固件裁掉了通用 sensor 接口；仍可逐个试命名方法 |
| `checkAvailable` 全部报错 | 传参可能是字符串而非索引；先记录 `DATA_TYPES` 的键值对再判断 |
| 装不上 | 检查快应用数量是否 ≥ 20、存储是否够、签名是否 debug 包 |
| 屏幕日志刷太快 | 点"清空"，一次只测一项 |

## 8. v1.1：一键全测 + 汇总页（回传用）

v1.0 的日志区只有 9px 字、一屏 6~7 行，截图几乎没法读。v1.1 在日志栏加了两个绿色按钮：

- **一键全测**：按固定脚本依次跑 陀螺仪 → 加速度 → 罗盘 → 环境光 → 计步 → health → 振动，10.5 秒后自动跳到汇总页。
- **汇总**：随时把当前结果压成 12 行大字。

汇总页长这样（每行 `编号 项目 = 结果`）：

```
1  DEV   M2523W1 A4
2  GYRO  NOFN
3  ACC   FAIL201
4  COMP  OK38
5  LIGHT NONE
6  STEP  FAIL203
7  HLTH  K4
8  VIB   OK/S0
9  CROWN t7 d-112
10 BACK  Y1
11 CAN   s1v1e1
12 DTYPE n9
CODE NOFN|FAIL201|OK38|NONE|FAIL203|K4|OK/S0|7|1
```

结果码含义：

| 标记 | 含义 |
|---|---|
| `NOFN` | 该方法在运行时不存在（typeof !== function） |
| `NONE` | 方法存在、订阅成功，但窗口内没有任何回调 |
| `OK{n}` | 收到 n 次回调 |
| `FAIL{code}` | 触发了 fail 回调，code 为系统错误码 |
| `ERR` | JS 抛异常 |
| `K{n}` / `EMPTY` / `NO` | health 模块方法数 / 模块为空 / require 失败 |

**注意两点：**

1. `CROWN` 和 `BACK` 不在自动流程里——表冠要你先手动滚、返回键要你先手动按，否则显示 `t0` / `N` 属正常。
2. 汇总页会卸载主页面，所以进去之后再滚表冠不计数；要刷新数据就点屏幕回主页，滚完再按「汇总」。

## 9. 跨设备使用（其他 Vela 手表 / 手环）

**代码本身不依赖 REDMI Watch 6**，用的全是通用接口（`@system.sensor` / `vibrator` / `event` / `device`），所以任何 Vela JS 应用设备都能装。但有三个现实约束：

### 9.1 设备类型

官方 manifest 文档写明：`deviceTypeList` 可选值只有 `watch、tv、car、phone`，**目前只支持 `watch`**。
所以本工程不填这个字段也只会被当作 watch 应用——**手环也归在 watch 里，不会被拒装**。

### 9.2 分辨率：`designWidth` 是等比缩放，不是自适应

`designWidth` 的定义是"页面设计基准宽度，根据实际设备宽度来缩放元素大小"。本工程设为 **432**（RW6 的宽度）。
在别的设备上，**所有 px 会按 `实际宽度/432` 等比缩放**：

| 设备 | 宽度 | 缩放比 | 表现 |
|---|---|---|---|
| REDMI Watch 6 | 432 | 1.00 | 完整显示 |
| 方形手表（466 宽） | 466 | 1.08 | 内容高 ≈ 555px，**底部日志区被裁**；汇总页 12 行仍能看全 |
| 手环类（约 192~212 宽） | ~200 | ~0.46 | 内容只占上半屏，**15px 字缩成 7px 左右，基本看不清** |

**结论：手表类基本能跑（可能裁掉底部）；手环类能装能跑，但字太小，需要单独出一版。**

### 9.3 两个包，按设备选

| 包 | 声明 feature | 适用 |
|---|---|---|
| `com.probe.rw6input`（probe2~5.rpk） | 含 `service.health` | RW6，或确认该设备有 health 模块时 |
| `com.probe.velainput.lite`（probe-lite.rpk） | 不含 `service.health` | **通用版**，任何 Vela 手表；health 那一项会显示 `EMPTY` |
| `com.probe.rw6input` **2.0**（probe-auto.rpk） | 含 `service.health` | **自动排版版**，会按屏幕尺寸算字号 |
| `com.probe.velainput.auto` **2.0**（probe-auto-lite.rpk） | 不含 `service.health` | **自动排版 + 通用**，推荐给非 RW6 设备 |

> 为什么要有 Lite：编译器要求 `require('@service.health')` 与 manifest 里声明的 feature 对应（实测去掉 feature 会直接报 `missing feature` 编译失败）。
> 所以 Lite 版把 health 的 `require` 一并去掉，避免在缺少该模块的设备上装不上或报错。

### 9.4 想让某台设备"字看得清"

改 `src/manifest.json` 的 `config.designWidth` 为该设备的**屏幕宽度**（例如 466 或 192），重新编译即可。
高度不用改——布局用的是 flex + 固定行高，宽度对上之后字就正好了。

### 9.5 跨设备对比的价值

同一个探针跑多台设备，可以直接横向比对"哪台开放了什么"，尤其是验证**官方支持表的错误是否普遍**：
RW6 已经证明官方表把"加速度计"标错成不支持，如果别的机型也出现同样偏差，说明这张表整体不可信。

## 10. v2.0 自动排版（一次打包，多尺寸通用）

### 10.1 为什么不能靠 CSS 分档

先查了官方文档，两条硬限制：

1. **不支持后代选择器**（原文："同时也可以使用`并列选择`设置样式，暂时不支持`后代选择器`"）——所以 `.s .sum-line {}` 这种写法无效；
2. 文档只承诺了类/id/标签选择器和并列选择（`.a, #b`），**没有承诺同一元素多 class 的复合选择器**（`.sum-line.s`）——写了可能静默失效。

但文档明确支持和演示了**内联样式数据绑定**：

```html
<text style="color: {{ textColor }}" onclick="changeInlineStyle">
```

所以 v2.0 改成**运行时算尺寸 → 内联样式绑定**，不依赖任何选择器组合。

### 10.2 计算公式

`px` 在 Vela 里是"相对 `designWidth` 的单位"（官方原文："其原理类似于 rem"）。所以窄屏上同样的 `px` 会变小：

```
1 设计px = 设备实际宽度 / designWidth(432) 个物理像素
```

要保证"字号占屏幕的比例恒定"，就得按反比放大：

```js
k  = 432 / screenWidth          // 设计px → 物理px 的倒数
dv = (v) => Math.round(v * k)   // 把"期望的物理像素"换算成设计px
```

- 宽 432（RW6）：k = 1，`dv(16) = 16`
- 宽 192（手环）：k = 2.25，`dv(16) = 36` → 36 × 0.444 = 16 物理像素，**和 RW6 一样大**

汇总页的行高额外按屏幕高度算，保证 12 行正好铺满一屏：

```js
lhDev = Math.floor(screenHeight * 0.66 / 12)   // 期望物理行高
lineH = dv(lhDev)                               // 换算成设计px
lineF = dv(Math.round(lhDev * 0.56))            // 字号 ≈ 行高的 56%
```

### 10.3 怎么确认它在某台设备上算对了

1. **D1 行**末尾会多出 `ui=m 432x514` —— 档位 + 实际分辨率；
2. **日志区**第一屏会打印 `layout W=… H=… k=… lineH=… lineF=…`；
3. 如果字号仍偏小/偏大，改 `onReady` 里那组基数（`dv(16)`、`dv(38)` 等）即可，不用动布局。

### 10.4 已知边界

- 只对**竖屏手表/手环**做过推算，横屏（tv/car）未验证；
- `screenWidth/screenHeight` 来自 `device.getInfo`，RW6 上该接口的三个业务字段是占位值，但**分辨率是准的**（432×514）；
- 主页面把探测区从固定 80px 改成了 `flex: 1.2`，让它随屏幕高度伸缩；
- **尚未在非 RW6 设备上实机验证**。

## 11. 免责声明

本工程只调用官方文档中存在的接口；`service.health` 与 `crownrotationchanged` 两处属于"待验证/未公开"，
代码里已做存在性判断与 try/catch，**不保证在你的固件上可用**。
