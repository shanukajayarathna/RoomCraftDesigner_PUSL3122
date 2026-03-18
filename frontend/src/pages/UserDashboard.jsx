import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, projectsApi } from '../store/authStore'
import AppLayout from '../components/shared/AppLayout'
import toast from 'react-hot-toast'
import { FolderOpen, Plus, Clock, Layers, ArrowRight, Boxes, X } from 'lucide-react'

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

export default function UserDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    projectsApi.getAll()
      .then(data => setProjects(data.slice(0, 6)))
      .catch(() => toast.error('Failed to load projects'))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (data) => {
    const project = await projectsApi.create(data)
    toast.success('Project created!')
    navigate(`/workspace/2d/${project.id}`)
  }

  const recentCount = projects.filter(p => {
    try { return (Date.now() - new Date(p.updatedAt)) < 7*24*3600*1000 } catch { return true }
  }).length

  const stats = [
    { label: 'Total Projects',  value: projects.length, icon: FolderOpen, color: 'bg-blue-50 text-blue-600' },
    { label: 'Recent (7 days)', value: recentCount,     icon: Clock,      color: 'bg-green-50 text-green-600' },
    { label: '2D & 3D Rooms',   value: projects.length, icon: Layers,     color: 'bg-purple-50 text-purple-600' },
  ]

  return (
    <AppLayout title="Dashboard">
      {showNew && <NewProjectModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-surface-900 mb-1">
            Welcome back, {user?.username} 👋
          </h1>
          <p className="text-surface-500">Your interior design workspace.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="stat-card">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-surface-900">{value}</p>
                <p className="text-sm text-surface-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button onClick={() => setShowNew(true)}
            className="card p-5 text-left hover:border-brand-200 hover:bg-brand-50/50 transition-all duration-200 group">
            <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-200 transition-colors">
              <Plus className="w-5 h-5 text-brand-600" />
            </div>
            <p className="font-semibold text-surface-900">New Project</p>
            <p className="text-sm text-surface-500 mt-1">Start a fresh room design</p>
          </button>

          <button onClick={() => navigate('/projects')}
            className="card p-5 text-left hover:border-surface-300 transition-all duration-200 group">
            <div className="w-10 h-10 bg-surface-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-surface-200 transition-colors">
              <FolderOpen className="w-5 h-5 text-surface-600" />
            </div>
            <p className="font-semibold text-surface-900">My Projects</p>
            <p className="text-sm text-surface-500 mt-1">Browse all your designs</p>
          </button>

          <div className="card p-5 bg-gradient-to-br from-brand-600 to-brand-700 border-0">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <p className="font-semibold text-white">3D Viewer</p>
            <p className="text-sm text-white/70 mt-1">Open any project in 3D</p>
          </div>
        </div>

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-900 text-lg">Recent Projects</h2>
            <button onClick={() => navigate('/projects')}
              className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="card h-44 animate-pulse bg-surface-100" />)}
            </div>
          ) : projects.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-surface-400" />
              </div>
              <p className="font-semibold text-surface-700 mb-1">No projects yet</p>
              <p className="text-surface-400 text-sm mb-4">Create your first room design to get started</p>
              <button onClick={() => setShowNew(true)} className="btn-primary mx-auto">
                <Plus className="w-4 h-4" /> Create Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(p => {
                let config = {}
                try { config = JSON.parse(p.roomConfig) } catch {}
                return (
                  <div key={p.id}
                    className="card overflow-hidden hover:shadow-md transition-all duration-200 group cursor-pointer"
                    onClick={() => navigate(`/workspace/2d/${p.id}`)}>
                    <div className="h-32 relative flex items-center justify-center"
                      style={{
                        background: p.thumbnailUrl
                          ? `url(${p.thumbnailUrl}) center/cover no-repeat`
                          : `linear-gradient(135deg, ${config.wallColor||'#F5F5F0'}dd, ${config.wallColor||'#E8E4DC'}99)`
                      }}>
                      {!p.thumbnailUrl && <>
                        <div className="absolute inset-0 grid-bg opacity-20" />
                        <span className="text-4xl relative">{FLOOR_ICONS[config.floorTexture] || '🏠'}</span>
                      </>}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button onClick={e => { e.stopPropagation(); navigate(`/workspace/2d/${p.id}`) }}
                          className="bg-white text-surface-700 text-xs px-2 py-1 rounded-lg shadow font-medium hover:bg-surface-50">2D</button>
                        <button onClick={e => { e.stopPropagation(); navigate(`/workspace/3d/${p.id}`) }}
                          className="bg-brand-600 text-white text-xs px-2 py-1 rounded-lg shadow font-medium hover:bg-brand-700">3D</button>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="font-semibold text-surface-900 truncate">{p.name}</p>
                      <p className="text-xs text-surface-400 mt-1">
                        {config.width||5}m × {config.depth||4}m · <span className="capitalize">{config.shape||'Rectangle'}</span>
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
