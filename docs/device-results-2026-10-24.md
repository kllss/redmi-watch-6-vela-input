# REDMI Watch 6 实机结果（2026-10-24，四轮）

- 设备：REDMI Watch 6（`device.getInfo` 返回占位值 `brand=Vela / model=ap / os=0.0.0 / API=2`）
- 探针：`com.probe.rw6input` v1.1 → v1.2 → v1.3 → v1.4（`probe2~5.rpk`）
- 侧载：AstroBox 2.2.0 / 蓝牙 SPP

## 1. 最后一轮原始读数（v1.4）

```
1  DEV   ap A2
2  GYRO  NOFN
3  ACC   OK24
4  COMP  OK66
5  LIGHT NOFN
6  STEP  NOFN
7  HLTH  K2
8  VIB   OK/S0
9  CROWN t51 d-160
10 BACK  N
11 CAN   s1v1e1
12 DTYPE NO

D1 brand=Vela model=ap os=0.0.0 API=2 432x514 rect watch
D2 DTYPES=none
D3 HEALTH=DATA_TYPES,isAvailable
D4 ACC n=24 hz=11.4 first=1.87,7.58,5.85 last=-7.66,1.74,5.91
D5 COMP n=66 first=0.00 last=0.07 acc=1 range=0.0..0.10739228701562500
D6 VIB start=undefined default=undefined
D7 CROWN up=0 down=-160 1st=-1 n=51
D8 GYRO n=0 LIGHT n=0
D9 HTYPES=HEART_RATE avail=—
```

## 2. 四轮对照

| 项目 | v1.1 | v1.2 | v1.3 | v1.4 | 结论 |
|---|---|---|---|---|---|
| 陀螺仪 | `NOFN` | — | `NOFN` | `NOFN` | 不存在（结案） |
| 加速度计 | `OK9` | 未跑 | `OK35` | `OK24` | **真实可用** |
| 地磁 | `OK41` | 未跑 | `OK68` | `OK66`，值域 0~6° | 不跟手，不可用 |
| 环境光 | `NOFN` | — | `NOFN` | `NOFN` | 不存在 |
| 计步 | `NOFN` | — | `NOFN` | `NOFN` | 不存在 |
| health | `K2` | — | `DATA_TYPES,isAvailable` | `HTYPES=HEART_RATE` | 有类型、无读法 |
| 振动 | `OK/S0` | — | `OK/S0` | `OK/S0` | 两档 |
| 表冠 | `t88 d-800` | `t45/65` | `t20 1st=-640` | `t51 d=-160 1st=-1` | **3.1px/事件** |
| 返回键 | `N` | `N` | `N` | `N` | **四轮全部未响应** |
| DATA_TYPES | `NO` | `none` | `NO` | `NO` | 不存在 |

## 3. 加速度计（三轮一致，结论最硬）

| 轮次 | n | hz | first | last | 模长 |
|---|---|---|---|---|---|
| v1.1 | 9 | — | — | — | — |
| v1.3 | 35 | 11.2 | 4.86,7.55,8.10 | -7.07,0.29,6.52 | 12.09 / 9.62 |
| v1.4 | 24 | 11.4 | 1.87,7.58,5.85 | -7.66,1.74,5.91 | 9.76 / 9.83 |

- v1.4 两组模长 9.76 / 9.83，几乎正好是重力加速度 —— 静置姿势下的真实读数；
- 三轴数值逐次变化，**不是桩、不是全 0、不是冻结值**；
- 采样率稳定在 **11 Hz 左右**（约 90 ms 一帧）。

**官方支持表把 RW6 列为"不支持加速度计"是错的。**

## 4. 罗盘：不是纯桩，但没用

v1.3 看到 `first=0.00 last=0.00`，我判成"桩"。v1.4 加了 `range` 后修正：

```
range = 0.0 ~ 0.1074 rad  （≈ 0 ~ 6.2°）
```

- 值确实会变，**所以不是硬编码 0 的桩**；
- 但 66 次采样总共只浮动 6°，手腕怎么动都不跟手；
- 更像**未校准的占位数据**或极低分辨率的朝向。

**结论：不能用于朝向/罗盘玩法，但措辞从"桩"改为"不跟手"。**

## 5. 表冠：步长算出来了

```
D7 CROWN up=0 down=-160 1st=-1 n=51
```

- 首帧 `1st=-1` 被当基线丢弃（v1.3 的 `1st=-640` 是基线 bug，已修）；
- 51 次事件累计 −160 px → **约 3.1 px/事件**；
- 事件非常密集：转一格会连续产生多个事件。

**做菜单时不要"一事件一翻页"，要累加到阈值（建议 24 px）再翻一项。** 四轮观察到的 dy 全是负值，反向符号始终没捕获到——菜单只用绝对值即可，不影响使用。

## 6. 返回键：四轮全部无响应

v1.1 / v1.3 / v1.4 全部 `BACK N`（v1.2 无有效数据）。

**判定：RW6 不向 RPK 派发 `onBackPress`（或该键不映射为返回）。游戏的暂停/退出必须走屏内按钮。**

## 7. health：有心率类型，但没有读法

```
D3 HEALTH=DATA_TYPES,isAvailable
D9 HTYPES=HEART_RATE avail=—
```

- `health.DATA_TYPES` 里确实有 `HEART_RATE`，说明模块知道这个数据类型；
- `avail=—` 说明 `isAvailable` 虽然出现在 `Object.keys` 里，但 `typeof` 不是 `function`（可能是布尔标志或对象）；
- 整个模块只暴露两个键，**没有任何读取方法**。

**结论：心率目前无可用读接口。** 除非后续在固件里找到别的方法名，否则心率玩法不成立。

## 8. 定稿

四轮下来，可确定的输入能力就是三样：

| 通道 | 状态 |
|---|---|
| 触屏 | ✅ |
| 表冠滚动 | ✅ 3.1 px/事件，累加 24 px 翻一项 |
| 加速度计 | ✅ 真实，约 11 Hz |
| 振动 | ✅ 两档 |
| 返回键 | ❌ |
| 陀螺仪 / 罗盘 / 计步 / 环境光 / 心率 | ❌ |

无需再跑探针；方案已可开工。
