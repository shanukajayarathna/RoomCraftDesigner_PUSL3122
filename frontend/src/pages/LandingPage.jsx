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
  <div className="min-h-screen bg-white">
    {/* NAV */}
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm shadow-indigo-200">
            <Boxes className="w-4.5 h-4.5 text-white" style={{width:'18px',height:'18px'}} />
          </div>
          <span className="font-semibold text-lg tracking-tight text-slate-900">RoomCraft</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5">Sign In</Link>
          <Link to="/register" className="inline-flex items-center gap-1.5 text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
            Get Started <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </nav>

    {/* HERO */}
    <section className="relative overflow-hidden bg-slate-950 min-h-[88vh] flex items-center">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1800&auto=format&fit=crop&q=80"
          alt="Modern interior"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
      </div>
      {/* Animated subtle grid */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-40" />

      <div className="relative max-w-7xl mx-auto px-6 py-28 w-full">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 px-3.5 py-1.5 rounded-full text-xs font-medium mb-8 tracking-wide uppercase">
            <Sparkles className="w-3 h-3" />
            Interior Design Platform
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.08] tracking-tight mb-6">
            Design rooms<br />
            <span className="text-indigo-400">beautifully.</span>
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-xl">
            Plan in 2D, visualize in real-time 3D, and furnish with a curated library of 100+ models. Professional interior design, right in your browser.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Link to="/register" className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/40 text-sm">
              Start designing free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 text-slate-300 hover:text-white font-medium px-6 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 transition-all text-sm">
              Sign in to continue
            </Link>
          </div>
          {/* Social proof */}
          <div className="flex items-center gap-4 mt-10 pt-10 border-t border-slate-800">
            {[['2D & 3D','Workspaces'],['100+','Furniture Models'],['Real-time','3D Preview']].map(([val, lbl]) => (
              <div key={lbl} className="pr-4 border-r border-slate-800 last:border-0">
                <p className="text-white font-bold text-lg leading-none">{val}</p>
                <p className="text-slate-500 text-xs mt-1">{lbl}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* ROOM TYPE STRIP */}
    <section className="bg-white py-16 border-b border-slate-100">
      <div className="max-w-5xl mx-auto px-6">
        <p className="text-center text-xs text-slate-400 uppercase tracking-widest font-semibold mb-8">Design any space</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name:'Living Room', img:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&auto=format&fit=crop&q=70', emoji:'🛋️' },
            { name:'Bedroom',     img:'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=400&auto=format&fit=crop&q=70', emoji:'🛏️' },
            { name:'Kitchen',    img:'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&auto=format&fit=crop&q=70', emoji:'🍳' },
            { name:'Office',     img:'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&auto=format&fit=crop&q=70', emoji:'💼' },
          ].map(r => (
            <div key={r.name} className="group relative rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer">
              <img src={r.img} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
              <div className="absolute bottom-0 left-0 p-4">
                <p className="text-white font-semibold text-sm">{r.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* FEATURES */}
    <section className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
            Everything you need to design
          </h2>
          <p className="text-slate-500 text-lg max-w-lg mx-auto">
            A complete suite of professional tools built with modern web technology.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50 transition-all duration-200">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                <Icon className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2 text-sm">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* FULL-WIDTH IMAGE BREAK */}
    <section className="relative h-72 md:h-96 overflow-hidden">
      <img
        src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1800&auto=format&fit=crop&q=80"
        alt="Modern room interior"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-indigo-950/50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-indigo-200 text-sm uppercase tracking-widest font-semibold mb-3">Powered by Three.js</p>
          <h2 className="text-white text-3xl md:text-4xl font-bold">Real-time 3D visualization</h2>
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-24 bg-indigo-600">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
          Ready to start designing?
        </h2>
        <p className="text-indigo-200 text-lg mb-8">
          Create a free account and design your first room in minutes.
        </p>
        <Link to="/register" className="inline-flex items-center gap-2 bg-white text-indigo-700 font-bold px-8 py-3.5 rounded-xl hover:bg-indigo-50 transition-colors shadow-xl shadow-indigo-800/30 text-sm">
          Create free account <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </section>

    {/* FOOTER */}
    <footer className="bg-slate-950 text-slate-500 py-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Boxes className="text-white" style={{width:'14px',height:'14px'}} />
          </div>
          <span className="text-white font-semibold text-sm">RoomCraft</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span>© {new Date().getFullYear()} RoomCraft. All rights reserved.</span>
        </div>
      </div>
    </footer>
  </div>
)
}
