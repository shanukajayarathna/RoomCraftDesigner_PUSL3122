import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Boxes, Eye, EyeOff, LogIn } from 'lucide-react'

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [show, setShow] = useState(false)
  const { login, logout, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const user = await login(form.username, form.password)
      toast.success(`Welcome back, ${user.username}!`)
      navigate(user.role === 'ADMIN' ? '/admin' : '/dashboard')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const fillDemo = (role) => {
    if (role === 'admin') setForm({ username: 'admin', password: 'admin123' })
    else setForm({ username: 'demo', password: 'demo123' })
  }

  return (
  <div className="min-h-screen flex">
    {/* Left panel — image */}
    <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
      <img
        src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&auto=format&fit=crop&q=80"
        alt="Interior"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/80 to-slate-900/60 flex flex-col justify-end p-12">
        <div className="flex items-center gap-2.5 mb-auto pt-8">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur">
            <Boxes className="text-white" style={{width:'16px',height:'16px'}} />
          </div>
          <span className="text-white font-semibold">RoomCraft</span>
        </div>
        <blockquote className="text-white/90 text-lg font-medium leading-relaxed mb-4">
          "Design your dream space with professional tools, right in your browser."
        </blockquote>
        <p className="text-indigo-300 text-sm">2D planning · 3D visualization · Furniture library</p>
      </div>
    </div>

    {/* Right panel — form */}
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 lg:hidden">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Boxes className="text-white" style={{width:'16px',height:'16px'}} />
            </div>
            <span className="font-semibold text-slate-900">RoomCraft</span>
          </Link>
          <button onClick={() => { logout(); navigate('/') }}
            className="mt-3 text-xs font-medium text-slate-500 hover:text-slate-700 transition">
            Back to landing (logout)
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="mb-3 text-right">
            <button onClick={() => { logout(); navigate('/') }} className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition">
              ← Back to landing (logout)
            </button>
          </div>
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Welcome back</h1>
            <p className="text-slate-500 text-sm">Sign in to your account to continue designing</p>
          </div>

          {/* Quick fill buttons */}
          <div className="flex gap-2 mb-6 p-3 bg-amber-50 rounded-xl border border-amber-100">
            <div className="flex-1">
              <p className="text-xs text-amber-700 font-medium mb-2">Quick demo access:</p>
              <div className="flex gap-2">
                <button onClick={() => fillDemo('user')} className="flex-1 text-xs bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors font-medium">
                  User Demo
                </button>
                <button onClick={() => fillDemo('admin')} className="flex-1 text-xs bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors font-medium">
                  Admin Demo
                </button>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter your username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  className="input-field pr-12"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-3 mt-1">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" /> Sign In
                </span>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  </div>
)
}
