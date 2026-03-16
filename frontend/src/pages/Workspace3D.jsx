import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi } from '../store/authStore'
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

function makeRoomShape(T, dims) {
  const { W, D, shape, cw, cd } = dims
  const s = new T.Shape()
  if (shape === 'l-shape') { s.moveTo(0, 0); s.lineTo(W, 0); s.lineTo(W, cd); s.lineTo(cw, cd); s.lineTo(cw, D); s.lineTo(0, D); s.closePath() }
  else { s.moveTo(0, 0); s.lineTo(W, 0); s.lineTo(W, D); s.lineTo(0, D); s.closePath() }
  return s
}

function buildRoom(T, cfg, opts = {}) {
  const { wallMode = 'solid', showCeiling = false, showShadows = true, showGrid = false } = opts
  const dims = roomDims(cfg)
  const { W, D, H } = dims
  const group = new T.Group(); group.name = 'room'

  const floorGeo = new T.ShapeGeometry(makeRoomShape(T, dims))
  floorGeo.rotateX(-Math.PI / 2)
  const ft = cfg.floorTexture || 'wood'
  const floorMat = new T.MeshStandardMaterial({
    color: ft === 'wood' ? 0xb8865a : ft === 'carpet' ? 0x7a6a88 : ft === 'tile' ? 0xd8d8d8 : ft === 'marble' ? 0xe8e4de : 0xaaaaaa,
    roughness: ft === 'marble' ? 0.05 : ft === 'tile' ? 0.25 : 0.85, metalness: ft === 'marble' ? 0.1 : 0,
  })
  const floor = new T.Mesh(floorGeo, floorMat); floor.receiveShadow = true; floor.name = 'floor'
  group.add(floor)

  if (showGrid) {
    const gh = new T.GridHelper(Math.max(W, D) * 1.5, 24, 0x555577, 0x333355)
    gh.position.set(W / 2, 0.003, D / 2); gh.name = 'floorGrid'; group.add(gh)
  }

  if (showCeiling) {
    const ceilGeo = new T.ShapeGeometry(makeRoomShape(T, dims))
    ceilGeo.rotateX(Math.PI / 2)
    const ceilMat = new T.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.95, side: T.BackSide })
    const ceil = new T.Mesh(ceilGeo, ceilMat); ceil.position.y = H; ceil.name = 'ceiling'; group.add(ceil)
  }

  const wThick = 0.12
  const opacity = wallMode === 'solid' ? 1 : wallMode === 'transparent' ? 0.3 : wallMode === 'glass' ? 0.1 : 0
  const wallColor = wallMode === 'glass' ? new T.Color(0.55, 0.78, 1) : hex2color(T, cfg.wallColor || '#F5F5F0')
  const wallMat = new T.MeshStandardMaterial({
    color: wallColor, roughness: wallMode === 'glass' ? 0.05 : 0.82, metalness: wallMode === 'glass' ? 0.15 : 0,
    transparent: wallMode !== 'solid', opacity, side: T.DoubleSide,
  })

  wallSegments(dims).forEach((seg, idx) => {
    const dx = seg.x2 - seg.x1, dz = seg.z2 - seg.z1
    const len = Math.sqrt(dx * dx + dz * dz); if (len < 0.001) return
    const geo = new T.BoxGeometry(len, H, wThick)
    const mesh = new T.Mesh(geo, wallMat.clone())
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

function buildFurnitureMesh(T, item) {
  const group = new T.Group(); group.userData.itemId = item.id
  const wM = item.widthM || (item.w / GRID2D)
  const dM = item.depthM || (item.d / GRID2D)
  const hM = item.heightM || 0.8
  const col = hex2color(T, item.color || CAT_COLOR[item.category] || '#93b4fd')
  const base = new T.MeshStandardMaterial({ color: col, roughness: 0.65, metalness: 0.05 })
  const dark = base.clone(); dark.color = col.clone().multiplyScalar(0.65)
  const white = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
  const metal = new T.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.8 })

  const box = (w, h, d, x, y, z, mat) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat || base); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m) }
  const cyl = (rt, rb, h, x, y, z, seg, mat) => { const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 16), mat || base); m.position.set(x, y, z); m.castShadow = true; group.add(m) }
  const sph = (r, x, y, z, mat) => { const m = new T.Mesh(new T.SphereGeometry(r, 12, 10), mat || base); m.position.set(x, y, z); m.castShadow = true; group.add(m) }
  const legs = (fw, fd, lh, lr) => { const lm = dark.clone(); [[-fw / 2 + lr, lh / 2, -fd / 2 + lr], [-fw / 2 + lr, lh / 2, fd / 2 - lr], [fw / 2 - lr, lh / 2, -fd / 2 + lr], [fw / 2 - lr, lh / 2, fd / 2 - lr]].forEach(([lx, ly, lz]) => box(lr * 2, lh, lr * 2, lx, ly, lz, lm)) }

  switch (item.category) {
    case 'Seating': { const sh = hM * 0.44, sw = wM, sd = dM * 0.6; box(sw, sh, sd, 0, sh / 2, -dM * 0.05); box(sw, hM - sh, 0.07, 0, sh + (hM - sh) / 2, -sd / 2 + 0.035, dark); legs(sw, sd, sh, 0.055); break }
    case 'Tables': { const tt = 0.07, lh = hM - tt; box(wM, tt, dM, 0, hM - tt / 2, 0); legs(wM, dM, lh, 0.05); break }
    case 'Bedroom':
      box(wM, hM * 0.45, dM, 0, hM * 0.225, 0); box(wM, hM * 0.7, 0.08, 0, hM * 0.35, -dM / 2 + 0.04, dark)
      box(wM * 0.38, hM * 0.1, dM * 0.22, -wM * 0.22, hM * 0.45 + hM * 0.05, -dM * 0.22, white)
      box(wM * 0.38, hM * 0.1, dM * 0.22, wM * 0.22, hM * 0.45 + hM * 0.05, -dM * 0.22, white); break
    case 'Storage':
      box(wM, hM, dM, 0, hM / 2, 0); box(0.04, 0.04, 0.04, -wM * 0.15, hM * 0.5, dM / 2 + 0.022, metal); box(0.04, 0.04, 0.04, wM * 0.15, hM * 0.5, dM / 2 + 0.022, metal); break
    case 'Office': {
      box(wM, 0.04, dM, 0, hM, 0); legs(wM, dM, hM, 0.06)
      const scrM = new T.MeshStandardMaterial({ color: 0x111122, roughness: 0.1, metalness: 0.3 })
      const glwM = new T.MeshStandardMaterial({ color: 0x2244cc, roughness: 0.3, emissive: new T.Color(0, 0.05, 0.35), emissiveIntensity: 0.5 })
      box(wM * 0.5, 0.3, 0.04, 0, hM + 0.18, -dM * 0.28, scrM); box(wM * 0.46, 0.26, 0.01, 0, hM + 0.18, -dM * 0.28 + 0.025, glwM); break
    }
    case 'Lighting': {
      const polM = new T.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.2, metalness: 0.85 })
      const shdM = new T.MeshStandardMaterial({ color: 0xfff3cd, roughness: 0.6, transparent: true, opacity: 0.82, emissive: new T.Color(0.3, 0.22, 0.08), emissiveIntensity: 0.5 })
      cyl(0.02, 0.02, hM * 0.88, 0, hM * 0.44, 0, 8, polM); cyl(0.16, 0.24, 0.26, 0, hM, 0, 16, shdM); break
    }
    case 'Bathroom':
      box(wM, hM * 0.3, dM, 0, hM * 0.15, 0)
      box(wM - 0.08, hM * 0.28, dM - 0.08, 0, hM * 0.31, 0, new T.MeshStandardMaterial({ color: 0xcef3fb, roughness: 0.08, metalness: 0.05 })); break
    case 'Kitchen':
      box(wM, hM * 0.88, dM, 0, hM * 0.44, 0)
      box(wM + 0.02, 0.04, dM * 0.7, 0, hM * 0.88 + 0.02, -dM * 0.06, new T.MeshStandardMaterial({ color: 0x999999, roughness: 0.25, metalness: 0.55 })); break
    case 'Living Room':
      if (hM <= 0.05) { base.roughness = 1; box(wM, 0.02, dM, 0, 0.01, 0) }
      else {
        const scrM = new T.MeshStandardMaterial({ color: 0x080818, roughness: 0.05, metalness: 0.4 })
        const glwM = new T.MeshStandardMaterial({ color: 0x0a0a1a, roughness: 0.05, emissive: new T.Color(0.02, 0.02, 0.05) })
        box(wM, hM, dM, 0, hM / 2, 0, scrM); box(wM - 0.04, hM - 0.06, 0.01, 0, hM / 2, dM / 2 + 0.005, glwM)
      }
      break
    case 'Decor': {
      const potM = new T.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.88 })
      const leafM = new T.MeshStandardMaterial({ color: 0x2a7a35, roughness: 0.95 })
      cyl(wM * 0.25, wM * 0.32, hM * 0.42, 0, hM * 0.21, 0, 12, potM); sph(Math.min(wM, dM) * 0.42, 0, hM * 0.76, 0, leafM); break
    }
    default: box(wM, hM, dM, 0, hM / 2, 0)
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
    const res = new Float32Array(binChunk, byteOffset, count * sz)
    return res
  }
  const getIdx = idx => {
    const acc = gltf.accessors[idx]
    const bv = gltf.bufferViews[acc.bufferView]
    const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0)
    const count = acc.count || 0
    return acc.componentType === 5125 ? new Uint32Array(binChunk, byteOffset, count) : new Uint16Array(binChunk, byteOffset, count)
  }

  const group = new T.Group()
  for (const mesh of (gltf.meshes || [])) {
    for (const prim of (mesh.primitives || [])) {
      const geo = new T.BufferGeometry(); const at = prim.attributes || {}
      if (at.POSITION != null) geo.setAttribute('position', new T.Float32BufferAttribute(getAcc(at.POSITION), 3))
      if (at.NORMAL != null) geo.setAttribute('normal', new T.Float32BufferAttribute(getAcc(at.NORMAL), 3))
      if (at.TEXCOORD_0 != null) geo.setAttribute('uv', new T.Float32BufferAttribute(getAcc(at.TEXCOORD_0), 2))
      if (prim.indices != null) geo.setIndex(new T.BufferAttribute(getIdx(prim.indices), 1))
      if (!geo.getAttribute('normal')) geo.computeVertexNormals()
      const m = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.6 }))
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
  const sz = new T.Vector3(); box3.getSize(sz)
  if (sz.x > 0 && sz.y > 0 && sz.z > 0) group.scale.set(wM / sz.x, hM / sz.y, dM / sz.z)
}

