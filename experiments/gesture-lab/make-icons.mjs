#!/usr/bin/env node
/**
 * make-icons.mjs — 生成两个手势实验应用的图标
 *
 * 输出（192×192，RGB，无 alpha，与现有 probe 图标同规格）：
 *   assets/icon-control.png  黑底 + 蓝色向右箭头（对照组）
 *   assets/icon-follow.png   黑底 + 橙色禁止符（实验组 followHand=disable）
 *
 * 选择"颜色 + 轮廓"双重区分：蓝/橙在灰度下亮度也不同，
 * 箭头/禁止符即使在 40px 的表盘图标尺寸下也能分辨。
 *
 * 用法：
 *   node experiments/gesture-lab/make-icons.mjs                 # 192×192
 *   ICON_SIZE=40 node experiments/gesture-lab/make-icons.mjs    # 40px 预览
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng, renderShape } from '../lib/png-icon.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, 'assets')

// ICON_SIZE 可生成小尺寸预览，用来判断表盘图标尺寸下是否还能分辨
const SIZE = Number(process.env.ICON_SIZE || 192)

// ---------- 形状 ----------

function inArrow(x, y) {
  // 向右箭头：横杆 + 三角头，坐标归一化到 0..1
  const shaft = x >= 0.24 && x <= 0.58 && y >= 0.435 && y <= 0.565
  if (shaft) {
    return true
  }
  if (x >= 0.54 && x <= 0.78) {
    // 三角形：底边在 x=0.54，顶点在 x=0.78
    const t = (0.78 - x) / (0.78 - 0.54) // 1 → 底边，0 → 顶点
    const half = 0.2 * t
    return Math.abs(y - 0.5) <= half
  }
  return false
}

function inNoEntry(x, y) {
  const dx = x - 0.5
  const dy = y - 0.5
  const r = Math.hypot(dx, dy)

  // 圆环
  if (r >= 0.195 && r <= 0.295) {
    return true
  }
  // 斜杠：45°，限制在环内
  if (r <= 0.295) {
    const d = Math.abs(dx * Math.SQRT1_2 + dy * Math.SQRT1_2)
    if (d <= 0.05) {
      return true
    }
  }
  return false
}

// ---------- 输出 ----------

function main() {
  fs.mkdirSync(OUT, { recursive: true })

  const icons = [
    {
      file: 'icon-control.png',
      label: '对照组',
      fg: [0x3b, 0x82, 0xf6], // 蓝
      shape: inArrow,
      shapeName: 'right-arrow'
    },
    {
      file: 'icon-follow.png',
      label: '实验组',
      fg: [0xf5, 0x9e, 0x0b], // 橙
      shape: inNoEntry,
      shapeName: 'no-entry'
    }
  ]

  for (const icon of icons) {
    const rgb = renderShape(icon.shape, icon.fg, { size: SIZE })
    const png = encodePng(SIZE, SIZE, rgb)
    const name = SIZE === 192 ? icon.file : `preview-${SIZE}-${icon.file}`
    const target = path.join(OUT, name)
    fs.writeFileSync(target, png)
    console.log(`${name.padEnd(28)}  ${SIZE}x${SIZE}  ${icon.label}  ${icon.shapeName}  ${png.length} B`)
  }
}

main()
