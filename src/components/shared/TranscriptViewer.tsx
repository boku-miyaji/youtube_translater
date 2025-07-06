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
  onQuestionClick?: (question: string) => void
}

type TabType = 'transcript' | 'summary' | 'article'

// Markdown to HTML converter with time reference linking and question detection
const markdownToHtml = (markdown: string, onSeek?: (time: number) => void, onQuestionClick?: (question: string) => void): string => {
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
  
  // Convert time references to clickable links (e.g., 1:23, 01:23, 1:23:45)
  if (onSeek) {
    // More comprehensive time pattern matching
    html = html.replace(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g, (match, minutes, seconds, hours) => {
      const totalSeconds = hours 
        ? parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)
        : parseInt(minutes) * 60 + parseInt(seconds)
      return `<span class="timestamp-style font-mono text-sm font-medium cursor-pointer px-2 py-1 rounded border transition-all shadow-sm time-reference" data-time="${totalSeconds}" title="クリックで動画の${match}にジャンプ">${match}</span>`
    })
  }
  
  // Convert questions to clickable links (for deep dive questions)
  if (onQuestionClick) {
    // Enhanced question detection patterns
    const questionPatterns = [
      // Japanese question patterns
      /((?:どのような|なぜ|どうやって|いつ|どこで|誰が|何を|どう|どんな)[^?。！]*\?)/g,
      // General question patterns ending with ?
      /([^。！]*\?)/g,
      // Questions that start with question words
      /((?:What|How|Why|When|Where|Who)[^?]*\?)/gi
    ]
    
    questionPatterns.forEach(pattern => {
      html = html.replace(pattern, (match, question) => {
        const trimmedQuestion = question.trim()
        // Check if it's a valid question and not already processed
        if (trimmedQuestion.length > 3 && 
            !trimmedQuestion.includes('<') && 
            !trimmedQuestion.includes('&') &&
            !trimmedQuestion.includes('question-reference')) {
          const safeQuestion = trimmedQuestion.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, ' ')
          return `<span class="question-style cursor-pointer inline-block px-3 py-1 rounded-md transition-all border shadow-sm question-reference" data-question="${safeQuestion}" title="クリックでチャットに質問を送る">${trimmedQuestion}</span>`
        }
        return match
      })
    })
  }
  
  // Preserve single line breaks
  html = html.replace(/\n/g, '<br />')
  
  // Paragraphs (double line breaks)
  html = html.replace(/<br \/><br \/>/g, '</p><p class="mb-4">')
  html = '<p class="mb-4">' + html + '</p>'
  
  // Clean up empty paragraphs
  html = html.replace(/<p class="mb-4">\s*<\/p>/g, '')
  
  // Fix line breaks in list items
  html = html.replace(/<li class="ml-4 mb-1">(.*?)<br \/><\/li>/g, '<li class="ml-4 mb-1">$1</li>')
  
  return html
}

// Format time from seconds to mm:ss
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript, timestampedSegments, summary: initialSummary, onSeek, onQuestionClick }) => {
  const [activeTab, setActiveTab] = useState<TabType>('transcript')
  const [summary, setSummary] = useState(initialSummary || '')
  const [article, setArticle] = useState('')
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingArticle, setLoadingArticle] = useState(false)

  // Set up click event handlers for time references and questions
  React.useEffect(() => {
    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement
      
      // Handle time reference clicks (transcript and summary)
      if (target.classList.contains('time-reference')) {
        e.preventDefault()
        e.stopPropagation()
        const time = parseInt(target.getAttribute('data-time') || '0')
        console.log('🎯 Time reference clicked:', time, 'from element:', target)
        if (onSeek) {
          console.log('🎯 Calling onSeek with time:', time)
          onSeek(time)
        } else {
          console.error('🚨 onSeek callback is not available!')
        }
        return
      }
      
      // Handle question reference clicks
      if (target.classList.contains('question-reference')) {
        e.preventDefault()
        e.stopPropagation()
        const question = target.getAttribute('data-question') || ''
        console.log('💬 Question reference clicked:', question)
        if (onQuestionClick && question) {
          console.log('💬 Calling onQuestionClick with:', question)
          onQuestionClick(question)
        } else {
          console.error('🚨 onQuestionClick callback is not available!')
        }
        return
      }
    }

    // Use capturing phase to ensure we catch events before other handlers
    document.addEventListener('click', handleClick, true)
    
    return () => {
      document.removeEventListener('click', handleClick, true)
    }
  }, [onSeek, onQuestionClick])

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
                    <span
                      onClick={() => onSeek && onSeek(segment.start)}
                      className="timestamp-style font-mono text-sm font-medium cursor-pointer transition-all px-2 py-1 rounded border shadow-sm inline-block"
                      title={`${formatTime(segment.start)}にジャンプして再生`}
                    >
                      {formatTime(segment.start)}
                    </span>
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
                <div dangerouslySetInnerHTML={{ __html: markdownToHtml(summary, onSeek, onQuestionClick) }} />
                {/* Deep dive questions section */}
                {(summary.includes('深掘り質問') || summary.includes('?')) && (
                  <div className="hint-style mt-6 p-4 rounded-lg border">
                    <p className="text-sm mb-2">
                      <strong>💡 ヒント:</strong> 上記の質問をクリックすると、チャットで自動的に質問できます
                    </p>
                  </div>
                )}
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
                <div dangerouslySetInnerHTML={{ __html: markdownToHtml(article, onSeek, onQuestionClick) }} />
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