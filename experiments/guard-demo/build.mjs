#!/usr/bin/env node
/**
 * build.mjs — 构建「守卫页」实验的两个 RPK
 *
 *   guard  : com.klls.guarddemo   / 守卫页     / 栈底守卫页 + 游戏页（深度 2）
 *   flat   : com.klls.guardflat   / 单页对照   / 只有游戏页（深度 1，无 followHand）
 *   flatfh : com.klls.guardflatfh / 单页关跟手 / 只有游戏页（深度 1，followHand=disable）
 *
 * 两个包用的是同一份页面代码，只是路由表不同：
 * 这样才能回答"单页应用右滑到底会不会退出"这个前置问题。
 *
 * 用法：
 *   node experiments/guard-demo/build.mjs
 *   AIOT_TOOLKIT_BIN=/path/to/aiot-toolkit/lib/bin.js node experiments/guard-demo/build.mjs
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
    id: 'guard',
    pkg: 'com.klls.guarddemo',
    appName: '守卫页',
    icon: 'icon-guard.png',
    out: 'guard-demo.rpk',
    twoPages: true
  },
  {
    id: 'flat',
    pkg: 'com.klls.guardflat',
    appName: '单页对照',
    icon: 'icon-flat.png',
    out: 'guard-flat-control.rpk',
    twoPages: false,
    followHand: false
  },
  {
    id: 'flatfh',
    pkg: 'com.klls.guardflatfh',
    appName: '单页关跟手',
    icon: 'icon-block.png',
    out: 'guard-flat-followhand.rpk',
    twoPages: false,
    followHand: true
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
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

  m.package = v.pkg
  m.name = v.appName

  if (v.twoPages) {
    m.router.entry = 'pages/Guard'
    m.router.pages['pages/Guard'] = { component: 'index', path: '/' }
    m.router.pages['pages/Game'] = { component: 'index', path: '/game' }
    delete m.router.pages['pages/Game'].followHand
  } else {
    // 单页对照：游戏页直接作为首页，没有守卫页
    delete m.router.pages['pages/Guard']
    m.router.pages['pages/Game'] = { component: 'index', path: '/' }
    m.router.entry = 'pages/Game'
    if (v.followHand) {
      m.router.pages['pages/Game'].followHand = 'disable'
    } else {
      delete m.router.pages['pages/Game'].followHand
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n', 'utf8')

  if (!v.twoPages) {
    // 单页版没有守卫页，把 Guard 源文件移走，避免被打进包
    const guardDir = path.join(projectDir, 'src', 'pages', 'Guard')
    fs.rmSync(guardDir, { recursive: true, force: true })
  }
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
      throw new Error(`缺少图标：${icon}\n先运行 node experiments/guard-demo/make-icon.mjs`)
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
    results.push({ pkg: v.pkg, name: v.appName, size: fs.statSync(target).size, file: target })
  }

  console.log('')
  console.log('构建完成：')
  for (const r of results) {
    console.log(`  ${r.pkg.padEnd(20)} ${r.name}  ${r.size} B  -> ${r.file}`)
  }
}

main()
