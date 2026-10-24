# REDMI Watch 6（M2523W1）Vela RPK 硬件输入能力研究报告

- 研究日期：2026-10-24
- 目标设备：REDMI Watch 6 普通版（型号 M2523W1，非活力版）
- 目标环境：Xiaomi HyperOS 3 / Vela，第三方 RPK（Vela JS 应用）
- 研究目的：查清表冠、实体按键、传感器、振动马达对第三方 RPK 的开放程度，为游戏移植选择输入方案
- **实机状态：已实机验证（2026-10-24 22:15）。** 探针 RPK 已通过 AstroBox 侧载到真机并跑出结果，原始屏拍见 `实机结果_2026-10-24.md`。表中凡标"实测"的条目为真机数据；未标者仍为文档/源码推断。**关键修正：加速度计在 RW6 上实测可用，官方支持表是错的。**

---

## 0. 摘要（先看这 6 条）

1. **表冠能"滚"，但不能"读"。** Vela 官方文档与官方 SDK 中都**未找到**表冠 API/事件；但 Vela 的列表与滚动容器可以被表冠驱动，应用只能从 `scroll` 事件里间接推断"转了一下"，拿不到方向、角度、速度、开始/结束状态。
2. **实体键只有一条公开路径：`onBackPress`。** 它可以 `return true` 拦截返回；但无法区分短按/长按/双击，也没有通用按键监听器。新增的副按键被系统功能占满（控制中心/电源菜单/SOS）。
3. **加速度计：实测可用，而且数据是真的（推翻官方支持表）。** 官方表把 RW6 列在"不支持"，真机不仅回调（`ACC OK35`），三轴值还随动作明显变化：`first=4.86,7.55,8.10` → `last=-7.07,0.29,6.52`，模长 12.09 / 9.62 m/s²（≈重力）。**这是本项目唯一可用的人体动作输入通道。**
4. **陀螺仪：文档没有、源码没有、真机也没有（三重确认）。** 实测 `typeof subscribeGyroscope === undefined`（`GYRO NOFN`）。社区所谓"陀螺仪体感"是加速度计/倾角的口语叫法，或跑在别的机型上（见 0.3）。
5. **文档之外确实还有方法**：`subscribeLight`、`subscribeProximity`、`checkAvailable`、`DATA_TYPES`、通用 `subscribe` 都在 openvela 运行时里，但没写进文档。RW6 上实测 `subscribeLight` 为 `NOFN`（被裁掉）、`DATA_TYPES` **根本不存在**（`NO`；v1.2 复核为 `none`），说明**这套固件是裁剪版，不能照抄源码清单**。
6. **传感器只剩加速度计一个真能用的。** 罗盘有 66~68 次回调，方向值域却只有 0~6°、完全不跟手——**不可用于朝向**。计步、环境光、陀螺仪全都不存在。振动仅 `vibrate({mode})` 两档。**`$canIUse` 全 true 也说明不了什么，罗盘就是反例。**

> 一句话结论：**这是一台"触屏 + 表冠滚动 + 加速度计 + 单键返回"的设备，不是"可编程按键"设备。** 加速度计意外可用，这是防误触方案的最大变量。

---

## 0.1 证据分级（全文通用）

| 等级 | 含义 | 本报告中的典型来源 |
|---|---|---|
| **A** | 官方文档 / 官方产品规格，可直接复核 | iot.mi.com Vela JS 文档、mi.com 规格页、官方说明书 |
| **B** | 官方 SDK / 官方开源代码，可本地验证 | `@aiot-toolkit/parser` 包内 `FeatureConfig.js`、openvela 仓库 |
| **C** | 社区可复核材料（有具体产物/陈述） | 米坛 RW6 专用快应用说明、AstroBox 兼容列表 |
| **D** | 合理推测（有间接依据，但无直接证据） | 事件分发路径推断、按键映射推断 |
| **E** | 未找到证据（不等于"一定不存在"） | 表冠原始事件、副按键事件、心率 API |

可信度：A > B > C > D > E。**报告中任何"能/不能"的结论都注明了等级；D/E 级不作为开发依据。**

---

## 0.2 机型与环境确认（避免套用错机型）

| 项目 | 结论 | 来源 |
|---|---|---|
| 型号 | M2523W1 | mi.com 规格页（A） |
| 系统 | 小米澎湃 OS 3（Vela 内核的应用运行时） | mi.com 规格页 / 体验文（A） |
| 屏幕 | 2.07" AMOLED，432×514，60Hz，方形 | mi.com 规格页（A） |
| 表冠 | 不锈钢**旋转**表冠，位置上移 | mi.com 规格页 / 说明书 "rotating crown"（A） |
| 第二按键 | 有，单击控制中心 / 长按电源菜单 / 三击 SOS | mi.com 香港/台湾产品页（A） |
| 传感器（标称） | 加速度、陀螺仪、光学心率+血氧、环境光、地磁 | mi.com 规格页（A） |
| 马达 | 线性马达 | mi.com 规格页（A） |
| RPK 运行 | 支持（官方支持表多处以 "REDMI Watch 6" 出现） | iot.mi.com sensor/vibrator/event/geolocation 页（A） |
| 第三方侧载 | 可行；AstroBox 标注 RW6"完整支持" | AstroBox 教程/兼容表（C） |

**为什么必须先确认这个：** 官方支持表里同时列了 REDMI Watch 5、Xiaomi Watch S4、S5、小米手环 10。
这些机型的接口开放程度**并不相同**（例如加速度计：手环 9/10 支持，RW6/S4 不支持），把任意一台的结论平移过来都会错。

---

## 0.3 反例核查：社区里"用陀螺仪"的软件，到底是什么

> 这一节是收到"第三方社区有利用陀螺仪的软件"这条线索后补做的核查。结论：**这些材料不能证明 RW6 的 RPK 能读陀螺仪，但它们暴露了两个真实问题，值得写进结论。**

| 线索 | 核查结果 | 能否作为"RW6 RPK 可读陀螺仪"的证据 |
|---|---|---|
| 《腕谷物语》标注"体感模式（使用手表陀螺仪）" | 上架版本覆盖 **米环 9 / 米环 9 Pro / Watch S3 / S4**，不是 RW6；教程写"水平 0°~60° 摆动"，这是**倾角**，加速度计即可计算 | **否**。设备不同 + "陀螺仪"是口语 |
| 开源项目 `bandminton` 调用 `sensor.subscribeGyroscope` | 作者在 `docs/sensor-access.md` 里明确写：官方文档没有该接口，加它只是**真机探测**；设备是**手环 9 Pro**；找不到就提示"当前 Vela 接口未暴露" | **否**。这是探测代码，不是成功案例 |
| 社区大量"体感游戏" | 多数跑在**加速度计官方支持**的手环 9/9 Pro/10 上 | **否**。不能平移 |
| 表盘 / 系统组件读传感器 | 表盘走 Lua/原生环境，可读 `dataman`/系统 topic（如抬腕 `algo_wrist_tilt`）；这与 RPK 的 `system.sensor` 是两条通路 | **否**。运行时不同，不能作为 RPK 证据 |

**必须承认一个残余矛盾：** S3/S4 的加速度计在官方表里同样标"不支持"，而《腕谷物语》的 S3/S4 版宣称体感可用。
这意味着**要么该应用走了表外通路，要么官方表已经过期**。无论哪种，结论都一样：**表不能当判决书，必须实测。**
（如果作者愿意提供包体或接口名，这一条可以很快闭环；在那之前，它只能算 C 级线索。）

**但这条线索提醒了两件事，已经修正进本报告：**

1. **"文档没写"不能单独作为否定证据。** openvela 的 `sensor_impl.cpp` 里真实存在 `subscribeLight`、`subscribeProximity`、`subscribeAmbientTemperature`、`subscribeHumidity`、`checkAvailable`、`get_DATA_TYPES`，这些都没有公开文档（见 B8）。
2. **官方支持表是"机型开放声明"，不是"运行时能力清单"。** 加速度计在运行时里有实现，但表把 RW6 列为不支持——这两者可以同时为真（设备不发布对应 topic / 产品策略关闭）。**所以 RW6 的加速度计必须实测，不能只引用表。**

**给读者的可执行建议：** 如果你看到的那款软件确实装在 RW6 上、且确实是 RPK，请把它的名称/下载页发我，我可以按包体或作者说明继续核对；在拿到包之前，用 C 节探针里的 `T14/T15` 两个用例，30 秒就能在你自己表上得出结论。

