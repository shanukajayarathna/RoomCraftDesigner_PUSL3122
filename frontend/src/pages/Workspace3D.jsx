import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi, useDesignStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { ChevronLeft, Save, RotateCcw, Layers, Sun, Grid3X3, Box } from 'lucide-react'

const GRID2D = 50
const OX2D   = 80
const OY2D   = 70

const CAT_COLOR = {
  Seating:'#93b4fd', Tables:'#6ee7b7', Bedroom:'#fca5a5',
  Storage:'#d8b4fe', Office:'#fcd34d', Lighting:'#fdba74',
  Bathroom:'#a5f3fc', Kitchen:'#bbf7d0', 'Living Room':'#bfdbfe', Decor:'#f9a8d4',
  Custom:'#c4b5fd',
}

const hex2color = (T, h) => {
  const n = parseInt((h || '#aaaaaa').replace('#', ''), 16)
  return new T.Color((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255)
}

function roomDims(cfg) {
  const W = cfg.width || 5, D = cfg.depth || 4, H = cfg.height || 2.8
  if (cfg.shape === 'l-shape') { const cw = W * 0.6, cd = D * 0.55; return { W, D, H, shape: 'l-shape', cw, cd } }
  if (cfg.shape === 'square') { const S = Math.min(W, D); return { W: S, D: S, H, shape: 'square' } }
  return { W, D, H, shape: 'rectangle' }
}

function wallSegments(dims) {
  const { W, D, shape, cw, cd } = dims
  if (shape === 'l-shape') return [
    { x1: 0, z1: 0, x2: W, z2: 0 },
    { x1: W, z1: 0, x2: W, z2: cd },
    { x1: W, z1: cd, x2: cw, z2: cd },
    { x1: cw, z1: cd, x2: cw, z2: D },
    { x1: cw, z1: D, x2: 0, z2: D },
    { x1: 0, z1: D, x2: 0, z2: 0 },
  ]
  return [
    { x1: 0, z1: 0, x2: W, z2: 0 },
    { x1: W, z1: 0, x2: W, z2: D },
    { x1: W, z1: D, x2: 0, z2: D },
    { x1: 0, z1: D, x2: 0, z2: 0 },
  ]
}

/**
 * Build a floor (or ceiling) mesh using PlaneGeometry.
 * PlaneGeometry is trivial to position — no ShapeGeometry rotation math issues.
 *
 * Walls span x:[0,W] z:[0,D].
 * PlaneGeometry(W, D) after rotateX(-PI/2) is centred at origin.
 * Setting mesh.position to (W/2, y, D/2) aligns it perfectly with the walls.
 *
 * For L-shapes we tile two PlaneGeometry rectangles.
 */
function buildFloorOrCeiling(T, dims, material, yPos) {
  const { W, D, shape, cw, cd } = dims

  const makePlane = (pw, pd, cx, cz) => {
    const geo = new T.PlaneGeometry(pw, pd)
    geo.rotateX(-Math.PI / 2)
    const mesh = new T.Mesh(geo, material)
    mesh.position.set(cx, yPos, cz)
    mesh.receiveShadow = true
    return mesh
  }

  if (shape === 'l-shape') {
    const group = new T.Group()
    // Rect 1: top portion — full width W, depth cd  (z: 0 → cd)
    group.add(makePlane(W, cd, W / 2, cd / 2))
    // Rect 2: bottom-left portion — width cw, depth (D-cd)  (z: cd → D)
    group.add(makePlane(cw, D - cd, cw / 2, cd + (D - cd) / 2))
    return group
  }

  // Rectangle or square: one plane
  return makePlane(W, D, W / 2, D / 2)
}

function buildRoom(T, cfg, opts = {}) {
  const { wallMode = 'solid', showCeiling = false, showShadows = true, showGrid = false } = opts
  const dims = roomDims(cfg)
  const { W, D, H } = dims
  const group = new T.Group(); group.name = 'room'

  // --- Floor ---
  const ft = cfg.floorTexture || 'wood'
  const floorTex =
    ft === 'wood' ? woodTex(T)
      : ft === 'carpet' ? fabricTex(T, '#7a6a88')
        : ft === 'tile' ? tileTex(T)
          : ft === 'marble' ? marbleTex(T)
            : concreteTex(T)
  // Repeats: ~1m tiles/planks feel right; clamp to avoid huge repeats.
  floorTex.repeat.set(Math.max(1, Math.min(12, W * 1.2)), Math.max(1, Math.min(12, D * 1.2)))
  floorTex.anisotropy = 8
  const floorMat = new T.MeshStandardMaterial({
    map: floorTex,
    color: 0xffffff,
    roughness: ft === 'marble' ? 0.12 : ft === 'tile' ? 0.35 : ft === 'wood' ? 0.78 : 0.95,
    metalness: ft === 'marble' ? 0.08 : 0,
  })
  // Reduce z-fighting with furniture bottoms and overlay indicators.
  floorMat.polygonOffset = true
  floorMat.polygonOffsetFactor = 1
  floorMat.polygonOffsetUnits = 1
  const floorMesh = buildFloorOrCeiling(T, dims, floorMat, 0)
  floorMesh.name = 'floor'
  group.add(floorMesh)

  // --- Grid ---
  if (showGrid) {
    const gh = new T.GridHelper(Math.max(W, D) * 1.5, 24, 0x555577, 0x333355)
    gh.position.set(W / 2, 0.003, D / 2); gh.name = 'floorGrid'; group.add(gh)
  }

  // --- Ceiling ---
  if (showCeiling) {
    const ceilMat = new T.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.95, side: T.DoubleSide })
    const ceilMesh = buildFloorOrCeiling(T, dims, ceilMat, H)
    ceilMesh.name = 'ceiling'
    group.add(ceilMesh)
  }

  // --- Walls ---
  const wThick = 0.12
  const opacity = wallMode === 'solid' ? 1 : wallMode === 'transparent' ? 0.3 : wallMode === 'glass' ? 0.1 : 0
  const wallColor = wallMode === 'glass' ? new T.Color(0.55, 0.78, 1) : hex2color(T, cfg.wallColor || '#F5F5F0')
  const wallTex = plasterTex(T)
  const wallMat = new T.MeshStandardMaterial({
    map: wallMode === 'solid' ? wallTex : null,
    color: wallColor,
    roughness: wallMode === 'glass' ? 0.05 : 0.86,
    metalness: wallMode === 'glass' ? 0.15 : 0,
    transparent: wallMode !== 'solid', opacity, side: T.DoubleSide,
  })

  wallSegments(dims).forEach((seg, idx) => {
    const dx = seg.x2 - seg.x1, dz = seg.z2 - seg.z1
    const len = Math.sqrt(dx * dx + dz * dz); if (len < 0.001) return
    // Extend walls slightly so corners overlap (prevents visible gaps).
    const overlap = wThick * 0.95
    const geo = new T.BoxGeometry(len + overlap, H, wThick)
    const mat = wallMat.clone()
    if (mat.map) {
      mat.map = mat.map.clone()
      mat.map.wrapS = mat.map.wrapT = T.RepeatWrapping
      // Horizontal repeat based on wall length, vertical based on height.
      mat.map.repeat.set(Math.max(1, Math.min(12, len * 1.4)), Math.max(1, Math.min(8, H * 1.2)))
      mat.map.needsUpdate = true
    }
    const mesh = new T.Mesh(geo, mat)
    mesh.position.set((seg.x1 + seg.x2) / 2, H / 2, (seg.z1 + seg.z2) / 2)
    mesh.rotation.y = Math.atan2(dz, dx)
    mesh.castShadow = showShadows && wallMode === 'solid'; mesh.receiveShadow = true
    mesh.name = `wall_${idx}`; group.add(mesh)

    if (wallMode === 'solid' || wallMode === 'transparent') {
      const skMat = new T.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.9 })
      const sk = new T.Mesh(new T.BoxGeometry(len, 0.09, wThick + 0.002), skMat)
      sk.position.set((seg.x1 + seg.x2) / 2, 0.045, (seg.z1 + seg.z2) / 2)
      sk.rotation.y = Math.atan2(dz, dx); group.add(sk)
    }
  })

  return group
}

// ── Procedural texture helpers ──────────────────────────────────────────────
function makeCanvasTexture(T, size, drawFn) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  drawFn(canvas.getContext('2d'), size)
  const tex = new T.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = T.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

function woodTex(T) {
  return makeCanvasTexture(T, 512, (ctx, s) => {
    // Rich warm-oak base
    const g = ctx.createLinearGradient(0, 0, s * 0.7, s)
    g.addColorStop(0,   '#c8a05a')
    g.addColorStop(0.3, '#b07838')
    g.addColorStop(0.6, '#c89858')
    g.addColorStop(1,   '#b87840')
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s)
 
    // Primary grain lines (long, sweeping)
    for (let i = 0; i < 60; i++) {
      const y = i * (s / 55) + (Math.random() - 0.5) * 9
      const alpha = Math.random() * 0.2 + 0.04
      ctx.strokeStyle = `rgba(65,30,8,${alpha})`
      ctx.lineWidth = Math.random() * 1.8 + 0.25
      ctx.beginPath(); ctx.moveTo(0, y)
      ctx.bezierCurveTo(s*0.22, y+(Math.random()*14-7), s*0.72, y+(Math.random()*14-7), s, y+(Math.random()*9-4.5))
      ctx.stroke()
    }
 
    // Fine secondary grain (darker)
    for (let i = 0; i < 30; i++) {
      const y = Math.random() * s
      ctx.strokeStyle = `rgba(45,18,4,${Math.random()*0.1+0.02})`
      ctx.lineWidth = Math.random() * 0.7 + 0.15
      ctx.beginPath(); ctx.moveTo(0, y)
      ctx.bezierCurveTo(s*0.3, y+(Math.random()*8-4), s*0.7, y+(Math.random()*8-4), s, y+(Math.random()*5-2.5))
      ctx.stroke()
    }
 
    // Annual ring knots (2-3)
    for (let k = 0; k < 3; k++) {
      const kx = (0.15 + Math.random()*0.7)*s, ky = (0.15 + Math.random()*0.7)*s
      const oval = 0.55 + Math.random()*0.3
      const tilt = Math.random()*0.5
      for (let r = 2; r < 35; r += 4 + Math.random()*2) {
        ctx.strokeStyle = `rgba(55,24,6,${0.05+Math.random()*0.09})`
        ctx.lineWidth = 0.6
        ctx.beginPath(); ctx.ellipse(kx, ky, r, r*oval, tilt, 0, Math.PI*2); ctx.stroke()
      }
    }
 
    // Light planing streaks
    for (let i = 0; i < 16; i++) {
      const x = Math.random()*s
      ctx.strokeStyle = `rgba(225,188,112,${Math.random()*0.14})`
      ctx.lineWidth = 0.6
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x+(Math.random()*14-7), s); ctx.stroke()
    }
 
    // Glossy sheen
    const sg = ctx.createLinearGradient(0, 0, s*0.7, s*0.4)
    sg.addColorStop(0,   'rgba(255,255,255,0.09)')
    sg.addColorStop(0.4, 'rgba(255,255,255,0.18)')
    sg.addColorStop(1,   'rgba(255,255,255,0.02)')
    ctx.fillStyle = sg; ctx.fillRect(0, 0, s, s)
  })
}
 
function fabricTex(T, hexColor) {
  return makeCanvasTexture(T, 256, (ctx, s) => {
    const n = parseInt((hexColor||'#93b4fd').replace('#',''), 16)
    const r = (n >> 16 & 255), g = (n >> 8 & 255), b = (n & 255)
    ctx.fillStyle = hexColor||'#93b4fd'; ctx.fillRect(0, 0, s, s)
 
    // Warp threads (vertical — slightly darker)
    for (let i = 0; i < s; i += 3) {
      const a = Math.random()*0.18 + 0.03
      ctx.fillStyle = `rgba(${Math.max(0,r-38)},${Math.max(0,g-38)},${Math.max(0,b-38)},${a})`
      ctx.fillRect(i, 0, 1.5, s)
    }
    // Weft threads (horizontal — lighter)
    for (let i = 0; i < s; i += 3) {
      const a = Math.random()*0.14 + 0.02
      ctx.fillStyle = `rgba(${Math.min(255,r+32)},${Math.min(255,g+32)},${Math.min(255,b+32)},${a})`
      ctx.fillRect(0, i, s, 1.5)
    }
    // Inter-weave texture noise
    for (let i = 0; i < 1000; i++) {
      const fx = Math.random()*s, fy = Math.random()*s
      const dv = Math.random() > 0.5 ? 28 : -28
      ctx.fillStyle = `rgba(${Math.max(0,Math.min(255,r+dv))},${g},${b},0.03)`
      ctx.fillRect(fx, fy, 1, 1)
    }
    // Subtle pilling bumps
    for (let i = 0; i < 80; i++) {
      const px = Math.random()*s, py = Math.random()*s
      ctx.fillStyle = `rgba(${r},${g},${b},0.08)`
      ctx.beginPath(); ctx.arc(px, py, Math.random()*1.5+0.5, 0, Math.PI*2); ctx.fill()
    }
    // Final sheen
    const sg = ctx.createLinearGradient(0, 0, s, s)
    sg.addColorStop(0, 'rgba(255,255,255,0.07)'); sg.addColorStop(1, 'rgba(255,255,255,0.02)')
    ctx.fillStyle = sg; ctx.fillRect(0, 0, s, s)
  })
}
 
function marbleTex(T) {
  return makeCanvasTexture(T, 512, (ctx, s) => {
    // Warm off-white base with subtle gradient
    const g = ctx.createLinearGradient(0, 0, s, s)
    g.addColorStop(0, '#eee9e2'); g.addColorStop(0.4, '#f4f0ea'); g.addColorStop(1, '#e8e4de')
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s)
 
    // Deep veins (3 passes: thick main → medium → hairline)
    const passes = [
      { count:4,  thick:3.0,  alpha:0.24 },
      { count:8,  thick:1.4,  alpha:0.15 },
      { count:18, thick:0.45, alpha:0.08 },
    ]
    for (const pass of passes) {
      for (let i = 0; i < pass.count; i++) {
        ctx.strokeStyle = `rgba(148,128,100,${pass.alpha + Math.random()*0.09})`
        ctx.lineWidth = pass.thick * (Math.random()*0.65+0.65)
        ctx.beginPath()
        let x = Math.random()*s, y = Math.random()*s
        ctx.moveTo(x, y)
        for (let j = 0; j < 5; j++) {
          x += (Math.random()-0.44)*s*0.36
          y += (Math.random()-0.44)*s*0.36
          ctx.bezierCurveTo(x+(Math.random()-0.5)*72, y+(Math.random()-0.5)*72,
                            x+(Math.random()-0.5)*48, y+(Math.random()-0.5)*48, x, y)
        }
        ctx.stroke()
      }
    }
    // Grey accent veins
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(100,90,82,${0.08+Math.random()*0.06})`
      ctx.lineWidth = 0.6 + Math.random()*0.8
      ctx.beginPath()
      let x = Math.random()*s, y = Math.random()*s; ctx.moveTo(x, y)
      for (let j = 0; j < 4; j++) {
        x += (Math.random()-0.45)*s*0.4; y += (Math.random()-0.45)*s*0.4
        ctx.bezierCurveTo(x+(Math.random()-0.5)*55, y+(Math.random()-0.5)*55, x, y, x, y)
      }
      ctx.stroke()
    }
    // Crystal sheen patches (realistic marble sparkle)
    for (let i = 0; i < 8; i++) {
      const gx = Math.random()*s, gy = Math.random()*s
      const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, 50+Math.random()*80)
      rg.addColorStop(0, 'rgba(255,255,255,0.16)'); rg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = rg; ctx.fillRect(0, 0, s, s)
    }
  })
}
 
function metalTex(T) {
  return makeCanvasTexture(T, 256, (ctx, s) => {
    ctx.fillStyle = '#b8b8b4'; ctx.fillRect(0, 0, s, s)
    // Directional brushing (horizontal)
    for (let i = 0; i < 100; i++) {
      const y = i*(s/96)
      const l = (135+Math.random()*65)|0
      ctx.strokeStyle = `rgba(${l},${l},${l},${Math.random()*0.38+0.04})`
      ctx.lineWidth = Math.random()*1.5+0.2
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y+(Math.random()*2-1)); ctx.stroke()
    }
    // Specular highlight band
    const hg = ctx.createLinearGradient(s*0.25, 0, s*0.75, 0)
    hg.addColorStop(0,   'rgba(255,255,255,0)')
    hg.addColorStop(0.5, 'rgba(255,255,255,0.28)')
    hg.addColorStop(1,   'rgba(255,255,255,0)')
    ctx.fillStyle = hg; ctx.fillRect(0, 0, s, s)
    // Edge vignette
    const vg = ctx.createLinearGradient(0, 0, 0, s)
    vg.addColorStop(0,   'rgba(0,0,0,0.12)')
    vg.addColorStop(0.5, 'rgba(0,0,0,0)')
    vg.addColorStop(1,   'rgba(0,0,0,0.12)')
    ctx.fillStyle = vg; ctx.fillRect(0, 0, s, s)
    // Fine scratches
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${Math.random()*0.12})`
      ctx.lineWidth = 0.3
      const sy = Math.random()*s
      ctx.beginPath(); ctx.moveTo(Math.random()*s*0.3, sy); ctx.lineTo(s-Math.random()*s*0.3, sy+(Math.random()*3-1.5)); ctx.stroke()
    }
  })
}
 
