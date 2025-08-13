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

    // Wait for the provider to be ready before setting up observers
    provider.on('sync', (isSynced: boolean) => {
      if (isSynced) {
        console.log('CollaborativeFileList: Synced with server')
        // Initial sync is complete, now safe to observe changes
        yfiles.observe(event => {
          const files: File[] = yfiles.toArray().map(item => ({
            id: item.id,
            name: item.name,
            path: item.path,
            language: item.language
          }))
          onFilesChange(files)
        })
        
        // Trigger initial file list update
        const files: File[] = yfiles.toArray().map(item => ({
          id: item.id,
          name: item.name,
          path: item.path,
          language: item.language
        }))
        onFilesChange(files)
      }
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

  const handleAddFile = async (name: string, language: string) => {
    try {
      // Create file through the server API to ensure proper database integration
      const response = await fetch(`http://localhost:5001/api/projects/${projectId}/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, language }),
      })

      if (!response.ok) {
        throw new Error('Failed to create file')
      }

      // The collaborative file list will be updated automatically through the sync
      console.log('File created successfully')
    } catch (error) {
      console.error('Error creating file:', error)
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    try {
      // Delete file through the server API to ensure proper database integration
      const response = await fetch(`http://localhost:5001/api/files/${fileId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete file')
      }

      // The collaborative file list will be updated automatically through the sync
      console.log('File deleted successfully')
    } catch (error) {
      console.error('Error deleting file:', error)
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