---

## 0.4 实机实测结果（三轮，2026-10-24）

三轮探针（v1.1 → v1.2 → v1.3）跑在同一台 REDMI Watch 6 上。第三轮最完整，屏拍逐字如下：

```
1  DEV   ap A2
2  GYRO  NOFN
3  ACC   OK35
4  COMP  OK68
5  LIGHT NOFN
6  STEP  NOFN
7  HLTH  K2
8  VIB   OK/S0
9  CROWN t20 d-800
10 BACK  N
11 CAN   s1v1e1
12 DTYPE NO

D1 brand=Vela model=ap os=0.0.0 API=2 432x514 rect watch
D2 DTYPES=none
D3 HEALTH=DATA_TYPES,isAvailable
D4 ACC n=35 hz=11.2 first=4.86,7.55,8.10 last=-7.07,0.29,6.52
D5 COMP n=68 first=0.00 last=0.00 acc=1
D6 VIB start=undefined default=undefined
D7 CROWN up=0 down=-800 1st=-640 n=20
D8 GYRO n=0 LIGHT n=0
```

### 逐项判定（三轮合并）

| # | 项目 | 三轮读数 | 判定 |
|---|---|---|---|
| 1 | 设备信息 | `brand=Vela model=ap os=0.0.0 API=2 432x514` | **占位值**，不是真实机型。`device.getInfo` 不能用来判断机型；只有 432×514 与 RW6 吻合 |
| 2 | 陀螺仪 | 三轮均 `NOFN` | **不存在**。文档无 + openvela 源码无 + 真机无，三重否证 |
| 3 | 加速度计 | `OK9` → `OK35`；`first=4.86,7.55,8.10`、`last=-7.07,0.29,6.52` | **真实可用**。模长 12.09 / 9.62 m/s²，接近重力且随动作变化 → 不是桩、不是全 0 |
| 4 | 地磁 | `OK41`→`OK68`→`OK66`；v1.4 值域 `0.0..0.1074 rad` | **有回调、几乎不跟手**。66~68 次采样只浮动 6°，未校准或占位数据 → **不可用于朝向** |
| 5 | 环境光 | 三轮 `NOFN` | 不存在（openvela 有、这台固件裁掉） |
| 6 | 计步 | 三轮 `NOFN` | 不存在（官方文档有、固件没有） |
| 7 | health | `K2`；`D3 HEALTH=DATA_TYPES,isAvailable` | **存在真实接口**：暴露了 `DATA_TYPES` 与 `isAvailable` 两个方法，可查健康数据类型可用性 |
| 8 | 振动 | `OK/S0`；`start=undefined default=undefined` | `vibrate({mode})` 可用，其余不存在 |
| 9 | 表冠 | v1.4：`n=51 d=-160 1st=-1` | **能驱动 scroll，步长约 3.1 px/事件**。基线已修正；四轮观察到的 dy 全为负，**反向符号仍未捕获**（建议菜单用绝对值） |
| 10 | 返回键 | 三轮 `BACK N` | **两次明确复测都未触发**，高度怀疑 RW6 不向 RPK 派发 `onBackPress`，或该键不映射为返回 |
| 11 | canIUse | `s1v1e1` | sensor / vibrator / event 全部 true（但 true ≠ 有数据，罗盘就是反例） |
| 12 | DATA_TYPES | `NO`（v1.2 复核 `none`） | **不存在**，`checkAvailable` 无键可枚举、不可用 |

### 六条关键结论

1. **加速度计真实可用，且数据是真的。** 不是"有回调"那么简单：两组三轴值模长 12.09 / 9.62 m/s²，接近重力、且前后明显变化。**这是本项目唯一可用的人体动作输入通道。**
2. **`$canIUse` 返回 true 不代表有数据。** 罗盘 `s1` + 68 次回调，方向却恒为 `0.00` —— 典型的桩实现。**判断传感器必须看数值，不能看回调次数。**
3. **陀螺仪、计步、环境光全都没有**（三种不同原因：文档无 / 文档有但固件删 / 源码有但固件删）。
4. **返回键两次都没响应。** 连续两轮明确测试都是 `BACK N`，基本可以判定 `onBackPress` 在 RW6 上不可依赖。
5. **`@service.health` 有真实接口**：`DATA_TYPES` + `isAvailable`。心率/步数的口子在这里，值得再挖一轮。
6. **设备信息是占位值**（`Vela/ap/0.0.0`），说明小米在这版固件里没填 `device.getInfo` 的业务字段。

### 第四轮（v1.4）：收尾的三个数

```
D5 COMP n=66 first=0.00 last=0.07 acc=1 range=0.0..0.10739228701562500
D7 CROWN up=0 down=-160 1st=-1 n=51
D9 HTYPES=HEART_RATE avail=—
```

1. **表冠步长算出来了。** 基线修正后首帧被正确丢弃（`1st=-1`），51 次 scroll 事件累计 −160 px → **约 3.1 px/事件**。事件很密、步长很小，说明"转一格"会连续产生多个事件；做菜单时应**累加到阈值（建议 24px）再翻一项**，而不是一个事件翻一项。
2. **罗盘"恒 0"的说法要收回。** 值域是 `0.0 ~ 0.1074 rad`（≈ 0~6.2°），并非完全不动。但它 66 次采样只浮动 6°，无论手腕怎么动都不跟手——**更像未校准的占位数据**，结论仍是"不能用于朝向玩法"，但不再断言是纯桩。
3. **`health.DATA_TYPES` 里确实有 `HEART_RATE`**，说明模块知道心率这个数据类型。但 `avail=—` 表明 `isAvailable` 不是可调用函数（`Object.keys` 有它，`typeof` 却不是 `function`），且整个模块只暴露这两个键、**没有读取方法**。所以：**心率目前无可用读接口**。

### 0.5 对游戏输入的最终结论

| 输入通道 | 实测可用性 | 能做什么 | 不能做什么 |
|---|---|---|---|
| 触屏 | ✅ 可用 | 点击、长按、滑动 | 误触来源；遮挡屏幕 |
| 表冠 | ✅ 约 3.1 px/事件 | 离散步进：累加 24 px 翻一项 | 连续量、角度、速度、按下事件、反向符号 |
| 加速度计 | ✅ 真实数据，稳定 **约 11 Hz** | 慢速倾斜、姿态选择、晃动手势 | 快速瞄准（延迟 ≈ 90 ms） |
| 返回键 | ❌ 两轮未响应 | —— | 不能作为暂停/退出 |
| 罗盘 | ❌ 值域仅 0~6°，不跟手 | —— | 朝向玩法 |
| 振动 | ✅ 两档 | 命中/边界/确认反馈 | 自定义节奏、强度 |
| health | ⚠️ 只有 `DATA_TYPES`/`isAvailable`，无读法 | 查类型可用性 | 读心率数值 |
| 陀螺仪 | ❌ 不存在 | —— | —— |

---

## A. 能力矩阵

> 读法：**"硬件存在"≠"驱动可用"≠"应用 API 开放"**。本表第 3、5 列分别对应后两层，不能互相推导。

