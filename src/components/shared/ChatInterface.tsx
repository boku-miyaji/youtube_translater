import React, { useState, useRef, useEffect } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatInterfaceProps {
  videoId?: string
  prefillQuestion?: string
  videoTitle?: string
  transcript?: string
  summary?: string
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ videoId, prefillQuestion, videoTitle, transcript, summary }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Handle prefilled questions
  useEffect(() => {
    if (prefillQuestion && prefillQuestion.trim()) {
      setInput(prefillQuestion.trim())
    }
  }, [prefillQuestion])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input.trim(),
          videoId,
          history: messages,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  // Generate smart deep dive questions based on video content
  const generateSmartQuestions = () => {
    const contentText = summary || transcript || ''
    const title = videoTitle || ''
    
    // Extract key topics and generate contextual questions
    const smartQuestions: string[] = []
    
    // Analyze content for specific topics and generate targeted questions
    const contentLower = contentText.toLowerCase()
    
    // Extract key phrases and topics from content
    const keyTopics = []
    const sentences = contentText.split(/[。！？\.\!\?]/).filter(s => s.trim().length > 15)
    
    // Extract meaningful topics from sentences
    for (const sentence of sentences.slice(0, 5)) {
      const cleanSentence = sentence.trim()
      if (cleanSentence.length > 20) {
        // Extract potential topics (nouns, key phrases)
        const topics = cleanSentence.match(/[一-龯ぁ-ゔァ-ヴーa-zA-Z0-9]{3,}/g)
        if (topics) {
          keyTopics.push(...topics.slice(0, 2))
        }
      }
    }
    
    // Generate questions based on discovered topics
    if (keyTopics.length > 0) {
      smartQuestions.push(`${keyTopics[0]}について具体的な事例を教えて`)
      if (keyTopics.length > 1) {
        smartQuestions.push(`${keyTopics[1]}の実践方法は？`)
      }
    }
    
    // Content-specific question generation
    if (contentLower.includes('技術') || contentLower.includes('tech') || contentLower.includes('ai') || contentLower.includes('プログラミング')) {
      smartQuestions.push('この技術の将来性と課題は？')
    }
    
    if (contentLower.includes('学習') || contentLower.includes('勉強') || contentLower.includes('教育')) {
      smartQuestions.push('初心者が最初に取り組むべきことは？')
    }
    
    if (contentLower.includes('ビジネス') || contentLower.includes('business') || contentLower.includes('起業') || contentLower.includes('経営')) {
      smartQuestions.push('成功のための重要なポイントは？')
    }
    
    if (contentLower.includes('問題') || contentLower.includes('課題') || contentLower.includes('解決')) {
      smartQuestions.push('同様の問題に直面した時の対処法は？')
    }
    
    if (contentLower.includes('方法') || contentLower.includes('やり方') || contentLower.includes('手順')) {
      smartQuestions.push('他にどんなアプローチがありますか？')
    }
    
    // Add title-based question if available
    if (title) {
      smartQuestions.push(`「${title}」で最も重要なポイントは？`)
    }
    
    // Add smart fallbacks based on content analysis
    if (smartQuestions.length < 5) {
      const smartFallbacks = [
        'この内容の実用的な応用例は？',
        '初心者が注意すべきポイントは？',
        '関連する最新トレンドは？',
        'さらに詳しく学ぶためのリソースは？',
        '実際に試す時のコツは？'
      ]
      
      for (const fallback of smartFallbacks) {
        if (!smartQuestions.includes(fallback) && smartQuestions.length < 5) {
          smartQuestions.push(fallback)
        }
      }
    }
    
    return smartQuestions.slice(0, 5)
  }

  const sampleQuestions = generateSmartQuestions()

  const handleSampleQuestionClick = (question: string) => {
    setInput(question)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 h-96 flex flex-col">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Chat</h2>
      
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-gray-500 text-center">Start a conversation about the video...</p>
            
            {/* Sample Deep Dive Questions */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">💡 深掘り質問サンプル</h3>
              <div className="flex flex-wrap gap-2">
                {sampleQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSampleQuestionClick(question)}
                    className="px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-all cursor-pointer shadow-sm"
                    title="クリックでチャットに質問を入力"
                  >
                    {question}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">質問をクリックして簡単に深掘り！</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-white opacity-75' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="loading" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Sample Questions (always visible) */}
      {messages.length > 0 && (
        <div className="mb-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="flex flex-wrap gap-1">
            {sampleQuestions.slice(0, 3).map((question, index) => (
              <button
                key={index}
                onClick={() => handleSampleQuestionClick(question)}
                className="px-2 py-1 bg-white border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-100 transition-all"
                title="クリックでチャットに質問を入力"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={sendMessage} className="flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the video..."
          className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-gray-500 focus:border-gray-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default ChatInterface