import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi, furnitureApi, FURNITURE_LIBRARY } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  Save, Undo, RotateCw, Trash2, Box,
  ZoomIn, ZoomOut, MousePointer,
  ChevronLeft, DoorOpen, PanelLeft, RefreshCw,
  Move, Maximize2, FlipHorizontal
} from 'lucide-react'

const GRID_PX = 40
const SNAP    = 10
const OX = 100, OY = 100

const COLORS = {
  Seating:'#93b4fd', Tables:'#6ee7b7', Bedroom:'#fca5a5',
  Storage:'#d8b4fe', Office:'#fcd34d', Lighting:'#fdba74',
  Bathroom:'#a5f3fc', Kitchen:'#bbf7d0', 'Living Room':'#bfdbfe', Decor:'#f9a8d4',
}
const CAT_EMOJI = {
  Seating:'🪑', Tables:'🪵', Bedroom:'🛏️', Storage:'🗄️', Office:'💼',
  Lighting:'💡', Bathroom:'🚿', Kitchen:'🍳', 'Living Room':'🛋️', Decor:'🪴',
}
const FLOOR_COLORS = { wood:'#c8a46e', carpet:'#9b8fa8', tile:'#e0e0e0', marble:'#f0f0f0', concrete:'#b0b0b0' }

const snapV = v => Math.round(v / SNAP) * SNAP

function roomPoly(cfg) {
  const W = (cfg.width  || 5) * GRID_PX
  const D = (cfg.depth  || 4) * GRID_PX
  if (cfg.shape === 'l-shape') {
    const hw = Math.round(W * 0.6), hd = Math.round(D * 0.55)
    return [[OX,OY],[OX+W,OY],[OX+W,OY+hd],[OX+hw,OY+hd],[OX+hw,OY+D],[OX,OY+D]]
  }
  if (cfg.shape === 'square') {
    const S = Math.min(W,D)
    return [[OX,OY],[OX+S,OY],[OX+S,OY+S],[OX,OY+S]]
  }
  return [[OX,OY],[OX+W,OY],[OX+W,OY+D],[OX,OY+D]]
}

function drawFurnitureDetails(ctx, item) {
  const hw = item.w/2, hd = item.d/2
  const cat = item.category
  if (cat === 'Seating') {
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.beginPath(); ctx.roundRect(-hw+3,-hd+3,item.w-6,hd*0.35,3); ctx.fill()
  } else if (cat === 'Tables') {
    const legR=3,off=5
    ctx.fillStyle='rgba(0,0,0,0.2)'
    ;[[-hw+off,-hd+off],[hw-off,-hd+off],[-hw+off,hd-off],[hw-off,hd-off]].forEach(([lx,ly])=>{
      ctx.beginPath();ctx.arc(lx,ly,legR,0,Math.PI*2);ctx.fill()
    })
  } else if (cat === 'Bedroom') {
    ctx.fillStyle='rgba(255,255,255,0.4)'
    ctx.beginPath();ctx.roundRect(-hw+6,-hd+5,item.w-12,hd*0.4,3);ctx.fill()
  }
}