| # | 硬件 / 功能 | 硬件是否存在 | 官方 Vela API 是否支持 | 是否有公开替代接口 | 是否有证据证明第三方 RPK 能调用 | 所需权限 / 版本 | 证据来源与可信度 | 实机验证 |
|---|---|---|---|---|---|---|---|---|
| M1 | **旋转表冠（方向/角度/步数）** | 是（旋转表冠） | **否**。无 crown 接口、无 crown 事件 | **有条件的替代**：`scroll` 的 `scroll` 事件（表冠滚动列表时触发）；`slider/picker` 的 `change`（待验证） | **部分**：只能拿到"滚动位移"，拿不到旋转量。社区 RW6 专用快应用作者明确称"Vela 系统对于所有列表和可滚动的界面，都支持用表冠来滚动" | 无权限；`scroll` 组件 APILevel 2+ | 官方文档缺失（A）+ 社区陈述（C）→ 可信度中 | **实测 ✅**：三轮都产生 `scroll`；但首帧基线有误（`1st=-640`），步长待修正后重测 |
| M2 | **表冠按压** | 是（按压进主菜单/回表盘） | **否**（无专用事件） | 可能映射为"返回" → `onBackPress` | **无直接证据**；只能验证"按表冠是否触发 onBackPress" | 无 | 官方说明书定义系统行为（A）；映射关系无证据（E） | **实测 ❌ 两轮 `BACK N`，未响应** |
| M3 | **副按键（新增功能键）** | 是 | **否** | 无 | **无**。系统占用：控制中心/电源菜单/SOS | 无 | 官方产品页（A）+ 接口清单缺失（A/E） | 未验证 |
| M4 | **触摸屏** | 是 | **是**：`touchstart/move/end`、`click`、`longpress`、`swipe` | — | **是**（所有快应用的默认交互） | 无 | 官方通用事件文档（A） | 已在社区应用中使用（C） |
| M5 | **加速度计** | 是 | **实测推翻官方表**：`subscribeAccelerometer` 在 RW6 上正常回调（`ACC OK9`） | — | **能**（真机已出数据；数值真实性待 v1.2 确认） | 无 | 官方支持表（A，**已被实测否定**）+ 真机实测（最高） | **实测 ✅ 2.1s/9 次回调** |
| M6 | **陀螺仪** | 是 | **否**：文档无；openvela `sensor_impl.cpp` 无 gyro 枚举/表项/函数 | **无** | **否**（社区"陀螺仪"应用见 0.3 核查） | — | 官方文档（A）+ 运行时源码（B，强） | **实测 ❌ `NOFN`（三重否证，结案）** |
| M7 | **地磁 / 罗盘** | 是 | **是**：`subscribeCompass` | — | **是**（RW6 在支持列） | 无权限；返回值仅 direction + accuracy | 官方支持表（A，强） | **实测 ⚠️ 值域仅 0~6°，不跟手 → 不可用** |
| M8 | **气压计** | **规格未列**（RW6 官方规格无气压计；Xiaomi Watch 5 才有） | 接口存在，但 RW6 不支持 | 无 | 否 | — | 官方规格（A）+ 支持表（A） | 未验证 |
| M9 | **心率 / 血氧（PPG）** | 是 | **无公开接口**（运行时 `sensor_impl.cpp` 也无 heart rate 实现） | `@service.health`（SDK 白名单内、无文档、方法集未知） | **无可靠证据**：社区在小米手环 10 上实测标准方法全部 `not a function`；RW6 未测 | 未知 | SDK 源码（B）+ 运行时源码（B）+ 社区实测（C，仅手环 10） | **实测：暴露 `DATA_TYPES` + `isAvailable`** |
| M10 | **环境光** | 是 | **文档无，但运行时存在 `subscribeLight`（未文档化）** | `sensor.subscribeLight` 直接试 | **可能有**（源码存在，机型是否发布 light topic 未知） | 无 | 运行时源码（B）+ 官方接口清单缺失（A/E） | **实测 ❌ `NOFN`（固件裁掉了）** |
| M11 | **线性马达** | 是 | **部分**：`vibrate({mode})` 支持 RW6；`start/stop/getSystemDefaultMode` 不支持 | 用 `vibrate` 重复调用来模拟节奏 | **是**（vibrate 在 RW6 支持列） | 无 | 官方支持表（A，强） | **实测 ✅ `OK/S0`（start 确不存在）** |
| M12 | **电量 / 充电事件** | — | **是**：`event.subscribe('usual.event.BATTERY_CHANGED')` 等 3 个 | — | **是**（event 接口 RW6 支持） | 无 | 官方文档（A） | 未验证 |
| M13 | **设备信息** | — | **是**：`device.getInfo`（model/APILevel/screenShape/deviceType） | — | **是** | `getDeviceId/getSerial` 需 `hapjs.permission.DEVICE_INFO` | 官方文档（A） | 未验证 |
| M14 | **GNSS 定位** | 是 | **是**：`getLocation/subscribe` | — | **是**（RW6 在支持列） | `hapjs.permission.LOCATION` | 官方支持表（A） | 未验证 |
| M15 | **Canvas（渲染能力）** | — | **未找到 canvas 组件**。基础组件仅 text/span/a/image/image-animator/progress/marquee/chart/qrcode/barcode；容器仅 div/list/scroll/stack/swiper；表单仅 input/picker/slider/switch | 用 div/text 拼；`chart` 组件可画简单图 | 未验证 | — | 官方组件清单（A，已逐页核对）+ 社区称手环 10 无 canvas（C，旁证） | 未验证 |
| M16 | **传感器诊断（枚举/可用性）** | — | **文档无，运行时存在**：`sensor.DATA_TYPES`、`sensor.checkAvailable(type)`、通用 `sensor.subscribe/unsubscribe/getRecentData` | 用它们枚举"这台表到底发布了哪些传感器" | **可能有**，这是最有力的取证工具 | 无 | 运行时源码（B） | **实测：`DATA_TYPES` 不存在（`NO`/`none`），`checkAvailable` 无键可枚举、不可用；只能具名方法逐个试** |

### 矩阵补充说明

- **M1 是"半可用"**：表冠先被系统消费成"滚动"，应用只收到滚动结果。它能做菜单上下选择，但不能做"转了多少度""转得多快""开始/结束"这类游戏输入。实测 `t88 d-800` 确认了"能滚"，但 `d=-800` 恰好等于预置的 800 偏移，说明**滚到了顶部边界**——单次滚动的步长还需要在中段位置重测。
- **M5 的官方表已被真机否定**：`ACC OK9` 是硬数据。官方支持表把 RW6 列在"不支持设备产品"，实测却正常回调。**这是本报告最重要的修正**：以后判断某机型开不开放，只能以真机为准。残留疑问是数值真实性（是否全 0）与采样率，v1.2 探针专门验这两点。
- **M6 的"否"现在是三重否证 + 真机**：文档没有 + 源码没有 + 真机 `NOFN`。这条可以结案，不必再投入。
- **固件是裁剪版，不是 openvela 基线**：`subscribeStepCounter`（官方文档有）实测 `NOFN`，`subscribeLight`（openvela 有）实测 `NOFN`，`DATA_TYPES` 根本不存在。**不要拿 openvela 的方法清单当 RW6 的能力清单。**
- **M7 的可用性有限**：`subscribeCompass` 没有采样率参数，只有 `direction`（弧度）和 `accuracy`。实测约 19.5 Hz，做朝向类玩法够用，做快速连续输入不够。
- **M9 的三层要分清**：硬件有 → 系统驱动一定在用（全天心率） → 应用 API 没有。`@service.health` 只能算"可能存在"，不能算"可用"；运行时 `sensor_impl.cpp` 也没有 heart rate 实现。
- **M10 是"文档漏写"的典型**：`subscribeLight` 在运行时里存在，但官方文档没写。它可能让你读到环境光——不过对游戏输入价值有限。
- **M15 影响游戏架构**：没有 canvas 意味着只能 div/text 布局 + CSS 动画，复杂像素游戏不现实（社区已有"用 div 模拟像素格导致帧率崩"的案例，C 级）。
- **M16 是取证工具，不是玩法**：`sensor.DATA_TYPES` 能列出这台表发布的传感器类型，`checkAvailable(type)` 能逐个问"可用吗"。这两个接口比任何文档都更能回答"RW6 到底开放了什么"。

---

## B. 关键接口与源码证据

### B1. 官方接口原文（名称与签名，逐字）

**传感器 `@system.sensor`**（`{ "name": "system.sensor" }`）

```js
sensor.subscribePressure({ callback })                  // callback: { pressure }
sensor.unsubscribePressure()
sensor.subscribeAccelerometer({ interval, callback, fail }) // callback: { x, y, z }
sensor.unsubscribeAccelerometer()
sensor.subscribeCompass({ callback, fail })             // callback: { direction, accuracy }
sensor.unsubscribeCompass()
```

- `interval` 合法值：`game`（约 20ms）、`ui`（约 60ms）、`normal`（约 200ms）
- **官方文档没有** `subscribeGyroscope`、`subscribeHeartRate`、`subscribeStepCounter`
  （注意：`subscribeStepCounter` 在运行时里存在，但是恒失败的桩，见 B8）
- 文档：https://iot.mi.com/vela/quickapp/zh/features/system/sensor.html

**振动 `@system.vibrator`**

```js
vibrator.vibrate({ mode })     // mode: 'long' | 'short'，默认 long
vibrator.start({ duration, interval, count, success, fail, complete }) // success: { id }
vibrator.stop(id)              // 返回 Boolean
vibrator.getSystemDefaultMode()// 0 关闭 / 1 标准 / 2 加强
```

