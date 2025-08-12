
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import CollabEditor from './CollabEditor'
import { getUsername } from '../utils/username'

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

  useEffect(() => {
    if (!id) {
      navigate('/')
      return
    }

    // Check document status
    fetch(`http://localhost:5001/api/docs/${id}/status`)
      .then(res => res.json())
      .then(data => {
        setStatus({
          isLoading: false,
          lastSaved: data.lastSaved
        })
      })
      .catch(error => {
        console.error('Error fetching document status:', error)
        setStatus({
          isLoading: false,
          error: 'Failed to load document'
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
              <h1 className="text-white font-medium">Document: {id}</h1>
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

      {/* Editor */}
      <div className="flex-1">
        <CollabEditor docId={id} username={username} />
      </div>
    </div>
  )
}

export default DocumentEditor
