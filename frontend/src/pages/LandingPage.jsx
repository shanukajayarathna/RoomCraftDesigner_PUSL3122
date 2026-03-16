import React, { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { ArrowRight, Layers, Boxes, Move3D, Sparkles, Github, ChevronRight } from 'lucide-react'

const features = [
  { icon: Layers,   title: '2D Floor Planner',    desc: 'Draw rooms with drag-and-drop precision. Set walls, doors, and windows on an intuitive grid.' },
  { icon: Boxes,    title: '3D Visualization',    desc: 'Instantly switch to a photorealistic 3D view powered by Three.js with dynamic lighting.' },
  { icon: Move3D,   title: 'Furniture Library',   desc: 'Browse 100+ furniture models across categories. Drag directly into your design.' },
  { icon: Sparkles, title: 'Smart Snapping',      desc: 'Grid and wall snapping keeps everything perfectly aligned, automatically.' },
]

const rooms = [
  { name: 'Living Room',  color: '#e8f0fe', accent: '#3b6ef6', emoji: '🛋️' },
  { name: 'Bedroom',      color: '#fef3e2', accent: '#f59e0b', emoji: '🛏️' },
  { name: 'Kitchen',      color: '#e6faf0', accent: '#10b981', emoji: '🍳' },
  { name: 'Office',       color: '#fde8f0', accent: '#ec4899', emoji: '💼' },
]

export default function LandingPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const canvasRef = useRef(null)

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user])

  // Animated dots background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const dots = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.4 + 0.1,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy
        if (d.x < 0) d.x = canvas.width
        if (d.x > canvas.width) d.x = 0
        if (d.y < 0) d.y = canvas.height
        if (d.y > canvas.height) d.y = 0
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(59,110,246,${d.opacity})`
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-semibold text-lg text-surface-900">RoomCraft</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-ghost text-sm">Sign In</Link>
            <Link to="/register" className="btn-primary text-sm">Get Started <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 px-4 py-2 rounded-full text-sm font-medium mb-8 border border-brand-100">
            <Sparkles className="w-3.5 h-3.5" />
            Final Year Software Engineering Project
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold text-surface-950 leading-tight mb-6">
            Design your dream room
            <br />
            <span className="text-brand-600">in 2D & 3D</span>
          </h1>
          <p className="text-xl text-surface-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            RoomCraft Designer is a professional interior design tool. Plan rooms in 2D, visualize in real-time 3D, and furnish with a rich model library.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="btn-primary text-base px-8 py-3.5">
              Start designing free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/login" className="btn-secondary text-base px-8 py-3.5">
              Sign in to continue
            </Link>
          </div>
        </div>

        {/* Room type cards */}
        <div className="max-w-4xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {rooms.map(r => (
              <div key={r.name}
                className="rounded-2xl p-5 text-center cursor-pointer hover:scale-105 transition-transform duration-200 border"
                style={{ backgroundColor: r.color, borderColor: r.accent + '30' }}>
                <div className="text-3xl mb-2">{r.emoji}</div>
                <div className="font-semibold text-sm text-surface-800">{r.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-y border-surface-200 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-surface-900 mb-4">
              Everything you need to design
            </h2>
            <p className="text-surface-500 text-lg max-w-xl mx-auto">
              A complete suite of tools for professional interior design, built with modern web technology.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group p-6 rounded-2xl border border-surface-200 hover:border-brand-200 hover:bg-brand-50/50 transition-all duration-200">
                <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-200 transition-colors">
                  <Icon className="w-5 h-5 text-brand-600" />
                </div>
                <h3 className="font-semibold text-surface-900 mb-2">{title}</h3>
                <p className="text-surface-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-brand-600">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to start designing?
          </h2>
          <p className="text-brand-200 text-lg mb-8">
            Create a free account and design your first room in minutes.
          </p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-brand-50 transition-colors">
            Create free account <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-950 text-surface-400 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
              <Boxes className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold">RoomCraft Designer</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
