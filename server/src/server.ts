import express from 'express';
import { WebSocketServer } from 'ws';
import { neon } from '@neondatabase/serverless';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import http from 'http';
import cors from 'cors';
import path from 'path';

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from client build (only in production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
}

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

// Initialize database
async function initDatabase() {
  if (!sql) {
    console.log('No database connection - running in demo mode');
    return;
  }
  
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
    console.error('Database initialization error:', error);
  }
}

// Document storage
const docs = new Map<string, Y.Doc>();

// Get or create document
async function getDocument(docId: string): Promise<Y.Doc> {
  if (docs.has(docId)) {
    return docs.get(docId)!;
  }

  const ydoc = new Y.Doc();
  const ytext = ydoc.getText('content');

    if (sql) {
    try {
      // Load document from database
      const result = await sql`
        SELECT content FROM documents WHERE id = ${docId}
      `;
      
      if (result.length > 0 && result[0].content) {
        ytext.insert(0, result[0].content);
      }
    } catch (error) {
      console.error('Error loading document:', error);
    }
  }

  // Auto-save changes with debouncing
  let saveTimeout: NodeJS.Timeout;
  ydoc.on('update', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      if (sql) {
        try {
          const content = ytext.toString();
          await sql`
            INSERT INTO documents (id, content, updated_at)
            VALUES (${docId}, ${content}, NOW())
            ON CONFLICT (id) DO UPDATE SET
              content = EXCLUDED.content,
              updated_at = EXCLUDED.updated_at
          `;
          console.log(`Document ${docId} saved`);
        } catch (error) {
          console.error('Error saving document:', error);
        }
      }
    }, 1000);
  });

  docs.set(docId, ydoc);
  return ydoc;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/docs/:id/status', async (req, res) => {
  const { id } = req.params;
  
  if (!sql) {
    return res.json({ lastSaved: null });
  }
  
  try {
    const result = await sql`
      SELECT updated_at FROM documents WHERE id = ${id}
    `;
    
    res.json({
      lastSaved: result.length > 0 ? result[0].updated_at : null
    });
  } catch (error) {
    console.error('Error fetching document status:', error);
    res.status(500).json({ error: 'Failed to fetch document status' });
  }
});

// Catch-all handler for SPA routing (only in production)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for collaboration
const wss = new WebSocketServer({
  server,
  path: '/collab'
});

// Custom WebSocket connection handler
function setupWSConnection(ws: any, req: any, { docName, doc }: { docName: string, doc: Y.Doc }) {
  const awareness = new Awareness(doc);
  
  ws.on('message', (message: Uint8Array) => {
    try {
      // Handle Yjs updates
      Y.applyUpdate(doc, message);
    } catch (error) {
      console.error('Error applying update:', error);
    }
  });

  // Send initial document state
  const state = Y.encodeStateAsUpdate(doc);
  ws.send(state);

  // Handle awareness changes
  awareness.on('update', (update: Uint8Array) => {
    ws.send(update);
  });

  ws.on('close', () => {
    console.log(`Client disconnected from room: ${docName}`);
    awareness.destroy();
  });

  ws.on('error', (error: Error) => {
    console.error(`WebSocket error in room ${docName}:`, error);
    awareness.destroy();
  });
}


wss.on('connection', (ws, req) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const docId = url.searchParams.get('room') || url.searchParams.get('d');

  if (!docId) {
    ws.close(1008, 'Missing room parameter');
    return;
  }

  console.log(`Client connected to room: ${docId}`);

  // Get or create document
  getDocument(docId).then(ydoc => {
    setupWSConnection(ws, req, {
      docName: docId,
      doc: ydoc
    });
  }).catch(error => {
    console.error('Error setting up WebSocket connection:', error);
    ws.close(1011, 'Internal server error');
  });
});

const PORT = process.env.PORT || 5001;

// Initialize database and start server
initDatabase().then(() => {
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});