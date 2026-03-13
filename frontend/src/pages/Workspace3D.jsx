import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { projectsApi } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  ChevronLeft, Eye, EyeOff, RotateCcw, Save, Settings,
  Sun, Lightbulb, Upload, Package, X, Check, Sliders,
  Move3d, RotateCw, Maximize2, Trash2, AlertCircle
} from 'lucide-react'

// ── Colour maps (matches 2D) ──────────────────────────────────
const FURN_COLOR = {
  Seating:0x93b4fd, Tables:0x6ee7b7, Bedroom:0xfca5a5,
  Storage:0xd8b4fe, Office:0xfcd34d, Lighting:0xfdba74,
  Bathroom:0xa5f3fc, Kitchen:0xbbf7d0, 'Living Room':0xbfdbfe, Decor:0xf9a8d4,
}
const FLOOR_MAT = {
  wood:     { color:0xc8a46e, roughness:0.85, metalness:0.05 },
  carpet:   { color:0x7c6d8a, roughness:1.0,  metalness:0.0  },
  tile:     { color:0xe8e8e8, roughness:0.2,  metalness:0.08 },
  marble:   { color:0xf5f0eb, roughness:0.08, metalness:0.12 },
  concrete: { color:0x9e9e9e, roughness:0.95, metalness:0.0  },
}

// OBJ model registry — built-in procedural models
const BUILTIN_MODELS = {
  chair: (scene, pos, rot, scale, color) => buildChair(scene, pos, rot, scale, color),
  sofa:  (scene, pos, rot, scale, color) => buildSofa(scene, pos, rot, scale, color),
  table: (scene, pos, rot, scale, color) => buildTable(scene, pos, rot, scale, color),
  bed:   (scene, pos, rot, scale, color) => buildBed(scene, pos, rot, scale, color),
  desk:  (scene, pos, rot, scale, color) => buildDesk(scene, pos, rot, scale, color),
  shelf: (scene, pos, rot, scale, color) => buildShelf(scene, pos, rot, scale, color),
  lamp:  (scene, pos, rot, scale, color) => buildLamp(scene, pos, rot, scale, color),
  bathtub:(scene, pos, rot, scale, color) => buildBathtub(scene, pos, rot, scale, color),
  plant: (scene, pos, rot, scale, color) => buildPlant(scene, pos, rot, scale, color),
  tv:    (scene, pos, rot, scale, color) => buildTV(scene, pos, rot, scale, color),
}

// ── Utility: add mesh helper ──────────────────────────────────
function makeMesh(geo, mat, x, y, z, scene, name='furniture') {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true; m.receiveShadow = true; m.name = name
  scene.add(m); return m
}

// ── Procedural furniture builders ─────────────────────────────
function buildChair(scene, [x,y,z], rotY, [sw,sd,sh], color) {
  const group = new THREE.Group(); group.name = 'furniture-group'
  const mat = new THREE.MeshStandardMaterial({ color, roughness:0.7, metalness:0.05 })
  const legMat = new THREE.MeshStandardMaterial({ color:0x5c3d2e, roughness:0.85 })
  const seatH = sh * 0.42
  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(sw, sh*0.08, sd), mat)
  seat.position.y = seatH; seat.castShadow=true; group.add(seat)
  // Back
  const back = new THREE.Mesh(new THREE.BoxGeometry(sw, sh*0.5, sh*0.06), mat)
  back.position.set(0, seatH + sh*0.27, -sd/2 + sh*0.03); back.castShadow=true; group.add(back)
  // Legs
  const legH = seatH, legR = Math.min(sw,sd)*0.04
  ;[[-sw/2+legR*2, -sd/2+legR*2],[sw/2-legR*2,-sd/2+legR*2],[-sw/2+legR*2,sd/2-legR*2],[sw/2-legR*2,sd/2-legR*2]].forEach(([lx,lz])=>{
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR,legR,legH,8), legMat)
    leg.position.set(lx, legH/2, lz); leg.castShadow=true; group.add(leg)
  })
  group.position.set(x, y, z); group.rotation.y = rotY
  scene.add(group); return group
}

function buildSofa(scene, [x,y,z], rotY, [sw,sd,sh], color) {
  const group = new THREE.Group(); group.name = 'furniture-group'
  const mat = new THREE.MeshStandardMaterial({ color, roughness:0.8, metalness:0.0 })
  const darkMat = new THREE.MeshStandardMaterial({ color:0x2d1e0e, roughness:0.9 })
  const seatH = sh * 0.38
  // Base
  const base = new THREE.Mesh(new THREE.BoxGeometry(sw, seatH*0.3, sd), darkMat)
  base.position.y = seatH*0.15; base.castShadow=true; group.add(base)
  // Cushion
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(sw, seatH*0.2, sd*0.7), mat)
  cushion.position.set(0, seatH*0.4, sd*0.08); cushion.castShadow=true; group.add(cushion)
  // Backrest
  const back = new THREE.Mesh(new THREE.BoxGeometry(sw, sh*0.55, sd*0.22), mat)
  back.position.set(0, seatH + sh*0.27, -sd/2 + sd*0.11); back.castShadow=true; group.add(back)
  // Armrests
  ;[-sw/2, sw/2].forEach(ax=>{
    const arm = new THREE.Mesh(new THREE.BoxGeometry(sw*0.1, sh*0.5, sd), mat)
    arm.position.set(ax + (ax<0?sw*0.05:-sw*0.05), seatH+sh*0.15, 0); arm.castShadow=true; group.add(arm)
  })
  group.position.set(x,y,z); group.rotation.y=rotY; scene.add(group); return group
}

function buildTable(scene, [x,y,z], rotY, [sw,sd,sh], color) {
  const group = new THREE.Group(); group.name = 'furniture-group'
  const mat = new THREE.MeshStandardMaterial({ color, roughness:0.6, metalness:0.05 })
  const legMat = new THREE.MeshStandardMaterial({ color:0x4a3728, roughness:0.85 })
  // Top
  const top = new THREE.Mesh(new THREE.BoxGeometry(sw, sh*0.06, sd), mat)
  top.position.y = sh; top.castShadow=true; group.add(top)
  // Legs
  const legH = sh, legR = Math.min(sw,sd)*0.035
  const offX = sw/2 - legR*2, offZ = sd/2 - legR*2
  ;[[-offX,-offZ],[offX,-offZ],[-offX,offZ],[offX,offZ]].forEach(([lx,lz])=>{
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR,legR*1.1,legH,10), legMat)
    leg.position.set(lx, legH/2, lz); leg.castShadow=true; group.add(leg)
  })
  group.position.set(x,y,z); group.rotation.y=rotY; scene.add(group); return group
}

