import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Boxes, Eye, EyeOff, UserPlus } from 'lucide-react'

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [show, setShow] = useState(false)
  const { register, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    try {
      const user = await register(form.username, form.email, form.password)
      toast.success(`Welcome to RoomCraft, ${user.username}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Registration failed')
    }
  }

  const field = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleLogoLanding = () => {
    try {
      window.dispatchEvent(new CustomEvent('roomcraft-save-request'))
    } catch (e) {
      console.warn('Save dispatch failed', e)
    }
    toast.success('Saved')
    navigate('/')
  }

  return (
  <div className="min-h-screen flex">
    {/* Left panel */}
    <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
      <img
        src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=900&auto=format&fit=crop&q=80"
        alt="Interior design"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/80 to-slate-900/60 flex flex-col justify-end p-12">
        <button onClick={handleLogoLanding} className="flex items-center gap-2.5 mb-auto pt-8 text-left">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur">
            <Boxes className="text-white" style={{width:'16px',height:'16px'}} />
          </div>
          <span className="text-white font-semibold">RoomCraft</span>
        </button>
        <p className="text-white font-bold text-2xl mb-3">Start designing for free.</p>
        <p className="text-indigo-200 text-sm leading-relaxed">Join thousands of designers using RoomCraft to plan, visualize, and perfect their spaces.</p>
      </div>
    </div>

    {/* Right panel */}
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 lg:hidden">
          <button onClick={handleLogoLanding} className="inline-flex items-center gap-2">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Boxes className="text-white" style={{width:'16px',height:'16px'}} />
            </div>
            <span className="font-semibold text-slate-900">RoomCraft</span>
          </button>
          <button onClick={handleLogoLanding} className="mt-3 inline-flex items-center justify-center text-xs font-medium text-slate-500 hover:text-slate-700 transition">
            Back to landing
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="mb-3 text-right">
            <button onClick={handleLogoLanding} className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition">
              ← Back to landing
            </button>
          </div>
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Create your account</h1>
            <p className="text-slate-500 text-sm">Start designing beautiful rooms for free</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
              <input type="text" className="input-field" placeholder="Choose a username"
                value={form.username} onChange={field('username')} required minLength={3} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" className="input-field" placeholder="you@example.com"
                value={form.email} onChange={field('email')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} className="input-field pr-12"
                  placeholder="At least 6 characters" value={form.password}
                  onChange={field('password')} required minLength={6} />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
              <input type={show ? 'text' : 'password'} className="input-field"
                placeholder="Repeat your password" value={form.confirm}
                onChange={field('confirm')} required />
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-3 mt-1">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> Create Account
                </span>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  </div>
)
}
