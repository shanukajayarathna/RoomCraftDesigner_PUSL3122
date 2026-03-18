import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '../store/authStore'
import AppLayout from '../components/shared/AppLayout'
import toast from 'react-hot-toast'
import {
  Plus, FolderOpen, Pencil, Trash2, Layers, Box,
  Search, X, Check, MoreVertical, Grid2x2, List, Filter
} from 'lucide-react'

const SHAPES = ['rectangle', 'square', 'l-shape']
const FLOORS = ['wood', 'carpet', 'tile', 'marble', 'concrete']
const FLOOR_ICONS = { wood: '🪵', carpet: '🟫', tile: '⬜', marble: '⬛', concrete: '🩶' }

/* ── New / Edit Modal ── */
function ProjectModal({ onClose, onCreate, editData }) {
  const isEdit = !!editData
  const [form, setForm] = useState(editData || {
    name: 'My Room Design', description: '',
    shape: 'rectangle', width: 5, depth: 4, height: 2.8,
    wallColor: '#F5F5F0', floorTexture: 'wood',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Enter a project name'); return }
    setSaving(true)
    try {
      const roomConfig = JSON.stringify({
        shape: form.shape, width: +form.width, depth: +form.depth,
        height: +form.height, wallColor: form.wallColor,
        floorTexture: form.floorTexture, ceilingColor: '#FFFFFF',
      })
      await onCreate({ name: form.name, description: form.description, roomConfig, furnitureLayout: '[]' })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(6px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 520, boxShadow: '0 32px 80px rgba(15,23,42,.2)', animation: 'slideUp .28s cubic-bezier(.22,1,.36,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 28px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#0f172a', letterSpacing: '-0.02em' }}>{isEdit ? 'Edit Project' : 'New Room Project'}</h2>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{isEdit ? 'Update your room details' : 'Configure your room before designing'}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#94a3b8' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>Project Name</label>
            <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Living Room Redesign" style={{ borderRadius: 10 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>Description <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <textarea className="input-field" style={{ resize: 'none', height: 72, borderRadius: 10 }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description…" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>Room Shape</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {SHAPES.map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, shape: s }))}
                  style={{ flex: 1, padding: '9px 8px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: `1.5px solid ${form.shape === s ? '#f59e0b' : '#e2e8f0'}`, background: form.shape === s ? '#fffbeb' : '#fff', color: form.shape === s ? '#92400e' : '#64748b', cursor: 'pointer', transition: 'all .15s', textTransform: 'capitalize' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>Dimensions</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[['Width (m)', 'width'], ['Depth (m)', 'depth'], ['Height (m)', 'height']].map(([l, k]) => (
                <div key={k}>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{l}</label>
                  <input type="number" className="input-field" min="2" max="20" step="0.5" style={{ fontSize: 14, padding: '9px 12px', borderRadius: 9 }} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>Wall Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" style={{ width: 40, height: 40, borderRadius: 9, border: '1.5px solid #e2e8f0', cursor: 'pointer', padding: 3 }} value={form.wallColor} onChange={e => setForm(f => ({ ...f, wallColor: e.target.value }))} />
                <input className="input-field" style={{ flex: 1, fontSize: 13, padding: '9px 10px', borderRadius: 9 }} value={form.wallColor} onChange={e => setForm(f => ({ ...f, wallColor: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>Floor</label>
              <select className="input-field" style={{ fontSize: 13, padding: '9px 10px', borderRadius: 9 }} value={form.floorTexture} onChange={e => setForm(f => ({ ...f, floorTexture: e.target.value }))}>
                {FLOORS.map(f => <option key={f} value={f}>{FLOOR_ICONS[f]} {f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '0 28px 24px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '10px 22px', background: saving ? '#fde68a' : '#f59e0b', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#1a1208', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 12px rgba(245,158,11,.3)' }}>
            {saving ? <span style={{ width: 14, height: 14, border: '2px solid rgba(15,23,42,.2)', borderTopColor: '#0f172a', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
              : isEdit ? <Check size={14} /> : <Plus size={14} />}
            {isEdit ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

/* ── Main Component ── */
export default function ProjectManager() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showNew, setShowNew]   = useState(false)
  const [editId, setEditId]     = useState(null)
  const [menuId, setMenuId]     = useState(null)
  const [viewMode, setViewMode] = useState('grid')
  const menuRef = useRef(null)

  const load = useCallback(() => {
    setLoading(true)
    projectsApi.getAll()
      .then(setProjects)
      .catch(() => toast.error('Failed to load projects'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e) => { if (!menuRef.current?.contains(e.target)) setMenuId(null) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleCreate = async (data) => {
    const project = await projectsApi.create(data)
    toast.success('Project created!')
    navigate(`/workspace/2d/${project.id}`)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this project?')) return
    try { await projectsApi.delete(id); load(); toast.success('Deleted') }
    catch { toast.error('Delete failed') }
  }

  const filtered = projects.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AppLayout title="My Projects">
      {showNew && <ProjectModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}

      <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto', fontFamily: 'var(--font-body)' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 3 }}>My Projects</h1>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>{projects.length} room design{projects.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowNew(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: '#f59e0b', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 700, color: '#1a1208', cursor: 'pointer', transition: 'all .15s', boxShadow: '0 2px 12px rgba(245,158,11,.25)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fbbf24'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(245,158,11,.4)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f59e0b'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(245,158,11,.25)' }}>
            <Plus size={15} /> New Project
          </button>
        </div>

        {/* ── Search + view toggle ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              style={{ width: '100%', padding: '10px 14px 10px 36px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 11, fontFamily: 'var(--font-body)', fontSize: 14, color: '#0f172a', outline: 'none', transition: 'border-color .15s' }}
              placeholder="Search projects…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={e => e.target.style.borderColor = '#f59e0b'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                <X size={14} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 3 }}>
            {[['grid', Grid2x2], ['list', List]].map(([mode, Icon]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                style={{ width: 36, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: 'none', cursor: 'pointer', background: viewMode === mode ? '#fff' : 'transparent', color: viewMode === mode ? '#0f172a' : '#94a3b8', transition: 'all .15s', boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ height: 200, borderRadius: 18, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', backgroundSize: '400% 100%', animation: 'shimmer 1.5s ease infinite', border: '1.5px solid #e2e8f0' }} />
            ))}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '72px 24px', background: '#fff', borderRadius: 22, border: '1.5px dashed #e2e8f0' }}>
            <div style={{ width: 64, height: 64, background: '#f8fafc', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <FolderOpen size={28} color="#cbd5e1" />
            </div>
            <p style={{ fontWeight: 700, fontSize: 17, color: '#334155', marginBottom: 6 }}>{search ? 'No results found' : 'No projects yet'}</p>
            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 22 }}>{search ? `No projects match "${search}"` : 'Create your first room design to get started'}</p>
            {!search && (
              <button onClick={() => setShowNew(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', background: '#f59e0b', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 700, color: '#1a1208', cursor: 'pointer' }}>
                <Plus size={15} /> Create Project
              </button>
            )}
          </div>
        )}

        {/* ── Grid view ── */}
        {!loading && filtered.length > 0 && viewMode === 'grid' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
            {filtered.map(p => {
              let config = {}
              try { config = JSON.parse(p.roomConfig) } catch {}
              return (
                <div key={p.id}
                  style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', transition: 'all .2s', position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}
                  onClick={() => navigate(`/workspace/2d/${p.id}`)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#fcd34d'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(245,158,11,.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.04)'; e.currentTarget.style.transform = 'none' }}>
                  {/* Thumbnail */}
                  <div style={{ height: 130, position: 'relative', background: p.thumbnailUrl ? `url(${p.thumbnailUrl}) center/cover` : `linear-gradient(135deg,${config.wallColor || '#F5F5F0'}dd,${config.wallColor || '#E8E4DC'}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {!p.thumbnailUrl && (
                      <>
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)', backgroundSize: '16px 16px' }} />
                        <span style={{ fontSize: 36, position: 'relative' }}>{FLOOR_ICONS[config.floorTexture] || '🏠'}</span>
                      </>
                    )}
                    {/* 2D/3D buttons on hover */}
                    <div className="card-actions" style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0, transition: 'opacity .2s' }}>
                      <button onClick={e => { e.stopPropagation(); navigate(`/workspace/2d/${p.id}`) }}
                        style={{ background: '#fff', color: '#0f172a', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        2D
                      </button>
                      <button onClick={e => { e.stopPropagation(); navigate(`/workspace/3d/${p.id}`) }}
                        style={{ background: '#f59e0b', color: '#1a1208', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        3D
                      </button>
                    </div>
                    {/* Menu */}
                    <div style={{ position: 'absolute', top: 8, right: 8 }} ref={menuId === p.id ? menuRef : null}>
                      <button onClick={e => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id) }}
                        style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.9)', border: 'none', borderRadius: 7, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                        <MoreVertical size={13} color="#334155" />
                      </button>
                      {menuId === p.id && (
                        <div style={{ position: 'absolute', top: 32, right: 0, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '6px', zIndex: 10, minWidth: 140, boxShadow: '0 8px 32px rgba(0,0,0,.12)', animation: 'fadeIn .15s ease both' }}>
                          <button onClick={e => { e.stopPropagation(); setMenuId(null); navigate(`/workspace/2d/${p.id}`) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#334155', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            <Layers size={13} color="#94a3b8" /> Open 2D
                          </button>
                          <button onClick={e => { e.stopPropagation(); setMenuId(null); navigate(`/workspace/3d/${p.id}`) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#334155', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            <Box size={13} color="#94a3b8" /> Open 3D
                          </button>
                          <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                          <button onClick={e => { e.stopPropagation(); setMenuId(null); handleDelete(p.id) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#ef4444', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px' }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                    <p style={{ fontSize: 12, color: '#94a3b8' }}>{config.width || 5}m × {config.depth || 4}m · <span style={{ textTransform: 'capitalize' }}>{config.shape || 'Rectangle'}</span></p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── List view ── */}
        {!loading && filtered.length > 0 && viewMode === 'list' && (
          <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9', padding: '10px 20px', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16 }}>
              {['Project', 'Size', 'Actions'].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.07em' }}>{h}</span>
              ))}
            </div>
            {filtered.map((p, i) => {
              let config = {}
              try { config = JSON.parse(p.roomConfig) } catch {}
              return (
                <div key={p.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none', cursor: 'pointer', transition: 'background .1s' }}
                  onClick={() => navigate(`/workspace/2d/${p.id}`)}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafaf8'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg,${config.wallColor || '#F5F5F0'},#e8e3da)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {FLOOR_ICONS[config.floorTexture] || '🏠'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                    <p style={{ fontSize: 12, color: '#94a3b8', textTransform: 'capitalize' }}>{config.shape || 'Rectangle'} · {FLOOR_ICONS[config.floorTexture] || ''} {config.floorTexture || 'wood'} floor</p>
                  </div>
                  <span style={{ fontSize: 12, color: '#64748b', flexShrink: 0 }}>{config.width || 5}m × {config.depth || 4}m</span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => navigate(`/workspace/2d/${p.id}`)}
                      style={{ padding: '6px 12px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Layers size={11} /> 2D
                    </button>
                    <button onClick={() => navigate(`/workspace/3d/${p.id}`)}
                      style={{ padding: '6px 12px', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#92400e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Box size={11} /> 3D
                    </button>
                    <button onClick={() => handleDelete(p.id)}
                      style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <Trash2 size={13} color="#f87171" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        div:hover .card-actions { opacity: 1 !important; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AppLayout>
  )
}