function concreteTex(T) {
  return makeCanvasTexture(T, 256, (ctx, s) => {
    ctx.fillStyle = '#989894'; ctx.fillRect(0, 0, s, s)
    // Aggregate speckle (varied size)
    for (let i = 0; i < 1600; i++) {
      const x = Math.random()*s, y = Math.random()*s
      const r = Math.random()*2.6+0.2
      const v = (75+Math.random()*88)|0
      ctx.fillStyle = `rgba(${v},${v},${v-4},${Math.random()*0.3+0.04})`
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill()
    }
    // Coarse aggregate (larger, sparser)
    for (let i = 0; i < 120; i++) {
      const x = Math.random()*s, y = Math.random()*s
      const r = Math.random()*4+1.5
      const v = (68+Math.random()*40)|0
      ctx.fillStyle = `rgba(${v},${v},${v},${Math.random()*0.15+0.03})`
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill()
    }
    // Trowel smear marks
    for (let i = 0; i < 25; i++) {
      ctx.strokeStyle = `rgba(185,185,182,${Math.random()*0.12})`
      ctx.lineWidth = Math.random()*5+0.8
      ctx.beginPath(); ctx.moveTo(Math.random()*s, Math.random()*s)
      ctx.lineTo(Math.random()*s, Math.random()*s); ctx.stroke()
    }
    // Control joints
    ctx.strokeStyle = 'rgba(60,60,58,0.3)'; ctx.lineWidth = 1.8
    for (const x of [s/3, s*2/3]) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,s); ctx.stroke() }
    for (const y of [s/3, s*2/3]) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(s,y); ctx.stroke() }
  })
}
 
function tileTex(T) {
  return makeCanvasTexture(T, 256, (ctx, s) => {
    ctx.fillStyle = '#e2e0dc'; ctx.fillRect(0, 0, s, s)
    const ts = 64
    for (let tx = 0; tx < s; tx += ts) {
      for (let ty = 0; ty < s; ty += ts) {
        // Tile base with colour variation
        const v = (Math.random()*22-11)|0
        const base = 226+v
        ctx.fillStyle = `rgb(${base},${base-1},${base-3})`
        ctx.fillRect(tx+2, ty+2, ts-4, ts-4)
        // Gloss gradient
        const tg = ctx.createLinearGradient(tx, ty, tx+ts, ty+ts)
        tg.addColorStop(0, 'rgba(255,255,255,0.22)'); tg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = tg; ctx.fillRect(tx+2, ty+2, ts-4, ts-4)
        // Subtle edge shadow (gives depth)
        ctx.fillStyle = 'rgba(0,0,0,0.06)'
        ctx.fillRect(tx+ts-5, ty+2, 3, ts-4)  // right
        ctx.fillRect(tx+2, ty+ts-5, ts-4, 3)  // bottom
        // Surface micro-texture
        for (let m = 0; m < 6; m++) {
          ctx.fillStyle = `rgba(${base+Math.round(Math.random()*8-4)},${base},${base},0.08)`
          ctx.fillRect(tx+3+Math.random()*(ts-8), ty+3+Math.random()*(ts-8), 2, 2)
        }
      }
    }
    // Grout lines
    ctx.fillStyle = '#a6a6a2'
    for (let tx = 0; tx < s; tx += ts) ctx.fillRect(tx, 0, 2, s)
    for (let ty = 0; ty < s; ty += ts) ctx.fillRect(0, ty, s, 2)
    // Grout highlight (light edge)
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    for (let tx = 0; tx < s; tx += ts) ctx.fillRect(tx+1, 0, 1, s)
    for (let ty = 0; ty < s; ty += ts) ctx.fillRect(0, ty+1, s, 1)
  })
}
 
function plasterTex(T) {
  return makeCanvasTexture(T, 512, (ctx, s) => {
    // Warm off-white base
    const g = ctx.createLinearGradient(0, 0, s, s)
    g.addColorStop(0, '#f7f4ec'); g.addColorStop(1, '#ede9e0')
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s)
 
    // Fine grain (plaster surface)
    for (let i = 0; i < 4500; i++) {
      const x = Math.random()*s, y = Math.random()*s
      ctx.fillStyle = `rgba(108,98,85,${Math.random()*0.07})`
      ctx.beginPath(); ctx.arc(x, y, Math.random()*1.4+0.1, 0, Math.PI*2); ctx.fill()
    }
    // Coarser aggregate
    for (let i = 0; i < 400; i++) {
      const x = Math.random()*s, y = Math.random()*s
      ctx.fillStyle = `rgba(90,80,68,${Math.random()*0.05})`
      ctx.beginPath(); ctx.arc(x, y, Math.random()*3+0.8, 0, Math.PI*2); ctx.fill()
    }
    // Trowel strokes (flowing)
    for (let i = 0; i < 32; i++) {
      ctx.strokeStyle = `rgba(95,85,72,${Math.random()*0.055})`
      ctx.lineWidth = Math.random()*3.5+0.8
      const y = (i/32)*s + (Math.random()*14-7)
      ctx.beginPath(); ctx.moveTo(0, y)
      ctx.bezierCurveTo(s*0.28, y+(Math.random()*28-14), s*0.72, y+(Math.random()*28-14), s, y+(Math.random()*18-9))
      ctx.stroke()
    }
    // Sub-surface light scatter (warm SSS feel)
    const rg1 = ctx.createRadialGradient(s*0.35, s*0.3, 0, s*0.35, s*0.3, s*0.65)
    rg1.addColorStop(0, 'rgba(255,248,235,0.14)'); rg1.addColorStop(1, 'rgba(255,248,235,0)')
    ctx.fillStyle = rg1; ctx.fillRect(0, 0, s, s)
    const rg2 = ctx.createRadialGradient(s*0.7, s*0.75, 0, s*0.7, s*0.75, s*0.5)
    rg2.addColorStop(0, 'rgba(235,225,215,0.1)'); rg2.addColorStop(1, 'rgba(235,225,215,0)')
    ctx.fillStyle = rg2; ctx.fillRect(0, 0, s, s)
  })
}