function buildBed(scene, [x,y,z], rotY, [sw,sd,sh], color) {
  const group = new THREE.Group(); group.name = 'furniture-group'
  const frameMat = new THREE.MeshStandardMaterial({ color:0x5c3d2e, roughness:0.85 })
  const mattressMat = new THREE.MeshStandardMaterial({ color:0xf5f5f0, roughness:0.9 })
  const pilMat = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.95 })
  const beddingMat = new THREE.MeshStandardMaterial({ color, roughness:0.9 })
  const frameH = sh * 0.2
  // Frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(sw, frameH, sd), frameMat)
  frame.position.y = frameH/2; frame.castShadow=true; group.add(frame)
  // Mattress
  const mattH = sh * 0.18
  const matt = new THREE.Mesh(new THREE.BoxGeometry(sw*0.92, mattH, sd*0.96), mattressMat)
  matt.position.y = frameH + mattH/2; matt.castShadow=true; group.add(matt)
  // Bedding
  const beddingH = sh*0.06
  const bedding = new THREE.Mesh(new THREE.BoxGeometry(sw*0.92, beddingH, sd*0.62), beddingMat)
  bedding.position.set(0, frameH+mattH+beddingH/2, sd*0.17); bedding.castShadow=true; group.add(bedding)
  // Pillows
  ;[-sw*0.22, sw*0.22].forEach(px=>{
    const pil = new THREE.Mesh(new THREE.BoxGeometry(sw*0.38, sh*0.07, sd*0.24), pilMat)
    pil.position.set(px, frameH+mattH+sh*0.035, -sd*0.35); pil.castShadow=true; group.add(pil)
  })
  // Headboard
  const hb = new THREE.Mesh(new THREE.BoxGeometry(sw, sh*0.55, sd*0.06), frameMat)
  hb.position.set(0, frameH+sh*0.27, -sd/2+sd*0.03); hb.castShadow=true; group.add(hb)
  group.position.set(x,y,z); group.rotation.y=rotY; scene.add(group); return group
}

function buildDesk(scene, [x,y,z], rotY, [sw,sd,sh], color) {
  const group = new THREE.Group(); group.name = 'furniture-group'
  const mat = new THREE.MeshStandardMaterial({ color, roughness:0.65, metalness:0.1 })
  const legMat = new THREE.MeshStandardMaterial({ color:0x888888, roughness:0.4, metalness:0.7 })
  // Top
  const top = new THREE.Mesh(new THREE.BoxGeometry(sw, sh*0.04, sd), mat)
  top.position.y = sh; top.castShadow=true; group.add(top)
  // Panel legs
  ;[-sw/2+sw*0.05, sw/2-sw*0.05].forEach(lx=>{
    const leg = new THREE.Mesh(new THREE.BoxGeometry(sw*0.04, sh, sd*0.04), legMat)
    leg.position.set(lx, sh/2, 0); leg.castShadow=true; group.add(leg)
  })
  // Drawer
  const draw = new THREE.Mesh(new THREE.BoxGeometry(sw*0.25, sh*0.35, sd*0.55), mat)
  draw.position.set(sw*0.34, sh*0.57, 0); draw.castShadow=true; group.add(draw)
  group.position.set(x,y,z); group.rotation.y=rotY; scene.add(group); return group
}

function buildShelf(scene, [x,y,z], rotY, [sw,sd,sh], color) {
  const group = new THREE.Group(); group.name = 'furniture-group'
  const mat = new THREE.MeshStandardMaterial({ color, roughness:0.75, metalness:0.05 })
  const shelfCount = Math.max(2, Math.round(sh/0.35))
  const sideThick = sw*0.05
  // Sides
  ;[-sw/2+sideThick/2, sw/2-sideThick/2].forEach(sx=>{
    const side = new THREE.Mesh(new THREE.BoxGeometry(sideThick, sh, sd), mat)
    side.position.set(sx, sh/2, 0); side.castShadow=true; group.add(side)
  })
  // Back
  const back = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd*0.04), mat)
  back.position.set(0, sh/2, -sd/2+sd*0.02); group.add(back)
  // Shelves
  for (let i=0; i<=shelfCount; i++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(sw-sideThick*2, sd*0.06, sd), mat)
    shelf.position.set(0, (sh/(shelfCount))*i, 0); shelf.castShadow=true; group.add(shelf)
  }
  group.position.set(x,y,z); group.rotation.y=rotY; scene.add(group); return group
}

function buildLamp(scene, [x,y,z], rotY, [sw,sd,sh], color) {
  const group = new THREE.Group(); group.name = 'furniture-group'
  const baseMat = new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.8, roughness:0.3 })
  const shadeMat = new THREE.MeshStandardMaterial({ color:0xfff9e6, roughness:0.5, transparent:true, opacity:0.85, side:THREE.DoubleSide })
  // Base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(sw*0.2, sw*0.25, sh*0.08, 16), baseMat)
  base.position.y = sh*0.04; base.castShadow=true; group.add(base)
  // Pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(sw*0.03, sw*0.03, sh*0.82, 10), baseMat)
  pole.position.y = sh*0.08+sh*0.41; pole.castShadow=true; group.add(pole)
  // Shade
  const shade = new THREE.Mesh(new THREE.ConeGeometry(sw*0.38, sh*0.26, 16, 1, true), shadeMat)
  shade.rotation.x = Math.PI; shade.position.y = sh*0.74; group.add(shade)
  // Light glow
  const light = new THREE.PointLight(0xfff5e0, 0.8, sh*3)
  light.position.y = sh*0.78; group.add(light)
  group.position.set(x,y,z); group.rotation.y=rotY; scene.add(group); return group
}

