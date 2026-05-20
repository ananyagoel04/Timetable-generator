# 🏫 TimeCraft — Advanced School Timetable ERP

A production-grade automated timetable management system for schools. Built with React 19, Tailwind CSS, Node.js, Express, and MongoDB.

## Features
- ✅ **Auto-generate** conflict-free timetables with constraint-based scheduling
- ✅ **Drag & drop** timetable editor with slot swapping
- ✅ **Conflict detection** — teacher clashes, room clashes, overload detection
- ✅ **CRUD management** for Teachers, Classes, Subjects, Rooms
- ✅ **Absence tracking** with approval workflow
- ✅ **Substitution management** with free-teacher lookup
- ✅ **Dashboard** with live statistics
- ✅ **Modern dark UI** with glassmorphism, animations, Inter font

## Prerequisites
- Node.js 18+
- MongoDB running locally on port 27017

## Quick Start

### 1. Install dependencies
```bash
cd server && npm install
cd ../client && npm install
```

### 2. Seed the database
```bash
cd server && node seed/seedData.js
```

### 3. Start the backend
```bash
cd server && npm run dev
```

### 4. Start the frontend (in another terminal)
```bash
cd client && npm run dev
```

### 5. Open in browser
```
http://localhost:5173
```

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 19 + Tailwind CSS 3 |
| Backend | Node.js + Express 4 |
| Database | MongoDB + Mongoose 8 |
| Icons | Lucide React |
| DnD | @dnd-kit |
| Notifications | react-hot-toast |

## API Endpoints
- `GET/POST /api/teachers` — Teacher management
- `GET/POST /api/classes` — Class management
- `GET/POST /api/subjects` — Subject management
- `GET/POST /api/rooms` — Room management
- `POST /api/timetable/generate` — Auto-generate timetable
- `GET /api/timetable/class/:id` — View class timetable
- `GET /api/timetable/teacher/:id` — View teacher timetable
- `PUT /api/timetable/slot/:id` — Manual slot edit
- `POST /api/timetable/swap` — Swap two slots
- `GET /api/timetable/conflicts` — Conflict detection
- `GET/POST /api/absences` — Absence tracking
- `GET/POST /api/substitutions` — Substitution management
