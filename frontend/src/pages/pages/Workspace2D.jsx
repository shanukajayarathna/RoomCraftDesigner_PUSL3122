import React, {
  useEffect, useLayoutEffect, useRef, useState, useCallback
} from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi, furnitureApi, FURNITURE_LIBRARY, useDesignStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { renderTopViewPreview } from '../utils/topViewPreview'
import {
  Save, Undo, RotateCw, Trash2, Box,
  ZoomIn, ZoomOut, MousePointer, ChevronLeft,
  Move, Maximize2, Copy, DoorOpen, Columns,
  Wind, Upload, Package, X, Palette,
  ChevronRight, ChevronDown, ChevronUp
} from 'lucide-react'

/* ── Constants ── */
const GRID = 50
const SNAP = 5
const OX   = 80
const OY   = 70
const MAX_CUSTOM_MODELS = 10

const CAT_COLOR = {
  Seating:     '#7c9ef8',   // deeper blue-periwinkle
  Tables:      '#5ad4a0',   // rich jade
  Bedroom:     '#f4856e',   // warm terracotta
  Storage:     '#b892f2',   // deep lavender
  Office:      '#f5c842',   // golden amber
  Lighting:    '#ff9f4a',   // warm orange
  Bathroom:    '#5bc8de',   // aqua
  Kitchen:     '#72da8c',   // fresh green
  'Living Room':'#7ab8f5',  // sky blue
  Decor:       '#f48db4',   // dusty rose
  Custom:      '#a78bfa',   // violet
  Outdoor:     '#8dcc6e',   // grass green
  Dining:      '#e8a96a',   // warm wood
}

const CAT_EMOJI = {
  Seating:'🪑', Tables:'🪵', Bedroom:'🛏️', Storage:'🗄️', Office:'💼',
  Lighting:'💡', Bathroom:'🚿', Kitchen:'🍳', 'Living Room':'🛋️', Decor:'🪴',
  Custom:'📦',
  Dining:'🍽️', 
  Outdoor:'🌿',   
}
const FLOOR_COL = {
  wood:'#c8a46e', carpet:'#9b8fa8', tile:'#e0e0e0', marble:'#ece8e2', concrete:'#b8b8b8'
}
const COLOR_PRESETS = [
  '#93b4fd','#6ee7b7','#fca5a5','#fcd34d','#fdba74',
  '#a5f3fc','#d8b4fe','#f9a8d4','#bbf7d0','#bfdbfe',
]

const snapV = v => Math.round(v / SNAP) * SNAP
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const normalRot = v => ((+v % 360) + 360) % 360

function roomBounds(cfg) {
  const W = (cfg.shape === 'square' ? Math.min(cfg.width || 5, cfg.depth || 4) : (cfg.width || 5)) * GRID
  const D = (cfg.shape === 'square' ? Math.min(cfg.width || 5, cfg.depth || 4) : (cfg.depth || 4)) * GRID
  return {
    minX: OX,
    minY: OY,
    maxX: OX + W,
    maxY: OY + D,
  }
}

function clampItemToRoom(item, cfg, targetX, targetY) {
  const B = roomBounds(cfg)
  const x = clamp(targetX, B.minX, Math.max(B.minX, B.maxX - (item.w || 20)))
  const y = clamp(targetY, B.minY, Math.max(B.minY, B.maxY - (item.d || 20)))
  return { x, y }
}

/* ── Synchronous base64 (reliable, no FileReader race conditions) ── */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToArrayBuffer(b64) {
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const u8 = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return buf
}

/* ── OBJ top-down parser ── */
function parseOBJTopDown(text) {
  const verts = [], faces = []
  for (const raw of text.split('\n')) {
    const p = raw.trim().split(/\s+/)
    if (p[0] === 'v' && p.length >= 4) {
      const x = parseFloat(p[1]), y = parseFloat(p[2]), z = parseFloat(p[3])
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))
        verts.push([x, y, z])
    }
    if (p[0] === 'f' && p.length >= 4) {
      const ids = p.slice(1).map(s => {
        const n = parseInt(s.split('/')[0], 10)
        return Number.isFinite(n) ? n - 1 : -1
      })
      for (let i = 1; i < ids.length - 1; i++) {
        if (ids[0] >= 0 && ids[i] >= 0 && ids[i+1] >= 0)
          faces.push([ids[0], ids[i], ids[i+1]])
      }
    }
  }
  return { pts2d: verts.map(([x,,z]) => [x, z]), faces }
}

function parseGLBTopDown(buffer) {
  try {
    const view = new DataView(buffer)
    if (view.getUint32(0, true) !== 0x46546C67) return null
    const jsonLen   = view.getUint32(12, true)
    const jsonStart = 20
    const jsonText  = new TextDecoder().decode(new Uint8Array(buffer, jsonStart, jsonLen))
    const gltf = JSON.parse(jsonText)
    let binChunk = null, offset = jsonStart + jsonLen
    while (offset + 8 <= buffer.byteLength) {
      const chunkLen  = view.getUint32(offset, true)
      const chunkType = view.getUint32(offset + 4, true)
      const chunkData = buffer.slice(offset + 8, offset + 8 + chunkLen)
      if (chunkType === 0x004E4942) { binChunk = chunkData; break }
      offset += 8 + chunkLen
    }
    if (!binChunk) return null
    const pts2d = [], faces = []
    let vertexStart = 0
    for (const mesh of (gltf.meshes || [])) {
      for (const prim of (mesh.primitives || [])) {
        const at = prim.attributes || {}
        if (at.POSITION == null) continue
        const acc = gltf.accessors[at.POSITION], bv = gltf.bufferViews[acc.bufferView]
        const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0)
        const count = acc.count || 0
        const pos = new Float32Array(binChunk, byteOffset, count * 3)
        for (let i = 0; i < count; i++) pts2d.push([pos[i*3], pos[i*3+2]])
        if (prim.indices != null) {
          const iacc = gltf.accessors[prim.indices], ibv = gltf.bufferViews[iacc.bufferView]
          const ioff  = (ibv.byteOffset || 0) + (iacc.byteOffset || 0)
          const icount = iacc.count || 0
          const idx = iacc.componentType === 5125
            ? new Uint32Array(binChunk, ioff, icount)
            : new Uint16Array(binChunk, ioff, icount)
          for (let i = 0; i + 2 < idx.length; i += 3)
            faces.push([vertexStart+idx[i], vertexStart+idx[i+1], vertexStart+idx[i+2]])
        }
        vertexStart += count
      }
    }
    return pts2d.length ? { pts2d, faces } : null
  } catch (err) {
    console.warn('parseGLBTopDown failed', err)
    return null
  }
}

/* ── Draw helpers ── */
function drawModelTopDown(ctx, item, tdData, opts = {}) {
  if (!tdData?.pts2d?.length) return
  const {
    fillStyle = 'rgba(139,92,246,0.12)',
    strokeStyle = 'rgba(139,92,246,0.75)',
    lineWidth = 0.9,
    rotationDeg,
  } = opts
  const { pts2d, faces } = tdData
  // If the caller already rotated the canvas context, pass rotationDeg: 0 to avoid double rotation.
  const angle  = (rotationDeg != null ? rotationDeg : (item.rotation || 0)) * Math.PI / 180
  const cosA = Math.cos(angle), sinA = Math.sin(angle)
  const rotated = pts2d.map(([x, z]) => [x*cosA - z*sinA, x*sinA + z*cosA])
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [x, z] of rotated) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
  }
  const mw = maxX - minX || 1, mz = maxZ - minZ || 1
  const hw = item.w / 2, hd = item.d / 2
  const sx = item.w / mw, sz = item.d / mz
  ctx.save()
  ctx.strokeStyle = strokeStyle
  ctx.fillStyle = fillStyle
  ctx.lineWidth = lineWidth
  if (faces?.length) {
    for (const [i0,i1,i2] of faces) {
      const p0=rotated[i0], p1=rotated[i1], p2=rotated[i2]; if (!p0||!p1||!p2) continue
      ctx.beginPath()
      ctx.moveTo((p0[0]-minX)*sx-hw, (p0[1]-minZ)*sz-hd)
      ctx.lineTo((p1[0]-minX)*sx-hw, (p1[1]-minZ)*sz-hd)
      ctx.lineTo((p2[0]-minX)*sx-hw, (p2[1]-minZ)*sz-hd)
      ctx.closePath(); ctx.fill(); ctx.stroke()
    }
  } else {
    ctx.beginPath(); let first = true
    for (const [x,z] of rotated) {
      const px=(x-minX)*sx-hw, pz=(z-minZ)*sz-hd
      if (first){ctx.moveTo(px,pz);first=false}else ctx.lineTo(px,pz)
    }
    ctx.closePath(); ctx.fill(); ctx.stroke()
  }
  ctx.restore()
}

function traceFurnitureSilhouette(ctx, item) {
  const hw = item.w / 2
  const hd = item.d / 2
  const cat = item.category
  const name = (item.name || item.label || '').toLowerCase()
 
  ctx.beginPath()
 
  // ── SEATING ──────────────────────────────────────────────────────────────
  if (cat === 'Seating') {
    const isSofa = name.includes('sofa') || name.includes('couch') || item.w > 140
    if (isSofa) {
      // Sofa: slightly squared front, rounded back corners
      const r = Math.max(5, Math.min(14, Math.min(hw, hd) * 0.22))
      ctx.roundRect(-hw, -hd, item.w, item.d, [r, r, r * 0.4, r * 0.4])
    } else {
      // Chair: more rounded
      const r = Math.max(6, Math.min(18, Math.min(hw, hd) * 0.3))
      ctx.roundRect(-hw, -hd, item.w, item.d, r)
    }
    return
  }
 
  // ── TABLES ───────────────────────────────────────────────────────────────
  if (cat === 'Tables' || cat === 'Dining') {
    const isRound = name.includes('round') || name.includes('oval') ||
                    name.includes('circle') || Math.abs(item.w - item.d) < 12
    const isOval  = name.includes('oval')
    if (isRound || isOval) {
      ctx.ellipse(0, 0, hw, hd, 0, 0, Math.PI * 2)
    } else {
      const r = Math.max(4, Math.min(12, Math.min(hw, hd) * 0.18))
      ctx.roundRect(-hw, -hd, item.w, item.d, r)
    }
    return
  }
 
  // ── BEDROOM ──────────────────────────────────────────────────────────────
  if (cat === 'Bedroom') {
    if (name.includes('bed')) {
      const r = Math.max(5, Math.min(12, Math.min(hw, hd) * 0.18))
      ctx.roundRect(-hw, -hd, item.w, item.d, r)
    } else if (name.includes('wardrobe') || name.includes('closet') || name.includes('armoire')) {
      ctx.roundRect(-hw + 3, -hd + 3, item.w - 6, item.d - 6, 3)
    } else if (name.includes('dresser') || name.includes('chest')) {
      ctx.roundRect(-hw + 2, -hd + 2, item.w - 4, item.d - 4, 4)
    } else {
      ctx.roundRect(-hw + 4, -hd + 4, item.w - 8, item.d - 8, 4)
    }
    return
  }
 
  // ── BATHROOM ─────────────────────────────────────────────────────────────
  if (cat === 'Bathroom') {
    if (name.includes('bathtub') || name.includes('tub')) {
      const r = Math.max(12, Math.min(hw, hd) * 0.48)
      ctx.roundRect(-hw, -hd, item.w, item.d, r)
    } else if (name.includes('toilet')) {
      // Toilet: D-shape — rectangular back, oval front
      ctx.moveTo(-hw, -hd)
      ctx.lineTo(hw, -hd)
      ctx.lineTo(hw, -hd + item.d * 0.38)
      ctx.bezierCurveTo(hw, hd + hd * 0.15, -hw, hd + hd * 0.15, -hw, -hd + item.d * 0.38)
      ctx.closePath()
    } else if (name.includes('shower')) {
      ctx.roundRect(-hw + 2, -hd + 2, item.w - 4, item.d - 4, 6)
    } else {
      // Sink: rounded rectangle with front curve
      ctx.roundRect(-hw + 4, -hd + 2, item.w - 8, item.d - 4, [5, 5, 12, 12])
    }
    return
  }
 
  // ── LIGHTING ─────────────────────────────────────────────────────────────
  if (cat === 'Lighting') {
    ctx.ellipse(0, 0, Math.min(hw, hd), Math.min(hw, hd), 0, 0, Math.PI * 2)
    return
  }
 
  // ── DECOR ─────────────────────────────────────────────────────────────────
  if (cat === 'Decor') {
    if (name.includes('plant') || name.includes('vase') || name.includes('pot')) {
      ctx.ellipse(0, 0, Math.min(hw, hd), Math.min(hw, hd), 0, 0, Math.PI * 2)
    } else {
      ctx.roundRect(-hw + 2, -hd + 2, item.w - 4, item.d - 4, 5)
    }
    return
  }
 
  // ── KITCHEN ──────────────────────────────────────────────────────────────
  if (cat === 'Kitchen') {
    if (name.includes('island')) {
      ctx.roundRect(-hw, -hd, item.w, item.d, [8, 8, 8, 8])
    } else {
      ctx.roundRect(-hw + 2, -hd + 2, item.w - 4, item.d - 4, 4)
    }
    return
  }
 
  // ── OFFICE ───────────────────────────────────────────────────────────────
  if (cat === 'Office') {
    if (name.includes('chair')) {
      ctx.ellipse(0, 0, Math.min(hw, hd) * 0.9, Math.min(hw, hd) * 0.9, 0, 0, Math.PI * 2)
    } else {
      ctx.roundRect(-hw + 2, -hd + 2, item.w - 4, item.d - 4, 4)
    }
    return
  }
 
  // ── DEFAULT ───────────────────────────────────────────────────────────────
  ctx.roundRect(-hw, -hd, item.w, item.d, 5)
}

function roomPoly(cfg) {
  const W = (cfg.width||5)*GRID, D = (cfg.depth||4)*GRID
  if (cfg.shape==='l-shape') {
    const cw=Math.round(W*0.6), cd=Math.round(D*0.55)
    return [[OX,OY],[OX+W,OY],[OX+W,OY+cd],[OX+cw,OY+cd],[OX+cw,OY+D],[OX,OY+D]]
  }
  if (cfg.shape==='square') { const S=Math.min(W,D); return [[OX,OY],[OX+S,OY],[OX+S,OY+S],[OX,OY+S]] }
  return [[OX,OY],[OX+W,OY],[OX+W,OY+D],[OX,OY+D]]
}

function drawDoor(ctx, d, sel) {
  const dw=d.w||80
  ctx.save(); ctx.translate(d.x,d.y); ctx.rotate((d.rotation||0)*Math.PI/180)
  ctx.strokeStyle='rgba(51,65,85,0.22)'; ctx.lineWidth=0.8; ctx.setLineDash([4,3])
  ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,dw,0,Math.PI/2); ctx.stroke(); ctx.setLineDash([])
  const doorCol = d.color || '#f1f5f9'
  const frameCol = d.frameColor || (sel ? '#3b82f6' : '#475569')
  ctx.fillStyle=doorCol; ctx.strokeStyle=frameCol; ctx.lineWidth=sel?2.5:2
  ctx.beginPath(); ctx.rect(0,-6,dw,12); ctx.fill(); ctx.stroke()
  ctx.fillStyle='#94a3b8'; ctx.beginPath(); ctx.arc(dw-10,0,3.5,0,Math.PI*2); ctx.fill()
  ctx.fillStyle='#334155'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText('D',dw/2,0)
  if (sel) { ctx.strokeStyle='#3b82f6'; ctx.lineWidth=1.5; ctx.setLineDash([5,3]); ctx.beginPath(); ctx.rect(-8,-14,dw+16,28); ctx.stroke(); ctx.setLineDash([]) }
  ctx.restore()
}

function drawWindow(ctx, w, sel) {
  const ww=w.w||100
  ctx.save(); ctx.translate(w.x,w.y); ctx.rotate((w.rotation||0)*Math.PI/180)
  const frame = w.frameColor || (sel ? '#3b82f6' : '#2563eb')
  const glass = w.glassTint || '#93c5fd'
  ctx.fillStyle = glass + '77'; ctx.strokeStyle=frame; ctx.lineWidth=sel?2.5:2
  ctx.beginPath(); ctx.rect(-ww/2,-8,ww,16); ctx.fill(); ctx.stroke()
  // Style controls mullions
  const style = (w.style || 'cross').toLowerCase()
  ctx.strokeStyle = (glass + 'aa'); ctx.lineWidth=0.9
  if (style === 'cross' || style === 'double') {
    ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,8); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-ww/2,0); ctx.lineTo(ww/2,0); ctx.stroke()
  } else if (style === 'double') {
    ctx.beginPath(); ctx.moveTo(-ww/4,-8); ctx.lineTo(-ww/4,8); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(ww/4,-8); ctx.lineTo(ww/4,8); ctx.stroke()
  }
  ctx.fillStyle='rgba(255,255,255,0.38)'; ctx.beginPath(); ctx.rect(-ww/2+3,-7,ww/2-6,6); ctx.fill()
  ctx.fillStyle=frame; ctx.font='bold 9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText('W',0,0)
  if (sel) { ctx.strokeStyle='#3b82f6'; ctx.lineWidth=1.5; ctx.setLineDash([5,3]); ctx.beginPath(); ctx.rect(-ww/2-6,-14,ww+12,28); ctx.stroke(); ctx.setLineDash([]) }
  ctx.restore()
}

