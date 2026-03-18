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
  return makeCanvasTexture(T, 256, (ctx, s) => {
    ctx.fillStyle = '#b8865a'; ctx.fillRect(0,0,s,s)
    for(let i=0;i<30;i++){
      ctx.strokeStyle=`rgba(80,45,15,${Math.random()*0.25+0.05})`
      ctx.lineWidth=Math.random()*2+0.5
      const y=i*(s/28)+Math.random()*4
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(s,y+Math.random()*6-3); ctx.stroke()
    }
    for(let i=0;i<8;i++){
      ctx.strokeStyle=`rgba(120,70,25,${Math.random()*0.12})`
      ctx.lineWidth=0.5
      ctx.beginPath(); ctx.moveTo(Math.random()*s,0); ctx.lineTo(Math.random()*s,s); ctx.stroke()
    }
  })
}
function fabricTex(T, hexColor) {
  return makeCanvasTexture(T, 128, (ctx, s) => {
    const n=parseInt((hexColor||'#93b4fd').replace('#',''),16)
    const r=(n>>16&255), g=(n>>8&255), b=(n&255)
    ctx.fillStyle=hexColor||'#93b4fd'; ctx.fillRect(0,0,s,s)
    ctx.strokeStyle=`rgba(${Math.max(0,r-30)},${Math.max(0,g-30)},${Math.max(0,b-30)},0.3)`
    ctx.lineWidth=1.5
    for(let i=0;i<s;i+=6){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(s,i);ctx.stroke()}
    ctx.strokeStyle=`rgba(${Math.min(255,r+20)},${Math.min(255,g+20)},${Math.min(255,b+20)},0.15)`
    for(let i=0;i<s;i+=6){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,s);ctx.stroke()}
  })
}
function marbleTex(T) {
  return makeCanvasTexture(T, 256, (ctx, s) => {
    ctx.fillStyle='#e8e4de'; ctx.fillRect(0,0,s,s)
    for(let i=0;i<12;i++){
      ctx.strokeStyle=`rgba(160,140,120,${Math.random()*0.18+0.05})`
      ctx.lineWidth=Math.random()*1.5+0.3
      ctx.beginPath(); ctx.moveTo(0,Math.random()*s)
      ctx.bezierCurveTo(s*0.3,Math.random()*s,s*0.7,Math.random()*s,s,Math.random()*s); ctx.stroke()
    }
  })
}
function metalTex(T) {
  return makeCanvasTexture(T, 128, (ctx, s) => {
    ctx.fillStyle='#c0c0c0'; ctx.fillRect(0,0,s,s)
    for(let i=0;i<40;i++){
      ctx.fillStyle=`rgba(${140+Math.random()*60|0},${140+Math.random()*60|0},${140+Math.random()*60|0},0.3)`
      ctx.fillRect(0,i*3,s,2)
    }
  })
}
function concreteTex(T) {
  return makeCanvasTexture(T, 128, (ctx, s) => {
    ctx.fillStyle='#aaaaaa'; ctx.fillRect(0,0,s,s)
    for(let i=0;i<400;i++){
      const x=Math.random()*s,y=Math.random()*s,r=Math.random()*2
      ctx.fillStyle=`rgba(${80+Math.random()*60|0},${80+Math.random()*60|0},${80+Math.random()*60|0},0.18)`
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill()
    }
  })
}
function tileTex(T) {
  return makeCanvasTexture(T, 128, (ctx, s) => {
    ctx.fillStyle='#e0e0e0'; ctx.fillRect(0,0,s,s)
    ctx.strokeStyle='rgba(160,160,160,0.6)'; ctx.lineWidth=2
    for(let i=0;i<=s;i+=32){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(s,i);ctx.stroke()}
    for(let i=0;i<=s;i+=32){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,s);ctx.stroke()}
  })
}