- 文档：https://iot.mi.com/vela/quickapp/zh/features/system/vibrator.html

**公共事件 `@system.event`（APILevel 4+）**

```js
event.publish({ eventName, options: { params, permissions } })
event.subscribe({ eventName, callback })   // callback: { params, package }；返回订阅 id
event.unsubscribe({ id })
```

系统公共事件只有 3 个：

| 事件名 | 权限 | 说明 |
|---|---|---|
| `usual.event.BATTERY_CHANGED` | 无 | 电量变化，params.level: 0.0–1.0 |
| `usual.event.DISCHARGING` | 无 | 停止充电 |
| `usual.event.CHARGING` | 无 | 开始充电 |

- 文档：https://iot.mi.com/vela/quickapp/zh/features/system/event.html

**页面生命周期 `onBackPress`（唯一的实体键入口）**

> "当用户`右滑返回`或点击`返回实体按键`时触发该事件。
> 如果事件响应方法最后返回 `true` 表示不返回，自己处理业务逻辑（完毕后开发者自行调用 API 返回）；否则……表示遵循系统逻辑：返回到上一页。"

- 文档：https://iot.mi.com/vela/quickapp/zh/guide/framework/script/lifecycle.html
- **注意**：文档只说"返回实体按键"，**没有说表冠按压会走这里**。这是 M2 必须实机验证的原因。

**设备信息 `@system.device`**

```js
device.getInfo({ success, fail, complete })
// success: brand, manufacturer, model, product, osType, osVersionName, osVersionCode,
//          platformVersionName, platformVersionCode, language, region, APILevel,
//          screenWidth, screenHeight, screenDensity, screenShape, deviceType
device.getDeviceId({...})  // 需 hapjs.permission.DEVICE_INFO
device.getSerial({...})    // 需 hapjs.permission.DEVICE_INFO
```

- `deviceType` 取值：`watch` / `band` / `smartspeaker`
- `screenShape` 取值：`rect` / `circle` / `pill-shaped`
- 文档：https://iot.mi.com/vela/quickapp/zh/features/basic/device.html

### B2. 官方"支持明细"逐字摘录（本报告最关键的证据）

**传感器（`features/system/sensor.html` 表格原文）**

```
subscribePressure       已支持：Xiaomi Watch S3、小米手环 9 Pro、小米手环 10、Xiaomi Watch S4、Xiaomi Watch S5
                        不支持：小米 S1 Pro 运动健康手表、小米手环 8 Pro、小米手环 9、Redmi Watch 4、Xiaomi Watch H1、REDMI Watch 5、REDMI Watch 6
subscribeAccelerometer  已支持：小米手环 9 / 9 Pro、小米手环 10、Xiaomi Watch S5
                        不支持：Xiaomi Watch S3、小米 S1 Pro 运动健康手表、小米手环 8 Pro、Redmi Watch 4、Xiaomi Watch H1、Xiaomi Watch S4、REDMI Watch 5、REDMI Watch 6
subscribeCompass        已支持：Xiaomi Watch S4、REDMI Watch 5、REDMI Watch 6、Xiaomi Watch S5
                        不支持：其余小米环表设备
```

**振动（`features/system/vibrator.html` 表格原文）**

```
vibrate               已支持：小米 S1 Pro、小米手环 8 Pro、小米手环 9 / 9 Pro、Redmi Watch 4、Xiaomi Watch H1、
                              Xiaomi Watch S3、小米手环 10、Xiaomi Watch S4、REDMI Watch 5、REDMI Watch 6、Xiaomi Watch S5
start / stop / getSystemDefaultMode
                      已支持：Xiaomi Watch S5
                      不支持：Xiaomi Watch S3、Xiaomi Watch S4、REDMI Watch 5、REDMI Watch 6、小米 S1 Pro、小米手环 8 Pro、
                              小米手环 9 / 9 Pro、小米手环 10、Redmi Watch 4、Xiaomi Watch H1
```

**事件 / 定位（表格原文，按设备列）**

```
system.event        小米手环 10 支持、Xiaomi Watch S4 支持、REDMI Watch 5 支持、REDMI Watch 6 支持、Xiaomi Watch S5 支持
                    其余早期设备不支持
system.geolocation  REDMI Watch 6 支持（需 hapjs.permission.LOCATION）
```

> 这三张表是全文可信度最高的证据：它们**按机型**列出，且 RW6 同时出现在"支持"和"不支持"两列的不同接口下，说明不是"全开/全关"，而是逐接口白名单。

### B3. 关键"缺失证据"（找不到，就写找不到）

1. **Vela 通用事件列表只有 6 个**：`touchstart`、`touchmove`、`touchend`、`click`、`longpress`、`swipe`。
   没有 `keydown`、`keyup`、`keypress`、`crownrotationchanged`、`rotate`。
   来源：https://iot.mi.com/vela/quickapp/zh/components/general/events.html（A）
   同一套文档的组件清单也没有 canvas：基础组件 10 个（text/span/a/image/image-animator/progress/marquee/chart/qrcode/barcode）、
   容器 5 个（div/list/list-item/scroll/stack/swiper）、表单 4 个（input/picker/slider/switch），均无 canvas。
   来源：https://iot.mi.com/vela/quickapp/zh/components/basic/（A，已核对）
2. **Vela 系统能力接口清单只有 11 个**：network、vibrator、brightness、record、geolocation、sensor、event、battery、volume、zip、bluetooth。
   没有 input / key / crown / wearable 模块。
   来源：https://iot.mi.com/vela/quickapp/zh/features/system/（A）
3. **SDK 的 feature 白名单里没有 key/crown/rotation/gyroscope**（B 级，可本地复核）。
   文件：`@aiot-toolkit/parser@2.0.5` → `package/lib/ux/config/FeatureConfig.js`

   ```js
   SYSTEM_FEATURE = ['app','model','router','configuration','alarm','audio','barcode','bluetooth',
     'brightness','calendar','cipher','clipboard','contact','device','fetch','file','geolocation',
     'image','keyguard','media','network','notification','package','prompt','record','request',
     'resident','sensor','share','shortcut','sms','storage','vibrator','volume','websocketfactory',
     'webview','battery','wifi','mediaquery','zip','telecom','decode','uploadtask','downloadtask',
     'interconnect','crypto','exchange','internal.message','microphone','internal.ota','internal.power',
     'internal.settings','internal.micamera','serviceUtil','event']
   SERVICE_FEATURE = ['account','alipay','ad','wxaccount','qqaccount','wbaccount','exchange','health',
     'pay','push','qqaccount','share','stats','wbaccount','wxaccount','wxpay','biometriverify',
     'texttoaudio','wechat','internal.audiosync','internal.audiofocus','internal.alarm','mihome',
     'bootstrap','miai']
   ```

   - `keyguard` 是**锁屏**，不是按键；不要误读。
   - `service.health` 在列表里，但**没有任何官方文档页**，这就是 M9 只能标"未验证"的原因。
   - **重要限制**：这份白名单只校验模块（`system.sensor`），**不校验方法名**。所以它不能否定 `subscribeGyroscope` 的存在——真正的否定证据是 B8 的运行时源码。
4. **APILevel 3 / 4 变更日志没有表冠/按键/传感器新增**：
   - APILevel3 只加了 box-shadow、`$canIUse`、scroll 边缘吸附、uploadtask、screenDensity、pill-shaped 等。
   - APILevel4 只加了一个接口：`@system.event`。
   来源：https://iot.mi.com/vela/quickapp/zh/guide/version/APILevel3.html 、 `.../APILevel4.html`（A）
5. **公开代码里搜不到 `crownrotationchanged`**：grep.app 全站检索结果为 0 条（检索时间 2026-10-24）。
   含义：没有公开的 Vela/快应用项目实现或使用过这个事件名。（C/E）
6. **没有 RW6 固件、符号表或反编译材料公开**。openvela 开源的是基础 OS 与 QuickApp 运行时，不含小米手表的整机输入映射与产品化配置。

### B4. 四条最容易误判的"假证据"（务必排除）

