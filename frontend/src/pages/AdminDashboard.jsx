import React, { useEffect, useState } from 'react'
import { adminApi, furnitureApi, FURNITURE_LIBRARY } from '../store/authStore'
import AppLayout from '../components/shared/AppLayout'
import toast from 'react-hot-toast'
import { Users, FolderOpen, Sofa, Shield, ToggleLeft, ToggleRight, Trash2, Plus, X, Search, BarChart3 } from 'lucide-react'

const CATEGORIES = ['Seating','Tables','Bedroom','Storage','Office','Lighting','Bathroom','Kitchen','Living Room','Decor']
const CAT_EMOJI  = { Seating:'🪑',Tables:'🪵',Bedroom:'🛏️',Storage:'🗄️',Office:'💼',Lighting:'💡',Bathroom:'🚿',Kitchen:'🍳','Living Room':'🛋️',Decor:'🪴' }

export default function AdminDashboard() {
  const [stats,    setStats]    = useState(null)
  const [users,    setUsers]    = useState([])
  const [furniture,setFurniture]= useState([])
  const [tab,      setTab]      = useState('overview')
  const [search,   setSearch]   = useState('')
  const [showAdd,  setShowAdd]  = useState(false)
  const [newF,     setNewF]     = useState({ name:'', category:'Seating', width:1.0, height:0.9, depth:0.8 })

  useEffect(() => {
    adminApi.getStats().then(setStats).catch(()=>{})
    adminApi.getUsers().then(setUsers).catch(()=>{})
    furnitureApi.getAll().then(setFurniture).catch(()=>{})
  }, [])

  const toggleUser = (id) => {
    setUsers(u => u.map(x => x.id===id ? {...x,active:!x.active} : x))
    toast.success('User status updated')
  }

  const deleteUser = (id) => {
    if (!confirm('Delete this user?')) return
    setUsers(u => u.filter(x => x.id!==id))
    toast.success('User removed')
  }

  const addFurniture = () => {
    if (!newF.name.trim()) { toast.error('Name required'); return }
    const item = { ...newF, id: Date.now(), active: true }
    setFurniture(f => [...f, item])
    setShowAdd(false)
    setNewF({ name:'', category:'Seating', width:1.0, height:0.9, depth:0.8 })
    toast.success('Added to library!')
  }

  const deleteFurniture = (id) => {
    setFurniture(f => f.filter(x => x.id!==id))
    toast.success('Removed')
  }

  const filteredUsers = users.filter(u =>
    (u.username||'').toLowerCase().includes(search.toLowerCase()) ||
    (u.email||'').toLowerCase().includes(search.toLowerCase())
  )

  const tabs = [
    { id:'overview', label:'Overview',              icon:BarChart3 },
    { id:'users',    label:`Users (${users.length})`, icon:Users   },
    { id:'furniture',label:`Furniture (${furniture.length})`, icon:Sofa },
  ]

  return (
    <AppLayout title="Admin Dashboard">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-surface-900">Admin Dashboard</h1>
            <p className="text-surface-500 text-sm">Manage users, content, and settings</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-100 p-1 rounded-xl mb-6 w-fit">
          {tabs.map(({ id, label, icon:Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab===id ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab==='overview' && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                { icon:Users,      label:'Total Users',     value:stats?.totalUsers,    color:'bg-blue-50 text-blue-600' },
                { icon:FolderOpen, label:'Total Projects',  value:stats?.totalProjects, color:'bg-green-50 text-green-600' },
                { icon:Sofa,       label:'Furniture Models',value:stats?.totalFurniture,color:'bg-purple-50 text-purple-600' },
              ].map(({ icon:Icon, label, value, color }) => (
                <div key={label} className="stat-card">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-6 h-6" /></div>
                  <div><p className="text-3xl font-bold text-surface-900">{value ?? '—'}</p><p className="text-sm text-surface-500 mt-0.5">{label}</p></div>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card p-5">
                <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-surface-400" /> Recent Users</h3>
                <div className="space-y-2">
                  {users.slice(0,5).map(u => (
                    <div key={u.id} className="flex items-center gap-3 py-1.5">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm flex-shrink-0">
                        {(u.username||'?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 truncate">{u.username}</p>
                        <p className="text-xs text-surface-400 truncate">{u.email}</p>
                      </div>
                      <span className={`badge text-xs ${u.role==='ADMIN'?'badge-blue':'badge-green'}`}>{u.role}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-5">
                <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2"><Sofa className="w-4 h-4 text-surface-400" /> By Category</h3>
                {CATEGORIES.map(cat => {
                  const count = furniture.filter(f => f.category===cat).length
                  if (!count) return null
                  const pct = Math.round((count/Math.max(furniture.length,1))*100)
                  return (
                    <div key={cat} className="flex items-center gap-3 mb-2">
                      <span className="text-xs text-surface-600 w-28 flex-shrink-0">{cat}</span>
                      <div className="flex-1 bg-surface-100 rounded-full h-1.5">
                        <div className="bg-brand-500 h-1.5 rounded-full" style={{ width:`${pct}%` }} />
                      </div>
                      <span className="text-xs text-surface-400 w-4 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Users */}
        {tab==='users' && (
          <div className="animate-fade-in">
            <div className="relative mb-4 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input className="input-field pl-10 text-sm" placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200">
                    {['User','Email','Role','Status','Actions'].map(h => (
                      <th key={h} className={`text-left px-5 py-3.5 text-xs font-semibold text-surface-500 uppercase tracking-wider ${h==='Email'?'hidden md:table-cell':''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm flex-shrink-0">
                            {(u.username||'?')[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-surface-900 text-sm">{u.username}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-surface-500 hidden md:table-cell">{u.email}</td>
                      <td className="px-5 py-4"><span className={`badge text-xs ${u.role==='ADMIN'?'badge-blue':'badge-green'}`}>{u.role}</span></td>
                      <td className="px-5 py-4"><span className={`badge text-xs ${u.active?'badge-green':'badge-red'}`}>{u.active?'Active':'Disabled'}</span></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => toggleUser(u.id)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400">
                            {u.active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          {u.role!=='ADMIN' && (
                            <button onClick={() => deleteUser(u.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Furniture */}
        {tab==='furniture' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-surface-500">{furniture.length} models</p>
              <button onClick={() => setShowAdd(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add Model</button>
            </div>
            {showAdd && (
              <div className="card p-5 mb-4 border-brand-200 bg-brand-50/30 animate-slide-up">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-surface-900">Add Furniture</h3>
                  <button onClick={() => setShowAdd(false)} className="text-surface-400"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-medium text-surface-600 mb-1">Name</label>
                    <input className="input-field text-sm" placeholder="e.g. Modern Sofa"
                      value={newF.name} onChange={e => setNewF(f=>({...f,name:e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">Category</label>
                    <select className="input-field text-sm" value={newF.category} onChange={e => setNewF(f=>({...f,category:e.target.value}))}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  {[['Width','width'],['Height','height'],['Depth','depth']].map(([l,k]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-surface-600 mb-1">{l} (m)</label>
                      <input type="number" step="0.1" min="0.1" className="input-field text-sm"
                        value={newF[k]} onChange={e => setNewF(f=>({...f,[k]:parseFloat(e.target.value)}))} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setShowAdd(false)} className="btn-secondary text-sm">Cancel</button>
                  <button onClick={addFurniture} className="btn-primary text-sm">Add</button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {furniture.map(f => (
                <div key={f.id} className="card p-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-surface-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                      {CAT_EMOJI[f.category]||'📦'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-surface-900 text-sm truncate">{f.name}</p>
                      <p className="text-xs text-surface-400">{f.category} · {f.width}×{f.height}×{f.depth}m</p>
                    </div>
                  </div>
                  <button onClick={() => deleteFurniture(f.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-surface-300 hover:text-red-500 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