function buildFurnitureMesh(T, item) {
  const group = new T.Group(); group.userData.itemId = item.id
  const wM = item.widthM || (item.w / GRID2D)
  const dM = item.depthM || (item.d / GRID2D)
  const hM = item.heightM || 0.8
  const hexColor = item.color || CAT_COLOR[item.category] || '#93b4fd'
  const col = hex2color(T, hexColor)
  const EPS = 0.003

  // ── Shared material helpers ──────────────────────────────────────
  const mkStd = (opts) => {
    const m = new T.MeshStandardMaterial(opts)
    m.dithering = true
    m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1
    return m
  }

  const mkWood = (tint = '#b87c4c', rough = 0.75) => {
    const tex = woodTex(T); tex.repeat.set(2, 2)
    return mkStd({ map: tex, color: hex2color(T, tint), roughness: rough, metalness: 0 })
  }
  const mkFabric = (hex, rough = 0.92) => {
    const tex = fabricTex(T, hex); tex.repeat.set(4, 4)
    const mat = mkStd({ map: tex, roughness: rough, metalness: 0 })
    // Sheen for fabric microfiber look
    mat.envMapIntensity = 0.15
    return mat
  }
  const mkMetal = (color = 0x999999, rough = 0.25, metal = 0.85) =>
    mkStd({ color, roughness: rough, metalness: metal })
  const mkGlass = (color = 0x88bbff, op = 0.35) =>
    mkStd({ color, roughness: 0.04, metalness: 0.1, transparent: true, opacity: op, side: T.DoubleSide })
  const mkCeramic = (color = 0xf5f8fc) =>
    mkStd({ color, roughness: 0.08, metalness: 0.04 })
  const mkPaint = (color, rough = 0.7) => mkStd({ color, roughness: rough, metalness: 0 })

  const metalMat = mkMetal(0x909090)
  const chromeMat = mkMetal(0xcccccc, 0.12, 0.95)

  // Geometry helpers
  const safe = v => Math.max(0.002, v)
  const addMesh = (geo, mat, px, py, pz, rx = 0, ry = 0, rz = 0) => {
    const m = new T.Mesh(geo, mat)
    m.position.set(px, py + EPS, pz)
    m.rotation.set(rx, ry, rz)
    m.castShadow = true; m.receiveShadow = true
    group.add(m)
    // Subtle edge lines for crisp definition
    const eg = new T.EdgesGeometry(geo, 25)
    const el = new T.LineSegments(eg, new T.LineBasicMaterial({ color: 0x060c1a, transparent: true, opacity: 0.1 }))
    el.position.copy(m.position); el.rotation.copy(m.rotation)
    group.add(el)
    return m
  }
  const box = (w, h, d, mat, px, py, pz, rx, ry, rz) =>
    addMesh(new T.BoxGeometry(safe(w), safe(h), safe(d)), mat, px, py, pz, rx, ry, rz)
  const cyl = (rt, rb, h, segs, mat, px, py, pz, rx = 0, ry = 0, rz = 0) =>
    addMesh(new T.CylinderGeometry(rt, rb, h, segs), mat, px, py, pz, rx, ry, rz)
  const sph = (r, mat, px, py, pz) =>
    addMesh(new T.SphereGeometry(r, 14, 10), mat, px, py, pz)

  const legs4 = (fw, fd, lh, lr, mat, yOff = 0) => {
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]])
      cyl(lr, lr * 1.15, lh, 10, mat, sx * (fw / 2 - lr * 1.4), yOff + lh / 2, sz * (fd / 2 - lr * 1.4))
  }

  const name = (item.name || item.label || '').toLowerCase()

  switch (item.category) {

    // ══════════════════════════════════════════════════════════════
    case 'Seating': {
      const isSofa = name.includes('sofa') || name.includes('couch') || wM > 1.4
      const isChair = !isSofa

      const fabricMat = mkFabric(hexColor)
      const darkFabric = mkFabric(hexColor, 0.98)
      darkFabric.color = col.clone().multiplyScalar(0.48)
      const pipingMat = mkStd({ color: col.clone().multiplyScalar(0.38), roughness: 0.88 })
      const legMat = mkMetal(0x3a3a3a, 0.35, 0.75)
      const legWoodMat = mkWood('#3a2010', 0.88)

      const seatH  = hM * 0.44
      const seatD  = dM * 0.56
      const backH  = hM - seatH
      const armW   = wM * 0.09
      const baseH  = seatH * 0.13

      // ── Plinth / base ──
      box(wM, baseH, dM, mkStd({ color: 0x111111, roughness: 0.95 }), 0, baseH / 2, 0)
      // Toe kick shadow strip
      box(wM - 0.02, 0.01, dM - 0.02, mkStd({ color: 0x080808, roughness: 1 }), 0, baseH + 0.005, 0)

      // ── Legs ──
      const useMetal = name.includes('modern') || name.includes('metal')
      const chosenLegMat = useMetal ? legMat : legWoodMat
      const legH = seatH * 0.22
      const legR = 0.028
      for (const [sx, sz] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        // Tapered leg: wider top, narrow bottom
        cyl(legR * 1.1, legR * 0.65, legH, 10, chosenLegMat,
          sx*(wM/2 - armW*0.55), baseH + legH/2, sz*(seatD/2 - 0.055))
        // Foot cap
        cyl(legR*0.9, legR*1.1, 0.012, 10, mkMetal(0x222222, 0.5, 0.6),
          sx*(wM/2 - armW*0.55), baseH + legH + 0.006, sz*(seatD/2 - 0.055))
      }
      if (isSofa) {
        // Centre support leg(s)
        cyl(legR, legR*0.7, legH, 10, chosenLegMat, 0, baseH + legH/2, 0)
      }

      // ── Seat cushion(s) ──
      const numCushions = isSofa ? Math.max(2, Math.round(wM / 0.65)) : 1
      const cushW = (wM - armW*2 - 0.008*(numCushions-1)) / numCushions
      const cushH = seatH * 0.72

      for (let i = 0; i < numCushions; i++) {
        const cx = -wM/2 + armW + cushW/2 + i*(cushW + 0.008)
        // Main cushion body
        box(cushW - 0.012, cushH, seatD - 0.015, fabricMat, cx, baseH + legH + cushH/2, -dM*0.03)
        // Top piping welt
        box(cushW - 0.012, 0.016, seatD - 0.015, pipingMat, cx, baseH + legH + cushH + 0.008, -dM*0.03)
        // Front piping welt
        box(cushW - 0.012, cushH, 0.016, pipingMat, cx, baseH + legH + cushH/2, (seatD - 0.015)/2 + 0.008)
        // Cushion bottom border (darker)
        box(cushW - 0.012, 0.018, seatD - 0.015, pipingMat, cx, baseH + legH + 0.009, -dM*0.03)
        // Seam line between cushions
        if (i < numCushions - 1) {
          box(0.01, cushH*0.9, seatD*0.85, pipingMat, cx + cushW/2 + 0.004, baseH + legH + cushH*0.5, -dM*0.03)
        }
      }

      // ── Back cushion(s) ──
      const backCushH = backH * 0.80
      const backCushD = dM * 0.13
      for (let i = 0; i < numCushions; i++) {
        const cx = -wM/2 + armW + cushW/2 + i*(cushW + 0.008)
        // Back cushion body
        box(cushW - 0.012, backCushH, backCushD, darkFabric, cx, baseH + legH + seatH*0.78 - cushH + backCushH/2, -seatD/2 + backCushD/2 - 0.005)
        // Top piping
        box(cushW - 0.012, 0.016, backCushD, pipingMat, cx, baseH + legH + seatH*0.78 - cushH + backCushH + 0.008, -seatD/2 + backCushD/2 - 0.005)
        // Side seams
        if (i < numCushions-1) {
          box(0.01, backCushH*0.9, backCushD*0.9, pipingMat, cx + cushW/2 + 0.004, baseH + legH + seatH*0.78 - cushH + backCushH*0.5, -seatD/2 + backCushD/2 - 0.005)
        }
      }

      // ── Back panel (behind cushions) ──
      box(wM, backH * 0.94, dM * 0.07, darkFabric, 0, baseH + legH + cushH + backCushH*0.47, -seatD/2 - dM*0.032)
      // Back panel piping top
      box(wM - armW*2, 0.018, dM*0.07, pipingMat, 0, baseH + legH + cushH + backCushH + 0.009, -seatD/2 - dM*0.032)

      // ── Armrests ──
      const armH = hM * 0.74
      for (const sx of [-1, 1]) {
        const ax = sx*(wM/2 - armW/2)
        // Armrest body
        box(armW, armH, seatD + dM*0.045, darkFabric, ax, baseH + legH + armH/2, -dM*0.02)
        // Armrest top pad (slightly wider, rounded feel via scale)
        box(armW + 0.018, 0.048, seatD + dM*0.048, fabricMat, ax, baseH + legH + armH + 0.024, -dM*0.02)
        // Armrest front face
        box(armW, armH*0.5, 0.018, pipingMat, ax, baseH + legH + armH*0.26, (seatD + dM*0.045)/2 + 0.009)
        // Armrest inner welt
        box(0.012, armH*0.88, seatD*0.9, pipingMat, ax - sx*(armW/2 - 0.006), baseH + legH + armH*0.46, -dM*0.02)
      }

      break
    }

    // ══════════════════════════════════════════════════════════════
    case 'Tables': {
      const isRound  = name.includes('round') || name.includes('coffee') || name.includes('oval')
      const isCoffee = name.includes('coffee') || hM < 0.55
      const isGlass  = name.includes('glass')

      const topWood  = mkWood('#9c6b3c', 0.68)
      const darkWood = mkWood('#4e2e10', 0.84)
      const glassTop = mkGlass(0xaaccee, 0.28)
      const topMat   = isGlass ? glassTop : topWood
      const legMat2  = isGlass ? mkMetal(0x888888, 0.18, 0.82) : darkWood

      const tt      = 0.048   // top thickness
      const apronH  = 0.065
      const overhang= 0.038
      const lh      = hM - tt - apronH
      const lr      = 0.032

      // ── Table top ──
      if (isRound) {
        cyl(wM/2 + overhang, wM/2 + overhang, tt, 40, topMat, 0, hM - tt/2, 0)
        // Bevel edge ring
        cyl(wM/2 + overhang + 0.006, wM/2 + overhang - 0.006, tt*0.3, 40, darkWood, 0, hM - tt*0.85, 0)
      } else {
        box(wM + overhang*2, tt, dM + overhang*2, topMat, 0, hM - tt/2, 0)
        // Bevel edge strips
        box(wM + overhang*2, tt*0.28, 0.012, darkWood, 0, hM - tt*0.86, (dM + overhang*2)/2 + 0.006)
        box(wM + overhang*2, tt*0.28, 0.012, darkWood, 0, hM - tt*0.86, -(dM + overhang*2)/2 - 0.006)
        box(0.012, tt*0.28, dM + overhang*2, darkWood, (wM + overhang*2)/2 + 0.006, hM - tt*0.86, 0)
        box(0.012, tt*0.28, dM + overhang*2, darkWood, -(wM + overhang*2)/2 - 0.006, hM - tt*0.86, 0)
      }

      // ── Apron ──
      if (isRound) {
        cyl(wM/2 - 0.03, wM/2 - 0.03, apronH, 36, darkWood, 0, hM - tt - apronH/2, 0)
      } else {
        const apronThick = 0.022
        box(wM - 0.06, apronH, apronThick, darkWood, 0, hM - tt - apronH/2,  dM/2 - apronThick/2)
        box(wM - 0.06, apronH, apronThick, darkWood, 0, hM - tt - apronH/2, -dM/2 + apronThick/2)
        box(apronThick, apronH, dM - 0.06, darkWood,  wM/2 - apronThick/2, hM - tt - apronH/2, 0)
        box(apronThick, apronH, dM - 0.06, darkWood, -wM/2 + apronThick/2, hM - tt - apronH/2, 0)
      }

      // ── Legs ──
      const legPositions = isRound
        ? [[0, -wM*0.3],[wM*0.26, wM*0.15],[-wM*0.26, wM*0.15]]
        : [[-wM/2+lr*1.8, -dM/2+lr*1.8],[wM/2-lr*1.8, -dM/2+lr*1.8],
           [-wM/2+lr*1.8,  dM/2-lr*1.8],[wM/2-lr*1.8,  dM/2-lr*1.8]]

      for (const [lx, lz] of legPositions) {
        // Upper wider section
        cyl(lr,       lr*1.18, lh*0.55, 12, legMat2, lx, lh*0.275,  lz)
        // Lower tapered section
        cyl(lr*0.55,  lr,      lh*0.45, 12, legMat2, lx, lh*0.775,  lz)
        // Top mounting block
        box(lr*3.2, apronH*0.7, lr*3.2, darkWood, lx, hM - tt - apronH*0.35, lz)
        // Foot pad
        cyl(lr*1.0, lr*0.85, 0.016, 10, mkMetal(0x1a1a1a, 0.6, 0.5), lx, lh - 0.008, lz)
      }

      // ── Cross stretcher (for non-round tables) ──
      if (!isRound && !isCoffee) {
        const stretchY = lh * 0.55
        box(wM - lr*5, 0.022, 0.022, darkWood, 0, stretchY, -dM/2 + lr*2.2)
        box(wM - lr*5, 0.022, 0.022, darkWood, 0, stretchY,  dM/2 - lr*2.2)
        box(0.022, 0.022, dM - lr*5, darkWood, -wM/2 + lr*2.2, stretchY, 0)
        box(0.022, 0.022, dM - lr*5, darkWood,  wM/2 - lr*2.2, stretchY, 0)
      }

      break
    }

    // ══════════════════════════════════════════════════════════════
    case 'Bedroom': {
      if (name.includes('wardrobe') || name.includes('closet')) {
        const bodyMat = mkWood('#c8a46e', 0.7)
        const darkWood = mkWood('#7a5028', 0.82)
        const mirrorMat = mkGlass(0x99aacc, 0.15)

        // Carcass
        box(wM, hM, dM, bodyMat, 0, hM / 2, 0)
        // Top crown molding
        box(wM + 0.02, 0.04, dM + 0.02, darkWood, 0, hM + 0.02, 0)
        // Toe kick
        box(wM - 0.02, 0.08, dM + 0.01, mkStd({ color: 0x111111, roughness: 0.9 }), 0, 0.04, 0)
        // Door panels (2 doors)
        const doorW = wM / 2 - 0.03
        for (const sx of [-1, 1]) {
          const dx = sx * (wM / 4)
          // Door panel
          box(doorW, hM - 0.14, 0.02, bodyMat, dx, hM / 2, dM / 2 + 0.01)
          // Inset mirror panel on upper portion
          box(doorW - 0.06, hM * 0.42, 0.005, mirrorMat, dx, hM * 0.72, dM / 2 + 0.022)
          // Door frame (raised panel look)
          box(doorW - 0.06, 0.015, 0.012, darkWood, dx, hM * 0.5, dM / 2 + 0.018)
          // Handle
          cyl(0.008, 0.008, 0.1, 8, chromeMat, dx - sx * (doorW * 0.38), hM * 0.5, dM / 2 + 0.025, 0, 0, Math.PI / 2)
        }
        // Center divider
        box(0.02, hM - 0.1, dM - 0.02, darkWood, 0, hM / 2, 0)
        // Interior shelves
        for (let i = 1; i < 4; i++)
          box(wM / 2 - 0.04, 0.018, dM - 0.04, mkWood('#d4a86a'), -wM / 4, i * (hM / 4), 0)

      } else if (name.includes('nightstand') || name.includes('bedside')) {
        const bodyMat = mkWood('#c8a46e', 0.72)
        const darkWood = mkWood('#7a5028', 0.82)
        box(wM, hM, dM, bodyMat, 0, hM / 2, 0)
        box(wM + 0.01, 0.025, dM + 0.01, darkWood, 0, hM + 0.012, 0)
        box(wM - 0.02, 0.018, dM - 0.02, darkWood, 0, hM / 2, 0) // drawer divider
        box(wM - 0.02, 0.025, 0.008, darkWood, 0, hM * 0.75, dM / 2 + 0.004) // drawer face top
        box(wM - 0.02, 0.025, 0.008, darkWood, 0, hM * 0.3, dM / 2 + 0.004)  // drawer face bottom
        // Handles
        cyl(0.007, 0.007, 0.06, 8, chromeMat, 0, hM * 0.75, dM / 2 + 0.02, 0, 0, Math.PI / 2)
        cyl(0.007, 0.007, 0.06, 8, chromeMat, 0, hM * 0.3, dM / 2 + 0.02, 0, 0, Math.PI / 2)
        // Toe kick
        box(wM, 0.065, dM, mkStd({ color: 0x111111, roughness: 0.9 }), 0, 0.032, 0)

     } else {
        // ── BED ────────────────────────────────────────────────
        const frameMat  = mkWood('#7a4e28', 0.80)
        const darkFrame = mkWood('#3e1e08', 0.88)
        const mattMat   = mkStd({ color: 0xf2ede8, roughness: 0.90 })
        const duvMat    = mkFabric('#e4e0f2', 0.88)
        const pillowMat = mkStd({ color: 0xfafafa, roughness: 0.82 })
        const upholMat  = mkFabric(hexColor || '#c8b89a', 0.88)
        const pipingMat2= mkStd({ color: 0xd8d4e8, roughness: 0.85 })

        const frameH  = hM * 0.36
        const mattH   = hM * 0.20
        const boxSprH = mattH * 0.45
        const baseH   = frameH * 0.52

        // ── Legs ──
        for (const [sx, sz] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
          cyl(0.042, 0.048, baseH, 12, darkFrame,
            sx*(wM/2 - 0.065), baseH/2, sz*(dM/2 - 0.065))
          // Foot cap ring
          cyl(0.052, 0.042, 0.014, 12, mkMetal(0x1a1a1a, 0.5, 0.7),
            sx*(wM/2 - 0.065), baseH - 0.007, sz*(dM/2 - 0.065))
        }

        // ── Side rails ──
        const railH = frameH * 0.20
        box(wM - 0.12, railH, 0.058, frameMat, 0, baseH + railH/2, -dM/2 + 0.03)
        box(wM - 0.12, railH, 0.058, frameMat, 0, baseH + railH/2,  dM/2 - 0.03)
        box(0.058, railH, dM*0.72, frameMat, -wM/2 + 0.03, baseH + railH/2, 0)
        box(0.058, railH, dM*0.72, frameMat,  wM/2 - 0.03, baseH + railH/2, 0)

        // ── Slats (5 visible) ──
        const slotZ = [-dM*0.26, -dM*0.12, dM*0.02, dM*0.18, dM*0.34]
        for (const sz of slotZ)
          box(wM - 0.14, 0.022, 0.075, frameMat, 0, baseH + 0.011, sz)

        // ── Box spring ──
        box(wM - 0.1, boxSprH, dM - 0.1,
          mkStd({ color: 0x888888, roughness: 0.96 }), 0, baseH + boxSprH/2, 0)
        // Box spring border fabric
        box(wM - 0.09, boxSprH*0.3, 0.015,
          mkStd({ color: 0x999999, roughness: 0.95 }), 0, baseH + boxSprH*0.85, -dM/2 + 0.055)
        box(wM - 0.09, boxSprH*0.3, 0.015,
          mkStd({ color: 0x999999, roughness: 0.95 }), 0, baseH + boxSprH*0.85,  dM/2 - 0.055)

        // ── Mattress ──
        box(wM - 0.082, mattH, dM - 0.082, mattMat,
          0, baseH + boxSprH + mattH/2, 0)
        // Mattress piping (top)
        box(wM - 0.075, 0.014, dM - 0.075, pipingMat2,
          0, baseH + boxSprH + mattH + 0.007, 0)
        // Mattress piping (sides — 4 edges)
        box(wM - 0.075, 0.014, 0.015, pipingMat2, 0, baseH + boxSprH + mattH*0.5, -(dM - 0.082)/2 - 0.0075)
        box(wM - 0.075, 0.014, 0.015, pipingMat2, 0, baseH + boxSprH + mattH*0.5,  (dM - 0.082)/2 + 0.0075)
        // Quilted mattress top surface (grid lines)
        const quiltMat = mkStd({ color: 0xeae6e0, roughness: 0.88 })
        const qRows = 3, qCols = Math.round(wM / 0.28)
        for (let r = 1; r < qRows; r++) {
          box(wM - 0.09, 0.006, 0.008, quiltMat, 0,
            baseH + boxSprH + mattH + 0.008,
            -dM/2 + 0.05 + r*((dM-0.1)/qRows))
        }
        for (let c = 1; c < qCols; c++) {
          box(0.008, 0.006, dM - 0.09, quiltMat,
            -wM/2 + 0.05 + c*((wM-0.1)/qCols),
            baseH + boxSprH + mattH + 0.008, 0)
        }

        // ── Duvet ──
        const duvY   = baseH + boxSprH + mattH + 0.012
        const duvLen = dM * 0.74
        box(wM - 0.09, 0.072, duvLen, duvMat, 0, duvY + 0.036,  dM*0.04)
        // Duvet fold-back
        box(wM - 0.09, 0.028, dM*0.11, duvMat, 0, duvY + 0.072 + 0.014, -dM*0.31)
        // Duvet piping edges
        box(wM - 0.09, 0.015, 0.016, pipingMat2, 0, duvY + 0.065, -duvLen/2 + dM*0.04)
        box(wM - 0.09, 0.015, 0.016, pipingMat2, 0, duvY + 0.065,  duvLen/2 + dM*0.04)

        // ── Pillows ──
        const pNum = wM > 1.2 ? 2 : 1
        const pW   = wM > 1.2 ? wM*0.38 : wM*0.58
        const pXs  = pNum === 2 ? [-wM*0.22, wM*0.22] : [0]
        const pY   = duvY + 0.072 + 0.055
        const pZ   = -dM*0.295
        for (const px of pXs) {
          // Pillow body
          box(pW, 0.105, dM*0.21, pillowMat, px, pY + 0.052, pZ)
          // Pillow top seam
          box(pW - 0.02, 0.012, dM*0.21 - 0.02, pipingMat2, px, pY + 0.105 + 0.006, pZ)
          // Pillow case stitching line
          box(pW - 0.04, 0.007, dM*0.21 - 0.04, mkStd({ color: 0xe0dde8, roughness: 0.9 }), px, pY + 0.112, pZ)
          // Pillow side gusset
          box(0.014, 0.09, dM*0.19, pipingMat2, px + pW/2 - 0.007, pY + 0.052, pZ)
          box(0.014, 0.09, dM*0.19, pipingMat2, px - pW/2 + 0.007, pY + 0.052, pZ)
        }

        // ── Headboard (tall upholstered) ──
        const headH    = hM * 0.60
        const headThick= 0.115
        box(wM + 0.05, headH, headThick, upholMat,
          0, baseH + headH/2, -dM/2 + headThick/2 - 0.005)
        // Headboard frame border
        box(wM + 0.07, headH + 0.015, 0.015, darkFrame,
          0, baseH + headH/2, -dM/2 + headThick + 0.007)
        box(0.015, headH + 0.015, headThick + 0.01, darkFrame,
           (wM + 0.07)/2, baseH + headH/2, -dM/2 + headThick/2)
        box(0.015, headH + 0.015, headThick + 0.01, darkFrame,
          -(wM + 0.07)/2, baseH + headH/2, -dM/2 + headThick/2)
        // Headboard top rail
        box(wM + 0.07, 0.03, headThick + 0.01, darkFrame,
          0, baseH + headH + 0.015, -dM/2 + headThick/2)
        // Tufting buttons (grid pattern)
        const tuftMat2 = mkStd({ color: col.clone().multiplyScalar(0.42), roughness: 0.88 })
        const tRows = 3, tCols = Math.max(2, Math.round(wM / 0.42))
        for (let tr = 0; tr < tRows; tr++) {
          for (let tc = 0; tc < tCols; tc++) {
            const tx = -wM*0.38 + tc*(wM*0.76/(tCols-1||1))
            const ty = baseH + headH*0.28 + tr*(headH*0.36/(tRows-1||1))
            sph(0.020, tuftMat2, tx, ty, -dM/2 + headThick + 0.012)
          }
        }
        // Tufting piping lines (horizontal channels)
        for (let tr = 1; tr < tRows; tr++) {
          const ty = baseH + headH*0.28 + tr*(headH*0.36/(tRows-1||1)) - headH*0.09
          box(wM*0.82, 0.012, 0.012, pipingMat2, 0, ty, -dM/2 + headThick*0.6)
        }

        // ── Footboard ──
        const footH = hM * 0.22
        box(wM + 0.05, footH, 0.075, frameMat, 0, baseH + footH/2, dM/2 - 0.04)
        // Footboard top cap
        box(wM + 0.07, 0.022, 0.085, darkFrame, 0, baseH + footH + 0.011, dM/2 - 0.04)
      }
      break
    }

    // ══════════════════════════════════════════════════════════════
    case 'Storage': {
      const bodyMat = mkWood('#c0956a', 0.72)
      const darkWood = mkWood('#7a5028', 0.82)
      const backMat = mkWood('#d4aa78', 0.88)

      // Carcass
      const panels = [
        [0.022, hM, dM, -wM / 2 + 0.011, hM / 2, 0],
        [0.022, hM, dM, wM / 2 - 0.011, hM / 2, 0],
        [wM - 0.04, 0.022, dM, 0, hM - 0.011, 0],
        [wM - 0.04, 0.022, dM, 0, 0.011, 0],
        [wM - 0.04, hM - 0.04, 0.012, 0, hM / 2, -dM / 2 + 0.006],
      ]
      for (const [w, h, d, x, y, z] of panels)
        box(w, h, d, bodyMat, x, y, z)

      // Toe kick
      box(wM, 0.07, dM, mkStd({ color: 0x111111, roughness: 0.9 }), 0, 0.035, 0)
      // Crown
      box(wM + 0.015, 0.05, dM + 0.015, darkWood, 0, hM + 0.025, 0)

      // Doors or open shelves
      const numDoors = Math.max(1, Math.round(wM / 0.45))
      const dW = (wM - 0.04) / numDoors
      for (let i = 0; i < numDoors; i++) {
        const dx = -wM / 2 + 0.02 + dW / 2 + i * dW
        box(dW - 0.01, hM - 0.1, 0.018, bodyMat, dx, hM / 2 + 0.01, dM / 2 + 0.009)
        // Inset panel
        box(dW - 0.07, hM * 0.55, 0.008, backMat, dx, hM / 2 + 0.02, dM / 2 + 0.02)
        // Handle
        cyl(0.007, 0.007, 0.055, 8, chromeMat, dx, hM * 0.52, dM / 2 + 0.028, 0, 0, Math.PI / 2)
      }

      // Interior shelves
      const nShelves = Math.max(2, Math.round(hM / 0.3))
      for (let i = 1; i < nShelves; i++) {
        const sy = i * (hM / nShelves)
        box(wM - 0.05, 0.02, dM - 0.04, mkWood('#d4aa78'), 0, sy, 0)
      }
      break
    }

    // ══════════════════════════════════════════════════════════════
    case 'Office': {
      const deskMat = mkWood('#b8906a', 0.68)
      const darkWood = mkWood('#6a3e18', 0.82)
      const panelMat = mkStd({ color: 0x111122, roughness: 0.15, metalness: 0.4 })
      const screenMat = mkStd({ color: 0x030310, roughness: 0.02, emissive: new T.Color(0.02, 0.055, 0.22), emissiveIntensity: 1.4, metalness: 0.45 })
      const screenGlow = mkStd({ color: 0x1a2a88, roughness: 0.04, emissive: new T.Color(0.06, 0.14, 0.55), emissiveIntensity: 1.0, transparent: true, opacity: 0.55 })
      const kbMat = mkStd({ color: 0x202020, roughness: 0.5, metalness: 0.15 })

      // Desk surface + lip
      box(wM, 0.04, dM, deskMat, 0, hM, 0)
      box(wM + 0.02, 0.018, 0.018, darkWood, 0, hM + 0.009, -dM / 2 - 0.009)
      box(wM + 0.02, 0.018, 0.018, darkWood, 0, hM + 0.009, dM / 2 + 0.009)
      // Modesty panel (back)
      box(wM, hM - 0.05, 0.02, darkWood, 0, (hM - 0.05) / 2, -dM / 2 + 0.01)

      // Legs
      for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]])
        box(0.055, hM - 0.02, 0.055, darkWood, sx * (wM / 2 - 0.04), (hM - 0.02) / 2, sz * (dM / 2 - 0.04))

      // Dual monitor setup for wider desks
      const numScreens = wM > 1.4 ? 2 : 1
      const screenW = Math.min(wM * 0.44, 0.55)
      const screenH = 0.3
      const screenOffsets = numScreens === 2 ? [-wM * 0.22, wM * 0.22] : [0]
      for (const sox of screenOffsets) {
        // Monitor bezel
        box(screenW, screenH + 0.02, 0.035, panelMat, sox, hM + 0.02 + screenH / 2 + 0.14, -dM * 0.3)
        // Screen
        box(screenW - 0.04, screenH, 0.01, screenMat, sox, hM + 0.02 + screenH / 2 + 0.14, -dM * 0.3 + 0.018)
        // Stand neck
        box(0.04, 0.14, 0.04, panelMat, sox, hM + 0.07, -dM * 0.3)
        // Stand base
        box(screenW * 0.55, 0.02, 0.16, panelMat, sox, hM + 0.01, -dM * 0.3 + 0.04)
        // Screen ambient glow spill on desk surface
          box(screenW * 0.7, 0.004, dM * 0.28, screenGlow, sox, hM + 0.002, -dM * 0.22)
      }

      // Keyboard
      box(wM * 0.38, 0.014, dM * 0.18, kbMat, 0, hM + 0.007, dM * 0.12)
      // Mouse
      box(0.065, 0.025, 0.12, kbMat, wM * 0.22, hM + 0.012, dM * 0.12)
      // Mouse pad
      box(0.24, 0.004, 0.2, mkStd({ color: 0x333333, roughness: 0.98 }), wM * 0.21, hM + 0.002, dM * 0.1)
      // Cable management box
      box(0.12, 0.06, 0.08, mkStd({ color: 0x111111, roughness: 0.85 }), -wM * 0.42, hM - 0.03, dM * 0.3)
      break
    }

    // ══════════════════════════════════════════════════════════════
    case 'Lighting': {
      const poleMat = mkMetal(0xddddcc, 0.15, 0.92)
      const brassMat = mkMetal(0xc8a840, 0.2, 0.8)
      const shdMat = mkStd({
        color: 0xfff0cc, roughness: 0.55, transparent: true, opacity: 0.88,
        emissive: new T.Color(0.5, 0.35, 0.08), emissiveIntensity: 0.7,
        side: T.DoubleSide,
      })
      const bulbMat = mkStd({
        color: 0xffffee, roughness: 0.3,
        emissive: new T.Color(1.0, 0.9, 0.4), emissiveIntensity: 1.8,
      })

      if (name.includes('floor') || name.includes('lamp')) {
        // Floor lamp: weighted base, slender pole, angled shade
        cyl(0.16, 0.2, 0.025, 24, brassMat, 0, 0.012, 0)           // base disc
        cyl(0.05, 0.05, 0.04, 16, brassMat, 0, 0.05, 0)             // base column
        cyl(0.018, 0.018, hM * 0.82, 12, poleMat, 0, hM * 0.41, 0)  // pole
        cyl(0.014, 0.014, 0.04, 12, brassMat, 0, hM * 0.84, 0)      // shade connector
        // Shade (conical: wide at bottom)
        cyl(Math.min(wM * 0.38, 0.22), 0.05, Math.min(dM * 0.35, 0.2), 24, shdMat, 0, hM - 0.1, 0)
        // Bulb
        sph(0.04, bulbMat, 0, hM - 0.04, 0)
        // Top finial
        sph(0.022, brassMat, 0, hM + 0.04, 0)
      } else if (name.includes('pendant') || name.includes('hanging') || name.includes('chandelier')) {
        cyl(0.008, 0.008, hM * 0.45, 8, poleMat, 0, hM * 0.77, 0)   // cord
        cyl(0.06, 0.14, 0.18, 20, shdMat, 0, hM - 0.09, 0)           // bell shade
        sph(0.035, bulbMat, 0, hM - 0.06, 0)
      } else {
        // Table lamp
        cyl(wM * 0.2, wM * 0.22, 0.025, 20, brassMat, 0, 0.012, 0)   // base
        cyl(0.05, 0.08, hM * 0.32, 14, brassMat, 0, hM * 0.16, 0)    // body
        cyl(0.014, 0.014, hM * 0.22, 12, poleMat, 0, hM * 0.43, 0)   // neck
        cyl(Math.min(wM * 0.36, 0.2), 0.04, Math.min(hM * 0.3, 0.22), 20, shdMat, 0, hM - 0.14, 0)  // shade
        sph(0.038, bulbMat, 0, hM - 0.1, 0)
      }
      break
    }

    // ══════════════════════════════════════════════════════════════
    case 'Bathroom': {
      const porcelain = mkCeramic(0xf4f8fc)
      const innerWater = mkGlass(0x88ccee, 0.65)
      const chrome = chromeMat

      if (name.includes('toilet')) {
        // Cistern (tank)
        const tz = -dM / 2 + dM * 0.22
        box(wM * 0.72, hM * 0.62, dM * 0.3, porcelain, 0, hM * 0.31 + hM * 0.04, tz)
        // Cistern lid
        box(wM * 0.72 + 0.01, 0.02, dM * 0.3 + 0.01, mkStd({ color: 0xecf3fa, roughness: 0.06 }), 0, hM * 0.62 + 0.01, tz)
        // Flush button
        cyl(0.025, 0.025, 0.015, 12, chrome, 0, hM * 0.62 + 0.022, tz)
        // Pedestal
        cyl(wM * 0.26, wM * 0.3, hM * 0.42, 22, porcelain, 0, hM * 0.21, dM * 0.1)
        // Bowl (oval)
        box(wM * 0.76, 0.04, dM * 0.58, porcelain, 0, hM * 0.42, dM * 0.08)
        // Inner bowl
        addMesh(new T.CylinderGeometry(wM * 0.28, wM * 0.22, hM * 0.14, 24), innerWater, 0, hM * 0.35, dM * 0.08)
        // Seat (hinged ring)
        box(wM * 0.72, 0.025, dM * 0.56, mkStd({ color: 0xffffff, roughness: 0.12 }), 0, hM * 0.44 + 0.012, dM * 0.08)

      } else if (name.includes('bathtub')) {
        const rimMat = mkCeramic(0xeef2f8)
        // Outer shell (tapered at ends)
        box(wM, hM * 0.52, dM, rimMat, 0, hM * 0.26, 0)
        // Rim lip
        box(wM + 0.02, 0.04, dM + 0.02, rimMat, 0, hM * 0.52 + 0.02, 0)
        // Inner basin
        box(wM - 0.14, hM * 0.38, dM - 0.12, innerWater, 0, hM * 0.42, 0)
        // Feet (4 ball feet)
        for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]])
          sph(0.055, chrome, sx * (wM / 2 - 0.1), 0.055, sz * (dM / 2 - 0.1))
        // Faucet assembly
        cyl(0.022, 0.022, 0.14, 10, chrome, -wM * 0.38, hM * 0.62, -dM * 0.42, Math.PI * 0.15, 0, 0)
        cyl(0.018, 0.018, 0.09, 10, chrome, -wM * 0.38 + 0.05, hM * 0.55, -dM * 0.42)
        // Drain
        cyl(0.03, 0.03, 0.01, 14, chrome, 0, hM * 0.04, 0)

      } else {
        // Sink/basin
        const sinkRim = mkCeramic(0xf0f5fc)
        box(wM, hM * 0.26, dM, sinkRim, 0, hM * 0.13, 0)  // cabinet base
        // Countertop
        box(wM + 0.01, 0.03, dM + 0.01, sinkRim, 0, hM * 0.26 + 0.015, 0)
        // Basin recess
        box(wM * 0.62, 0.02, dM * 0.65, innerWater, 0, hM * 0.26 + 0.03, -dM * 0.04)
        // Faucet
        cyl(0.02, 0.02, 0.14, 10, chrome, 0, hM * 0.28 + 0.07, -dM * 0.3, -Math.PI * 0.1, 0, 0)
        cyl(0.018, 0.018, 0.04, 10, chrome, 0, hM * 0.28 + 0.07, -dM * 0.3)
        // Handles
        for (const sx of [-1, 1])
          cyl(0.016, 0.016, 0.07, 10, chrome, sx * 0.075, hM * 0.28 + 0.05, -dM * 0.3)
      }
      break
    }

    // ══════════════════════════════════════════════════════════════
    case 'Kitchen': {
      if (name.includes('fridge') || name.includes('refrigerator')) {
        const appMat = mkStd({ color: 0xecece8, roughness: 0.28, metalness: 0.55 })
        const darkMat = mkStd({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.6 })

        // Body
        box(wM, hM, dM, appMat, 0, hM / 2, 0)
        // Door gap line (freezer/fridge split ~35% from top)
        box(wM + 0.001, 0.008, dM / 2 + 0.001, darkMat, 0, hM * 0.65, dM / 2 + 0.004)
        // Freezer door panel
        box(wM - 0.02, hM * 0.34, 0.012, mkStd({ color: 0xe8e8e4, roughness: 0.25, metalness: 0.5 }), 0, hM * 0.83, dM / 2 + 0.006)
        // Main door panel
        box(wM - 0.02, hM * 0.6, 0.012, mkStd({ color: 0xeaeae6, roughness: 0.22, metalness: 0.52 }), 0, hM * 0.32, dM / 2 + 0.006)
        // Handles (bar style)
        box(0.025, hM * 0.28, 0.04, chromeMat, -wM * 0.38, hM * 0.82, dM / 2 + 0.024)
        box(0.025, hM * 0.22, 0.04, chromeMat, -wM * 0.38, hM * 0.3, dM / 2 + 0.024)
        // Hinge details
        for (const hy of [hM * 0.08, hM * 0.96])
          box(0.04, 0.025, 0.04, darkMat, wM / 2 - 0.025, hy, dM / 2 + 0.004)
        // Ventilation grille (bottom front)
        box(wM * 0.8, 0.06, 0.01, darkMat, 0, 0.03, dM / 2 + 0.001)

      } else if (name.includes('stove') || name.includes('cooktop') || name.includes('oven')) {
        const bodyMat = mkStd({ color: 0x2a2a2a, roughness: 0.3, metalness: 0.55 })
        const grillMat = mkMetal(0x111111, 0.7, 0.4)
        const knobMat = mkStd({ color: 0x181818, roughness: 0.4, metalness: 0.5 })

        // Oven body
        box(wM, hM * 0.88, dM, bodyMat, 0, hM * 0.44, 0)
        // Cooktop surface
        box(wM + 0.01, 0.025, dM + 0.01, mkStd({ color: 0x1a1a1a, roughness: 0.25, metalness: 0.6 }), 0, hM * 0.9, 0)
        // Oven door
        box(wM - 0.06, hM * 0.44, 0.02, mkStd({ color: 0x222222, roughness: 0.2, metalness: 0.55 }), 0, hM * 0.24, dM / 2 + 0.01)
        // Oven window
        box(wM * 0.55, hM * 0.22, 0.01, mkGlass(0x332211, 0.55), 0, hM * 0.26, dM / 2 + 0.016)
        // Door handle
        box(wM * 0.6, 0.028, 0.04, chromeMat, 0, hM * 0.44, dM / 2 + 0.024)
        // Burners (4) with grates
        const bPos = [[-wM * 0.26, -dM * 0.2], [wM * 0.26, -dM * 0.2], [-wM * 0.26, dM * 0.15], [wM * 0.26, dM * 0.15]]
        for (const [bx, bz] of bPos) {
          cyl(wM * 0.14, wM * 0.14, 0.012, 24, grillMat, bx, hM * 0.92, bz)  // outer ring
          cyl(wM * 0.05, wM * 0.05, 0.016, 16, mkStd({ color: 0x090909, roughness: 0.9 }), bx, hM * 0.924, bz) // center
          // Grate spokes (4 per burner)
          for (let a = 0; a < 4; a++) {
            const gr = new T.Mesh(new T.BoxGeometry(wM * 0.22, 0.01, 0.015), grillMat)
            gr.position.set(bx, hM * 0.935, bz)
            gr.rotation.y = a * Math.PI / 4
            gr.castShadow = true; group.add(gr)
          }
        }
        // Control knobs (front)
        for (let i = 0; i < 4; i++)
          cyl(0.022, 0.028, 0.035, 14, knobMat, -wM * 0.38 + i * (wM * 0.26), hM * 0.86, dM / 2 + 0.014)

      } else {
        // Counter / sink
        const counterMat = mkStd({ map: metalTex(T), roughness: 0.32, metalness: 0.65 })
        const cabinetMat = mkWood('#b87c52', 0.72)
        box(wM, hM * 0.88, dM, cabinetMat, 0, hM * 0.44, 0)
        box(wM + 0.01, 0.04, dM + 0.01, counterMat, 0, hM * 0.9, 0)
        box(wM - 0.02, 0.01, 0.02, mkStd({ color: 0x111111, roughness: 0.9 }), 0, hM * 0.88, dM / 2 + 0.002)
        if (name.includes('sink')) {
          box(wM * 0.55, 0.025, dM * 0.58, new T.MeshStandardMaterial({ color: 0x999990, roughness: 0.12, metalness: 0.75 }), 0, hM * 0.9 + 0.012, 0)
          cyl(0.024, 0.024, 0.16, 10, chromeMat, 0, hM * 0.96 + 0.08, -dM * 0.18, -Math.PI * 0.12, 0, 0)
          for (const sx of [-1, 1])
            cyl(0.014, 0.014, 0.05, 10, chromeMat, sx * 0.07, hM * 0.96 + 0.04, -dM * 0.18)
        }
      }
      break
    }

    // ══════════════════════════════════════════════════════════════
    case 'Living Room': {
      if (name.includes('tv') || name.includes('television')) {
        const frameMat = mkStd({ color: 0x0a0a12, roughness: 0.15, metalness: 0.5 })
        const scrMat = mkStd({ color: 0x040408, roughness: 0.02, metalness: 0.3, emissive: new T.Color(0.02, 0.04, 0.12), emissiveIntensity: 0.6 })
        const standMat = mkStd({ color: 0x111111, roughness: 0.4, metalness: 0.65 })

        // Outer bezel (thin)
        box(wM, hM, dM, frameMat, 0, hM / 2, 0)
        // Screen surface
        box(wM - 0.025, hM - 0.022, 0.008, scrMat, 0, hM / 2, dM / 2 + 0.004)
        // Ultra-thin back protrusion (electronics bulge)
        box(wM * 0.55, hM * 0.6, dM * 0.6, mkStd({ color: 0x151515, roughness: 0.6, metalness: 0.4 }), 0, hM / 2, -dM * 0.15)
        // Power light
        sph(0.008, mkStd({ color: 0x00aaff, emissive: new T.Color(0, 0.5, 1), emissiveIntensity: 2, roughness: 0.3 }), wM * 0.44, 0.022, dM / 2 + 0.005)
        // Stand neck
        box(wM * 0.1, hM * 0.3, dM * 0.25, standMat, 0, -hM * 0.15, dM * 0.1)
        // Stand base
        box(wM * 0.52, 0.02, dM * 0.65, standMat, 0, -hM * 0.3, dM * 0.15)

      } else if (name.includes('rug')) {
        const rugTex = fabricTex(T, hexColor); rugTex.repeat.set(4, 4)
        box(wM, 0.018, dM, mkStd({ map: rugTex, roughness: 0.98 }), 0, 0.009, 0)
        // Rug border (slightly raised, different color)
        const borderColor = col.clone().multiplyScalar(0.7)
        for (const [bw, bh, bd, bx, bz] of [
          [wM, 0.022, 0.04, 0, -dM / 2 + 0.02],
          [wM, 0.022, 0.04, 0, dM / 2 - 0.02],
          [0.04, 0.022, dM, -wM / 2 + 0.02, 0],
          [0.04, 0.022, dM, wM / 2 - 0.02, 0],
        ]) box(bw, bh, bd, mkStd({ color: borderColor, roughness: 0.98 }), bx, 0.011, bz)

      } else if (name.includes('fireplace')) {
        const stoneMat = mkStd({ color: 0x88887a, roughness: 0.92 })
        const brickMat = mkStd({ color: 0x9a5535, roughness: 0.96 })
        const fireMat = mkStd({ color: 0xff6600, emissive: new T.Color(1, 0.3, 0), emissiveIntensity: 1.5, roughness: 0.8 })

        box(wM, hM, dM, stoneMat, 0, hM / 2, 0)
        // Firebox opening
        box(wM * 0.62, hM * 0.55, dM * 0.12, brickMat, 0, hM * 0.3, dM / 2 + 0.006)
        // Inner firebox (dark)
        box(wM * 0.58, hM * 0.5, dM * 0.28, mkStd({ color: 0x0a0804, roughness: 0.97 }), 0, hM * 0.28, dM * 0.18)
        // Fire glow
        box(wM * 0.28, hM * 0.12, 0.04, fireMat, 0, hM * 0.1, dM * 0.32)
        // Mantel shelf
        box(wM + 0.08, 0.06, dM * 0.5 + 0.1, mkStd({ map: woodTex(T), roughness: 0.65 }), 0, hM + 0.03, -dM * 0.05)
        // Corbels (mantel supports)
        for (const sx of [-1, 1])
          box(0.05, hM * 0.12, dM * 0.2, stoneMat, sx * (wM * 0.46), hM + 0.03 - hM * 0.06, -dM * 0.05)
        // Hearth slab
        box(wM + 0.08, 0.03, dM * 0.18, stoneMat, 0, 0.015, dM / 2 + 0.04)

      } else {
        box(wM, hM, dM, mkPaint(col, 0.7), 0, hM / 2, 0)
      }
      break
    }

    // ══════════════════════════════════════════════════════════════
    case 'Decor': {
      if (name.includes('plant')) {
        const potMat = mkStd({ color: 0xac7348, roughness: 0.88 })
        const soilMat = mkStd({ color: 0x2a1a0a, roughness: 0.98 })
        const leafMat = mkStd({ color: 0x1e6b28, roughness: 0.9, side: T.DoubleSide })
        const stemMat = mkStd({ color: 0x2a5012, roughness: 0.92 })

        const potR = Math.min(wM, dM) * 0.38
        const potH = hM * 0.38
        // Pot (tapered)
        cyl(potR, potR * 0.78, potH, 18, potMat, 0, potH / 2, 0)
        // Rim
        cyl(potR + 0.02, potR + 0.02, 0.025, 18, potMat, 0, potH + 0.012, 0)
        // Soil
        cyl(potR - 0.01, potR - 0.01, 0.02, 18, soilMat, 0, potH + 0.01, 0)
        // Main stem
        cyl(0.018, 0.022, hM * 0.35, 8, stemMat, 0, potH + hM * 0.175, 0)
        // Leaves (asymmetric, multiple)
        const leafDefs = [[0, 0, 0], [0.7, 0.15, 0.2], [-0.6, 0.2, -0.1], [0.4, -0.1, 0.25], [-0.3, 0.3, -0.2]]
        for (const [la, ly, lz] of leafDefs) {
          const lf = new T.Mesh(new T.SphereGeometry(Math.min(wM, dM) * 0.28, 8, 5), leafMat)
          lf.position.set(la * wM * 0.22, potH + hM * 0.3 + ly * hM * 0.18, lz * dM * 0.22)
          lf.scale.set(1.2, 0.32, 0.75); lf.castShadow = true; group.add(lf)
        }
      } else {
        box(wM, hM, dM, mkPaint(col, 0.75), 0, hM / 2, 0)
      }
      break
    }

    default:
      box(wM, hM, dM, mkPaint(col, 0.7), 0, hM / 2, 0)
  }

  return group
}

