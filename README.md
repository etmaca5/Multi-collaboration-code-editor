
# Collaborative Code Editor

A real-time collaborative code editor built with React, TypeScript, Express, and Yjs. Multiple users can edit the same document simultaneously with live cursors and automatic synchronization.

## Features

- **Real-time Collaboration**: Multiple users can edit simultaneously
- **Live Cursors**: See where other users are typing with colored cursors
- **Automatic Saving**: Changes are automatically saved to the database
- **Persistence**: Documents persist across sessions and server restarts
- **Anonymous Access**: No authentication required - just share the URL
- **Monaco Editor**: Full-featured code editor with syntax highlighting

## Tech Stack

### Frontend
- React 18 with TypeScript
- Monaco Editor for code editing
- Tailwind CSS for styling
- Yjs for CRDT (Conflict-free Replicated Data Types)
- y-websocket for real-time synchronization

### Backend
- Express.js with TypeScript
- WebSocket server for real-time communication
- Yjs for document synchronization
- Neon (serverless Postgres) for persistence

## Quick Start

### 1. Environment Setup

Create a `.env` file in the root directory:

```bash
DATABASE_URL=your_neon_database_url_here
PORT=5000
```

### 2. Install Dependencies

```bash
npm install
cd server && npm install
cd ../client && npm install
```

### 3. Run Development Server

```bash
npm run dev
```

This will start both the backend server (port 5000) and frontend development server (port 3000).

### 4. Open in Browser

Navigate to `http://localhost:3000` to access the application.

## Database Setup

The application uses Neon (serverless Postgres). The database schema is automatically created on first run:

```sql
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Project Structure

```
/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── utils/          # Utility functions
│   │   └── main.tsx        # App entry point
│   └── package.json
├── server/                 # Express backend
│   ├── src/
│   │   └── server.ts       # Main server file
│   └── package.json
├── package.json            # Root package.json
└── README.md
```

## How It Works

1. **Document Creation**: Users can create new documents or join existing ones via URL
2. **Real-time Sync**: Yjs handles conflict-free document synchronization
3. **WebSocket Communication**: y-websocket protocol manages real-time updates
4. **Presence System**: User cursors and selections are broadcast via Yjs awareness
5. **Auto-save**: Document changes are debounced and automatically saved to the database

## API Endpoints

- `GET /api/docs/:id` - Fetch document metadata
- `GET /api/docs/:id/status` - Get document status and last saved time
- `GET /api/health` - Server health check
- `WS /collab?room=:id` - WebSocket endpoint for real-time collaboration

## Development

### Scripts

```bash
# Root level
npm run dev          # Run both client and server in development
npm run build        # Build both client and server
npm start           # Start production server

# Server only
cd server
npm run dev         # Development with hot reload
npm run build       # Build TypeScript
npm start          # Start production server

# Client only
cd client
npm run dev        # Development server
npm run build      # Build for production
npm run preview    # Preview production build
```

### Environment Variables

- `DATABASE_URL`: Neon database connection string
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment (development/production)

## Deployment

The application is configured for deployment on Replit:

1. Set up your Neon database
2. Add the `DATABASE_URL` environment variable
3. Click the "Run" button to start the application

For other platforms:
1. Build the application: `npm run build`
2. Set environment variables
3. Start with: `npm start`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
