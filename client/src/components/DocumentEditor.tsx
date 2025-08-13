
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import CollabEditor from './CollabEditor'
import FileExplorer from './FileExplorer'
import CollaborativeFileList from './CollaborativeFileList'
import { getUsername } from '../utils/username'

interface File {
  id: string
  name: string
  path: string
  language: string
}

interface Project {
  id: string
  name: string
  created_at: string
  updated_at: string
}

interface DocumentStatus {
  lastSaved?: string
  isLoading: boolean
  error?: string
}

function DocumentEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [username] = useState(() => getUsername())
  const [status, setStatus] = useState<DocumentStatus>({ isLoading: true })
  const [copied, setCopied] = useState(false)
  const [project, setProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)

  console.log('DocumentEditor: Rendering with id:', id, 'username:', username, 'status:', status)

  useEffect(() => {
    if (!id) {
      navigate('/')
      return
    }

    // Try to load as project first
    fetch(`http://localhost:5001/api/projects/${id}`)
      .then(res => {
        if (res.ok) {
          return res.json()
        }
        // If project not found, try legacy document format
        throw new Error('Project not found, trying legacy format')
      })
      .then(data => {
        console.log('DocumentEditor: Project loaded:', data)
        setProject(data.project)
        setFiles(data.files)
        setSelectedFileId(data.files.length > 0 ? data.files[0].id : null)
        setStatus({
          isLoading: false,
          lastSaved: data.project.updated_at
        })
      })
      .catch(error => {
        console.log('Project not found, trying legacy document format')
        // Fallback to legacy document format
        fetch(`http://localhost:5001/api/docs/${id}/status`)
          .then(res => res.json())
          .then(data => {
            console.log('DocumentEditor: Legacy document loaded:', data)
            setStatus({
              isLoading: false,
              lastSaved: data.lastSaved
            })
          })
          .catch(legacyError => {
            console.error('Error loading document:', legacyError)
            setStatus({
              isLoading: false,
              error: 'Failed to load project or document'
            })
          })
      })
  }, [id, navigate])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const formatLastSaved = (lastSaved?: string) => {
    if (!lastSaved) return 'Never'
    const date = new Date(lastSaved)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    
    if (diffSeconds < 60) return 'Just now'
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`
    return date.toLocaleDateString()
  }

  const handleAddFile = (name: string, language: string) => {
    // Use the collaborative file list to add files
    if ((window as any).addFileToProject) {
      (window as any).addFileToProject(name, language)
    }
  }

  const handleDeleteFile = (fileId: string) => {
    // Use the collaborative file list to delete files
    if ((window as any).deleteFileFromProject) {
      (window as any).deleteFileFromProject(fileId)
    }
    
    // If we deleted the currently selected file, select the first available file
    if (selectedFileId === fileId) {
      const remainingFiles = files.filter(f => f.id !== fileId)
      setSelectedFileId(remainingFiles.length > 0 ? remainingFiles[0].id : null)
    }
  }

  const handleFileSelect = (fileId: string) => {
    console.log('DocumentEditor: Selecting file:', fileId)
    setSelectedFileId(fileId)
  }

  if (!id) {
    return null
  }

  if (status.isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading document...</div>
      </div>
    )
  }

  if (status.error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">{status.error}</div>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const selectedFile = files.find(f => f.id === selectedFileId)

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-white font-medium">
                {project ? `${project.name}: ${selectedFile?.name || 'No file selected'}` : `Document: ${id}`}
              </h1>
              <p className="text-sm text-gray-400">
                Editing as {username}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-400">
              Last saved: {formatLastSaved(status.lastSaved)}
            </div>
            <button
              onClick={handleCopyLink}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex" style={{ height: 'calc(100vh - 80px)' }}>
        {/* File Explorer - only show for projects */}
        {project && (
          <FileExplorer
            files={files}
            selectedFileId={selectedFileId}
            onFileSelect={handleFileSelect}
            onAddFile={handleAddFile}
            onDeleteFile={handleDeleteFile}
          />
        )}

        {/* Editor */}
        <div className="flex-1">
          {project && selectedFile ? (
            <CollabEditor 
              key={selectedFile.id} // Force re-render when file changes
              docId={id} 
              username={username} 
              fileId={selectedFile.id}
              language={selectedFile.language}
            />
          ) : !project ? (
            <CollabEditor 
              docId={id} 
              username={username} 
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Select a file to start editing
            </div>
          )}
        </div>
      </div>

      {/* Collaborative File List - hidden component for syncing file changes */}
      {project && (
        <CollaborativeFileList
          projectId={id}
          onFilesChange={setFiles}
          onAddFile={handleAddFile}
          onDeleteFile={handleDeleteFile}
        />
      )}
    </div>
  )
}

export default DocumentEditor