function parseOBJ(T, text) {
  const verts = [], uvArr = [], normArr = [], posOut = [], uvOut = [], normOut = []
  for (const raw of text.split('\n')) {
    const p = raw.trim().split(/\s+/)
    if (p[0] === 'v') verts.push(p.slice(1).map(Number))
    if (p[0] === 'vt') uvArr.push(p.slice(1).map(Number))
    if (p[0] === 'vn') normArr.push(p.slice(1).map(Number))
    if (p[0] === 'f') {
      const fvs = p.slice(1).map(s => { const i = s.split('/').map(n => n ? parseInt(n) - 1 : undefined); return { v: i[0], t: i[1], n: i[2] } })
      for (let i = 1; i < fvs.length - 1; i++) {
        for (const fv of [fvs[0], fvs[i], fvs[i + 1]]) {
          posOut.push(...(verts[fv.v] || [0, 0, 0]))
          uvOut.push(...(fv.t != null && uvArr[fv.t] ? uvArr[fv.t] : [0, 0]))
          normOut.push(...(fv.n != null && normArr[fv.n] ? normArr[fv.n] : [0, 1, 0]))
        }
      }
    }
  }
  const geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.Float32BufferAttribute(posOut, 3))
  geo.setAttribute('uv', new T.Float32BufferAttribute(uvOut, 2))
  geo.setAttribute('normal', new T.Float32BufferAttribute(normOut, 3))
  if (!normOut.length || normOut.every(v => v === 0)) geo.computeVertexNormals()
  return geo
}

