/**
 * png-icon.mjs — 生成 192×192 RGB PNG 图标的公共工具
 *
 * 不依赖任何绘图库：手写 PNG（zlib + CRC32），形状用数学判定 + 超采样抗锯齿。
 * 输出规格与 REDMI Watch 6 上已验证的 probe 图标一致：192×192、colortype 2、无 alpha。
 */

import zlib from 'node:zlib'

export const DEFAULT_BG = [0x0a, 0x0a, 0x0c]

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

export function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/**
 * @param {(x:number,y:number)=>boolean} shape 归一化坐标 0..1 的命中判定
 * @param {number[]} fg 前景色 [r,g,b]
 * @param {{size?:number, ss?:number, bg?:number[]}} [opt]
 * @returns {Buffer} RGB 像素
 */
export function renderShape(shape, fg, opt = {}) {
  const size = opt.size ?? 192
  const ss = opt.ss ?? 4
  const bg = opt.bg ?? DEFAULT_BG

  const buf = Buffer.alloc(size * size * 3)
  const step = 1 / ss
  const samples = ss * ss

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px + (sx + 0.5) * step) / size
          const y = (py + (sy + 0.5) * step) / size
          if (shape(x, y)) {
            hits++
          }
        }
      }
      const a = hits / samples
      const o = (py * size + px) * 3
      for (let c = 0; c < 3; c++) {
        buf[o + c] = Math.round(bg[c] * (1 - a) + fg[c] * a)
      }
    }
  }
  return buf
}