function drawAll(canvas, cfg, items, doors, selectedId, zoom, panX, panY) {
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  // Clear the full physical canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  // Use CSS (logical) dimensions for all drawing math
  const CW = canvas.width / dpr, CH = canvas.height / dpr
  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0) // reset to DPR base
  ctx.translate(panX, panY)
  ctx.scale(zoom, zoom)

  const invX = -panX/zoom, invY = -panY/zoom
  const worldW = CW/zoom, worldH = CH/zoom

  // Background
  ctx.fillStyle = '#f1f5f9'
  ctx.fillRect(invX, invY, worldW, worldH)

  // Grid
  ctx.strokeStyle = 'rgba(99,131,246,0.08)'
  ctx.lineWidth = 0.7
  const gSX = Math.floor(invX/GRID_PX)*GRID_PX
  const gSY = Math.floor(invY/GRID_PX)*GRID_PX
  for (let x=gSX; x<invX+worldW; x+=GRID_PX){ctx.beginPath();ctx.moveTo(x,invY);ctx.lineTo(x,invY+worldH);ctx.stroke()}
  for (let y=gSY; y<invY+worldH; y+=GRID_PX){ctx.beginPath();ctx.moveTo(invX,y);ctx.lineTo(invX+worldW,y);ctx.stroke()}
  ctx.strokeStyle='rgba(99,131,246,0.15)'; ctx.lineWidth=1
  for (let x=gSX; x<invX+worldW; x+=GRID_PX*5){ctx.beginPath();ctx.moveTo(x,invY);ctx.lineTo(x,invY+worldH);ctx.stroke()}
  for (let y=gSY; y<invY+worldH; y+=GRID_PX*5){ctx.beginPath();ctx.moveTo(invX,y);ctx.lineTo(invX+worldW,y);ctx.stroke()}

  const poly = roomPoly(cfg)
  const W = (cfg.width||5)*GRID_PX, D = (cfg.depth||4)*GRID_PX

  // Room shadow
  ctx.save()
  ctx.shadowColor='rgba(0,0,0,0.2)'; ctx.shadowBlur=24; ctx.shadowOffsetX=4; ctx.shadowOffsetY=6
  ctx.beginPath(); poly.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath()
  ctx.fillStyle='#fff'; ctx.fill(); ctx.restore()

  // Floor
  ctx.save()
  ctx.beginPath(); poly.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath(); ctx.clip()
  ctx.fillStyle = FLOOR_COLORS[cfg.floorTexture]||'#c8a46e'; ctx.fill()
  if (cfg.floorTexture==='wood') {
    const plankH=14; ctx.strokeStyle='rgba(100,65,25,0.18)'; ctx.lineWidth=1
    for (let py=OY; py<OY+D+plankH; py+=plankH){ctx.beginPath();ctx.moveTo(OX,py);ctx.lineTo(OX+W,py);ctx.stroke()}
    for (let py=OY,row=0; py<OY+D; py+=plankH,row++){
      const off=(row%2===0)?0:W*0.33
      for(let px=OX+off;px<OX+W;px+=W*0.5){ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px,py+plankH);ctx.stroke()}
    }
  } else if (cfg.floorTexture==='tile') {
    const tS=20; ctx.strokeStyle='rgba(160,160,160,0.45)'; ctx.lineWidth=0.8
    for(let px=OX;px<OX+W;px+=tS){ctx.beginPath();ctx.moveTo(px,OY);ctx.lineTo(px,OY+D);ctx.stroke()}
    for(let py=OY;py<OY+D;py+=tS){ctx.beginPath();ctx.moveTo(OX,py);ctx.lineTo(OX+W,py);ctx.stroke()}
  } else if (cfg.floorTexture==='marble') {
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(OX,OY,W,D)
    ctx.strokeStyle='rgba(200,190,180,0.3)'; ctx.lineWidth=1
    for(let px=OX;px<OX+W;px+=30){ctx.beginPath();ctx.moveTo(px,OY);ctx.lineTo(px,OY+D);ctx.stroke()}
    for(let py=OY;py<OY+D;py+=30){ctx.beginPath();ctx.moveTo(OX,py);ctx.lineTo(OX+W,py);ctx.stroke()}
  }
  ctx.restore()

  // Walls
  ctx.beginPath(); poly.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath()
  ctx.strokeStyle='#1e293b'; ctx.lineWidth=8; ctx.lineJoin='round'; ctx.stroke()
  ctx.beginPath(); poly.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath()
  ctx.strokeStyle=cfg.wallColor||'#F5F5F0'; ctx.lineWidth=5; ctx.stroke()
  ctx.beginPath(); poly.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath()
  ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=1.5; ctx.stroke()

  // Dimensions
  ctx.fillStyle='#64748b'; ctx.font='bold 11px DM Sans,sans-serif'; ctx.textAlign='center'
  ctx.fillText(`${cfg.width||5} m`, OX+W/2, OY-14)
  ctx.save(); ctx.translate(OX-18,OY+D/2); ctx.rotate(-Math.PI/2); ctx.fillText(`${cfg.depth||4} m`,0,0); ctx.restore()

  // Compass rose
  const cx2=OX+W+28, cy2=OY+22
  ctx.save(); ctx.font='bold 9px DM Sans,sans-serif'; ctx.textAlign='center'
  ctx.fillStyle='#e11d48'; ctx.fillText('N',cx2,cy2-12)
  ctx.fillStyle='#94a3b8'; ctx.fillText('S',cx2,cy2+18); ctx.fillText('W',cx2-14,cy2+5); ctx.fillText('E',cx2+14,cy2+5)
  ctx.beginPath(); ctx.moveTo(cx2,cy2-7); ctx.lineTo(cx2+4,cy2+3); ctx.lineTo(cx2,cy2); ctx.closePath()
  ctx.fillStyle='#e11d48'; ctx.fill()
  ctx.beginPath(); ctx.moveTo(cx2,cy2+7); ctx.lineTo(cx2-4,cy2-3); ctx.lineTo(cx2,cy2); ctx.closePath()
  ctx.fillStyle='#64748b'; ctx.fill(); ctx.restore()

  // Doors
  doors.forEach(d=>{
    ctx.save(); ctx.translate(d.x,d.y); ctx.rotate((d.rotation||0)*Math.PI/180)
    ctx.fillStyle='#fff'; ctx.strokeStyle='#475569'; ctx.lineWidth=2
    ctx.fillRect(0,-4,44,8); ctx.strokeRect(0,-4,44,8)
    ctx.beginPath(); ctx.arc(0,0,40,0,Math.PI/2)
    ctx.strokeStyle='rgba(71,85,105,0.35)'; ctx.lineWidth=1; ctx.setLineDash([4,3]); ctx.stroke(); ctx.setLineDash([]); ctx.restore()
  })

  // Furniture
  items.forEach(item=>{
    const sel=item.id===selectedId
    ctx.save(); ctx.translate(item.x+item.w/2, item.y+item.d/2); ctx.rotate((item.rotation||0)*Math.PI/180)
    ctx.shadowColor=sel?'rgba(59,110,246,0.35)':'rgba(0,0,0,0.22)'; ctx.shadowBlur=sel?18:8; ctx.shadowOffsetX=2; ctx.shadowOffsetY=3
    ctx.fillStyle=item.color||'#93b4fd'
    ctx.beginPath(); ctx.roundRect(-item.w/2,-item.d/2,item.w,item.d,6); ctx.fill()
    ctx.shadowColor='transparent'
    try {
      const g=ctx.createLinearGradient(-item.w/2,-item.d/2,-item.w/2,item.d/2)
      g.addColorStop(0,'rgba(255,255,255,0.28)'); g.addColorStop(1,'rgba(0,0,0,0.1)')
      ctx.fillStyle=g; ctx.beginPath(); ctx.roundRect(-item.w/2,-item.d/2,item.w,item.d,6); ctx.fill()
    }catch(e){}
    ctx.strokeStyle=sel?'#3b6ef6':'rgba(0,0,0,0.18)'; ctx.lineWidth=sel?2.5:1.2
    ctx.beginPath(); ctx.roundRect(-item.w/2,-item.d/2,item.w,item.d,6); ctx.stroke()
    drawFurnitureDetails(ctx,item)
    const fs=Math.max(7,Math.min(13,Math.min(item.w,item.d)/3.5))
    ctx.fillStyle='rgba(15,23,42,0.85)'; ctx.font=`600 ${fs}px DM Sans,sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'
    const maxW=item.w-8; let label=item.label||''
    while(ctx.measureText(label).width>maxW&&label.length>3)label=label.slice(0,-1)
    if(label!==item.label)label+='…'; ctx.fillText(label,0,0)
    if(sel){
      const pts=[[0,-item.d/2-10],[item.w/2+8,0],[-item.w/2-8,0],[0,item.d/2+10]]
      pts.forEach(([hx,hy],i)=>{
        ctx.fillStyle=i===0?'#f59e0b':'#3b6ef6'
        ctx.beginPath(); ctx.arc(hx,hy,5,0,Math.PI*2); ctx.fill()
        ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke()
      })
      ctx.strokeStyle='#3b6ef6'; ctx.lineWidth=1.5; ctx.setLineDash([4,3])
      ctx.beginPath(); ctx.roundRect(-item.w/2-4,-item.d/2-4,item.w+8,item.d+8,8); ctx.stroke(); ctx.setLineDash([])
    }
    ctx.restore()
  })
  ctx.restore()
}

export default function Workspace2D() {
  const {id}=useParams(); const navigate=useNavigate(); const canvasRef=useRef(null)
  const [project,setProject]=useState(null)
  const [cfg,setCfg]=useState({shape:'rectangle',width:5,depth:4,height:2.8,wallColor:'#F5F5F0',floorTexture:'wood'})
  const [items,setItems]=useState([]); const [doors,setDoors]=useState([])
  const [selected,setSelected]=useState(null)
  const [zoom,setZoom]=useState(1); const [panX,setPanX]=useState(0); const [panY,setPanY]=useState(0)
  const [panelOpen,setPanelOpen]=useState(true)
  const [library,setLibrary]=useState(FURNITURE_LIBRARY)
  const [furSearch,setFurSearch]=useState(''); const [furCat,setFurCat]=useState('All')
  const [saving,setSaving]=useState(false); const [dirty,setDirty]=useState(false)
  const [mode,setMode]=useState('select')

  const [loadingProject, setLoadingProject] = useState(true)

  const drag=useRef(null); const history=useRef([])
  const panRef=useRef({x:0,y:0}); const zoomRef=useRef(1)
  const stateRef=useRef({items:[],cfg:{}})

  useEffect(()=>{panRef.current={x:panX,y:panY}},[panX,panY])
  useEffect(()=>{zoomRef.current=zoom},[zoom])
  useEffect(()=>{stateRef.current={items,cfg}},[items,cfg])

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
    furnitureApi.getAll().then(data=>{ if(data?.length) setLibrary(data) }).catch(()=>{})
  },[id])

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return
    drawAll(canvas,cfg,items,doors,selected,zoom,panX,panY)
  },[cfg,items,doors,selected,zoom,panX,panY])

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return
    const parent=canvas.parentElement
    const resize=()=>{
      const dpr=window.devicePixelRatio||1
      const w=parent.clientWidth, h=parent.clientHeight
      canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr)
      canvas.style.width=w+'px'; canvas.style.height=h+'px'
      const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr)
      drawAll(canvas,stateRef.current.cfg,stateRef.current.items,[],null,zoomRef.current,panRef.current.x,panRef.current.y)
    }
    resize()
    const ro=new ResizeObserver(resize); ro.observe(parent); return()=>ro.disconnect()
  },[])

  const toWorld=useCallback((cx,cy)=>{
    const rect=canvasRef.current.getBoundingClientRect()
    return{x:(cx-rect.left-panRef.current.x)/zoomRef.current,y:(cy-rect.top-panRef.current.y)/zoomRef.current}
  },[])

  const onMouseDown=useCallback(e=>{
    const{x,y}=toWorld(e.clientX,e.clientY)
    const isPan=e.button===1||e.button===2||mode==='pan'
    if(isPan){e.preventDefault();drag.current={type:'pan',startX:e.clientX,startY:e.clientY,startPanX:panRef.current.x,startPanY:panRef.current.y};return}
    const hit=[...stateRef.current.items].reverse().find(item=>{
      const hw=item.w/2,hd=item.d/2,cx=item.x+hw,cy=item.y+hd,dx=x-cx,dy=y-cy
      const rad=-(item.rotation||0)*Math.PI/180
      const rx=dx*Math.cos(rad)-dy*Math.sin(rad),ry=dx*Math.sin(rad)+dy*Math.cos(rad)
      return Math.abs(rx)<=hw+4&&Math.abs(ry)<=hd+4
    })
    if(hit){setSelected(hit.id);drag.current={type:'item',id:hit.id,ox:x-hit.x,oy:y-hit.y}}
    else{setSelected(null);drag.current={type:'pan',startX:e.clientX,startY:e.clientY,startPanX:panRef.current.x,startPanY:panRef.current.y}}
  },[mode,toWorld])

  const onMouseMove=useCallback(e=>{
    if(!drag.current)return
    if(drag.current.type==='pan'){
      const dx=e.clientX-drag.current.startX,dy=e.clientY-drag.current.startY
      setPanX(drag.current.startPanX+dx);setPanY(drag.current.startPanY+dy);return
    }
    if(drag.current.type==='item'){
      const{x,y}=toWorld(e.clientX,e.clientY)
      setItems(prev=>prev.map(item=>item.id===drag.current.id?{...item,x:snapV(x-drag.current.ox),y:snapV(y-drag.current.oy)}:item))
      setDirty(true)
    }
  },[toWorld])

  const onMouseUp=useCallback(()=>{drag.current=null},[])

  const onWheel=useCallback(e=>{
    e.preventDefault()
    const rect=canvasRef.current.getBoundingClientRect()
    const mx=e.clientX-rect.left,my=e.clientY-rect.top
    const delta=e.deltaY>0?0.9:1.11
    const newZoom=Math.max(0.2,Math.min(4,zoomRef.current*delta))
    const scale=newZoom/zoomRef.current
    setPanX(mx-scale*(mx-panRef.current.x))
    setPanY(my-scale*(my-panRef.current.y))
    setZoom(newZoom)
  },[])

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return
    canvas.addEventListener('wheel',onWheel,{passive:false})
    return()=>canvas.removeEventListener('wheel',onWheel)
  },[onWheel])

  const onDrop=e=>{
    e.preventDefault(); const raw=e.dataTransfer.getData('furniture'); if(!raw)return
    const model=JSON.parse(raw); const{x,y}=toWorld(e.clientX,e.clientY)
    const w=model.width*GRID_PX,d=model.depth*GRID_PX
    history.current.push(JSON.stringify(stateRef.current.items))
    const newItem={id:Date.now(),label:model.name,category:model.category,color:COLORS[model.category]||'#93b4fd',x:snapV(x-w/2),y:snapV(y-d/2),w,d,rotation:0,modelId:model.id}
    setItems(prev=>[...prev,newItem]); setSelected(newItem.id); setDirty(true)
  }

  const pushHistory=()=>{history.current.push(JSON.stringify(stateRef.current.items));if(history.current.length>50)history.current.shift()}
  const undo=useCallback(()=>{if(!history.current.length){toast('Nothing to undo');return}setItems(JSON.parse(history.current.pop()));setSelected(null);setDirty(true)},[])
  const rotate=useCallback(()=>{if(!selected)return;pushHistory();setItems(prev=>prev.map(i=>i.id===selected?{...i,rotation:((i.rotation||0)+90)%360}:i));setDirty(true)},[selected])
  const del=useCallback(()=>{if(!selected)return;pushHistory();setItems(prev=>prev.filter(i=>i.id!==selected));setSelected(null);setDirty(true)},[selected])
  const duplicate=useCallback(()=>{
    if(!selected)return;pushHistory()
    const src=stateRef.current.items.find(i=>i.id===selected);if(!src)return
    const ni={...src,id:Date.now(),x:src.x+SNAP*2,y:src.y+SNAP*2}
    setItems(prev=>[...prev,ni]);setSelected(ni.id);setDirty(true)
  },[selected])

  const centerView=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const{cfg:c}=stateRef.current
    const dpr=window.devicePixelRatio||1
    const CW=canvas.width/dpr, CH=canvas.height/dpr
    const W=(c.width||5)*GRID_PX,D=(c.depth||4)*GRID_PX
    const tz=Math.min((CW-120)/(W+OX*2),(CH-80)/(D+OY*2),2.5)
    const nz=Math.max(0.2,tz)
    setZoom(nz); setPanX((CW-(W+OX*2)*nz)/2); setPanY((CH-(D+OY*2)*nz)/2)
  },[])

  const save=async()=>{
    setSaving(true)
    try{await projectsApi.update(id,{roomConfig:JSON.stringify(cfg),furnitureLayout:JSON.stringify(items)});setDirty(false);toast.success('Saved!')}
    catch{toast.error('Save failed')}finally{setSaving(false)}
  }

  useEffect(()=>{if(project)setTimeout(centerView,150)},[project]) // eslint-disable-line

  useEffect(()=>{
    const h=e=>{
      if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA')return
      if(e.key==='Delete'||e.key==='Backspace')del()
      if(e.key==='r'||e.key==='R')rotate()
      if(e.key==='d'||e.key==='D')duplicate()
      if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo()}
      if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();save()}
      if(e.key==='Escape')setSelected(null)
      if(e.key===' '){e.preventDefault();setMode(m=>m==='pan'?'select':'pan')}
      if(e.key==='f'||e.key==='F')centerView()
    }
    window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h)
  },[selected,items,del,rotate,duplicate,undo,centerView]) // eslint-disable-line

  const categories=['All',...new Set(library.map(f=>f.category))]
  const filteredLib=library.filter(f=>(furCat==='All'||f.category===furCat)&&f.name.toLowerCase().includes(furSearch.toLowerCase()))
  const selectedItem=items.find(i=>i.id===selected)

  if (loadingProject) return (
    <div className="h-screen flex items-center justify-center bg-surface-50 flex-col gap-4">
      <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"/>
      <p className="text-surface-500 text-sm font-medium">Loading project…</p>
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-surface-100 overflow-hidden select-none">
      <div className="h-14 bg-white border-b border-surface-200 flex items-center px-3 gap-2 flex-shrink-0 z-20 overflow-x-auto">
        <button onClick={()=>navigate('/projects')} className="btn-ghost text-sm py-1.5 flex-shrink-0">
          <ChevronLeft className="w-4 h-4"/><span className="hidden sm:inline">Projects</span>
        </button>
        <div className="h-6 w-px bg-surface-200 flex-shrink-0"/>
        <span className="font-semibold text-surface-900 text-sm truncate max-w-[120px] flex-shrink-0">{project?.name||'Loading…'}</span>
        <span className="badge badge-blue text-xs flex-shrink-0">2D</span>
        {dirty&&<span className="text-xs text-amber-500 flex-shrink-0">● Unsaved</span>}
        <div className="flex-1"/>
        <div className="flex bg-surface-100 rounded-lg p-0.5 flex-shrink-0">
          <button onClick={()=>setMode('select')} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${mode==='select'?'bg-white shadow-sm text-surface-900':'text-surface-500'}`}>
            <MousePointer className="w-3 h-3"/>Select
          </button>
          <button onClick={()=>setMode('pan')} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${mode==='pan'?'bg-white shadow-sm text-surface-900':'text-surface-500'}`}>
            <Move className="w-3 h-3"/>Pan
          </button>
        </div>
        <button onClick={()=>setZoom(z=>Math.max(0.2,+(z-0.1).toFixed(2)))} className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 flex-shrink-0"><ZoomOut className="w-4 h-4"/></button>
        <span className="text-xs text-surface-500 w-10 text-center font-mono flex-shrink-0">{Math.round(zoom*100)}%</span>
        <button onClick={()=>setZoom(z=>Math.min(4,+(z+0.1).toFixed(2)))} className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 flex-shrink-0"><ZoomIn className="w-4 h-4"/></button>
        <button onClick={centerView} title="Fit View (F)" className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 flex-shrink-0"><Maximize2 className="w-4 h-4"/></button>
        <div className="h-6 w-px bg-surface-200 flex-shrink-0"/>
        <button onClick={rotate} disabled={!selected} title="Rotate (R)" className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 disabled:opacity-30 flex-shrink-0"><RotateCw className="w-4 h-4"/></button>
        <button onClick={duplicate} disabled={!selected} title="Duplicate (D)" className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 disabled:opacity-30 flex-shrink-0"><FlipHorizontal className="w-4 h-4"/></button>
        <button onClick={del} disabled={!selected} title="Delete" className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-30 flex-shrink-0"><Trash2 className="w-4 h-4"/></button>
        <button onClick={undo} title="Undo (Ctrl+Z)" className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 flex-shrink-0"><Undo className="w-4 h-4"/></button>
        <button onClick={()=>{setDoors(prev=>[...prev,{id:Date.now(),x:OX+20,y:OY,rotation:0}]);toast('Door added')}} title="Add Door" className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 flex-shrink-0"><DoorOpen className="w-4 h-4"/></button>
        <button onClick={()=>{pushHistory();setItems([]);setSelected(null);setDirty(true);toast('Room cleared')}} title="Clear Room" className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 flex-shrink-0"><RefreshCw className="w-4 h-4"/></button>
        <div className="h-6 w-px bg-surface-200 flex-shrink-0"/>
        <button onClick={()=>{save();setTimeout(()=>navigate(`/workspace/3d/${id}`),500)}} className="btn-secondary text-sm py-1.5 flex-shrink-0"><Box className="w-4 h-4"/><span className="hidden sm:inline">3D View</span></button>
        <button onClick={save} disabled={saving} className="btn-primary text-sm py-1.5 flex-shrink-0">
          {saving?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Save className="w-4 h-4"/>}
          <span className="hidden sm:inline">Save</span>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`bg-white border-r border-surface-200 flex flex-col transition-all duration-300 flex-shrink-0 ${panelOpen?'w-56':'w-0 overflow-hidden'}`}>
          <div className="p-3 border-b border-surface-100 flex-shrink-0">
            <p className="font-semibold text-surface-800 text-sm mb-2">Furniture Library</p>
            <input className="input-field text-xs py-1.5" placeholder="Search…" value={furSearch} onChange={e=>setFurSearch(e.target.value)}/>
          </div>
          <div className="flex gap-1 p-2 flex-wrap border-b border-surface-100 flex-shrink-0 max-h-24 overflow-y-auto">
            {categories.map(c=>(
              <button key={c} onClick={()=>setFurCat(c)} className={`text-xs px-2 py-0.5 rounded-lg border transition-all ${furCat===c?'bg-brand-600 text-white border-brand-600':'border-surface-200 text-surface-600 hover:border-brand-300'}`}>{c}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filteredLib.map(f=>(
              <div key={f.id} draggable onDragStart={e=>e.dataTransfer.setData('furniture',JSON.stringify(f))}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-50 cursor-grab active:cursor-grabbing border border-transparent hover:border-surface-200 transition-all">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{background:(COLORS[f.category]||'#93b4fd')+'40'}}>
                  {CAT_EMOJI[f.category]||'📦'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-surface-800 truncate">{f.name}</p>
                  <p className="text-xs text-surface-400">{f.width}×{f.depth}m</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-surface-100 text-xs text-surface-400 text-center flex-shrink-0">Drag items onto canvas</div>
        </div>

        <button onClick={()=>setPanelOpen(!panelOpen)} className="absolute z-30 top-1/2 -translate-y-1/2 bg-white border border-surface-200 rounded-r-lg p-1 shadow-sm hover:bg-surface-50" style={{left:panelOpen?'224px':'0px'}}>
          <PanelLeft className={`w-4 h-4 text-surface-500 transition-transform ${panelOpen?'':'rotate-180'}`}/>
        </button>

        <div className="flex-1 relative overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-full"
            style={{cursor:drag.current?.type==='pan'?'grabbing':drag.current?.type==='item'?'grabbing':mode==='pan'?'grab':selected?'move':'default'}}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onContextMenu={e=>e.preventDefault()} onDrop={onDrop} onDragOver={e=>e.preventDefault()}/>

          <div className="absolute bottom-3 left-3 bg-white/95 border border-surface-200 rounded-lg px-3 py-1.5 text-xs text-surface-500 font-mono pointer-events-none shadow-sm">
            {Math.round(zoom*100)}% · {cfg.width||5}×{cfg.depth||4}m · {items.length} items
          </div>
          <div className="absolute bottom-3 right-3 bg-white/95 border border-surface-200 rounded-lg px-3 py-1.5 text-xs text-surface-500 pointer-events-none hidden md:block shadow-sm">
            Scroll: zoom · Drag canvas: pan · R: rotate · D: duplicate · F: fit view
          </div>

          <div className="absolute top-3 right-3 bg-white rounded-xl border border-surface-200 shadow-md p-4 w-52">
            <p className="text-xs font-semibold text-surface-700 mb-3 uppercase tracking-wide">Room Settings</p>
            <div className="space-y-2.5">
              <div>
                <label className="text-xs text-surface-500 block mb-0.5">Shape</label>
                <select className="w-full text-xs border border-surface-200 rounded-lg px-2 py-1.5 bg-surface-50" value={cfg.shape} onChange={e=>{setCfg(c=>({...c,shape:e.target.value}));setDirty(true)}}>
                  <option value="rectangle">Rectangle</option>
                  <option value="square">Square</option>
                  <option value="l-shape">L-Shape</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div><label className="text-xs text-surface-500 block mb-0.5">Width (m)</label>
                  <input type="number" min="2" max="20" step="0.5" className="w-full text-xs border border-surface-200 rounded-lg px-2 py-1.5 bg-surface-50" value={cfg.width} onChange={e=>{setCfg(c=>({...c,width:+e.target.value}));setDirty(true)}}/></div>
                <div><label className="text-xs text-surface-500 block mb-0.5">Depth (m)</label>
                  <input type="number" min="2" max="20" step="0.5" className="w-full text-xs border border-surface-200 rounded-lg px-2 py-1.5 bg-surface-50" value={cfg.depth} onChange={e=>{setCfg(c=>({...c,depth:+e.target.value}));setDirty(true)}}/></div>
              </div>
              <div><label className="text-xs text-surface-500 block mb-0.5">Wall Color</label>
                <div className="flex gap-1.5">
                  <input type="color" className="w-8 h-8 rounded border border-surface-200 cursor-pointer p-0.5" value={cfg.wallColor||'#F5F5F0'} onChange={e=>{setCfg(c=>({...c,wallColor:e.target.value}));setDirty(true)}}/>
                  <input className="flex-1 text-xs border border-surface-200 rounded-lg px-2 bg-surface-50" value={cfg.wallColor||'#F5F5F0'} onChange={e=>{setCfg(c=>({...c,wallColor:e.target.value}));setDirty(true)}}/>
                </div>
              </div>
              <div><label className="text-xs text-surface-500 block mb-0.5">Floor</label>
                <select className="w-full text-xs border border-surface-200 rounded-lg px-2 py-1.5 bg-surface-50" value={cfg.floorTexture||'wood'} onChange={e=>{setCfg(c=>({...c,floorTexture:e.target.value}));setDirty(true)}}>
                  {['wood','carpet','tile','marble','concrete'].map(f=><option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </div>

          {selectedItem&&(
            <div className="absolute top-3 bg-white rounded-xl border border-brand-200 shadow-md p-3 w-48 animate-fade-in" style={{left:panelOpen?'235px':'8px'}}>
              <p className="text-xs font-semibold text-brand-700 mb-2 truncate">{selectedItem.label}</p>
              <div className="space-y-1 text-xs text-surface-500 mb-2">
                <div className="flex justify-between"><span>Size</span><span className="font-mono">{(selectedItem.w/GRID_PX).toFixed(1)}×{(selectedItem.d/GRID_PX).toFixed(1)}m</span></div>
                <div className="flex justify-between"><span>Rotation</span><span className="font-mono">{selectedItem.rotation||0}°</span></div>
              </div>
              <div className="grid grid-cols-2 gap-1 mb-2">
                <div><label className="text-xs text-surface-400 block mb-0.5">W (m)</label>
                  <input type="number" min="0.3" max="10" step="0.1" className="w-full text-xs border border-surface-200 rounded px-1.5 py-1 bg-surface-50"
                    value={(selectedItem.w/GRID_PX).toFixed(1)} onChange={e=>{const w=Math.round(+e.target.value*GRID_PX);setItems(prev=>prev.map(i=>i.id===selected?{...i,w}:i));setDirty(true)}}/></div>
                <div><label className="text-xs text-surface-400 block mb-0.5">D (m)</label>
                  <input type="number" min="0.3" max="10" step="0.1" className="w-full text-xs border border-surface-200 rounded px-1.5 py-1 bg-surface-50"
                    value={(selectedItem.d/GRID_PX).toFixed(1)} onChange={e=>{const d=Math.round(+e.target.value*GRID_PX);setItems(prev=>prev.map(i=>i.id===selected?{...i,d}:i));setDirty(true)}}/></div>
              </div>
              <div className="flex gap-1">
                <button onClick={rotate} className="flex-1 flex items-center justify-center gap-1 text-xs bg-surface-100 hover:bg-surface-200 text-surface-700 py-1.5 rounded-lg"><RotateCw className="w-3 h-3"/></button>
                <button onClick={duplicate} className="flex-1 flex items-center justify-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 py-1.5 rounded-lg"><FlipHorizontal className="w-3 h-3"/></button>
                <button onClick={del} className="flex-1 flex items-center justify-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 py-1.5 rounded-lg"><Trash2 className="w-3 h-3"/></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