async function parseGLB(T, buffer) {
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== 0x46546C67) throw new Error('Not a valid GLB file')
  const jsonLen = view.getUint32(12, true)
  const jsonStart = 20
  const jsonText = new TextDecoder().decode(new Uint8Array(buffer, jsonStart, jsonLen))
  const gltf = JSON.parse(jsonText)
  let binChunk = null
  let imgChunk = null  // for embedded textures
  let off = jsonStart + jsonLen
  while (off + 8 <= buffer.byteLength) {
    const chunkLen = view.getUint32(off, true)
    const chunkType = view.getUint32(off + 4, true)
    if (chunkType === 0x004E4942) binChunk = buffer.slice(off + 8, off + 8 + chunkLen)
    off += 8 + chunkLen
  }
  if (!binChunk) throw new Error('Missing GLB binary chunk')

  const getAcc = idx => {
    const acc = gltf.accessors[idx]
    const bv = gltf.bufferViews[acc.bufferView]
    const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0)
    const count = acc.count || 0
    const sz = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[acc.type] || 1
    return new Float32Array(binChunk, byteOffset, count * sz)
  }
  const getIdx = idx => {
    const acc = gltf.accessors[idx]
    const bv = gltf.bufferViews[acc.bufferView]
    const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0)
    const count = acc.count || 0
    return acc.componentType === 5125 ? new Uint32Array(binChunk, byteOffset, count) : new Uint16Array(binChunk, byteOffset, count)
  }

  // Build Three.js textures from embedded GLTF images
  const texCache = {}
  const getTexture = (texIdx) => {
    if (texIdx == null) return null
    if (texCache[texIdx]) return texCache[texIdx]
    try {
      const texDef = gltf.textures?.[texIdx]
      if (!texDef) return null
      const imgDef = gltf.images?.[texDef.source]
      if (!imgDef) return null
      let imgData
      if (imgDef.bufferView != null) {
        const bv = gltf.bufferViews[imgDef.bufferView]
        imgData = new Uint8Array(binChunk, bv.byteOffset || 0, bv.byteLength)
      } else return null
      const mimeType = imgDef.mimeType || 'image/png'
      const blob = new Blob([imgData], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const tex = new T.TextureLoader().load(url, () => URL.revokeObjectURL(url))
      tex.flipY = false  // GLTF uses top-left origin
      tex.wrapS = tex.wrapT = T.RepeatWrapping
      texCache[texIdx] = tex
      return tex
    } catch { return null }
  }

  // Build material from GLTF pbrMetallicRoughness
  const buildMat = (matIdx) => {
    const matDef = gltf.materials?.[matIdx]
    if (!matDef) return new T.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7 })
    const pbr = matDef.pbrMetallicRoughness || {}
    const baseColor = pbr.baseColorFactor || [1, 1, 1, 1]
    const mat = new T.MeshStandardMaterial({
      color: new T.Color(baseColor[0], baseColor[1], baseColor[2]),
      opacity: baseColor[3] ?? 1,
      transparent: (baseColor[3] ?? 1) < 1,
      roughness: pbr.roughnessFactor ?? 0.7,
      metalness: pbr.metallicFactor ?? 0,
      side: matDef.doubleSided ? T.DoubleSide : T.FrontSide,
    })
    // Base color texture
    const bcTex = pbr.baseColorTexture?.index != null ? getTexture(pbr.baseColorTexture.index) : null
    if (bcTex) mat.map = bcTex
    // Normal map
    const nmTex = matDef.normalTexture?.index != null ? getTexture(matDef.normalTexture.index) : null
    if (nmTex) mat.normalMap = nmTex
    // Metallic-roughness texture
    const mrTex = pbr.metallicRoughnessTexture?.index != null ? getTexture(pbr.metallicRoughnessTexture.index) : null
    if (mrTex) { mat.metalnessMap = mrTex; mat.roughnessMap = mrTex }
    // Emissive
    if (matDef.emissiveFactor) {
      const [er, eg, eb] = matDef.emissiveFactor
      if (er > 0 || eg > 0 || eb > 0) mat.emissive = new T.Color(er, eg, eb)
    }
    return mat
  }

  const group = new T.Group()
  for (const mesh of (gltf.meshes || [])) {
    for (const prim of (mesh.primitives || [])) {
      const geo = new T.BufferGeometry(); const at = prim.attributes || {}
      if (at.POSITION != null) geo.setAttribute('position', new T.Float32BufferAttribute(getAcc(at.POSITION), 3))
      if (at.NORMAL != null) geo.setAttribute('normal', new T.Float32BufferAttribute(getAcc(at.NORMAL), 3))
      if (at.TEXCOORD_0 != null) geo.setAttribute('uv', new T.Float32BufferAttribute(getAcc(at.TEXCOORD_0), 2))
      if (at.COLOR_0 != null) geo.setAttribute('color', new T.Float32BufferAttribute(getAcc(at.COLOR_0), 4))
      if (prim.indices != null) geo.setIndex(new T.BufferAttribute(getIdx(prim.indices), 1))
      if (!geo.getAttribute('normal')) geo.computeVertexNormals()
      // ← Use real material instead of hardcoded grey
      const mat = buildMat(prim.material)
      if (geo.getAttribute('color')) mat.vertexColors = true
      const m = new T.Mesh(geo, mat)
      m.castShadow = true; m.receiveShadow = true; group.add(m)
    }
  }
  return group
}

