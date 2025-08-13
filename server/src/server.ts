import { config } from 'dotenv';
import path from 'path';

// Load environment variables from the root directory
config({ path: path.join(__dirname, '../../.env') });
import express from 'express';
import { WebSocketServer } from 'ws';
import { Pool } from 'pg';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import http from 'http';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from client build (only in production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
}

// Create connection pool
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
}) : null;

// Initialize database
async function initDatabase() {
  if (!pool) {
    console.log('No database connection - running in demo mode');
    return;
  }
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
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
  
  // Initialize the document structure properly
  const ytext = ydoc.getText('content');
  
  // Force a transaction to ensure the document structure is created
  ydoc.transact(() => {
    // This ensures the document has the proper Yjs structure
    ytext.insert(0, '');
  });

  // Load document from database
  if (pool) {
    try {
      const result = await pool.query(
        'SELECT content FROM documents WHERE id = $1',
        [docId]
      );
      
      if (result.rows.length > 0 && result.rows[0].content) {
        // Clear the initial empty content and insert the actual content
        ytext.delete(0, ytext.length);
        ytext.insert(0, result.rows[0].content);
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
      if (pool) {
        try {
          const content = ytext.toString();
          await pool.query(
            `INSERT INTO documents (id, content, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (id) DO UPDATE SET
               content = EXCLUDED.content,
               updated_at = EXCLUDED.updated_at`,
            [docId, content]
          );
          console.log(`Document ${docId} saved`);
        } catch (error) {
          console.error('Error saving document:', error);
        }
      }
    }, 1000);
  });

  // Store the document in memory
  docs.set(docId, ydoc);
  return ydoc;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/docs/:id/status', async (req, res) => {
  const { id } = req.params;
  
  if (!pool) {
    return res.json({ lastSaved: null });
  }
  
  try {
    const result = await pool.query(
      'SELECT updated_at FROM documents WHERE id = $1',
      [id]
    );
    
    res.json({
      lastSaved: result.rows.length > 0 ? result.rows[0].updated_at : null
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
  server
});

// Simple WebSocket connection handler
function setupWSConnection(ws: any, req: any, { docName, doc }: { docName: string, doc: Y.Doc }) {
  const awareness = new Awareness(doc);
  
  // Handle incoming messages - simple approach
  ws.on('message', (message: Buffer) => {
    if (ws.readyState !== ws.OPEN || !message || message.length === 0) return;
    
    try {
      // Convert Buffer to Uint8Array if needed
      const uint8Message = new Uint8Array(message);
      Y.applyUpdate(doc, uint8Message);
    } catch (error) {
      console.error('Error applying update:', error);
    }
  });

  // Send initial state
  try {
    const state = Y.encodeStateAsUpdate(doc);
    ws.send(state);
  } catch (error) {
    console.error('Error sending initial state:', error);
  }

  // Handle awareness updates
  awareness.on('update', (update: Uint8Array) => {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(update);
      } catch (error) {
        console.error('Error sending awareness update:', error);
      }
    }
  });

  // Handle document updates
  doc.on('update', (update: Uint8Array, origin: any) => {
    if (origin !== ws && ws.readyState === ws.OPEN) {
      try {
        ws.send(update);
      } catch (error) {
        console.error('Error sending document update:', error);
      }
    }
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
  try {
    console.log('WebSocket connection attempt:', req.url);
    const url = new URL(req.url!, `http://${req.headers.host}`);
    
    // Extract document ID from the path
    // y-websocket sends: /collab/{docId}
    const pathParts = url.pathname.split('/');
    const docId = pathParts[pathParts.length - 1];

    if (!docId || docId === 'collab') {
      console.log('WebSocket connection attempt without valid document ID:', req.url);
      ws.close(1008, 'Missing document ID');
      return;
    }

    console.log(`Client connected to room: ${docId}`);

    // Get or create document and setup connection
    getDocument(docId).then(ydoc => {
      try {
        setupWSConnection(ws, req, {
          docName: docId,
          doc: ydoc
        });
      } catch (error) {
        console.error('Error in setupWSConnection:', error);
        ws.close(1011, 'Internal server error');
      }
    }).catch(error => {
      console.error('Error getting document:', error);
      ws.close(1011, 'Internal server error');
    });
  } catch (error) {
    console.error('Error in WebSocket connection handler:', error);
    ws.close(1011, 'Internal server error');
  }
});

const PORT = process.env.PORT || 5001;

// Initialize database and start server
initDatabase().then(() => {
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});