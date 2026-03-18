import React, { useState, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore, userApi } from '../../store/authStore'
import {
  Boxes, LayoutDashboard, FolderOpen, Shield,
  LogOut, Menu, X, ChevronRight, User, Upload, ShieldCheck
} from 'lucide-react'
import toast from 'react-hot-toast'

const NAV_USER = [
  { to: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/projects',  label: 'My Projects', icon: FolderOpen },
]

const NAV_ADMIN = [
  { to: '/admin', label: 'Admin Panel', icon: Shield },
]

export default function AppLayout({ children, title }) {
  const { user, logout, setUser } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState({ username: user?.username || '', email: user?.email || '', currentPassword: '', newPassword: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef(null)

  const openProfile = () => {
    setProfileForm({ username: user?.username || '', email: user?.email || '', currentPassword: '', newPassword: '' })
    setProfileOpen(true)
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const updated = await userApi.updateProfile(profileForm)
      const next = { ...user, username: updated.username, email: updated.email }
      localStorage.setItem('rc_user', JSON.stringify(next))
      setUser(next)
      setProfileOpen(false)
    } catch (e) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSavingProfile(false)
    }
  }

  const uploadAvatar = async (file) => {
    if (!file) return
    setUploadingAvatar(true)
    try {
      const form = new FormData(); form.append('avatar', file)
      const data = await userApi.uploadAvatar(form)
      const next = { ...user, avatarUrl: data.avatarUrl }
      localStorage.setItem('rc_user', JSON.stringify(next))
      setUser(next)
      toast.success('Avatar uploaded')
    } catch (e) {
      toast.error(e.message || 'Upload failed')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const nav = user?.role === 'ADMIN' ? [...NAV_USER, ...NAV_ADMIN] : NAV_USER

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleGoLanding = () => {
    try {
      window.dispatchEvent(new CustomEvent('roomcraft-save-request'))
    } catch (e) {
      console.warn('Save event dispatch failed', e)
    }
    setTimeout(() => {
      logout()
      navigate('/')
    }, 250)
  }

  const Sidebar = () => (
    <aside className="flex flex-col w-64 h-full bg-white border-r border-surface-200">
      {/* Logo */}
      <button onClick={handleGoLanding} className="flex items-center gap-2.5 px-5 py-4 border-b border-surface-100 text-left w-full">
        <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center">
          <Boxes className="w-5 h-5 text-white" />
        </div>
        <span className="font-display font-semibold text-surface-900">RoomCraft</span>
      </button>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={`nav-item ${location.pathname === to ? 'active' : ''}`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User card */}
      <div className="p-3 border-t border-surface-100">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
          <button onClick={openProfile} className="w-10 h-10 rounded-full overflow-hidden border border-surface-200 bg-white flex items-center justify-center">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              : <User className="w-5 h-5 text-brand-600" />
            }
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-surface-900 truncate">{user?.username}</p>
            <p className="text-xs text-surface-500 truncate capitalize">{user?.role?.toLowerCase()}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 z-50">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-surface-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-surface-500 hover:bg-surface-100 rounded-xl"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button onClick={handleGoLanding} className="flex items-center gap-2 text-left">
            <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
              <Boxes className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-semibold text-sm text-surface-900">
              {title || 'RoomCraft'}
            </span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 lg:px-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-surface-400">Profile</p>
              <h1 className="text-xl font-semibold text-surface-900">{title || 'RoomCraft Dashboard'}</h1>
            </div>
            <button onClick={openProfile} className="flex items-center gap-2 px-3 py-2 border border-surface-200 rounded-full hover:border-brand-300">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-100 border">
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} className="w-full h-full object-cover" alt="Profile" />
                  : <User className="w-5 h-5 text-surface-500 m-auto" />
                }
              </div>
              <span className="text-sm font-medium text-surface-700">{user?.username}</span>
            </button>
          </div>
          {children}
        </main>
      </div>

      {profileOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-surface-200 shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold">My Profile</h2>
                <p className="text-xs text-surface-500">Edit username, email, password and avatar</p>
              </div>
              <button onClick={() => setProfileOpen(false)} className="p-1.5 text-surface-500 hover:bg-surface-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-surface-500">Username</label>
                <input className="input-field w-full" value={profileForm.username} onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-surface-500">Email</label>
                <input className="input-field w-full" type="email" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-surface-500">Current Password (required to change password)</label>
                <input className="input-field w-full" type="password" value={profileForm.currentPassword} onChange={e => setProfileForm(f => ({ ...f, currentPassword: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-surface-500">New Password</label>
                <input className="input-field w-full" type="password" value={profileForm.newPassword} onChange={e => setProfileForm(f => ({ ...f, newPassword: e.target.value }))} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => avatarInputRef.current?.click()} className="btn-secondary flex items-center gap-2 text-xs py-2 px-3">
                  <Upload className="w-3.5 h-3.5" /> Upload Avatar
                </button>
                <button onClick={async () => {
                  try {
                    await userApi.deleteAvatar();
                    const next = { ...user, avatarUrl: null };
                    localStorage.setItem('rc_user', JSON.stringify(next));
                    setUser(next);
                    toast.success('Profile picture removed');
                  } catch (e) {
                    toast.error(e.message || 'Remove failed');
                  }
                }} disabled={!user?.avatarUrl} className="btn-tertiary text-xs py-2 px-3">
                  Remove Avatar
                </button>
                <button onClick={saveProfile} disabled={savingProfile} className="btn-primary text-xs py-2 px-3">
                  {savingProfile ? 'Saving…' : 'Save Profile'}
                </button>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