function plasterTex(T) {
  return makeCanvasTexture(T, 256, (ctx, s) => {
    ctx.fillStyle = '#f2f1ea'
    ctx.fillRect(0, 0, s, s)
    // soft speckle
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * s
      const y = Math.random() * s
      const r = Math.random() * 1.8
      const a = Math.random() * 0.06
      ctx.fillStyle = `rgba(120,120,120,${a})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // faint trowel strokes
    ctx.strokeStyle = 'rgba(110,110,110,0.06)'
    ctx.lineWidth = 2
    for (let i = 0; i < 18; i++) {
      const y = (i / 18) * s + (Math.random() * 6 - 3)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(s * 0.3, y + (Math.random() * 16 - 8), s * 0.7, y + (Math.random() * 16 - 8), s, y + (Math.random() * 10 - 5))
      ctx.stroke()
    }
  })
}

function buildFurnitureMesh(T, item) {
  const group = new T.Group(); group.userData.itemId = item.id
  const wM = item.widthM || (item.w / GRID2D)
  const dM = item.depthM || (item.d / GRID2D)
  const hM = item.heightM || 0.8
  const hexColor = item.color || CAT_COLOR[item.category] || '#93b4fd'
  const col = hex2color(T, hexColor)
  const EPS = 0.0025

  // ── Realistic per-category materials ──
  let mainMat, darkMat, lightMat, metalMat, glassMat
  const cat = item.category

  if(cat==='Tables'||cat==='Storage'||cat==='Bedroom') {
    const tex=woodTex(T); tex.repeat.set(2,2)
    mainMat=new T.MeshStandardMaterial({map:tex,roughness:0.75,metalness:0})
    darkMat=new T.MeshStandardMaterial({map:tex,color:new T.Color(0.55,0.35,0.18),roughness:0.8})
  } else if(cat==='Seating') {
    const tex=fabricTex(T,hexColor); tex.repeat.set(3,3)
    mainMat=new T.MeshStandardMaterial({map:tex,roughness:0.95,metalness:0})
    darkMat=new T.MeshStandardMaterial({color:col.clone().multiplyScalar(0.5),roughness:0.9})
  } else if(cat==='Bathroom') {
    mainMat=new T.MeshStandardMaterial({color:0xf2f8fc,roughness:0.08,metalness:0.05})
    darkMat=new T.MeshStandardMaterial({color:0xc8e8f5,roughness:0.05,metalness:0.1})
  } else if(cat==='Kitchen') {
    const tex=metalTex(T); tex.repeat.set(2,2)
    mainMat=new T.MeshStandardMaterial({map:tex,roughness:0.35,metalness:0.65})
    darkMat=new T.MeshStandardMaterial({color:0x888888,roughness:0.25,metalness:0.75})
  } else if(cat==='Lighting') {
    mainMat=new T.MeshStandardMaterial({color:0xbbbbbb,roughness:0.2,metalness:0.85})
    darkMat=mainMat
  } else if(cat==='Office') {
    const tex=woodTex(T); tex.repeat.set(2,1)
    mainMat=new T.MeshStandardMaterial({map:tex,roughness:0.7})
    darkMat=new T.MeshStandardMaterial({color:0x222233,roughness:0.1,metalness:0.3})
  } else if(cat==='Decor') {
    mainMat=new T.MeshStandardMaterial({color:col,roughness:0.88})
    darkMat=new T.MeshStandardMaterial({color:0x2a7a35,roughness:0.95})
  } else {
    mainMat=new T.MeshStandardMaterial({color:col,roughness:0.65,metalness:0.05})
    darkMat=mainMat.clone(); darkMat.color=col.clone().multiplyScalar(0.65)
  }

  lightMat = new T.MeshStandardMaterial({ color:0xffffff, roughness:0.9 })
  metalMat = new T.MeshStandardMaterial({ color:0x999999, roughness:0.25, metalness:0.85 })
  glassMat = new T.MeshStandardMaterial({ color:0x88bbff, roughness:0.05, metalness:0.1, transparent:true, opacity:0.35 })

  const applyMatQuality = (mat) => {
    if (!mat) return
    mat.dithering = true
    mat.polygonOffset = true
    mat.polygonOffsetFactor = -1
    mat.polygonOffsetUnits = -1
    if (mat.envMapIntensity == null) mat.envMapIntensity = 0.85
  }
  ;[mainMat, darkMat, lightMat, metalMat, glassMat].forEach(applyMatQuality)

  const safe = (v) => Math.max(0.001, v - EPS)
  const box = (w, h, d, x, y, z, mat) => {
    const mm = mat || mainMat
    const m = new T.Mesh(new T.BoxGeometry(safe(w), safe(h), safe(d)), mm)
    // Small y-nudge reduces internal z-fighting between stacked parts.
    m.position.set(x, y + EPS, z)
    m.castShadow = true; m.receiveShadow = true
    group.add(m)
    // Edge highlight for "finished" look
    const egeo = new T.EdgesGeometry(m.geometry, 28)
    const el = new T.LineSegments(egeo, new T.LineBasicMaterial({ color: 0x0b1220, transparent: true, opacity: 0.12 }))
    el.position.copy(m.position)
    el.rotation.copy(m.rotation)
    el.scale.copy(m.scale)
    group.add(el)
  }
  const cyl = (rt, rb, h, x, y, z, seg, mat) => { const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg||16),mat||mainMat); m.position.set(x,y,z); m.castShadow=true; group.add(m) }
  const sph = (r, x, y, z, mat) => { const m=new T.Mesh(new T.SphereGeometry(r,12,10),mat||mainMat); m.position.set(x,y,z); m.castShadow=true; group.add(m) }
  const legs = (fw, fd, lh, lr, mat) => { [[-fw/2+lr,lh/2,-fd/2+lr],[-fw/2+lr,lh/2,fd/2-lr],[fw/2-lr,lh/2,-fd/2+lr],[fw/2-lr,lh/2,fd/2-lr]].forEach(([lx,ly,lz])=>box(lr*2,lh,lr*2,lx,ly,lz,mat||darkMat)) }

  const name=(item.name||item.label||'').toLowerCase()

  switch (item.category) {
    case 'Seating': {
      const sh=hM*0.44, sw=wM, sd=dM*0.6
      // Seat cushion
      box(sw,sh*0.85,sd,0,sh/2,-dM*0.05,mainMat)
      // Back cushion
      box(sw,hM-sh,dM*0.12,0,sh+(hM-sh)/2,-sd/2+0.04,darkMat)
      // Armrests
      box(wM*0.1,sh*0.65,sd,-(sw/2-wM*0.05),sh*0.65/2,-dM*0.05,darkMat)
      box(wM*0.1,sh*0.65,sd,(sw/2-wM*0.05),sh*0.65/2,-dM*0.05,darkMat)
      // Legs
      legs(sw,sd,sh*0.18,0.055,metalMat)
      break
    }
    case 'Tables': {
      const tt=0.06, lh=hM-tt
      // Table top with wood texture
      box(wM,tt,dM,0,hM-tt/2,0,mainMat)
      // Legs
      legs(wM,dM,lh,0.055,darkMat)
      // Optional lower shelf for coffee tables
      if(name.includes('coffee')||name.includes('side')) {
        box(wM*0.8,tt*0.8,dM*0.8,0,hM*0.35,0,mainMat)
      }
      break
    }
    case 'Bedroom': {
      if(name.includes('wardrobe')) {
        box(wM,hM,dM,0,hM/2,0,mainMat)
        box(0.02,hM*0.88,0.02,0,hM/2,dM/2+0.012,metalMat)
        box(0.04,0.04,0.04,-wM*0.15,hM*0.5,dM/2+0.022,metalMat)
        box(0.04,0.04,0.04,wM*0.15,hM*0.5,dM/2+0.022,metalMat)
        // Shelf lines
        for(let i=1;i<3;i++) box(wM-0.05,0.02,dM,0,hM*(i/3),0,darkMat)
      } else if(name.includes('nightstand')) {
        box(wM,hM,dM,0,hM/2,0,mainMat)
        box(wM+0.01,0.025,dM+0.01,0,hM+0.01,0,darkMat)
        box(0.03,0.03,0.03,0,hM*0.5,dM/2+0.016,metalMat)
      } else {
        // Bed frame
        box(wM,hM*0.35,dM,0,hM*0.175,0,mainMat)
        // Headboard
        box(wM,hM*0.65,0.1,0,hM*0.32,-dM/2+0.05,darkMat)
        // Footboard (shorter)
        box(wM,hM*0.2,0.08,0,hM*0.1,dM/2-0.04,darkMat)
        // Mattress (white)
        box(wM-0.1,hM*0.22,dM-0.12,0,hM*0.35+hM*0.11,0,lightMat)
        // Pillows
        box(wM*0.38,hM*0.12,dM*0.24,-wM*0.22,hM*0.35+hM*0.22+0.06,-dM*0.22,lightMat)
        box(wM*0.38,hM*0.12,dM*0.24,wM*0.22,hM*0.35+hM*0.22+0.06,-dM*0.22,lightMat)
      }
      break
    }
    case 'Storage': {
      // Cabinet/shelf body
      box(wM,hM,dM,0,hM/2,0,mainMat)
      // Top panel slightly different
      box(wM+0.02,0.02,dM+0.02,0,hM+0.01,0,darkMat)
      // Door handles
      box(0.025,0.025,0.025,-wM*0.15,hM*0.5,dM/2+0.014,metalMat)
      box(0.025,0.025,0.025,wM*0.15,hM*0.5,dM/2+0.014,metalMat)
      // Shelf dividers
      const nSh=Math.max(1,Math.floor(hM/0.35))
      for(let i=1;i<nSh;i++) box(wM-0.04,0.018,dM-0.04,0,i*(hM/nSh),0,darkMat)
      // Center vertical divider for wider units
      if(wM>0.8) box(0.018,hM-0.06,dM-0.04,0,hM/2,0,darkMat)
      break
    }
    case 'Office': {
      // Desk surface
      box(wM,0.04,dM,0,hM,0,mainMat)
      legs(wM,dM,hM,0.06,metalMat)
      // Monitor
      const scrMat=new T.MeshStandardMaterial({color:0x111122,roughness:0.1,metalness:0.3})
      const glwMat=new T.MeshStandardMaterial({color:0x1a3a8c,roughness:0.05,emissive:new T.Color(0.02,0.08,0.45),emissiveIntensity:0.6})
      box(wM*0.5,0.32,0.04,0,hM+0.2,-dM*0.28,scrMat)
      box(wM*0.46,0.28,0.01,0,hM+0.2,-dM*0.28+0.026,glwMat)
      // Monitor stand
      box(wM*0.06,0.14,0.04,0,hM+0.07,-dM*0.28,scrMat)
      // Keyboard
      box(wM*0.4,0.015,dM*0.2,0,hM+0.008,dM*0.1,
        new T.MeshStandardMaterial({color:0x222222,roughness:0.6,metalness:0.1}))
      break
    }
    case 'Lighting': {
      const polMat=new T.MeshStandardMaterial({color:0xcccccc,roughness:0.15,metalness:0.9})
      const shdMat=new T.MeshStandardMaterial({color:0xfff3cd,roughness:0.5,transparent:true,opacity:0.85,emissive:new T.Color(0.35,0.25,0.05),emissiveIntensity:0.7,side:T.DoubleSide})
      if(name.includes('floor')||name.includes('lamp')) {
        cyl(0.02,0.02,hM*0.88,0,hM*0.44,0,8,polMat)
        cyl(0.18,0.28,0.28,0,hM,0,16,shdMat)
        // Base weight
        cyl(0.14,0.16,0.04,0,0.02,0,16,polMat)
      } else {
        // Hanging/table lamp
        cyl(0.02,0.02,hM*0.5,0,hM*0.75,0,8,polMat)
        cyl(0.14,0.2,0.22,0,hM,0,16,shdMat)
      }
      // Emissive light bulb
      sph(0.06,0,hM*0.88,0,new T.MeshStandardMaterial({color:0xffeeaa,emissive:new T.Color(0.8,0.7,0.2),emissiveIntensity:1.2,roughness:0.3}))
      break
    }
    case 'Bathroom': {
      if(name.includes('toilet')) {
        const porMat=new T.MeshStandardMaterial({color:0xf5f8fc,roughness:0.08,metalness:0.05})
        // Tank
        box(wM*0.72,hM*0.68,dM*0.32,0,hM*0.34,-dM*0.28,porMat)
        // Bowl (tapered)
        cyl(wM*0.42,wM*0.32,hM*0.36,0,hM*0.18,dM*0.08,24,porMat)
        // Seat
        box(wM*0.72,0.04,dM*0.58,0,hM*0.38,dM*0.06,
          new T.MeshStandardMaterial({color:0xffffff,roughness:0.15}))
      } else if(name.includes('bathtub')) {
        const porMat=new T.MeshStandardMaterial({color:0xf0f8fe,roughness:0.06,metalness:0.05})
        const waterMat=new T.MeshStandardMaterial({color:0x88ccee,roughness:0.02,metalness:0.05,transparent:true,opacity:0.7})
        // Tub outer
        box(wM,hM*0.55,dM,0,hM*0.275,0,porMat)
        // Inner basin (hollow illusion)
        box(wM-0.12,hM*0.35,dM-0.1,0,hM*0.38,0,waterMat)
        // Feet
        ;[[-wM*0.38,-0.03,-dM*0.4],[wM*0.38,-0.03,-dM*0.4],[-wM*0.38,-0.03,dM*0.4],[wM*0.38,-0.03,dM*0.4]].forEach(([lx,ly,lz])=>{
          cyl(0.04,0.05,0.07,lx,0.035,lz,8,metalMat)
        })
        // Faucet
        cyl(0.025,0.025,0.18,-wM*0.38,hM*0.65,0,8,metalMat)
      } else {
        // Sink/shower
        const porMat=new T.MeshStandardMaterial({color:0xf5f8fb,roughness:0.06})
        box(wM,hM*0.28,dM,0,hM*0.14,0,porMat)
        box(wM-0.1,hM*0.22,dM-0.1,0,hM*0.28+hM*0.11,0,
          new T.MeshStandardMaterial({color:0xb8e0f0,roughness:0.04,transparent:true,opacity:0.65}))
        cyl(0.03,0.03,0.18,0,hM*0.38,0,8,metalMat)
      }
      break
    }
    case 'Kitchen': {
      if(name.includes('fridge')||name.includes('refrigerator')) {
        const appMat=new T.MeshStandardMaterial({color:0xe8e8e8,roughness:0.25,metalness:0.55})
        box(wM,hM,dM,0,hM/2,0,appMat)
        // Door line
        box(wM+0.01,hM*0.6,0.01,0,hM*0.7,dM/2+0.005,
          new T.MeshStandardMaterial({color:0xcccccc,roughness:0.2,metalness:0.5}))
        // Handle
        box(0.025,hM*0.25,0.04,-wM*0.38,hM*0.7,dM/2+0.025,metalMat)
      } else if(name.includes('stove')||name.includes('cooktop')) {
        const appMat=new T.MeshStandardMaterial({color:0x333333,roughness:0.3,metalness:0.5})
        box(wM,hM*0.88,dM,0,hM*0.44,0,
          new T.MeshStandardMaterial({map:metalTex(T),roughness:0.35,metalness:0.5}))
        box(wM+0.02,0.04,dM*0.72,0,hM*0.9,-dM*0.05,
          new T.MeshStandardMaterial({color:0x888888,roughness:0.2,metalness:0.7}))
        // Burner circles
        ;[[-wM*0.25,hM+0.021,-dM*0.2],[wM*0.25,hM+0.021,-dM*0.2],[-wM*0.25,hM+0.021,dM*0.15],[wM*0.25,hM+0.021,dM*0.15]].forEach(([bx,by,bz])=>{
          cyl(wM*0.14,wM*0.14,0.01,bx,by,bz,24,appMat)
          cyl(wM*0.06,wM*0.06,0.015,bx,by+0.005,bz,24,
            new T.MeshStandardMaterial({color:0x111111,roughness:0.8}))
        })
      } else {
        // Generic counter/sink
        const counterMat=new T.MeshStandardMaterial({map:metalTex(T),roughness:0.35,metalness:0.6})
        box(wM,hM*0.88,dM,0,hM*0.44,0,
          new T.MeshStandardMaterial({color:0x888880,roughness:0.7}))
        box(wM+0.02,0.04,dM*0.72,0,hM*0.9,-dM*0.06,counterMat)
        if(name.includes('sink')) {
          box(wM*0.6,0.02,dM*0.55,0,hM*0.9+0.01,0,
            new T.MeshStandardMaterial({color:0xaaaaaa,roughness:0.15,metalness:0.7}))
          cyl(0.03,0.03,0.14,0,hM*0.95+0.07,0,8,metalMat)
        }
      }
      break
    }
    case 'Living Room': {
      if(name.includes('tv')||name.includes('television')) {
        const scrMat=new T.MeshStandardMaterial({color:0x050510,roughness:0.05,metalness:0.4})
        const glwMat=new T.MeshStandardMaterial({color:0x0a0a20,roughness:0.02,emissive:new T.Color(0.02,0.03,0.08),emissiveIntensity:0.5,side:T.FrontSide})
        box(wM,hM,dM,0,hM/2,0,scrMat)
        box(wM-0.04,hM-0.05,0.01,0,hM/2,dM/2+0.006,glwMat)
        // Stand
        box(wM*0.15,hM*0.08,dM*0.5,0,-hM*0.04+hM*0.04,dM*0.2,
          new T.MeshStandardMaterial({color:0x111111,roughness:0.4,metalness:0.6}))
      } else if(name.includes('rug')) {
        const rugTex=fabricTex(T,hexColor); rugTex.repeat.set(3,3)
        box(wM,0.015,dM,0,0.008,0,new T.MeshStandardMaterial({map:rugTex,roughness:1}))
      } else if(name.includes('fireplace')) {
        box(wM,hM,dM,0,hM/2,0,
          new T.MeshStandardMaterial({color:0x888880,roughness:0.9}))
        // Opening
        box(wM*0.65,hM*0.6,dM*0.1,0,hM*0.32,dM/2+0.01,
          new T.MeshStandardMaterial({color:0x1a1008,roughness:0.95}))
        // Mantel
        box(wM+0.1,0.06,dM*0.65,0,hM+0.03,0,
          new T.MeshStandardMaterial({map:woodTex(T),roughness:0.7}))
      } else {
        box(wM,hM,dM,0,hM/2,0,mainMat)
      }
      break
    }
    case 'Decor': {
      if(name.includes('plant')) {
        const potMat=new T.MeshStandardMaterial({color:0x9b6b3c,roughness:0.88})
        const leafMat=new T.MeshStandardMaterial({color:0x2a7a35,roughness:0.92,side:T.DoubleSide})
        cyl(wM*0.28,wM*0.35,hM*0.38,0,hM*0.19,0,14,potMat)
        // Stem
        cyl(0.02,0.02,hM*0.3,0,hM*0.55,0,8,new T.MeshStandardMaterial({color:0x3a5a28,roughness:0.9}))
        // Leaves (several tilted planes)
        ;[[0,0],[1,0.8],[-1,0.8],[0.5,-0.5]].forEach(([ax,az])=>{
          const lf=new T.Mesh(new T.SphereGeometry(Math.min(wM,dM)*0.38,8,6),leafMat)
          lf.position.set(ax*wM*0.18,hM*0.72,az*dM*0.18)
          lf.scale.set(1,0.3,0.8); lf.castShadow=true; group.add(lf)
        })
      } else {
        box(wM,hM,dM,0,hM/2,0,mainMat)
      }
      break
    }
    default: box(wM, hM, dM, 0, hM/2, 0, mainMat)
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
      try { c = JSON.parse(p.roomConfig) } catch {}
      try { const l = JSON.parse(p.furnitureLayout); if (l?.items) { its = l.items; ov = l.overlays || ov } else if (Array.isArray(l)) its = l } catch {}
      setCfg(c); setItems(its); setOverlays(ov)
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
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.22
      renderer.outputEncoding = T.sRGBEncoding
      renderer.physicallyCorrectLights = true
      mount.appendChild(renderer.domElement); rdrRef.current = renderer
      const scene = new T.Scene()
      scene.background = new T.Color(0x1a2035); scene.fog = new T.FogExp2(0x1a2035, 0.04)
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
      const amb = new T.AmbientLight(0xffeedd, ambientInt); amb.name = 'ambient'; scene.add(amb)
      const sun = new T.DirectionalLight(0xfff5e0, sunInt); sun.name = 'sun'; sun.position.set(6, 10, 4); sun.castShadow = true
      sun.shadow.mapSize.set(4096, 4096); sun.shadow.camera.near = 0.5; sun.shadow.camera.far = Math.max(30, Math.min(120, Math.max(dims0.W, dims0.D) * 8))
      const shadowSize = Math.max(dims0.W, dims0.D) * 2.4
      sun.shadow.camera.left = sun.shadow.camera.bottom = -shadowSize
      sun.shadow.camera.right = sun.shadow.camera.top = shadowSize
      sun.shadow.bias = -0.001; scene.add(sun)
      const fill = new T.DirectionalLight(0x99ccff, 0.32); fill.position.set(-5, 3, -3); scene.add(fill)
      const pt1 = new T.PointLight(0xffddaa, 0.7, 10); pt1.position.set(2, 2.4, 2); scene.add(pt1)
      const pt2 = new T.PointLight(0xaaccff, 0.4, 10); pt2.position.set(-2, 2, -2); scene.add(pt2)
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
    import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js').then(T => {
      const old = scene.getObjectByName('room'); if (old) scene.remove(old)
      scene.add(buildRoom(T, cfg, { wallMode, showCeiling, showShadows, showGrid }))
    })
  }, [cfg, wallMode, showCeiling, showShadows, showGrid]) // eslint-disable-line

  useEffect(() => {
    const fg = fGroupRef.current; if (!fg) return
    import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js').then(T => {
      while (fg.children.length) fg.remove(fg.children[0])
      populateFurniture(T, fg, items, showShadows)
    })
  }, [items, showShadows]) // eslint-disable-line

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
      mesh.position.set(pos.x, 0, pos.z)
      mesh.rotation.y = pos.ry
      group.add(mesh)

      // Yield occasionally to keep UI responsive when many models load.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

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
      let o = hits[0].object; while (o.parent && o.parent !== fg) o = o.parent
      if (o.userData?.itemId) {
        setSelectedId(o.userData.itemId)
        const floorPt = raycastFloor(T, e.clientX, e.clientY)
        if (floorPt) {
          // Use a proxy while dragging to avoid freezes with heavy meshes.
          const proxy = ensureDragProxy(T, fg, o) || null
          o.visible = false
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
          const newX3d = floorPt.x + d.offsetX
          const newZ3d = floorPt.z + d.offsetZ
          if (d.proxy) {
            d.proxy.position.x = newX3d
            d.proxy.position.z = newZ3d
          }
          d.pendingX3d = newX3d
          d.pendingZ3d = newZ3d
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
            const coords2d = item3DTo2D(pendingX3d, pendingZ3d, wM, dM)
            return { ...i, x: coords2d.x, y: coords2d.y }
          })
          designStore.setItems(next)  // sync to 2D
          return next
        })
        setDirty(true)
      }
      // Restore real mesh, remove proxy
      const d = dragFurnRef.current
      try {
        if (d?.mesh) d.mesh.visible = true
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
      await projectsApi.update(id, { roomConfig: JSON.stringify(cfg), furnitureLayout: JSON.stringify({ items, overlays, customModels }) })
      designStore.setItems(items)
      designStore.setOverlays(overlays)
      designStore.setCfg(cfg)
      designStore.setCustomModels(customModels)
      setDirty(false); toast.success('Saved!')
    }
    catch { toast.error('Save failed') } finally { setSaving(false) }
  }

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
            <button key={v} onClick={() => setWallMode(v)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${wallMode === v ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>{l}</button>
          ))}
        </div>
        <div className="h-5 w-px bg-white/10 flex-shrink-0" />
        {[[showCeiling, () => setShowCeiling(!showCeiling), Layers, 'Ceiling'],
          [showShadows, () => setShowShadows(!showShadows), Sun, 'Shadows'],
          [showGrid, () => setShowGrid(!showGrid), Grid3X3, 'Grid']
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