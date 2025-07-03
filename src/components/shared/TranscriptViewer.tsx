import React, { useState } from 'react'

interface TranscriptViewerProps {
  transcript?: string
}

type TabType = 'transcript' | 'summary' | 'article'

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript }) => {
  const [activeTab, setActiveTab] = useState<TabType>('transcript')
  const [summary, setSummary] = useState('')
  const [article, setArticle] = useState('')
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingArticle, setLoadingArticle] = useState(false)

  const generateSummary = async () => {
    if (!transcript || summary) return
    
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
        throw new Error('Failed to generate summary')
      }

      const data = await response.json()
      setSummary(data.summary)
    } catch (error) {
      console.error('Error generating summary:', error)
      alert('Failed to generate summary. Please try again.')
    } finally {
      setLoadingSummary(false)
    }
  }

  const generateArticle = async () => {
    if (!transcript || article) return
    
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
        return transcript ? (
          <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
            {transcript}
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
            <div className="prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br>') }} />
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
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <span className="mr-2">✨</span>
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
            <div className="prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: article.replace(/\n/g, '<br>') }} />
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
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <span className="mr-2">📄</span>
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
              className={`relative px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
        <div className="max-h-96 overflow-y-auto">
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
}

export default TranscriptViewer