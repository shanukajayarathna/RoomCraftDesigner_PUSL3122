import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '../store/authStore'
import AppLayout from '../components/shared/AppLayout'
import toast from 'react-hot-toast'
import { Plus, FolderOpen, Pencil, Trash2, Layers, Box, Search, X, Check, MoreVertical } from 'lucide-react'

const SHAPES = ['rectangle','square','l-shape']
const FLOORS = ['wood','carpet','tile','marble','concrete']
const FLOOR_ICONS = { wood:'🪵', carpet:'🟫', tile:'⬜', marble:'⬛', concrete:'🩶' }

function NewProjectModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    name:'My Room Design', description:'',
    shape:'rectangle', width:5, depth:4, height:2.8,
    wallColor:'#F5F5F0', floorTexture:'wood',
  })
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Enter a project name'); return }
    setSaving(true)
    try {
      const roomConfig = JSON.stringify({
        shape:form.shape, width:+form.width, depth:+form.depth,
        height:+form.height, wallColor:form.wallColor,
        floorTexture:form.floorTexture, ceilingColor:'#FFFFFF',
      })
      await onCreate({ name:form.name, description:form.description, roomConfig, furnitureLayout:'[]' })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-surface-200">
          <h2 className="font-display text-xl font-bold text-surface-900">New Room Project</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Project Name</label>
            <input className="input-field" value={form.name}
              onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Living Room Redesign" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Description (optional)</label>
            <textarea className="input-field resize-none h-16" value={form.description}
              onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Brief description…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Room Shape</label>
            <div className="flex gap-2">
              {SHAPES.map(s => (
                <button key={s} onClick={() => setForm(f=>({...f,shape:s}))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all capitalize ${
                    form.shape===s ? 'bg-brand-600 text-white border-brand-600' : 'border-surface-200 text-surface-600 hover:border-brand-300'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['Width (m)','width'],['Depth (m)','depth'],['Height (m)','height']].map(([l,k]) => (
              <div key={k}>
                <label className="block text-xs font-medium text-surface-600 mb-1">{l}</label>
                <input type="number" className="input-field text-sm py-2" min="2" max="20" step="0.5"
                  value={form[k]} onChange={e => setForm(f=>({...f,[k]:e.target.value}))} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Wall Color</label>
              <div className="flex gap-2">
                <input type="color" className="w-10 h-10 rounded-lg border border-surface-200 cursor-pointer p-0.5"
                  value={form.wallColor} onChange={e => setForm(f=>({...f,wallColor:e.target.value}))} />
                <input className="input-field flex-1 text-sm" value={form.wallColor}
                  onChange={e => setForm(f=>({...f,wallColor:e.target.value}))} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Floor</label>
              <select className="input-field text-sm" value={form.floorTexture}
                onChange={e => setForm(f=>({...f,floorTexture:e.target.value}))}>
                {FLOORS.map(f => <option key={f} value={f}>{FLOOR_ICONS[f]} {f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="btn-primary">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Project
          </button>
        </div>
      </div>
    </div>
  )
}

// Dropdown rendered at fixed screen coordinates — escapes overflow:hidden on cards
function CardMenu({ project, onDelete, onRenameStart }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top:0, left:0 })
  const btnRef = useRef(null)

  const toggle = useCallback((e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.right - 144 })
    }
    setOpen(v => !v)
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true) }
  }, [open])

  return (
    <>
      <button ref={btnRef} onClick={toggle}
        className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 transition-colors">
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position:'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white rounded-xl shadow-xl border border-surface-200 w-36 overflow-hidden">
          <button
            onClick={() => { onRenameStart(project); setOpen(false) }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50">
            <Pencil className="w-4 h-4" /> Rename
          </button>
          <button
            onClick={() => { onDelete(project.id); setOpen(false) }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}
    </>
  )
}

function ProjectCard({ project, onDelete, onRenameStart }) {
  const navigate = useNavigate()
  let config = {}
  try { config = JSON.parse(project.roomConfig) } catch {}

  return (
    <div className="card overflow-hidden group hover:shadow-md transition-all duration-200">
      {/* Thumbnail */}
      <div className="h-36 relative cursor-pointer"
        style={{ background:`linear-gradient(135deg,${config.wallColor||'#F5F5F0'}ee,${config.wallColor||'#E8E4DC'}99)` }}
        onClick={() => navigate(`/workspace/2d/${project.id}`)}>
        <div className="absolute inset-0 grid-bg opacity-20" />
        <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 200 144">
          {config.shape==='l-shape'
            ? <polygon points="20,20 120,20 120,80 100,80 100,124 20,124" fill="currentColor" className="text-surface-800" />
            : <rect x="20" y="20" width={config.shape==='square'?100:160} height="104" fill="currentColor" className="text-surface-800" rx="4"/>
          }
        </svg>
        <div className="absolute bottom-2 left-2 flex gap-1.5">
          <span className="bg-white/90 text-surface-700 text-xs px-2 py-0.5 rounded-full font-medium">
            {config.width||5}m × {config.depth||4}m
          </span>
          <span className="bg-white/90 text-surface-700 text-xs px-2 py-0.5 rounded-full font-medium capitalize">
            {FLOOR_ICONS[config.floorTexture]||'🪵'} {config.floorTexture||'wood'}
          </span>
        </div>
        <div className="absolute inset-0 bg-surface-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button onClick={e=>{e.stopPropagation();navigate(`/workspace/2d/${project.id}`)}}
            className="bg-white text-surface-800 text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-surface-50 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> 2D Edit
          </button>
          <button onClick={e=>{e.stopPropagation();navigate(`/workspace/3d/${project.id}`)}}
            className="bg-brand-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-1">
            <Box className="w-3.5 h-3.5" /> 3D View
          </button>
        </div>
      </div>

      {/* Card footer */}
      <div className="p-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-surface-900 truncate">{project.name}</p>
          <p className="text-xs text-surface-400 mt-0.5 capitalize">{config.shape||'Rectangle'} room</p>
        </div>
        <CardMenu project={project} onDelete={onDelete} onRenameStart={onRenameStart} />
      </div>
    </div>
  )
}

export default function ProjectManager() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const load = () => {
    setLoading(true)
    projectsApi.getAll()
      .then(data => setProjects(data))
      .catch(() => toast.error('Failed to load projects'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (data) => {
    const project = await projectsApi.create(data)
    setProjects(p => [project, ...p])
    toast.success('Project created!')
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return
    try {
      await projectsApi.delete(id)
      setProjects(p => p.filter(x => x.id !== id))
      toast.success('Project deleted')
    } catch {
      toast.error('Failed to delete project')
    }
  }

  const handleRename = async () => {
    if (!editName.trim()) return
    try {
      await projectsApi.update(editingId, { name: editName })
      setProjects(p => p.map(x => x.id === editingId ? { ...x, name: editName } : x))
      setEditingId(null)
      toast.success('Renamed!')
    } catch {
      toast.error('Failed to rename')
    }
  }

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <AppLayout title="My Projects">
      {showNew && <NewProjectModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-surface-900">My Projects</h1>
            <p className="text-surface-500 text-sm mt-0.5">{projects.length} design{projects.length!==1?'s':''}</p>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>

        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input className="input-field pl-10 text-sm" placeholder="Search projects…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_,i) => <div key={i} className="card h-52 animate-pulse bg-surface-100" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <FolderOpen className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="font-semibold text-surface-700 mb-1">{search ? 'No matches' : 'No projects yet'}</p>
            <p className="text-surface-400 text-sm mb-5">{search ? 'Try a different search' : 'Create your first room design'}</p>
            {!search && <button onClick={() => setShowNew(true)} className="btn-primary mx-auto"><Plus className="w-4 h-4" /> Create Project</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(p => (
              editingId === p.id ? (
                <div key={p.id} className="card p-4 flex items-center gap-2 h-[88px]">
                  <input autoFocus className="input-field flex-1 text-sm py-2" value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') handleRename(); if(e.key==='Escape') setEditingId(null) }} />
                  <button onClick={handleRename} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingId(null)} className="p-2 text-surface-400 hover:bg-surface-100 rounded-lg"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <ProjectCard key={p.id} project={p} onDelete={handleDelete}
                  onRenameStart={proj => { setEditingId(proj.id); setEditName(proj.name) }} />
              )
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
