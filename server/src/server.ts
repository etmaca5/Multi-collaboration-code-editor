
import express from 'express';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils.js';
import { neon } from '@neondatabase/serverless';
import * as Y from 'yjs';
import http from 'http';
import cors from 'cors';
import path from 'path';

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../../client/dist')));

const sql = neon(process.env.DATABASE_URL || '');

type Room = {
  doc: Y.Doc;
  ytext: Y.Text;
  saveTimer?: NodeJS.Timeout;
  lastSaved?: Date;
};

const rooms = new Map<string, Room>();

async function initDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
}

async function loadRoom(docId: string): Promise<Room> {
  if (rooms.has(docId)) {
    return rooms.get(docId)!;
  }

  console.log(`Loading room: ${docId}`);
  
  const doc = new Y.Doc();
  const ytext = doc.getText('content');
  
  const room: Room = {
    doc,
    ytext,
    lastSaved: new Date()
  };

  try {
    // Hydrate from database
    const result = await sql`
      SELECT content FROM documents WHERE id = ${docId}
    `;
    
    if (result.length > 0) {
      const content = result[0].content as string;
      if (content) {
        ytext.insert(0, content);
      }
      console.log(`Loaded existing document ${docId} with ${content.length} characters`);
    } else {
      // Create new document
      await sql`
        INSERT INTO documents (id, content) 
        VALUES (${docId}, '') 
        ON CONFLICT (id) DO NOTHING
      `;
      console.log(`Created new document: ${docId}`);
    }
  } catch (error) {
    console.error(`Error loading room ${docId}:`, error);
  }

  // Set up debounced save
  const saveDebounced = () => {
    if (room.saveTimer) {
      clearTimeout(room.saveTimer);
    }
    
    room.saveTimer = setTimeout(async () => {
      try {
        const content = ytext.toString();
        await sql`
          UPDATE documents 
          SET content = ${content}, updated_at = NOW() 
          WHERE id = ${docId}
        `;
        room.lastSaved = new Date();
        console.log(`Saved document ${docId} (${content.length} characters)`);
      } catch (error) {
        console.error(`Error saving document ${docId}:`, error);
      }
    }, 2000);
  };

  doc.on('update', saveDebounced);

  rooms.set(docId, room);
  return room;
}

// REST API endpoints
app.get('/api/docs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sql`
      SELECT * FROM documents WHERE id = ${id}
    `;
    
    if (result.length > 0) {
      const room = rooms.get(id);
      res.json({
        ...result[0],
        lastSaved: room?.lastSaved,
        isLoaded: rooms.has(id)
      });
    } else {
      res.status(404).json({ error: 'Document not found' });
    }
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/docs/:id/status', async (req, res) => {
  const { id } = req.params;
  const room = rooms.get(id);
  
  res.json({
    exists: rooms.has(id),
    lastSaved: room?.lastSaved,
    contentLength: room?.ytext.length || 0
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    uptime: process.uptime()
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// WebSocket setup
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (request, socket, head) => {
  const url = new URL(request.url!, `http://${request.headers.host}`);
  
  if (url.pathname === '/collab') {
    const docId = url.searchParams.get('room') || 'default';
    
    try {
      const room = await loadRoom(docId);
      
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log(`WebSocket connection established for room: ${docId}`);
        setupWSConnection(ws, request, { 
          docName: docId, 
          gc: true,
          docs: new Map([[docId, room.doc]])
        });
      });
    } catch (error) {
      console.error('WebSocket upgrade error:', error);
      socket.destroy();
    }
  } else {
    socket.destroy();
  }
});

// Initialize and start server
const PORT = process.env.PORT || 5000;

initDatabase().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}/collab`);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