function b64ToBuffer(b64) {
  const bin = atob(b64), buf = new ArrayBuffer(bin.length), u8 = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return buf
}

function scaleModelToFit(T, group, wM, hM, dM) {
  const box3 = new T.Box3().setFromObject(group)
  const size = new T.Vector3(); box3.getSize(size)
  const center = new T.Vector3(); box3.getCenter(center)
  const min = box3.min
  if (size.x > 0 && size.y > 0 && size.z > 0) {
    const sx = wM / size.x
    const sy = hM / size.y
    const szf = dM / size.z
    group.scale.set(sx, sy, szf)
    // Keep X/Z centered, place bottom at floor Y=0.
    group.position.set(-center.x * sx, -min.y * sy, -center.z * szf)
  }
}

function itemTo3D(item) {
  // item.x, item.y = top-left corner in 2D canvas pixels
  // OX2D, OY2D = room origin offset in canvas pixels
  // GRID2D = pixels per metre
  // Result: 3D world position of the item's centre
  const wM = item.widthM  || (item.w / GRID2D)
  const dM = item.depthM  || (item.d / GRID2D)
  const x3d = (item.x - OX2D) / GRID2D + wM / 2
  const z3d = (item.y - OY2D) / GRID2D + dM / 2
  return {
    x: x3d,
    z: z3d,
    ry: -(item.rotation || 0) * Math.PI / 180,
  }
}

// Reverse: 3D world centre → 2D canvas top-left corner
function item3DTo2D(x3d, z3d, wM, dM) {
  return {
    x: Math.round((x3d - wM / 2) * GRID2D + OX2D),
    y: Math.round((z3d - dM / 2) * GRID2D + OY2D),
  }
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)) }
function clamp3DPosition(item, cfg, x3d, z3d) {
  const wM = item.widthM || (item.w / GRID2D)
  const dM = item.depthM || (item.d / GRID2D)
  const dims = roomDims(cfg)
  const minX = wM / 2
  const minZ = dM / 2
  const maxX = Math.max(minX, dims.W - wM / 2)
  const maxZ = Math.max(minZ, dims.D - dM / 2)
  return {
    x: clamp(x3d, minX, maxX),
    z: clamp(z3d, minZ, maxZ),
  }
}

function applyOrbit(camera, o) {
  if (!camera) return
  camera.position.set(
    o.tx + o.radius * Math.sin(o.phi) * Math.sin(o.theta),
    o.ty + o.radius * Math.cos(o.phi),
    o.tz + o.radius * Math.sin(o.phi) * Math.cos(o.theta),
  )
  camera.lookAt(o.tx, o.ty, o.tz)
}

