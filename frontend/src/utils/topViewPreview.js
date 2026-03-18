// Generate a top-down preview PNG from an OBJ or GLB buffer using Three.js.
// Uses a tiny offscreen renderer; result is a data URL.

async function importThree() {
  // Match Workspace3D version for consistency.
  return import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js')
}

function b64ToBuffer(b64) {
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const u8 = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return buf
}

function parseOBJToGroup(T, text) {
  const verts = [], uvArr = [], normArr = [], posOut = [], uvOut = [], normOut = []
  for (const raw of text.split('\n')) {
    const p = raw.trim().split(/\s+/)
    if (p[0] === 'v') verts.push(p.slice(1).map(Number))
    if (p[0] === 'vt') uvArr.push(p.slice(1).map(Number))
    if (p[0] === 'vn') normArr.push(p.slice(1).map(Number))
    if (p[0] === 'f') {
      const fvs = p.slice(1).map(s => {
        const i = s.split('/').map(n => n ? parseInt(n, 10) - 1 : undefined)
        return { v: i[0], t: i[1], n: i[2] }
      })
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
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  const mat = new T.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.75, metalness: 0.05 })
  const mesh = new T.Mesh(geo, mat)
  mesh.castShadow = false
  const g = new T.Group()
  g.add(mesh)
  return g
}

async function parseGLBToGroup(T, buffer) {
  // Minimal GLB mesh extraction (same spirit as Workspace3D parseGLB)
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

  const getAcc = (idx) => {
    const acc = gltf.accessors[idx]
    const bv = gltf.bufferViews[acc.bufferView]
    const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0)
    const count = acc.count || 0
    const sz = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[acc.type] || 1
    return new Float32Array(binChunk, byteOffset, count * sz)
  }
  const getIdx = (idx) => {
    const acc = gltf.accessors[idx]
    const bv = gltf.bufferViews[acc.bufferView]
    const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0)
    const count = acc.count || 0
    return acc.componentType === 5125 ? new Uint32Array(binChunk, byteOffset, count) : new Uint16Array(binChunk, byteOffset, count)
  }

  const group = new T.Group()
  const defaultMat = new T.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.75, metalness: 0.05 })
  for (const mesh of (gltf.meshes || [])) {
    for (const prim of (mesh.primitives || [])) {
      const geo = new T.BufferGeometry()
      const at = prim.attributes || {}
      if (at.POSITION != null) geo.setAttribute('position', new T.Float32BufferAttribute(getAcc(at.POSITION), 3))
      if (at.NORMAL != null) geo.setAttribute('normal', new T.Float32BufferAttribute(getAcc(at.NORMAL), 3))
      if (at.TEXCOORD_0 != null) geo.setAttribute('uv', new T.Float32BufferAttribute(getAcc(at.TEXCOORD_0), 2))
      if (prim.indices != null) geo.setIndex(new T.BufferAttribute(getIdx(prim.indices), 1))
      if (!geo.getAttribute('normal')) geo.computeVertexNormals()
      const m = new T.Mesh(geo, defaultMat)
      group.add(m)
    }
  }
  return group
}

function fitCameraTopDown(T, camera, obj, padding = 1.08) {
  const box = new T.Box3().setFromObject(obj)
  const size = new T.Vector3()
  box.getSize(size)
  const center = new T.Vector3()
  box.getCenter(center)
  const radius = Math.max(size.x, size.z, 0.001) * 0.5 * padding

  // Top-down: y points up. Look down from +Y.
  camera.left = -radius
  camera.right = radius
  camera.top = radius
  camera.bottom = -radius
  camera.near = 0.01
  camera.far = 50
  camera.updateProjectionMatrix()
  camera.position.set(center.x, center.y + 10, center.z)
  camera.lookAt(center.x, center.y, center.z)
  return { center }
}

export async function renderTopViewPreview({ ext, buffer, size = 256, bg = '#ffffff' }) {
  const T = await importThree()
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true })
  renderer.setSize(size, size, false)
  renderer.setPixelRatio(1)
  renderer.outputEncoding = T.sRGBEncoding

  const scene = new T.Scene()
  scene.background = new T.Color(bg)
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.01, 50)

  const amb = new T.AmbientLight(0xffffff, 0.9)
  scene.add(amb)
  const dir = new T.DirectionalLight(0xffffff, 0.7)
  dir.position.set(2, 6, 3)
  scene.add(dir)

  let obj
  if (ext === 'obj') {
    const text = new TextDecoder().decode(buffer)
    obj = parseOBJToGroup(T, text)
  } else if (ext === 'glb') {
    obj = await parseGLBToGroup(T, buffer)
  } else {
    throw new Error('Unsupported model ext: ' + ext)
  }
  scene.add(obj)

  fitCameraTopDown(T, camera, obj, 1.15)
  renderer.render(scene, camera)

  const dataUrl = canvas.toDataURL('image/png')
  try { renderer.dispose() } catch {}
  return dataUrl
}

export function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',')
  const mime = (meta.match(/data:(.*);base64/) || [])[1] || 'image/png'
  const buf = b64ToBuffer(b64)
  return new Blob([buf], { type: mime })
}

