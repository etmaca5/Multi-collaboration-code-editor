import React, { useState } from 'react'

interface File {
  id: string
  name: string
  path: string
  language: string
}

interface Props {
  files: File[]
  selectedFileId: string | null
  onFileSelect: (fileId: string) => void
  onAddFile: (name: string, language: string) => void
  onDeleteFile: (fileId: string) => void
}

function FileExplorer({ files, selectedFileId, onFileSelect, onAddFile, onDeleteFile }: Props) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newFileLanguage, setNewFileLanguage] = useState('markdown')

  const handleAddFile = () => {
    if (newFileName.trim()) {
      onAddFile(newFileName.trim(), newFileLanguage)
      setNewFileName('')
      setNewFileLanguage('markdown')
      setShowAddForm(false)
    }
  }

  const getLanguageIcon = (language: string) => {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
        return '📄'
      case 'typescript':
      case 'ts':
        return '📄'
      case 'python':
      case 'py':
        return '🐍'
      case 'html':
        return '🌐'
      case 'css':
        return '🎨'
      case 'json':
        return '📋'
      case 'markdown':
      case 'md':
        return '📝'
      default:
        return '📄'
    }
  }

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-medium">Files</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-gray-400 hover:text-white transition-colors"
            title="Add new file"
          >
            +
          </button>
        </div>
      </div>

      {/* Add File Form */}
      {showAddForm && (
        <div className="p-4 border-b border-gray-700 bg-gray-750">
          <div className="space-y-3">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="File name (e.g., index.js)"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddFile()
                }
              }}
            />
            <select
              value={newFileLanguage}
              onChange={(e) => setNewFileLanguage(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="markdown">Markdown</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="json">JSON</option>
            </select>
            <div className="flex space-x-2">
              <button
                onClick={handleAddFile}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            No files yet. Add your first file!
          </div>
        ) : (
          <div className="py-2">
            {files.map((file) => (
              <div
                key={file.id}
                className={`group flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-700 transition-colors ${
                  selectedFileId === file.id ? 'bg-gray-700 border-r-2 border-blue-500' : ''
                }`}
                onClick={() => onFileSelect(file.id)}
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <span className="text-sm">{getLanguageIcon(file.language)}</span>
                  <span className="text-white text-sm truncate">{file.name}</span>
                </div>
                {files.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteFile(file.id)
                    }}
                    className="text-gray-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete file"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default FileExplorer
