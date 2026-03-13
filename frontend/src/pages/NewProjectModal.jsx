import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, X } from 'lucide-react'

const SHAPES = ['rectangle', 'square', 'l-shape']
const FLOORS = ['wood', 'carpet', 'tile', 'marble', 'concrete']
const FLOOR_ICONS = { wood: '🪵', carpet: '🟫', tile: '⬜', marble: '⬛', concrete: '🩶' }

export default function NewProjectModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    name: 'My Room Design', description: '',
    shape: 'rectangle', width: 5, depth: 4, height: 2.8,
    wallColor: '#F5F5F0', floorTexture: 'wood',
  })
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
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
    } catch (err) {
      toast.error('Failed to create project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-surface-200">
          <h2 className="font-display text-xl font-bold text-surface-900">New Room Project</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Project Name</label>
            <input className="input-field" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Living Room Redesign" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Description (optional)</label>
            <textarea className="input-field resize-none h-16" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Room Shape</label>
            <div className="flex gap-2">
              {SHAPES.map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, shape: s }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all capitalize ${
                    form.shape === s ? 'bg-brand-600 text-white border-brand-600' : 'border-surface-200 text-surface-600 hover:border-brand-300'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['Width (m)', 'width'], ['Depth (m)', 'depth'], ['Height (m)', 'height']].map(([l, k]) => (
              <div key={k}>
                <label className="block text-xs font-medium text-surface-600 mb-1">{l}</label>
                <input type="number" className="input-field text-sm py-2" min="2" max="20" step="0.5"
                  value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Wall Color</label>
              <div className="flex gap-2">
                <input type="color" className="w-10 h-10 rounded-lg border border-surface-200 cursor-pointer p-0.5"
                  value={form.wallColor} onChange={e => setForm(f => ({ ...f, wallColor: e.target.value }))} />
                <input className="input-field flex-1 text-sm" value={form.wallColor}
                  onChange={e => setForm(f => ({ ...f, wallColor: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Floor</label>
              <select className="input-field text-sm" value={form.floorTexture}
                onChange={e => setForm(f => ({ ...f, floorTexture: e.target.value }))}>
                {FLOORS.map(f => (
                  <option key={f} value={f}>{FLOOR_ICONS[f]} {f.charAt(0).toUpperCase() + f.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="btn-primary">
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Plus className="w-4 h-4" />}
            Create Project
          </button>
        </div>
      </div>
    </div>
  )
}