function buildBathtub(scene, [x,y,z], rotY, [sw,sd,sh], color) {
  const group = new THREE.Group(); group.name = 'furniture-group'
  const mat = new THREE.MeshStandardMaterial({ color:0xf0f0f0, roughness:0.15, metalness:0.2 })
  const innerMat = new THREE.MeshStandardMaterial({ color:0xe8f4fc, roughness:0.05, metalness:0.3, transparent:true, opacity:0.9 })
  // Outer
  const outer = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), mat)
  outer.position.y = sh/2; outer.castShadow=true; group.add(outer)
  // Inner (hollow)
  const inner = new THREE.Mesh(new THREE.BoxGeometry(sw*0.82, sh*0.6, sd*0.82), innerMat)
  inner.position.y = sh*0.8; group.add(inner)
  // Faucet
  const faucetMat = new THREE.MeshStandardMaterial({ color:0xcccccc, metalness:0.9, roughness:0.1 })
  const faucet = new THREE.Mesh(new THREE.CylinderGeometry(sw*0.025, sw*0.025, sh*0.4, 8), faucetMat)
  faucet.position.set(sw*0.38, sh*1.1, 0); group.add(faucet)
  group.position.set(x,y,z); group.rotation.y=rotY; scene.add(group); return group
}

function buildPlant(scene, [x,y,z], rotY, [sw,sd,sh], color) {
  const group = new THREE.Group(); group.name = 'furniture-group'
  const potMat = new THREE.MeshStandardMaterial({ color:0xc97d4e, roughness:0.85 })
  const leafMat = new THREE.MeshStandardMaterial({ color:0x2d7a3a, roughness:0.8 })
  const darkLeafMat = new THREE.MeshStandardMaterial({ color:0x1b5e2a, roughness:0.8 })
  const potH = sh*0.25
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(sw*0.35, sw*0.28, potH, 12), potMat)
  pot.position.y = potH/2; pot.castShadow=true; group.add(pot)
  // Trunk
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(sw*0.05, sw*0.06, sh*0.45, 8), new THREE.MeshStandardMaterial({color:0x5c3d2e,roughness:0.9}))
  trunk.position.y = potH + sh*0.22; trunk.castShadow=true; group.add(trunk)
  // Foliage spheres
  const foliagePositions = [[0,0,0],[sw*0.18,sh*0.08,0],[-sw*0.18,sh*0.08,0],[0,sh*0.08,sw*0.18],[0,sh*0.08,-sw*0.18],[0,sh*0.16,0]]
  foliagePositions.forEach(([fx,fy,fz],i)=>{
    const r = sw*(0.3+Math.random()*0.15)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r,10,8), i%2===0?leafMat:darkLeafMat)
    ball.position.set(fx, potH+sh*0.6+fy, fz); ball.castShadow=true; group.add(ball)
  })
  group.position.set(x,y,z); group.rotation.y=rotY; scene.add(group); return group
}

function buildTV(scene, [x,y,z], rotY, [sw,sd,sh], color) {
  const group = new THREE.Group(); group.name = 'furniture-group'
  const frameMat = new THREE.MeshStandardMaterial({ color:0x111111, roughness:0.2, metalness:0.5 })
  const screenMat = new THREE.MeshStandardMaterial({ color:0x111827, roughness:0.0, metalness:0.0, emissive:0x0d1f3c, emissiveIntensity:0.3 })
  const standMat = new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.7, roughness:0.3 })
  // TV body
  const body = new THREE.Mesh(new THREE.BoxGeometry(sw, sh*0.85, sd*0.08), frameMat)
  body.position.y = sh*0.9; body.castShadow=true; group.add(body)
  // Screen
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw*0.9, sh*0.75), screenMat)
  screen.position.set(0, sh*0.9, sd*0.045); group.add(screen)
  // Stand
  const stand = new THREE.Mesh(new THREE.BoxGeometry(sw*0.06, sh*0.35, sd*0.06), standMat)
  stand.position.set(0, sh*0.42, 0); stand.castShadow=true; group.add(stand)
  const base = new THREE.Mesh(new THREE.BoxGeometry(sw*0.35, sh*0.04, sd*0.3), standMat)
  base.position.set(0, sh*0.25, 0); base.castShadow=true; group.add(base)
  group.position.set(x,y,z); group.rotation.y=rotY; scene.add(group); return group
}

// ── Map category to builder ───────────────────────────────────
function getCategoryBuilder(category) {
  const map = {
    'Seating': 'chair', 'Living Room': 'sofa', 'Tables': 'table',
    'Bedroom': 'bed', 'Office': 'desk', 'Storage': 'shelf',
    'Lighting': 'lamp', 'Bathroom': 'bathtub', 'Decor': 'plant',
    'Kitchen': 'table'
  }
  return map[category] || null
}

