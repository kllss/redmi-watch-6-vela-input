#!/usr/bin/env node
/**
 * make-icon.mjs — 生成「存档探针」图标：黑底 + 绿色向下箭头（落盘）
 *
 * 用法：node experiments/storage-probe/make-icon.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng, renderShape } from '../lib/png-icon.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SIZE = Number(process.env.ICON_SIZE || 192)

function inSave(x, y) {
  // 竖杆
  if (x >= 0.44 && x <= 0.56 && y >= 0.20 && y <= 0.50) {
    return true
  }
  // 向下三角头
  if (y >= 0.48 && y <= 0.66) {
    const t = (0.66 - y) / 0.18 // 1 → 底边，0 → 顶点
    if (Math.abs(x - 0.5) <= 0.17 * t) {
      return true
    }
  }
  // 底部托盘
  if (x >= 0.26 && x <= 0.74 && y >= 0.72 && y <= 0.80) {
    return true
  }
  return false
}

const fg = [0x22, 0xc5, 0x5e] // 绿
const rgb = renderShape(inSave, fg, { size: SIZE })
const png = encodePng(SIZE, SIZE, rgb)

const name = SIZE === 192 ? 'icon-storage.png' : `preview-${SIZE}-icon-storage.png`
const outDir = path.join(HERE, 'assets')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, name), png)
console.log(`${name}  ${SIZE}x${SIZE}  save-arrow  ${png.length} B`)
