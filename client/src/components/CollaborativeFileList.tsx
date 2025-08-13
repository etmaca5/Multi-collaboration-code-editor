import React, { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

interface File {
  id: string
  name: string
  path: string
  language: string
}

interface Props {
  projectId: string
  onFilesChange: (files: File[]) => void
  onAddFile: (name: string, language: string) => void
  onDeleteFile: (fileId: string) => void
}

function CollaborativeFileList({ projectId, onFilesChange, onAddFile, onDeleteFile }: Props) {
  const ydocRef = useRef<Y.Doc>()
  const providerRef = useRef<WebsocketProvider>()
  const yfilesRef = useRef<Y.Array<any>>()

  useEffect(() => {
    console.log('CollaborativeFileList: Initializing for project:', projectId)
    
    // Initialize Yjs document for file list
    const ydoc = new Y.Doc()
    const yfiles = ydoc.getArray('files')
    
    // Create WebSocket provider for file list
    const provider = new WebsocketProvider(
      'ws://localhost:5001/collab',
      `${projectId}-files`,
      ydoc
    )

    // Handle file list updates
    yfiles.observe(event => {
      const files: File[] = yfiles.toArray().map(item => ({
        id: item.id,
        name: item.name,
        path: item.path,
        language: item.language
      }))
      onFilesChange(files)
    })

    // Store references
    ydocRef.current = ydoc
    providerRef.current = provider
    yfilesRef.current = yfiles

    return () => {
      if (providerRef.current) {
        providerRef.current.destroy()
      }
      if (ydocRef.current) {
        ydocRef.current.destroy()
      }
    }
  }, [projectId, onFilesChange])

  const handleAddFile = (name: string, language: string) => {
    if (yfilesRef.current) {
      const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      yfilesRef.current.push([{
        id: fileId,
        name,
        path: name,
        language
      }])
    }
  }

  const handleDeleteFile = (fileId: string) => {
    if (yfilesRef.current) {
      const files = yfilesRef.current.toArray()
      const index = files.findIndex(file => file.id === fileId)
      if (index !== -1) {
        yfilesRef.current.delete(index, 1)
      }
    }
  }

  // Expose methods to parent component
  useEffect(() => {
    // This is a bit of a hack, but it allows the parent to call these methods
    ;(window as any).addFileToProject = handleAddFile
    ;(window as any).deleteFileFromProject = handleDeleteFile
    
    return () => {
      delete (window as any).addFileToProject
      delete (window as any).deleteFileFromProject
    }
  }, [])

  return null // This component doesn't render anything visible
}

export default CollaborativeFileList
