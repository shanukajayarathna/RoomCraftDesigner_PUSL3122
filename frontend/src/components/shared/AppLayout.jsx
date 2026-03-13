import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  Boxes, LayoutDashboard, FolderOpen, Shield,
  LogOut, Menu, X, ChevronRight, User
} from 'lucide-react'

const NAV_USER = [
  { to: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/projects',  label: 'My Projects', icon: FolderOpen },
]

const NAV_ADMIN = [
  { to: '/admin', label: 'Admin Panel', icon: Shield },
]

export default function AppLayout({ children, title }) {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const nav = user?.role === 'ADMIN' ? [...NAV_USER, ...NAV_ADMIN] : NAV_USER

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const Sidebar = () => (
    <aside className="flex flex-col w-64 h-full bg-white border-r border-surface-200">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-surface-100">
        <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center">
          <Boxes className="w-5 h-5 text-white" />
        </div>
        <span className="font-display font-semibold text-surface-900">RoomCraft</span>
      </div>

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
          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-brand-600" />
          </div>
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
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
              <Boxes className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-semibold text-sm text-surface-900">
              {title || 'RoomCraft'}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
