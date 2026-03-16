import React, {
  useEffect, useLayoutEffect, useRef, useState, useCallback
} from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi, furnitureApi, FURNITURE_LIBRARY } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  Save, Undo, RotateCw, Trash2, Box,
  ZoomIn, ZoomOut, MousePointer, ChevronLeft,
  PanelLeft, Move, Maximize2, Copy,
  DoorOpen, Columns, Wind, Upload, Package
} from 'lucide-react'

const GRID = 50
const SNAP = 5
const OX   = 80
const OY   = 70

const CAT_COLOR = {
  Seating:'#93b4fd', Tables:'#6ee7b7', Bedroom:'#fca5a5',
  Storage:'#d8b4fe', Office:'#fcd34d', Lighting:'#fdba74',
  Bathroom:'#a5f3fc', Kitchen:'#bbf7d0', 'Living Room':'#bfdbfe', Decor:'#f9a8d4',
  Custom:'#c4b5fd',
}
const CAT_EMOJI = {
  Seating:'🪑', Tables:'🪵', Bedroom:'🛏️', Storage:'🗄️', Office:'💼',
  Lighting:'💡', Bathroom:'🚿', Kitchen:'🍳', 'Living Room':'🛋️', Decor:'🪴',
  Custom:'📦',
}
const FLOOR_COL = {
  wood:'#c8a46e', carpet:'#9b8fa8', tile:'#e0e0e0', marble:'#ece8e2', concrete:'#b8b8b8'
}
const snapV = v => Math.round(v / SNAP) * SNAP


function parseOBJTopDown(text) {
  const verts = [], faces = []
  for (const raw of text.split('\n')) {
    const p = raw.trim().split(/\s+/)
    if (p[0] === 'v' && p.length >= 4) {
      const x = parseFloat(p[1]), y = parseFloat(p[2]), z = parseFloat(p[3])
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) verts.push([x, y, z])
    }
    if (p[0] === 'f' && p.length >= 4) {
      const ids = p.slice(1).map(s => { const n = parseInt(s.split('/')[0], 10); return Number.isFinite(n) ? n - 1 : -1 })
      for (let i = 1; i < ids.length - 1; i++) {
        if (ids[0] >= 0 && ids[i] >= 0 && ids[i + 1] >= 0) faces.push([ids[0], ids[i], ids[i + 1]])
      }
    }
  }
  return { pts2d: verts.map(([x, , z]) => [x, z]), faces }
}

function parseGLBTopDown(buffer) {
  try {
    const view = new DataView(buffer)
    if (view.getUint32(0, true) !== 0x46546C67) return null
    const jsonLen = view.getUint32(12, true)
    const jsonStart = 20
    const jsonText = new TextDecoder().decode(new Uint8Array(buffer, jsonStart, jsonLen))
    const gltf = JSON.parse(jsonText)
    let binChunk = null
    let offset = jsonStart + jsonLen
    while (offset + 8 <= buffer.byteLength) {
      const chunkLen = view.getUint32(offset, true)
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
        for (let i = 0; i < count; i++) pts2d.push([pos[i * 3], pos[i * 3 + 2]])
        if (prim.indices != null) {
          const iacc = gltf.accessors[prim.indices], ibv = gltf.bufferViews[iacc.bufferView]
          const ioff = (ibv.byteOffset || 0) + (iacc.byteOffset || 0)
          const icount = iacc.count || 0
          const idx = iacc.componentType === 5125
            ? new Uint32Array(binChunk, ioff, icount)
            : new Uint16Array(binChunk, ioff, icount)
          for (let i = 0; i + 2 < idx.length; i += 3) faces.push([vertexStart + idx[i], vertexStart + idx[i + 1], vertexStart + idx[i + 2]])
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

function arrayBufferToBase64(buffer) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer])
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const marker = ';base64,'
      const idx = result.indexOf(marker)
      resolve(idx === -1 ? '' : result.substring(idx + marker.length))
    }
    reader.onerror = () => reject(new Error('Failed to convert model to base64'))
    reader.readAsDataURL(blob)
  })
}

function drawModelTopDown(ctx, item, tdData) {
  if (!tdData?.pts2d?.length) return
  const { pts2d, faces } = tdData
  const angle = ((item.rotation || 0) * Math.PI / 180)
  const cosA = Math.cos(angle), sinA = Math.sin(angle)
  const rotated = pts2d.map(([x, z]) => [x * cosA - z * sinA, x * sinA + z * cosA])
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [x, z] of rotated) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
  }
  const mw = maxX - minX || 1, mz = maxZ - minZ || 1
  const hw = item.w / 2, hd = item.d / 2, sx = item.w / mw, sz = item.d / mz
  ctx.save()
  ctx.strokeStyle = 'rgba(139,92,246,0.65)'; ctx.fillStyle = 'rgba(139,92,246,0.10)'; ctx.lineWidth = 0.6
  if (faces?.length) {
    for (const [i0, i1, i2] of faces) {
      const p0 = rotated[i0], p1 = rotated[i1], p2 = rotated[i2]; if (!p0 || !p1 || !p2) continue
      ctx.beginPath(); ctx.moveTo((p0[0] - minX) * sx - hw, (p0[1] - minZ) * sz - hd)
      ctx.lineTo((p1[0] - minX) * sx - hw, (p1[1] - minZ) * sz - hd)
      ctx.lineTo((p2[0] - minX) * sx - hw, (p2[1] - minZ) * sz - hd)
      ctx.closePath(); ctx.fill(); ctx.stroke()
    }
  } else {
    ctx.beginPath(); let first = true
    for (const [x, z] of rotated) {
      const px = (x - minX) * sx - hw, pz = (z - minZ) * sz - hd
      if (first) { ctx.moveTo(px, pz); first = false } else ctx.lineTo(px, pz)
    }
    ctx.closePath(); ctx.fill(); ctx.stroke()
  }
  ctx.restore()
}

function roomPoly(cfg) {
  const W = (cfg.width || 5) * GRID, D = (cfg.depth || 4) * GRID
  if (cfg.shape === 'l-shape') {
    const cw = Math.round(W * 0.6), cd = Math.round(D * 0.55)
    return [[OX, OY], [OX + W, OY], [OX + W, OY + cd], [OX + cw, OY + cd], [OX + cw, OY + D], [OX, OY + D]]
  }
  if (cfg.shape === 'square') { const S = Math.min(W, D); return [[OX, OY], [OX + S, OY], [OX + S, OY + S], [OX, OY + S]] }
  return [[OX, OY], [OX + W, OY], [OX + W, OY + D], [OX, OY + D]]
}

function drawDoor(ctx, d, sel) {
  const dw = d.w || 80
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate((d.rotation || 0) * Math.PI / 180)
  ctx.strokeStyle = 'rgba(51,65,85,0.22)'; ctx.lineWidth = 0.8; ctx.setLineDash([4, 3])
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, dw, 0, Math.PI / 2); ctx.stroke(); ctx.setLineDash([])
  ctx.fillStyle = '#f1f5f9'; ctx.strokeStyle = sel ? '#3b82f6' : '#475569'; ctx.lineWidth = sel ? 2.5 : 2
  ctx.beginPath(); ctx.rect(0, -6, dw, 12); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(dw - 10, 0, 3.5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#334155'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('D', dw / 2, 0)
  if (sel) { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.rect(-8, -14, dw + 16, 28); ctx.stroke(); ctx.setLineDash([]) }
  ctx.restore()
}

