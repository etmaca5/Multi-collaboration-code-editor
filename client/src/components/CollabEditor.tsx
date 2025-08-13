
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
  const [isEditorReady, setIsEditorReady] = useState(false)

  useEffect(() => {
    console.log('CollabEditor: Initializing Yjs document for docId:', docId)
    
    // Initialize Yjs document
    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('content')
    
    // Create WebSocket provider with the correct URL format for v1.5.0
    const provider = new WebsocketProvider(
      'ws://10.19.201.44:5001/collab',
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
      console.log('CollabEditor: WebSocket status:', status)
      setIsConnected(status === 'connected')
    })

    // Store references
    ydocRef.current = ydoc
    providerRef.current = provider
    ytextRef.current = ytext

    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy()
      }
      provider.destroy()
      ydoc.destroy()
    }
  }, [docId, username])

  const handleEditorDidMount = (editor: any, monaco: any) => {
    console.log('CollabEditor: Editor mounted successfully')
    editorRef.current = editor
    monacoRef.current = monaco
    setIsEditorReady(true)

    // Create binding if we have the Yjs document ready
    if (ytextRef.current && providerRef.current) {
      console.log('CollabEditor: Creating Monaco binding')
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
    console.log('CollabEditor: Editor will mount')
    monacoRef.current = monaco
  }

  // Create binding when both editor and Yjs are ready
  useEffect(() => {
    if (isEditorReady && ytextRef.current && providerRef.current && editorRef.current && !bindingRef.current) {
      console.log('CollabEditor: Creating delayed Monaco binding')
      const model = editorRef.current.getModel()
      const binding = new MonacoBinding(
        ytextRef.current,
        model,
        new Set([editorRef.current]),
        providerRef.current.awareness
      )
      bindingRef.current = binding
    }
  }, [isEditorReady])

  console.log('CollabEditor: Rendering with isConnected:', isConnected, 'isEditorReady:', isEditorReady)

  return (
    <div className="flex flex-col h-full bg-white" style={{ height: '100vh' }}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-4">
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
      
      <div className="flex-1" style={{ height: 'calc(100vh - 80px)', minHeight: '400px' }}>
        <Editor
          height="100%"
          defaultLanguage="markdown"
          defaultValue="Start typing here..."
          onMount={handleEditorDidMount}
          beforeMount={handleEditorWillMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            automaticLayout: true,
            theme: 'vs',
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            selectOnLineNumbers: true,
            roundedSelection: false,
            readOnly: false,
            cursorStyle: 'line',
            contextmenu: true,
            mouseWheelZoom: true,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on'
          }}
        />
      </div>
    </div>
  )
}

export default CollabEditor
