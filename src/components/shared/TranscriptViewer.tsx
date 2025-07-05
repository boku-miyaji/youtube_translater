import React, { useState } from 'react'

interface TranscriptViewerProps {
  transcript?: string
  timestampedSegments?: Array<{
    start: number
    duration: number
    text: string
  }>
  summary?: string
  onSeek?: (time: number) => void
}

type TabType = 'transcript' | 'summary' | 'article'

// Simple markdown to HTML converter
const markdownToHtml = (markdown: string): string => {
  if (!markdown) return ''
  
  let html = markdown
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
  
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
  
  // Lists
  html = html.replace(/^\* (.+)/gim, '<li class="ml-4 mb-1">• $1</li>')
  html = html.replace(/^\d+\. (.+)/gim, '<li class="ml-4 mb-1">$1</li>')
  
  // Wrap consecutive list items
  html = html.replace(/(<li class="ml-4 mb-1">.*<\/li>\n?)+/g, (match) => {
    return `<ul class="list-none mb-4">${match}</ul>`
  })
  
  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p class="mb-4">')
  html = '<p class="mb-4">' + html + '</p>'
  
  // Clean up empty paragraphs
  html = html.replace(/<p class="mb-4">\s*<\/p>/g, '')
  
  return html
}

// Format time from seconds to mm:ss
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript, timestampedSegments, summary: initialSummary, onSeek }) => {
  const [activeTab, setActiveTab] = useState<TabType>('transcript')
  const [summary, setSummary] = useState(initialSummary || '')
  const [article, setArticle] = useState('')
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingArticle, setLoadingArticle] = useState(false)

  const generateSummary = async () => {
    if (!transcript) return
    
    setLoadingSummary(true)
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Summary generation failed:', response.status, errorText)
        throw new Error(`Failed to generate summary: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      setSummary(data.summary)
    } catch (error) {
      console.error('Error generating summary:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to generate summary: ${errorMessage}`)
    } finally {
      setLoadingSummary(false)
    }
  }

  const generateArticle = async () => {
    if (!transcript) return
    
    setLoadingArticle(true)
    try {
      const response = await fetch('/api/generate-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate article')
      }

      const data = await response.json()
      setArticle(data.article)
    } catch (error) {
      console.error('Error generating article:', error)
      alert('Failed to generate article. Please try again.')
    } finally {
      setLoadingArticle(false)
    }
  }

  const tabs = [
    { id: 'transcript', label: '文字起こし', icon: '📝' },
    { id: 'summary', label: '要約', icon: '📋' },
    { id: 'article', label: '解説記事', icon: '📄' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'transcript':
        if (timestampedSegments && timestampedSegments.length > 0) {
          return (
            <div className="space-y-4">
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => alert('文字起こしの再生成機能は実装予定です')}
                  className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <span className="mr-2">🔄</span>
                  再生成
                </button>
              </div>
              <div className="space-y-2">
                {timestampedSegments.map((segment, index) => (
                  <div
                    key={index}
                    className="flex gap-4 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <button
                      onClick={() => onSeek && onSeek(segment.start)}
                      className="text-gray-600 hover:text-gray-800 font-mono text-sm whitespace-nowrap px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      {formatTime(segment.start)}
                    </button>
                    <p className="text-sm text-gray-700 leading-relaxed flex-1">
                      {segment.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        }
        return transcript ? (
          <div className="space-y-4">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => alert('文字起こしの再生成機能は実装予定です')}
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                <span className="mr-2">🔄</span>
                再生成
              </button>
            </div>
            <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
              {transcript}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <span className="text-4xl mb-4 block">📝</span>
            <p className="text-gray-500">文字起こしがありません</p>
          </div>
        )

      case 'summary':
        if (summary) {
          return (
            <div className="space-y-4">
              <div className="flex justify-end mb-4">
                <button
                  onClick={generateSummary}
                  disabled={loadingSummary}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="mr-2">🔄</span>
                  {loadingSummary ? '生成中...' : '再生成'}
                </button>
              </div>
              <div className="prose max-w-none text-gray-700">
                <div dangerouslySetInnerHTML={{ __html: markdownToHtml(summary) }} />
              </div>
            </div>
          )
        }
        return (
          <div className="text-center py-8">
            <span className="text-4xl mb-4 block">📋</span>
            <p className="text-gray-500 mb-4">
              {loadingSummary ? '要約を生成中...' : '要約がまだ生成されていません'}
            </p>
            {transcript && !loadingSummary && (
              <button
                onClick={generateSummary}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <span className="mr-2 text-lg">✨</span>
                要約を生成
              </button>
            )}
            {loadingSummary && (
              <div className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                生成中...
              </div>
            )}
          </div>
        )

      case 'article':
        if (article) {
          return (
            <div className="space-y-4">
              <div className="flex justify-end mb-4">
                <button
                  onClick={generateArticle}
                  disabled={loadingArticle}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="mr-2">🔄</span>
                  {loadingArticle ? '生成中...' : '再生成'}
                </button>
              </div>
              <div className="prose max-w-none text-gray-700">
                <div dangerouslySetInnerHTML={{ __html: markdownToHtml(article) }} />
              </div>
            </div>
          )
        }
        return (
          <div className="text-center py-8">
            <span className="text-4xl mb-4 block">📄</span>
            <p className="text-gray-500 mb-4">
              {loadingArticle ? '解説記事を生成中...' : '解説記事がまだ生成されていません'}
            </p>
            {transcript && !loadingArticle && (
              <button
                onClick={generateArticle}
                className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <span className="mr-2 text-lg">📄</span>
                記事を生成
              </button>
            )}
            {loadingArticle && (
              <div className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                生成中...
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`relative px-6 py-4 text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'text-white bg-gray-800 border-b-2 border-gray-800'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 border-b-2 border-transparent'
              }`}
            >
              <div className="flex items-center">
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
                {tab.id === 'summary' && loadingSummary && (
                  <div className="ml-2 w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                )}
                {tab.id === 'article' && loadingArticle && (
                  <div className="ml-2 w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        <div className="max-h-[600px] overflow-y-auto">
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
}

export default TranscriptViewer