function drawCurtain(ctx, c, sel) {
  const cw=c.w||120, col=c.color||'#fca5a5'
  const style=(c.style||'standard').toLowerCase()
  const alpha = style==='sheer'?0.38:style==='blackout'?0.9:0.65
  ctx.save(); ctx.translate(c.x,c.y); ctx.rotate((c.rotation||0)*Math.PI/180)
  ctx.strokeStyle='#78716c'; ctx.lineWidth=2.5
  ctx.beginPath(); ctx.moveTo(-cw/2-8,-10); ctx.lineTo(cw/2+8,-10); ctx.stroke()
  ctx.fillStyle='#a8a29e'
  ;[-cw/2-8,cw/2+8].forEach(ex=>{ctx.beginPath();ctx.arc(ex,-10,4,0,Math.PI*2);ctx.fill()})
  ctx.fillStyle = col + Math.round(alpha*255).toString(16).padStart(2,'0')
  ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=0.7
  ctx.beginPath(); ctx.moveTo(-cw/2,-10)
  for (let i=0;i<4;i++){const x1=-cw/2+(i+0.5)*(cw/2)/4+2,x2=-cw/2+(i+1)*(cw/2)/4;ctx.quadraticCurveTo(x1,24,x2,-10)}
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cw/2,-10)
  for (let i=0;i<4;i++){const x1=cw/2-(i+0.5)*(cw/2)/4-2,x2=cw/2-(i+1)*(cw/2)/4;ctx.quadraticCurveTo(x1,24,x2,-10)}
  ctx.closePath(); ctx.fill(); ctx.stroke()
  if (sel) { ctx.strokeStyle='#3b82f6'; ctx.lineWidth=1.5; ctx.setLineDash([5,3]); ctx.beginPath(); ctx.rect(-cw/2-12,-16,cw+24,46); ctx.stroke(); ctx.setLineDash([]) }
  ctx.restore()
}

