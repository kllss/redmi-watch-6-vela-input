#!/usr/bin/env node
/**
 * make-icon.mjs — 生成守卫页实验的三个图标
 *
 *   assets/icon-guard.png  黑底 + 紫色暂停双竖条（守卫页版，栈深度 2）
 *   assets/icon-flat.png   黑底 + 红色叉（单页对照，无 followHand）
 *   assets/icon-block.png  黑底 + 青色"箭头被挡"（单页 + followHand: disable）
 *
 * 用法：node experiments/guard-demo/make-icon.mjs
 *      ICON_SIZE=40 node experiments/guard-demo/make-icon.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng, renderShape } from '../lib/png-icon.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SIZE = Number(process.env.ICON_SIZE || 192)

function inPause(x, y) {
  if (y < 0.26 || y > 0.74) {
    return false
  }
  return (x >= 0.30 && x <= 0.42) || (x >= 0.58 && x <= 0.70)
}

function inCross(x, y) {
  const dx = x - 0.5
  const dy = y - 0.5
  const r = Math.hypot(dx, dy)
  if (r > 0.32) {
    return false
  }
  const d1 = Math.abs(dx - dy) * Math.SQRT1_2
  const d2 = Math.abs(dx + dy) * Math.SQRT1_2
  return d1 <= 0.075 || d2 <= 0.075
}

function inBlockedArrow(x, y) {
  // 向右箭头（整体左移）+ 右侧一道竖杠 = "右滑被挡住"
  if (x >= 0.16 && x <= 0.46 && y >= 0.44 && y <= 0.56) {
    return true
  }
  if (x >= 0.42 && x <= 0.64) {
    const t = (0.64 - x) / (0.64 - 0.42)
    if (Math.abs(y - 0.5) <= 0.17 * t) {
      return true
    }
  }
  // 竖杠
  if (x >= 0.70 && x <= 0.80 && y >= 0.24 && y <= 0.76) {
    return true
  }
  return false
}

const icons = [
  { file: 'icon-guard.png', fg: [0x8b, 0x5c, 0xf6], shape: inPause, name: 'pause' },
  { file: 'icon-flat.png', fg: [0xef, 0x44, 0x44], shape: inCross, name: 'cross' },
  { file: 'icon-block.png', fg: [0x06, 0xb6, 0xd4], shape: inBlockedArrow, name: 'blocked-arrow' }
]

const outDir = path.join(HERE, 'assets')
fs.mkdirSync(outDir, { recursive: true })

for (const icon of icons) {
  const rgb = renderShape(icon.shape, icon.fg, { size: SIZE })
  const png = encodePng(SIZE, SIZE, rgb)
  const out = SIZE === 192 ? icon.file : `preview-${SIZE}-${icon.file}`
  fs.writeFileSync(path.join(outDir, out), png)
  console.log(`${out.padEnd(24)}  ${SIZE}x${SIZE}  ${icon.name}  ${png.length} B`)
}