function itemTo3D(item) {
  const wM = item.widthM || (item.w / GRID2D)
  const dM = item.depthM || (item.d / GRID2D)
  return {
    x: (item.x - OX2D) / GRID2D + wM / 2,
    z: (item.y - OY2D) / GRID2D + dM / 2,
    ry: -(item.rotation || 0) * Math.PI / 180,
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
  const TRef      = useRef(null)
  const orbitRef  = useRef({ theta: 0.7, phi: 0.62, radius: 8, tx: 2.5, ty: 1.4, tz: 2 })
  const ptrRef    = useRef({ down: false, moved: false, x: 0, y: 0, button: 0 })
  const dragFurnRef = useRef(null) 

  const [loading,     setLoading]     = useState(true)
  const [project,     setProject]     = useState(null)
  const [cfg,         setCfg]         = useState({})
  const [items,       setItems]       = useState([])
  const [overlays,    setOverlays]    = useState({ doors: [], windows: [], curtains: [] })
  const [dirty,       setDirty]       = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [selectedId,  setSelectedId]  = useState(null)
  const [wallMode,    setWallMode]    = useState('solid')
  const [showCeiling, setShowCeiling] = useState(false)
  const [showShadows, setShowShadows] = useState(true)
  const [showGrid,    setShowGrid]    = useState(false)
  const [ambientInt,  setAmbientInt]  = useState(0.6)
  const [sunInt,      setSunInt]      = useState(1.1)

  const cfgRef      = useRef(cfg);         useEffect(() => { cfgRef.current = cfg }, [cfg])
  const itemsRef    = useRef(items);       useEffect(() => { itemsRef.current = items }, [items])
  const wallModeRef = useRef(wallMode);    useEffect(() => { wallModeRef.current = wallMode }, [wallMode])
  const ceilRef     = useRef(showCeiling); useEffect(() => { ceilRef.current = showCeiling }, [showCeiling])
  const shadowRef   = useRef(showShadows); useEffect(() => { shadowRef.current = showShadows }, [showShadows])
  const gridRef     = useRef(showGrid);    useEffect(() => { gridRef.current = showGrid }, [showGrid])
  const selectedIdRef = useRef(selectedId); useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  useEffect(() => {
    setLoading(true)
    projectsApi.getById(id).then(p => {
      setProject(p)
      let c = {}, its = [], ov = { doors: [], windows: [], curtains: [] }
      try { c = JSON.parse(p.roomConfig) } catch {}
      try { const l = JSON.parse(p.furnitureLayout); if (l?.items) { its = l.items; ov = l.overlays || ov } else if (Array.isArray(l)) its = l } catch {}
      setCfg(c); setItems(its); setOverlays(ov)
    }).catch(() => { toast.error('Failed to load project'); navigate('/projects') }).finally(() => setLoading(false))
  }, [id]) 

  useEffect(() => {
    if (loading || !mountRef.current) return
    let alive = true
    import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js').then(T => {
      if (!alive || !mountRef.current) return
      TRef.current = T
      const mount = mountRef.current
      const W = mount.clientWidth || 900, H = mount.clientHeight || 600
      const renderer = new T.WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setSize(W, H)
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15
      renderer.outputEncoding = T.sRGBEncoding
      mount.appendChild(renderer.domElement); rdrRef.current = renderer
      const scene = new T.Scene()
      scene.background = new T.Color(0x1a2035); scene.fog = new T.FogExp2(0x1a2035, 0.04)
      sceneRef.current = scene
      const camera = new T.PerspectiveCamera(52, W / H, 0.05, 80); camRef.current = camera
      const amb = new T.AmbientLight(0xffeedd, ambientInt); amb.name = 'ambient'; scene.add(amb)
      const sun = new T.DirectionalLight(0xfff5e0, sunInt); sun.name = 'sun'; sun.position.set(6, 10, 4); sun.castShadow = true
      sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 30
      sun.shadow.camera.left = sun.shadow.camera.bottom = -14; sun.shadow.camera.right = sun.shadow.camera.top = 14
      sun.shadow.bias = -0.001; scene.add(sun)
      const fill = new T.DirectionalLight(0x99ccff, 0.32); fill.position.set(-5, 3, -3); scene.add(fill)
      const pt1 = new T.PointLight(0xffddaa, 0.7, 10); pt1.position.set(2, 2.4, 2); scene.add(pt1)
      const pt2 = new T.PointLight(0xaaccff, 0.4, 10); pt2.position.set(-2, 2, -2); scene.add(pt2)
      scene.add(buildRoom(T, cfgRef.current, { wallMode: wallModeRef.current, showCeiling: ceilRef.current, showShadows: shadowRef.current, showGrid: gridRef.current }))
      const fGroup = new T.Group(); fGroup.name = 'furniture'; scene.add(fGroup); fGroupRef.current = fGroup
      populateFurniture(T, fGroup, itemsRef.current)
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
  }, [loading]) 

  useEffect(() => {
    const scene = sceneRef.current; if (!scene) return
    import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js').then(T => {
      const old = scene.getObjectByName('room'); if (old) scene.remove(old)
      scene.add(buildRoom(T, cfg, { wallMode, showCeiling, showShadows, showGrid }))
    })
  }, [cfg, wallMode, showCeiling, showShadows, showGrid]) 

  useEffect(() => {
    const fg = fGroupRef.current; if (!fg) return
    import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js').then(T => {
      while (fg.children.length) fg.remove(fg.children[0])
      populateFurniture(T, fg, items)
    })
  }, [items]) 

  useEffect(() => {
    const scene = sceneRef.current; if (!scene) return
    const a = scene.getObjectByName('ambient'), s = scene.getObjectByName('sun')
    if (a) a.intensity = ambientInt; if (s) s.intensity = sunInt
  }, [ambientInt, sunInt])

  async function populateFurniture(T, group, its) {
    for (const item of its) {
      if (item.x == null || item.y == null) continue
      let mesh
      if (item.customModelId && item.customModelB64 && item.customModelExt) {
        try {
          const buf = b64ToBuffer(item.customModelB64)
          if (item.customModelExt === 'obj') {
            const text = new TextDecoder().decode(buf)
            const geo = parseOBJ(T, text)
            const mat = new T.MeshStandardMaterial({ color: hex2color(T, item.color || '#c4b5fd'), roughness: 0.65 })
            const m = new T.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true
            mesh = new T.Group(); mesh.add(m)
          } else { mesh = await parseGLB(T, buf) }
          mesh.userData.itemId = item.id
          const wM = item.widthM || (item.w / GRID2D), hM = item.heightM || 0.8, dM = item.depthM || (item.d / GRID2D)
          scaleModelToFit(T, mesh, wM, hM, dM)
        } catch (err) { console.warn('Custom model parse failed, using fallback:', err); mesh = buildFurnitureMesh(T, item) }
      } else { mesh = buildFurnitureMesh(T, item) }
      const pos = itemTo3D(item)
      mesh.position.set(pos.x, 0, pos.z); mesh.rotation.y = pos.ry
      group.add(mesh)
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
          dragFurnRef.current = { itemId: o.userData.itemId, offsetX: o.position.x - floorPt.x, offsetZ: o.position.z - floorPt.z }
        }
      }
    } else {
      setSelectedId(null)
    }
  }, []) 

  const onPointerMove = useCallback(e => {
    const p = ptrRef.current; if (!p.down) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    p.moved = true; p.x = e.clientX; p.y = e.clientY

    if (dragFurnRef.current) {
      const T = TRef.current; if (!T) return
      const floorPt = raycastFloor(T, e.clientX, e.clientY)
      if (floorPt) {
        const { itemId, offsetX, offsetZ } = dragFurnRef.current
        const fg = fGroupRef.current
        if (fg) {
          const mesh = fg.children.find(c => c.userData?.itemId === itemId)
          if (mesh) { mesh.position.x = floorPt.x + offsetX; mesh.position.z = floorPt.z + offsetZ }
        }
        setItems(prev => prev.map(i => {
          if (i.id !== itemId) return i
          const wM = i.widthM || (i.w / GRID2D), dM = i.depthM || (i.d / GRID2D)
          const newX2d = Math.round((floorPt.x + offsetX - wM / 2) * GRID2D + OX2D)
          const newY2d = Math.round((floorPt.z + offsetZ - dM / 2) * GRID2D + OY2D)
          return { ...i, x: newX2d, y: newY2d }
        }))
        setDirty(true)
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
  }, []) 

  const onPointerUp = useCallback(e => {
    const p = ptrRef.current
    if (dragFurnRef.current) { dragFurnRef.current = null; p.down = false; return }
    p.down = false
  }, []) 

  const onWheel = useCallback(e => {
    e.preventDefault()
    orbitRef.current.radius = Math.max(0.4, Math.min(28, orbitRef.current.radius * (e.deltaY > 0 ? 1.1 : 0.91)))
    applyOrbit(camRef.current, orbitRef.current)
  }, [])

  const pickItem = (cx, cy) => {
    const rdr = rdrRef.current, cam = camRef.current, fg = fGroupRef.current; if (!rdr || !cam || !fg) return
    import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js').then(T => {
      const rect = rdr.domElement.getBoundingClientRect()
      const ndc = new T.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
      const ray = new T.Raycaster(); ray.setFromCamera(ndc, cam)
      const hits = ray.intersectObjects(fg.children, true)
      if (hits.length) { let o = hits[0].object; while (o.parent && o.parent !== fg) o = o.parent; setSelectedId(o.userData?.itemId || null) }
      else setSelectedId(null)
    })
  }

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
    try { await projectsApi.update(id, { roomConfig: JSON.stringify(cfg), furnitureLayout: JSON.stringify({ items, overlays }) }); setDirty(false); toast.success('Saved!') }
    catch { toast.error('Save failed') } finally { setSaving(false) }
  }

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
        <span className="font-semibold text-white text-sm truncate max-w-[120px] flex-shrink-0">{project?.name || '…'}</span>
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