function drawFurnDetail(ctx, item, topDownCache) {
  const hw = item.w / 2
  const hd = item.d / 2
  ctx.save()
 
  // Custom model silhouette drawn in base pass — skip
  const tdData = item.customModelId && topDownCache ? topDownCache[item.customModelId] : null
  if (tdData?.pts2d?.length) { ctx.restore(); return }
 
  const name = (item.name || item.label || '').toLowerCase()
 
  // ── Helper: draw a small chrome/metal dot handle ─────────────────────────
  const handle = (x, y, r = 3.2) => {
    ctx.fillStyle = 'rgba(210,210,220,0.9)'
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(80,80,100,0.4)'; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
  }
 
  // ── Helper: wood grain lines ──────────────────────────────────────────────
  const woodGrain = (x0, y0, w, h, numLines = 6) => {
    ctx.save()
    ctx.strokeStyle = 'rgba(80,45,10,0.08)'; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip()
    for (let i = 0; i < numLines; i++) {
      const ly = y0 + (i + 0.5) * (h / numLines)
      ctx.beginPath(); ctx.moveTo(x0, ly); ctx.lineTo(x0 + w, ly + (Math.random() * 3 - 1.5)); ctx.stroke()
    }
    ctx.restore()
  }
 
  switch (item.category) {
 
    // ════════════════════════════════════════════════════════════════════════
    case 'Seating': {
      const isSofa = name.includes('sofa') || name.includes('couch') || item.w > 140
      const armW   = item.w * 0.092
      const numCush = isSofa ? Math.max(2, Math.round(item.w / 64)) : 1
      const cushTotalW = item.w - armW * 2
      const cW = cushTotalW / numCush
 
      // Back band (upholstered top)
      ctx.fillStyle = 'rgba(0,0,0,0.26)'
      ctx.beginPath(); ctx.roundRect(-hw + 2, -hd + 2, item.w - 4, hd * 0.25, [4, 4, 0, 0]); ctx.fill()
 
      // Armrests (solid blocks)
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.beginPath(); ctx.roundRect(-hw + 1.5, -hd + 3, armW, item.d - 6, [3, 0, 0, 3]); ctx.fill()
      ctx.beginPath(); ctx.roundRect(hw - armW - 1.5, -hd + 3, armW, item.d - 6, [0, 3, 3, 0]); ctx.fill()
      // Armrest top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.beginPath(); ctx.roundRect(-hw + 2, -hd + 3, armW - 1, 4, 2); ctx.fill()
      ctx.beginPath(); ctx.roundRect(hw - armW - 1, -hd + 3, armW - 1, 4, 2); ctx.fill()
 
      // Cushion dividers + sheen
      const cushStartX = -hw + armW
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.1
      for (let i = 0; i <= numCush; i++) {
        const cx = cushStartX + i * cW
        ctx.beginPath(); ctx.moveTo(cx, -hd * 0.5); ctx.lineTo(cx, hd - 4); ctx.stroke()
      }
      // Per-cushion sheen + button
      for (let i = 0; i < numCush; i++) {
        const cx = cushStartX + i * cW + cW / 2
        ctx.fillStyle = 'rgba(255,255,255,0.14)'
        ctx.beginPath(); ctx.ellipse(cx, hd * 0.04, cW * 0.24, hd * 0.12, 0, 0, Math.PI * 2); ctx.fill()
        // Cushion seam line
        ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 0.6
        ctx.beginPath(); ctx.moveTo(cushStartX + i * cW + 3, hd * 0.28); ctx.lineTo(cushStartX + (i+1) * cW - 3, hd * 0.28); ctx.stroke()
      }
 
      // Front piping welt
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(-hw + armW + 2, hd - 5); ctx.lineTo(hw - armW - 2, hd - 5); ctx.stroke()
 
      // Legs (4 small dots)
      ctx.fillStyle = 'rgba(40,30,20,0.5)'
      const lLocs = isSofa
        ? [[-hw*0.88, hd-5],[hw*0.88, hd-5],[-hw*0.88,-hd+3],[hw*0.88,-hd+3],[0,hd-5]]
        : [[-hw*0.78,hd-4],[hw*0.78,hd-4],[-hw*0.78,-hd+3],[hw*0.78,-hd+3]]
      lLocs.forEach(([lx,ly]) => { ctx.beginPath(); ctx.arc(lx,ly,3,0,Math.PI*2); ctx.fill() })
      break
    }
 
    // ════════════════════════════════════════════════════════════════════════
    case 'Tables':
    case 'Dining': {
      const isRound = name.includes('round') || name.includes('oval') || Math.abs(item.w - item.d) < 12
      const numLegs = isRound ? 3 : 4
      const legR    = 5.5
 
      // Wood grain on surface
      woodGrain(-hw + 8, -hd + 8, item.w - 16, item.d - 16, 7)
 
      // Surface top-coat sheen
      ctx.fillStyle = 'rgba(255,255,255,0.24)'
      if (isRound) {
        ctx.beginPath(); ctx.ellipse(-hw*0.18, -hd*0.22, hw*0.4, hd*0.18, -0.4, 0, Math.PI*2); ctx.fill()
      } else {
        ctx.beginPath(); ctx.roundRect(-hw*0.5, -hd*0.38, hw*1.0, hd*0.24, 3); ctx.fill()
      }
 
      // Apron (inner line)
      ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.8
      if (isRound) {
        ctx.beginPath(); ctx.ellipse(0, 0, hw - 8, hd - 8, 0, 0, Math.PI*2); ctx.stroke()
      } else {
        ctx.beginPath(); ctx.roundRect(-hw+10, -hd+10, item.w-20, item.d-20, 3); ctx.stroke()
      }
 
      // Legs
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      if (isRound) {
        for (let i = 0; i < numLegs; i++) {
          const a = (i/numLegs)*Math.PI*2 + Math.PI/6
          const lr = Math.min(hw,hd)*0.7
          ctx.beginPath(); ctx.arc(Math.cos(a)*lr, Math.sin(a)*lr, legR, 0, Math.PI*2); ctx.fill()
        }
      } else {
        for (const [lx,ly] of [[-hw+8,-hd+8],[hw-8,-hd+8],[-hw+8,hd-8],[hw-8,hd-8]]) {
          ctx.beginPath(); ctx.roundRect(lx-legR,ly-legR,legR*2,legR*2,2); ctx.fill()
          // Leg highlight
          ctx.fillStyle = 'rgba(255,255,255,0.12)'
          ctx.beginPath(); ctx.roundRect(lx-legR+1,ly-legR+1,legR,legR,1); ctx.fill()
          ctx.fillStyle = 'rgba(0,0,0,0.35)'
        }
      }
      break
    }
 
    // ════════════════════════════════════════════════════════════════════════
    case 'Bedroom': {
      if (name.includes('wardrobe') || name.includes('closet') || name.includes('armoire')) {
        // Cabinet fill
        ctx.fillStyle = 'rgba(195,218,255,0.6)'
        ctx.beginPath(); ctx.roundRect(-hw+4, -hd+4, item.w-8, item.d-8, 3); ctx.fill()
        woodGrain(-hw+4, -hd+4, (item.w-8)/2-1, item.d-8, 5)
        woodGrain(2, -hd+4, (item.w-8)/2-1, item.d-8, 5)
 
        // Door split
        ctx.strokeStyle = 'rgba(50,70,130,0.45)'; ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.moveTo(0, -hd+5); ctx.lineTo(0, hd-5); ctx.stroke()
 
        // Mirror panels (upper third each door)
        for (const sx of [-1, 1]) {
          const mx = sx > 0 ? 3 : -hw + 3
          const mw = hw - 6
          ctx.fillStyle = 'rgba(160,192,240,0.35)'
          ctx.beginPath(); ctx.roundRect(mx, -hd*0.82, mw, hd*0.64, 2); ctx.fill()
          // Mirror reflection line
          ctx.strokeStyle = 'rgba(200,215,245,0.6)'; ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(mx + mw*0.18, -hd*0.78)
          ctx.lineTo(mx + mw*0.38, -hd*0.25)
          ctx.stroke()
        }
        // Handles
        handle(-hw*0.06, 0); handle(hw*0.06, 0)
        // Crown moulding (top line)
        ctx.strokeStyle = 'rgba(60,80,130,0.25)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(-hw+3, -hd+3.5); ctx.lineTo(hw-3, -hd+3.5); ctx.stroke()
        // Toe kick (bottom)
        ctx.fillStyle = 'rgba(0,0,0,0.12)'
        ctx.beginPath(); ctx.roundRect(-hw+3, hd-6, item.w-6, 3, 1); ctx.fill()
 
      } else if (name.includes('dresser') || name.includes('chest')) {
        // Drawer unit
        ctx.fillStyle = 'rgba(215,222,248,0.7)'
        ctx.beginPath(); ctx.roundRect(-hw+4, -hd+4, item.w-8, item.d-8, 3); ctx.fill()
        woodGrain(-hw+4, -hd+4, item.w-8, item.d-8, 6)
        const numDrawers = Math.round(item.d / 28)
        const dH = (item.d - 10) / numDrawers
        ctx.strokeStyle = 'rgba(60,70,120,0.3)'; ctx.lineWidth = 0.8
        for (let i = 1; i < numDrawers; i++) {
          const ly = -hd + 5 + i * dH
          ctx.beginPath(); ctx.moveTo(-hw+5, ly); ctx.lineTo(hw-5, ly); ctx.stroke()
        }
        for (let i = 0; i < numDrawers; i++) {
          handle(0, -hd + 5 + (i + 0.5) * dH)
        }
 
      } else if (name.includes('nightstand') || name.includes('bedside')) {
        ctx.fillStyle = 'rgba(218,224,250,0.72)'
        ctx.beginPath(); ctx.roundRect(-hw+5, -hd+5, item.w-10, item.d-10, 3); ctx.fill()
        woodGrain(-hw+5, -hd+5, item.w-10, item.d-10, 4)
        // Lamp circle suggestion
        ctx.fillStyle = 'rgba(253,186,116,0.2)'
        ctx.beginPath(); ctx.arc(-hw*0.05, -hd*0.2, Math.min(hw,hd)*0.4, 0, Math.PI*2); ctx.fill()
        // Drawer
        ctx.strokeStyle = 'rgba(60,70,120,0.3)'; ctx.lineWidth = 0.7
        ctx.beginPath(); ctx.moveTo(-hw+6, 2); ctx.lineTo(hw-6, 2); ctx.stroke()
        handle(0, -hd*0.4)
        handle(0, hd*0.35)
 
      } else {
        // BED ──────────────────────────────────────────────────────────────
        // Mattress base
        ctx.fillStyle = 'rgba(248,246,242,0.96)'
        ctx.beginPath(); ctx.roundRect(-hw+4, -hd+4, item.w-8, item.d-8, 6); ctx.fill()
 
        // Headboard (rich, upholstered)
        const headH = hd * 0.2
        ctx.fillStyle = 'rgba(105,72,38,0.58)'
        ctx.beginPath(); ctx.roundRect(-hw+3, -hd+2, item.w-6, headH, [5,5,0,0]); ctx.fill()
        // Headboard tufting buttons
        const numTufts = Math.max(2, Math.round(item.w / 52))
        for (let t = 0; t < numTufts; t++) {
          const tx = -hw + 12 + t * ((item.w - 24) / (numTufts - 1 || 1))
          ctx.fillStyle = 'rgba(60,35,12,0.65)'
          ctx.beginPath(); ctx.arc(tx, -hd + headH*0.55, 2.5, 0, Math.PI*2); ctx.fill()
        }
        // Headboard decorative panel
        ctx.strokeStyle = 'rgba(140,100,50,0.3)'; ctx.lineWidth = 0.7
        ctx.beginPath(); ctx.roundRect(-hw+8, -hd+4, item.w-16, headH-4, 3); ctx.stroke()
 
        // Footboard
        ctx.fillStyle = 'rgba(120,85,45,0.32)'
        ctx.beginPath(); ctx.roundRect(-hw+4, hd-headH*0.65, item.w-8, headH*0.6, [0,0,4,4]); ctx.fill()
 
        // Duvet — subtle tonal rectangle
        ctx.fillStyle = 'rgba(235,232,255,0.55)'
        ctx.beginPath(); ctx.roundRect(-hw+6, -hd+headH+2, item.w-12, item.d-headH*1.6, 5); ctx.fill()
 
        // Duvet stitching lines (quilted look)
        ctx.strokeStyle = 'rgba(180,175,210,0.45)'; ctx.lineWidth = 0.5
        const quiltRows = 4
        for (let q = 1; q < quiltRows; q++) {
          const qy = -hd + headH + 2 + q * ((item.d - headH*1.6) / quiltRows)
          ctx.beginPath(); ctx.moveTo(-hw+8, qy); ctx.lineTo(hw-8, qy); ctx.stroke()
        }
        // Vertical quilt lines
        const quiltCols = Math.round(item.w / 45)
        for (let q = 1; q < quiltCols; q++) {
          const qx = -hw + 6 + q * ((item.w-12) / quiltCols)
          ctx.beginPath()
          ctx.moveTo(qx, -hd+headH+4)
          ctx.lineTo(qx, hd-headH*0.7)
          ctx.stroke()
        }
 
        // Duvet fold-back
        ctx.fillStyle = 'rgba(245,243,255,0.65)'
        ctx.beginPath(); ctx.roundRect(-hw+6, -hd+headH+2, item.w-12, hd*0.2, [5,5,0,0]); ctx.fill()
 
        // Pillows
        const numPillows = item.w > 130 ? 2 : 1
        const pW = item.w > 130 ? item.w * 0.36 : item.w * 0.56
        const pXs = numPillows === 2 ? [-item.w * 0.2, item.w * 0.2] : [0]
        const pillowTop = -hd + headH + 4
        for (const px of pXs) {
          // Pillow body
          ctx.fillStyle = 'rgba(255,255,255,0.95)'
          ctx.beginPath(); ctx.roundRect(px-pW/2, pillowTop, pW, hd*0.24, 5); ctx.fill()
          // Pillow border stitch
          ctx.strokeStyle = 'rgba(210,208,215,0.7)'; ctx.lineWidth = 0.7
          ctx.beginPath(); ctx.roundRect(px-pW/2+3, pillowTop+3, pW-6, hd*0.2, 3); ctx.stroke()
          // Pillow centre crease
          ctx.strokeStyle = 'rgba(190,188,200,0.4)'; ctx.lineWidth = 0.5
          ctx.beginPath(); ctx.moveTo(px, pillowTop+5); ctx.lineTo(px, pillowTop+hd*0.2); ctx.stroke()
        }
      }
      break
    }
 
    // ════════════════════════════════════════════════════════════════════════
    case 'Storage': {
      // Carcass border
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.roundRect(-hw+3, -hd+3, item.w-6, item.d-6, 3); ctx.stroke()
 
      const numDoors = Math.max(1, Math.round(item.w / 46))
      const dW = (item.w - 6) / numDoors
 
      for (let i = 0; i < numDoors; i++) {
        const dx = -hw + 3 + i * dW + dW / 2
        // Door face
        ctx.fillStyle = 'rgba(205,192,165,0.2)'
        ctx.beginPath(); ctx.roundRect(dx - dW/2+2, -hd*0.65, dW-4, hd*1.22, 2); ctx.fill()
        woodGrain(dx - dW/2+2, -hd*0.65, dW-4, hd*1.22, 4)
        // Inset raised panel
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.7
        ctx.beginPath(); ctx.roundRect(dx-dW/2+6, -hd*0.55, dW-12, hd*1.02, 2); ctx.stroke()
        // Handle
        handle(dx, 0)
      }
 
      // Door split lines
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1.1
      for (let i = 1; i < numDoors; i++) {
        const sx = -hw + 3 + i * dW
        ctx.beginPath(); ctx.moveTo(sx, -hd+3); ctx.lineTo(sx, hd-3); ctx.stroke()
      }
      // Crown line
      ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(-hw+3, -hd+4); ctx.lineTo(hw-3, -hd+4); ctx.stroke()
      // Toe kick shadow
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      ctx.beginPath(); ctx.roundRect(-hw+3, hd-6, item.w-6, 3, 1); ctx.fill()
      break
    }
 
    // ════════════════════════════════════════════════════════════════════════
    case 'Office': {
      if (name.includes('chair')) {
        // Office chair top-down: 5-point star base + seat circle
        const r0 = Math.min(hw, hd) * 0.88
        ctx.fillStyle = 'rgba(0,0,0,0.14)'
        for (let i = 0; i < 5; i++) {
          const a = (i/5)*Math.PI*2 - Math.PI/2
          ctx.beginPath(); ctx.moveTo(0, 0)
          ctx.lineTo(Math.cos(a)*r0, Math.sin(a)*r0)
          ctx.lineTo(Math.cos(a+Math.PI/14)*r0*0.22, Math.sin(a+Math.PI/14)*r0*0.22)
          ctx.closePath(); ctx.fill()
        }
        // Seat
        ctx.fillStyle = 'rgba(40,40,50,0.35)'
        ctx.beginPath(); ctx.arc(0, 0, r0 * 0.55, 0, Math.PI*2); ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.beginPath(); ctx.ellipse(-r0*0.12, -r0*0.12, r0*0.22, r0*0.14, -0.5, 0, Math.PI*2); ctx.fill()
      } else {
        // Desk
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.roundRect(-hw+3, -hd+3, item.w-6, item.d-6, 3); ctx.stroke()
        woodGrain(-hw+4, -hd+4, item.w-8, item.d-8, 5)
 
        // Monitor (top area)
        const numScreens = item.w > 140 ? 2 : 1
        const scrW = Math.min(item.w*0.42, 58)
        const scrOffsets = numScreens === 2 ? [-item.w*0.22, item.w*0.22] : [0]
        for (const sox of scrOffsets) {
          ctx.fillStyle = 'rgba(15,18,55,0.75)'
          ctx.beginPath(); ctx.roundRect(sox-scrW/2, -hd+5, scrW, hd*0.5, 4); ctx.fill()
          // Screen glow
          ctx.fillStyle = 'rgba(30,60,210,0.3)'
          ctx.beginPath(); ctx.roundRect(sox-scrW/2+2, -hd+7, scrW-4, hd*0.43, 3); ctx.fill()
          // Screen highlight
          ctx.fillStyle = 'rgba(80,110,240,0.2)'
          ctx.beginPath(); ctx.roundRect(sox-scrW/2+3, -hd+8, scrW*0.4, hd*0.22, 2); ctx.fill()
          // Stand
          ctx.fillStyle = 'rgba(20,20,30,0.45)'
          ctx.beginPath(); ctx.roundRect(sox-4, -hd+hd*0.5+3, 8, 5, 1); ctx.fill()
        }
 
        // Keyboard
        ctx.fillStyle = 'rgba(20,20,28,0.28)'
        ctx.beginPath(); ctx.roundRect(-item.w*0.34, hd*0.16, item.w*0.68, hd*0.3, 3); ctx.fill()
        // Key rows
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5
        for (let r = 0; r < 3; r++) {
          ctx.beginPath()
          ctx.moveTo(-item.w*0.32, hd*0.21 + r*hd*0.09)
          ctx.lineTo(item.w*0.32, hd*0.21 + r*hd*0.09)
          ctx.stroke()
        }
 
        // Mouse
        ctx.fillStyle = 'rgba(20,20,28,0.32)'
        ctx.beginPath(); ctx.ellipse(hw*0.24, hd*0.28, hw*0.09, hd*0.14, 0, 0, Math.PI*2); ctx.fill()
      }
      break
    }
 
    // ════════════════════════════════════════════════════════════════════════
    case 'Bathroom': {
      if (name.includes('toilet')) {
        // Cistern (back tank)
        ctx.fillStyle = 'rgba(200,228,255,0.6)'
        ctx.beginPath(); ctx.roundRect(-hw*0.7, -hd+2, hw*1.4, hd*0.38, 3); ctx.fill()
        ctx.strokeStyle = 'rgba(0,100,200,0.3)'; ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.roundRect(-hw*0.7, -hd+2, hw*1.4, hd*0.38, 3); ctx.stroke()
        // Flush button
        ctx.fillStyle = 'rgba(100,150,205,0.7)'
        ctx.beginPath(); ctx.ellipse(0, -hd+hd*0.19, 5, 4, 0, 0, Math.PI*2); ctx.fill()
 
        // Bowl (oval)
        ctx.fillStyle = 'rgba(175,218,252,0.5)'
        ctx.beginPath(); ctx.ellipse(0, hd*0.24, hw*0.82, hd*0.44, 0, 0, Math.PI*2); ctx.fill()
        // Seat ring
        ctx.strokeStyle = 'rgba(190,220,250,0.8)'; ctx.lineWidth = 3
        ctx.beginPath(); ctx.ellipse(0, hd*0.24, hw*0.74, hd*0.38, 0, 0, Math.PI*2); ctx.stroke()
        // Inner water
        ctx.strokeStyle = 'rgba(0,100,200,0.2)'; ctx.lineWidth = 0.7
        ctx.beginPath(); ctx.ellipse(0, hd*0.24, hw*0.58, hd*0.28, 0, 0, Math.PI*2); ctx.stroke()
        // Water highlight
        ctx.fillStyle = 'rgba(210,238,255,0.3)'
        ctx.beginPath(); ctx.ellipse(-hw*0.18, hd*0.1, hw*0.28, hd*0.1, -0.3, 0, Math.PI*2); ctx.fill()
 
      } else if (name.includes('bathtub') || name.includes('tub')) {
        const br = Math.min(hw, hd) * 0.44
        // Rim border
        ctx.strokeStyle = 'rgba(0,100,180,0.22)'; ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.roundRect(-hw+3, -hd+3, item.w-6, item.d-6, br); ctx.stroke()
        // Water fill
        ctx.fillStyle = 'rgba(175,222,248,0.46)'
        ctx.beginPath(); ctx.roundRect(-hw+10, -hd+10, item.w-20, item.d-20, br*0.75); ctx.fill()
        // Water highlight
        ctx.fillStyle = 'rgba(215,240,255,0.32)'
        ctx.beginPath(); ctx.ellipse(-hw*0.18, -hd*0.22, hw*0.3, hd*0.13, -0.3, 0, Math.PI*2); ctx.fill()
        // Faucet end
        ctx.fillStyle = 'rgba(155,178,205,0.8)'
        ctx.beginPath(); ctx.arc(-hw+13, 0, 5.5, 0, Math.PI*2); ctx.fill()
        ctx.fillStyle = 'rgba(180,195,215,0.6)'
        ctx.beginPath(); ctx.arc(-hw+13, 0, 8, 0, Math.PI*2); ctx.stroke()
        // Drain (other end)
        ctx.strokeStyle = 'rgba(100,140,180,0.5)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(hw-13, 0, 4, 0, Math.PI*2); ctx.stroke()
 
      } else if (name.includes('shower')) {
        ctx.fillStyle = 'rgba(188,230,250,0.35)'
        ctx.beginPath(); ctx.roundRect(-hw+4, -hd+4, item.w-8, item.d-8, 6); ctx.fill()
        // Tray lines (drainage pattern)
        ctx.strokeStyle = 'rgba(0,100,180,0.12)'; ctx.lineWidth = 0.5
        for (let i = 1; i < 4; i++) {
          ctx.beginPath(); ctx.moveTo(-hw+6, -hd + i*(item.d/4)); ctx.lineTo(hw-6, -hd + i*(item.d/4)); ctx.stroke()
        }
        // Drain
        ctx.strokeStyle = 'rgba(100,140,180,0.6)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.stroke()
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.stroke()
 
      } else {
        // Sink/basin
        ctx.fillStyle = 'rgba(175,218,250,0.58)'
        ctx.beginPath(); ctx.roundRect(-hw+8, -hd+8, item.w-16, item.d-16, 10); ctx.fill()
        ctx.fillStyle = 'rgba(218,240,255,0.32)'
        ctx.beginPath(); ctx.roundRect(-hw+13, -hd+13, item.w-26, item.d-26, 8); ctx.fill()
        // Drain
        ctx.fillStyle = 'rgba(100,155,200,0.75)'
        ctx.beginPath(); ctx.arc(0, hd-14, 4.5, 0, Math.PI*2); ctx.fill()
        // Tap handles
        for (const sx of [-1,1]) {
          ctx.fillStyle = 'rgba(135,160,195,0.7)'
          ctx.beginPath(); ctx.arc(sx*8, hd-14, 3.5, 0, Math.PI*2); ctx.fill()
        }
      }
      break
    }
 
    // ════════════════════════════════════════════════════════════════════════
    case 'Kitchen': {
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.8
      ctx.beginPath(); ctx.roundRect(-hw+4, -hd+4, item.w-8, item.d-8, 4); ctx.stroke()
 
      if (name.includes('stove') || name.includes('cooktop') || name.includes('oven') || name.includes('range')) {
        // Cooktop surface
        ctx.fillStyle = 'rgba(22,22,22,0.14)'
        ctx.beginPath(); ctx.roundRect(-hw+5, -hd+5, item.w-10, item.d-10, 3); ctx.fill()
 
        const bPos = [
          [-hw*0.44, -hd*0.28], [hw*0.44, -hd*0.28],
          [-hw*0.44,  hd*0.22], [hw*0.44,  hd*0.22]
        ]
        for (const [bx, by] of bPos) {
          const br = Math.min(hw,hd)*0.185
          // Grate outer
          ctx.strokeStyle = 'rgba(15,15,15,0.55)'; ctx.lineWidth = 1.4
          ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI*2); ctx.stroke()
          // Middle ring
          ctx.lineWidth = 0.8
          ctx.beginPath(); ctx.arc(bx, by, br*0.55, 0, Math.PI*2); ctx.stroke()
          // Centre igniter
          ctx.fillStyle = 'rgba(10,10,10,0.65)'
          ctx.beginPath(); ctx.arc(bx, by, br*0.17, 0, Math.PI*2); ctx.fill()
          // Spokes (4)
          ctx.strokeStyle = 'rgba(15,15,15,0.4)'; ctx.lineWidth = 1
          for (let a = 0; a < 4; a++) {
            ctx.beginPath()
            ctx.moveTo(bx + Math.cos(a*Math.PI/2)*br*0.22, by + Math.sin(a*Math.PI/2)*br*0.22)
            ctx.lineTo(bx + Math.cos(a*Math.PI/2)*br*0.92, by + Math.sin(a*Math.PI/2)*br*0.92)
            ctx.stroke()
          }
        }
        // Control knobs (bottom row)
        ctx.fillStyle = 'rgba(20,20,20,0.45)'
        for (let i = 0; i < 4; i++) {
          const kx = -hw*0.5 + i*(hw*0.33)
          ctx.beginPath(); ctx.arc(kx, hd-8, 3.5, 0, Math.PI*2); ctx.fill()
          ctx.strokeStyle = 'rgba(80,80,80,0.4)'; ctx.lineWidth = 0.5
          ctx.beginPath(); ctx.arc(kx, hd-8, 5.2, 0, Math.PI*2); ctx.stroke()
        }
 
      } else if (name.includes('sink')) {
        ctx.fillStyle = 'rgba(165,210,232,0.5)'
        ctx.beginPath(); ctx.roundRect(-hw+10, -hd+7, item.w-20, item.d-14, 7); ctx.fill()
        ctx.strokeStyle = 'rgba(0,100,180,0.3)'; ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.roundRect(-hw+10, -hd+7, item.w-20, item.d-14, 7); ctx.stroke()
        // Water highlight
        ctx.fillStyle = 'rgba(210,238,255,0.3)'
        ctx.beginPath(); ctx.ellipse(-hw*0.12, -hd*0.08, hw*0.25, hd*0.12, -0.3, 0, Math.PI*2); ctx.fill()
        // Drain
        ctx.fillStyle = 'rgba(100,155,200,0.75)'
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill()
        // Tap
        ctx.fillStyle = 'rgba(140,162,190,0.72)'
        ctx.beginPath(); ctx.roundRect(-4, -hd+11, 8, 6, 2); ctx.fill()
 
      } else if (name.includes('fridge') || name.includes('refrigerator')) {
        // Fridge: freezer top, main below
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(-hw+4, -hd*0.28); ctx.lineTo(hw-4, -hd*0.28); ctx.stroke()
        // Freezer surface
        ctx.fillStyle = 'rgba(255,255,255,0.14)'
        ctx.beginPath(); ctx.roundRect(-hw*0.68, -hd*0.88, hw*1.36*0.65, hd*0.56, 2); ctx.fill()
        // Main door
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.beginPath(); ctx.roundRect(-hw*0.68, -hd*0.24, hw*1.36*0.65, hd*0.98, 2); ctx.fill()
        // Handles
        for (const hy of [-hd*0.58, hd*0.3]) {
          ctx.fillStyle = 'rgba(155,155,145,0.72)'
          ctx.beginPath(); ctx.roundRect(-hw*0.6, hy-3, hw*0.28, 6, 2); ctx.fill()
        }
 
      } else if (name.includes('island') || name.includes('counter')) {
        woodGrain(-hw+5, -hd+5, item.w-10, item.d-10, 6)
        ctx.fillStyle = 'rgba(255,255,255,0.14)'
        ctx.beginPath(); ctx.roundRect(-hw*0.68, -hd*0.62, hw*0.8, hd*0.28, 2); ctx.fill()
 
      } else {
        woodGrain(-hw+5, -hd+5, item.w-10, item.d-10, 5)
        ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 0.6
        ctx.beginPath(); ctx.moveTo(-hw+6, -hd+6); ctx.lineTo(hw-6, -hd+6); ctx.stroke()
      }
      break
    }
 
    // ════════════════════════════════════════════════════════════════════════
    case 'Lighting': {
      const r0 = Math.min(hw, hd)
      // Outer glow halo
      const grad = ctx.createRadialGradient(0, 0, r0*0.2, 0, 0, r0*0.95)
      grad.addColorStop(0, 'rgba(255,248,200,0.88)')
      grad.addColorStop(0.45, 'rgba(253,186,116,0.52)')
      grad.addColorStop(0.75, 'rgba(253,186,116,0.22)')
      grad.addColorStop(1, 'rgba(253,186,116,0)')
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.arc(0, 0, r0*0.95, 0, Math.PI*2); ctx.fill()
      // Shade ring
      ctx.strokeStyle = 'rgba(200,140,60,0.3)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(0, 0, r0*0.55, 0, Math.PI*2); ctx.stroke()
      // Bright bulb centre
      ctx.fillStyle = 'rgba(255,252,220,1.0)'
      ctx.beginPath(); ctx.arc(0, 0, r0*0.22, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,1.0)'
      ctx.beginPath(); ctx.arc(0, 0, r0*0.1, 0, Math.PI*2); ctx.fill()
      // Rays (12)
      ctx.strokeStyle = 'rgba(253,200,80,0.18)'; ctx.lineWidth = 0.7
      for (let a = 0; a < Math.PI*2; a += Math.PI/6) {
        ctx.beginPath()
        ctx.moveTo(Math.cos(a)*r0*0.6, Math.sin(a)*r0*0.6)
        ctx.lineTo(Math.cos(a)*r0*0.85, Math.sin(a)*r0*0.85)
        ctx.stroke()
      }
      break
    }
 
    // ════════════════════════════════════════════════════════════════════════
    case 'Living Room': {
      if (name.includes('tv') || name.includes('television')) {
        // Bezel
        ctx.fillStyle = 'rgba(6,6,18,0.82)'
        ctx.beginPath(); ctx.roundRect(-hw+3, -hd+3, item.w-6, item.d-6, 3); ctx.fill()
        // Screen
        ctx.fillStyle = 'rgba(8,16,72,0.58)'
        ctx.beginPath(); ctx.roundRect(-hw+5, -hd+5, item.w-10, item.d-8, 2); ctx.fill()
        // Screen content glow
        ctx.fillStyle = 'rgba(25,50,180,0.22)'
        ctx.beginPath(); ctx.roundRect(-hw+6, -hd+6, (item.w-12)*0.55, (item.d-10)*0.45, 2); ctx.fill()
        // Reflection glare
        ctx.fillStyle = 'rgba(100,130,220,0.12)'
        ctx.beginPath(); ctx.roundRect(-hw+7, -hd+7, (item.w-14)*0.38, (item.d-12)*0.32, 2); ctx.fill()
        // Power LED
        ctx.fillStyle = 'rgba(0,148,255,0.8)'
        ctx.beginPath(); ctx.arc(hw-8, hd-6, 2.5, 0, Math.PI*2); ctx.fill()
        // Stand base
        ctx.strokeStyle = 'rgba(40,40,50,0.4)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(-hw*0.25, hd-3); ctx.lineTo(hw*0.25, hd-3); ctx.stroke()
 
      } else if (name.includes('rug') || name.includes('carpet') || name.includes('mat')) {
        // Rug with decorative border and medallion
        ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.roundRect(-hw+5, -hd+5, item.w-10, item.d-10, 5); ctx.stroke()
        // Secondary border
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.roundRect(-hw+10, -hd+10, item.w-20, item.d-20, 3); ctx.stroke()
        // Third border
        ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 0.6
        ctx.beginPath(); ctx.roundRect(-hw+15, -hd+15, item.w-30, item.d-30, 2); ctx.stroke()
        // Medallion
        ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 0.7
        ctx.beginPath(); ctx.ellipse(0, 0, hw*0.32, hd*0.32, 0, 0, Math.PI*2); ctx.stroke()
        ctx.beginPath(); ctx.ellipse(0, 0, hw*0.18, hd*0.18, 0, 0, Math.PI*2); ctx.stroke()
        // Cross lines
        ctx.beginPath(); ctx.moveTo(-hw+18, 0); ctx.lineTo(hw-18, 0); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, -hd+18); ctx.lineTo(0, hd-18); ctx.stroke()
        // Diagonal accents
        ctx.strokeStyle = 'rgba(0,0,0,0.05)'
        ctx.beginPath(); ctx.moveTo(-hw*0.52, -hd*0.52); ctx.lineTo(hw*0.52, hd*0.52); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(hw*0.52, -hd*0.52); ctx.lineTo(-hw*0.52, hd*0.52); ctx.stroke()
 
      } else if (name.includes('fireplace') || name.includes('fire')) {
        ctx.fillStyle = 'rgba(75,65,50,0.35)'
        ctx.beginPath(); ctx.roundRect(-hw+4, -hd+4, item.w-8, item.d-8, 4); ctx.fill()
        // Opening (dark recess)
        ctx.fillStyle = 'rgba(10,7,4,0.72)'
        ctx.beginPath(); ctx.roundRect(-hw*0.58, -hd*0.85, hw*1.16, hd*1.38, 4); ctx.fill()
        // Fire glow
        const fireGrad = ctx.createRadialGradient(0, hd*0.05, 0, 0, hd*0.05, hw*0.44)
        fireGrad.addColorStop(0, 'rgba(255,230,100,0.85)')
        fireGrad.addColorStop(0.4, 'rgba(255,120,20,0.65)')
        fireGrad.addColorStop(1, 'rgba(200,50,0,0)')
        ctx.fillStyle = fireGrad
        ctx.beginPath(); ctx.ellipse(0, hd*0.05, hw*0.44, hd*0.32, 0, 0, Math.PI*2); ctx.fill()
        // Flame tips
        for (let i = 0; i < 5; i++) {
          const fx = (Math.random()-0.5)*hw*0.5
          ctx.fillStyle = `rgba(255,${140+Math.floor(Math.random()*80)},0,0.55)`
          ctx.beginPath(); ctx.arc(fx, -hd*0.06+(Math.random()-0.5)*hd*0.2, 4, 0, Math.PI*2); ctx.fill()
        }
        // Mantel line
        ctx.strokeStyle = 'rgba(100,80,45,0.5)'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(-hw+3, -hd+4); ctx.lineTo(hw-3, -hd+4); ctx.stroke()
 
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.7
        ctx.beginPath(); ctx.roundRect(-hw+6, -hd+6, item.w-12, item.d-12, 3); ctx.stroke()
      }
      break
    }
 
    // ════════════════════════════════════════════════════════════════════════
    case 'Decor': {
      if (name.includes('plant') || name.includes('tree') || name.includes('flower')) {
        const pr = Math.min(hw, hd)
        // Pot (bottom)
        ctx.fillStyle = 'rgba(140,88,48,0.6)'
        ctx.beginPath(); ctx.ellipse(0, hd*0.3, pr*0.32, pr*0.2, 0, 0, Math.PI*2); ctx.fill()
        // Soil
        ctx.fillStyle = 'rgba(35,18,5,0.48)'
        ctx.beginPath(); ctx.ellipse(0, hd*0.28, pr*0.28, pr*0.16, 0, 0, Math.PI*2); ctx.fill()
        // Canopy (layered)
        ctx.fillStyle = 'rgba(28,120,50,0.25)'
        ctx.beginPath(); ctx.arc(0, 0, pr*0.54, 0, Math.PI*2); ctx.fill()
        ctx.strokeStyle = 'rgba(28,125,48,0.6)'; ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.arc(0, 0, pr*0.52, 0, Math.PI*2); ctx.stroke()
        ctx.fillStyle = 'rgba(35,148,55,0.35)'
        ctx.beginPath(); ctx.arc(0, 0, pr*0.35, 0, Math.PI*2); ctx.fill()
        // Leaf highlights
        for (const [lx,ly] of [[-pr*0.18,-pr*0.28],[pr*0.2,-pr*0.22],[-pr*0.25,pr*0.05],[pr*0.12,pr*0.2]]) {
          ctx.fillStyle = 'rgba(60,180,80,0.2)'
          ctx.beginPath(); ctx.ellipse(lx, ly, pr*0.14, pr*0.09, Math.atan2(ly,lx), 0, Math.PI*2); ctx.fill()
        }
        // Stems
        ctx.strokeStyle = 'rgba(28,120,45,0.7)'; ctx.lineWidth = 1.5
        for (const [tx,ty] of [[0,-pr*0.2],[-pr*0.3,-pr*0.28],[pr*0.28,-pr*0.25]]) {
          ctx.beginPath(); ctx.moveTo(0, pr*0.22); ctx.lineTo(tx, ty); ctx.stroke()
        }
      } else if (name.includes('vase')) {
        // Vase: narrow neck, round body
        ctx.fillStyle = 'rgba(180,140,100,0.55)'
        ctx.beginPath()
        ctx.ellipse(0, hd*0.22, hw*0.72, hd*0.62, 0, 0, Math.PI*2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(0, -hd*0.52, hw*0.28, hd*0.22, 0, 0, Math.PI*2)
        ctx.fill()
        ctx.fillStyle = 'rgba(220,185,140,0.3)'
        ctx.beginPath(); ctx.ellipse(-hw*0.2, 0, hw*0.18, hd*0.22, -0.4, 0, Math.PI*2); ctx.fill()
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.roundRect(-hw+4, -hd+4, item.w-8, item.d-8, 3); ctx.stroke()
      }
      break
    }
 
    // ════════════════════════════════════════════════════════════════════════
    case 'Outdoor': {
      if (name.includes('chair') || name.includes('lounger')) {
        ctx.fillStyle = 'rgba(180,160,100,0.32)'
        ctx.beginPath(); ctx.roundRect(-hw+4, -hd+4, item.w-8, item.d-8, 8); ctx.fill()
        // Slats
        ctx.strokeStyle = 'rgba(120,90,50,0.35)'; ctx.lineWidth = 1
        const numSlats = Math.round(item.d / 14)
        for (let i = 0; i < numSlats; i++) {
          const sy = -hd + 6 + i * ((item.d-12)/numSlats)
          ctx.beginPath(); ctx.moveTo(-hw+5, sy); ctx.lineTo(hw-5, sy); ctx.stroke()
        }
      } else {
        ctx.strokeStyle = 'rgba(100,130,80,0.35)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.roundRect(-hw+4, -hd+4, item.w-8, item.d-8, 5); ctx.stroke()
      }
      break
    }
 
    // ════════════════════════════════════════════════════════════════════════
    case 'Custom':
      ctx.strokeStyle = 'rgba(139,92,246,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([4,3])
      ctx.beginPath(); ctx.rect(-hw+4, -hd+4, item.w-8, item.d-8); ctx.stroke(); ctx.setLineDash([])
      ctx.strokeStyle = 'rgba(139,92,246,0.3)'; ctx.lineWidth = 0.8
      ctx.beginPath(); ctx.moveTo(-hw+4,-hd+4); ctx.lineTo(hw-4,hd-4); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(hw-4,-hd+4); ctx.lineTo(-hw+4,hd-4); ctx.stroke()
      break
 
    default: break
  }
 
  ctx.restore()
}

