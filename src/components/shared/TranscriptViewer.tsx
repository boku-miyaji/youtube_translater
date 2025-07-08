import React, { useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'

interface TranscriptViewerProps {
  transcript?: string
  timestampedSegments?: Array<{
    start: number
    duration: number
    text: string
  }>
  summary?: string
  transcriptSource?: 'subtitle' | 'whisper'
  onSeek?: (time: number) => void
  onQuestionClick?: (question: string) => void
}

type TabType = 'transcript' | 'summary' | 'article'

// Format time from seconds to mm:ss
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript, timestampedSegments, summary: initialSummary, transcriptSource, onSeek, onQuestionClick }) => {
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
              <div className="flex justify-between items-center mb-4">
                {/* Transcript source indicator */}
                {transcriptSource && (
                  <div className="flex items-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      transcriptSource === 'subtitle' 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {transcriptSource === 'subtitle' ? (
                        <>
                          <span className="mr-1">📺</span>
                          YouTube キャプション
                        </>
                      ) : (
                        <>
                          <span className="mr-1">🤖</span>
                          Whisper AI 生成
                        </>
                      )}
                    </span>
                  </div>
                )}
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
            <div className="flex justify-between items-center mb-4">
              {/* Transcript source indicator */}
              {transcriptSource && (
                <div className="flex items-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    transcriptSource === 'subtitle' 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}>
                    {transcriptSource === 'subtitle' ? (
                      <>
                        <span className="mr-1">📺</span>
                        YouTube キャプション
                      </>
                    ) : (
                      <>
                        <span className="mr-1">🤖</span>
                        Whisper AI 生成
                      </>
                    )}
                  </span>
                </div>
              )}
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
          <div className="empty-state text-center py-6 rounded-lg">
            <span className="text-5xl mb-2 block opacity-60">📝</span>
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
              <MarkdownRenderer 
                content={summary} 
                onSeek={onSeek} 
                onQuestionClick={onQuestionClick}
                className=""
              />
              {/* Deep dive questions section */}
              {(summary.includes('深掘り質問') || summary.includes('?')) && (
                <div className="hint-style mt-2 p-2 rounded-lg border">
                  <p className="text-sm mb-0">
                    <strong>💡 ヒント:</strong> 上記の質問をクリックすると、チャットで自動的に質問できます
                  </p>
                </div>
              )}
            </div>
          )
        }
        return (
          <div className="empty-state text-center py-6 rounded-lg">
            <span className="text-5xl mb-2 block opacity-60">📋</span>
            <h3 className="text-lg font-medium mb-2">
              {loadingSummary ? '要約を生成中...' : '要約がまだ生成されていません'}
            </h3>
            {!loadingSummary && (
              <p className="text-sm opacity-75 mb-1">文字起こしから自動で要約を作成します</p>
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
              <MarkdownRenderer 
                content={article} 
                onSeek={onSeek} 
                onQuestionClick={onQuestionClick}
                className=""
              />
            </div>
          )
        }
        return (
          <div className="empty-state text-center py-6 rounded-lg">
            <span className="text-5xl mb-2 block opacity-60">📄</span>
            <h3 className="text-lg font-medium mb-2">
              {loadingArticle ? '解説記事を生成中...' : '解説記事がまだ生成されていません'}
            </h3>
            {!loadingArticle && (
              <p className="text-sm opacity-75 mb-1">内容を分かりやすく解説した記事を作成します</p>
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