| 误判来源 | 它写了什么 | 为什么不能用在 RW6 |
|---|---|---|
| **watchdoc.quickapp.cn《表冠旋转 3+》** | `crownrotationchanged` 事件，参数 `direction`(Boolean)、`delta`、`velocity`、`duration`、`state`(1/2/3)；属性 `rotation-sensitivity`、`vibration-effect-enabled`；方法 `requestFocus(true)` | 这是**快应用（安卓）手表规范**的文档，首页明说"在使用前端技术在安卓手机上开发"。Vela 是 NuttX 底座，不是安卓；Vela 文档没有这个事件，SDK 也不认。**字段设计值得参考，但不能当成本机 API。** |
| **华为 HarmonyOS `onDigitalCrown`** | `CrownEvent { degree, angularVelocity, action, timestamp }` | 另一个 OS，API 完全不通用 |
| **Zepp OS digital crown** | 一套 `onDigitalCrown` 交互与防误触规范 | 另一个 OS；其"20 个周期才响应"的防误触参数不能照搬 |
| **小米手环 10 的 `@service.health` 实测** | 能 import，但 `getTodaySteps` 等标准方法 `not a function` | 手环 10 与 RW6 是不同机型、不同固件；只能作为"小米实现与联盟标准不一致"的旁证，不能作为 RW6 结论 |

### B5. RPK 包结构与权限模型

`manifest.json` 关键字段（官方文档 https://iot.mi.com/vela/quickapp/zh/guide/framework/manifest.html ）：

```json
{
  "package": "com.company.app",
  "name": "应用名",
  "versionCode": 1,
  "minAPILevel": 1,
  "deviceTypeList": ["watch"],
  "features": [{ "name": "system.sensor" }],
  "permissions": [{ "name": "hapjs.permission.LOCATION" }],
  "router": { "entry": "Index", "pages": { "Index": { "component": "index" } } }
}
```

- **`features` 是硬门槛**：官方原文"绝大部分接口都需要在这里声明，否则不能调用"；编译器用 B3 的白名单校验（B 级）。
- **公开权限只有两个**：`hapjs.permission.LOCATION`、`hapjs.permission.DEVICE_INFO`。
  **不存在** `KEY`、`CROWN`、`SENSOR` 之类的权限——因为没有对应 feature。
- 这解释了一个现象：**不是"权限没申请所以拿不到按键"，而是"根本没有这个接口可申请"。**

### B6. 事件分发路径：系统消费 vs 应用可接收（推断，D 级）

根据 openvela 的模块划分（`frameworks_runtimes_services_wm` 负责"输入、输出和显示管理"；`frameworks_runtimes_feature` 是 JS→Native 的 feature 运行时），可以画出这样一条路径：

```
表冠/按键硬件
   ↓ (驱动，EV_KEY / 编码器)
WindowManager（系统侧）
   ├─ 系统 UI 消费：亮屏、返回表盘、控制中心、电源菜单、音量
   └─ 焦点窗口消费：
         ├─ 可滚动组件 → 转成 scroll 位移 → JS 收到 scroll 事件   ← 应用能拿到的唯一形态
         └─ 页面返回栈 → onBackPress → JS 可 return true 拦截      ← 应用能拿到的唯一按键形态
```

**这条路径是推断，不是源码实证**（RW6 固件未公开）。但它与三个已知事实吻合：
① Vela 没有按键 feature；② `onBackPress` 文档明确提到"返回实体按键"；③ 社区开发者说表冠能滚所有列表。

**如何在实验中区分"系统处理"与"应用可接收"：**

| 观察 | 判定 |
|---|---|
| 转表冠，页面滚动且 `onscroll` 触发 | 事件到达应用，但已被系统转成"滚动语义" |
| 转表冠，页面不滚、系统音量/亮度变了 | 系统层消费，应用完全拿不到 |
| 转表冠，页面不滚也无系统变化 | 当前焦点不在可滚动组件，或该界面表冠被禁用 |
| 按表冠，页面退出 | 系统消费（回表盘/返回栈） |
| 按表冠，出现 `onBackPress` 且页面不退出 | 应用成功拦截 |

### B8. 传感器运行时的真实方法表（B 级，源码实证）

这是本报告最硬的一条证据，直接回答"陀螺仪到底有没有接口"。

- 仓库：`open-vela/frameworks_runtimes_feature`（openvela 5.5 开源的 QuickApp Feature 运行时）
- 文件：`modules/sensor_impl.cpp`（约 37KB，dev 分支）
- 机制：JS 方法名 = 导出函数 `system_sensor_wrap_<method>` 的后缀；`system_sensor_get_<prop>` 对应 JS 属性

| JS 方法 / 属性 | 是否存在 | 说明 |
|---|---|---|
| `subscribeAccelerometer` / `unsubscribeAccelerometer` | **是** | interval: game 20ms / ui 50ms / normal 200ms |
| `subscribeCompass` / `unsubscribeCompass` | **是** | 固定 100ms |
| `subscribePressure` / `unsubscribePressure` | **是** | 气压 |
| `subscribeProximity` / `unsubscribeProximity` | **是** | **未文档化** |
| `subscribeLight` / `unsubscribeLight` | **是** | 环境光，**未文档化** |
| `subscribeAmbientTemperature` / `subscribeHumidity` | **是** | **未文档化** |
| `subscribeStepCounter` / `unsubscribeStepCounter` | **桩** | 恒返回 203「Current device does not support pedometer sensor」 |
| `subscribe` / `unsubscribe` / `getRecentData` / `checkAvailable` | **是** | 通用接口，按 `type` 索引；interval: low 200ms / mid 50ms / high 20ms |
| `DATA_TYPES`（属性） | **是** | 返回各传感器类型的索引表 |
| **`subscribeGyroscope`** | **否** | 无枚举、无表项、无函数、无头文件 |
| **`subscribeHeartRate`** | **否** | 无实现 |

源码里的 `sensor_magic_t` 枚举只有：

```c
SENSOR_MAGIC_GNSS, SENSOR_MAGIC_BARO, SENSOR_MAGIC_ACCEL, SENSOR_MAGIC_COMPA,
SENSOR_MAGIC_PROX, SENSOR_MAGIC_LIGHT, SENSOR_MAGIC_STEP,
SENSOR_MAGIC_AMBIENTTEMPERATURE, SENSOR_MAGIC_HUMIDITY,
#ifdef CONFIG_MIWEAR_COMMON
SENSOR_MAGIC_WRIST_TILT,
#endif
```

**没有 `GYRO`。** `sensor_orb_table` 里也只有 GPS / BAROMETER / ACCELEROMETER / COMPASS / PROXIMITY / LIGHT / STEP_COUNTER / AMBIENT_TEMPERATURE / HUMIDITY（以及 MIWEAR 私有的 WRIST_LIFT）。

**这组证据同时给出两个结论：**

1. **陀螺仪在 RPK 运行时层面确实没有落点**——不是"文档没写"，是代码里就没有。
2. **"未文档化接口"是真实存在的**——light / proximity / temperature / humidity / checkAvailable / get_DATA_TYPES 都没写进文档，但代码里有。所以正确取证方式是"枚举运行时方法 + 真机探测"，而不是只查文档。

**边界说明：** openvela 是开源基线，小米手表的出货固件可能增删方法。但"可能增"不等于"已经增"；在没有固件或实测证据前，不能假设 `subscribeGyroscope` 存在。

**补充（本机实测）：** 用 `aiot-toolkit@2.0.5` 编译含 `sensor.subscribeGyroscope` 的探针工程，**可以正常打包**，且该方法名被原样保留在产物里。这说明**编译器不校验方法名**——"编译通过"不能作为"接口存在"的证据。详见 C4。

---

## C. 最小化测试项目

工程位置：`rpk-input-probe/`（与本文同目录）

```
rpk-input-probe/
├── package.json
├── README.md                         # 编译、安装、逐项测试步骤
├── snippets/crown-event-probe.ux.txt # 可选：单独验证表冠事件是否存在
└── src/
    ├── manifest.json                 # 声明 sensor/vibrator/event/device/service.health
    ├── app.ux
    ├── Common/icon.png
    └── pages/Index/index.ux          # 主探针页（屏幕日志）
```

### C1. 五个探针的设计（关键代码）

**① 表冠：借 scroll 间接观测**

思路：把一个 `scroll` 预置到中间位置，手指不碰屏幕，只转表冠；用 `scrollY` 差值判断"是不是表冠在滚"。

```html
<scroll id="crownScroll" scroll-y="true"
        onscroll="onProbeScroll"
        ontouchstart="onProbeTouchStart"
        ontouchend="onProbeTouchEnd">
```

