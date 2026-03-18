import { create } from 'zustand'

// ─── API base ────────────────────────────────────────────────────────────────

const BASE = '/api'

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('rc_token')
  const isForm = (options.body && typeof FormData !== 'undefined' && options.body instanceof FormData)
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
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

  setUser: (user) => {
    set({ user })
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
  uploadThumbnail: (id, formData) => apiFetch(`/projects/${id}/thumbnail`, { method: 'POST', body: formData }),
}

export const userApi = {
  getProfile: () => apiFetch('/user/me'),
  updateProfile: (data) => apiFetch('/user/me', { method: 'PUT', body: JSON.stringify(data) }),
  uploadAvatar: (formData) => apiFetch('/user/me/avatar', { method: 'POST', body: formData }),
  deleteAvatar: () => apiFetch('/user/me/avatar', { method: 'DELETE' }),
  adminUpdateUser: (id, data) => apiFetch(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
}

// ─── Furniture API ────────────────────────────────────────────────────────────

export const furnitureApi = {
  // Visible library: public models + user's own private uploads
  getAll:   ()         => apiFetch('/furniture/visible'),
  create:   (data)     => apiFetch('/furniture',       { method: 'POST',   body: JSON.stringify(data) }),
  update:   (id, data) => apiFetch(`/furniture/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  delete:   (id)       => apiFetch(`/furniture/${id}`, { method: 'DELETE' }),
  upload:   (formData) => apiFetch('/furniture/upload', { method: 'POST', body: formData }),
  uploadPreview: (id, formData) => apiFetch(`/furniture/${id}/preview`, { method: 'POST', body: formData }),
}

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminApi = {
  getStats:      ()   => apiFetch('/admin/stats'),
  getUsers:      ()   => apiFetch('/admin/users'),
  toggleUser:    (id) => apiFetch(`/admin/users/${id}/toggle`, { method: 'PUT' }),
  deleteUser:    (id) => apiFetch(`/admin/users/${id}`,        { method: 'DELETE' }),
  getProjects:   ()   => apiFetch('/admin/projects'),
  deleteProject: (id) => apiFetch(`/admin/projects/${id}`,     { method: 'DELETE' }),
  getFurniture:  ()   => apiFetch('/admin/furniture'),
  updateFurniture:(id, patch) => apiFetch(`/admin/furniture/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
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
   // ── SEATING (new entries) ─────────────────────────────────────────────────
  { id: 'accent-chair',       name: 'Accent Chair',        category: 'Seating',     w: 75,  d: 75,  h: 42, color: '#e8a87c' },
  { id: 'lounge-chair',       name: 'Lounge Chair',        category: 'Seating',     w: 82,  d: 90,  h: 38, color: '#7c9ef8' },
  { id: 'wingback-chair',     name: 'Wingback Chair',      category: 'Seating',     w: 78,  d: 80,  h: 105,color: '#9b7e6a' },
  { id: 'sectional-sofa',     name: 'Sectional Sofa',      category: 'Seating',     w: 265, d: 155, h: 85, color: '#8fa8c8' },
  { id: 'loveseat',           name: 'Loveseat',            category: 'Seating',     w: 138, d: 85,  h: 85, color: '#b89478' },
  { id: 'ottoman',            name: 'Ottoman',             category: 'Seating',     w: 70,  d: 70,  h: 42, color: '#a8956e' },
  { id: 'chaise-lounge',      name: 'Chaise Lounge',       category: 'Seating',     w: 165, d: 72,  h: 80, color: '#9bb8d4' },
  { id: 'bench-seat',         name: 'Upholstered Bench',   category: 'Seating',     w: 130, d: 42,  h: 45, color: '#c4a882' },
  { id: 'rocking-chair',      name: 'Rocking Chair',       category: 'Seating',     w: 72,  d: 88,  h: 105,color: '#c8a46e' },
  { id: 'bean-bag',           name: 'Bean Bag',            category: 'Seating',     w: 85,  d: 85,  h: 60, color: '#f4856e' },
 
  // ── TABLES (new entries) ──────────────────────────────────────────────────
  { id: 'coffee-table-rect',  name: 'Coffee Table',        category: 'Tables',      w: 120, d: 60,  h: 40, color: '#5ad4a0' },
  { id: 'coffee-table-round', name: 'Round Coffee Table',  category: 'Tables',      w: 80,  d: 80,  h: 40, color: '#5ad4a0' },
  { id: 'end-table',          name: 'End Table',           category: 'Tables',      w: 50,  d: 50,  h: 58, color: '#7ab8f5' },
  { id: 'console-table',      name: 'Console Table',       category: 'Tables',      w: 140, d: 35,  h: 78, color: '#c8a46e' },
  { id: 'bar-table',          name: 'Bar Height Table',    category: 'Tables',      w: 65,  d: 65,  h: 106,color: '#5ad4a0' },
  { id: 'nesting-tables',     name: 'Nesting Tables',      category: 'Tables',      w: 70,  d: 42,  h: 56, color: '#a8c8b0' },
 
  // ── DINING (new category) ─────────────────────────────────────────────────
  { id: 'dining-table-4',     name: 'Dining Table (4)',    category: 'Dining',      w: 140, d: 80,  h: 74, color: '#e8a96a' },
  { id: 'dining-table-6',     name: 'Dining Table (6)',    category: 'Dining',      w: 190, d: 90,  h: 74, color: '#e8a96a' },
  { id: 'dining-table-8',     name: 'Dining Table (8)',    category: 'Dining',      w: 240, d: 100, h: 74, color: '#e8a96a' },
  { id: 'round-dining-table', name: 'Round Dining Table',  category: 'Dining',      w: 110, d: 110, h: 74, color: '#d4986a' },
  { id: 'dining-chair-wood',       name: 'Dining Chair',        category: 'Dining',      w: 45,  d: 48,  h: 95, color: '#c4a478' },
  { id: 'bar-stool',          name: 'Bar Stool',           category: 'Dining',      w: 38,  d: 38,  h: 78, color: '#a8856e' },
  { id: 'buffet-sideboard',   name: 'Buffet Sideboard',    category: 'Dining',      w: 175, d: 45,  h: 85, color: '#c8a46e' },
  { id: 'china-cabinet',      name: 'China Cabinet',       category: 'Dining',      w: 105, d: 42,  h: 195,color: '#b8904e' },
  { id: 'bar-cart',           name: 'Bar Cart',            category: 'Dining',      w: 55,  d: 40,  h: 90, color: '#c0c0b0' },
 
  // ── BEDROOM (new entries) ─────────────────────────────────────────────────
  { id: 'twin-bed',           name: 'Twin Bed',            category: 'Bedroom',     w: 97,  d: 197, h: 90, color: '#f4856e' },
  { id: 'full-bed',           name: 'Full Bed',            category: 'Bedroom',     w: 137, d: 197, h: 90, color: '#f4856e' },
  { id: 'queen-bed',          name: 'Queen Bed',           category: 'Bedroom',     w: 153, d: 203, h: 90, color: '#e07860' },
  { id: 'king-bed',           name: 'King Bed',            category: 'Bedroom',     w: 193, d: 203, h: 90, color: '#d06850' },
  { id: 'platform-bed',       name: 'Platform Bed',        category: 'Bedroom',     w: 160, d: 210, h: 35, color: '#8b6850' },
  { id: 'bunk-bed',           name: 'Bunk Bed',            category: 'Bedroom',     w: 100, d: 210, h: 160,color: '#c8a46e' },
  { id: 'dresser-6',          name: 'Dresser 6-Drawer',    category: 'Bedroom',     w: 110, d: 45,  h: 85, color: '#b892f2' },
  { id: 'armoire',            name: 'Armoire',             category: 'Bedroom',     w: 110, d: 58,  h: 195,color: '#c8a46e' },
  { id: 'vanity',             name: 'Vanity Table',        category: 'Bedroom',     w: 95,  d: 48,  h: 78, color: '#f0d0b0' },
 
  // ── LIVING ROOM (new entries) ─────────────────────────────────────────────
  { id: 'bookshelf-lr',          name: 'Bookshelf',           category: 'Living Room', w: 90,  d: 32,  h: 195,color: '#7ab8f5' },
  { id: 'tv-unit-lr',            name: 'TV Unit',             category: 'Living Room', w: 180, d: 45,  h: 55, color: '#6090c0' },
  { id: 'media-console',      name: 'Media Console',       category: 'Living Room', w: 155, d: 40,  h: 50, color: '#5080b0' },
  { id: 'wall-unit',          name: 'Wall Unit',           category: 'Living Room', w: 240, d: 38,  h: 210,color: '#4870a0' },
  { id: 'floor-mirror',       name: 'Floor Mirror',        category: 'Living Room', w: 60,  d: 5,   h: 175,color: '#c0d8f0' },
  { id: 'piano',              name: 'Upright Piano',       category: 'Living Room', w: 150, d: 62,  h: 125,color: '#181818' },
  { id: 'grand-piano',        name: 'Grand Piano',         category: 'Living Room', w: 150, d: 190, h: 100,color: '#181818' },
  { id: 'fireplace-insert',   name: 'Fireplace',           category: 'Living Room', w: 120, d: 35,  h: 105,color: '#888' },
 
  // ── STORAGE (new entries) ─────────────────────────────────────────────────
  { id: 'linen-closet',       name: 'Linen Closet',        category: 'Storage',     w: 80,  d: 55,  h: 210,color: '#b892f2' },
  { id: 'mudroom-bench',      name: 'Mudroom Bench',       category: 'Storage',     w: 120, d: 42,  h: 88, color: '#a07040' },
  { id: 'filing-cabinet',     name: 'Filing Cabinet',      category: 'Storage',     w: 46,  d: 62,  h: 130,color: '#909090' },
  { id: 'wine-rack',          name: 'Wine Rack',           category: 'Storage',     w: 70,  d: 30,  h: 90, color: '#804020' },
  { id: 'display-cabinet',    name: 'Display Cabinet',     category: 'Storage',     w: 95,  d: 38,  h: 195,color: '#c8d0e8' },
 
  // ── OFFICE (new entries) ──────────────────────────────────────────────────
  { id: 'l-desk',             name: 'L-Shape Desk',        category: 'Office',      w: 180, d: 160, h: 76, color: '#f5c842' },
  { id: 'standing-desk',      name: 'Standing Desk',       category: 'Office',      w: 140, d: 70,  h: 118,color: '#e8b830' },
  { id: 'office-chair-ergo',       name: 'Office Chair',        category: 'Office',      w: 65,  d: 65,  h: 125,color: '#303040' },
  { id: 'ergonomic-chair',    name: 'Ergonomic Chair',     category: 'Office',      w: 68,  d: 68,  h: 125,color: '#202030' },
  { id: 'bookcase',           name: 'Bookcase',            category: 'Office',      w: 85,  d: 30,  h: 195,color: '#c8a46e' },
  { id: 'printer-stand',      name: 'Printer Stand',       category: 'Office',      w: 55,  d: 45,  h: 65, color: '#909090' },
 
  // ── KITCHEN (new entries) ─────────────────────────────────────────────────
  { id: 'kitchen-island',     name: 'Kitchen Island',      category: 'Kitchen',     w: 150, d: 80,  h: 90, color: '#72da8c' },
  { id: 'breakfast-bar',      name: 'Breakfast Bar',       category: 'Kitchen',     w: 130, d: 45,  h: 106,color: '#62ca7c' },
  { id: 'pantry-cabinet',     name: 'Pantry Cabinet',      category: 'Kitchen',     w: 60,  d: 58,  h: 210,color: '#e0d0b0' },
  { id: 'microwave-cart',     name: 'Microwave Cart',      category: 'Kitchen',     w: 55,  d: 40,  h: 90, color: '#c8c0b0' },
  { id: 'dishwasher',         name: 'Dishwasher',          category: 'Kitchen',     w: 60,  d: 55,  h: 85, color: '#d0d0c8' },
 
  // ── BATHROOM (new entries) ────────────────────────────────────────────────
  { id: 'double-sink',        name: 'Double Sink Vanity',  category: 'Bathroom',    w: 150, d: 55,  h: 85, color: '#5bc8de' },
  { id: 'freestanding-tub',   name: 'Freestanding Tub',    category: 'Bathroom',    w: 80,  d: 170, h: 62, color: '#e8f4fc' },
  { id: 'walk-in-shower',     name: 'Walk-in Shower',      category: 'Bathroom',    w: 90,  d: 90,  h: 200,color: '#8ed8e8' },
  { id: 'towel-rack',         name: 'Towel Rack',          category: 'Bathroom',    w: 60,  d: 12,  h: 95, color: '#c0c8d0' },
  { id: 'bathroom-vanity',    name: 'Bathroom Vanity',     category: 'Bathroom',    w: 80,  d: 50,  h: 85, color: '#e0e8f0' },
 
  // ── LIGHTING (new entries) ────────────────────────────────────────────────
  { id: 'table-lamp-desk',         name: 'Table Lamp',          category: 'Lighting',    w: 35,  d: 35,  h: 65, color: '#ff9f4a' },
  { id: 'arc-lamp',           name: 'Arc Floor Lamp',      category: 'Lighting',    w: 38,  d: 38,  h: 195,color: '#ffa030' },
  { id: 'pendant-light',      name: 'Pendant Light',       category: 'Lighting',    w: 45,  d: 45,  h: 30, color: '#ffb060' },
  { id: 'chandelier',         name: 'Chandelier',          category: 'Lighting',    w: 80,  d: 80,  h: 60, color: '#ffc070' },
  { id: 'sconce',             name: 'Wall Sconce',         category: 'Lighting',    w: 20,  d: 15,  h: 25, color: '#ffb050' },
  { id: 'desk-lamp',          name: 'Desk Lamp',           category: 'Lighting',    w: 25,  d: 25,  h: 55, color: '#ffa040' },
  { id: 'track-light',        name: 'Track Lighting',      category: 'Lighting',    w: 100, d: 12,  h: 8,  color: '#e0d8c0' },
 
  // ── DECOR (new entries) ───────────────────────────────────────────────────
  { id: 'large-plant',        name: 'Large Potted Plant',  category: 'Decor',       w: 55,  d: 55,  h: 145,color: '#f48db4' },
  { id: 'succulent',          name: 'Succulent Cluster',   category: 'Decor',       w: 25,  d: 25,  h: 18, color: '#80c870' },
  { id: 'wall-art',           name: 'Wall Art',            category: 'Decor',       w: 80,  d: 5,   h: 80, color: '#e8d0a0' },
  { id: 'sculpture',          name: 'Sculpture',           category: 'Decor',       w: 30,  d: 30,  h: 55, color: '#d0c0a8' },
  { id: 'floor-vase',         name: 'Floor Vase',          category: 'Decor',       w: 25,  d: 25,  h: 80, color: '#c8a870' },
  { id: 'clock',              name: 'Wall Clock',          category: 'Decor',       w: 40,  d: 8,   h: 40, color: '#d0c8b8' },
  { id: 'picture-frame',      name: 'Picture Frame',       category: 'Decor',       w: 50,  d: 4,   h: 40, color: '#c8b898' },
  { id: 'room-divider',       name: 'Room Divider',        category: 'Decor',       w: 160, d: 4,   h: 175,color: '#c8b890' },
 
  // ── OUTDOOR ──────────────────────────────────────────────────────────────
  { id: 'outdoor-sofa',       name: 'Outdoor Sofa',        category: 'Outdoor',     w: 205, d: 85,  h: 80, color: '#8dcc6e' },
  { id: 'outdoor-chair',      name: 'Outdoor Chair',       category: 'Outdoor',     w: 75,  d: 78,  h: 82, color: '#7dbc5e' },
  { id: 'outdoor-table',      name: 'Outdoor Table',       category: 'Outdoor',     w: 110, d: 75,  h: 74, color: '#6dac4e' },
  { id: 'sun-lounger',        name: 'Sun Lounger',         category: 'Outdoor',     w: 65,  d: 195, h: 35, color: '#a0d880' },
  { id: 'bbq-grill',          name: 'BBQ Grill',           category: 'Outdoor',     w: 80,  d: 55,  h: 90, color: '#484848' },
  { id: 'planters-box',       name: 'Planter Box',         category: 'Outdoor',     w: 90,  d: 35,  h: 38, color: '#9a7860' },
  { id: 'hot-tub',            name: 'Hot Tub',             category: 'Outdoor',     w: 200, d: 200, h: 95, color: '#5bc8de' },
  { id: 'umbrella',           name: 'Patio Umbrella',      category: 'Outdoor',     w: 200, d: 200, h: 250,color: '#e8c870' },

]

// ─── Shared Design Store (2D ↔ 3D live sync via localStorage) ─────────────────
// Both Workspace2D and Workspace3D read/write this store.
// When one workspace changes items/overlays/cfg, the other picks it up instantly.

const STORAGE_KEY = 'rc_design_'

function saveToStorage(key, value) {
  try { localStorage.setItem(STORAGE_KEY + key, JSON.stringify(value)) } catch {}
}
function loadFromStorage(key, fallback) {
  try {
    const v = localStorage.getItem(STORAGE_KEY + key)
    return v ? JSON.parse(v) : fallback
  } catch { return fallback }
}

export const useDesignStore = create((set, get) => ({
  projectId: null,
  items:    loadFromStorage('items', []),
  overlays: loadFromStorage('overlays', { doors: [], windows: [], curtains: [] }),
  cfg:      loadFromStorage('cfg', { shape: 'rectangle', width: 5, depth: 4, height: 2.8, wallColor: '#F5F5F0', floorTexture: 'wood' }),
  customModels: loadFromStorage('customModels', []),
  wallMode: loadFromStorage('wallMode', 'solid'),

  // Call this when a project is first loaded (from DB).
  // It replaces local state AND saves to localStorage so the other workspace picks it up.
  loadProject: (projectId, items, overlays, cfg, customModels = []) => {
    saveToStorage('items',        items)
    saveToStorage('overlays',     overlays)
    saveToStorage('cfg',          cfg)
    saveToStorage('customModels', customModels)
    saveToStorage('projectId',    projectId)
    // Do not clobber wallMode here; it is a user view preference.
    set({ projectId, items, overlays, cfg, customModels })
  },

  setItems: (items) => {
    const resolved = typeof items === 'function' ? items(get().items) : items
    saveToStorage('items', resolved)
    set({ items: resolved })
  },

  setOverlays: (overlays) => {
    const resolved = typeof overlays === 'function' ? overlays(get().overlays) : overlays
    saveToStorage('overlays', resolved)
    set({ overlays: resolved })
  },

  setCfg: (cfg) => {
    const resolved = typeof cfg === 'function' ? cfg(get().cfg) : cfg
    saveToStorage('cfg', resolved)
    set({ cfg: resolved })
  },

  setCustomModels: (customModels) => {
    const resolved = typeof customModels === 'function' ? customModels(get().customModels) : customModels
    saveToStorage('customModels', resolved)
    set({ customModels: resolved })
  },

  setWallMode: (wallMode) => {
    const resolved = typeof wallMode === 'function' ? wallMode(get().wallMode) : wallMode
    saveToStorage('wallMode', resolved)
    set({ wallMode: resolved })
  },

  // Call this on mount in the workspace that is NOT the primary editor,
  // so it refreshes from localStorage if the other workspace saved while this one was open.
  syncFromStorage: () => {
    set({
      items:        loadFromStorage('items',        []),
      overlays:     loadFromStorage('overlays',     { doors: [], windows: [], curtains: [] }),
      cfg:          loadFromStorage('cfg',          { shape: 'rectangle', width: 5, depth: 4, height: 2.8, wallColor: '#F5F5F0', floorTexture: 'wood' }),
      customModels: loadFromStorage('customModels', []),
      wallMode:     loadFromStorage('wallMode',     'solid'),
    })
  },
}))