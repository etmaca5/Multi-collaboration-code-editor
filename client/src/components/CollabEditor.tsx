
import React, { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { MonacoBinding } from 'y-monaco'

interface Props {
  docId: string
  username: string
}

interface RemoteUser {
  clientId: number
  user: {
    name: string
    color: string
  }
  cursor?: {
    line: number
    column: number
  }
}

function CollabEditor({ docId, username }: Props) {
  const ydocRef = useRef<Y.Doc>()
  const providerRef = useRef<WebsocketProvider>()
  const ytextRef = useRef<Y.Text>()
  const bindingRef = useRef<MonacoBinding>()
  const editorRef = useRef<any>()
  const monacoRef = useRef<any>()
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Initialize Yjs document
    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('content')
    
    // Create WebSocket provider
    const provider = new WebsocketProvider(
      'ws://localhost:5001/collab', // Use the correct server path
      docId,
      ydoc
    )

    // Set up awareness for user presence
    const awareness = provider.awareness
    awareness.setLocalStateField('user', {
      name: username,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
    })

    // Handle awareness updates
    awareness.on('change', () => {
      const states = Array.from(awareness.getStates().entries())
      const users: RemoteUser[] = states
        .filter(([clientId]) => clientId !== awareness.clientID)
        .map(([clientId, state]) => ({
          clientId,
          user: state.user,
          cursor: state.cursor
        }))
      setRemoteUsers(users)
    })

    // Handle connection status
    provider.on('status', ({ status }: { status: string }) => {
      setIsConnected(status === 'connected')
    })

    // Store references
    ydocRef.current = ydoc
    providerRef.current = provider
    ytextRef.current = ytext

    return () => {
      provider.destroy()
      ydoc.destroy()
    }
  }, [docId, username])

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Only create binding if we have the Yjs document ready
    if (ytextRef.current && providerRef.current) {
      const model = editor.getModel()
      const binding = new MonacoBinding(
        ytextRef.current,
        model,
        new Set([editor]),
        providerRef.current.awareness
      )
      bindingRef.current = binding
    }
  }

  const handleEditorWillMount = (monaco: any) => {
    monacoRef.current = monaco
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold">Document: {docId}</h2>
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Editing as: {username}</span>
          {remoteUsers.length > 0 && (
            <div className="flex items-center space-x-1">
              <span className="text-sm text-gray-600">Others:</span>
              {remoteUsers.map(user => (
                <div
                  key={user.clientId}
                  className="flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: user.user.color }}
                  ></div>
                  <span className="text-sm">{user.user.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          defaultValue="// Start typing here..."
          onMount={handleEditorDidMount}
          beforeMount={handleEditorWillMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            automaticLayout: true
          }}
        />
      </div>
    </div>
  )
}

export default CollabEditor
