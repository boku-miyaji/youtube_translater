import React, { useState } from 'react'

interface TranscriptViewerProps {
  transcript?: string
}

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript }) => {
  const [showSummary, setShowSummary] = useState(false)
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)

  const generateSummary = async () => {
    if (!transcript) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate summary')
      }

      const data = await response.json()
      setSummary(data.summary)
      setShowSummary(true)
    } catch (error) {
      console.error('Error generating summary:', error)
      alert('Failed to generate summary. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">Transcript</h2>
        {transcript && (
          <div className="space-x-2">
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="inline-flex items-center px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            >
              {showSummary ? 'Show Transcript' : 'Show Summary'}
            </button>
            {!summary && (
              <button
                onClick={generateSummary}
                disabled={loading}
                className="inline-flex items-center px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Generating...' : 'Generate Summary'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {showSummary && summary ? (
          <div className="prose max-w-none">
            <div dangerouslySetInnerHTML={{ __html: summary }} />
          </div>
        ) : transcript ? (
          <div className="whitespace-pre-wrap text-sm text-gray-700">
            {transcript}
          </div>
        ) : (
          <p className="text-gray-500">No transcript available</p>
        )}
      </div>
    </div>
  )
}

export default TranscriptViewer