```js
onProbeScroll(e) {
  const y = e.scrollY
  const dy = y - this.scrollY
  this.scrollY = y
  if (!this.armed || this.touchActive || dy === 0) return
  this.crownTicks++
  this.crownDelta += dy
  this.log('SCROLL(no touch) dy=' + dy + ' total=' + this.crownDelta)
}
```

三个防误判细节：
- `armed`：启动后 800ms 内忽略，避免 `scrollTo` 初始化被当成表冠；
- `touchActive`：手指按下即置位，抬起后 700ms 才复位，避开惯性滚动；
- `dy` 的符号：用来判断表冠方向（正/负），但**不是角度**。

**② 按键：只测 `onBackPress`**

```js
onBackPress() {
  this.log('*** onBackPress 触发')
  if (this.backConsume) return true   // 消费，不退出
  return false
}
```

判定：按表冠/副按键后，日志出现且页面不退出 = 可用；页面退出 = 拦截失败；无日志 = 系统吞掉。

**③ 传感器：`$canIUse` + `fail` 双保险**

```js
this.log('canIUse=' + this.$canIUse('@system.sensor.subscribeAccelerometer'))
sensor.subscribeAccelerometer({
  interval: 'ui',
  callback: (r) => this.log('accel x=' + r.x + ' y=' + r.y + ' z=' + r.z),
  fail: (msg, code) => this.log('accel fail code=' + code + ' msg=' + msg)
})
```

`$canIUse` 是 APILevel 3+ 的官方能力查询（`this.$canIUse('@system.xxx')` 或 `'@system.xxx.method'`），
比"try/catch 看报错"更干净；老固件没有这个方法时降级为 `fail` 回调。

**④ 振动：分三层测**

```js
vibrator.vibrate({ mode: 'short' })            // 预期：可用
typeof vibrator.start                          // 预期：undefined（RW6 不支持）
vibrator.start({ duration: 300, interval: 150, count: 3, ... }) // 预期：不可用
```

**⑤ 传感器枚举：直接问运行时"你有哪些传感器"**

这一组是收到"社区有陀螺仪软件"线索后加的，也是最能一锤定音的探针。

```js
// 1) 列类型表（sensor.DATA_TYPES 是属性，不是方法）
const types = sensor.DATA_TYPES || {}
this.log('DATA_TYPES=' + Object.keys(types).join(','))

// 2) 逐个问可用性（参数是索引，不是字符串）
for (const k in types) {
  if (typeof sensor.checkAvailable === 'function') {
    try { this.log('check ' + k + '=' + sensor.checkAvailable(types[k])) } catch (e) {}
  }
}

// 3) 直接探测陀螺仪方法（官方无文档，openvela 源码也无实现）
this.log('typeof subscribeGyroscope=' + typeof sensor.subscribeGyroscope)
if (typeof sensor.subscribeGyroscope === 'function') {
  sensor.subscribeGyroscope({
    interval: 'game',
    callback: (r) => this.log('GYRO 有数据 x=' + r.x + ' y=' + r.y + ' z=' + r.z),
    fail: (m, c) => this.log('GYRO fail code=' + c + ' ' + m)
  })
  setTimeout(() => this.log('GYRO 2s 到，若上面无数据即无回调'), 2000)
}
```

判读：
- `typeof` 为 `undefined` → 该固件没有这个方法（与 openvela 源码一致）
- 有方法但 `fail` → 方法在、设备侧关闭
- 有方法且有数据 → **推翻本报告 M6，请立刻记录固件版本**

### C2. 测试用例表（真机执行）

| # | 操作 | 期望（若官方文档/源码准确） | 实际记录 | 结论 |
|---|---|---|---|---|
| T1 | 打开应用 | 显示设备型号、APILevel、432×514、rect、watch | | |
| T2 | 只转表冠（不触屏），向下 | 出现 `SCROLL(no touch) dy>0` | | 表冠→滚动是否成立 |
| T3 | 只转表冠，向上 | `dy<0`，符号翻转 | | 方向是否可辨 |
| T4 | 手指滑动滚动区 | 不出现 `SCROLL(no touch)` | | 防误判是否有效 |
| T5 | 转到列表顶部后继续转 | 不再有 `dy`，或出现系统行为 | | 边界行为 |
| T6 | 按表冠 | 出现 `onBackPress` 且页面不退出 | | 表冠按压是否可拦 |
| T7 | 按副按键 | 出现控制中心/电源菜单，无 `onBackPress` | | 副按键是否可拿 |
| T8 | 点"加速度" | **两种都可能**：`fail`（官方表）或持续出数（表已过期）——都要如实记录 | | **最高优先级** |
| T9 | 点"罗盘"，绕 8 字 | `compass dir=… acc=3` | | 地磁可用性 |
| T10 | 点"health" | `health keys=…`，记录方法名 | | 隐藏接口摸底 |
| T11 | 点"振动 short/long" | 各震一下，力度不同 | | 马达可用性 |
| T12 | 点"start 参数" | `typeof start=undefined` | | 高级振动不可用 |
| T13 | 插拔充电器 | `BATTERY_CHANGED` | | 公共事件可用性 |
| **T14** | 点"陀螺仪探测" | `typeof subscribeGyroscope=undefined`，或 `fail` | | **直接回答"能不能用陀螺仪"** |
| **T15** | 点"列举传感器" | 打印 `DATA_TYPES=…`，记录这台表暴露的类型 | | **运行时真实能力清单** |
| **T16** | 看 `checkAvailable` 结果 | 每个类型 true/false | | 哪类传感器对应用开放 |
| **T17** | 点"环境光" | 有 `light` 数据 = 未文档化接口可用 | | 隐藏能力 |
| **T18** | 点"计步" | 预期 `fail code=203`（恒失败桩） | | 验证运行时桩实现 |

> 表中"期望"来自官方文档与 openvela 源码；**"实际记录"必须由你在真机上填写**。本报告不代填、不推测。
> **如果 T14/T15 的结果与本报告冲突，以真机为准，并把固件版本一起记下来。**

### C3. 编译与安装（要点）

1. AIoT-IDE 新建空白 "Vela JS 应用" 项目 → 用本工程 `src/` 覆盖（保证依赖版本匹配）
2. `npm run build` → `dist/*.debug.rpk`；正式包需 `sign/private.pem` + `certificate.pem`
3. 手表：`设置 → 我的设备 → 连接新手机`
4. AstroBox：登录小米账号 → 同步设备 → 连接 → 安装快应用 → 选 rpk
5. 日志：屏幕日志为主（本工程已做 80 条滚动面板）；`console.log` 走 IDE 调试通道

**已知限制：**
- AIoT-IDE 的官方"真机调试"目前只对 Xiaomi Watch S4 及合作方开放，个人开发者一般只能"打包 → 侧载 → 看屏幕日志"（C 级，社区反馈）。
- 快应用安装数量上限约 20 个（社区经验，C 级），装不下时先卸载旧应用。
- `service.health` 已实测可编译（见 C4）；若安装时被固件拒绝，删掉 `manifest.json` 里该 feature 和 `probeHealth()` 的 `require` 段即可，不影响其它探针。

### C4. 本机编译验证（已完成，2026-10-24）

**环境结论：未在常见位置发现 AIoT-IDE 图形界面**（常见安装目录、注册表卸载项、开始菜单、下载目录都没有），但有两套可用的 CLI 工具链：

- `D:\实验\chess_engine\jsapp\node_modules\aiot-toolkit@2.0.5`
- `D:\开发\galgame\node_modules\aiot-toolkit@2.0.5`
- `<local-path>` 为空 → 模拟器镜像从未创建

**本工程已用这套 CLI 实际编译通过：**

```
node <toolkit>/lib/bin.js build
✅ build success: 627ms
产物：dist/com.probe.rw6input.debug.1.0.0.rpk（16,371 字节）
```

编译器在这一步抓到一个真实错误：`router.entry` 写成 `Index` 时，它去找 `src/Index/index.ux`；必须写成 `pages/Index` 才对应 `src/pages/Index/`。已修正。

**编译验证能证明什么、不能证明什么：**

| 能证明 | 不能证明 |
|---|---|
| manifest 结构合法；5 个 feature（含 `service.health`）被接受并写入最终包 | 任何接口在 RW6 上可用 |
| 页面模板/JS 语法可编译；`onBackPress`、`scroll`、`slider` 绑定合法 | 表冠/按键的真实事件行为 |
| rpk 能签名、能产出 | 能否安装到手表、能否启动 |

