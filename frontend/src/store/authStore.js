import { create } from 'zustand'

// ─── API base ────────────────────────────────────────────────────────────────

const BASE = '/api'

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('rc_token')
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => 'Request failed')
    throw new Error(text || `HTTP ${res.status}`)
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

// Backend returns: { token, username, email, role, userId }
// We normalise it into a { user, token } shape the frontend expects
function normaliseAuthResponse(data) {
  const user = {
    id:       data.userId   ?? data.id,
    username: data.username,
    email:    data.email,
    role:     data.role,
  }
  return { user, token: data.token }
}

// ─── Auth store ───────────────────────────────────────────────────────────────

export const useAuthStore = create((set) => ({
  user: (() => {
    try { return JSON.parse(localStorage.getItem('rc_user')) } catch { return null }
  })(),
  isLoading: false,
  token: localStorage.getItem('rc_token') || null,

  login: async (username, password) => {
    set({ isLoading: true })
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      const { user, token } = normaliseAuthResponse(data)
      localStorage.setItem('rc_token', token)
      localStorage.setItem('rc_user', JSON.stringify(user))
      set({ user, token, isLoading: false })
      return user
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true })
    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      })
      const { user, token } = normaliseAuthResponse(data)
      localStorage.setItem('rc_token', token)
      localStorage.setItem('rc_user', JSON.stringify(user))
      set({ user, token, isLoading: false })
      return user
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('rc_token')
    localStorage.removeItem('rc_user')
    set({ user: null, token: null })
  },
}))

// ─── Projects API ─────────────────────────────────────────────────────────────

export const projectsApi = {
  getAll:   ()         => apiFetch('/projects'),
  getById:  (id)       => apiFetch(`/projects/${id}`),
  create:   (data)     => apiFetch('/projects',       { method: 'POST',   body: JSON.stringify(data) }),
  update:   (id, data) => apiFetch(`/projects/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  delete:   (id)       => apiFetch(`/projects/${id}`, { method: 'DELETE' }),
}

// ─── Furniture API ────────────────────────────────────────────────────────────

export const furnitureApi = {
  getAll:   ()         => apiFetch('/furniture'),
  create:   (data)     => apiFetch('/furniture',       { method: 'POST',   body: JSON.stringify(data) }),
  update:   (id, data) => apiFetch(`/furniture/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  delete:   (id)       => apiFetch(`/furniture/${id}`, { method: 'DELETE' }),
}

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminApi = {
  getStats:      ()   => apiFetch('/admin/stats'),
  getUsers:      ()   => apiFetch('/admin/users'),
  toggleUser:    (id) => apiFetch(`/admin/users/${id}/toggle`, { method: 'PUT' }),
  deleteUser:    (id) => apiFetch(`/admin/users/${id}`,        { method: 'DELETE' }),
  getProjects:   ()   => apiFetch('/admin/projects'),
  deleteProject: (id) => apiFetch(`/admin/projects/${id}`,     { method: 'DELETE' }),
}

// ─── Built-in furniture library ───────────────────────────────────────────────

export const FURNITURE_LIBRARY = [
  { id:'sofa',         name:'Sofa',           category:'Seating',      w:220, d:90,  h:85,  color:'#93b4fd' },
  { id:'armchair',     name:'Armchair',        category:'Seating',      w:85,  d:85,  h:80,  color:'#93b4fd' },
  { id:'dining-chair', name:'Dining Chair',    category:'Seating',      w:50,  d:50,  h:90,  color:'#93b4fd' },
  { id:'stool',        name:'Bar Stool',       category:'Seating',      w:40,  d:40,  h:75,  color:'#93b4fd' },
  { id:'bench',        name:'Bench',           category:'Seating',      w:120, d:40,  h:45,  color:'#93b4fd' },
  { id:'coffee-table', name:'Coffee Table',    category:'Tables',       w:120, d:60,  h:45,  color:'#6ee7b7' },
  { id:'dining-table', name:'Dining Table',    category:'Tables',       w:160, d:90,  h:75,  color:'#6ee7b7' },
  { id:'side-table',   name:'Side Table',      category:'Tables',       w:50,  d:50,  h:55,  color:'#6ee7b7' },
  { id:'console',      name:'Console Table',   category:'Tables',       w:120, d:35,  h:80,  color:'#6ee7b7' },
  { id:'bed-double',   name:'Double Bed',      category:'Bedroom',      w:160, d:200, h:50,  color:'#fca5a5' },
  { id:'bed-single',   name:'Single Bed',      category:'Bedroom',      w:90,  d:200, h:50,  color:'#fca5a5' },
  { id:'wardrobe',     name:'Wardrobe',        category:'Bedroom',      w:180, d:60,  h:220, color:'#fca5a5' },
  { id:'nightstand',   name:'Nightstand',      category:'Bedroom',      w:50,  d:45,  h:55,  color:'#fca5a5' },
  { id:'bookshelf',    name:'Bookshelf',       category:'Storage',      w:100, d:30,  h:200, color:'#d8b4fe' },
  { id:'tv-unit',      name:'TV Unit',         category:'Storage',      w:180, d:45,  h:55,  color:'#d8b4fe' },
  { id:'cabinet',      name:'Cabinet',         category:'Storage',      w:80,  d:40,  h:90,  color:'#d8b4fe' },
  { id:'desk',         name:'Desk',            category:'Office',       w:140, d:70,  h:75,  color:'#fcd34d' },
  { id:'office-chair', name:'Office Chair',    category:'Office',       w:60,  d:60,  h:110, color:'#fcd34d' },
  { id:'filing',       name:'Filing Cabinet',  category:'Office',       w:50,  d:60,  h:130, color:'#fcd34d' },
  { id:'floor-lamp',   name:'Floor Lamp',      category:'Lighting',     w:30,  d:30,  h:160, color:'#fdba74' },
  { id:'table-lamp',   name:'Table Lamp',      category:'Lighting',     w:25,  d:25,  h:50,  color:'#fdba74' },
  { id:'bathtub',      name:'Bathtub',         category:'Bathroom',     w:170, d:75,  h:55,  color:'#a5f3fc' },
  { id:'shower',       name:'Shower',          category:'Bathroom',     w:90,  d:90,  h:200, color:'#a5f3fc' },
  { id:'toilet',       name:'Toilet',          category:'Bathroom',     w:40,  d:70,  h:80,  color:'#a5f3fc' },
  { id:'sink',         name:'Sink',            category:'Bathroom',     w:60,  d:50,  h:85,  color:'#a5f3fc' },
  { id:'fridge',       name:'Refrigerator',    category:'Kitchen',      w:70,  d:70,  h:180, color:'#bbf7d0' },
  { id:'stove',        name:'Stove',           category:'Kitchen',      w:60,  d:60,  h:90,  color:'#bbf7d0' },
  { id:'kitchen-sink', name:'Kitchen Sink',    category:'Kitchen',      w:80,  d:50,  h:90,  color:'#bbf7d0' },
  { id:'tv',           name:'Television',      category:'Living Room',  w:120, d:10,  h:70,  color:'#bfdbfe' },
  { id:'fireplace',    name:'Fireplace',       category:'Living Room',  w:120, d:30,  h:100, color:'#bfdbfe' },
  { id:'rug',          name:'Area Rug',        category:'Living Room',  w:200, d:150, h:2,   color:'#bfdbfe' },
  { id:'plant',        name:'Plant',           category:'Decor',        w:40,  d:40,  h:80,  color:'#f9a8d4' },
  { id:'painting',     name:'Wall Painting',   category:'Decor',        w:80,  d:5,   h:60,  color:'#f9a8d4' },
]
