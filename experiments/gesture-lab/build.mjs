#!/usr/bin/env node
/**
 * build.mjs — 构建「右滑返回」对照实验的两个 RPK
 *
 * 两个包除 B 页是否带 `followHand: "disable"` 外完全相同：
 *   control : com.klls.glab.ctrl / 手势·对照   / 无字段
 *   follow  : com.klls.glab.fh   / 手势·关跟手 / disable
 *
 * 用法：
 *   node experiments/gesture-lab/build.mjs
 *   AIOT_TOOLKIT_BIN=/path/to/aiot-toolkit/lib/bin.js node experiments/gesture-lab/build.mjs
 *
 * 产物写到 data/local/（该目录已被 .gitignore 忽略）。
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

const VARIANTS = [
  {
    id: 'control',
    pkg: 'com.klls.glab.ctrl',
    appName: '对照',
    followHand: null,
    label: '对照组：B 页无 followHand',
    icon: 'icon-control.png',
    out: 'glab-1-control.rpk'
  },
  {
    id: 'follow',
    pkg: 'com.klls.glab.fh',
    appName: '关跟手',
    followHand: 'disable',
    label: '实验组：followHand = disable',
    icon: 'icon-follow.png',
    out: 'glab-2-followhand.rpk'
  }
]

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

function patch(projectDir, v) {
  const manifestPath = path.join(projectDir, 'src', 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

  manifest.package = v.pkg
  manifest.name = v.appName

  const detail = manifest.router.pages['pages/Detail']
  if (v.followHand) {
    detail.followHand = v.followHand
  } else {
    delete detail.followHand
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  const detailPath = path.join(projectDir, 'src', 'pages', 'Detail', 'index.ux')
  let ux = fs.readFileSync(detailPath, 'utf8')
  ux = ux.replace(/mode: '[^']*'/, `mode: '${v.label}'`)
  fs.writeFileSync(detailPath, ux, 'utf8')
}

function main() {
  const bin = toolkitBin()
  fs.mkdirSync(OUT, { recursive: true })
  fs.mkdirSync(WORK, { recursive: true })

  const results = []

  for (const v of VARIANTS) {
    const dir = path.join(WORK, v.id)
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    fs.cpSync(SRC, path.join(dir, 'src'), { recursive: true })

    const icon = path.join(HERE, 'assets', v.icon)
    if (!fs.existsSync(icon)) {
      throw new Error(`缺少图标：${icon}\n先运行 node experiments/gesture-lab/make-icons.mjs`)
    }
    fs.copyFileSync(icon, path.join(dir, 'src', 'Common', 'icon.png'))

    patch(dir, v)

    execFileSync(process.execPath, [bin, 'build'], { cwd: dir, stdio: 'inherit' })

    const distDir = path.join(dir, 'dist')
    const rpk = fs.readdirSync(distDir).find((f) => f.endsWith('.rpk'))
    if (!rpk) {
      throw new Error(`构建成功但没有找到 RPK：${distDir}`)
    }

    const target = path.join(OUT, v.out)
    fs.copyFileSync(path.join(distDir, rpk), target)

    const size = fs.statSync(target).size
    results.push({ package: v.pkg, name: v.appName, file: target, size })
  }

  console.log('')
  console.log('构建完成：')
  for (const r of results) {
    console.log(`  ${r.package.padEnd(18)} ${r.name}  ${r.size} B  -> ${r.file}`)
  }
}

main()