// ── OBJ-like loader for uploaded models (basic parser) ────────
async function loadOBJFromText(text, scene, pos, rot, scale, color) {
  const lines = text.split('\n')
  const verts = [], faces = []
  lines.forEach(line=>{
    const p = line.trim().split(/\s+/)
    if(p[0]==='v') verts.push([parseFloat(p[1]),parseFloat(p[2]),parseFloat(p[3])])
    if(p[0]==='f') {
      const idx = p.slice(1).map(f=>parseInt(f.split('/')[0])-1)
      for(let i=1;i<idx.length-1;i++) faces.push([idx[0],idx[i],idx[i+1]])
    }
  })
  if(verts.length===0) return null

  const geo = new THREE.BufferGeometry()
  const positions = []
  faces.forEach(([a,b,c])=>{
    ;[a,b,c].forEach(i=>{ if(verts[i]) positions.push(...verts[i]) })
  })
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3))
  geo.computeVertexNormals()

  // Auto-scale to fit bounding box
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  const size = new THREE.Vector3(); bb.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z)
  const targetSize = Math.max(...scale)
  const s = targetSize / maxDim

  const mat = new THREE.MeshStandardMaterial({ color, roughness:0.7, metalness:0.05 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.scale.set(s,s,s)
  mesh.position.set(pos[0], pos[1]+scale[1]/2, pos[2])
  mesh.rotation.y = rot
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'furniture-group'
  scene.add(mesh)
  return mesh
}

// ── Coordinate conversion: 2D canvas → 3D world ──────────────
// 2D: origin at OX=100,OY=100 pixels, GRID_PX=40px/m
// 2D item.x,item.y = top-left corner of item in canvas world coords
// 3D: room centered at 0,0,0; width along X, depth along Z
const GRID_PX = 40
const CANVAS_OX = 100, CANVAS_OY = 100

function item2Dto3D(item, cfg) {
  const roomW = cfg.width  || 5
  const roomD = cfg.depth  || 4
  const fw = item.w / GRID_PX   // furniture width in meters
  const fd = item.d / GRID_PX   // furniture depth in meters
  // item.x,item.y = top-left in canvas world coords (pixels)
  // center of item in canvas world coords:
  const cx_px = item.x + item.w / 2
  const cy_px = item.y + item.d / 2
  // meters from canvas origin
  const cx_m = (cx_px - CANVAS_OX) / GRID_PX
  const cy_m = (cy_px - CANVAS_OY) / GRID_PX
  // 3D: x = cx_m - roomW/2, z = cy_m - roomD/2
  const x3 = cx_m - roomW / 2
  const z3 = cy_m - roomD / 2
  return { x: x3, z: z3, fw, fd }
}

// ── Build scene ───────────────────────────────────────────────
function buildScene(scene, cfg, furnitureItems, customModels) {
  // Remove old furniture + room meshes
  const toRemove = []
  scene.traverse(o => {
    if (o.isMesh && (o.name==='wall'||o.name==='floor'||o.name==='ceiling'||o.name==='skirt'||o.name==='furniture'||o.name==='furniture-group'))
      toRemove.push(o)
    if ((o.isGroup||o.isObject3D) && o.name==='furniture-group') toRemove.push(o)
  })
  toRemove.forEach(o=>{
    if(o.parent) o.parent.remove(o)
    if(o.geometry) o.geometry.dispose()
    const mats=Array.isArray(o.material)?o.material:(o.material?[o.material]:[])
    mats.forEach(m=>m&&m.dispose())
  })
  // Also remove groups
  const groups = []
  scene.children.forEach(c=>{ if(c.isGroup && c.name==='furniture-group') groups.push(c) })
  groups.forEach(g=>scene.remove(g))

  const {width=5,depth=4,height=2.8,wallColor='#F5F5F0',floorTexture='wood',shape='rectangle'} = cfg
  const rW = shape==='square'?Math.min(width,depth):width
  const rD = shape==='square'?Math.min(width,depth):depth

  // ── Materials ──
  const wallCol = new THREE.Color(wallColor)
  const wallMat = new THREE.MeshStandardMaterial({color:wallCol,roughness:0.88,metalness:0.01,side:THREE.FrontSide})
  const floorSpec = FLOOR_MAT[floorTexture] || FLOOR_MAT.wood

  // Procedural floor texture
  const floorCanvas = document.createElement('canvas')
  floorCanvas.width = 512; floorCanvas.height = 512
  const fc = floorCanvas.getContext('2d')
  const col = '#'+floorSpec.color.toString(16).padStart(6,'0')
  fc.fillStyle = col; fc.fillRect(0,0,512,512)
  if (floorTexture==='wood') {
    const plankH = 40
    fc.strokeStyle = 'rgba(80,45,10,0.15)'; fc.lineWidth = 1.5
    for(let y=0;y<512;y+=plankH){fc.beginPath();fc.moveTo(0,y);fc.lineTo(512,y);fc.stroke()}
    for(let y=0,r=0;y<512;y+=plankH,r++){const o=r%2===0?0:170;for(let x=o;x<512;x+=256){fc.beginPath();fc.moveTo(x,y);fc.lineTo(x,y+plankH);fc.stroke()}}
  } else if (floorTexture==='tile') {
    const tS=64; fc.strokeStyle='rgba(180,180,180,0.4)'; fc.lineWidth=2
    for(let x=0;x<512;x+=tS){fc.beginPath();fc.moveTo(x,0);fc.lineTo(x,512);fc.stroke()}
    for(let y=0;y<512;y+=tS){fc.beginPath();fc.moveTo(0,y);fc.lineTo(512,y);fc.stroke()}
  } else if (floorTexture==='marble') {
    fc.fillStyle='rgba(255,255,255,0.2)'; fc.fillRect(0,0,512,512)
    fc.strokeStyle='rgba(200,190,175,0.25)'; fc.lineWidth=1
    for(let i=0;i<8;i++){fc.beginPath();fc.moveTo(Math.random()*512,0);fc.quadraticCurveTo(Math.random()*512,Math.random()*512,Math.random()*512,512);fc.stroke()}
  }
  const floorTex = new THREE.CanvasTexture(floorCanvas)
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
  floorTex.repeat.set(rW*1.2, rD*1.2)
  const floorMat = new THREE.MeshStandardMaterial({map:floorTex,roughness:floorSpec.roughness,metalness:floorSpec.metalness,envMapIntensity:0.5})

  // Wall texture
  const wallCanvas = document.createElement('canvas')
  wallCanvas.width=256; wallCanvas.height=256
  const wc=wallCanvas.getContext('2d')
  wc.fillStyle=wallColor; wc.fillRect(0,0,256,256)
  // subtle noise for wall texture
  for(let i=0;i<2000;i++){const a=Math.random()*0.03;wc.fillStyle=`rgba(0,0,0,${a})`;wc.fillRect(Math.random()*256,Math.random()*256,2,2)}
  const wallTex = new THREE.CanvasTexture(wallCanvas)
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping
  const wallMatTex = new THREE.MeshStandardMaterial({map:wallTex,color:wallCol,roughness:0.88,metalness:0.01})

  const ceilMat = new THREE.MeshStandardMaterial({color:0xfafafa,roughness:1.0,metalness:0.0})
  const skirtMat = new THREE.MeshStandardMaterial({color:0xd4c5b0,roughness:0.9})

  const addBox=(w,h,d,x,y,z,mat,ry=0,name='wall')=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat)
    m.position.set(x,y,z); m.rotation.y=ry; m.name=name
    m.castShadow=true; m.receiveShadow=true; scene.add(m); return m
  }

  // ── Floor ──
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(rW,rD), floorMat)
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; floor.name='floor'; scene.add(floor)

  // ── Ceiling ──
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(rW,rD), ceilMat)
  ceil.rotation.x=Math.PI/2; ceil.position.y=height; ceil.receiveShadow=true; ceil.name='ceiling'; scene.add(ceil)

  const T=0.12, hh=height/2

  if(shape==='l-shape'){
    const seg1W=rW*0.6, seg2D=rD*0.45
    addBox(seg1W,height,T,-rW/2+seg1W/2,hh,-rD/2,wallMatTex,0,'wall')
    addBox(rW-seg1W,height,T,rW/2-(rW-seg1W)/2,hh,-rD/2+seg2D,wallMatTex,0,'wall')
    addBox(rW,height,T,0,hh,rD/2,wallMatTex,0,'wall')
    addBox(T,height,rD,-rW/2,hh,0,wallMatTex,0,'wall')
    addBox(T,height,seg2D,rW/2,hh,rD/2-seg2D/2,wallMatTex,0,'wall')
    addBox(T,height,rD-seg2D,seg1W-rW/2,hh,-rD/2+(rD-seg2D)/2,wallMatTex,0,'wall')
  } else {
    addBox(rW,height,T, 0,hh,-rD/2, wallMatTex,0,'wall')
    addBox(rW,height,T, 0,hh, rD/2, wallMatTex,0,'wall')
    addBox(T,height,rD, -rW/2,hh,0, wallMatTex,0,'wall')
    addBox(T,height,rD,  rW/2,hh,0, wallMatTex,0,'wall')
  }

  // Skirting boards
  addBox(rW,0.09,T*1.8,0,0.045,-rD/2+T,skirtMat,0,'skirt')
  addBox(rW,0.09,T*1.8,0,0.045, rD/2-T,skirtMat,0,'skirt')
  addBox(T*1.8,0.09,rD,-rW/2+T,0.045,0,skirtMat,0,'skirt')
  addBox(T*1.8,0.09,rD, rW/2-T,0.045,0,skirtMat,0,'skirt')

  // ── Furniture ──
  furnitureItems.forEach(item=>{
    const { x: fx, z: fz, fw, fd } = item2Dto3D(item, cfg)
    const fh = Math.max(0.3, Math.min(fw, fd) * 0.9)
    const rotY = -((item.rotation||0) * Math.PI) / 180
    const col = FURN_COLOR[item.category] || 0x93b4fd

    // Check for custom model
    const customKey = item.customModelKey
    if (customKey && customModels[customKey]) {
      // Already loaded/shown via separate mechanism
      return
    }

    // Use category builder
    const builderKey = getCategoryBuilder(item.category)
    if (builderKey && BUILTIN_MODELS[builderKey]) {
      BUILTIN_MODELS[builderKey](scene, [fx,0,fz], rotY, [fw,fh,fd], col)
    } else {
      // Fallback box
      const mat = new THREE.MeshStandardMaterial({color:col,roughness:0.7,metalness:0.05})
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(fw,fh,fd), mat)
      mesh.position.set(fx,fh/2,fz); mesh.rotation.y=rotY
      mesh.castShadow=true; mesh.receiveShadow=true; mesh.name='furniture-group'
      scene.add(mesh)
    }
  })
}

