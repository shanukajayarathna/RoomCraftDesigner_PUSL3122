<div align="center">

# 🏠 RoomCraft Designer

### Professional Interior Design Platform — 2D Planning & Real-Time 3D Visualization

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)](https://reactjs.org)
[![Three.js](https://img.shields.io/badge/Three.js-0.167-black?style=flat-square&logo=three.js)](https://threejs.org)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.0-6DB33F?style=flat-square&logo=springboot)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-17-ED8B00?style=flat-square&logo=openjdk)](https://openjdk.org)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/license-Academic-lightgrey?style=flat-square)]()

**A web-based interior design tool that lets designers plan rooms in 2D, visualize them in real-time 3D, and furnish them from a curated model library — all in the browser.**

🔗 **Live Demo:** _[Add your deployed URL here]_&nbsp;&nbsp;|&nbsp;&nbsp;🎬 **Video Walkthrough:** _[Add your YouTube URL here]_

---

[Features](#-features) · [Tech Stack](#-tech-stack) · [Quick Start](#-quick-start) · [Configuration](#️-configuration) · [Project Structure](#-project-structure) · [API Reference](#-api-reference) · [Team](#-team) · [Credits](#-credits)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Authentication** | JWT-based login & registration with role-based access (User / Admin) |
| 🗂️ **Project Management** | Create, rename, delete, and browse room design projects with auto-generated thumbnails |
| 📐 **2D Floor Planner** | HTML5 Canvas editor — drag-and-drop furniture, grid snapping, rotate & scale via affine transforms |
| 🧊 **3D Visualization** | Real-time WebGL renderer powered by Three.js — OrbitControls, Phong shading & texture mapping |
| 🛋️ **Furniture Library** | Categorised GLB/OBJ model library with automatic top-view PNG generation for the 2D canvas |
| 🛡️ **Admin Dashboard** | Manage users, upload furniture models, control visibility and view platform statistics |
| 📱 **Responsive UI** | Clean, accessible interface built with Tailwind CSS — WCAG AA contrast compliant |

---

## 🛠 Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI component framework |
| Vite | 5.4.1 | Build tool & dev server |
| Tailwind CSS | 3.4.10 | Utility-first styling |
| Three.js | 0.167.0 | 3D rendering engine (WebGL) |
| React Router DOM | 6.26.1 | Client-side routing |
| Zustand | 4.5.4 | Global state management |
| React Hot Toast | 2.4.1 | Non-blocking toast notifications |
| Lucide React | 0.383.0 | Icon library |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Java | 17 | Language |
| Spring Boot | 3.2.0 | Application framework |
| Spring Security | 3.2.0 | Authentication & authorization |
| Spring Data JPA | 3.2.0 | Database ORM layer |
| JJWT | 0.11.5 | JWT generation & validation |
| H2 Database | — | Embedded in-memory database — zero configuration |
| Lombok | — | Boilerplate reduction |
| Maven | 3.8+ | Build & dependency management |

---

## ⚡ Quick Start

> **Zero database setup required.** The backend uses an embedded H2 in-memory database that starts automatically with the application. No installation, no configuration.

### Prerequisites

| Tool | Version | Download |
|---|---|---|
| Node.js | v18+ | [nodejs.org](https://nodejs.org) |
| Java JDK | 17 | [adoptium.net](https://adoptium.net) |
| Maven | 3.8+ | [maven.apache.org](https://maven.apache.org) |
| Git | any | [git-scm.com](https://git-scm.com) |

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/roomcraft-designer.git
cd roomcraft-designer
```

---

### Step 2 — Start the backend

```bash
cd backend
mvn spring-boot:run
```

✅ The API is ready at **`http://localhost:8080`**

The H2 database is created and seeded automatically. No further setup needed.

> **Inspect the live database** (optional):
> Open `http://localhost:8080/h2-console` in your browser while the server is running.
> - JDBC URL: `jdbc:h2:mem:roomcraft`
> - Username: `sa`
> - Password: _(leave blank)_

---

### Step 3 — Start the frontend

Open a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

✅ The app is ready at **`http://localhost:5173`**

---

### Step 4 — Log in

Two accounts are available immediately after startup:

| Role | Username | Password | Access |
|---|---|---|---|
| 👤 **User** | `demo` | `demo123` | Dashboard · 2D & 3D workspaces · project management |
| 🛡️ **Admin** | `admin` | `admin123` | All of the above · admin panel · furniture uploads |

> You can also register a new account from the landing page at any time.

---

## ⚙️ Configuration

All backend settings are in:

```
backend/src/main/resources/application.properties
```

| Property | Default | Description |
|---|---|---|
| `server.port` | `8080` | Port the backend API listens on |
| `jwt.secret` | — | **Required.** Secret key for signing JWTs — minimum 32 characters |
| `jwt.expiration` | `86400000` | Token lifetime in milliseconds (default: 24 hours) |
| `spring.h2.console.enabled` | `true` | Enables the H2 browser console at `/h2-console` |
| `spring.servlet.multipart.max-file-size` | `50MB` | Maximum size for 3D model file uploads |

> ⚠️ If you fork this project for deployment, set a strong unique value for `jwt.secret` and disable the H2 console.

---

## 📁 Project Structure

```
roomcraft-designer/
│
├── frontend/                          # React + Vite frontend
│   └── src/
│       ├── components/
│       │   └── shared/                # AppLayout, reusable UI components
│       ├── pages/
│       │   ├── LandingPage.jsx        # Marketing landing page
│       │   ├── LoginPage.jsx          # Login — split panel layout
│       │   ├── RegisterPage.jsx       # Registration form
│       │   ├── UserDashboard.jsx      # Home — stats, recent projects, quick actions
│       │   ├── ProjectManager.jsx     # Full project list — search, rename, delete
│       │   ├── Workspace2D.jsx        # 2D floor planner (HTML5 Canvas API)
│       │   ├── Workspace3D.jsx        # 3D viewer (Three.js / WebGL)
│       │   └── AdminDashboard.jsx     # Admin — users, furniture, platform stats
│       ├── store/
│       │   └── authStore.js           # Zustand — auth state + all API calls
│       └── utils/
│           └── topViewPreview.js      # Automatic top-view PNG rendering from GLB
│
├── backend/                           # Spring Boot REST API
│   └── src/main/java/com/roomcraft/
│       ├── config/                    # CORS, Spring Security, JWT configuration
│       ├── controller/                # REST endpoint controllers
│       ├── dto/                       # Request & response data transfer objects
│       ├── model/                     # JPA entities — User, Project, Furniture
│       ├── repository/                # Spring Data JPA repositories
│       ├── security/                  # JWT filter, UserDetailsService
│       └── service/                   # Business logic layer
│
├── database/                          # SQL scripts — schema & seed data
│
└── backend/tools/
    └── model-converter/               # Node.js utility for 3D model format conversion
```

---

## 🔌 API Reference

**Base URL:** `http://localhost:8080/api`

All protected endpoints require the following header:
```
Authorization: Bearer <jwt_token>
```

### Authentication — Public

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/auth/register` | `{ username, email, password }` | Create a new user account |
| `POST` | `/auth/login` | `{ username, password }` | Returns JWT token + user info |

### Projects — Authenticated User

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/projects` | Get all projects for the current user |
| `POST` | `/projects` | Create a new project |
| `GET` | `/projects/{id}` | Get a single project by ID |
| `PUT` | `/projects/{id}` | Update project name, layout, or room config |
| `DELETE` | `/projects/{id}` | Permanently delete a project |

### Furniture

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/furniture` | User | List all public furniture models |
| `POST` | `/furniture/upload` | Admin | Upload a new GLB/OBJ model with metadata |
| `PUT` | `/furniture/{id}` | Admin | Update model name, dimensions, or visibility |
| `DELETE` | `/furniture/{id}` | Admin | Remove a model from the library |

### Admin

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/stats` | Platform totals — users, projects, furniture count |
| `GET` | `/admin/users` | List all registered users |
| `PUT` | `/admin/users/{id}` | Enable or disable a user account |
| `DELETE` | `/admin/users/{id}` | Permanently delete a user |
| `GET` | `/admin/furniture` | List all models including private ones |

---

## 🖥️ Screenshots

> Add your screenshots to a `_screenshots/` folder in the project root.

| Screen | File |
|---|---|
| Landing page | `_screenshots/landing.png` |
| User dashboard | `_screenshots/dashboard.png` |
| 2D floor planner | `_screenshots/workspace2d.png` |
| 3D visualization | `_screenshots/workspace3d.png` |
| Admin dashboard | `_screenshots/admin.png` |

---

## 👥 Team

This project was developed as a group assignment for **PUSL3122 — HCI, Computer Graphics and Visualisation** at the University of Plymouth (2025–26).

| Member | GitHub |
|---|---|
| — | — |
| — | — |
| — | — |
| — | — |
| — | — |

---

## 📜 Credits & Attributions

### 3D Furniture Models

> ⚠️ **Required for submission.** Replace every row below with the actual name, source URL, and license of each `.glb` / `.obj` file used in the project.

| Model | Source | License |
|---|---|---|
| _[Model name]_ | _[Source URL]_ | _[License]_ |
| _[Model name]_ | _[Source URL]_ | _[License]_ |
| _[Model name]_ | _[Source URL]_ | _[License]_ |

Recommended free model sources:
- [Poly Pizza](https://poly.pizza) — CC0 / free
- [Sketchfab](https://sketchfab.com/features/free-3d-models) — various licenses
- [KhronosGroup glTF Samples](https://github.com/KhronosGroup/glTF-Sample-Models) — CC0

---

### Photography

Hero and room card images sourced from [Unsplash](https://unsplash.com) under the [Unsplash License](https://unsplash.com/license) — free for commercial and personal use, no attribution required but credited here for transparency.

| Usage in app | Photographer | Unsplash link |
|---|---|---|
| Hero — dark living room | _[Add name]_ | [unsplash.com/photos/...](https://unsplash.com) |
| Hero 2 — modern interior | _[Add name]_ | [unsplash.com/photos/...](https://unsplash.com) |
| Living Room card | _[Add name]_ | [unsplash.com/photos/...](https://unsplash.com) |
| Bedroom card | _[Add name]_ | [unsplash.com/photos/...](https://unsplash.com) |
| Kitchen card | _[Add name]_ | [unsplash.com/photos/...](https://unsplash.com) |
| Office card | _[Add name]_ | [unsplash.com/photos/...](https://unsplash.com) |

---

### Open Source Libraries

| Library | Version | License |
|---|---|---|
| [Three.js](https://threejs.org) | 0.167.0 | MIT |
| [React](https://reactjs.org) | 18.3.1 | MIT |
| [Vite](https://vitejs.dev) | 5.4.1 | MIT |
| [Tailwind CSS](https://tailwindcss.com) | 3.4.10 | MIT |
| [Spring Boot](https://spring.io/projects/spring-boot) | 3.2.0 | Apache 2.0 |
| [H2 Database](https://h2database.com) | — | EPL 1.0 / MPL 2.0 |
| [Lucide React](https://lucide.dev) | 0.383.0 | ISC |
| [Zustand](https://github.com/pmndrs/zustand) | 4.5.4 | MIT |
| [React Router DOM](https://reactrouter.com) | 6.26.1 | MIT |
| [React Hot Toast](https://react-hot-toast.com) | 2.4.1 | MIT |
| [JJWT](https://github.com/jwtk/jjwt) | 0.11.5 | Apache 2.0 |
| [Lombok](https://projectlombok.org) | — | MIT |
| [assimpjs](https://github.com/kovacsv/assimpjs) | latest | MIT |

---

## 📋 Coursework Information

| Field | Detail |
|---|---|
| Module | PUSL3122 — HCI, Computer Graphics and Visualisation |
| Institution | University of Plymouth |
| Academic Year | 2025–26 |
| Submission Date | 19th March 2026 |
| Module Leader | Dr Taimur Bakhshi |
| Assignment Type | Group Coursework |

---

<div align="center">
  <sub>© 2025–26 RoomCraft Designer · University of Plymouth · PUSL3122</sub>
</div>