export default function Workspace3D() {
  const { id } = useParams()
  const navigate = useNavigate()
  const mountRef  = useRef(null)
  const rdrRef    = useRef(null)
  const sceneRef  = useRef(null)
  const camRef    = useRef(null)
  const frameRef  = useRef(null)
  const fGroupRef = useRef(null)
  const ovGroupRef = useRef(null)  // ← overlay group for doors/windows
  const TRef      = useRef(null)
  const orbitRef  = useRef({ theta: 0.7, phi: 0.62, radius: 8, tx: 2.5, ty: 1.4, tz: 2 })
  const ptrRef    = useRef({ down: false, moved: false, x: 0, y: 0, button: 0 })
  const dragFurnRef = useRef(null)
  const dragRafRef = useRef(null)
  const modelCacheRef = useRef(new Map()) // modelUrl -> Promise<THREE.Group>

  // ── Shared design store — read live data from 2D workspace ──
  const designStore = useDesignStore()

  const [loading,     setLoading]     = useState(true)
  const [project,     setProject]     = useState(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [cfg,         setCfg]         = useState({})
  const [items,       setItems]       = useState([])
  const [overlays,    setOverlays]    = useState({ doors: [], windows: [], curtains: [] })
  const [customModels,setCustomModels]= useState([])
  const [dirty,       setDirty]       = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [selectedId,  setSelectedId]  = useState(null)
  const wallMode = designStore.wallMode || 'solid'
  const setWallMode = designStore.setWallMode
  const [showCeiling, setShowCeiling] = useState(false)
  const [showShadows, setShowShadows] = useState(true)
  const [showGrid,    setShowGrid]    = useState(false)
  const [ambientInt,  setAmbientInt]  = useState(0.6)
  const [sunInt,      setSunInt]      = useState(1.1)
  // Rendering quality is fixed to "best" (no dropdown)
  const cfgRef      = useRef(cfg);         useEffect(() => { cfgRef.current = cfg }, [cfg])
  const itemsRef    = useRef(items);       useEffect(() => { itemsRef.current = items }, [items])
  const overlaysRef = useRef(overlays);    useEffect(() => { overlaysRef.current = overlays }, [overlays])
  const wallModeRef = useRef(wallMode);    useEffect(() => { wallModeRef.current = wallMode }, [wallMode])
  const ceilRef     = useRef(showCeiling); useEffect(() => { ceilRef.current = showCeiling }, [showCeiling])
  const shadowRef   = useRef(showShadows); useEffect(() => { shadowRef.current = showShadows }, [showShadows])
  const gridRef     = useRef(showGrid);    useEffect(() => { gridRef.current = showGrid }, [showGrid])
  const selectedIdRef = useRef(selectedId); useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  // ── On mount: pull latest data from shared store (set by 2D workspace) ──
  useEffect(() => {
    designStore.syncFromStorage()
  }, []) // eslint-disable-line

  // If 2D and 3D are open in different tabs/windows, keep in sync in real time.
  useEffect(() => {
    const onStorage = (e) => {
      if (!e?.key) return
      if (e.key.startsWith('rc_design_')) designStore.syncFromStorage()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, []) // eslint-disable-line

  // ── Keep local state in sync with shared store ──
  useEffect(() => {
    if (designStore.items.length > 0 || items.length === 0) setItems(designStore.items)
  }, [designStore.items]) // eslint-disable-line
  useEffect(() => {
    setOverlays(designStore.overlays)
  }, [designStore.overlays]) // eslint-disable-line
  useEffect(() => {
    if (designStore.cfg && Object.keys(designStore.cfg).length > 0) setCfg(designStore.cfg)
  }, [designStore.cfg]) // eslint-disable-line
  useEffect(() => {
    setCustomModels(designStore.customModels || [])
  }, [designStore.customModels]) // eslint-disable-line

  useEffect(() => {
    setLoading(true)
    projectsApi.getById(id).then(p => {
      setProject(p)
      let c = {}, its = [], ov = { doors: [], windows: [], curtains: [] }
      let viewOptions = { wallMode:'solid', showCeiling:false, showShadows:true, showGrid:false }
      try { c = JSON.parse(p.roomConfig) } catch {}
      try {
        const l = JSON.parse(p.furnitureLayout)
        if (l?.items) {
          its = l.items; ov = l.overlays || ov
          if (l.viewOptions) viewOptions = { ...viewOptions, ...l.viewOptions }
        } else if (Array.isArray(l)) {
          its = l
        }
      } catch {}
      setCfg(c); setItems(its); setOverlays(ov)
      setShowCeiling(!!viewOptions.showCeiling)
      setShowShadows(viewOptions.showShadows ?? true)
      setShowGrid(!!viewOptions.showGrid)
      if (viewOptions.wallMode) setWallMode(viewOptions.wallMode)
    }).catch(() => { toast.error('Failed to load project'); navigate('/projects') }).finally(() => setLoading(false))
  }, [id]) // eslint-disable-line

  useEffect(() => {
    if (loading || !mountRef.current) return
    let alive = true
    import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js').then(T => {
      if (!alive || !mountRef.current) return
      TRef.current = T
      const mount = mountRef.current
      const W = mount.clientWidth || 900, H = mount.clientHeight || 600
      const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5)); renderer.setSize(W, H)
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35
      renderer.outputEncoding = T.sRGBEncoding
      renderer.physicallyCorrectLights = true
      renderer.shadowMap.type = T.VSMShadowMap 
      mount.appendChild(renderer.domElement); rdrRef.current = renderer
      const scene = new T.Scene()
      scene.background = new T.Color(0x16192e)
      scene.fog = new T.Fog(0x16192e, 14, 38)  
      sceneRef.current = scene
      // High-end "studio" environment lighting for better realism on PBR materials.
      import('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/environments/RoomEnvironment.js')
        .then(({ RoomEnvironment }) => {
          try {
            const pmrem = new T.PMREMGenerator(renderer)
            const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
            scene.environment = envTex
            pmrem.dispose()
          } catch {}
        })
        .catch(() => {})
      // Larger near plane + tighter far plane improves depth precision and reduces z-fighting flicker.
      const dims0 = roomDims(cfgRef.current)
      const far0 = Math.max(dims0.W, dims0.D) * 12
      const camera = new T.PerspectiveCamera(52, W / H, 0.35, Math.max(40, Math.min(160, far0))); camRef.current = camera
      const amb = new T.AmbientLight(0xffe8cc, ambientInt * 0.85); amb.name = 'ambient'; scene.add(amb)
      // Primary sun — warm afternoon light
      const sun = new T.DirectionalLight(0xfff0d0, sunInt * 1.1); sun.name = 'sun'
      sun.position.set(8, 14, 5); sun.castShadow = true
      sun.shadow.mapSize.set(4096, 4096)
      sun.shadow.camera.near = 0.5
      sun.shadow.camera.far = Math.max(30, Math.min(120, Math.max(dims0.W, dims0.D) * 8))
      const shadowSize = Math.max(dims0.W, dims0.D) * 2.6
      sun.shadow.camera.left = sun.shadow.camera.bottom = -shadowSize
      sun.shadow.camera.right = sun.shadow.camera.top = shadowSize
      sun.shadow.bias = -0.0008
      sun.shadow.normalBias = 0.04
      scene.add(sun)
      // Cool sky fill from opposite side
      const fill = new T.DirectionalLight(0xb0ccff, 0.42); fill.position.set(-6, 4, -4); scene.add(fill)
      // Bounce light from floor (warm)
      const bounce = new T.DirectionalLight(0xffddb0, 0.18); bounce.position.set(0, -1, 0); scene.add(bounce)
      // Warm accent point (lamp-like)
      const pt1 = new T.PointLight(0xffcc88, 0.9, 12); pt1.position.set(2, 2.6, 2); pt1.castShadow = false; scene.add(pt1)
      // Cool hemisphere for ambient sky/ground contrast
      const hemi = new T.HemisphereLight(0xd0e8ff, 0xffe0b0, 0.35); hemi.position.set(0, 8, 0); scene.add(hemi)
      scene.add(buildRoom(T, cfgRef.current, { wallMode: wallModeRef.current, showCeiling: ceilRef.current, showShadows: shadowRef.current, showGrid: gridRef.current }))
      const fGroup = new T.Group(); fGroup.name = 'furniture'; scene.add(fGroup); fGroupRef.current = fGroup
      const ovGroup = new T.Group(); ovGroup.name = 'overlays'; scene.add(ovGroup); ovGroupRef.current = ovGroup
      populateFurniture(T, fGroup, itemsRef.current, shadowRef.current)
      populateOverlays(T, ovGroup, overlaysRef.current, cfgRef.current)
      const dims = roomDims(cfgRef.current)
      orbitRef.current = { theta: 0.7, phi: 0.62, radius: Math.max(dims.W, dims.D) * 1.7, tx: dims.W / 2, ty: dims.H * 0.5, tz: dims.D / 2 }
      applyOrbit(camera, orbitRef.current)
      const ro = new ResizeObserver(() => { const w = mount.clientWidth, h = mount.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix() })
      ro.observe(mount)
      const loop = () => { if (!alive) return; frameRef.current = requestAnimationFrame(loop); renderer.render(scene, camera) }
      loop()
      return () => { alive = false; cancelAnimationFrame(frameRef.current); ro.disconnect(); if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement); renderer.dispose(); rdrRef.current = null; sceneRef.current = null; camRef.current = null }
    })
    return () => { alive = false }
  }, [loading]) // eslint-disable-line

  useEffect(() => {
    const scene = sceneRef.current; if (!scene) return
    const rdr = rdrRef.current
    import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js').then(T => {
      // Toggle renderer shadow map
      if (rdr) {
        rdr.shadowMap.enabled = showShadows
        rdr.shadowMap.needsUpdate = true
      }
      // Toggle sun shadow casting
      const sun = scene.getObjectByName('sun')
      if (sun) {
        sun.castShadow = showShadows
      }
      // Toggle all mesh shadows in scene
      scene.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow = showShadows
          obj.receiveShadow = showShadows
        }
      })
      // Rebuild room geometry
      const old = scene.getObjectByName('room'); if (old) scene.remove(old)
      scene.add(buildRoom(T, cfg, { wallMode, showCeiling, showShadows, showGrid }))
    })
  }, [cfg, wallMode, showCeiling, showShadows, showGrid])

  useEffect(() => {
    const scene = sceneRef.current; if (!scene) return
    const rdr = rdrRef.current
    import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js').then(T => {
      // Toggle renderer shadow map
      if (rdr) {
        rdr.shadowMap.enabled = showShadows
        rdr.shadowMap.needsUpdate = true
      }
      // Toggle sun shadow casting
      const sun = scene.getObjectByName('sun')
      if (sun) {
        sun.castShadow = showShadows
      }
      // Toggle all mesh shadows in scene
      scene.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow = showShadows
          obj.receiveShadow = showShadows
        }
      })
      // Rebuild room geometry
      const old = scene.getObjectByName('room'); if (old) scene.remove(old)
      scene.add(buildRoom(T, cfg, { wallMode, showCeiling, showShadows, showGrid }))
    })
  }, [cfg, wallMode, showCeiling, showShadows, showGrid])

  useEffect(() => {
    const og = ovGroupRef.current; if (!og) return
    import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js').then(T => {
      while (og.children.length) og.remove(og.children[0])
      populateOverlays(T, og, overlays, cfg)
    })
  }, [overlays, cfg]) // eslint-disable-line

  useEffect(() => {
    const scene = sceneRef.current; if (!scene) return
    const a = scene.getObjectByName('ambient'), s = scene.getObjectByName('sun')
    if (a) a.intensity = ambientInt; if (s) s.intensity = sunInt
  }, [ambientInt, sunInt])

  async function loadModelFromUrl(T, url) {
    if (!url) throw new Error('Missing modelUrl')
    const cache = modelCacheRef.current
    if (cache.has(url)) return cache.get(url)

    const p = (async () => {
      const ext = (url.split('?')[0].split('#')[0].split('.').pop() || '').toLowerCase()
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`)
      const buf = await res.arrayBuffer()

      if (ext === 'obj') {
        const text = new TextDecoder().decode(buf)
        const geo = parseOBJ(T, text)
        // NOTE: OBJ alone doesn't carry materials/textures reliably (needs .mtl + images).
        // We keep a neutral material; to preserve "exact colors/textures", prefer GLB.
        const mat = new T.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.75, metalness: 0.02 })
        const m = new T.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true
        const g = new T.Group(); g.add(m)
        return g
      }

      // Default to GLB parser (also covers ext-less /files/{uuid})
      return await parseGLB(T, buf)
    })()

    cache.set(url, p)
    return p
  }

  async function populateFurniture(T, group, its, showShadows = true) {
    for (const item of its) {
      if (item.x == null || item.y == null) continue
      let mesh
      if (item.modelUrl && typeof item.modelUrl === 'string') {
        try {
          const base = await loadModelFromUrl(T, item.modelUrl)
          mesh = base.clone(true)
        } catch (err) {
          console.warn('ModelUrl load failed, using fallback:', err)
          mesh = buildFurnitureMesh(T, item)
        }
      } else if (item.customModelId && item.customModelB64 && item.customModelExt) {
        try {
          const buf = b64ToBuffer(item.customModelB64)
          if (item.customModelExt === 'obj') {
            const text = new TextDecoder().decode(buf)
            const geo = parseOBJ(T, text)
            const color = item.color ? hex2color(T, item.color) : new T.Color(0x8f8f8f)
            const mat = new T.MeshStandardMaterial({ color, roughness: 0.65 })
            const m = new T.Mesh(geo, mat)
            m.castShadow = true; m.receiveShadow = true
            mesh = new T.Group(); mesh.add(m)
          } else {
            mesh = await parseGLB(T, buf)
          }
        } catch (err) {
          console.warn('Custom model parse failed, using fallback:', err)
          mesh = buildFurnitureMesh(T, item)
        }
      } else {
        mesh = buildFurnitureMesh(T, item)
      }

      if (!mesh) mesh = buildFurnitureMesh(T, item)
      mesh.userData.itemId = item.id
      const wM = item.widthM || (item.w / GRID2D)
      const hM = item.heightM || 0.8
      const dM = item.depthM || (item.d / GRID2D)
      scaleModelToFit(T, mesh, wM, hM, dM)

      mesh.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = !!showShadows
          o.receiveShadow = !!showShadows
        }
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          mats.forEach((m) => {
            if (m && 'polygonOffset' in m) {
              m.polygonOffset = true
              m.polygonOffsetFactor = -1
              m.polygonOffsetUnits = -1
            }
            if (m && m.envMapIntensity == null) m.envMapIntensity = 0.9
            ;['map', 'roughnessMap', 'metalnessMap', 'normalMap', 'aoMap', 'emissiveMap'].forEach((k) => {
              const t = m?.[k]
              if (t && typeof t === 'object' && 'anisotropy' in t) t.anisotropy = Math.max(t.anisotropy || 1, 8)
            })
          })
        }
      })

      const pos = itemTo3D(item)
      const elevation = Math.max(0, Math.min((cfg.height||2.8) - hM, item.elevationM || 0))
      mesh.position.set(pos.x, elevation, pos.z)
      mesh.rotation.y = pos.ry
      group.add(mesh)

      // Yield occasionally to keep UI responsive when many models load.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  const syncFurnitureTransforms = useCallback(() => {
    const fg = fGroupRef.current
    if (!fg) return
    const currentItems = itemsRef.current || []
    const roomHeight = cfgRef.current?.height || 2.8
    for (const mesh of fg.children) {
      if (!mesh.userData?.itemId) continue
      const item = currentItems.find(i => i.id === mesh.userData.itemId)
      if (!item) continue
      const pos = itemTo3D(item)
      const maxLift = Math.max(0, roomHeight - (item.heightM || 0.8))
      const elevation = clamp((item.elevationM || 0), 0, maxLift)
      mesh.position.set(pos.x, elevation, pos.z)
      mesh.rotation.y = pos.ry
    }
  }, [])

  useEffect(() => {
    syncFurnitureTransforms()
  }, [items, cfg.height, syncFurnitureTransforms])

  // ── Render doors, windows, curtains in 3D ──────────────────────────────────
  function populateOverlays(T, group, ovs, roomCfg) {
    const H = (roomCfg?.height) || 2.8
    const WALL_THICK = 0.12
    const SURFACE_EPS = 0.03
    const doorMatBase = new T.MeshStandardMaterial({ color: 0xc8965a, roughness: 0.75, metalness: 0, side: T.DoubleSide })
    const doorFrameMatBase = new T.MeshStandardMaterial({ color: 0x8a6030, roughness: 0.8, side: T.DoubleSide })
    const glassMatBase = new T.MeshStandardMaterial({ color: 0x88bbee, roughness: 0.02, metalness: 0.05, transparent: true, opacity: 0.32, side: T.DoubleSide })
    const frameMatBase = new T.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.5, metalness: 0.3, side: T.DoubleSide })
    const handleMat = new T.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.2, metalness: 0.85 })
    const curtainMat = (hexColor, opacity = 1) => new T.MeshStandardMaterial({
      color: hex2color(T, hexColor || '#fca5a5'),
      roughness: 0.95,
      side: T.DoubleSide,
      transparent: opacity < 1,
      opacity,
    })

    const box3d = (w, h, d, mat) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m }

    // Apply polygon offset so overlays don't z-fight with wall surfaces.
    ;[doorMatBase, doorFrameMatBase, glassMatBase, frameMatBase, handleMat].forEach(m => {
      m.polygonOffset = true
      m.polygonOffsetFactor = -2
      m.polygonOffsetUnits = -2
    })

    // Doors
    for (const d of (ovs?.doors || [])) {
      const doorMat = doorMatBase.clone()
      const doorFrameMat = doorFrameMatBase.clone()
      if (d.color) doorMat.color = hex2color(T, d.color)
      if (d.frameColor) doorFrameMat.color = hex2color(T, d.frameColor)

      const dW = (d.w || 80) / GRID2D
      // Door height is now independent from room height (clamped to fit).
      const dH = Math.min(H - 0.1, Math.max(1.6, d.heightM != null ? +d.heightM : 2.1))
      const g = new T.Group()

      // Door panel (wood)
      const panel = box3d(dW, dH, WALL_THICK + SURFACE_EPS * 2, doorMat)
      panel.position.set(dW / 2, dH / 2, 0)
      g.add(panel)

      // Decorative inset panels (adds realism)
      const insetMat = new T.MeshStandardMaterial({ color: 0xb98348, roughness: 0.78, metalness: 0.02, side: T.DoubleSide })
      const insetDepth = WALL_THICK * 0.25
      const insetW = dW * 0.78
      const insetH = dH * 0.26
      ;[-0.18, 0.18].forEach((oy) => {
        const ip = box3d(insetW, insetH, insetDepth, insetMat)
        ip.position.set(dW / 2, dH * (0.52 + oy), WALL_THICK * 0.15)
        g.add(ip)
      })

      // Door frame (3 sides) - make it thicker & correctly aligned (no top gap)
      const fT = 0.075
      const fDepth = WALL_THICK + 0.06
      ;[
        [dW / 2, dH + fT / 2, 0, dW + fT * 2, fT, fDepth],        // top
        [-fT / 2, dH / 2, 0, fT, dH + fT, fDepth],                // left
        [dW + fT / 2, dH / 2, 0, fT, dH + fT, fDepth],            // right
      ].forEach(([x, y, z, w, h, de]) => {
        const fm = box3d(w, h, de, doorFrameMat)
        fm.position.set(x, y, z); g.add(fm)
      })

      // Handle
      const handle = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.1, 8), handleMat)
      handle.rotation.z = Math.PI / 2
      handle.position.set(dW - 0.12, dH * 0.48, 0.04)
      g.add(handle)
      const latch = box3d(0.03, 0.015, 0.06, handleMat)
      latch.position.set(dW - 0.1, dH * 0.48, 0.03)
      g.add(latch)

      // Swing arc indicator (thin flat quarter circle at ground)
      const arcMat = new T.MeshStandardMaterial({ color: 0x999999, roughness: 1, transparent: true, opacity: 0.2, side: T.DoubleSide })
      const arcGeo = new T.RingGeometry(dW - 0.02, dW, 16, 1, 0, Math.PI / 2)
      arcGeo.rotateX(-Math.PI / 2)
      const arc = new T.Mesh(arcGeo, arcMat)
      arc.position.set(0, 0.005, 0)
      g.add(arc)

      // Position from 2D coords
      const x3d = (d.x - OX2D) / GRID2D
      const z3d = (d.y - OY2D) / GRID2D
      g.position.set(x3d, 0, z3d)
      g.rotation.y = -(d.rotation || 0) * Math.PI / 180
      // Tiny push off the wall plane to eliminate z-fighting (still visible from both sides due to thickness).
      const off = new T.Vector3(0, 0, 0.006).applyAxisAngle(new T.Vector3(0, 1, 0), g.rotation.y)
      g.position.add(off)
      group.add(g)
    }

    // Windows
    for (const w of (ovs?.windows || [])) {
      const glassMat = glassMatBase.clone()
      const frameMat = frameMatBase.clone()
      if (w.glassTint) glassMat.color = hex2color(T, w.glassTint)
      if (w.frameColor) frameMat.color = hex2color(T, w.frameColor)

      const wW = (w.w || 100) / GRID2D
      // Window size/position independent from room height (clamped to fit).
      const wH = Math.min(H - 0.2, Math.max(0.4, w.heightM != null ? +w.heightM : 1.2))
      const wY = Math.max(0, Math.min(H - wH - 0.05, w.sillM != null ? +w.sillM : 0.9))
      const g = new T.Group()

      // Glass pane
      const glass = box3d(wW, wH, WALL_THICK + SURFACE_EPS * 2, glassMat)
      glass.position.set(0, wY + wH / 2, 0)
      glass.renderOrder = 2
      if (glass.material) glass.material.depthWrite = false
      g.add(glass)

      // Frame: top, bottom, left, right
      const fT = 0.045
      ;[
        [0, wY + wH + fT / 2, 0, wW + fT * 2, fT, fT],          // top
        [0, wY - fT / 2, 0, wW + fT * 2, fT, fT],                // bottom (sill)
        [-(wW / 2 + fT / 2), wY + wH / 2, 0, fT, wH + fT * 2, fT],  // left
        [wW / 2 + fT / 2, wY + wH / 2, 0, fT, wH + fT * 2, fT],     // right
      ].forEach(([x, y, z, fw, fh, fd]) => {
        const fm = box3d(fw, fh, WALL_THICK + 0.02, frameMat)
        fm.position.set(x, y, z); g.add(fm)
      })

      // Center cross divider
      const mull = new T.MeshStandardMaterial({
        color: frameMat.color.clone().multiplyScalar(0.92),
        roughness: 0.45,
        metalness: 0.25,
        side: T.DoubleSide
      })
      const cv = box3d(0.03, wH, WALL_THICK + 0.02, mull); cv.position.set(0, wY + wH / 2, 0); cv.renderOrder = 1; g.add(cv)
      const ch = box3d(wW, 0.03, WALL_THICK + 0.02, mull); ch.position.set(0, wY + wH / 2, 0); ch.renderOrder = 1; g.add(ch)

      // Sill ledge
      const sillMat = new T.MeshStandardMaterial({ color: frameMat.color.clone().multiplyScalar(0.82), roughness: 0.65, metalness: 0.15, side: T.DoubleSide })
      const sill = box3d(wW + 0.12, 0.04, 0.1, sillMat)
      sill.position.set(0, wY - 0.02, 0.04)
      g.add(sill)
      // Small side trim blocks for depth cues
      const trim = new T.MeshStandardMaterial({ color: frameMat.color.clone().multiplyScalar(0.9), roughness: 0.6, metalness: 0.2, side: T.DoubleSide })
      const t1 = box3d(0.035, wH + 0.06, 0.08, trim); t1.position.set(-wW / 2 - 0.035, wY + wH / 2, 0.03); g.add(t1)
      const t2 = box3d(0.035, wH + 0.06, 0.08, trim); t2.position.set(wW / 2 + 0.035, wY + wH / 2, 0.03); g.add(t2)

      // Position
      const x3d = (w.x - OX2D) / GRID2D
      const z3d = (w.y - OY2D) / GRID2D
      g.position.set(x3d, 0, z3d)
      g.rotation.y = -(w.rotation || 0) * Math.PI / 180
      const off = new T.Vector3(0, 0, 0.006).applyAxisAngle(new T.Vector3(0, 1, 0), g.rotation.y)
      g.position.add(off)
      group.add(g)
    }

    // Curtains
    for (const c of (ovs?.curtains || [])) {
      const cW = (c.w || 120) / GRID2D
      const cH = H * 0.85
      const g = new T.Group()
      const style = (c.style || 'standard').toLowerCase()
      const op = style === 'sheer' ? 0.65 : style === 'blackout' ? 1 : 0.9
      const cMat = curtainMat(c.color, op)

      // Two curtain panels with drape shape using box with scale
      const panelW = cW * 0.42
      ;[-cW * 0.26, cW * 0.26].forEach((ox) => {
        const panel = new T.Mesh(new T.BoxGeometry(panelW, cH, 0.03), cMat)
        panel.position.set(ox, cH / 2, 0)
        // Slight taper toward bottom
        panel.scale.set(1, 1, 1)
        g.add(panel)
      })

      // Curtain rod
      const rod = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, cW + 0.14, 8),
        new T.MeshStandardMaterial({ color: 0x888888, roughness: 0.2, metalness: 0.8 }))
      rod.rotation.z = Math.PI / 2
      rod.position.set(0, cH + 0.02, 0)
      g.add(rod)

      // Rod end caps
      ;[-cW / 2 - 0.07, cW / 2 + 0.07].forEach(ex => {
        const cap = new T.Mesh(new T.SphereGeometry(0.025, 8, 8),
          new T.MeshStandardMaterial({ color: 0x777777, metalness: 0.9, roughness: 0.1 }))
        cap.position.set(ex, cH + 0.02, 0)
        g.add(cap)
      })

      const x3d = (c.x - OX2D) / GRID2D
      const z3d = (c.y - OY2D) / GRID2D
      g.position.set(x3d, 0, z3d)
      g.rotation.y = -(c.rotation || 0) * Math.PI / 180
      const off = new T.Vector3(0, 0, 0.006).applyAxisAngle(new T.Vector3(0, 1, 0), g.rotation.y)
      g.position.add(off)
      group.add(g)
    }
  }

  const raycastFloor = (T, cx, cy) => {
    const rdr = rdrRef.current, cam = camRef.current; if (!rdr || !cam) return null
    const rect = rdr.domElement.getBoundingClientRect()
    const ndc = new T.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
    const ray = new T.Raycaster(); ray.setFromCamera(ndc, cam)
    const plane = new T.Plane(new T.Vector3(0, 1, 0), 0)
    const target = new T.Vector3()
    const hit = ray.ray.intersectPlane(plane, target)
    return hit ? target : null
  }

  const ensureDragProxy = (T, fg, mesh) => {
    // Create a lightweight proxy box for dragging heavy models.
    const box3 = new T.Box3().setFromObject(mesh)
    const sz = new T.Vector3(); box3.getSize(sz)
    if (!Number.isFinite(sz.x) || !Number.isFinite(sz.z) || sz.x <= 0 || sz.z <= 0) return null
    const geo = new T.BoxGeometry(Math.max(0.08, sz.x), 0.02, Math.max(0.08, sz.z))
    const mat = new T.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.25 })
    const proxy = new T.Mesh(geo, mat)
    proxy.position.set(mesh.position.x, 0.01, mesh.position.z)
    proxy.renderOrder = 10
    fg.add(proxy)
    return proxy
  }

  const onPointerDown = useCallback(e => {
    ptrRef.current = { down: true, moved: false, x: e.clientX, y: e.clientY, button: e.button }
    if (mountRef.current) mountRef.current.setPointerCapture?.(e.pointerId)
    e.preventDefault()
    if (e.button !== 0) return
    const T = TRef.current; const rdr = rdrRef.current; const cam = camRef.current; const fg = fGroupRef.current
    if (!T || !rdr || !cam || !fg) return
    const rect = rdr.domElement.getBoundingClientRect()
    const ndc = new T.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    const ray = new T.Raycaster(); ray.setFromCamera(ndc, cam)
    const hits = ray.intersectObjects(fg.children, true)
    if (hits.length) {
      let o = hits[0].object
      while (o && !o.userData?.itemId && o.parent && o.parent !== fg) o = o.parent
      if (o?.userData?.itemId) {
        setSelectedId(o.userData.itemId)
        const floorPt = raycastFloor(T, e.clientX, e.clientY)
        if (floorPt) {
          const proxy = ensureDragProxy(T, fg, o) || null
          dragFurnRef.current = {
            itemId: o.userData.itemId,
            mesh: o,
            proxy,
            offsetX: o.position.x - floorPt.x,
            offsetZ: o.position.z - floorPt.z,
          }
        }
      }
    } else {
      setSelectedId(null)
    }
  }, []) // eslint-disable-line

  const onPointerMove = useCallback(e => {
    const p = ptrRef.current; if (!p.down) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    p.moved = true; p.x = e.clientX; p.y = e.clientY

    if (dragFurnRef.current) {
      // Throttle heavy raycasts & updates to one per animation frame.
      const T = TRef.current; if (!T) return
      dragFurnRef.current.lastClientX = e.clientX
      dragFurnRef.current.lastClientY = e.clientY
      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = null
          const d = dragFurnRef.current
          if (!d) return
          const floorPt = raycastFloor(T, d.lastClientX, d.lastClientY)
          if (!floorPt) return
          const candidateX = floorPt.x + d.offsetX
          const candidateZ = floorPt.z + d.offsetZ
          const item = itemsRef.current.find(i => i.id === d.itemId)
          const bounds = item ? clamp3DPosition(item, cfgRef.current, candidateX, candidateZ) : { x: candidateX, z: candidateZ }
          d.mesh.position.x = bounds.x
          d.mesh.position.z = bounds.z
          if (d.proxy) {
            d.proxy.position.x = bounds.x
            d.proxy.position.z = bounds.z
          }
          d.pendingX3d = bounds.x
          d.pendingZ3d = bounds.z
          d.hasPending = true
        })
      }
      return
    }

    if (p.button === 0 && !e.shiftKey) {
      orbitRef.current.theta -= dx * 0.007
      orbitRef.current.phi = Math.max(0.05, Math.min(Math.PI * 0.48, orbitRef.current.phi - dy * 0.007))
    } else {
      const sc = orbitRef.current.radius * 0.0014
      orbitRef.current.tx -= dx * sc * Math.cos(orbitRef.current.theta)
      orbitRef.current.tz -= dx * sc * Math.sin(orbitRef.current.theta)
      orbitRef.current.ty += dy * sc
    }
    applyOrbit(camRef.current, orbitRef.current)
  }, []) // eslint-disable-line

  const onPointerUp = useCallback(e => {
    const p = ptrRef.current
    if (dragFurnRef.current) {
      // Commit buffered 3D position to items state (and back-convert to exact 2D coords)
      if (dragFurnRef.current.hasPending) {
        const { itemId, pendingX3d, pendingZ3d } = dragFurnRef.current
        setItems(prev => {
          const next = prev.map(i => {
            if (i.id !== itemId) return i
            const wM = i.widthM || (i.w / GRID2D)
            const dM = i.depthM || (i.d / GRID2D)
            const clamped3D = clamp3DPosition(i, cfgRef.current, pendingX3d, pendingZ3d)
            const coords2d = item3DTo2D(clamped3D.x, clamped3D.z, wM, dM)
            return { ...i, x: coords2d.x, y: coords2d.y }
          })
          designStore.setItems(next)  // sync to 2D
          return next
        })
        setDirty(true)
      }
      // Restore proxies and commit final mesh visibility
      const d = dragFurnRef.current
      try {
        if (d?.proxy && d?.proxy.parent) {
          d.proxy.parent.remove(d.proxy)
          d.proxy.geometry?.dispose?.()
          d.proxy.material?.dispose?.()
        }
      } catch {}
      dragFurnRef.current = null
    }
    p.down = false
  }, []) // eslint-disable-line

  const onWheel = useCallback(e => {
    e.preventDefault()
    orbitRef.current.radius = Math.max(0.4, Math.min(28, orbitRef.current.radius * (e.deltaY > 0 ? 1.1 : 0.91)))
    applyOrbit(camRef.current, orbitRef.current)
  }, [])

  const resetCamera = useCallback(() => {
    const dims = roomDims(cfg)
    orbitRef.current = { theta: 0.7, phi: 0.62, radius: Math.max(dims.W, dims.D) * 1.7, tx: dims.W / 2, ty: dims.H * 0.5, tz: dims.D / 2 }
    applyOrbit(camRef.current, orbitRef.current)
  }, [cfg])

  const moveItem = useCallback((axis, delta) => {
    if (!selectedId) return
    setItems(prev => prev.map(i => {
      if (i.id !== selectedId) return i
      if (axis === 'x') return { ...i, x: (i.x || 0) + delta * GRID2D }
      if (axis === 'z') return { ...i, y: (i.y || 0) + delta * GRID2D }
      if (axis === 'ry') return { ...i, rotation: ((i.rotation || 0) + delta * 90 + 360) % 360 }
      return i
    }))
    setDirty(true)
  }, [selectedId])

  const liftItem = useCallback((deltaMeters) => {
    if (!selectedId) return
    setItems(prev => prev.map(i => {
      if (i.id !== selectedId) return i
      const maxLift = Math.max(0, (cfg.height || 2.8) - (i.heightM || 0.8))
      const next = clamp((i.elevationM || 0) + deltaMeters, 0, maxLift)
      return { ...i, elevationM: next }
    }))
    setDirty(true)
  }, [selectedId, cfg.height])

  useEffect(() => {
    const h = e => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === 'r' || e.key === 'R') resetCamera()
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [resetCamera])

  const save = async () => {
    setSaving(true)
    try {
      await projectsApi.update(id, { roomConfig: JSON.stringify(cfg), furnitureLayout: JSON.stringify({ items, overlays, customModels, viewOptions: { wallMode, showCeiling, showShadows, showGrid } }) })
      designStore.setItems(items)
      designStore.setOverlays(overlays)
      designStore.setCfg(cfg)
      designStore.setCustomModels(customModels)
      setDirty(false); toast.success('Saved!')
    }
    catch { toast.error('Save failed') } finally { setSaving(false) }
  }

  useEffect(() => {
    const handler = async () => {
      try {
        await save()
      } catch (e) {
        console.warn('Event save failed', e)
      }
    }
    window.addEventListener('roomcraft-save-request', handler)
    return () => window.removeEventListener('roomcraft-save-request', handler)
  }, [save])

  // ── Auto-save: debounce 1.5s after any change ──
  const autoSaveTimer = useRef(null)
  useEffect(() => {
    if (!dirty) return
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await projectsApi.update(id, { roomConfig: JSON.stringify(cfg), furnitureLayout: JSON.stringify({ items, overlays, customModels }) })
        setDirty(false)
      } catch (e) { console.warn('Auto-save failed', e) }
    }, 1500)
    return () => clearTimeout(autoSaveTimer.current)
  }, [dirty, items, overlays, customModels, cfg, id]) // eslint-disable-line

  const selectedItem = items.find(i => i.id === selectedId)

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#1a2035] flex-col gap-4">
      <div className="w-10 h-10 border-4 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      <p className="text-purple-200 text-sm font-medium">Loading 3D scene…</p>
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-[#1a2035] overflow-hidden select-none">
      <div className="h-14 bg-[#0f1628]/95 backdrop-blur border-b border-white/10 flex items-center px-3 gap-2 flex-shrink-0 z-20">
        <button onClick={() => navigate(`/workspace/2d/${id}`)} className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 flex items-center gap-1 text-sm flex-shrink-0">
          <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">2D Edit</span>
        </button>
        <div className="h-5 w-px bg-white/10 flex-shrink-0" />
        {isEditingName ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={async () => {
              setIsEditingName(false)
              const next = nameDraft.trim() || 'Untitled'
              setProject((p) => p ? { ...p, name: next } : p)
              try {
                await projectsApi.update(id, {
                  name: next,
                  roomConfig: JSON.stringify(cfg),
                  furnitureLayout: JSON.stringify({ items, overlays, customModels }),
                })
                setProject((p) => p ? { ...p, name: next } : p)
              } catch (err) {
                toast.error('Failed to rename project')
              }
            }}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setIsEditingName(false)
            }}
            className="w-40 bg-slate-900/10 border border-slate-300 rounded px-2 py-1 text-xs text-white"
          />
        ) : (
          <span
            className="font-semibold text-white text-sm truncate max-w-[120px] flex-shrink-0 cursor-pointer hover:text-purple-200"
            onClick={() => { setNameDraft(project?.name || ''); setIsEditingName(true) }}
            title="Click to rename"
          >{project?.name || 'Untitled'}</span>
        )}
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30 flex-shrink-0">3D</span>
        {dirty && <span className="text-xs text-amber-400 flex-shrink-0">● Unsaved</span>}
        <div className="flex-1" />
        <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10 flex-shrink-0">
          {[['solid', 'Solid'], ['transparent', 'Frosted'], ['glass', 'Glass'], ['hidden', 'Hidden']].map(([v, l]) => (
            <button key={v} onClick={() => { setWallMode(v); setDirty(true) }} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${wallMode === v ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>{l}</button>
          ))}
        </div>
        <div className="h-5 w-px bg-white/10 flex-shrink-0" />
        {[[showCeiling, () => { setShowCeiling(!showCeiling); setDirty(true) }, Layers, 'Ceiling'],
          [showShadows, () => { setShowShadows(!showShadows); setDirty(true) }, Sun, 'Shadows'],
          [showGrid, () => { setShowGrid(!showGrid); setDirty(true) }, Grid3X3, 'Grid']
        ].map(([on, fn, Icon, label]) => (
          <button key={label} onClick={fn} title={label} className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${on ? 'bg-purple-600/30 text-purple-300' : 'text-slate-500 hover:text-slate-300'}`}><Icon className="w-4 h-4" /></button>
        ))}
        <div className="h-5 w-px bg-white/10 flex-shrink-0" />
        <button onClick={resetCamera} title="Reset camera (R)" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex-shrink-0"><RotateCcw className="w-4 h-4" /></button>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-all disabled:opacity-60 flex-shrink-0">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="hidden sm:inline">Save</span>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <div ref={mountRef} className="flex-1 overflow-hidden touch-none"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          onWheel={onWheel} style={{ cursor: 'grab' }}
        />

        <div className="absolute top-3 right-3 bg-[#0f1628]/85 backdrop-blur rounded-xl border border-white/10 p-3 w-44 z-10 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lighting</p>
          {[['Ambient', ambientInt, setAmbientInt, 0, 1, 0.05], ['Sunlight', sunInt, setSunInt, 0, 3, 0.1]].map(([lbl, val, setter, mn, mx, step]) => (
            <div key={lbl}>
              <label className="text-xs text-slate-500 flex justify-between"><span>{lbl}</span><span className="text-slate-300">{Math.round(val * 100)}%</span></label>
              <input type="range" min={mn} max={mx} step={step} className="w-full accent-purple-500" value={val} onChange={e => setter(+e.target.value)} />
            </div>
          ))}
          <p className="text-xs text-slate-600 pt-1 border-t border-white/5">Click to select · Drag selected item to move</p>
        </div>

        {selectedItem && (
          <div className="absolute bottom-16 right-3 bg-[#0f1628]/90 backdrop-blur rounded-xl border border-purple-500/30 p-3 w-48 z-10">
            <p className="text-xs font-semibold text-purple-300 mb-1 flex items-center gap-1.5 truncate">
              <Box className="w-3.5 h-3.5 flex-shrink-0" /> {selectedItem.label || selectedItem.name}
            </p>
            <p className="text-xs text-slate-500 mb-2">Drag item to reposition · buttons for fine control</p>
            <div className="grid grid-cols-3 gap-1 mb-1">
              <button onClick={() => moveItem('x', -0.1)} className="bg-white/5 hover:bg-white/10 text-white text-base py-2 rounded-lg font-bold">←</button>
              <button onClick={() => moveItem('z', -0.1)} className="bg-white/5 hover:bg-white/10 text-white text-base py-2 rounded-lg font-bold">↑</button>
              <button onClick={() => moveItem('x', 0.1)} className="bg-white/5 hover:bg-white/10 text-white text-base py-2 rounded-lg font-bold">→</button>
              <button onClick={() => moveItem('ry', -1)} className="bg-white/5 hover:bg-white/10 text-purple-300 text-xs py-2 rounded-lg">↺</button>
              <button onClick={() => moveItem('z', 0.1)} className="bg-white/5 hover:bg-white/10 text-white text-base py-2 rounded-lg font-bold">↓</button>
              <button onClick={() => moveItem('ry', 1)} className="bg-white/5 hover:bg-white/10 text-purple-300 text-xs py-2 rounded-lg">↻</button>
            </div>
            <p className="text-xs text-slate-600 text-center">10 cm · ↺↻ rotate 90°</p>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                <span>Lift</span>
                <span>{(selectedItem.elevationM || 0).toFixed(2)} m</span>
              </div>
              <input type="range" min="0" max={Math.max(0.1, (cfg.height || 2.8) - (selectedItem.heightM || 0.8))} step="0.05" value={selectedItem.elevationM || 0} onChange={e => liftItem(+e.target.value - (selectedItem.elevationM || 0))} className="w-full accent-purple-400" />
              <div className="grid grid-cols-2 gap-1 mt-1">
                <button onClick={() => liftItem(-0.1)} className="text-xs text-white py-1 rounded-lg bg-white/5 hover:bg-white/10">Down</button>
                <button onClick={() => liftItem(0.1)} className="text-xs text-white py-1 rounded-lg bg-white/5 hover:bg-white/10">Up</button>
              </div>
            </div>
            <button onClick={() => setSelectedId(null)} className="w-full mt-1.5 text-xs text-slate-500 hover:text-slate-300 py-1 text-center">Deselect</button>
          </div>
        )}

        <div className="absolute bottom-3 left-3 bg-[#0f1628]/80 rounded-lg px-3 py-1.5 text-xs text-slate-400 pointer-events-none border border-white/5">
          Drag: orbit · Shift+drag: pan · Scroll: zoom · R: reset · Click: select · Drag selected: move
        </div>
        <div className="absolute bottom-3 right-3 bg-[#0f1628]/80 rounded-lg px-3 py-1.5 text-xs text-slate-400 pointer-events-none border border-white/5">
          {items.length} items · {cfg.shape || 'rect'} {cfg.width || 5}×{cfg.depth || 4}×{cfg.height || 2.8}m
        </div>
      </div>
    </div>
  )
}