function drawTopPreviewImage(ctx, url, item, imgCache) {
  if (!url) return false
  const img = imgCache?.[url]
  if (!img || !img.complete || img.naturalWidth <= 0) return false
  const w = item.w, d = item.d
  const pad = Math.max(3, Math.min(10, Math.min(w, d) * 0.06))
  // Draw inside the item's bounds (already rotated by caller).
  ctx.save()
  ctx.globalAlpha = 0.98
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(img, -w / 2 + pad, -d / 2 + pad, w - pad * 2, d - pad * 2)
  ctx.restore()
  return true
}

function draw(canvas, state) {
  const { cfg, items, overlays, selected, selectedOverlay, zoom, panX, panY, topDownCache, imgCache, modelThumbById } = state
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.restore()
  ctx.save()
  ctx.setTransform(dpr*zoom, 0, 0, dpr*zoom, dpr*panX, dpr*panY)
  ctx.imageSmoothingEnabled = false
  const CW=canvas.width/dpr, CH=canvas.height/dpr
  const vx=-panX/zoom-20, vy=-panY/zoom-20, vw=CW/zoom+40, vh=CH/zoom+40
  const cfg_w=cfg.width||5, cfg_d=cfg.depth||4
  const shape=cfg.shape||'rectangle'
  const RW=(shape==='square'?Math.min(cfg_w,cfg_d):cfg_w)*GRID
  const RD=(shape==='square'?Math.min(cfg_w,cfg_d):cfg_d)*GRID

  // Background + grid
  ctx.fillStyle='#dde3ee'; ctx.fillRect(vx,vy,vw,vh)
  const gx0=Math.floor(vx/GRID)*GRID, gy0=Math.floor(vy/GRID)*GRID
  ctx.strokeStyle='rgba(148,163,200,0.18)'; ctx.lineWidth=0.5
  for(let x=gx0;x<vx+vw;x+=GRID){ctx.beginPath();ctx.moveTo(x,vy);ctx.lineTo(x,vy+vh);ctx.stroke()}
  for(let y=gy0;y<vy+vh;y+=GRID){ctx.beginPath();ctx.moveTo(vx,y);ctx.lineTo(vx+vw,y);ctx.stroke()}
  ctx.strokeStyle='rgba(100,130,200,0.22)'; ctx.lineWidth=0.9
  for(let x=gx0;x<vx+vw;x+=GRID*5){ctx.beginPath();ctx.moveTo(x,vy);ctx.lineTo(x,vy+vh);ctx.stroke()}
  for(let y=gy0;y<vy+vh;y+=GRID*5){ctx.beginPath();ctx.moveTo(vx,y);ctx.lineTo(vx+vw,y);ctx.stroke()}

  const poly=roomPoly(cfg)
  const tracePoly=()=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath()}

  // Room shadow
  ctx.save(); ctx.shadowColor='rgba(0,0,0,0.22)'; ctx.shadowBlur=24; ctx.shadowOffsetX=5; ctx.shadowOffsetY=7
  tracePoly(); ctx.fillStyle='#fff'; ctx.fill(); ctx.restore()

  // Floor
  ctx.save(); tracePoly(); ctx.clip()
  ctx.fillStyle=FLOOR_COL[cfg.floorTexture]||'#c8a46e'; ctx.fill()
  if(cfg.floorTexture==='wood'){
    const ph=12; ctx.strokeStyle='rgba(100,60,20,0.2)'; ctx.lineWidth=0.6
    for(let y=OY;y<OY+RD+ph;y+=ph){ctx.beginPath();ctx.moveTo(OX,y);ctx.lineTo(OX+RW,y);ctx.stroke()}
    ctx.strokeStyle='rgba(100,60,20,0.1)'; ctx.lineWidth=0.4
    for(let y=OY,row=0;y<OY+RD;y+=ph,row++){
      const off=row%2?0:RW*0.33
      for(let x=OX+off;x<OX+RW;x+=RW*0.45){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+ph);ctx.stroke()}
    }
  } else if(cfg.floorTexture==='tile'){
    const ts=22; ctx.strokeStyle='rgba(130,130,130,0.3)'; ctx.lineWidth=0.6
    for(let x=OX;x<=OX+RW;x+=ts){ctx.beginPath();ctx.moveTo(x,OY);ctx.lineTo(x,OY+RD);ctx.stroke()}
    for(let y=OY;y<=OY+RD;y+=ts){ctx.beginPath();ctx.moveTo(OX,y);ctx.lineTo(OX+RW,y);ctx.stroke()}
  } else if(cfg.floorTexture==='marble'){
    ctx.strokeStyle='rgba(160,140,120,0.22)'; ctx.lineWidth=0.8
    for(let x=OX;x<OX+RW;x+=35){ctx.beginPath();ctx.moveTo(x,OY);ctx.lineTo(x,OY+RD);ctx.stroke()}
    for(let y=OY;y<OY+RD;y+=35){ctx.beginPath();ctx.moveTo(OX,y);ctx.lineTo(OX+RW,y);ctx.stroke()}
  } else if(cfg.floorTexture==='carpet'){
    ctx.fillStyle='rgba(0,0,0,0.05)'
    for(let x=OX;x<OX+RW;x+=8) for(let y2=OY;y2<OY+RD;y2+=8){ctx.beginPath();ctx.arc(x+4,y2+4,1,0,Math.PI*2);ctx.fill()}
  } else if(cfg.floorTexture==='concrete'){
    ctx.strokeStyle='rgba(100,100,100,0.1)'; ctx.lineWidth=0.5
    for(let x=OX;x<OX+RW;x+=40){ctx.beginPath();ctx.moveTo(x,OY);ctx.lineTo(x,OY+RD);ctx.stroke()}
    for(let y=OY;y<OY+RD;y+=40){ctx.beginPath();ctx.moveTo(OX,y);ctx.lineTo(OX+RW,y);ctx.stroke()}
  }
  ctx.restore()

  // Walls
  tracePoly(); ctx.strokeStyle='#0f172a'; ctx.lineWidth=14; ctx.lineJoin='round'; ctx.stroke()
  tracePoly(); ctx.strokeStyle=cfg.wallColor||'#F5F5F0'; ctx.lineWidth=10; ctx.stroke()
  tracePoly(); ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1.5; ctx.stroke()

  // Dimensions
  ctx.fillStyle='#475569'; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.font='600 11px DM Sans,system-ui,sans-serif'
  ctx.fillText(`${cfg_w} m`,OX+RW/2,OY-22)
  ctx.save(); ctx.translate(OX-28,OY+RD/2); ctx.rotate(-Math.PI/2); ctx.fillText(`${cfg_d} m`,0,0); ctx.restore()

  // Compass
  const cpx=OX+RW+38, cpy=OY+24
  ctx.save(); ctx.font='600 9px DM Sans,sans-serif'; ctx.textAlign='center'
  ctx.fillStyle='#dc2626'; ctx.fillText('N',cpx,cpy-15)
  ctx.fillStyle='#94a3b8'; ctx.fillText('S',cpx,cpy+19); ctx.fillText('W',cpx-17,cpy+4); ctx.fillText('E',cpx+17,cpy+4)
  ctx.beginPath(); ctx.moveTo(cpx,cpy-10); ctx.lineTo(cpx+4,cpy+3); ctx.lineTo(cpx,cpy); ctx.closePath(); ctx.fillStyle='#dc2626'; ctx.fill()
  ctx.beginPath(); ctx.moveTo(cpx,cpy+10); ctx.lineTo(cpx-4,cpy-3); ctx.lineTo(cpx,cpy); ctx.closePath(); ctx.fillStyle='#94a3b8'; ctx.fill()
  ctx.restore()

  // Overlays
  if(overlays){
    ;(overlays.doors||[]).forEach(d=>drawDoor(ctx,d,selectedOverlay?.id===d.id))
    ;(overlays.windows||[]).forEach(w=>drawWindow(ctx,w,selectedOverlay?.id===w.id))
    ;(overlays.curtains||[]).forEach(c=>drawCurtain(ctx,c,selectedOverlay?.id===c.id))
  }

  // Furniture
  ;(items||[]).forEach(item=>{
    if(item.x==null||item.y==null) return
    const sel=item.id===selected; ctx.save()
    ctx.translate(item.x+item.w/2, item.y+item.d/2)
    ctx.rotate((item.rotation||0)*Math.PI/180)
    ctx.shadowColor=sel?'rgba(59,130,246,0.4)':'rgba(0,0,0,0.2)'; ctx.shadowBlur=sel?16:8
    ctx.shadowOffsetX=2; ctx.shadowOffsetY=3
    const base=item.color||CAT_COLOR[item.category]||'#93b4fd'

    // If we have a real top-view preview image, draw it first (more realistic than shapes).
    const previewUrl = item.topViewUrl || item.thumbnailUrl || item.previewUrl || modelThumbById?.[item.modelId] || null
    // Add a soft ground shadow even when using an image preview (so it feels "finished")
    let drewImg = false
    if (previewUrl) {
      ctx.save()
      ctx.shadowColor = sel ? 'rgba(59,130,246,0.35)' : 'rgba(0,0,0,0.22)'
      ctx.shadowBlur = sel ? 18 : 12
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 3
      // Use the silhouette as shadow-caster
      ctx.fillStyle = 'rgba(0,0,0,0.001)'
      traceFurnitureSilhouette(ctx, item)
      ctx.fill()
      ctx.restore()
      drewImg = drawTopPreviewImage(ctx, previewUrl, item, imgCache)
    }

    // Custom 3D model — draw true top-down silhouette (no forced rectangle base)
    const tdData = item.customModelId && topDownCache ? topDownCache[item.customModelId] : null
    if (tdData?.pts2d?.length) {
      // If we already drew a preview image, keep the silhouette subtle as a hit/outline aid.
      drawModelTopDown(ctx, item, tdData, {
        fillStyle: drewImg ? 'rgba(0,0,0,0.02)' : (base + '26'),
        strokeStyle: sel ? '#3b82f6' : (drewImg ? 'rgba(0,0,0,0.18)' : (base + 'aa')),
        lineWidth: sel ? 2.5 : (drewImg ? 1.2 : 1.6),
        rotationDeg: 0,
      })
    } else {
      ctx.fillStyle = base
      traceFurnitureSilhouette(ctx, item)
      ctx.fill()
      // Subtle sheen
      try {
        const g=ctx.createLinearGradient(-item.w/2,-item.d/2,item.w/2,item.d/2)
        g.addColorStop(0,'rgba(255,255,255,0.25)'); g.addColorStop(1,'rgba(0,0,0,0.06)')
        ctx.fillStyle=g
        traceFurnitureSilhouette(ctx, item)
        ctx.fill()
      } catch(_){}
      // Outline
      ctx.strokeStyle=sel?'#3b82f6':'rgba(0,0,0,0.25)'; ctx.lineWidth=sel?2.5:1.5
      traceFurnitureSilhouette(ctx, item)
      ctx.stroke()
    }
    ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0
    drawFurnDetail(ctx,item,topDownCache)
    const fs=Math.max(7,Math.min(13,Math.min(item.w,item.d)/4.5))
    ctx.fillStyle='rgba(15,23,42,0.85)'; ctx.font=`600 ${fs}px DM Sans,system-ui,sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'
    let lbl=item.label||item.name||''
    while(lbl.length>2 && ctx.measureText(lbl).width>item.w-10) lbl=lbl.slice(0,-1)
    if(lbl!==(item.label||item.name||'')) lbl+='…'
    ctx.fillText(lbl,0,0)
    if(sel){
      ctx.strokeStyle='#3b82f6'; ctx.lineWidth=1.5; ctx.setLineDash([5,3])
      ctx.beginPath(); ctx.roundRect(-item.w/2-6,-item.d/2-6,item.w+12,item.d+12,8); ctx.stroke(); ctx.setLineDash([])
      ;[[-item.w/2-5,-item.d/2-5],[item.w/2+5,-item.d/2-5],[-item.w/2-5,item.d/2+5],[item.w/2+5,item.d/2+5]].forEach(([hx,hy])=>{
        const hs=8; ctx.fillStyle='#fff'; ctx.strokeStyle='#3b82f6'; ctx.lineWidth=1.5
        ctx.beginPath(); ctx.rect(hx-hs/2,hy-hs/2,hs,hs); ctx.fill(); ctx.stroke()
      })
      const rh=18; ctx.fillStyle='#f59e0b'; ctx.strokeStyle='#fff'; ctx.lineWidth=1.5
      ctx.beginPath(); ctx.arc(0,-item.d/2-rh,6,0,Math.PI*2); ctx.fill(); ctx.stroke()
      ctx.strokeStyle='rgba(245,158,11,0.6)'; ctx.lineWidth=1.5; ctx.setLineDash([3,2])
      ctx.beginPath(); ctx.moveTo(0,-item.d/2-5); ctx.lineTo(0,-item.d/2-rh+6); ctx.stroke(); ctx.setLineDash([])
    }
    ctx.restore()
  })
  ctx.restore()
}

async function makePlanThumbnailBlob(canvas, options = {}) {
  const scale = options.scale || 2
  const w = Math.max(1200, Math.round((canvas.width || 640) * scale / (window.devicePixelRatio || 1)))
  const h = Math.max(680, Math.round((canvas.height || 360) * scale / (window.devicePixelRatio || 1)))
  const out = document.createElement('canvas')
  out.width = w; out.height = h
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)

  const sx = canvas.width, sy = canvas.height
  const sAspect = sx / sy
  const oAspect = w / h
  let dw = w, dh = h, dx = 0, dy = 0
  if (sAspect > oAspect) { dh = w / sAspect; dy = (h - dh) / 2 }
  else { dw = h * sAspect; dx = (w - dw) / 2 }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, sx, sy, dx, dy, dw, dh)

  return await new Promise((resolve) => out.toBlob(resolve, 'image/png', 0.96))
}

async function makePlanThumbnailWithNamesBlob(canvas, items = [], overlays = {}, options = {}) {
  const baseBlob = await makePlanThumbnailBlob(canvas, options)
  if (!baseBlob) return null
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i); i.onerror = reject;
    i.src = URL.createObjectURL(baseBlob)
  })

  const padding = 160
  const w = img.width
  const h = img.height + padding
  const out = document.createElement('canvas')
  out.width = w; out.height = h
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, img.height)

  const names = []
  for (const i of items) {
    const label = i.name || i.label || `${i.category || 'Item'} ${i.id}`
    names.push(`${i.category || 'Furniture'}: ${label}`)
  }
  const doorNames = (overlays.doors || []).map((d, idx) => `${d.name || `Door ${idx + 1}`}`)
  const windowNames = (overlays.windows || []).map((w, idx) => `${w.name || `Window ${idx + 1}`}`)
  const curtainNames = (overlays.curtains || []).map((c, idx) => `${c.name || `Curtain ${idx + 1}`}`)

  if (doorNames.length) names.push(`Doors: ${doorNames.join(', ')}`)
  if (windowNames.length) names.push(`Windows: ${windowNames.join(', ')}`)
  if (curtainNames.length) names.push(`Curtains: ${curtainNames.join(', ')}`)
  if (names.length === 0) names.push('No named components')

  const fontSize = 16
  ctx.fillStyle = '#111827'
  ctx.font = `bold ${fontSize}px DM Sans, system-ui, sans-serif`
  ctx.textBaseline = 'top'
  const startY = img.height + 12
  let y = startY
  const maxLines = Math.floor((padding - 20) / (fontSize + 4))
  for (let i = 0; i < Math.min(names.length, maxLines); i++) {
    const line = names[i]
    ctx.fillText(line, 16, y)
    y += fontSize + 4
  }
  if (names.length > maxLines) {
    ctx.fillText(`...and ${names.length - maxLines} more entries`, 16, y)
  }

  return await new Promise((resolve) => out.toBlob(resolve, 'image/png', 0.96))
}

/* ════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════ */
export default function Workspace2D() {
  const { id } = useParams()
  const navigate = useNavigate()
  const canvasRef   = useRef(null)
  const wrapRef     = useRef(null)
  const sizedRef    = useRef(false)
  const fileInputRef = useRef(null)   // ← reliable file trigger

  // ── Shared design store (syncs with Workspace3D) ──
  const designStore = useDesignStore()

  const [project,       setProject]       = useState(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft,     setNameDraft]     = useState('')
  const [loading,       setLoading]       = useState(true)
  const [cfg,           setCfg]           = useState({ shape:'rectangle', width:5, depth:4, height:2.8, wallColor:'#F5F5F0', floorTexture:'wood' })
  const [items,         setItems]         = useState([])
  const [overlays,      setOverlays]      = useState({ doors:[], windows:[], curtains:[] })
  const [selected,      setSelected]      = useState(null)
  const [selectedOverlay, setSelectedOverlay] = useState(null)
  const [dirty,         setDirty]         = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [zoom,          setZoom]          = useState(1)
  const [panX,          setPanX]          = useState(80)
  const [panY,          setPanY]          = useState(60)
  const [mode,          setMode]          = useState('select')
  const [leftOpen,      setLeftOpen]      = useState(true)
  const [activeTab,     setActiveTab]     = useState('furniture')
  const [furSearch,     setFurSearch]     = useState('')
  const [furCat,        setFurCat]        = useState('All')
  const [library,       setLibrary]       = useState(FURNITURE_LIBRARY)
  const [curtainColor,  setCurtainColor]  = useState('#fca5a5')
  const [pendingFit,    setPendingFit]    = useState(false)
  const [customModels,  setCustomModels]  = useState([])
  const [uploadingModel,setUploadingModel]= useState(false)
  const [topDownCache,  setTopDownCache]  = useState({})
  const imgCacheRef = useRef({})
  const [imgCacheTick, setImgCacheTick] = useState(0) // trigger redraw when images load
  const previewJobsRef = useRef(new Map()) // modelId -> boolean (in-flight)
  const [modelsExpanded,setModelsExpanded]= useState(true)
  const [catScroll,     setCatScroll]     = useState(0) // eslint-disable-line

  const stateRef = useRef({})
  // Build a quick lookup: backend modelId -> topViewUrl/thumbnailUrl
  const modelThumbById = useRef({})
  stateRef.current = { cfg, items, overlays, selectedOverlay, selected, zoom, panX, panY, topDownCache, customModels, imgCache: imgCacheRef.current, modelThumbById: modelThumbById.current }
  const zoomRef = useRef(zoom); useEffect(()=>{ zoomRef.current=zoom },[zoom])
  const panRef  = useRef({x:panX,y:panY}); useEffect(()=>{ panRef.current={x:panX,y:panY} },[panX,panY])
  const drag    = useRef(null)
  const history = useRef([])
  const redoStack = useRef([])
  const isDragging = useRef(false)  // ← prevents store sync during drag frames

  // ── Sync items/overlays/cfg TO shared store whenever they change ──
  // Guard: skip sync while dragging to avoid lag (sync happens on mouseUp instead)
  useEffect(()=>{ if(!isDragging.current) designStore.setItems(items) },[items]) // eslint-disable-line
  useEffect(()=>{ designStore.setOverlays(overlays) },[overlays]) // eslint-disable-line
  useEffect(()=>{ designStore.setCfg(cfg) },[cfg]) // eslint-disable-line
  useEffect(()=>{ designStore.setCustomModels(customModels) },[customModels]) // eslint-disable-line

  /* ── Fit to view ── */
  const computeFit = useCallback((cw, ch, c) => {
    const sh=c.shape||'rectangle', w=c.width||5, d=c.depth||4
    const RW=(sh==='square'?Math.min(w,d):w)*GRID
    const RD=(sh==='square'?Math.min(w,d):d)*GRID
    const pad=120
    const nz=Math.max(0.08,Math.min(4,Math.min((cw-pad)/(RW+OX*2),(ch-pad)/(RD+OY*2))))
    return { zoom:nz, panX:(cw-(RW+OX*2)*nz)/2, panY:(ch-(RD+OY*2)*nz)/2 }
  },[])

  /* ── Canvas size / draw ── */
  useLayoutEffect(()=>{
    const canvas=canvasRef.current, wrap=wrapRef.current; if(!canvas||!wrap) return
    const sizeCanvas=()=>{
      const dpr=window.devicePixelRatio||1, w=wrap.clientWidth, h=wrap.clientHeight; if(!w||!h) return
      const pw=Math.round(w*dpr), ph=Math.round(h*dpr)
      if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;canvas.style.width=w+'px';canvas.style.height=h+'px'}
      if(!sizedRef.current){sizedRef.current=true;if(pendingFit){const f=computeFit(w,h,stateRef.current.cfg);setZoom(f.zoom);setPanX(f.panX);setPanY(f.panY);setPendingFit(false)}}
      draw(canvas,stateRef.current)
    }
    sizeCanvas()
    const ro=new ResizeObserver(sizeCanvas); ro.observe(wrap)
    return ()=>ro.disconnect()
  },[computeFit,pendingFit]) // eslint-disable-line

  useEffect(()=>{
    const c=canvasRef.current; if(!c||c.width===0) return
    draw(c,{cfg,items,overlays,selected,selectedOverlay,zoom,panX,panY,topDownCache,imgCache:imgCacheRef.current,modelThumbById:modelThumbById.current})
  },[cfg,items,overlays,selected,selectedOverlay,zoom,panX,panY,topDownCache,imgCacheTick])

  useEffect(()=>{
    if(!pendingFit) return
    const canvas=canvasRef.current; if(!canvas||canvas.width===0) return
    const dpr=window.devicePixelRatio||1
    const f=computeFit(canvas.width/dpr,canvas.height/dpr,cfg)
    setZoom(f.zoom); setPanX(f.panX); setPanY(f.panY); setPendingFit(false)
  },[pendingFit,cfg,computeFit])

  /* ── Load project ── */
  useEffect(()=>{
    setLoading(true)
    projectsApi.getById(id).then(p=>{
      setProject(p)
      let c={shape:'rectangle',width:5,depth:4,height:2.8,wallColor:'#F5F5F0',floorTexture:'wood'}
      try{c=JSON.parse(p.roomConfig)}catch{}
      setCfg(c)
      let its=[], ov={doors:[],windows:[],curtains:[]}, cms=[]
      try{
        const saved=JSON.parse(p.furnitureLayout)
        if(saved?.items){
          its=Array.isArray(saved.items)?saved.items:[]
          ov=saved.overlays||ov
          cms=Array.isArray(saved.customModels)?saved.customModels:[]
        }
        else if(Array.isArray(saved)) its=saved
      }catch{}
      setItems(its)
      setOverlays(ov)
      setCustomModels(cms)
      // ← Push initial data into shared store so 3D can pick it up immediately
      designStore.loadProject(id, its, ov, c, cms)
      setPendingFit(true)
    }).catch(()=>{toast.error('Failed to load project');navigate('/projects')}).finally(()=>setLoading(false))
    furnitureApi.getAll().then(d=>{
  if(d?.length) {
    // Backend items override built-ins with the same id, but built-ins are never discarded
    const backendIds = new Set(d.map(item => String(item.id)))
    const merged = [
      ...FURNITURE_LIBRARY.filter(item => !backendIds.has(String(item.id))),
      ...d,
    ]
    setLibrary(merged)
  }
}).catch(()=>{})
  },[id]) // eslint-disable-line

  // Rebuild top-down cache from persisted custom model data (so silhouettes stay identical after 3D round-trips)
  useEffect(() => {
    if (!customModels?.length) return
    const missing = customModels.filter(m => m?.id && m?.b64 && m?.ext && !topDownCache[m.id])
    if (!missing.length) return
    const next = {}
    for (const m of missing) {
      try {
        const buf = base64ToArrayBuffer(m.b64)
        if (m.ext === 'obj') {
          const text = new TextDecoder().decode(buf)
          const td = parseOBJTopDown(text)
          if (td?.pts2d?.length) next[m.id] = td
        } else if (m.ext === 'glb') {
          const td = parseGLBTopDown(buf)
          if (td?.pts2d?.length) next[m.id] = td
        }
      } catch (e) {
        console.warn('Failed rebuilding top-down cache for', m.id, e)
      }
    }
    if (Object.keys(next).length) setTopDownCache(prev => ({ ...prev, ...next }))
  }, [customModels]) // eslint-disable-line

  // Preload preview images from backend library + customModels
  useEffect(() => {
    const srcs = new Set()
    // backend library
    ;(library || []).forEach(m => {
      if (m?.id != null) {
        const url = m.topViewUrl || m.thumbnailUrl
        if (url) {
          modelThumbById.current[m.id] = url
          srcs.add(url)
        }
      }
    })
    // custom models previews (data URLs)
    ;(customModels || []).forEach(m => {
      if (m?.previewUrl) srcs.add(m.previewUrl)
    })
    // items may contain their own urls
    ;(items || []).forEach(i => {
      const url = i.topViewUrl || i.thumbnailUrl || i.previewUrl
      if (url) srcs.add(url)
    })

    for (const url of srcs) {
      if (imgCacheRef.current[url]) continue
      const img = new Image()
      // Needed so the 2D canvas can be exported (thumbnail) even when it draws images.
      // Works with `/files/*` since backend now allows cross-origin for static assets.
      if (!String(url).startsWith('data:')) img.crossOrigin = 'anonymous'
      img.onload = () => setImgCacheTick(t => t + 1)
      img.onerror = () => {}
      img.src = url
      imgCacheRef.current[url] = img
    }
  }, [library, customModels, items])

  const centerView = useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas||canvas.width===0) return
    const dpr=window.devicePixelRatio||1
    const f=computeFit(canvas.width/dpr,canvas.height/dpr,stateRef.current.cfg)
    setZoom(f.zoom); setPanX(f.panX); setPanY(f.panY)
  },[computeFit])

  const screenToWorld = useCallback((sx,sy)=>{
    const rect=canvasRef.current.getBoundingClientRect()
    return { x:(sx-rect.left-panRef.current.x)/zoomRef.current, y:(sy-rect.top-panRef.current.y)/zoomRef.current }
  },[])

  const hitHandle=(item,wx,wy)=>{
    const hw=item.w/2,hd=item.d/2,icx=item.x+hw,icy=item.y+hd
    const rad=-(item.rotation||0)*Math.PI/180
    const dx=wx-icx,dy=wy-icy
    const lx=dx*Math.cos(rad)-dy*Math.sin(rad),ly=dx*Math.sin(rad)+dy*Math.cos(rad)
    const hs=9/zoomRef.current,rh=18/zoomRef.current
    if(Math.abs(lx)<hs&&Math.abs(ly-(-hd-rh))<hs) return 'rotate'
    const corners=[[-hw-5,-hd-5],[hw+5,-hd-5],[-hw-5,hd+5],[hw+5,hd+5]]
    for(const[cx2,cy2]of corners) if(Math.abs(lx-cx2)<hs&&Math.abs(ly-cy2)<hs) return 'resize'
    return null
  }

  const hitOverlay=(wx,wy)=>{
    const ov=stateRef.current.overlays
    for(const d of(ov.doors||[])){const dw=d.w||80,rad=-(d.rotation||0)*Math.PI/180,dx=wx-d.x,dy=wy-d.y,lx=dx*Math.cos(rad)-dy*Math.sin(rad),ly=dx*Math.sin(rad)+dy*Math.cos(rad);if(lx>=-8&&lx<=dw+8&&Math.abs(ly)<18) return{type:'door',id:d.id}}
    for(const w of(ov.windows||[])){const ww=w.w||100,rad=-(w.rotation||0)*Math.PI/180,dx=wx-w.x,dy=wy-w.y,lx=dx*Math.cos(rad)-dy*Math.sin(rad),ly=dx*Math.sin(rad)+dy*Math.cos(rad);if(Math.abs(lx)<=ww/2+8&&Math.abs(ly)<22) return{type:'window',id:w.id}}
    for(const c of(ov.curtains||[])){const cw=c.w||120,rad=-(c.rotation||0)*Math.PI/180,dx=wx-c.x,dy=wy-c.y,lx=dx*Math.cos(rad)-dy*Math.sin(rad),ly=dx*Math.sin(rad)+dy*Math.cos(rad);if(Math.abs(lx)<=cw/2+14&&ly>=-22&&ly<=34) return{type:'curtain',id:c.id}}
    return null
  }

  const onMouseDown=useCallback(e=>{
    if(e.button===1||(e.button===0&&mode==='pan')){drag.current={type:'pan',startX:e.clientX,startY:e.clientY,startPanX:panRef.current.x,startPanY:panRef.current.y};return}
    if(e.button!==0) return
    const{x:wx,y:wy}=screenToWorld(e.clientX,e.clientY)
    const{items:its,selected:sel}=stateRef.current
    for(let i=its.length-1;i>=0;i--){
      const item=its[i],hw=item.w/2,hd=item.d/2,icx=item.x+hw,icy=item.y+hd
      const rad=-(item.rotation||0)*Math.PI/180,dx=wx-icx,dy=wy-icy
      const lx=dx*Math.cos(rad)-dy*Math.sin(rad),ly=dx*Math.sin(rad)+dy*Math.cos(rad)
      if(lx>=-hw-14&&lx<=hw+14&&ly>=-hd-22&&ly<=hd+14){
        isDragging.current=true
        if(item.id===sel){const h=hitHandle(item,wx,wy);if(h==='rotate') drag.current={type:'rotate',id:item.id,cx:icx,cy:icy};else if(h==='resize') drag.current={type:'resize',id:item.id,startW:item.w,startD:item.d,mx:wx,my:wy};else drag.current={type:'move',id:item.id,offX:wx-item.x,offY:wy-item.y}}
        else{setSelected(item.id);setSelectedOverlay(null);drag.current={type:'move',id:item.id,offX:wx-item.x,offY:wy-item.y}}
        return
      }
    }
    const ov=hitOverlay(wx,wy)
    if(ov){setSelectedOverlay(ov);setSelected(null);const arr=stateRef.current.overlays[ov.type==='door'?'doors':ov.type==='window'?'windows':'curtains'];const ovItem=arr.find(x=>x.id===ov.id);if(ovItem) drag.current={type:'overlay-move',overlayType:ov.type,id:ov.id,offX:wx-ovItem.x,offY:wy-ovItem.y};return}
    setSelected(null);setSelectedOverlay(null)
    drag.current={type:'pan',startX:e.clientX,startY:e.clientY,startPanX:panRef.current.x,startPanY:panRef.current.y}
  },[mode,screenToWorld]) // eslint-disable-line

  const onMouseMove=useCallback(e=>{
    if(!drag.current) return
    const d=drag.current
    if(d.type==='pan'){setPanX(d.startPanX+(e.clientX-d.startX));setPanY(d.startPanY+(e.clientY-d.startY));return}
    const{x:wx,y:wy}=screenToWorld(e.clientX,e.clientY)
    if(d.type==='move'){
      // Mutate stateRef directly for instant canvas draw — no setState during drag
      const item = stateRef.current.items.find(i=>i.id===d.id)
      if (!item) return
      const rawX = snapV(wx-d.offX), rawY = snapV(wy-d.offY)
      const clamped = clampItemToRoom(item, stateRef.current.cfg, rawX, rawY)
      stateRef.current.items=stateRef.current.items.map(i=>i.id===d.id?{...i,x:clamped.x,y:clamped.y}:i)
      const canvas=canvasRef.current; if(canvas) draw(canvas,stateRef.current)
      d.pendingX=clamped.x; d.pendingY=clamped.y; d.hasPending=true
    }
    else if(d.type==='rotate'){
      const angle=Math.atan2(wy-d.cy,wx-d.cx)*180/Math.PI+90
      stateRef.current.items=stateRef.current.items.map(i=>i.id===d.id?{...i,rotation:normalRot(Math.round(angle))}:i)
      const canvas=canvasRef.current; if(canvas) draw(canvas,stateRef.current)
      d.hasPending=true
    }
    else if(d.type==='resize'){
      const nw=Math.max(20,snapV(d.startW+(wx-d.mx)))
      const nd=Math.max(20,snapV(d.startD+(wy-d.my)))
      stateRef.current.items=stateRef.current.items.map(i=>i.id===d.id?{...i,w:nw,d:nd}:i)
      const canvas=canvasRef.current; if(canvas) draw(canvas,stateRef.current)
      d.hasPending=true
    }
    else if(d.type==='overlay-move'){
      const key=d.overlayType==='door'?'doors':d.overlayType==='window'?'windows':'curtains'
      stateRef.current.overlays={...stateRef.current.overlays,[key]:stateRef.current.overlays[key].map(x=>x.id===d.id?{...x,x:snapV(wx-d.offX),y:snapV(wy-d.offY)}:x)}
      const canvas=canvasRef.current; if(canvas) draw(canvas,stateRef.current)
      d.hasPending=true
    }
  },[screenToWorld]) // eslint-disable-line

  const onMouseUp=useCallback(()=>{
    if(drag.current?.hasPending){
      if(['move','rotate','resize'].includes(drag.current.type)){
        const next=stateRef.current.items
        setItems(next)
        designStore.setItems(next)
      }
      if(drag.current?.type==='overlay-move'){
        const next=stateRef.current.overlays
        setOverlays(next)
        designStore.setOverlays(next)
      }
      setDirty(true)
    }
    isDragging.current=false
    drag.current=null
  },[]) // eslint-disable-line

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return
    const onWheel=e=>{
      e.preventDefault()
      const factor=e.deltaY<0?1.08:1/1.08
      const rect=canvas.getBoundingClientRect()
      const mx=e.clientX-rect.left, my=e.clientY-rect.top
      setZoom(z=>{const nz=Math.max(0.08,Math.min(8,z*factor));setPanX(p=>mx-(mx-p)*(nz/z));setPanY(p=>my-(my-p)*(nz/z));return nz})
    }
    canvas.addEventListener('wheel',onWheel,{passive:false})
    return()=>canvas.removeEventListener('wheel',onWheel)
  },[])

  const onDrop=useCallback(e=>{
    e.preventDefault()
    const raw=e.dataTransfer.getData('furniture'); if(!raw) return
    const model=JSON.parse(raw)
    const canvas=canvasRef.current, rect=canvas.getBoundingClientRect()
    const wx=(e.clientX-rect.left-panRef.current.x)/zoomRef.current
    const wy=(e.clientY-rect.top-panRef.current.y)/zoomRef.current
    // Backend models use meters: width/depth/height. Built-in library uses cm-ish: w/d/h.
    const widthM  = Number.isFinite(+model.width) ? +model.width : (model.w != null ? (model.w / 100) : 1)
    const depthM  = Number.isFinite(+model.depth) ? +model.depth : (model.d != null ? (model.d / 100) : 0.8)
    const heightM = Number.isFinite(+model.height) ? +model.height : (model.h != null ? (model.h / 100) : 0.8)
    const pw=Math.max(20,Math.round(widthM*GRID))
    const pd=Math.max(20,Math.round(depthM*GRID))
    const customModelEntry=model.customModelId?(stateRef.current.customModels||[]).find(m=>m.id===model.customModelId):null
    const base = {
      id:Date.now(),label:model.name,name:model.name,category:model.category||'Custom',
      color:model.color||CAT_COLOR[model.category]||'#c4b5fd',
      w:pw,d:pd,rotation:0,
      modelId:model.id,widthM,depthM,heightM,
      customModelId:model.customModelId||null,
      customModelExt:model.customModelExt||null,
      customModelB64:customModelEntry?.b64||null,
      topViewUrl: model.topViewUrl || model.thumbnailUrl || model.previewUrl || null,
      modelUrl: model.modelUrl || null,
      elevationM: 0,
    }
    const point = clampItemToRoom(base, stateRef.current.cfg, snapV(wx-pw/2), snapV(wy-pd/2))
    const newItem = { ...base, x: point.x, y: point.y }

    pushHistory(JSON.stringify(stateRef.current.items))
    setItems(prev=>[...prev,newItem]); setSelected(newItem.id); setSelectedOverlay(null); setDirty(true)
  },[])

  const pushHistory=useCallback((itemsSnapshot) => { history.current.push(itemsSnapshot); if(history.current.length>80) history.current.shift(); redoStack.current=[] }, [])
  const undo = useCallback(() => {
    if (!history.current.length) { toast('Nothing to undo'); return; }
    redoStack.current.push(JSON.stringify(stateRef.current.items));
    const prev = history.current.pop();
    setItems(JSON.parse(prev));
    setSelected(null);
    setDirty(true);
  }, [])
  const redo = useCallback(() => {
    if (!redoStack.current.length) { toast('Nothing to redo'); return; }
    history.current.push(JSON.stringify(stateRef.current.items));
    const next = redoStack.current.pop();
    setItems(JSON.parse(next));
    setSelected(null);
    setDirty(true);
  }, [])
  const rot90=useCallback(()=>{ const s=stateRef.current.selected; if(!s) return; pushHistory(JSON.stringify(stateRef.current.items)); setItems(p=>p.map(i=>i.id===s?{...i,rotation:((i.rotation||0)+90)%360}:i)); setDirty(true) },[pushHistory])
  const del=useCallback(()=>{ const s=stateRef.current.selected; if(!s) return; pushHistory(JSON.stringify(stateRef.current.items)); setItems(p=>p.filter(i=>i.id!==s)); setSelected(null); setDirty(true) },[pushHistory])
  const dup=useCallback(()=>{ const s=stateRef.current.selected; if(!s) return; pushHistory(JSON.stringify(stateRef.current.items)); const src=stateRef.current.items.find(i=>i.id===s); if(!src) return; const ni={...src,id:Date.now(),x:src.x+25,y:src.y+25}; setItems(p=>[...p,ni]); setSelected(ni.id); setDirty(true) },[pushHistory])

  const delOverlay=useCallback(()=>{
    const ov=stateRef.current.selectedOverlay; if(!ov) return
    const key=ov.type==='door'?'doors':ov.type==='window'?'windows':'curtains'
    setOverlays(o=>({...o,[key]:o[key].filter(x=>x.id!==ov.id)}))
    setSelectedOverlay(null); setDirty(true)
  },[])

  const updateOverlay=useCallback((type,ovId,field,value)=>{
    const key = type === 'door' ? 'doors' : type === 'window' ? 'windows' : 'curtains'
    setOverlays(prev => {
      const list = prev[key] || []
      if (!list.some(x => x.id === ovId)) return prev
      const nextList = list.map(x => x.id === ovId ? { ...x, [field]: value } : x)
      return { ...prev, [key]: nextList }
    })
    setDirty(true)
  },[])

  useEffect(()=>{
    const h=e=>{
      if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return
      if(e.key==='Delete'||e.key==='Backspace') del()
      if(e.key==='r'||e.key==='R') rot90()
      if(e.key==='d'||e.key==='D') dup()
      if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo()}
      if((e.ctrlKey||e.metaKey)&&e.key==='y'){e.preventDefault();redo()}
      if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key==='Z'){e.preventDefault();redo()}
      if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();save()}
      if(e.key==='Escape'){setSelected(null);setSelectedOverlay(null)}
      if(e.key===' '){e.preventDefault();setMode(m=>m==='pan'?'select':'pan')}
      if(e.key==='f'||e.key==='F') centerView()
    }
    window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h)
  },[del,rot90,dup,undo,redo,centerView]) // eslint-disable-line

  const addWindow=()=>{ setOverlays(o=>({...o,windows:[...o.windows,{id:Date.now(),name:`Window ${o.windows.length+1}`,x:OX+(stateRef.current.cfg.width||5)*GRID/2,y:OY,rotation:0,w:100,frameColor:'#d0d0d0',glassTint:'#88bbee',style:'cross',heightM:1.2,sillM:0.9}]})); setDirty(true); toast('Window added') }
  const addCurtain=()=>{ setOverlays(o=>({...o,curtains:[...o.curtains,{id:Date.now(),name:`Curtain ${o.curtains.length+1}`,x:OX+(stateRef.current.cfg.width||5)*GRID/2,y:OY+8,rotation:0,w:120,color:curtainColor,style:'standard'}]})); setDirty(true); toast('Curtain added') }
  const addDoor=()=>{ setOverlays(o=>({...o,doors:[...o.doors,{id:Date.now(),name:`Door ${o.doors.length+1}`,x:OX+10,y:OY,rotation:0,w:80,color:'#c8965a',frameColor:'#8a6030',style:'single',heightM:2.1}]})); setDirty(true); toast('Door added') }

  /* ── Model upload (fixed: synchronous base64 + ref-based file trigger) ── */
  const handleModelUpload=useCallback(async e=>{
    const file=e.target.files?.[0]; if(!file) return
    e.target.value=''  // reset immediately so same file can be re-selected
    const ext=file.name.split('.').pop().toLowerCase()
    if(!ext){toast.error('File must have an extension');return}
    if(file.size>20*1024*1024){toast.error('File too large (max 20 MB)');return}
    const currentCount=stateRef.current.customModels?.length??0
    if(currentCount>=MAX_CUSTOM_MODELS){toast.error(`Maximum ${MAX_CUSTOM_MODELS} custom models`);return}
    setUploadingModel(true)
    try{
      const buf=await file.arrayBuffer()
      const modelId='custom_'+Date.now()
      const modelName=file.name.replace(/\.\w+$/,'')
      // Synchronous base64 — no FileReader races
      const b64=arrayBufferToBase64(buf)
      setCustomModels(prev=>{
        if(prev.length>=MAX_CUSTOM_MODELS) return prev
        return[...prev,{id:modelId,name:modelName,ext,b64,previewUrl:null}]
      })
      const schedule = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 0 }), 50))
      schedule(() => {
        try {
          let tdData = null
          if(ext==='obj'){
            const text=new TextDecoder().decode(buf)
            tdData=parseOBJTopDown(text)
          } else if(ext==='glb'){
            tdData=parseGLBTopDown(buf)
          }
          if(tdData?.pts2d?.length>0){
            setTopDownCache(prev=>({...prev,[modelId]:tdData}))
          }
        } catch(parseErr) {
          console.warn('Top-down parse failed:',parseErr)
        }
      })

      // Generate the preview *in the background* to avoid freezing on big models.
      // (Keeps full quality; just defers the heavy work.)
      const scheduleIdle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 0 }), 50))
      scheduleIdle(async () => {
        if (previewJobsRef.current.get(modelId)) return
        previewJobsRef.current.set(modelId, true)
        try {
          if (ext === 'glb' || ext === 'obj') {
            const previewUrl = await renderTopViewPreview({ ext, buffer: buf, size: 320, bg: '#ffffff' })
            setCustomModels(prev => prev.map(m => m.id === modelId ? { ...m, previewUrl } : m))
          }
        } catch (pvErr) {
          console.warn('Top view preview render failed:', pvErr)
        } finally {
          previewJobsRef.current.delete(modelId)
        }
      })
      toast.success(`"${modelName}" loaded — drag to place`)
    }catch(err){
      console.error('Model upload error:',err)
      toast.error('Upload failed: '+(err?.message||'unknown error'))
    }finally{
      setUploadingModel(false)
    }
  },[]) // reads via stateRef

  const removeCustomModel=useCallback(modelId=>{
    setCustomModels(prev=>prev.filter(m=>m.id!==modelId))
    setTopDownCache(prev=>{ const n={...prev}; delete n[modelId]; return n })
    setItems(prev=>prev.filter(i=>i.customModelId!==modelId))
    setDirty(true)
  },[])

  const save=async()=>{
    setSaving(true)
    try{
      await projectsApi.update(id,{roomConfig:JSON.stringify(cfg),furnitureLayout:JSON.stringify({items,overlays,customModels})})
      setDirty(false)
      toast.success('Saved!')
      ;(async () => {
        try {
          const canvas = canvasRef.current
          if (!canvas) return
          const blob = await makePlanThumbnailBlob(canvas)
          if (!blob) return
          const fd = new FormData()
          fd.append('thumbnailPng', blob, `plan_${id}.png`)
          await projectsApi.uploadThumbnail(id, fd)
        } catch (e) {
          console.warn('Thumbnail upload failed (ignored):', e)
        }
      })()
    }
    catch{toast.error('Save failed')}finally{setSaving(false)}
  }

  const exportDesignAsJson = () => {
    const normalizedItems = items.map((i) => ({
      id: i.id,
      category: i.category,
      name: i.name || i.label || `${i.category || 'Furniture'} ${i.id}`,
      label: i.label || i.name || '',
      x: i.x,
      y: i.y,
      w: i.w,
      d: i.d,
      rotation: i.rotation,
      color: i.color,
      customModelId: i.customModelId || null,
      modelId: i.modelId || null,
      topViewUrl: i.topViewUrl || null,
      modelUrl: i.modelUrl || null,
    }))
    const normalizedOverlays = {
      doors: overlays.doors.map((d, i) => ({
        id: d.id,
        name: d.name || `Door ${i + 1}`,
        w: d.w,
        x: d.x,
        y: d.y,
        rotation: d.rotation,
        color: d.color,
        frameColor: d.frameColor,
        style: d.style,
        heightM: d.heightM,
      })),
      windows: overlays.windows.map((w, i) => ({
        id: w.id,
        name: w.name || `Window ${i + 1}`,
        w: w.w,
        x: w.x,
        y: w.y,
        rotation: w.rotation,
        frameColor: w.frameColor,
        glassTint: w.glassTint,
        style: w.style,
        heightM: w.heightM,
        sillM: w.sillM,
      })),
      curtains: overlays.curtains.map((c, i) => ({
        id: c.id,
        name: c.name || `Curtain ${i + 1}`,
        w: c.w,
        x: c.x,
        y: c.y,
        rotation: c.rotation,
        color: c.color,
        style: c.style,
      }))
    }
    const data = {
      projectName: project?.name || 'RoomCraft Design',
      exportedAt: new Date().toISOString(),
      roomConfig: cfg,
      furnitureLayout: { items: normalizedItems, overlays: normalizedOverlays, customModels },
      componentNames: {
        furniture: normalizedItems.map(i => ({ id: i.id, name: i.name, category: i.category })),
        doors: normalizedOverlays.doors.map(d => ({ id: d.id, name: d.name })),
        windows: normalizedOverlays.windows.map(w => ({ id: w.id, name: w.name })),
        curtains: normalizedOverlays.curtains.map(c => ({ id: c.id, name: c.name })),
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${(project?.name || 'roomcraft-design').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase()}_${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success('Exported design JSON')
  }

  const exportDesignAsPng = async () => {
    const canvas = canvasRef.current
    if (!canvas) { toast.error('Canvas not available'); return }
    try {
      const blob = await makePlanThumbnailWithNamesBlob(canvas, items, overlays)
      if (!blob) { toast.error('Export failed'); return }
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${(project?.name || 'roomcraft-design').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase()}_${Date.now()}.png`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('Exported design PNG with names')
    } catch (e) {
      console.error(e)
      toast.error('Export failed')
    }
  }

  // ── Auto-save: debounce 1.5s after any change ──
  const autoSaveTimer = useRef(null)
  useEffect(()=>{
    if(!dirty) return
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current=setTimeout(async()=>{
      try{
        await projectsApi.update(id,{roomConfig:JSON.stringify(cfg),furnitureLayout:JSON.stringify({items,overlays,customModels})})
        setDirty(false)
      }catch(e){ console.warn('Auto-save failed',e) }
    },1500)
    return()=>clearTimeout(autoSaveTimer.current)
  },[dirty,items,overlays,customModels,cfg,id]) // eslint-disable-line

  /* ── Derived ── */
  const fullLibrary=[
    ...library,
    ...customModels.map(m=>({
      id:m.id,
      name:m.name,
      category:'Custom',
      color:'#c4b5fd',
      w:100,d:100,h:100,
      customModelId:m.id,
      customModelExt:m.ext,
      previewUrl: m.previewUrl || null,
    }))
  ]
  const categories=['All',...new Set(fullLibrary.map(f=>f.category))]
  const filteredLib=fullLibrary.filter(f=>(furCat==='All'||f.category===furCat)&&f.name.toLowerCase().includes(furSearch.toLowerCase()))
  const selectedItem=items.find(i=>i.id===selected)
  const selectedOverlayItem=selectedOverlay
    ? (selectedOverlay.type==='door'?overlays.doors:selectedOverlay.type==='window'?overlays.windows:overlays.curtains).find(x=>x.id===selectedOverlay.id)
    : null
  const rightOpen=!!(selectedItem||selectedOverlayItem)

  if(loading) return(
    <div className="h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/>
      <p className="text-slate-500 text-sm font-medium">Loading project…</p>
    </div>
  )

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */
  return(
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden select-none">

      {/* ── TOP BAR ── */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center px-2 gap-1.5 flex-shrink-0 z-20 shadow-sm">
        <button onClick={()=>navigate('/projects')} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center gap-1 text-sm flex-shrink-0">
          <ChevronLeft className="w-4 h-4"/><span className="hidden sm:inline text-xs font-medium">Projects</span>
        </button>
        <div className="h-5 w-px bg-slate-200 flex-shrink-0"/>
        {isEditingName ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={async () => {
              setIsEditingName(false)
              const next = nameDraft.trim() || 'Untitled'
              setProject(p => p ? { ...p, name: next } : p)
              try {
                await projectsApi.update(id, {
                  name: next,
                  roomConfig: JSON.stringify(cfg),
                  furnitureLayout: JSON.stringify({ items, overlays, customModels }),
                })
                setProject(p => p ? { ...p, name: next } : p)
              } catch (err) {
                toast.error('Failed to rename project')
              }
            }}
            onKeyDown={async e => {
              if (e.key === 'Enter') {
                e.target.blur()
              }
              if (e.key === 'Escape') {
                setIsEditingName(false)
              }
            }}
            className="w-40 bg-slate-100 border border-slate-300 rounded px-2 py-1 text-xs"
          />
        ) : (
          <span
            className="font-semibold text-slate-900 text-sm truncate max-w-[120px] flex-shrink-0 cursor-pointer hover:text-slate-700"
            onClick={() => { setNameDraft(project?.name || ''); setIsEditingName(true) }}
            title="Click to rename"
          >{project?.name||'Untitled'}</span>
        )}
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold flex-shrink-0">2D</span>
        {dirty&&<span className="text-xs text-amber-500 flex-shrink-0">● Unsaved</span>}
        <div className="flex-1"/>

        {/* Mode toggle */}
        <div className="flex bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
          {[['select','Select',<MousePointer className="w-3 h-3"/>],['pan','Pan',<Move className="w-3 h-3"/>]].map(([m,label,icon])=>(
            <button key={m} onClick={()=>setMode(m)} className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-all ${mode===m?'bg-white shadow-sm text-slate-900':'text-slate-500'}`}>{icon}{label}</button>
          ))}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={()=>setZoom(z=>Math.max(0.08,+(z-0.1).toFixed(2)))} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><ZoomOut className="w-4 h-4"/></button>
          <span className="text-xs text-slate-500 w-10 text-center font-mono">{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.min(8,+(z+0.1).toFixed(2)))} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><ZoomIn className="w-4 h-4"/></button>
          <button onClick={centerView} title="Fit (F)" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><Maximize2 className="w-4 h-4"/></button>
        </div>

        <div className="h-5 w-px bg-slate-200 flex-shrink-0"/>

        {/* Item actions */}
        <button onClick={rot90} disabled={!selected} title="Rotate 90°" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex-shrink-0"><RotateCw className="w-4 h-4"/></button>
        <button onClick={dup} disabled={!selected} title="Duplicate" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex-shrink-0"><Copy className="w-4 h-4"/></button>
        <button onClick={del} disabled={!selected} title="Delete" className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-30 flex-shrink-0"><Trash2 className="w-4 h-4"/></button>
        <button onClick={undo} title="Undo (Ctrl+Z)" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 flex-shrink-0"><Undo className="w-4 h-4"/></button>
        <button onClick={redo} title="Redo (Ctrl+Y)" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 flex-shrink-0"><RotateCw className="w-4 h-4"/></button>
        <div className="h-5 w-px bg-slate-200 flex-shrink-0"/>

        {/* Fixture quick-add */}
        <button onClick={addDoor} title="Add Door" className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex-shrink-0"><DoorOpen className="w-4 h-4"/></button>
        <button onClick={addWindow} title="Add Window" className="p-1.5 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-600 flex-shrink-0"><Columns className="w-4 h-4"/></button>
        <button onClick={addCurtain} title="Add Curtain" className="p-1.5 rounded-lg text-slate-500 hover:bg-pink-50 hover:text-pink-600 flex-shrink-0"><Wind className="w-4 h-4"/></button>

        <div className="h-5 w-px bg-slate-200 flex-shrink-0"/>
        <button onClick={()=>{save();setTimeout(()=>navigate(`/workspace/3d/${id}`),600)}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all flex-shrink-0">
          <Box className="w-4 h-4"/><span className="hidden md:inline text-xs">3D View</span>
        </button>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all disabled:opacity-60 flex-shrink-0">
          {saving?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Save className="w-4 h-4"/>}
          <span className="hidden sm:inline text-xs">Save</span>
        </button>
        <button onClick={exportDesignAsJson} title="Export design as JSON" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700 text-xs font-medium transition-all flex-shrink-0">JSON</button>
        <button onClick={exportDesignAsPng} title="Export plan as PNG" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700 text-xs font-medium transition-all flex-shrink-0">PNG</button>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ══ LEFT PANEL ══ */}
        <div className={`bg-white border-r border-slate-200 flex flex-col flex-shrink-0 transition-all duration-200 ${leftOpen?'w-64':'w-0 overflow-hidden'}`}>
          {/* Tabs */}
          <div className="flex border-b border-slate-100 flex-shrink-0">
            {[['furniture','🪑 Furniture'],['overlays','🚪 Fixtures'],['room','⚙️ Room']].map(([t,label])=>(
              <button key={t} onClick={()=>setActiveTab(t)} className={`flex-1 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${activeTab===t?'border-b-2 border-blue-500 text-blue-600 bg-blue-50/40':'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>{label}</button>
            ))}
          </div>

          {/* ── Furniture Tab ── */}
          {activeTab==='furniture'&&<>
            <div className="p-2 space-y-2 border-b border-slate-100 flex-shrink-0">
              <input className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300" placeholder="🔍 Search furniture…" value={furSearch} onChange={e=>setFurSearch(e.target.value)}/>
              {/* Horizontal scrolling category pills */}
              <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                {categories.map(c=>(
                  <button key={c} onClick={()=>setFurCat(c)} className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap flex-shrink-0 transition-all font-medium ${furCat===c?'bg-blue-600 text-white border-blue-600':'border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600'}`}>
                    {CAT_EMOJI[c]||''} {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto">
              {filteredLib.length===0&&<p className="text-center text-xs text-slate-400 pt-10">No items match</p>}
              <div className="p-1.5 space-y-0.5">
                {filteredLib.map(f=>(
                  <div key={f.id} draggable onDragStart={e=>e.dataTransfer.setData('furniture',JSON.stringify(f))}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 transition-all group">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 shadow-sm" style={{background:(f.color||CAT_COLOR[f.category]||'#93b4fd')+'33',border:`1.5px solid ${(f.color||CAT_COLOR[f.category]||'#93b4fd')}55`}}>
                      {f.category==='Custom'?<Package className="w-4 h-4 text-violet-500"/>:(CAT_EMOJI[f.category]||'📦')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{f.name}</p>
                      <p className="text-xs text-slate-400">
                        {f.category==='Custom'?<span className="text-violet-500 font-medium">.{f.customModelExt||'3d'} model</span>:`${((f.w||100)/100).toFixed(1)}×${((f.d||80)/100).toFixed(1)} m`}
                      </p>
                    </div>
                    {f.category==='Custom'&&(
                      <button onClick={ev=>{ev.stopPropagation();removeCustomModel(f.id)}} className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"><X className="w-3.5 h-3.5"/></button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Custom 3D Models section */}
            <div className="border-t border-slate-100 flex-shrink-0">
              <button onClick={()=>setModelsExpanded(!modelsExpanded)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5"/>3D Models
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${customModels.length>=MAX_CUSTOM_MODELS?'bg-red-100 text-red-600':'bg-slate-100 text-slate-500'}`}>{customModels.length}/{MAX_CUSTOM_MODELS}</span>
                </span>
                {modelsExpanded?<ChevronUp className="w-3.5 h-3.5 text-slate-400"/>:<ChevronDown className="w-3.5 h-3.5 text-slate-400"/>}
              </button>
              {modelsExpanded&&(
                <div className="px-2 pb-2 space-y-1.5">
                  {customModels.length<MAX_CUSTOM_MODELS?(
                    <button
                      onClick={()=>fileInputRef.current?.click()}
                      disabled={uploadingModel}
                      className={`flex items-center justify-center gap-2 w-full border border-dashed rounded-xl py-2.5 text-xs font-medium transition-all ${uploadingModel?'border-violet-200 text-violet-400 bg-violet-50/50 cursor-wait':'border-slate-300 hover:border-violet-400 text-slate-500 hover:text-violet-600 hover:bg-violet-50/30 cursor-pointer'}`}
                    >
                      {uploadingModel?<><span className="w-3.5 h-3.5 border-2 border-violet-300/40 border-t-violet-400 rounded-full animate-spin"/>Processing…</>:<><Upload className="w-3.5 h-3.5"/>Upload .obj / .glb</>}
                    </button>
                  ):(
                    <p className="text-xs text-slate-400 text-center py-1.5 bg-slate-50 rounded-lg">Max {MAX_CUSTOM_MODELS} models reached</p>
                  )}
                  <input ref={fileInputRef} type="file" className="hidden" accept=".obj,.glb" onChange={handleModelUpload}/>
                  <p className="text-xs text-slate-400 text-center">Drag model tile above onto canvas</p>
                </div>
              )}
            </div>
          </>}

          {/* ── Overlays Tab ── */}
          {activeTab==='overlays'&&<div className="flex-1 overflow-y-auto p-3 space-y-5">
            {[
              ['Doors','door',addDoor,overlays.doors,'doors',DoorOpen,'#3b82f6'],
              ['Windows','window',addWindow,overlays.windows,'windows',Columns,'#0ea5e9'],
              ['Curtains','curtain',addCurtain,overlays.curtains,'curtains',Wind,'#ec4899'],
            ].map(([title,type,adder,list,key,Icon,accent])=>(
              <div key={type}>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" style={{color:accent}}/>{title}
                </p>
                {type==='curtain'&&(
                  <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded-lg">
                    <input type="color" className="w-7 h-7 rounded-md border border-slate-200 p-0.5 cursor-pointer" value={curtainColor} onChange={e=>setCurtainColor(e.target.value)}/>
                    <span className="text-xs text-slate-500">Color for new curtains</span>
                  </div>
                )}
                <button onClick={adder} className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-blue-400 rounded-xl px-3 py-2 text-xs text-slate-600 hover:text-blue-600 transition-all font-medium">
                  <Icon className="w-3.5 h-3.5"/>Add {title.slice(0,-1)}
                </button>
                <div className="mt-1 space-y-1">
                  {list.map((item,i)=>(
                    <div key={item.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs cursor-pointer border transition-all ${selectedOverlay?.id===item.id?'bg-blue-50 border-blue-200 text-blue-700':'bg-slate-50 border-transparent text-slate-600 hover:border-slate-200 hover:bg-white'}`}
                      onClick={()=>{setSelectedOverlay({type,id:item.id});setSelected(null)}}>
                      <span className="font-medium">{item.name || `${title.slice(0,-1)} ${i+1}`}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-xs">{item.w||80}px</span>
                        <button onClick={ev=>{ev.stopPropagation();setOverlays(o=>({...o,[key]:o[key].filter(x=>x.id!==item.id)}));setDirty(true)}} className="p-0.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><X className="w-3 h-3"/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>}

          {/* ── Room Tab ── */}
          {activeTab==='room'&&<div className="flex-1 overflow-y-auto p-3 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">Shape</label>
              <select className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300" value={cfg.shape} onChange={e=>{setCfg(c=>({...c,shape:e.target.value}));setDirty(true)}}>
                <option value="rectangle">Rectangle</option>
                <option value="square">Square</option>
                <option value="l-shape">L-Shape</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[['Width (m)','width'],['Depth (m)','depth']].map(([l,k])=>(
                <div key={k}>
                  <label className="text-xs font-semibold text-slate-500 block mb-1.5">{l}</label>
                  <input type="number" min="2" max="20" step="0.5" className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300" value={cfg[k]} onChange={e=>{setCfg(c=>({...c,[k]:+e.target.value}));setDirty(true)}}/>
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">Height (m)</label>
                <input type="number" min="2" max="6" step="0.1" className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300" value={cfg.height||2.8} onChange={e=>{setCfg(c=>({...c,height:+e.target.value}));setDirty(true)}}/>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">Wall Color</label>
              <div className="flex gap-2">
                <input type="color" className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 flex-shrink-0" value={cfg.wallColor||'#F5F5F0'} onChange={e=>{setCfg(c=>({...c,wallColor:e.target.value}));setDirty(true)}}/>
                <input className="flex-1 text-xs border border-slate-200 rounded-lg px-2 bg-slate-50 font-mono focus:outline-none focus:ring-1 focus:ring-blue-300" value={cfg.wallColor||'#F5F5F0'} onChange={e=>{setCfg(c=>({...c,wallColor:e.target.value}));setDirty(true)}}/>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">Floor Texture</label>
              <div className="grid grid-cols-5 gap-1.5">
                {['wood','carpet','tile','marble','concrete'].map(f=>(
                  <button key={f} onClick={()=>{setCfg(c=>({...c,floorTexture:f}));setDirty(true)}} className={`py-2 rounded-xl text-xs flex flex-col items-center gap-1 border-2 transition-all ${cfg.floorTexture===f?'border-blue-500 bg-blue-50':'border-slate-200 hover:border-slate-300'}`}>
                    <div className="w-5 h-5 rounded-md" style={{background:FLOOR_COL[f]}}/>
                    <span className="text-slate-500 capitalize leading-none" style={{fontSize:'9px'}}>{f}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <button onClick={()=>{if(!window.confirm('Clear all furniture?'))return;pushHistory(JSON.stringify(stateRef.current.items)); setItems([]);setSelected(null);setDirty(true);toast('Cleared')}} className="w-full text-xs text-red-500 hover:bg-red-50 border border-red-200 rounded-lg py-2 transition-all font-medium">
                🗑 Clear all furniture
              </button>
            </div>
          </div>}
        </div>

        {/* Left panel toggle */}
        <button onClick={()=>setLeftOpen(!leftOpen)} className="absolute z-30 top-1/2 -translate-y-1/2 bg-white border border-slate-200 rounded-r-lg p-1 shadow-sm hover:bg-slate-50 transition-colors" style={{left:leftOpen?'256px':'0',top:'calc(50% + 28px)'}}>
          <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${leftOpen?'rotate-180':''}`}/>
        </button>

        {/* ══ CANVAS ══ */}
        <div ref={wrapRef} className="flex-1 relative overflow-hidden">
          <canvas ref={canvasRef}
            style={{display:'block',cursor:mode==='pan'?'grab':'default',imageRendering:'crisp-edges'}}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onContextMenu={e=>e.preventDefault()} onDrop={onDrop} onDragOver={e=>e.preventDefault()}
          />
          <div className="absolute bottom-3 left-3 bg-white/95 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-500 font-mono pointer-events-none shadow-sm">
            {Math.round(zoom*100)}% · {cfg.width||5}×{cfg.depth||4} m · {items.length} items
          </div>
          <div className="absolute bottom-3 right-3 bg-white/95 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-500 pointer-events-none hidden lg:block shadow-sm">
            Scroll: zoom · Drag: move · ▪ corner: resize · ● top: rotate · R:90° · F:fit · Del:delete
          </div>
        </div>

        {/* ══ RIGHT PROPERTIES PANEL ══ */}
        <div className={`bg-white border-l border-slate-200 flex flex-col flex-shrink-0 transition-all duration-200 overflow-hidden ${rightOpen?'w-72':'w-0'}`}>

          {/* ── Selected Furniture ── */}
          {selectedItem&&(<>
            {/* Header */}
            <div className="flex items-center gap-2.5 p-3 border-b border-slate-100 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{background:(selectedItem.color||'#93b4fd')+'22',border:`1.5px solid ${selectedItem.color||'#93b4fd'}44`}}>
                {selectedItem.category==='Custom'?<Package className="w-4 h-4 text-violet-500"/>:(CAT_EMOJI[selectedItem.category]||'📦')}
              </div>
              <div className="flex-1 min-w-0">
                <input type="text" value={selectedItem.name || selectedItem.label || ''} onChange={e=>{const next=e.target.value; setItems(p=>p.map(i=>i.id===selected?{...i,name:next,label:next}:i)); setDirty(true)}}
                  className="w-full text-sm font-bold text-slate-900 truncate border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  placeholder="Name this furniture" />
                <p className="text-xs text-slate-400">{selectedItem.category}</p>
              </div>
              <button onClick={()=>setSelected(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"><X className="w-4 h-4"/></button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* ── Dimensions ── */}
              <div className="p-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">📐 Dimensions</p>
                <div className="grid grid-cols-3 gap-2">
                  {[['W','w','widthM'],['D','d','depthM']].map(([l,k,mk])=>(
                    <div key={k}>
                      <label className="text-xs text-slate-400 block mb-1">{l} (m)</label>
                      <input type="number" min="0.2" max="12" step="0.1" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300 text-center font-mono"
                        value={(selectedItem[k]/GRID).toFixed(2)}
                        onChange={e=>{const v=Math.max(10,Math.round(+e.target.value*GRID));setItems(p=>p.map(i=>i.id===selected?{...i,[k]:v,[mk]:+e.target.value}:i));setDirty(true)}}/>
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">H (m)</label>
                    <input type="number" min="0.1" max="3" step="0.05" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300 text-center font-mono"
                      value={(selectedItem.heightM||0.8).toFixed(2)}
                      onChange={e=>{setItems(p=>p.map(i=>i.id===selected?{...i,heightM:+e.target.value}:i));setDirty(true)}}/>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Lift (m)</label>
                    <input type="range" min="0" max={Math.max(0.1, (cfg.height||2.8) - (selectedItem.heightM||0.8))} step="0.05" className="w-full accent-blue-500"
                      value={selectedItem.elevationM || 0}
                      onChange={e=>{const maxEl=(cfg.height||2.8)-(selectedItem.heightM||0.8);const nextEl=clamp(+e.target.value,0,maxEl);setItems(p=>p.map(i=>i.id===selected?{...i,elevationM:nextEl}:i));setDirty(true)}}/>
                    <div className="flex justify-between text-xs text-slate-400"><span>Floor</span><span>Ceiling</span></div>
                  </div>
                </div>
              </div>

              {/* ── Rotation ── */}
              <div className="p-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">🔄 Rotation</p>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="relative flex-1">
                    <input type="number" min="0" max="359" step="1"
                      className="w-full text-sm font-mono border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300 text-center"
                      value={selectedItem.rotation||0}
                      onChange={e=>{setItems(p=>p.map(i=>i.id===selected?{...i,rotation:normalRot(e.target.value)}:i));setDirty(true)}}/>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">°</span>
                  </div>
                  <button onClick={rot90} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all flex-shrink-0">
                    <RotateCw className="w-3.5 h-3.5"/>+90°
                  </button>
                </div>
                <input type="range" min="0" max="359" step="1" className="w-full accent-blue-500"
                  value={selectedItem.rotation||0}
                  onChange={e=>{setItems(p=>p.map(i=>i.id===selected?{...i,rotation:+e.target.value}:i));setDirty(true)}}/>
                <div className="flex justify-between text-xs text-slate-300 mt-0.5">
                  <span>0°</span><span>90°</span><span>180°</span><span>270°</span><span>359°</span>
                </div>
              </div>

              {/* ── Color ── */}
              <div className="p-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">🎨 Color</p>
                <div className="flex items-center gap-2.5 mb-3">
                  <input type="color" className="w-10 h-10 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 flex-shrink-0"
                    value={selectedItem.color||'#93b4fd'}
                    onChange={e=>{setItems(p=>p.map(i=>i.id===selected?{...i,color:e.target.value}:i));setDirty(true)}}/>
                  <input className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-blue-300"
                    value={selectedItem.color||'#93b4fd'}
                    onChange={e=>{setItems(p=>p.map(i=>i.id===selected?{...i,color:e.target.value}:i));setDirty(true)}}/>
                </div>
                {/* Color presets */}
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PRESETS.map(c=>(
                    <button key={c} onClick={()=>{setItems(p=>p.map(i=>i.id===selected?{...i,color:c}:i));setDirty(true)}}
                      className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${selectedItem.color===c?'border-blue-500 scale-110':'border-white shadow-sm'}`}
                      style={{background:c}} title={c}/>
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-3 border-t border-slate-100 flex-shrink-0 grid grid-cols-3 gap-2">
              <button onClick={dup} className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold transition-all">
                <Copy className="w-4 h-4"/>Duplicate
              </button>
              <button onClick={rot90} className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-all">
                <RotateCw className="w-4 h-4"/>Rotate
              </button>
              <button onClick={del} className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 text-xs font-semibold transition-all">
                <Trash2 className="w-4 h-4"/>Delete
              </button>
            </div>
          </>)}

          {/* ── Selected Overlay (Door/Window/Curtain) ── */}
          {selectedOverlayItem&&selectedOverlay&&!selectedItem&&(<>
            <div className="flex items-center gap-2.5 p-3 border-b border-slate-100 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-slate-100">
                {selectedOverlay.type==='door'?'🚪':selectedOverlay.type==='window'?'🪟':'🎪'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 capitalize">{selectedOverlay.type}</p>
                <input type="text" value={selectedOverlayItem.name || `${selectedOverlay.type} ${selectedOverlayItem.id}`}
                  onChange={e=>updateOverlay(selectedOverlay.type, selectedOverlay.id, 'name', e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 mt-1 focus:outline-none focus:ring-1 focus:ring-blue-300" placeholder={`Name your ${selectedOverlay.type}`} />
                <p className="text-xs text-slate-400 mt-1">Click and drag to reposition</p>
              </div>
              <button onClick={()=>setSelectedOverlay(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0"><X className="w-4 h-4"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Width */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">📏 Width</p>
                <div className="flex items-center gap-2 mb-2">
                  <input type="number" min="40" max="300" step="5"
                    className="w-20 text-sm font-mono border border-slate-200 rounded-lg px-2 py-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300 text-center"
                    value={selectedOverlayItem.w||80}
                    onChange={e=>updateOverlay(selectedOverlay.type,selectedOverlay.id,'w',Math.max(40,+e.target.value))}/>
                  <span className="text-xs text-slate-400">px</span>
                </div>
                <input type="range" min="40" max="300" step="5" className="w-full accent-blue-500"
                  value={selectedOverlayItem.w||80}
                  onChange={e=>updateOverlay(selectedOverlay.type,selectedOverlay.id,'w',+e.target.value)}/>
              </div>
              {/* Rotation */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">🔄 Rotation</p>
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <input type="number" min="0" max="359" step="1"
                      className="w-full text-sm font-mono border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300 text-center"
                      value={selectedOverlayItem.rotation||0}
                      onChange={e=>updateOverlay(selectedOverlay.type,selectedOverlay.id,'rotation',normalRot(e.target.value))}/>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">°</span>
                  </div>
                  <button onClick={()=>updateOverlay(selectedOverlay.type,selectedOverlay.id,'rotation',normalRot((selectedOverlayItem.rotation||0)+90))}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex-shrink-0">
                    <RotateCw className="w-3.5 h-3.5"/>+90°
                  </button>
                </div>
                <input type="range" min="0" max="359" step="1" className="w-full accent-blue-500"
                  value={selectedOverlayItem.rotation||0}
                  onChange={e=>updateOverlay(selectedOverlay.type,selectedOverlay.id,'rotation',+e.target.value)}/>
              </div>
              {/* Curtain color */}
              {selectedOverlay.type==='curtain'&&(
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">🎨 Color</p>
                  <div className="flex items-center gap-2.5">
                    <input type="color" className="w-10 h-10 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5"
                      value={selectedOverlayItem.color||'#fca5a5'}
                      onChange={e=>updateOverlay(selectedOverlay.type,selectedOverlay.id,'color',e.target.value)}/>
                    <input className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 font-mono focus:outline-none focus:ring-1 focus:ring-blue-300"
                      value={selectedOverlayItem.color||'#fca5a5'}
                      onChange={e=>updateOverlay(selectedOverlay.type,selectedOverlay.id,'color',e.target.value)}/>
                  </div>
                </div>
              )}

              {/* Styles */}
              {selectedOverlay.type==='door'&&(
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">🚪 Style</p>
                  <select className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    value={selectedOverlayItem.style||'single'}
                    onChange={e=>updateOverlay('door',selectedOverlay.id,'style',e.target.value)}>
                    <option value="single">Single</option>
                    <option value="double">Double</option>
                    <option value="sliding">Sliding</option>
                  </select>
                  <div className="mt-2">
                    <label className="text-xs text-slate-400 block mb-1">Door height (m)</label>
                    <input type="number" min="1.6" max="3.0" step="0.05"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 font-mono focus:outline-none focus:ring-1 focus:ring-blue-300"
                      value={(selectedOverlayItem.heightM ?? 2.1)}
                      onChange={e=>updateOverlay('door',selectedOverlay.id,'heightM',Math.max(1.6,Math.min(3.0,+e.target.value)))}/>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Door color</label>
                      <input type="color" className="w-full h-9 rounded-lg border border-slate-200 p-1"
                        value={selectedOverlayItem.color||'#c8965a'}
                        onChange={e=>updateOverlay('door',selectedOverlay.id,'color',e.target.value)}/>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Frame color</label>
                      <input type="color" className="w-full h-9 rounded-lg border border-slate-200 p-1"
                        value={selectedOverlayItem.frameColor||'#8a6030'}
                        onChange={e=>updateOverlay('door',selectedOverlay.id,'frameColor',e.target.value)}/>
                    </div>
                  </div>
                </div>
              )}

              {selectedOverlay.type==='window'&&(
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">🪟 Style</p>
                  <select className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    value={selectedOverlayItem.style||'cross'}
                    onChange={e=>updateOverlay('window',selectedOverlay.id,'style',e.target.value)}>
                    <option value="plain">Plain</option>
                    <option value="cross">Cross</option>
                    <option value="double">Double</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Window height (m)</label>
                      <input type="number" min="0.4" max="2.5" step="0.05"
                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 font-mono focus:outline-none focus:ring-1 focus:ring-blue-300"
                        value={(selectedOverlayItem.heightM ?? 1.2)}
                        onChange={e=>updateOverlay('window',selectedOverlay.id,'heightM',Math.max(0.4,Math.min(2.5,+e.target.value)))}/>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Sill height (m)</label>
                      <input type="number" min="0" max="2.2" step="0.05"
                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 font-mono focus:outline-none focus:ring-1 focus:ring-blue-300"
                        value={(selectedOverlayItem.sillM ?? 0.9)}
                        onChange={e=>updateOverlay('window',selectedOverlay.id,'sillM',Math.max(0,Math.min(2.2,+e.target.value)))}/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Frame color</label>
                      <input type="color" className="w-full h-9 rounded-lg border border-slate-200 p-1"
                        value={selectedOverlayItem.frameColor||'#d0d0d0'}
                        onChange={e=>updateOverlay('window',selectedOverlay.id,'frameColor',e.target.value)}/>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Glass tint</label>
                      <input type="color" className="w-full h-9 rounded-lg border border-slate-200 p-1"
                        value={selectedOverlayItem.glassTint||'#88bbee'}
                        onChange={e=>updateOverlay('window',selectedOverlay.id,'glassTint',e.target.value)}/>
                    </div>
                  </div>
                </div>
              )}

              {selectedOverlay.type==='curtain'&&(
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">🎪 Style</p>
                  <select className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    value={selectedOverlayItem.style||'standard'}
                    onChange={e=>updateOverlay('curtain',selectedOverlay.id,'style',e.target.value)}>
                    <option value="standard">Standard</option>
                    <option value="sheer">Sheer</option>
                    <option value="blackout">Blackout</option>
                  </select>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-slate-100 flex-shrink-0">
              <button onClick={delOverlay} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 text-xs font-semibold transition-all">
                <Trash2 className="w-4 h-4"/>Delete {selectedOverlay.type}
              </button>
            </div>
          </>)}
        </div>

      </div>
    </div>
  )
}