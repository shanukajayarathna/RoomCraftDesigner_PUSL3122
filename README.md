# RoomCraft Designer

## Prerequisites

Make sure these are installed before running:

| Tool | Version | Download |
|------|---------|----------|
| Java JDK | 17 or 21 | https://adoptium.net |
| Maven | 3.8+ | https://maven.apache.org (or use `mvnw`) |
| Node.js | 18+ | https://nodejs.org |

Check with:
```
java -version
mvn -version
node -version
npm -version
```

---

## Running the App (Windows)

**Double-click `start.bat`** — it opens two terminal windows:
- One for the Spring Boot backend (port 8080)
- One for the React frontend (port 5173)

Then open your browser: **http://localhost:5173**

> Wait ~30 seconds for the backend to fully start before logging in.

---

## Running the App (Mac / Linux)

```bash
chmod +x start.sh
./start.sh
```

Then open: **http://localhost:5173**

---

## Running Manually (if start scripts fail)

### Terminal 1 — Backend:
```bash
cd backend
mvn spring-boot:run
```

Wait until you see: `Started RoomCraftApplication`

### Terminal 2 — Frontend:
```bash
cd frontend
npm install
npm run dev
```

Then open: **http://localhost:5173**

---

## Demo Accounts

| Role  | Username | Password |
|-------|----------|----------|
| User  | demo     | demo123  |
| Admin | admin    | admin123 |

---

## How the connection works

```
Browser (localhost:5173)
        │
        │  /api/...  (same origin — NO CORS)
        ▼
Vite Dev Server (port 5173)
        │
        │  proxies to http://localhost:8080
        ▼
Spring Boot Backend (port 8080)
```

**Important:** Always access the app via `http://localhost:5173` (the Vite dev server).  
Do NOT open `index.html` directly as a file, and do NOT call `localhost:8080` from the browser directly — both will cause CORS errors.

---

## H2 Database Console

http://localhost:8080/h2-console  
- JDBC URL: `jdbc:h2:file:./data/roomcraft`  
- Username: `sa`  
- Password: *(leave blank)*
