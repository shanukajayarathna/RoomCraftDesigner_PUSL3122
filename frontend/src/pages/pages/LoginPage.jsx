import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Boxes, Eye, EyeOff, LogIn } from 'lucide-react'

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [show, setShow] = useState(false)
  const { login, isLoading } = useAuthStore()
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
    <div className="min-h-screen bg-gradient-to-br from-surface-100 via-white to-brand-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center group-hover:bg-brand-700 transition-colors">
              <Boxes className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-semibold text-xl text-surface-900">RoomCraft</span>
          </Link>
        </div>

        <div className="card p-8 shadow-lg shadow-surface-200/50">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-surface-900 mb-1">Welcome back</h1>
            <p className="text-surface-500 text-sm">Sign in to your account to continue designing</p>
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
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Username</label>
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
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Password</label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors">
                  {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-3">
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

          <p className="text-center text-sm text-surface-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-600 hover:text-brand-700 font-medium">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