function drawWindow(ctx, w, sel) {
  const ww = w.w || 100
  ctx.save(); ctx.translate(w.x, w.y); ctx.rotate((w.rotation || 0) * Math.PI / 180)
  ctx.fillStyle = 'rgba(147,197,253,0.45)'; ctx.strokeStyle = sel ? '#3b82f6' : '#2563eb'; ctx.lineWidth = sel ? 2.5 : 2
  ctx.beginPath(); ctx.rect(-ww / 2, -8, ww, 16); ctx.fill(); ctx.stroke()
  ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-ww / 2, 0); ctx.lineTo(ww / 2, 0); ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.38)'; ctx.beginPath(); ctx.rect(-ww / 2 + 3, -7, ww / 2 - 6, 6); ctx.fill()
  ctx.fillStyle = '#1d4ed8'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('W', 0, 0)
  if (sel) { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.rect(-ww / 2 - 6, -14, ww + 12, 28); ctx.stroke(); ctx.setLineDash([]) }
  ctx.restore()
}

function drawCurtain(ctx, c, sel) {
  const cw = c.w || 120, col = c.color || '#fca5a5'
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate((c.rotation || 0) * Math.PI / 180)
  ctx.strokeStyle = '#78716c'; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.moveTo(-cw / 2 - 8, -10); ctx.lineTo(cw / 2 + 8, -10); ctx.stroke()
  ctx.fillStyle = '#a8a29e'
  ;[-cw / 2 - 8, cw / 2 + 8].forEach(ex => { ctx.beginPath(); ctx.arc(ex, -10, 4, 0, Math.PI * 2); ctx.fill() })
  ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.7
  ctx.beginPath(); ctx.moveTo(-cw / 2, -10)
  for (let i = 0; i < 4; i++) { const x1 = -cw / 2 + (i + 0.5) * (cw / 2) / 4 + 2, x2 = -cw / 2 + (i + 1) * (cw / 2) / 4; ctx.quadraticCurveTo(x1, 24, x2, -10) }
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cw / 2, -10)
  for (let i = 0; i < 4; i++) { const x1 = cw / 2 - (i + 0.5) * (cw / 2) / 4 - 2, x2 = cw / 2 - (i + 1) * (cw / 2) / 4; ctx.quadraticCurveTo(x1, 24, x2, -10) }
  ctx.closePath(); ctx.fill(); ctx.stroke()
  if (sel) { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.rect(-cw / 2 - 12, -16, cw + 24, 46); ctx.stroke(); ctx.setLineDash([]) }
  ctx.restore()
}

