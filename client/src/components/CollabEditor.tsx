
import React, { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

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
  const editorRef = useRef<any>()
  const monacoRef = useRef<any>()
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([])
  const decorationsRef = useRef<string[]>([])

  useEffect(() => {
    const ydoc = new Y.Doc()
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${wsProtocol}//${window.location.host}/collab`
    
    const provider = new WebsocketProvider(wsUrl, docId, ydoc)
    const ytext = ydoc.getText('content')

    // Generate user color
    const color = '#' + (Math.random() * 0xffffff | 0).toString(16).padStart(6, '0')
    
    // Set local awareness state
    provider.awareness.setLocalState({
      user: { name: username, color }
    })

    // Connection status handling
    provider.on('status', ({ status }: { status: string }) => {
      setConnectionStatus(status as any)
    })

    // Awareness (presence) handling
    provider.awareness.on('change', () => {
      const states = Array.from(provider.awareness.getStates().entries())
      const users: RemoteUser[] = states
        .filter(([clientId]) => clientId !== provider.awareness.clientID)
        .map(([clientId, state]) => ({
          clientId,
          user: state.user || { name: 'Anonymous', color: '#888888' },
          cursor: state.cursor
        }))
      
      setRemoteUsers(users)
      updateCursorDecorations(users)
    })

    ydocRef.current = ydoc
    providerRef.current = provider
    ytextRef.current = ytext

    return () => {
      provider.destroy()
      ydoc.destroy()
    }
  }, [docId, username])

  const updateCursorDecorations = (users: RemoteUser[]) => {
    if (!editorRef.current || !monacoRef.current) return

    const model = editorRef.current.getModel()
    if (!model) return

    // Clear existing decorations
    decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [])

    // Create new decorations for remote cursors
    const newDecorations = users
      .filter(user => user.cursor)
      .map(user => ({
        range: new monacoRef.current.Range(
          user.cursor!.line,
          user.cursor!.column,
          user.cursor!.line,
          user.cursor!.column
        ),
        options: {
          className: 'cursor-decoration',
          beforeContentClassName: 'cursor-line',
          stickiness: monacoRef.current.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          minimap: {
            color: user.user.color,
            position: monacoRef.current.editor.MinimapPosition.Inline
          }
        }
      }))

    decorationsRef.current = editorRef.current.deltaDecorations([], newDecorations)
  }

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor
    monacoRef.current = monaco
    
    const ytext = ytextRef.current!
    const provider = providerRef.current!

    // Set initial content
    editor.setValue(ytext.toString())

    // Yjs to Monaco binding
    const applyYjsToMonaco = () => {
      const newValue = ytext.toString()
      const currentValue = editor.getValue()
      
      if (newValue !== currentValue) {
        const model = editor.getModel()
        if (model) {
          model.pushEditOperations(
            [],
            [{ range: model.getFullModelRange(), text: newValue }],
            () => null
          )
        }
      }
    }

    ytext.observe(applyYjsToMonaco)

    // Monaco to Yjs binding
    const monacoToYjs = editor.onDidChangeModelContent((event: any) => {
      if (event.isFlush) return // Ignore flush events (from Yjs updates)
      
      const value = editor.getValue()
      const ytextValue = ytext.toString()
      
      if (value !== ytextValue) {
        ytext.delete(0, ytext.length)
        ytext.insert(0, value)
      }
    })

    // Cursor position tracking
    const updateCursor = () => {
      const position = editor.getPosition()
      if (position) {
        provider.awareness.setLocalStateField('cursor', {
          line: position.lineNumber,
          column: position.column
        })
      }
    }

    const cursorTracker = editor.onDidChangeCursorPosition(updateCursor)

    // Cleanup function
    const cleanup = () => {
      ytext.unobserve(applyYjsToMonaco)
      monacoToYjs.dispose()
      cursorTracker.dispose()
    }

    editor.onDidDispose(cleanup)
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500'
      case 'connecting': return 'bg-yellow-500'
      case 'disconnected': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Status bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
            <span className="text-sm text-gray-400 capitalize">{connectionStatus}</span>
          </div>
          
          {remoteUsers.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400">Active users:</span>
              <div className="flex space-x-2">
                {remoteUsers.map(user => (
                  <div
                    key={user.clientId}
                    className="flex items-center space-x-1"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: user.user.color }}
                    ></div>
                    <span className="text-sm text-gray-300">{user.user.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          theme="vs-dark"
          defaultLanguage="javascript"
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            automaticLayout: true,
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            contextmenu: true,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabSize: 2,
            insertSpaces: true
          }}
        />
      </div>
    </div>
  )
}

export default CollabEditor
