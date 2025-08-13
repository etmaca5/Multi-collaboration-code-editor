
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function HomePage() {
  const [docId, setDocId] = useState('')
  const navigate = useNavigate()

  const handleCreateNew = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Project' }),
      })

      if (!response.ok) {
        throw new Error('Failed to create project')
      }

      const project = await response.json()
      navigate(`/project/${project.id}`)
    } catch (error) {
      console.error('Error creating project:', error)
      // Fallback to old document format
      const newId = generateDocId()
      navigate(`/doc/${newId}`)
    }
  }

  const handleJoinExisting = () => {
    if (docId.trim()) {
      // Try project first, then fallback to document
      navigate(`/project/${docId.trim()}`)
    }
  }

  const generateDocId = () => {
    const adjectives = ['swift', 'bright', 'calm', 'bold', 'clever', 'gentle', 'happy', 'keen']
    const nouns = ['falcon', 'river', 'mountain', 'forest', 'ocean', 'garden', 'meadow', 'valley']
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    const num = Math.floor(Math.random() * 1000)
    return `${adj}-${noun}-${num}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Collaborative Code Editor
          </h1>
          <p className="text-gray-400">
            Create or join a project to start coding together
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleCreateNew}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
          >
            Create New Editor
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">or</span>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              placeholder="Enter project ID"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleJoinExisting()
                }
              }}
            />
            <button
              onClick={handleJoinExisting}
              disabled={!docId.trim()}
              className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
            >
              Join Existing Project
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Share the project URL to collaborate with others
          </p>
        </div>
      </div>
    </div>
  )
}

export default HomePage
