import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore, userApi } from './store/authStore'
import './index.css'

import LandingPage    from './pages/LandingPage'
import LoginPage      from './pages/LoginPage'
import RegisterPage   from './pages/RegisterPage'
import UserDashboard  from './pages/UserDashboard'
import ProjectManager from './pages/ProjectManager'
import AdminDashboard from './pages/AdminDashboard'
import Workspace2D    from './pages/Workspace2D'
import Workspace3D    from './pages/Workspace3D'

// ─── Error Boundary ──────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Inter,sans-serif', background:'#f8f9fa', padding:'24px' }}>
        <div style={{ maxWidth:480, textAlign:'center' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
          <h2 style={{ fontSize:20, fontWeight:700, color:'#212529', marginBottom:8 }}>Something went wrong</h2>
          <p style={{ color:'#868e96', marginBottom:24, fontSize:14 }}>
            Open the browser console (F12) for the full error.
          </p>
          <pre style={{ background:'#fff', border:'1px solid #dee2e6', borderRadius:12, padding:16,
                        fontSize:12, textAlign:'left', overflowX:'auto', color:'#e03131' }}>
            {this.state.error?.message}
          </pre>
          <button onClick={() => window.location.reload()}
            style={{ marginTop:20, background:'#4c6ef5', color:'#fff', border:'none',
                     padding:'10px 24px', borderRadius:10, cursor:'pointer', fontWeight:600 }}>
            Reload page
          </button>
        </div>
      </div>
    )
  }
}

// ─── Route guards ─────────────────────────────────────────────────────────────
function PrivateRoute({ children, adminOnly = false }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/" replace />
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />
  return children
}

function PublicOnlyRoute({ children }) {
  const { user } = useAuthStore()
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

function AuthInitializer() {
  const { logout } = useAuthStore()
  React.useEffect(() => {
    logout()
    localStorage.removeItem('rc_token')
    localStorage.removeItem('rc_user')
  }, [logout])
  return null
}

// ─── App ──────────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthInitializer />
        <Routes>
          <Route path="/"         element={<LandingPage />} />
          <Route path="/login"    element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

          <Route path="/dashboard" element={<PrivateRoute><UserDashboard /></PrivateRoute>} />
          <Route path="/projects"  element={<PrivateRoute><ProjectManager /></PrivateRoute>} />
          <Route path="/admin"     element={<PrivateRoute adminOnly><AdminDashboard /></PrivateRoute>} />

          <Route path="/workspace/2d/:id" element={<PrivateRoute><Workspace2D /></PrivateRoute>} />
          <Route path="/workspace/3d/:id" element={<PrivateRoute><Workspace3D /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '12px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          },
          success: { iconTheme: { primary: '#4c6ef5', secondary: '#fff' } },
        }}
      />
    </ErrorBoundary>
  </React.StrictMode>
)
