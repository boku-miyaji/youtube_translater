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
    // Prioritize summary over transcript for better question generation
    const primaryContent = summary || ''
    const secondaryContent = transcript || ''
    const title = videoTitle || ''
    
    const smartQuestions: string[] = []
    
    // Advanced content analysis
    const analyzedContent = analyzeContentForQuestions(primaryContent, secondaryContent, title)
    
    // Generate questions based on extracted insights
    smartQuestions.push(...analyzedContent.specificQuestions)
    smartQuestions.push(...analyzedContent.contextualQuestions)
    smartQuestions.push(...analyzedContent.deepDiveQuestions)
    
    // Remove duplicates and limit to 5 questions
    const uniqueQuestions = [...new Set(smartQuestions)]
    return uniqueQuestions.slice(0, 5)
  }

  // Advanced content analysis function
  const analyzeContentForQuestions = (summary: string, transcript: string, title: string) => {
    const specificQuestions: string[] = []
    const contextualQuestions: string[] = []
    const deepDiveQuestions: string[] = []
    
    // Extract key entities and concepts from summary (most important)
    if (summary) {
      const summaryAnalysis = extractKeyEntities(summary)
      
      // Generate specific questions based on summary content
      summaryAnalysis.concepts.forEach(concept => {
        if (concept.length > 2 && concept.length < 20) {
          specificQuestions.push(`${concept}について詳しく説明してもらえますか？`)
        }
      })
      
      summaryAnalysis.numbers.forEach(number => {
        specificQuestions.push(`${number}という数字の根拠や意味は？`)
      })
      
      summaryAnalysis.methods.forEach(method => {
        specificQuestions.push(`${method}の具体的な手順を教えて`)
      })
      
      // Generate contextual questions based on summary themes
      if (summaryAnalysis.hasResults) {
        contextualQuestions.push('この結果を実際に活用するにはどうすれば？')
      }
      
      if (summaryAnalysis.hasComparison) {
        contextualQuestions.push('比較されている選択肢の違いをもっと詳しく')
      }
      
      if (summaryAnalysis.hasProcess) {
        contextualQuestions.push('このプロセスで最も重要なステップは？')
      }
    }
    
    // Extract additional insights from transcript
    if (transcript && transcript !== summary) {
      const transcriptAnalysis = extractKeyEntities(transcript)
      
      // Find mentions not in summary for deeper exploration
      transcriptAnalysis.specificMentions.forEach(mention => {
        if (!summary.includes(mention) && mention.length > 3) {
          deepDiveQuestions.push(`動画で触れられていた「${mention}」について詳しく`)
        }
      })
    }
    
    // Generate title-based questions
    if (title && !specificQuestions.some(q => q.includes(title))) {
      contextualQuestions.push(`「${title}」に関連する他の事例はありますか？`)
    }
    
    return { specificQuestions, contextualQuestions, deepDiveQuestions }
  }

  // Extract key entities and patterns from content
  const extractKeyEntities = (content: string) => {
    const concepts: string[] = []
    const numbers: string[] = []
    const methods: string[] = []
    const specificMentions: string[] = []
    
    // Extract numbers and percentages
    const numberMatches = content.match(/\d+([.,]\d+)?[%％個分円年月日時間秒分]/g)
    if (numberMatches) {
      numbers.push(...numberMatches.slice(0, 3))
    }
    
    // Extract method-related phrases
    const methodPatterns = [
      /([ァ-ヴー一-龯a-zA-Z0-9]{3,})(方法|手法|やり方|アプローチ|技術|テクニック)/g,
      /(方法|手法|やり方|アプローチ|技術|テクニック)([ァ-ヴー一-龯a-zA-Z0-9]{3,})/g
    ]
    
    methodPatterns.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        methods.push(...matches.slice(0, 2))
      }
    })
    
    // Extract key concepts (nouns, technical terms)
    const conceptPatterns = [
      /([ァ-ヴー一-龯]{3,8})(について|に関して|とは|である|です)/g,
      /重要な([ァ-ヴー一-龯]{3,8})/g,
      /([ァ-ヴー一-龯]{3,8})(を|が)(説明|解説|紹介|実装|導入)/g
    ]
    
    conceptPatterns.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const concept = match.replace(/(について|に関して|とは|である|です|を|が|説明|解説|紹介|実装|導入|重要な)/g, '')
          if (concept.length > 2 && concept.length < 15) {
            concepts.push(concept)
          }
        })
      }
    })
    
    // Extract specific mentions and quotes
    const quotedContent = content.match(/「([^」]+)」/g)
    if (quotedContent) {
      quotedContent.forEach(quote => {
        const cleaned = quote.replace(/[「」]/g, '')
        if (cleaned.length > 3 && cleaned.length < 30) {
          specificMentions.push(cleaned)
        }
      })
    }
    
    // Analyze content patterns
    const hasResults = /結果|成果|効果|データ|統計/.test(content)
    const hasComparison = /比較|違い|対比|vs|と比べて|に対して/.test(content)
    const hasProcess = /手順|ステップ|プロセス|流れ|段階/.test(content)
    
    return {
      concepts: [...new Set(concepts)],
      numbers: [...new Set(numbers)],
      methods: [...new Set(methods)],
      specificMentions: [...new Set(specificMentions)],
      hasResults,
      hasComparison,
      hasProcess
    }
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
            <div className="bg-app-background rounded-lg p-4 border border-app-light">
              <h3 className="text-sm font-semibold text-app-primary mb-3">💡 深掘り質問サンプル</h3>
              <div className="flex flex-wrap gap-2">
                {sampleQuestions.map((question, index) => (
                  <span
                    key={index}
                    onClick={() => handleSampleQuestionClick(question)}
                    className="question-style px-3 py-2 text-xs rounded-lg transition-all cursor-pointer shadow-sm inline-block border"
                    title="クリックでチャットに質問を入力"
                  >
                    {question}
                  </span>
                ))}
              </div>
              <p className="text-xs text-app-secondary mt-2">質問をクリックして簡単に深掘り！</p>
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
        <div className="mb-3 bg-app-background rounded-lg p-3 border border-app-light">
          <div className="flex flex-wrap gap-1">
            {sampleQuestions.slice(0, 3).map((question, index) => (
              <span
                key={index}
                onClick={() => handleSampleQuestionClick(question)}
                className="question-style px-2 py-1 text-xs rounded transition-all cursor-pointer inline-block border"
                title="クリックでチャットに質問を入力"
              >
                {question}
              </span>
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