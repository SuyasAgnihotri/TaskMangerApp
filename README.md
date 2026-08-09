# TaskFlow

A full-stack Kanban task management app built with **Django REST Framework**, **PostgreSQL**, **React**, and **Django Channels** (WebSockets).

## Architecture

```
┌─────────────┐     REST + WS      ┌──────────────────┐
│  React SPA  │ ◄────────────────► │  Django + DRF    │
│  (Vite)     │   httpOnly JWT     │  Channels/ASGI   │
└─────────────┘                    └────────┬─────────┘
                                            │
                                   ┌────────┴────────┐
                                   │                 │
                              PostgreSQL           Redis
                              (data)            (channels)
```

## Data Model

```
User ──┬── Workspace (owner)
       └── WorkspaceMember ── Workspace
                │
                └── Project ── Board ── Column ── Task
                                              ├── TaskAssignee
                                              ├── Comment
                                              ├── ActivityLog
                                              └── Notification
```

## Features

- JWT auth stored in **httpOnly cookies** (not localStorage)
- Workspace → Project → Board → Column → Task hierarchy
- Nested board API (`GET /api/projects/:id/board`) with prefetch to avoid N+1
- Drag-and-drop Kanban board with optimistic updates + rollback on failure
- Real-time board sync via WebSockets (`WS /ws/board/:boardId`)
- Comments, activity logs (Django signals), notifications
- Task search/filter by assignee, priority, due date, label

## Quick Start (Local)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# SQLite (default) — no Postgres needed for dev
USE_INMEMORY_CHANNELS=True python manage.py migrate
USE_INMEMORY_CHANNELS=True python manage.py runserver
```

For PostgreSQL + Redis WebSockets:

```bash
# Set in .env:
# DATABASE_URL=postgres://taskflow:taskflow@localhost:5432/taskflow
# REDIS_URL=redis://localhost:6379/0

python manage.py migrate
daphne -b 0.0.0.0 -p 8000 taskflow_backend.asgi:application
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — sign up, create a workspace, project, and board.

### Docker (all services)

```bash
docker-compose up --build
```

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register |
| POST | `/api/auth/login` | Login (sets cookies) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/workspaces` | List/create workspaces |
| POST | `/api/workspaces/:id/invite` | Invite member by email |
| GET/POST | `/api/workspaces/:id/projects` | Projects in workspace |
| GET | `/api/projects/:id/board` | Nested board with columns + tasks |
| POST/PATCH | `/api/tasks` | Create/update tasks |
| POST | `/api/tasks/:id/comments` | Add comment |
| GET | `/api/tasks/search?q=` | Search/filter tasks |

All responses use shape: `{ "data": ..., "error": null }`.

## Trade-offs

1. **WebSockets vs polling** — WebSockets via Channels + Redis when available; `USE_INMEMORY_CHANNELS=True` falls back for local dev without Redis; broadcast failures are silently ignored so API stays stable.
2. **SQLite default** — Easier onboarding; production uses PostgreSQL via `DATABASE_URL`.
3. **Single board per project** — Auto-created on project creation with To Do / In Progress / Done columns.
4. **Role-based UI** — Backend RBAC for workspace admin invite; UI restrictions are minimal in v1.

## Tests

```bash
cd backend
pytest
```

## Project Structure

```
├── backend/
│   ├── core/           # User, auth, JWT cookies
│   ├── workspaces/     # Workspace, WorkspaceMember
│   ├── projects/       # Project, Board, Column
│   ├── tasks/          # Task, Comment, ActivityLog, WebSocket consumer
│   └── taskflow_backend/
├── frontend/
│   └── src/
│       ├── api/        # Axios client
│       ├── context/    # Auth context
│       ├── pages/      # Login, Workspaces, Board
│       └── components/ # TaskCard, TaskModal, Layout
└── docker-compose.yml
```
