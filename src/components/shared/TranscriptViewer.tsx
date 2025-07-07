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
  
  // Headers with optimized spacing
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-1">$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-5 mb-2">$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-2">$1</h1>')
  
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
      return `<span class="timestamp-style font-mono text-sm font-medium cursor-pointer transition-all time-reference" data-time="${totalSeconds}" title="クリックで動画の${match}にジャンプ">${match}</span>`
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
  
  // Clean up heading-related line breaks first
  html = html.replace(/(<h[1-6][^>]*>[^<]*<\/h[1-6]>)\s*<br \/>/g, '$1')
  
  // Preserve single line breaks but avoid excessive spacing
  html = html.replace(/\n\n+/g, '\n\n') // Normalize multiple line breaks
  html = html.replace(/\n/g, '<br />')
  
  // Paragraphs (double line breaks)
  html = html.replace(/<br \/><br \/>/g, '</p><p class="mb-3">')
  html = '<p class="mb-3">' + html + '</p>'
  
  // Clean up empty paragraphs and heading-adjacent breaks
  html = html.replace(/<p class="mb-3">\s*<\/p>/g, '')
  html = html.replace(/(<\/h[1-6]>)<p class="mb-3">\s*<\/p>/g, '$1')
  html = html.replace(/(<h[1-6][^>]*>[^<]*<\/h[1-6]>)<p class="mb-3">/g, '$1<p class="mb-3 mt-2">')
  
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
    if (!transcript) {
      alert('文字起こしが利用できません。まず動画をアップロードしてください。')
      return
    }
    
    setLoadingArticle(true)
    try {
      console.log('Generating article with transcript length:', transcript.length)
      
      const response = await fetch('/api/generate-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          transcript,
          gptModel: 'gpt-4o-mini'
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Article generation failed:', response.status, response.statusText, errorText)
        
        let errorMessage = '記事の生成に失敗しました。'
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorMessage
        } catch {
          // テキストレスポンスの場合はそのまま使用
          errorMessage = errorText || errorMessage
        }
        
        throw new Error(`${errorMessage} (Status: ${response.status})`)
      }

      const data = await response.json()
      console.log('Article generation response:', { 
        hasArticle: !!data.article, 
        articleLength: data.article?.length || 0,
        success: data.success
      })
      
      if (!data.article) {
        throw new Error('サーバーから記事コンテンツが返されませんでした。')
      }
      
      setArticle(data.article)
    } catch (error) {
      console.error('Error generating article:', error)
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました。'
      alert(`記事の生成に失敗しました: ${errorMessage}`)
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
                  className="btn-regenerate inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                >
                  <span className="mr-2">🔄</span>
                  再生成
                </button>
              </div>
              <div className="space-y-0">
                {timestampedSegments.map((segment, index) => (
                  <div
                    key={index}
                    className="flex gap-4 py-0.5 px-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <span
                      onClick={() => onSeek && onSeek(segment.start)}
                      className="timestamp-style font-mono text-sm font-medium cursor-pointer transition-all inline-block"
                      title={`${formatTime(segment.start)}にジャンプして再生`}
                    >
                      {formatTime(segment.start)}
                    </span>
                    <p className="text-sm text-gray-700 leading-normal flex-1">
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
                className="btn-regenerate inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              >
                <span className="mr-2">🔄</span>
                再生成
              </button>
            </div>
            <div className="whitespace-pre-wrap text-sm text-gray-700 leading-normal">
              {transcript}
            </div>
          </div>
        ) : (
          <div className="empty-state text-center py-12 rounded-lg">
            <span className="text-5xl mb-6 block opacity-60">📝</span>
            <h3 className="text-lg font-medium mb-2">文字起こしがありません</h3>
            <p className="text-sm opacity-75">動画をアップロードして文字起こしを開始しましょう</p>
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
                  className="btn-regenerate inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="empty-state text-center py-12 rounded-lg">
            <span className="text-5xl mb-6 block opacity-60">📋</span>
            <h3 className="text-lg font-medium mb-2">
              {loadingSummary ? '要約を生成中...' : '要約がまだ生成されていません'}
            </h3>
            {!loadingSummary && (
              <p className="text-sm opacity-75 mb-6">文字起こしから自動で要約を作成します</p>
            )}
            {transcript && !loadingSummary && (
              <button
                onClick={generateSummary}
                className="btn-generate inline-flex items-center px-6 py-3 font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <span className="mr-2 text-lg">✨</span>
                要約を生成
              </button>
            )}
            {loadingSummary && (
              <div className="inline-flex items-center px-4 py-2 bg-app-primary text-white rounded-lg">
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
                  className="btn-regenerate inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="empty-state text-center py-12 rounded-lg">
            <span className="text-5xl mb-6 block opacity-60">📄</span>
            <h3 className="text-lg font-medium mb-2">
              {loadingArticle ? '解説記事を生成中...' : '解説記事がまだ生成されていません'}
            </h3>
            {!loadingArticle && (
              <p className="text-sm opacity-75 mb-6">内容を分かりやすく解説した記事を作成します</p>
            )}
            {transcript && !loadingArticle && (
              <button
                onClick={generateArticle}
                className="btn-generate inline-flex items-center px-6 py-3 font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <span className="mr-2 text-lg">📄</span>
                記事を生成
              </button>
            )}
            {loadingArticle && (
              <div className="inline-flex items-center px-4 py-2 bg-app-primary text-white rounded-lg">
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
              className={`relative px-6 py-4 text-sm font-semibold transition-all duration-200 border-b-2 ${
                activeTab === tab.id
                  ? 'tab-active'
                  : 'tab-inactive border-transparent'
              }`}
            >
              <div className="flex items-center">
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
                {tab.id === 'summary' && loadingSummary && (
                  <div className="ml-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                {tab.id === 'article' && loadingArticle && (
                  <div className="ml-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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