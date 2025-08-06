
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './components/HomePage'
import DocumentEditor from './components/DocumentEditor'

function App() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/doc/:id" element={<DocumentEditor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