// ── Main component ─────────────────────────────────────────────
export default function Workspace3D() {
  const {id}=useParams(); const navigate=useNavigate()
  const mountRef=useRef(null)

  const [project,setProject]=useState(null)
  const [cfg,setCfg]=useState({shape:'rectangle',width:5,depth:4,height:2.8,wallColor:'#F5F5F0',floorTexture:'wood'})
  const [items,setItems]=useState([])
  const [showWalls,setShowWalls]=useState(true)
  const [showCeil,setShowCeil]=useState(false)
  const [ambient,setAmbient]=useState(0.65)
  const [sunAngle,setSunAngle]=useState(45)
  const [sunHeight,setSunHeight]=useState(75)
  const [sunIntensity,setSunIntensity]=useState(1.8)
  const [skyColor,setSkyColor]=useState('#c8dff0')
  const [panelOpen,setPanelOpen]=useState(true)
  const [activeTab,setActiveTab]=useState('lighting') // 'lighting'|'models'
  const [saving,setSaving]=useState(false)
  const [ready,setReady]=useState(false)
  const [customModels,setCustomModels]=useState({}) // key: name, val: OBJ text
  const [customModelItems,setCustomModelItems]=useState([]) // placed custom models
  const [selectedFurnId,setSelectedFurnId]=useState(null)

  const [loadingProject, setLoadingProject] = useState(true)

  const sceneRef=useRef(null); const rendererRef=useRef(null); const cameraRef=useRef(null)
  const rafRef=useRef(null)
  const orbit=useRef({theta:0.6,phi:0.55,radius:10,panX:0,panY:1.4,dragging:false,lx:0,ly:0,btn:-1})
  const stateRef=useRef({cfg,items,customModels})

  useEffect(()=>{stateRef.current={cfg,items,customModels}},[cfg,items,customModels])

  // ── Load ──
  useEffect(()=>{
    setLoadingProject(true)
    projectsApi.getById(id).then(p=>{
      setProject(p)
      try{setCfg(JSON.parse(p.roomConfig))}catch{}
      try{const it=JSON.parse(p.furnitureLayout);setItems(Array.isArray(it)?it:[])}catch{}
    }).catch(()=>{
      toast.error('Failed to load project')
      navigate('/projects')
    }).finally(()=>setLoadingProject(false))
  },[id])

  // ── Init Three.js (runs once mount div is visible, i.e. after project loads) ──
  useEffect(()=>{
    if(loadingProject) return  // mount div not rendered yet
    if(!mountRef.current) return
    const el=mountRef.current
    const W=el.clientWidth||800, H=el.clientHeight||600

    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2.5))
    renderer.setSize(W,H)
    renderer.shadowMap.enabled=true
    renderer.shadowMap.type=THREE.PCFSoftShadowMap
    renderer.toneMapping=THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure=1.15
    renderer.outputColorSpace=THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    rendererRef.current=renderer

    const scene=new THREE.Scene()
    scene.background=new THREE.Color(skyColor)
    scene.fog=new THREE.FogExp2(0xc8dff0,0.025)
    sceneRef.current=scene

    const camera=new THREE.PerspectiveCamera(50,W/H,0.05,200)
    camera.position.set(8,5,10)
    cameraRef.current=camera

    // ── Lighting ──
    const amb=new THREE.AmbientLight(0xfff8f0,ambient); amb.name='ambient'; scene.add(amb)

    const sun=new THREE.DirectionalLight(0xfff6e0,sunIntensity); sun.name='sun'
    sun.position.set(8,10,6); sun.castShadow=true
    sun.shadow.mapSize.set(4096,4096)
    sun.shadow.camera.near=0.5; sun.shadow.camera.far=60
    sun.shadow.camera.left=-20; sun.shadow.camera.right=20
    sun.shadow.camera.top=20; sun.shadow.camera.bottom=-20
    sun.shadow.bias=-0.0005; sun.shadow.normalBias=0.05
    scene.add(sun)

    // Fill lights
    const fill1=new THREE.DirectionalLight(0xddeeff,0.45); fill1.position.set(-6,4,-5); scene.add(fill1)
    const fill2=new THREE.DirectionalLight(0xffeedd,0.3); fill2.position.set(0,-2,0); scene.add(fill2)

    // Hemisphere (sky/ground) light for realistic bounce
    const hemi=new THREE.HemisphereLight(0xcce8f5,0xc8a46e,0.6); hemi.name='hemi'; scene.add(hemi)

    // Room light
    const roomLight=new THREE.PointLight(0xfff9e6,0.4,12,2); roomLight.position.set(0,2.2,0); scene.add(roomLight)

    // Animate
    const animate=()=>{
      rafRef.current=requestAnimationFrame(animate)
      const o=orbit.current
      const x=o.panX+o.radius*Math.sin(o.phi)*Math.sin(o.theta)
      const y=o.panY+o.radius*Math.cos(o.phi)
      const z=o.radius*Math.sin(o.phi)*Math.cos(o.theta)
      camera.position.set(x,y,z)
      camera.lookAt(o.panX,Math.max(0,o.panY-1.2),0)
      renderer.render(scene,camera)
    }
    animate()
    setReady(true)

    const onResize=()=>{
      if(!el)return
      const W2=el.clientWidth,H2=el.clientHeight
      renderer.setSize(W2,H2); camera.aspect=W2/H2; camera.updateProjectionMatrix()
    }
    window.addEventListener('resize',onResize)

    return()=>{
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize',onResize)
      renderer.dispose()
      if(el.contains(renderer.domElement))el.removeChild(renderer.domElement)
    }
  },[loadingProject]) // eslint-disable-line

  // ── Rebuild scene ──
  useEffect(()=>{
    if(!sceneRef.current||!ready)return
    buildScene(sceneRef.current,cfg,items,customModels)
  },[cfg,items,ready,customModels])

  // ── Wall/ceiling visibility ──
  useEffect(()=>{
    if(!sceneRef.current)return
    sceneRef.current.traverse(o=>{
      if(!o.isMesh)return
      if(o.name==='wall'||o.name==='skirt')o.visible=showWalls
      if(o.name==='ceiling')o.visible=showCeil
    })
  },[showWalls,showCeil])

  // ── Sync lights ──
  useEffect(()=>{
    if(!sceneRef.current)return
    sceneRef.current.traverse(o=>{
      if(o.name==='ambient')o.intensity=ambient
      if(o.name==='sun'){
        const a=(sunAngle*Math.PI)/180
        const h=(sunHeight*Math.PI)/180
        o.position.set(Math.cos(a)*12*Math.cos(h),12*Math.sin(h),Math.sin(a)*12*Math.cos(h))
        o.intensity=sunIntensity
      }
      if(o.name==='hemi')o.intensity=ambient*0.9
    })
  },[ambient,sunAngle,sunHeight,sunIntensity])

  // ── Sync sky ──
  useEffect(()=>{
    if(!sceneRef.current)return
    const col=new THREE.Color(skyColor)
    sceneRef.current.background=col
    if(sceneRef.current.fog)sceneRef.current.fog.color=col
  },[skyColor])

  // ── Orbit controls ──
  const onMouseDown=useCallback(e=>{
    orbit.current.dragging=true; orbit.current.lx=e.clientX; orbit.current.ly=e.clientY; orbit.current.btn=e.button
  },[])
  const onMouseMove=useCallback(e=>{
    if(!orbit.current.dragging)return
    const dx=e.clientX-orbit.current.lx, dy=e.clientY-orbit.current.ly
    orbit.current.lx=e.clientX; orbit.current.ly=e.clientY
    if(orbit.current.btn===0){
      orbit.current.theta-=dx*0.005
      orbit.current.phi=Math.max(0.04,Math.min(Math.PI/2.02,orbit.current.phi+dy*0.005))
    } else if(orbit.current.btn===2){
      const s=orbit.current.radius*0.001
      orbit.current.panX-=dx*s*2
      orbit.current.panY+=dy*s*1.5
    }
  },[])
  const onMouseUp=useCallback(()=>{orbit.current.dragging=false},[])
  const onWheel=useCallback(e=>{
    orbit.current.radius=Math.max(1.5,Math.min(25,orbit.current.radius+e.deltaY*0.01))
  },[])

  const lastTouch=useRef(null)
  const lastPinchDist=useRef(null)
  const onTouchStart=e=>{
    if(e.touches.length===1)lastTouch.current={x:e.touches[0].clientX,y:e.touches[0].clientY}
    if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;lastPinchDist.current=Math.sqrt(dx*dx+dy*dy)}
  }
  const onTouchMove=e=>{
    if(e.touches.length===1&&lastTouch.current){
      const dx=e.touches[0].clientX-lastTouch.current.x,dy=e.touches[0].clientY-lastTouch.current.y
      orbit.current.theta-=dx*0.005; orbit.current.phi=Math.max(0.04,Math.min(Math.PI/2.02,orbit.current.phi+dy*0.005))
      lastTouch.current={x:e.touches[0].clientX,y:e.touches[0].clientY}
    }
    if(e.touches.length===2&&lastPinchDist.current){
      const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY
      const dist=Math.sqrt(dx*dx+dy*dy), scale=lastPinchDist.current/dist
      orbit.current.radius=Math.max(1.5,Math.min(25,orbit.current.radius*scale))
      lastPinchDist.current=dist
    }
  }

  const resetCamera=()=>{
    orbit.current={...orbit.current,theta:0.6,phi:0.55,radius:10,panX:0,panY:1.4,dragging:false}
  }

  // ── Upload OBJ ──
  const handleOBJUpload=async(e)=>{
    const file=e.target.files[0]; if(!file) return
    if(!file.name.toLowerCase().endsWith('.obj')){toast.error('Please upload a .OBJ file');return}
    const text=await file.text()
    const name=file.name.replace('.obj','').replace('.OBJ','')
    setCustomModels(prev=>({...prev,[name]:text}))
    toast.success(`Model "${name}" loaded! Place it from the Models panel.`)
  }

  const placeCustomModel=(modelKey)=>{
    if(!sceneRef.current||!customModels[modelKey]){toast.error('Model not found');return}
    const {cfg:c}=stateRef.current
    const pos=[0,0,0]
    const color=0x93b4fd
    loadOBJFromText(customModels[modelKey], sceneRef.current, pos, 0, [1,1,1], color)
      .then(()=>{toast.success(`"${modelKey}" placed in scene!`)})
      .catch(()=>toast.error('Failed to load OBJ model'))
  }

  const save=async()=>{
    setSaving(true)
    try{await projectsApi.update(id,{roomConfig:JSON.stringify(cfg)});toast.success('Saved!')}
    catch{toast.error('Save failed')}finally{setSaving(false)}
  }

  // Sun presets
  const sunPresets=[
    {name:'Dawn',angle:90,height:10,sky:'#ffd5a8',amb:0.35,int:1.2},
    {name:'Morning',angle:120,height:35,sky:'#ffe4c4',amb:0.55,int:1.5},
    {name:'Noon',angle:180,height:80,sky:'#c8e8ff',amb:0.75,int:2.0},
    {name:'Afternoon',angle:240,height:45,sky:'#ffeac8',amb:0.6,int:1.7},
    {name:'Sunset',angle:290,height:8,sky:'#ff8c5a',amb:0.3,int:1.1},
    {name:'Night',angle:0,height:30,sky:'#0a0f1e',amb:0.15,int:0.2},
  ]

  if (loadingProject) return (
    <div className="h-screen flex items-center justify-center bg-surface-950 flex-col gap-4">
      <div className="w-10 h-10 border-4 border-surface-700 border-t-brand-500 rounded-full animate-spin"/>
      <p className="text-surface-400 text-sm font-medium">Loading 3D workspace…</p>
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-surface-950 overflow-hidden">
      {/* Toolbar */}
      <div className="h-14 bg-surface-950 border-b border-surface-800 flex items-center px-4 gap-3 flex-shrink-0 z-20">
        <button onClick={()=>navigate(`/workspace/2d/${id}`)} className="text-surface-400 hover:text-white flex items-center gap-1.5 text-sm transition-colors">
          <ChevronLeft className="w-4 h-4"/>2D Editor
        </button>
        <div className="h-5 w-px bg-surface-700"/>
        <span className="text-white font-semibold text-sm truncate max-w-[140px]">{project?.name||'…'}</span>
        <span className="badge bg-brand-900 text-brand-300 text-xs">3D</span>
        <div className="flex-1"/>
        <p className="text-surface-500 text-xs hidden md:block">Left drag: orbit · Right drag: pan · Scroll: zoom</p>
        <button onClick={resetCamera} className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 transition-colors" title="Reset Camera">
          <RotateCcw className="w-4 h-4"/>
        </button>
        <button onClick={()=>setShowWalls(!showWalls)} title={showWalls?'Hide Walls':'Show Walls'}
          className={`p-2 rounded-lg transition-colors ${showWalls?'text-surface-400 hover:text-white hover:bg-surface-800':'text-brand-400 bg-brand-900/40'}`}>
          {showWalls?<Eye className="w-4 h-4"/>:<EyeOff className="w-4 h-4"/>}
        </button>
        <button onClick={()=>setPanelOpen(!panelOpen)} className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 transition-colors">
          <Settings className="w-4 h-4"/>
        </button>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
          {saving?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Save className="w-4 h-4"/>}
          Save
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 3D Canvas */}
        <div ref={mountRef} className="flex-1 relative" style={{cursor:'grab'}}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onWheel={onWheel} onContextMenu={e=>e.preventDefault()}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}>

          {/* Info */}
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur text-white text-xs px-3 py-2 rounded-xl font-mono pointer-events-none space-y-0.5">
            <div>{cfg.width}m × {cfg.depth}m × {cfg.height}m</div>
            <div>{items.length} furniture items</div>
          </div>

          {/* Sun presets */}
          <div className="absolute top-4 left-4 flex gap-1.5">
            {sunPresets.map(p=>(
              <button key={p.name} onClick={()=>{setSunAngle(p.angle);setSunHeight(p.height);setSkyColor(p.sky);setAmbient(p.amb);setSunIntensity(p.int)}}
                className="bg-black/50 backdrop-blur text-white text-xs px-2 py-1 rounded-lg hover:bg-black/70 transition-colors">
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right panel */}
        {panelOpen&&(
          <div className="w-72 bg-surface-950 border-l border-surface-800 flex flex-col overflow-hidden flex-shrink-0">
            {/* Tabs */}
            <div className="flex border-b border-surface-800">
              {[['lighting','💡 Lighting'],['models','📦 Models'],['room','🏠 Room']].map(([t,label])=>(
                <button key={t} onClick={()=>setActiveTab(t)}
                  className={`flex-1 py-3 text-xs font-medium transition-colors ${activeTab===t?'text-white border-b-2 border-brand-500':'text-surface-500 hover:text-surface-300'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">

              {activeTab==='lighting'&&(
                <>
                  {/* Visibility */}
                  <div>
                    <p className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-3">Visibility</p>
                    {[['Walls',showWalls,setShowWalls],['Ceiling',showCeil,setShowCeil]].map(([label,val,setter])=>(
                      <label key={label} className="flex items-center justify-between mb-2 cursor-pointer">
                        <span className="text-sm text-surface-300">{label}</span>
                        <div onClick={()=>setter(!val)} className={`w-10 h-5 rounded-full relative transition-colors ${val?'bg-brand-600':'bg-surface-700'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${val?'left-5':'left-0.5'}`}/>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Sun presets */}
                  <div>
                    <p className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-3">Time of Day</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {sunPresets.map(p=>(
                        <button key={p.name} onClick={()=>{setSunAngle(p.angle);setSunHeight(p.height);setSkyColor(p.sky);setAmbient(p.amb);setSunIntensity(p.int)}}
                          className="text-xs py-1.5 px-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 transition-colors">
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lighting sliders */}
                  <div>
                    <p className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5"/>Lighting
                    </p>
                    <div className="space-y-3">
                      {[['Ambient',ambient,setAmbient,0,1.5,0.05],['Sun Intensity',sunIntensity,setSunIntensity,0,3,0.05],['Sun Angle',sunAngle,setSunAngle,0,360,5],['Sun Height',sunHeight,setSunHeight,0,90,5]].map(([label,val,setter,min,max,step])=>(
                        <div key={label}>
                          <div className="flex justify-between text-xs text-surface-400 mb-1">
                            <span>{label}</span><span className="font-mono">{typeof val==='number'?val.toFixed(val<2?2:0):val}</span>
                          </div>
                          <input type="range" min={min} max={max} step={step} value={val} onChange={e=>setter(+e.target.value)} className="w-full accent-brand-500 cursor-pointer"/>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sky */}
                  <div>
                    <p className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-3">Environment</p>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={skyColor} onChange={e=>setSkyColor(e.target.value)} className="w-10 h-8 rounded-lg border border-surface-700 cursor-pointer p-0.5 bg-surface-800"/>
                      <span className="text-xs text-surface-400">Sky Color</span>
                      <span className="text-xs text-surface-500 font-mono ml-auto">{skyColor}</span>
                    </div>
                  </div>
                </>
              )}

              {activeTab==='models'&&(
                <>
                  <div>
                    <p className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-3">Built-in 3D Models</p>
                    <p className="text-surface-500 text-xs mb-3">Furniture is auto-rendered as detailed 3D models based on type. Add items in the 2D editor and they appear here.</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries({
                        '🪑 Chair':'Seating','🛋️ Sofa':'Living Room','🪵 Table':'Tables',
                        '🛏️ Bed':'Bedroom','💼 Desk':'Office','🗄️ Shelf':'Storage',
                        '💡 Lamp':'Lighting','🚿 Bathtub':'Bathroom','🪴 Plant':'Decor','📺 TV':'Kitchen'
                      }).map(([label])=>(
                        <div key={label} className="bg-surface-800 rounded-lg px-2 py-1.5 text-xs text-surface-300">{label}</div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-surface-800 pt-4">
                    <p className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-2">Import OBJ Model</p>
                    <p className="text-surface-500 text-xs mb-3">Upload your own .OBJ files to use as custom 3D furniture in your design.</p>
                    <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-surface-700 rounded-xl cursor-pointer hover:border-brand-500 transition-colors group">
                      <Upload className="w-6 h-6 text-surface-500 group-hover:text-brand-400 transition-colors"/>
                      <span className="text-xs text-surface-500 group-hover:text-surface-300 transition-colors text-center">
                        Click to upload .OBJ file<br/>
                        <span className="text-surface-600">Max 10MB</span>
                      </span>
                      <input type="file" accept=".obj,.OBJ" className="hidden" onChange={handleOBJUpload}/>
                    </label>
                  </div>

                  {Object.keys(customModels).length>0&&(
                    <div>
                      <p className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-2">Your Models</p>
                      <div className="space-y-1.5">
                        {Object.keys(customModels).map(name=>(
                          <div key={name} className="flex items-center gap-2 bg-surface-800 rounded-lg p-2">
                            <Package className="w-4 h-4 text-brand-400 flex-shrink-0"/>
                            <span className="text-xs text-surface-300 flex-1 truncate">{name}</span>
                            <button onClick={()=>placeCustomModel(name)} className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-2 py-1 rounded-lg transition-colors">Place</button>
                            <button onClick={()=>setCustomModels(p=>{const n={...p};delete n[name];return n})} className="text-surface-500 hover:text-red-400 transition-colors">
                              <X className="w-3.5 h-3.5"/>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-surface-900 rounded-xl p-3 text-xs text-surface-500">
                    <p className="text-surface-400 font-medium mb-1.5 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/>Tips for OBJ models</p>
                    <p>• Export with meters as units</p>
                    <p>• Keep poly count under 50k for best performance</p>
                    <p>• OBJ files without MTL will use category color</p>
                    <p>• Free models: sketchfab.com, free3d.com</p>
                  </div>
                </>
              )}

              {activeTab==='room'&&(
                <>
                  <div>
                    <p className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-3">Room Info</p>
                    <div className="space-y-2">
                      {[['Shape',cfg.shape],['Width',`${cfg.width}m`],['Depth',`${cfg.depth}m`],['Height',`${cfg.height}m`],['Floor',cfg.floorTexture],['Items',items.length]].map(([k,v])=>(
                        <div key={k} className="flex justify-between text-xs">
                          <span className="text-surface-500">{k}</span>
                          <span className="text-surface-300 capitalize font-mono">{v}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-surface-500">Wall Color</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded border border-surface-600" style={{background:cfg.wallColor}}/>
                          <span className="text-surface-300 font-mono">{cfg.wallColor}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-900 rounded-xl p-3 text-xs text-surface-500 space-y-1">
                    <p className="text-surface-400 font-medium mb-1.5">Controls</p>
                    <p>🖱 Left drag — Orbit around room</p>
                    <p>🖱 Right drag — Pan camera</p>
                    <p>🖱 Scroll — Zoom in/out</p>
                    <p>📱 1-finger — Orbit</p>
                    <p>📱 2-finger pinch — Zoom</p>
                    <p>⌨ Edit furniture in 2D view</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