**一个必须记住的坑：** 反编译产物里 `subscribeGyroscope`、`DATA_TYPES`、`checkAvailable`、`subscribeLight` 都被原样保留（grep 计数分别为 6 / 13 / 3 / 4）。这说明**编译器不校验方法名**——写一个不存在的方法照样能打包成功。因此"编译通过"绝不能当作"运行时可用"。

**未完成的部分：** `getConnectedDevices` 返回 `null`（手表未连接，且本机 PATH 里没有 adb），所以没有安装、没有运行；`<local-path>` 为空，模拟器镜像也未创建。

---

## D. 最终可行性结论

### D1. 六问六答

**1）能否通过表冠旋转进行游戏菜单选择？**
**不能通过"表冠 API"，但可以通过"滚动容器"间接做到。**
- 官方无表冠接口（A/E），拿不到方向、角度、步数、开始/结束。
- 把菜单做成可滚动的 `scroll`/`list`，表冠会驱动它滚动，应用从 `onscroll` 的 `scrollY` 变化推断"上/下一条"（C 级社区证据，需 T2/T3 实机确认）。
- 适合：列表式菜单、翻页、数值加减。
- 不适合：需要加速度、精确刻度、按住旋转的游戏操作。

**2）能否通过实体按键进行确认、返回或暂停？**
- **返回/暂停：有条件可以。** `onBackPress` 是公开生命周期，`return true` 可拦截（A）。
- **实测：第一轮没触发（`BACK N`）。** 可能是没按到，也可能 RW6 的返回不走这个回调。**这是唯一还没定论的关键项**，v1.2 复测会明确"按一次表冠"与"右滑"分别是否触发。
- **确认：不能单独实现。** 没有"确认键"；只能把"返回"复用为"确认/暂停"，或用屏幕按钮。
- **区分短按/长按/双击：不能。** 没有任何按键事件对象，`onBackPress` 也不带时长/次数。

**3）能否读取陀螺仪或加速度计？**
- **陀螺仪：不能，已结案。** 文档没有 + openvela `sensor_impl.cpp` 没有 + 真机 `GYRO NOFN`，三重否证。社区"陀螺仪"应用已在 0.3 逐条排除。
- **加速度计：能，实测已通。** 官方表说"不支持"是**错的**；真机 `subscribeAccelerometer` 在 2.1 秒内回调 9 次（`ACC OK9`）。残留疑问只有两个：数值是否真实、采样率够不够做体感（v1.2 专项验证）。
- 地磁罗盘实测 `OK41`（约 19.5 Hz），可做朝向类玩法。

**4）哪些能力可直接通过公开 API 实现？**
| 能力 | 接口 |
|---|---|
| 触摸点击/长按/滑动 | `click` / `longpress` / `swipe` / `touch*` |
| 返回键拦截 | `onBackPress` + `return true` |
| 表冠滚动菜单 | `scroll` / `list` 的 `scroll` 事件（间接） |
| 地磁朝向 | `sensor.subscribeCompass` |
| 振动反馈（两档） | `vibrator.vibrate({mode})` |
| 电量/充电事件 | `event.subscribe` |
| 设备信息 | `device.getInfo` |
| GNSS 定位 | `geolocation.getLocation/subscribe`（需 LOCATION 权限） |
| 界面渲染 | div/text/image/scroll/swiper/slider/picker/chart 等 |

> 另有 4 个"未文档化但运行时存在"的接口：`sensor.DATA_TYPES`、`sensor.checkAvailable`、`sensor.subscribeLight`、通用 `sensor.subscribe`。它们不算"公开 API"，但可作为取证与备选能力（见 B8）。

**5）哪些能力需要进一步逆向研究？**
- 表冠**原始**旋转事件（是否存在未公开的 feature/事件名，能给出 delta/velocity/state）
- 副按键事件是否在系统层有可订阅的分发点
- `@service.health` 在 RW6 上的真实方法集（`K2` 是哪两个方法？）
- 系统如何把表冠映射为 scroll（能否构造"只接表冠、不接触摸"的容器）

**6）哪些能力目前没有证据表明可以实现？**
- 陀螺仪读数（已三重否证）
- 短按/长按/双击的按键区分
- 阻止副按键的系统行为（控制中心/电源菜单/SOS）
- 读取心率/血氧（公开接口层面）
- 表冠的角度/速度/步数
- 计步 / 环境光（这台固件把方法整个裁掉了）

> 加速度计读数已从本清单移出——2026-10-24 真机实测 `ACC OK9`，接口确实通。

> 环境光已从"无证据"移出：运行时存在 `subscribeLight`，但未文档化、RW6 未验证，改列"未验证的隐藏能力"（T17）。

### D2. 推荐的游戏输入方案（按实测能力重写）

**能用的一共三样：触屏、表冠滚动、加速度计。** 返回键别指望（两轮未响应），罗盘是桩，陀螺仪不存在。这个方案就围绕这三样设计。

```
┌──────────────────────────────┐ 432×514
│ ←暂停      HUD：分数（24px） │  ← 暂停放左上角，不再依赖返回键
├──────────────────────────────┤
│                              │
│      游戏主区（触控）         │
│   最多 2 个大按钮             │
│   最小点击区 96×96            │
│                              │
├──────────────────────────────┤
│ 底部 56px：手势安全区（留空） │  ← 防右滑返回误触
└──────────────────────────────┘
```

**输入映射：**

| 游戏动作 | 输入方式 | 实现要点 |
|---|---|---|
| 菜单上下 / 翻页 | 表冠 | 全屏 `scroll`；**把 `dy` 累加到 24 px 才翻一项**（实测约 3.1 px/事件，一事件一项会飞）；每次翻页 `vibrate('short')` |
| 确认 | 点选中项 | 大按钮；表冠只做选择，永不做确认 |
| 移动 / 转向 | **加速度倾斜** | 死区 8°、饱和 30°；开局静止 1 秒取重力基线；用 `atan2` 取横滚角 |
| 闪避 / 抖动 | **加速度突变** | 连续 3 帧重力方向变化超阈值才触发，抗走路误触 |
| 主操作（攻击/跳跃） | 屏幕右下大按钮 | ≥96×96，按住持续触发 |
| 次操作（防御/取消） | 屏幕左下大按钮 | 与右下对称 |
| **暂停** | **屏幕左上角**「⏸」+ 3 秒无操作自动暂停 | **不要绑返回键**（实测不可靠） |
| 退出 | 暂停面板内长按 600ms | 二次确认，避免误退 |
| 反馈 | 线性马达 | `vibrate` 两档组合出三种节奏（命中/失败/边界） |

**三条必须改掉的设计（相比"文档时代"的版本）：**

1. **暂停不能靠返回键。** 两轮明确复测都是 `BACK N`。改成"屏内暂停按钮 + 无操作自动暂停"，自动暂停还能顺带省电。
2. **体感只能做慢速姿态。** 采样率约 11–17 Hz（间隔 60–90 ms），做不了实时瞄准，但做"左右倾斜 = 左右移动"完全够——因为玩家倾斜是持续动作，不是瞬发。
3. **表冠只做离散步进。** 拿不到角度和速度，只拿得到 `scroll` 位移；好在菜单/翻页正好是离散的。

**防误触的具体做法：**

1. **禁用边缘手势区**：底部 56px、左右各 16px 不放可点元素。
2. **"长按确认"代替"点击确认"**：退出、删档要求按住 600ms。
3. **倾斜加死区 + 连续帧确认**：8° 以内不动，连续 3 帧超阈值才生效。
4. **表冠只做"选择"，不做"执行"**。
5. **暂停即冻结**：`onHide` 与自动暂停都立即停游戏循环。
6. **振动做"边界提示"**：列表到顶/到底短震，不用看屏幕也知道转到底了。

### D3. 如果一定要"更像主机"的输入

只有一条路：**换机型或换方案**，而不是在 RW6 上硬挖。
- 需要摇杆/体感：选加速度计开放的机型（官方表里手环 9/10、Watch S5 支持），或安卓手表。
- 需要表冠精确输入：华为 HarmonyOS 手表有 `onDigitalCrown`（degree/angularVelocity），但那是另一个生态。
- 需要按键：目前小米 Vela 全系都没有公开按键 API，换小米机型也解决不了。

### D4. 下一步（按性价比排序）

