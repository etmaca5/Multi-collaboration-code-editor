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
    // Create projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create files table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        language TEXT DEFAULT 'markdown',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, path)
      )
    `);

    // Keep old documents table for backward compatibility
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

// Helper functions for generating IDs
function generateProjectId(): string {
  const adjectives = ['swift', 'bright', 'calm', 'bold', 'clever', 'gentle', 'happy', 'keen']
  const nouns = ['falcon', 'river', 'mountain', 'forest', 'ocean', 'garden', 'meadow', 'valley']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(Math.random() * 1000)
  return `${adj}-${noun}-${num}`
}

function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Document storage
const docs = new Map<string, Y.Doc>();

// Project file lists storage (for collaborative file management)
const projectFileLists = new Map<string, Y.Doc>();

// Get or create document (supports both old document format and new file format)
async function getDocument(docId: string, fileId?: string): Promise<Y.Doc> {
  const docKey = fileId ? `${docId}:${fileId}` : docId;
  
  if (docs.has(docKey)) {
    return docs.get(docKey)!;
  }

  const ydoc = new Y.Doc();
  
  // Initialize the document structure properly
  const ytext = ydoc.getText('content');
  
  // Force a transaction to ensure the document structure is created
  ydoc.transact(() => {
    // This ensures the document has the proper Yjs structure
    ytext.insert(0, '');
  });

  // Load content from database
  if (pool) {
    try {
      if (fileId) {
        // Load from files table (new format)
        const result = await pool.query(
          'SELECT content FROM files WHERE id = $1',
          [fileId]
        );
        
        if (result.rows.length > 0 && result.rows[0].content) {
          ytext.delete(0, ytext.length);
          ytext.insert(0, result.rows[0].content);
        } else {
          // If file doesn't exist in database, create it with empty content
          await pool.query(
            'INSERT INTO files (id, project_id, name, path, content, language) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
            [fileId, docId, 'Untitled', 'untitled', '', 'markdown']
          );
        }
      } else {
        // Load from documents table (legacy format)
        const result = await pool.query(
          'SELECT content FROM documents WHERE id = $1',
          [docId]
        );
        
        if (result.rows.length > 0 && result.rows[0].content) {
          ytext.delete(0, ytext.length);
          ytext.insert(0, result.rows[0].content);
        }
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
          if (fileId) {
            // Save to files table (new format)
            await pool.query(
              `UPDATE files SET content = $1, updated_at = NOW() WHERE id = $2`,
              [content, fileId]
            );
            console.log(`File ${fileId} saved`);
          } else {
            // Save to documents table (legacy format)
            await pool.query(
              `INSERT INTO documents (id, content, updated_at)
               VALUES ($1, $2, NOW())
               ON CONFLICT (id) DO UPDATE SET
                 content = EXCLUDED.content,
                 updated_at = EXCLUDED.updated_at`,
              [docId, content]
            );
            console.log(`Document ${docId} saved`);
          }
        } catch (error) {
          console.error('Error saving document:', error);
        }
      }
    }, 1000);
  });

  // Store the document in memory
  docs.set(docKey, ydoc);
  return ydoc;
}

// Get or create project file list (for collaborative file management)
async function getProjectFileList(projectId: string): Promise<Y.Doc> {
  if (projectFileLists.has(projectId)) {
    return projectFileLists.get(projectId)!;
  }

  const ydoc = new Y.Doc();
  const yfiles = ydoc.getArray('files');
  
  // Load existing files from database
  if (pool) {
    try {
      const result = await pool.query(
        'SELECT * FROM files WHERE project_id = $1 ORDER BY path',
        [projectId]
      );
      
      result.rows.forEach(file => {
        yfiles.push([{
          id: file.id,
          name: file.name,
          path: file.path,
          language: file.language
        }]);
      });
    } catch (error) {
      console.error('Error loading project files:', error);
    }
  }

  // Auto-save file list changes to database
  ydoc.on('update', () => {
    // This will be handled by the file management endpoints
    console.log(`Project ${projectId} file list updated`);
  });

  projectFileLists.set(projectId, ydoc);
  return ydoc;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Project and file management endpoints
app.get('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  
  if (!pool) {
    return res.json({ error: 'Database not available' });
  }
  
  try {
    // Get project info
    const projectResult = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get all files in the project
    const filesResult = await pool.query(
      'SELECT * FROM files WHERE project_id = $1 ORDER BY path',
      [id]
    );
    
    res.json({
      project: projectResult.rows[0],
      files: filesResult.rows
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

app.post('/api/projects', async (req, res) => {
  const { name } = req.body;
  
  if (!pool) {
    return res.json({ error: 'Database not available' });
  }
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Project name is required' });
  }
  
  try {
    const projectId = generateProjectId();
    const result = await pool.query(
      'INSERT INTO projects (id, name) VALUES ($1, $2) RETURNING *',
      [projectId, name.trim()]
    );
    
    // Create a default file
    const fileId = generateFileId();
    await pool.query(
      'INSERT INTO files (id, project_id, name, path, content, language) VALUES ($1, $2, $3, $4, $5, $6)',
      [fileId, projectId, 'main.md', 'main.md', '# Welcome to your new project\n\nStart coding here...', 'markdown']
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.post('/api/projects/:projectId/files', async (req, res) => {
  const { projectId } = req.params;
  const { name, language = 'markdown' } = req.body;
  
  if (!pool) {
    return res.json({ error: 'Database not available' });
  }
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'File name is required' });
  }
  
  try {
    const fileId = generateFileId();
    const path = name; // Use name as path for now
    const result = await pool.query(
      'INSERT INTO files (id, project_id, name, path, content, language) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [fileId, projectId, name.trim(), path, '', language]
    );
    
    // Update the collaborative file list
    const fileListDoc = await getProjectFileList(projectId);
    const yfiles = fileListDoc.getArray('files');
    yfiles.push([{
      id: fileId,
      name: name.trim(),
      path: path,
      language: language
    }]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating file:', error);
    res.status(500).json({ error: 'Failed to create file' });
  }
});

app.delete('/api/files/:fileId', async (req, res) => {
  const { fileId } = req.params;
  
  if (!pool) {
    return res.json({ error: 'Database not available' });
  }
  
  try {
    // Get the project ID before deleting
    const projectResult = await pool.query(
      'SELECT project_id FROM files WHERE id = $1',
      [fileId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const projectId = projectResult.rows[0].project_id;
    
    // Delete from database
    const result = await pool.query(
      'DELETE FROM files WHERE id = $1 RETURNING *',
      [fileId]
    );
    
    // Update the collaborative file list
    const fileListDoc = await getProjectFileList(projectId);
    const yfiles = fileListDoc.getArray('files');
    const files = yfiles.toArray();
    const index = files.findIndex((file: any) => file.id === fileId);
    if (index !== -1) {
      yfiles.delete(index, 1);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
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
      // Don't close the connection, just log the error
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
    
    // Extract document ID and file ID from the path
    // y-websocket v1.5.0 sends: /collab/{docId} or /collab/{docId}:{fileId}
    const pathParts = url.pathname.split('/');
    const docAndFile = pathParts[pathParts.length - 1];
    
    if (!docAndFile || docAndFile === 'collab') {
      console.log('WebSocket connection attempt without valid document ID:', req.url);
      ws.close(1008, 'Missing document ID');
      return;
    }

    // Parse docId and fileId
    const parts = docAndFile.split(':');
    const docId = parts[0];
    const fileId = parts[1]; // Optional

    console.log(`Client connected to room: ${docId}${fileId ? `:${fileId}` : ''}`);

    // Check if this is a project file list connection
    if (docId.endsWith('-files')) {
      const projectId = docId.replace('-files', '');
      getProjectFileList(projectId).then(ydoc => {
        try {
          setupWSConnection(ws, req, {
            docName: docAndFile,
            doc: ydoc
          });
        } catch (error) {
          console.error('Error in setupWSConnection:', error);
          ws.close(1011, 'Internal server error');
        }
      }).catch(error => {
        console.error('Error getting project file list:', error);
        ws.close(1011, 'Internal server error');
      });
    } else {
      // Get or create document and setup connection
      getDocument(docId, fileId).then(ydoc => {
        try {
          setupWSConnection(ws, req, {
            docName: docAndFile,
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
    }
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