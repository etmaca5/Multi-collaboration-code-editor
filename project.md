
# Collaborative Code Editor MVP

## Project Overview
A real-time collaborative code editor built with React, TypeScript, and Express. Users can join document rooms via URL and edit code together with live cursors and presence indicators.

## Architecture
- **Frontend**: React + TypeScript + Tailwind + Monaco Editor + Yjs
- **Backend**: Express + WebSocket + Yjs + Neon (Postgres)
- **Real-time**: y-websocket protocol for CRDT synchronization
- **Persistence**: Debounced autosave to Neon database

## Features (MVP Scope)
✅ **In Scope:**
- Join document rooms via `/doc/:id`
- Real-time collaborative editing
- Remote cursors & selections with user names/colors
- Autosave to Neon + load on reconnect
- "Last saved at" indicator
- Anonymous users with ephemeral names

❌ **Out of Scope:**
- Authentication & permissions
- Multi-file projects/folders
- Code execution/runner, LSP, linting
- Rich presence (avatars), comments, chat

## Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Monaco Editor, Yjs, y-websocket
- **Backend**: Express, ws, y-websocket, Yjs, @neondatabase/serverless
- **Database**: Neon (serverless Postgres)
- **Build Tools**: Vite (client), tsx (server)

## Project Structure
```
/
├── client/          # React frontend (Vite)
├── server/          # Express backend
├── shared/          # Shared types/utilities
└── project.md       # This file
```

## Database Schema
```sql
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Environment Variables
- `DATABASE_URL`: Neon connection string
- `PORT`: Server port (default: 5000)

## Development Timeline
1. **Phase 1**: Backend setup (Express + WebSocket + Yjs)
2. **Phase 2**: Frontend setup (React + Monaco + Yjs)
3. **Phase 3**: Presence implementation (cursors/selections)
4. **Phase 4**: Polish & testing

## Current Status
🚧 **In Progress**: Initial setup and backend implementation