1. **实机跑 T1–T13**（半天）：先把"表冠能不能滚、返回键能不能拦"这两个决定架构的问题钉死。
2. **写一个 20 行的菜单 demo**：scroll 列表 + 表冠滚动 + 短震 + 返回键暂停。这是最小可玩闭环。
3. **再决定是否逆向**：只有当前两步证明"表冠滚动不可用"时，才值得投入固件/符号级研究；否则收益很低。
4. **逆向时的合法边界**：只分析公开固件、公开 SDK、自己设备上的日志；不修改系统、不绕过签名校验、不传播未公开固件。

---

## 附录 A：主要来源链接

**官方文档（A）**
- Vela JS 应用文档总入口：https://iot.mi.com/vela/quickapp/zh/
- 传感器：https://iot.mi.com/vela/quickapp/zh/features/system/sensor.html
- 振动：https://iot.mi.com/vela/quickapp/zh/features/system/vibrator.html
- 公共事件：https://iot.mi.com/vela/quickapp/zh/features/system/event.html
- 地理位置：https://iot.mi.com/vela/quickapp/zh/features/system/geolocation.html
- 设备信息：https://iot.mi.com/vela/quickapp/zh/features/basic/device.html
- 生命周期（onBackPress）：https://iot.mi.com/vela/quickapp/zh/guide/framework/script/lifecycle.html
- 通用事件：https://iot.mi.com/vela/quickapp/zh/components/general/events.html
- 通用方法（focus）：https://iot.mi.com/vela/quickapp/zh/components/general/methods.html
- 全局方法（$canIUse）：https://iot.mi.com/vela/quickapp/zh/guide/framework/script/global-data-method.html
- 项目配置（manifest/权限）：https://iot.mi.com/vela/quickapp/zh/guide/framework/manifest.html
- APILevel3：https://iot.mi.com/vela/quickapp/zh/guide/version/APILevel3.html
- APILevel4：https://iot.mi.com/vela/quickapp/zh/guide/version/APILevel4.html

**官方产品规格（A）**
- REDMI Watch 6 规格（中国）：https://www.mi.com/prod/redmi-watch-6/specs
- REDMI Watch 6 规格（英国，英文）：https://www.mi.com/uk/product/redmi-watch-6/specs/
- 产品页（双按键定义）：https://www.mi.com/hk/product/redmi-watch-6/
- 说明书（rotating crown / 按键功能）：https://zh-tw.manuals.plus/m/e19e56663f2e8c535900510819f053533912ee46b1d1e8f19f2247283bfcd792

**SDK / 源码（B）**
- `@aiot-toolkit/parser@2.0.5`：https://registry.npmjs.org/@aiot-toolkit/parser
  - feature 白名单：`package/lib/ux/config/FeatureConfig.js`
- openvela QuickApp 运行时：https://github.com/open-vela/frameworks_runtimes_feature
- **openvela sensor feature 实现（本报告 B8 的证据）**：https://github.com/open-vela/frameworks_runtimes_feature/blob/dev/modules/sensor_impl.cpp
- openvela 窗口/输入管理：https://github.com/open-vela/frameworks_runtimes_services_wm
- openvela 5.5 发布说明（宣布开源 QuickApp 全栈）：https://github.com/onecer/open-vela-docs/blob/HEAD/./en/release_notes/v5.5.md

**社区材料（C）**
- 米坛 RW6 专用快应用《QQ宠物》，作者原话"Vela 系统对于所有列表和可滚动的界面，都支持用表冠来滚动"：https://www.bandbbs.cn/resources/3003/
- 小米手环 10 `@service.health` 实测（仅旁证）：https://www.bandbbs.cn/threads/27530/
- AstroBox（RW6 完整支持/侧载流程）：https://astrobox.online/zh-hk
- **反例 1**：开源 `bandminton`（手环 9 Pro）陀螺仪探测代码与说明：https://github.com/Yixuan-Wu39/bandminton/blob/main/docs/sensor-access.md
- **反例 2**：《腕谷物语》"体感模式（使用手表陀螺仪）"，实际覆盖米环 9/9 Pro 与 S3/S4：https://www.bandbbs.cn/resources/4119/update/6129

**明确不适用（仅作对照）**
- 快应用（安卓）手表规范·表冠旋转：https://watchdoc.quickapp.cn/component/common/common-rotation.html
- 华为 HarmonyOS 表冠事件：https://developer.huawei.com/consumer/en/doc/HarmonyOS-Guides/arkts-common-events-crown-event

---

## 附录 B：未验证清单（交付前必须实机确认）

| 编号 | 待验证项 | 验证用例 | 影响 | 状态（2026-10-24 实测） |
|---|---|---|---|---|
| U1 | 表冠旋转是否真的驱动 `scroll` | T2/T3 | 决定菜单方案是否成立 | **✅ 能滚**；步长因基线错误（`1st=-640`）待重测 |
| U2 | 表冠按压是否触发 `onBackPress` | T6 | 决定"返回/暂停"是否可用 | **❌ 两轮 `BACK N`，按不可用处理** |
| U3 | `return true` 是否真能阻止退出 | T6 | 决定能否做暂停面板 | ⚠️ 依赖 U2 |
| U4 | 副按键是否完全不可见 | T7 | 决定是否需要放弃该键 | 未测 |
| U5 | 加速度计到底是"设备关闭"还是"表已过期" | T8 | 决定能否做倾斜/摇晃输入 | **✅ 表已过期**：`OK9` 正常回调 |
| U6 | 罗盘采样率与漂移 | T9 | 判断能否做朝向玩法 | **❌ 值域仅 0~0.107 rad（6°），不跟手** |
| U7 | `@service.health` 方法集 | T10 | 心率/步数玩法的唯一希望 | **✅ 方法为 `DATA_TYPES` + `isAvailable`**；数据类型待查 |
| U8 | 振动强度/时长是否可组合 | T11/T12 | 反馈手感设计 | **✅ `OK/S0`**，只有两档 |
| U9 | 是否存在 canvas | 组件清单/实测 | 决定渲染架构 | 未测（组件清单已无 canvas） |
| U10 | 快应用内存/包体上限 | 实测 | 决定资源规格 | 未测 |
| **U11** | `subscribeGyroscope` 在 RW6 固件上是否为 `undefined` | **T14** | **直接回答"能不能用陀螺仪"** | **✅ `NOFN`，结案** |
| **U12** | `sensor.DATA_TYPES` 在 RW6 上暴露了哪些类型 | **T15/T16** | **运行时真实能力清单** | **✅ 不存在（`NO` / v1.2 `none`）** |
| **U13** | `subscribeLight` 是否可用 | T17 | 隐藏能力，价值有限 | **✅ `NOFN`，被裁掉** |
| **U14** | `subscribeStepCounter` 是否恒失败 203 | T18 | 验证运行时桩实现 | **✅ 比预期更彻底：方法整个不存在（`NOFN`）** |

---

## 附录 C：方法与边界

- 本报告优先使用**官方文档 + 官方 SDK + 官方规格 + 官方开源运行时源码**；社区材料只用于"是否存在可行路径"的旁证，并在正文标注 C 级。
- **没有**把小米手环、Redmi Watch 4/5、Xiaomi Watch S3/S4/S5、Zepp OS、Wear OS、HarmonyOS 的结论直接套到 RW6；凡引用均注明"仅旁证"。
- **没有**伪造任何 API 名称。找不到的接口一律写"未找到证据"。
- **没有**在真实设备上运行测试；所有"可用/不可用"都是文档/源码结论或待验证推断。
- **做了**本机编译验证：2026-10-24 用 `aiot-toolkit@2.0.5` 编译通过，产出 `com.probe.rw6input.debug.1.0.0.rpk`（16,371 字节）；但未安装、未运行。
- 未进行固件解包、签名绕过或系统修改；报告中的"逆向"建议限定在公开资料与自有设备日志范围内。
- **v1.1 修订（2026-10-24）**：收到"社区有陀螺仪软件"线索后，补充 0.3 反例核查与 B8 运行时源码证据；修正了"M5 加速度计一律不可用"与"陀螺仪绝对无接口"两处过强表述，改为"文档声明 / 源码能力 / 设备开放"三层分列。

---

*报告完（v1.1）。配套工程见 `rpk-input-probe/`；先跑 T2/T3/T6 判断表冠，再跑 T14/T15 判断陀螺仪与真实传感器清单。*
