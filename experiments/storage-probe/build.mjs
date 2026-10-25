#!/usr/bin/env node
/**
 * build.mjs — 构建「存档探针」RPK
 *
 * 用法：
 *   node experiments/storage-probe/build.mjs
 *   AIOT_TOOLKIT_BIN=/path/to/aiot-toolkit/lib/bin.js node experiments/storage-probe/build.mjs
 *
 * 产物：data/local/storage-probe.rpk（data/local 已被 .gitignore 忽略）
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const SRC = path.join(HERE, 'src')
const WORK = path.join(HERE, '.build')
const OUT = path.join(ROOT, 'data', 'local')

const PKG = 'com.klls.storeprobe'
const VERSION = '1.0.0'
const OUT_NAME = 'storage-probe.rpk'
const ICON = path.join(HERE, 'assets', 'icon-storage.png')

function toolkitBin() {
  if (process.env.AIOT_TOOLKIT_BIN) {
    return process.env.AIOT_TOOLKIT_BIN
  }
  try {
    return createRequire(import.meta.url).resolve('aiot-toolkit/lib/bin.js')
  } catch (e) {
    throw new Error(
      '找不到 aiot-toolkit。请任选一种方式：\n' +
      '  1) 在工程目录 npm i -D aiot-toolkit\n' +
      '  2) 设置环境变量 AIOT_TOOLKIT_BIN=<path>/aiot-toolkit/lib/bin.js\n'
    )
  }
}

function main() {
  if (!fs.existsSync(ICON)) {
    throw new Error(`缺少图标：${ICON}\n先运行 node experiments/storage-probe/make-icon.mjs`)
  }

  const bin = toolkitBin()

  fs.rmSync(WORK, { recursive: true, force: true })
  fs.mkdirSync(WORK, { recursive: true })
  fs.cpSync(SRC, path.join(WORK, 'src'), { recursive: true })
  fs.copyFileSync(ICON, path.join(WORK, 'src', 'Common', 'icon.png'))

  execFileSync(process.execPath, [bin, 'build'], { cwd: WORK, stdio: 'inherit' })

  const distDir = path.join(WORK, 'dist')
  const rpk = fs.readdirSync(distDir).find((f) => f.endsWith('.rpk'))
  if (!rpk) {
    throw new Error(`构建成功但没有找到 RPK：${distDir}`)
  }

  fs.mkdirSync(OUT, { recursive: true })
  const target = path.join(OUT, OUT_NAME)
  fs.copyFileSync(path.join(distDir, rpk), target)

  console.log('')
  console.log(`构建完成：${PKG} ${VERSION}  ${fs.statSync(target).size} B`)
  console.log(`  -> ${target}`)
}

main()