function drawFurnDetail(ctx, item, topDownCache) {
  const hw = item.w / 2, hd = item.d / 2
  ctx.save()
  const tdData = item.customModelId && topDownCache ? topDownCache[item.customModelId] : null
  if (tdData?.pts2d?.length) { drawModelTopDown(ctx, item, tdData); ctx.restore(); return }
  switch (item.category) {
    case 'Seating':
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.roundRect(-hw + 5, -hd + 3, item.w - 10, hd * 0.3, 3); ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-hw + 5, 0); ctx.lineTo(hw - 5, 0); ctx.stroke()
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.roundRect(-hw + 2, -hd + 2, 5, item.d - 4, 2); ctx.fill()
      ctx.beginPath(); ctx.roundRect(hw - 7, -hd + 2, 5, item.d - 4, 2); ctx.fill(); break
    case 'Tables':
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ;[[-hw + 7, -hd + 7], [hw - 7, -hd + 7], [-hw + 7, hd - 7], [hw - 7, hd - 7]].forEach(([lx, ly]) => { ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill() })
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(0, -hd * 0.2, hw * 0.5, hd * 0.2, 0, 0, Math.PI * 2); ctx.fill(); break
    case 'Bedroom':
      ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.beginPath(); ctx.roundRect(-hw + 5, -hd + 3, item.w - 10, hd * 0.22, 4); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ;[[-hw + 14, -hd + 9], [-hw + 14 + (hw - 20), -hd + 9]].forEach(([px, py]) => { ctx.beginPath(); ctx.roundRect(px, py, Math.max(4, hw - 22), hd * 0.18, 3); ctx.fill() })
      ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.beginPath(); ctx.roundRect(-hw + 5, 0, item.w - 10, hd * 0.7, 4); ctx.fill(); break
    case 'Storage': {
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.7
      const sh = Math.max(2, Math.round(item.d / 22))
      for (let i = 1; i < sh; i++) { const ly = -hd + i * (item.d / sh); ctx.beginPath(); ctx.moveTo(-hw + 5, ly); ctx.lineTo(hw - 5, ly); ctx.stroke() }
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; [-4, 4].forEach(ox => { ctx.beginPath(); ctx.arc(ox, 0, 3, 0, Math.PI * 2); ctx.fill() }); break
    }
    case 'Office':
      ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.beginPath(); ctx.roundRect(-hw * 0.4, -hd + 5, hw * 0.8, hd * 0.5, 4); ctx.fill()
      ctx.fillStyle = 'rgba(100,160,220,0.25)'; ctx.beginPath(); ctx.roundRect(-hw * 0.37, -hd + 7, hw * 0.74, hd * 0.42, 3); ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, hd * 0.35, Math.min(hw, hd) * 0.32, 0, Math.PI * 2); ctx.stroke(); break
    case 'Bathroom':
      ctx.fillStyle = 'rgba(186,230,253,0.55)'; ctx.beginPath(); ctx.roundRect(-hw + 8, -hd + 8, item.w - 16, item.d - 16, 10); ctx.fill()
      ctx.fillStyle = 'rgba(100,160,200,0.7)'; ctx.beginPath(); ctx.arc(0, hd - 12, 4, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(147,197,253,0.25)'; ctx.beginPath(); ctx.roundRect(-hw + 10, -hd + 10, item.w - 20, item.d - 20, 8); ctx.fill(); break
    case 'Kitchen':
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.roundRect(-hw + 6, -hd + 6, item.w - 12, item.d - 12, 5); ctx.stroke()
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.2
      ;[[-hw * 0.45, -hd * 0.35], [hw * 0.45, -hd * 0.35], [-hw * 0.45, hd * 0.35], [hw * 0.45, hd * 0.35]].forEach(([bx, by]) => {
        ctx.beginPath(); ctx.arc(bx, by, Math.min(hw, hd) * 0.18, 0, Math.PI * 2); ctx.stroke()
        ctx.beginPath(); ctx.arc(bx, by, Math.min(hw, hd) * 0.08, 0, Math.PI * 2); ctx.stroke()
      }); break
    case 'Lighting':
      ctx.fillStyle = 'rgba(253,186,116,0.18)'; ctx.beginPath(); ctx.arc(0, 0, Math.min(hw, hd) * 0.72, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(253,186,116,0.55)'; ctx.beginPath(); ctx.arc(0, 0, Math.min(hw, hd) * 0.48, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,240,180,0.7)'; ctx.beginPath(); ctx.arc(0, 0, Math.min(hw, hd) * 0.22, 0, Math.PI * 2); ctx.fill(); break
    case 'Decor':
      ctx.fillStyle = 'rgba(139,90,60,0.5)'; ctx.beginPath(); ctx.ellipse(0, hd * 0.3, hw * 0.32, hd * 0.22, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(34,197,94,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, Math.min(hw, hd) * 0.45, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = 'rgba(34,197,94,0.25)'; ctx.beginPath(); ctx.arc(0, 0, Math.min(hw, hd) * 0.28, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(34,197,94,0.6)'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(0, hd * 0.25); ctx.lineTo(0, -hd * 0.15); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, -hd * 0.05); ctx.lineTo(-hw * 0.3, -hd * 0.3); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, -hd * 0.05); ctx.lineTo(hw * 0.3, -hd * 0.3); ctx.stroke(); break
    case 'Custom':
      ctx.strokeStyle = 'rgba(139,92,246,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3])
      ctx.beginPath(); ctx.rect(-hw + 4, -hd + 4, item.w - 8, item.d - 8); ctx.stroke(); ctx.setLineDash([])
      ctx.strokeStyle = 'rgba(139,92,246,0.3)'; ctx.lineWidth = 0.8
      ctx.beginPath(); ctx.moveTo(-hw + 4, -hd + 4); ctx.lineTo(hw - 4, hd - 4); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(hw - 4, -hd + 4); ctx.lineTo(-hw + 4, hd - 4); ctx.stroke(); break
    default: break
  }
  ctx.restore()
}

function draw(canvas, state) {
  const { cfg, items, overlays, selected, selectedOverlay, zoom, panX, panY, topDownCache } = state
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore()
  ctx.save()
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * panX, dpr * panY)
  ctx.imageSmoothingEnabled = false
  const CW = canvas.width / dpr, CH = canvas.height / dpr
  const vx = -panX / zoom - 20, vy = -panY / zoom - 20, vw = CW / zoom + 40, vh = CH / zoom + 40
  const cfg_w = cfg.width || 5, cfg_d = cfg.depth || 4
  const shape = cfg.shape || 'rectangle'
  const RW = (shape === 'square' ? Math.min(cfg_w, cfg_d) : cfg_w) * GRID
  const RD = (shape === 'square' ? Math.min(cfg_w, cfg_d) : cfg_d) * GRID
  ctx.fillStyle = '#dde3ee'; ctx.fillRect(vx, vy, vw, vh)
  const gx0 = Math.floor(vx / GRID) * GRID, gy0 = Math.floor(vy / GRID) * GRID
  ctx.strokeStyle = 'rgba(148,163,200,0.18)'; ctx.lineWidth = 0.5
  for (let x = gx0; x < vx + vw; x += GRID) { ctx.beginPath(); ctx.moveTo(x, vy); ctx.lineTo(x, vy + vh); ctx.stroke() }
  for (let y = gy0; y < vy + vh; y += GRID) { ctx.beginPath(); ctx.moveTo(vx, y); ctx.lineTo(vx + vw, y); ctx.stroke() }
  ctx.strokeStyle = 'rgba(100,130,200,0.22)'; ctx.lineWidth = 0.9
  for (let x = gx0; x < vx + vw; x += GRID * 5) { ctx.beginPath(); ctx.moveTo(x, vy); ctx.lineTo(x, vy + vh); ctx.stroke() }
  for (let y = gy0; y < vy + vh; y += GRID * 5) { ctx.beginPath(); ctx.moveTo(vx, y); ctx.lineTo(vx + vw, y); ctx.stroke() }
  const poly = roomPoly(cfg)
  const tracePoly = () => { ctx.beginPath(); poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath() }
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 24; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 7
  tracePoly(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore()
  ctx.save(); tracePoly(); ctx.clip()
  ctx.fillStyle = FLOOR_COL[cfg.floorTexture] || '#c8a46e'; ctx.fill()
  if (cfg.floorTexture === 'wood') {
    const ph = 12; ctx.strokeStyle = 'rgba(100,60,20,0.2)'; ctx.lineWidth = 0.6
    for (let y = OY; y < OY + RD + ph; y += ph) { ctx.beginPath(); ctx.moveTo(OX, y); ctx.lineTo(OX + RW, y); ctx.stroke() }
    ctx.strokeStyle = 'rgba(100,60,20,0.1)'; ctx.lineWidth = 0.4
    for (let y = OY, row = 0; y < OY + RD; y += ph, row++) {
      const off = row % 2 ? 0 : RW * 0.33
      for (let x = OX + off; x < OX + RW; x += RW * 0.45) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + ph); ctx.stroke() }
    }
  } else if (cfg.floorTexture === 'tile') {
    const ts = 22; ctx.strokeStyle = 'rgba(130,130,130,0.3)'; ctx.lineWidth = 0.6
    for (let x = OX; x <= OX + RW; x += ts) { ctx.beginPath(); ctx.moveTo(x, OY); ctx.lineTo(x, OY + RD); ctx.stroke() }
    for (let y = OY; y <= OY + RD; y += ts) { ctx.beginPath(); ctx.moveTo(OX, y); ctx.lineTo(OX + RW, y); ctx.stroke() }
  } else if (cfg.floorTexture === 'marble') {
    ctx.strokeStyle = 'rgba(160,140,120,0.22)'; ctx.lineWidth = 0.8
    for (let x = OX; x < OX + RW; x += 35) { ctx.beginPath(); ctx.moveTo(x, OY); ctx.lineTo(x, OY + RD); ctx.stroke() }
    for (let y = OY; y < OY + RD; y += 35) { ctx.beginPath(); ctx.moveTo(OX, y); ctx.lineTo(OX + RW, y); ctx.stroke() }
  } else if (cfg.floorTexture === 'carpet') {
    ctx.fillStyle = 'rgba(0,0,0,0.05)'
    for (let x = OX; x < OX + RW; x += 8) for (let y2 = OY; y2 < OY + RD; y2 += 8) { ctx.beginPath(); ctx.arc(x + 4, y2 + 4, 1, 0, Math.PI * 2); ctx.fill() }
  } else if (cfg.floorTexture === 'concrete') {
    ctx.strokeStyle = 'rgba(100,100,100,0.1)'; ctx.lineWidth = 0.5
    for (let x = OX; x < OX + RW; x += 40) { ctx.beginPath(); ctx.moveTo(x, OY); ctx.lineTo(x, OY + RD); ctx.stroke() }
    for (let y = OY; y < OY + RD; y += 40) { ctx.beginPath(); ctx.moveTo(OX, y); ctx.lineTo(OX + RW, y); ctx.stroke() }
  }
  ctx.restore()
  tracePoly(); ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 14; ctx.lineJoin = 'round'; ctx.stroke()
  tracePoly(); ctx.strokeStyle = cfg.wallColor || '#F5F5F0'; ctx.lineWidth = 10; ctx.stroke()
  tracePoly(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.fillStyle = '#475569'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = '600 11px DM Sans,system-ui,sans-serif'
  ctx.fillText(`${cfg_w} m`, OX + RW / 2, OY - 22)
  ctx.save(); ctx.translate(OX - 28, OY + RD / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`${cfg_d} m`, 0, 0); ctx.restore()
  const cpx = OX + RW + 38, cpy = OY + 24
  ctx.save(); ctx.font = '600 9px DM Sans,sans-serif'; ctx.textAlign = 'center'
  ctx.fillStyle = '#dc2626'; ctx.fillText('N', cpx, cpy - 15)
  ctx.fillStyle = '#94a3b8'; ctx.fillText('S', cpx, cpy + 19); ctx.fillText('W', cpx - 17, cpy + 4); ctx.fillText('E', cpx + 17, cpy + 4)
  ctx.beginPath(); ctx.moveTo(cpx, cpy - 10); ctx.lineTo(cpx + 4, cpy + 3); ctx.lineTo(cpx, cpy); ctx.closePath(); ctx.fillStyle = '#dc2626'; ctx.fill()
  ctx.beginPath(); ctx.moveTo(cpx, cpy + 10); ctx.lineTo(cpx - 4, cpy - 3); ctx.lineTo(cpx, cpy); ctx.closePath(); ctx.fillStyle = '#94a3b8'; ctx.fill()
  ctx.restore()
  if (overlays) {
    ;(overlays.doors || []).forEach(d => drawDoor(ctx, d, selectedOverlay?.id === d.id))
    ;(overlays.windows || []).forEach(w => drawWindow(ctx, w, selectedOverlay?.id === w.id))
    ;(overlays.curtains || []).forEach(c => drawCurtain(ctx, c, selectedOverlay?.id === c.id))
  }
  ;(items || []).forEach(item => {
    if (item.x == null || item.y == null) return
    const sel = item.id === selected; ctx.save()
    ctx.translate(item.x + item.w / 2, item.y + item.d / 2)
    ctx.rotate((item.rotation || 0) * Math.PI / 180)
    ctx.shadowColor = sel ? 'rgba(59,130,246,0.4)' : 'rgba(0,0,0,0.2)'; ctx.shadowBlur = sel ? 16 : 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3
    const base = item.color || CAT_COLOR[item.category] || '#93b4fd'
    ctx.fillStyle = base; ctx.beginPath(); ctx.roundRect(-item.w / 2, -item.d / 2, item.w, item.d, 5); ctx.fill()
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0
    try {
      const g = ctx.createLinearGradient(-item.w / 2, -item.d / 2, item.w / 2, item.d / 2)
      g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.06)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-item.w / 2, -item.d / 2, item.w, item.d, 5); ctx.fill()
    } catch (_) {}
    ctx.strokeStyle = sel ? '#3b82f6' : 'rgba(0,0,0,0.25)'; ctx.lineWidth = sel ? 2.5 : 1.5
    ctx.beginPath(); ctx.roundRect(-item.w / 2, -item.d / 2, item.w, item.d, 5); ctx.stroke()
    drawFurnDetail(ctx, item, topDownCache)
    const fs = Math.max(7, Math.min(13, Math.min(item.w, item.d) / 4.5))
    ctx.fillStyle = 'rgba(15,23,42,0.85)'; ctx.font = `600 ${fs}px DM Sans,system-ui,sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    let lbl = item.label || item.name || ''
    while (lbl.length > 2 && ctx.measureText(lbl).width > item.w - 10) lbl = lbl.slice(0, -1)
    if (lbl !== (item.label || item.name || '')) lbl += '…'
    ctx.fillText(lbl, 0, 0)
    if (sel) {
      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3])
      ctx.beginPath(); ctx.roundRect(-item.w / 2 - 6, -item.d / 2 - 6, item.w + 12, item.d + 12, 8); ctx.stroke(); ctx.setLineDash([])
      ;[[-item.w / 2 - 5, -item.d / 2 - 5], [item.w / 2 + 5, -item.d / 2 - 5], [-item.w / 2 - 5, item.d / 2 + 5], [item.w / 2 + 5, item.d / 2 + 5]].forEach(([hx, hy]) => {
        const hs = 8; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.rect(hx - hs / 2, hy - hs / 2, hs, hs); ctx.fill(); ctx.stroke()
      })
      const rh = 18; ctx.fillStyle = '#f59e0b'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(0, -item.d / 2 - rh, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.strokeStyle = 'rgba(245,158,11,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2])
      ctx.beginPath(); ctx.moveTo(0, -item.d / 2 - 5); ctx.lineTo(0, -item.d / 2 - rh + 6); ctx.stroke(); ctx.setLineDash([])
    }
    ctx.restore()
  })
  ctx.restore()
}

export default function Workspace2D() {
  const { id } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const sizedRef = useRef(false)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg] = useState({ shape: 'rectangle', width: 5, depth: 4, height: 2.8, wallColor: '#F5F5F0', floorTexture: 'wood' })
  const [items, setItems] = useState([])
  const [overlays, setOverlays] = useState({ doors: [], windows: [], curtains: [] })
  const [selected, setSelected] = useState(null)
  const [selectedOverlay, setSelectedOverlay] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(80)
  const [panY, setPanY] = useState(60)
  const [mode, setMode] = useState('select')
  const [panelOpen, setPanelOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('furniture')
  const [furSearch, setFurSearch] = useState('')
  const [furCat, setFurCat] = useState('All')
  const [library, setLibrary] = useState(FURNITURE_LIBRARY)
  const [curtainColor, setCurtainColor] = useState('#fca5a5')
  const [pendingFit, setPendingFit] = useState(false)
  const [customModels, setCustomModels] = useState([])
  const [uploadingModel, setUploadingModel] = useState(false)
  const [topDownCache, setTopDownCache] = useState({})
  const stateRef = useRef({})
  stateRef.current = { cfg, items, overlays, selectedOverlay, selected, zoom, panX, panY, topDownCache, customModels }
  const zoomRef = useRef(zoom); useEffect(() => { zoomRef.current = zoom }, [zoom])
  const panRef = useRef({ x: panX, y: panY }); useEffect(() => { panRef.current = { x: panX, y: panY } }, [panX, panY])
  const drag = useRef(null)
  const history = useRef([])

  const computeFit = useCallback((cw, ch, c) => {
    const sh = c.shape || 'rectangle', w = c.width || 5, d = c.depth || 4
    const RW = (sh === 'square' ? Math.min(w, d) : w) * GRID
    const RD = (sh === 'square' ? Math.min(w, d) : d) * GRID
    const pad = 120
    const nz = Math.max(0.08, Math.min(4, Math.min((cw - pad) / (RW + OX * 2), (ch - pad) / (RD + OY * 2))))
    return { zoom: nz, panX: (cw - (RW + OX * 2) * nz) / 2, panY: (ch - (RD + OY * 2) * nz) / 2 }
  }, [])

  useLayoutEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current; if (!canvas || !wrap) return
    const sizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1, w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return
      const pw = Math.round(w * dpr), ph = Math.round(h * dpr)
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; canvas.style.width = w + 'px'; canvas.style.height = h + 'px' }
      if (!sizedRef.current) { sizedRef.current = true; if (pendingFit) { const f = computeFit(w, h, stateRef.current.cfg); setZoom(f.zoom); setPanX(f.panX); setPanY(f.panY); setPendingFit(false) } }
      draw(canvas, stateRef.current)
    }
    sizeCanvas()
    const ro = new ResizeObserver(sizeCanvas); ro.observe(wrap)
    return () => ro.disconnect()
  }, [computeFit, pendingFit]) 

  useEffect(() => {
    const c = canvasRef.current; if (!c || c.width === 0) return
    draw(c, { cfg, items, overlays, selected, selectedOverlay, zoom, panX, panY, topDownCache })
  }, [cfg, items, overlays, selected, selectedOverlay, zoom, panX, panY, topDownCache])

  useEffect(() => {
    if (!pendingFit) return
    const canvas = canvasRef.current; if (!canvas || canvas.width === 0) return
    const dpr = window.devicePixelRatio || 1
    const f = computeFit(canvas.width / dpr, canvas.height / dpr, cfg)
    setZoom(f.zoom); setPanX(f.panX); setPanY(f.panY); setPendingFit(false)
  }, [pendingFit, cfg, computeFit])

  useEffect(() => {
    setLoading(true)
    projectsApi.getById(id).then(p => {
      setProject(p)
      let c = { shape: 'rectangle', width: 5, depth: 4, height: 2.8, wallColor: '#F5F5F0', floorTexture: 'wood' }
      try { c = JSON.parse(p.roomConfig) } catch {}
      setCfg(c)
      try {
        const saved = JSON.parse(p.furnitureLayout)
        if (saved?.items) { setItems(Array.isArray(saved.items) ? saved.items : []); setOverlays(saved.overlays || { doors: [], windows: [], curtains: [] }) }
        else if (Array.isArray(saved)) setItems(saved)
      } catch {}
      setPendingFit(true)
    }).catch(() => { toast.error('Failed to load project'); navigate('/projects') }).finally(() => setLoading(false))
    furnitureApi.getAll().then(d => { if (d?.length) setLibrary(d) }).catch(() => {})
  }, [id]) 

  const centerView = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas || canvas.width === 0) return
    const dpr = window.devicePixelRatio || 1
    const f = computeFit(canvas.width / dpr, canvas.height / dpr, stateRef.current.cfg)
    setZoom(f.zoom); setPanX(f.panX); setPanY(f.panY)
  }, [computeFit])

  const screenToWorld = useCallback((sx, sy) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: (sx - rect.left - panRef.current.x) / zoomRef.current, y: (sy - rect.top - panRef.current.y) / zoomRef.current }
  }, [])

  const hitHandle = (item, wx, wy) => {
    const hw = item.w / 2, hd = item.d / 2, icx = item.x + hw, icy = item.y + hd
    const rad = -(item.rotation || 0) * Math.PI / 180
    const dx = wx - icx, dy = wy - icy
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad), ly = dx * Math.sin(rad) + dy * Math.cos(rad)
    const hs = 9 / zoomRef.current, rh = 18 / zoomRef.current
    if (Math.abs(lx) < hs && Math.abs(ly - (-hd - rh)) < hs) return 'rotate'
    const corners = [[-hw - 5, -hd - 5], [hw + 5, -hd - 5], [-hw - 5, hd + 5], [hw + 5, hd + 5]]
    for (const [cx2, cy2] of corners) if (Math.abs(lx - cx2) < hs && Math.abs(ly - cy2) < hs) return 'resize'
    return null
  }

  const hitOverlay = (wx, wy) => {
    const ov = stateRef.current.overlays
    for (const d of (ov.doors || [])) { const dw = d.w || 80, rad = -(d.rotation || 0) * Math.PI / 180, dx = wx - d.x, dy = wy - d.y, lx = dx * Math.cos(rad) - dy * Math.sin(rad), ly = dx * Math.sin(rad) + dy * Math.cos(rad); if (lx >= -8 && lx <= dw + 8 && Math.abs(ly) < 18) return { type: 'door', id: d.id } }
    for (const w of (ov.windows || [])) { const ww = w.w || 100, rad = -(w.rotation || 0) * Math.PI / 180, dx = wx - w.x, dy = wy - w.y, lx = dx * Math.cos(rad) - dy * Math.sin(rad), ly = dx * Math.sin(rad) + dy * Math.cos(rad); if (Math.abs(lx) <= ww / 2 + 8 && Math.abs(ly) < 22) return { type: 'window', id: w.id } }
    for (const c of (ov.curtains || [])) { const cw = c.w || 120, rad = -(c.rotation || 0) * Math.PI / 180, dx = wx - c.x, dy = wy - c.y, lx = dx * Math.cos(rad) - dy * Math.sin(rad), ly = dx * Math.sin(rad) + dy * Math.cos(rad); if (Math.abs(lx) <= cw / 2 + 14 && ly >= -22 && ly <= 34) return { type: 'curtain', id: c.id } }
    return null
  }

  const onMouseDown = useCallback(e => {
    if (e.button === 1 || (e.button === 0 && mode === 'pan')) { drag.current = { type: 'pan', startX: e.clientX, startY: e.clientY, startPanX: panRef.current.x, startPanY: panRef.current.y }; return }
    if (e.button !== 0) return
    const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY)
    const { items: its, selected: sel } = stateRef.current
    for (let i = its.length - 1; i >= 0; i--) {
      const item = its[i], hw = item.w / 2, hd = item.d / 2, icx = item.x + hw, icy = item.y + hd
      const rad = -(item.rotation || 0) * Math.PI / 180, dx = wx - icx, dy = wy - icy
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad), ly = dx * Math.sin(rad) + dy * Math.cos(rad)
      if (lx >= -hw - 14 && lx <= hw + 14 && ly >= -hd - 22 && ly <= hd + 14) {
        if (item.id === sel) { const h = hitHandle(item, wx, wy); if (h === 'rotate') drag.current = { type: 'rotate', id: item.id, cx: icx, cy: icy }; else if (h === 'resize') drag.current = { type: 'resize', id: item.id, startW: item.w, startD: item.d, mx: wx, my: wy }; else drag.current = { type: 'move', id: item.id, offX: wx - item.x, offY: wy - item.y } }
        else { setSelected(item.id); setSelectedOverlay(null); drag.current = { type: 'move', id: item.id, offX: wx - item.x, offY: wy - item.y } }
        return
      }
    }
    const ov = hitOverlay(wx, wy)
    if (ov) { setSelectedOverlay(ov); setSelected(null); const arr = stateRef.current.overlays[ov.type === 'door' ? 'doors' : ov.type === 'window' ? 'windows' : 'curtains']; const ovItem = arr.find(x => x.id === ov.id); if (ovItem) drag.current = { type: 'overlay-move', overlayType: ov.type, id: ov.id, offX: wx - ovItem.x, offY: wy - ovItem.y }; return }
    setSelected(null); setSelectedOverlay(null)
    drag.current = { type: 'pan', startX: e.clientX, startY: e.clientY, startPanX: panRef.current.x, startPanY: panRef.current.y }
  }, [mode, screenToWorld])

  const onMouseMove = useCallback(e => {
    if (!drag.current) return
    const d = drag.current
    if (d.type === 'pan') { setPanX(d.startPanX + (e.clientX - d.startX)); setPanY(d.startPanY + (e.clientY - d.startY)); return }
    const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY)
    if (d.type === 'move') { setItems(p => p.map(i => i.id === d.id ? { ...i, x: snapV(wx - d.offX), y: snapV(wy - d.offY) } : i)); setDirty(true) }
    else if (d.type === 'rotate') { const angle = Math.atan2(wy - d.cy, wx - d.cx) * 180 / Math.PI + 90; setItems(p => p.map(i => i.id === d.id ? { ...i, rotation: ((Math.round(angle / 5) * 5) % 360 + 360) % 360 } : i)); setDirty(true) }
    else if (d.type === 'resize') { setItems(p => p.map(i => i.id === d.id ? { ...i, w: Math.max(20, snapV(d.startW + (wx - d.mx))), d: Math.max(20, snapV(d.startD + (wy - d.my))) } : i)); setDirty(true) }
    else if (d.type === 'overlay-move') { const key = d.overlayType === 'door' ? 'doors' : d.overlayType === 'window' ? 'windows' : 'curtains'; setOverlays(o => ({ ...o, [key]: o[key].map(x => x.id === d.id ? { ...x, x: snapV(wx - d.offX), y: snapV(wy - d.offY) } : x) })); setDirty(true) }
  }, [screenToWorld]) 

  const onMouseUp = useCallback(() => { drag.current = null }, [])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const onWheel = e => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      setZoom(z => { const nz = Math.max(0.08, Math.min(8, z * factor)); setPanX(p => mx - (mx - p) * (nz / z)); setPanY(p => my - (my - p) * (nz / z)); return nz })
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  const onDrop = useCallback(e => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('furniture'); if (!raw) return
    const model = JSON.parse(raw)
    const canvas = canvasRef.current, rect = canvas.getBoundingClientRect()
    const wx = (e.clientX - rect.left - panRef.current.x) / zoomRef.current
    const wy = (e.clientY - rect.top - panRef.current.y) / zoomRef.current
    const pw = Math.max(20, Math.round((model.w || 100) / 100 * GRID))
    const pd = Math.max(20, Math.round((model.d || 80) / 100 * GRID))

    const customModelEntry = model.customModelId
      ? (stateRef.current.customModels || []).find(m => m.id === model.customModelId)
      : null
    const newItem = {
      id: Date.now(), label: model.name, name: model.name, category: model.category || 'Custom',
      color: model.color || CAT_COLOR[model.category] || '#c4b5fd',
      x: snapV(wx - pw / 2), y: snapV(wy - pd / 2), w: pw, d: pd, rotation: 0,
      modelId: model.id, widthM: (model.w || 100) / 100, depthM: (model.d || 80) / 100, heightM: (model.h || 80) / 100,
      customModelId: model.customModelId || null,
      customModelExt: model.customModelExt || null,
      customModelB64: customModelEntry?.b64 || null,
    }
    history.current.push(JSON.stringify(stateRef.current.items))
    setItems(prev => [...prev, newItem]); setSelected(newItem.id); setSelectedOverlay(null); setDirty(true)
  }, [])

  const pushHistory = () => { history.current.push(JSON.stringify(stateRef.current.items)); if (history.current.length > 80) history.current.shift() }
  const undo = useCallback(() => { if (!history.current.length) { toast('Nothing to undo'); return }; setItems(JSON.parse(history.current.pop())); setSelected(null); setDirty(true) }, [])
  const rot90 = useCallback(() => { const s = stateRef.current.selected; if (!s) return; pushHistory(); setItems(p => p.map(i => i.id === s ? { ...i, rotation: ((i.rotation || 0) + 90) % 360 } : i)); setDirty(true) }, [])
  const del = useCallback(() => { const s = stateRef.current.selected; if (!s) return; pushHistory(); setItems(p => p.filter(i => i.id !== s)); setSelected(null); setDirty(true) }, [])
  const dup = useCallback(() => { const s = stateRef.current.selected; if (!s) return; pushHistory(); const src = stateRef.current.items.find(i => i.id === s); if (!src) return; const ni = { ...src, id: Date.now(), x: src.x + 25, y: src.y + 25 }; setItems(p => [...p, ni]); setSelected(ni.id); setDirty(true) }, [])

  useEffect(() => {
    const h = e => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === 'Delete' || e.key === 'Backspace') del()
      if (e.key === 'r' || e.key === 'R') rot90()
      if (e.key === 'd' || e.key === 'D') dup()
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save() }
      if (e.key === 'Escape') { setSelected(null); setSelectedOverlay(null) }
      if (e.key === ' ') { e.preventDefault(); setMode(m => m === 'pan' ? 'select' : 'pan') }
      if (e.key === 'f' || e.key === 'F') centerView()
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [del, rot90, dup, undo, centerView])

  const addDoor = () => { setOverlays(o => ({ ...o, doors: [...o.doors, { id: Date.now(), x: OX + 10, y: OY, rotation: 0, w: 80 }] })); setDirty(true); toast('Door added') }
  const addWindow = () => { setOverlays(o => ({ ...o, windows: [...o.windows, { id: Date.now(), x: OX + (stateRef.current.cfg.width || 5) * GRID / 2, y: OY, rotation: 0, w: 100 }] })); setDirty(true); toast('Window added') }
  const addCurtain = () => { setOverlays(o => ({ ...o, curtains: [...o.curtains, { id: Date.now(), x: OX + (stateRef.current.cfg.width || 5) * GRID / 2, y: OY + 8, rotation: 0, w: 120, color: curtainColor }] })); setDirty(true); toast('Curtain added') }

 
  const handleModelUpload = useCallback(async e => {
    const file = e.target.files?.[0]; if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext !== 'obj' && ext !== 'glb') { toast.error('Only .obj and .glb supported'); e.target.value = ''; return }
    if (file.size > 12 * 1024 * 1024) { toast.error('File too large; upload under 12MB'); e.target.value = ''; return }
    const currentCount = stateRef.current.customModels?.length ?? 0
    if (currentCount >= 3) { toast.error('Maximum 3 custom models'); e.target.value = ''; return }
    setUploadingModel(true)
    try {
      const buf = await file.arrayBuffer()
      const modelId = 'custom_' + Date.now()
      const modelName = file.name.replace(/\.\w+$/, '')
      const b64 = await arrayBufferToBase64(buf)
      let tdData = null
      try {
        if (ext === 'obj') { const text = new TextDecoder().decode(buf); tdData = parseOBJTopDown(text) }
        else if (ext === 'glb') { tdData = parseGLBTopDown(buf) }
      } catch (parseErr) { console.warn('Top-down parse failed:', parseErr) }
      if (tdData?.pts2d?.length > 0) setTopDownCache(prev => ({ ...prev, [modelId]: tdData }))
      setCustomModels(prev => {
        if (prev.length >= 3) return prev
        return [...prev, { id: modelId, name: modelName, ext, b64 }]
      })
      toast.success(`\"${modelName}\" loaded`)
    } catch (err) { toast.error('Upload failed: ' + (err?.message || 'unknown error')) }
    finally { setUploadingModel(false); e.target.value = '' }
  }, []) 

  const removeCustomModel = useCallback(modelId => {
    setCustomModels(prev => prev.filter(m => m.id !== modelId))
    setTopDownCache(prev => { const n = { ...prev }; delete n[modelId]; return n })
    setItems(prev => prev.filter(i => i.customModelId !== modelId))
    setDirty(true)
  }, [])

  const save = async () => {
    setSaving(true)
    try { await projectsApi.update(id, { roomConfig: JSON.stringify(cfg), furnitureLayout: JSON.stringify({ items, overlays }) }); setDirty(false); toast.success('Saved!') }
    catch { toast.error('Save failed') } finally { setSaving(false) }
  }

  const fullLibrary = [
    ...library,
    ...customModels.map(m => ({ id: m.id, name: m.name, category: 'Custom', color: '#c4b5fd', w: 100, d: 100, h: 100, customModelId: m.id, customModelExt: m.ext }))
  ]
  const categories = ['All', ...new Set(fullLibrary.map(f => f.category))]
  const filteredLib = fullLibrary.filter(f => (furCat === 'All' || f.category === furCat) && f.name.toLowerCase().includes(furSearch.toLowerCase()))
  const selectedItem = items.find(i => i.id === selected)

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-slate-500 text-sm font-medium">Loading project…</p>
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden select-none">
      <div className="h-14 bg-white border-b border-slate-200 flex items-center px-2 gap-1.5 flex-shrink-0 z-20 overflow-x-auto">
        <button onClick={() => navigate('/projects')} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center gap-1 text-sm flex-shrink-0"><ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Projects</span></button>
        <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
        <span className="font-semibold text-slate-900 text-sm truncate max-w-[120px] flex-shrink-0">{project?.name || '…'}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold flex-shrink-0">2D</span>
        {dirty && <span className="text-xs text-amber-500 flex-shrink-0">● Unsaved</span>}
        <div className="flex-1 min-w-0" />
        <div className="flex bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
          {[['select', 'Select', <MousePointer className="w-3 h-3" />], ['pan', 'Pan', <Move className="w-3 h-3" />]].map(([m, label, icon]) => (
            <button key={m} onClick={() => setMode(m)} className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-all ${mode === m ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{icon}{label}</button>
          ))}
        </div>
        <button onClick={() => setZoom(z => Math.max(0.08, +(z - 0.1).toFixed(2)))} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 flex-shrink-0"><ZoomOut className="w-4 h-4" /></button>
        <span className="text-xs text-slate-500 w-10 text-center font-mono flex-shrink-0">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(8, +(z + 0.1).toFixed(2)))} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 flex-shrink-0"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={centerView} title="Fit (F)" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 flex-shrink-0"><Maximize2 className="w-4 h-4" /></button>
        <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
        <button onClick={rot90} disabled={!selected} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex-shrink-0"><RotateCw className="w-4 h-4" /></button>
        <button onClick={dup} disabled={!selected} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex-shrink-0"><Copy className="w-4 h-4" /></button>
        <button onClick={del} disabled={!selected} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-30 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
        <button onClick={undo} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 flex-shrink-0"><Undo className="w-4 h-4" /></button>
        <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
        <button onClick={addDoor} title="Add Door" className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex-shrink-0"><DoorOpen className="w-4 h-4" /></button>
        <button onClick={addWindow} title="Add Window" className="p-1.5 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-600 flex-shrink-0"><Columns className="w-4 h-4" /></button>
        <button onClick={addCurtain} title="Add Curtain" className="p-1.5 rounded-lg text-slate-500 hover:bg-pink-50 hover:text-pink-600 flex-shrink-0"><Wind className="w-4 h-4" /></button>
        <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
        <button onClick={() => { save(); setTimeout(() => navigate(`/workspace/3d/${id}`), 600) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all flex-shrink-0"><Box className="w-4 h-4" /><span className="hidden md:inline">3D View</span></button>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all disabled:opacity-60 flex-shrink-0">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}<span className="hidden sm:inline">Save</span>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`bg-white border-r border-slate-200 flex flex-col flex-shrink-0 transition-all duration-200 ${panelOpen ? 'w-60' : 'w-0 overflow-hidden'}`}>
          <div className="flex border-b border-slate-100 flex-shrink-0">
            {[['furniture', '🪑'], ['overlays', '🚪'], ['room', '⚙️']].map(([t, e]) => (
              <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${activeTab === t ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>{e} {t}</button>
            ))}
          </div>

          {activeTab === 'furniture' && <>
            <div className="p-2 space-y-1.5 border-b border-slate-100 flex-shrink-0">
              <input className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300" placeholder="Search…" value={furSearch} onChange={e => setFurSearch(e.target.value)} />
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {categories.map(c => (<button key={c} onClick={() => setFurCat(c)} className={`text-xs px-2 py-0.5 rounded-full border transition-all ${furCat === c ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>{c}</button>))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {filteredLib.map(f => (
                <div key={f.id} draggable onDragStart={e => e.dataTransfer.setData('furniture', JSON.stringify(f))} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 transition-all group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: (f.color || CAT_COLOR[f.category] || '#93b4fd') + '33' }}>
                    {f.category === 'Custom' ? <Package className="w-4 h-4 text-violet-500" /> : (CAT_EMOJI[f.category] || '📦')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 truncate">{f.name}</p>
                    <p className="text-xs text-slate-400">{f.category === 'Custom' ? <span className="text-violet-500 font-medium">.{f.customModelExt || '3d'} model</span> : `${((f.w || 100) / 100).toFixed(1)}×${((f.d || 80) / 100).toFixed(1)} m`}</p>
                  </div>
                  {f.category === 'Custom' && (<button onClick={e => { e.stopPropagation(); removeCustomModel(f.id) }} className="p-1 rounded text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"><Trash2 className="w-3 h-3" /></button>)}
                </div>
              ))}
              {filteredLib.length === 0 && <p className="text-center text-xs text-slate-400 pt-8">No items match</p>}
            </div>
            <div className="border-t border-slate-100 p-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-slate-500">3D Models ({customModels.length}/3)</p>
                <span className="text-xs text-slate-400">.obj / .glb</span>
              </div>
              {customModels.length < 3 ? (
                <label className={`flex items-center justify-center gap-2 w-full border border-dashed rounded-xl py-2.5 text-xs font-medium transition-all cursor-pointer ${uploadingModel ? 'border-violet-200 text-violet-400 bg-violet-50/50' : 'border-slate-300 hover:border-violet-400 text-slate-500 hover:text-violet-600 hover:bg-violet-50/30'}`}>
                  {uploadingModel ? <><span className="w-3.5 h-3.5 border-2 border-violet-300/40 border-t-violet-400 rounded-full animate-spin" />Processing…</> : <><Upload className="w-3.5 h-3.5" />Upload model</>}
                  <input type="file" className="hidden" accept=".obj,.glb" onChange={handleModelUpload} disabled={uploadingModel} />
                </label>
              ) : (<p className="text-xs text-slate-400 text-center py-1">Max 3 models reached</p>)}
              <p className="text-xs text-slate-400 mt-1 text-center">Drag model onto canvas to place</p>
            </div>
          </>}

          {activeTab === 'overlays' && <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {[['Doors', 'door', addDoor, overlays.doors, 'doors', DoorOpen], ['Windows', 'window', addWindow, overlays.windows, 'windows', Columns], ['Curtains', 'curtain', addCurtain, overlays.curtains, 'curtains', Wind]].map(([title, type, adder, list, key, Icon]) => (
              <div key={type}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
                {type === 'curtain' && <div className="flex items-center gap-2 mb-2"><input type="color" className="w-7 h-7 rounded border border-slate-200 p-0.5 cursor-pointer" value={curtainColor} onChange={e => setCurtainColor(e.target.value)} /><span className="text-xs text-slate-400">Color for new curtains</span></div>}
                <button onClick={adder} className="w-full flex items-center gap-2 border border-dashed border-slate-300 hover:border-blue-400 rounded-xl px-3 py-2 text-sm text-slate-600 hover:text-blue-600 transition-all"><Icon className="w-4 h-4" /> Add {title.slice(0, -1)}</button>
                {list.map((item, i) => (
                  <div key={item.id} className={`flex items-center justify-between mt-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer border transition-all ${selectedOverlay?.id === item.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-transparent text-slate-600 hover:border-slate-200'}`} onClick={() => { setSelectedOverlay({ type, id: item.id }); setSelected(null) }}>
                    <span>{title.slice(0, -1)} {i + 1}</span>
                    <button onClick={ev => { ev.stopPropagation(); setOverlays(o => ({ ...o, [key]: o[key].filter(x => x.id !== item.id) })); setDirty(true) }} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            ))}
          </div>}

          {activeTab === 'room' && <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div><label className="text-xs text-slate-500 block mb-1">Shape</label>
              <select className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50" value={cfg.shape} onChange={e => { setCfg(c => ({ ...c, shape: e.target.value })); setDirty(true) }}>
                <option value="rectangle">Rectangle</option><option value="square">Square</option><option value="l-shape">L-Shape</option>
              </select></div>
            <div className="grid grid-cols-2 gap-2">
              {[['Width (m)', 'width'], ['Depth (m)', 'depth']].map(([l, k]) => (
                <div key={k}><label className="text-xs text-slate-500 block mb-1">{l}</label>
                  <input type="number" min="2" max="20" step="0.5" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50" value={cfg[k]} onChange={e => { setCfg(c => ({ ...c, [k]: +e.target.value })); setDirty(true) }} /></div>
              ))}
              <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Height (m)</label>
                <input type="number" min="2" max="6" step="0.1" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50" value={cfg.height || 2.8} onChange={e => { setCfg(c => ({ ...c, height: +e.target.value })); setDirty(true) }} /></div>
            </div>
            <div><label className="text-xs text-slate-500 block mb-1">Wall Color</label>
              <div className="flex gap-2">
                <input type="color" className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5" value={cfg.wallColor || '#F5F5F0'} onChange={e => { setCfg(c => ({ ...c, wallColor: e.target.value })); setDirty(true) }} />
                <input className="flex-1 text-xs border border-slate-200 rounded-lg px-2 bg-slate-50 font-mono" value={cfg.wallColor || '#F5F5F0'} onChange={e => { setCfg(c => ({ ...c, wallColor: e.target.value })); setDirty(true) }} />
              </div></div>
            <div><label className="text-xs text-slate-500 block mb-1">Floor</label>
              <select className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50" value={cfg.floorTexture || 'wood'} onChange={e => { setCfg(c => ({ ...c, floorTexture: e.target.value })); setDirty(true) }}>
                {['wood', 'carpet', 'tile', 'marble', 'concrete'].map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select></div>
            <div className="pt-2 border-t border-slate-100">
              <button onClick={() => { if (!window.confirm('Clear all furniture?')) return; pushHistory(); setItems([]); setSelected(null); setDirty(true); toast('Cleared') }} className="w-full text-xs text-red-500 hover:bg-red-50 border border-red-200 rounded-lg py-1.5 transition-all">Clear all furniture</button>
            </div>
          </div>}
        </div>

        <button onClick={() => setPanelOpen(!panelOpen)} className="absolute z-30 top-1/2 -translate-y-1/2 bg-white border border-slate-200 rounded-r-lg p-1 shadow-sm hover:bg-slate-50" style={{ left: panelOpen ? '240px' : '0' }}>
          <PanelLeft className={`w-4 h-4 text-slate-500 transition-transform ${panelOpen ? '' : 'rotate-180'}`} />
        </button>

        <div ref={wrapRef} className="flex-1 relative overflow-hidden">
          <canvas ref={canvasRef} style={{ display: 'block', cursor: mode === 'pan' ? 'grab' : 'default', imageRendering: 'crisp-edges' }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onContextMenu={e => e.preventDefault()} onDrop={onDrop} onDragOver={e => e.preventDefault()} />
          <div className="absolute bottom-3 left-3 bg-white/95 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-500 font-mono pointer-events-none shadow-sm">
            {Math.round(zoom * 100)}% · {cfg.width || 5}×{cfg.depth || 4} m · {items.length} items
          </div>
          <div className="absolute bottom-3 right-3 bg-white/95 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-500 pointer-events-none hidden md:block shadow-sm">
            Scroll: zoom · Drag: move · ▪ corner: resize · ● top: rotate · R:90° · F:fit
          </div>
          {selectedItem && (
            <div className="absolute top-3 bg-white rounded-xl border border-blue-200 shadow-lg p-3 w-52 z-10" style={{ left: panelOpen ? '252px' : '12px' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-sm flex-shrink-0" style={{ background: (selectedItem.color || '#93b4fd') + '33' }}>
                  {selectedItem.category === 'Custom' ? <Package className="w-3.5 h-3.5 text-violet-500" /> : (CAT_EMOJI[selectedItem.category] || '📦')}
                </div>
                <p className="text-xs font-semibold text-blue-700 truncate flex-1">{selectedItem.label || selectedItem.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {[['W (m)', 'w', 'widthM'], ['D (m)', 'd', 'depthM']].map(([l, k, mk]) => (
                  <div key={k}><label className="text-xs text-slate-400 block mb-0.5">{l}</label>
                    <input type="number" min="0.2" max="12" step="0.1" className="w-full text-xs border border-slate-200 rounded-lg px-1.5 py-1 bg-slate-50" value={(selectedItem[k] / GRID).toFixed(2)} onChange={e => { const v = Math.max(10, Math.round(+e.target.value * GRID)); setItems(p => p.map(i => i.id === selected ? { ...i, [k]: v, [mk]: +e.target.value } : i)); setDirty(true) }} /></div>
                ))}
              </div>
              <div className="mb-2"><label className="text-xs text-slate-400 block mb-0.5">Height (m)</label>
                <input type="number" min="0.1" max="3" step="0.05" className="w-full text-xs border border-slate-200 rounded-lg px-1.5 py-1 bg-slate-50" value={(selectedItem.heightM || 0.8).toFixed(2)} onChange={e => { setItems(p => p.map(i => i.id === selected ? { ...i, heightM: +e.target.value } : i)); setDirty(true) }} /></div>
              <div className="mb-2"><label className="text-xs text-slate-400 block mb-0.5">Rotation: {selectedItem.rotation || 0}°</label>
                <input type="range" min="0" max="355" step="5" className="w-full accent-blue-500" value={selectedItem.rotation || 0} onChange={e => { setItems(p => p.map(i => i.id === selected ? { ...i, rotation: +e.target.value } : i)); setDirty(true) }} /></div>
              <div className="mb-2"><label className="text-xs text-slate-400 block mb-0.5">Color</label>
                <div className="flex gap-1.5 items-center">
                  <input type="color" className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0.5" value={selectedItem.color || '#93b4fd'} onChange={e => { setItems(p => p.map(i => i.id === selected ? { ...i, color: e.target.value } : i)); setDirty(true) }} />
                  <span className="text-xs text-slate-400 font-mono">{selectedItem.color || '#93b4fd'}</span>
                </div></div>
              <div className="flex gap-1">
                <button onClick={rot90} className="flex-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 rounded-lg flex items-center justify-center gap-1"><RotateCw className="w-3 h-3" />90°</button>
                <button onClick={dup} className="flex-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 py-1.5 rounded-lg flex items-center justify-center gap-1"><Copy className="w-3 h-3" />Dup</button>
                <button onClick={del} className="flex-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 py-1.5 rounded-lg flex items-center justify-center gap-1"><Trash2 className="w-3 h-3" />Del</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}