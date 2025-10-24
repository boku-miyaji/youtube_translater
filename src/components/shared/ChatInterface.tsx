import React, { useState, useRef, useEffect } from 'react'
import MarkdownRenderer from './MarkdownRenderer'

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
  gptModel?: string
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ videoId, prefillQuestion, videoTitle, transcript, summary, gptModel }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Ensure transcript and summary are strings for all usage and handle empty strings
  const safeTranscript = typeof transcript === 'string' ? transcript : (transcript ? String(transcript) : '')
  const safeSummary = typeof summary === 'string' ? summary : (summary ? String(summary) : '')
  
  // Additional validation for meaningful content (not just empty strings)
  const hasValidTranscript = safeTranscript && safeTranscript.trim().length > 0
  const hasValidSummary = safeSummary && safeSummary.trim().length > 0
  
  // Simplified content check for UI purposes
  const hasAnyContentForUI = (safeTranscript && safeTranscript.length > 0) || (safeSummary && safeSummary.length > 0)
  
  console.log('🔍 ChatInterface data validation:')
  console.log('  - raw transcript prop:', transcript ? {
    type: typeof transcript,
    length: typeof transcript === 'string' ? transcript.length : 'NOT_STRING',
    preview: typeof transcript === 'string' ? transcript.substring(0, 100) + '...' : JSON.stringify(transcript).substring(0, 100) + '...',
    isEmptyString: transcript === '',
    isTruthy: !!transcript
  } : 'MISSING')
  console.log('  - raw summary prop:', summary ? {
    type: typeof summary,
    length: typeof summary === 'string' ? summary.length : 'NOT_STRING',
    preview: typeof summary === 'string' ? summary.substring(0, 100) + '...' : JSON.stringify(summary).substring(0, 100) + '...',
    isEmptyString: summary === '',
    isTruthy: !!summary
  } : 'MISSING')
  console.log('  - safeTranscript:', safeTranscript ? {
    type: typeof safeTranscript,
    length: safeTranscript.length,
    preview: safeTranscript.substring(0, 100) + '...',
    trimLength: safeTranscript.trim().length
  } : 'MISSING')
  console.log('  - safeSummary:', safeSummary ? {
    type: typeof safeSummary,
    length: safeSummary.length,
    preview: safeSummary.substring(0, 100) + '...',
    trimLength: safeSummary.trim().length
  } : 'MISSING')
  console.log('  - hasValidTranscript:', hasValidTranscript, '(safeTranscript &&', !!safeTranscript, 'safeTranscript.trim().length > 0:', safeTranscript ? safeTranscript.trim().length > 0 : 'N/A', ')')
  console.log('  - hasValidSummary:', hasValidSummary, '(safeSummary &&', !!safeSummary, 'safeSummary.trim().length > 0:', safeSummary ? safeSummary.trim().length > 0 : 'N/A', ')')

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
    
    // Check if we have any transcript content before making API call
    // Allow if either transcript or summary has any content (even if not perfectly valid)
    const hasAnyContent = (safeTranscript && safeTranscript.length > 0) || (safeSummary && safeSummary.length > 0)
    
    console.log('🎯 === PRE-REQUEST CONTENT CHECK ===')
    console.log('  - hasValidTranscript:', hasValidTranscript)
    console.log('  - hasValidSummary:', hasValidSummary)
    console.log('  - hasAnyContent:', hasAnyContent)
    console.log('  - safeTranscript exists and has content:', !!(safeTranscript && safeTranscript.length > 0))
    console.log('  - safeSummary exists and has content:', !!(safeSummary && safeSummary.length > 0))
    
    if (!hasAnyContent) {
      console.log('❌ No content available - showing error')
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'まず動画をアップロードして文字起こしを生成してから質問してください。',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, {
        role: 'user',
        content: input.trim(),
        timestamp: new Date(),
      }, errorMessage])
      setInput('')
      return
    }
    
    console.log('✅ Content available - proceeding with request')

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      // Force sending transcript and summary if they are non-empty strings
      // This ensures server gets the data for historical videos
      const transcriptToSend = (safeTranscript && safeTranscript.length > 0) ? safeTranscript : undefined
      const summaryToSend = (safeSummary && safeSummary.length > 0) ? safeSummary : undefined
      
      const requestData = {
        message: input.trim(),
        videoId,
        history: messages,
        transcript: transcriptToSend,
        summary: summaryToSend,
        gptModel: gptModel || 'gpt-4o-mini',
      }
      
      console.log('🎯 === FORCE SEND LOGIC ===')
      console.log('  - safeTranscript value:', safeTranscript ? `"${safeTranscript.substring(0, 50)}..."` : 'MISSING/EMPTY')
      console.log('  - safeTranscript length:', safeTranscript ? safeTranscript.length : 0)
      console.log('  - safeSummary value:', safeSummary ? `"${safeSummary.substring(0, 50)}..."` : 'MISSING/EMPTY')
      console.log('  - safeSummary length:', safeSummary ? safeSummary.length : 0)
      console.log('  - transcriptToSend:', transcriptToSend ? `"${transcriptToSend.substring(0, 50)}..."` : 'UNDEFINED')
      console.log('  - summaryToSend:', summaryToSend ? `"${summaryToSend.substring(0, 50)}..."` : 'UNDEFINED')
      console.log('  - Will send transcript:', !!requestData.transcript, '(length:', requestData.transcript ? requestData.transcript.length : 0, ')')
      console.log('  - Will send summary:', !!requestData.summary, '(length:', requestData.summary ? requestData.summary.length : 0, ')')
      
      console.log('\n🚀 === CLIENT CHAT REQUEST DEBUG ===')
      console.log('📤 Original props received by ChatInterface:')
      console.log('  - transcript prop:', transcript ? {
        type: typeof transcript,
        length: typeof transcript === 'string' ? transcript.length : 'NOT_STRING',
        preview: typeof transcript === 'string' ? transcript.substring(0, 100) + '...' : JSON.stringify(transcript).substring(0, 100) + '...'
      } : 'MISSING')
      console.log('  - summary prop:', summary ? {
        type: typeof summary,
        length: typeof summary === 'string' ? summary.length : 'NOT_STRING',
        preview: typeof summary === 'string' ? summary.substring(0, 100) + '...' : JSON.stringify(summary).substring(0, 100) + '...'
      } : 'MISSING')
      
      console.log('📤 Safe converted values:')
      console.log('  - safeTranscript:', safeTranscript ? {
        type: typeof safeTranscript,
        length: safeTranscript.length,
        preview: safeTranscript.substring(0, 100) + '...'
      } : 'MISSING')
      console.log('  - safeSummary:', safeSummary ? {
        type: typeof safeSummary,
        length: safeSummary.length,
        preview: safeSummary.substring(0, 100) + '...'
      } : 'MISSING')
      
      console.log('📤 Validation status:')
      console.log('  - hasValidTranscript:', hasValidTranscript)
      console.log('  - hasValidSummary:', hasValidSummary)
      console.log('  - Condition check - hasValidTranscript ? safeTranscript : "":', hasValidTranscript ? 'USING_TRANSCRIPT' : 'USING_EMPTY_STRING')
      console.log('  - Condition check - hasValidSummary ? safeSummary : "":', hasValidSummary ? 'USING_SUMMARY' : 'USING_EMPTY_STRING')
      
      console.log('📤 Final request data to be sent:')
      console.log('  - message:', requestData.message)
      console.log('  - videoId:', requestData.videoId)
      console.log('  - historyLength:', requestData.history.length)
      console.log('  - gptModel:', requestData.gptModel)
      console.log('  - gptModel from props:', gptModel)
      console.log('  - transcript in request:', requestData.transcript ? {
        type: typeof requestData.transcript,
        length: requestData.transcript.length,
        preview: requestData.transcript.substring(0, 100) + '...',
        isEmptyString: requestData.transcript === '',
        trimmedLength: requestData.transcript.trim().length
      } : 'MISSING_OR_FALSY')
      console.log('  - summary in request:', requestData.summary ? {
        type: typeof requestData.summary,
        length: requestData.summary.length,
        preview: requestData.summary.substring(0, 100) + '...',
        isEmptyString: requestData.summary === '',
        trimmedLength: requestData.summary.trim().length
      } : 'MISSING_OR_FALSY')
      
      console.log('📤 Final JSON to be sent:', JSON.stringify(requestData, null, 2))
      console.log('🚀 === CLIENT SENDING REQUEST ===\n')
      
      console.log('🌐 === MAKING FETCH REQUEST ===')
      console.log('URL:', '/api/chat')
      console.log('Method: POST')
      console.log('Headers:', { 'Content-Type': 'application/json' })
      console.log('Body (stringified):', JSON.stringify(requestData))
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      console.log('🌐 === RECEIVED RESPONSE ===')
      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        let errorMessage = 'Failed to send message'
        try {
          const errorData = await response.json()
          console.error('🚨 === API ERROR RESPONSE DETAILS ===')
          console.error('Full error data:', errorData)
          console.error('Error data keys:', Object.keys(errorData))
          console.error('Error response field:', errorData.response)
          console.error('Error success field:', errorData.success)
          console.error('Error model field:', errorData.model)
          
          if (errorData.response) {
            errorMessage = errorData.response
            console.error('🚨 Using error message from server:', errorMessage)
          }
        } catch (parseError) {
          console.error('Error parsing API response:', parseError)
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('🚨 Error sending message:', error)
      
      // Enhanced error handling with specific messages
      let errorContent = 'Sorry, I encountered an error. Please try again.'
      
      if (error instanceof Error) {
        console.error('🚨 Chat error details:', error.message)
        console.error('🚨 Full error object:', error)
        
        // Check for specific error types and use the actual error message when possible
        if (error.message.includes('Failed to send message')) {
          errorContent = 'チャット機能でエラーが発生しました。動画をアップロードしてから質問してください。'
        } else if (error.message.includes('Network')) {
          errorContent = 'ネットワークエラーが発生しました。接続を確認してください。'
        } else if (error.message.includes('動画の文字起こしが見つかりません')) {
          errorContent = error.message // Use the actual server error message
        } else if (error.message.includes('Failed to process chat message')) {
          errorContent = 'チャット処理中にエラーが発生しました。しばらくしてから再度お試しください。'
        } else if (error.message.length > 10 && error.message.length < 200) {
          // If the error message seems reasonable, use it
          errorContent = error.message
        }
        
        // Log the final error content for debugging
        console.error('🚨 Final error content to display:', errorContent)
      }
      
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: errorContent,
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
    const primaryContent = hasValidSummary ? safeSummary : ''
    const secondaryContent = hasValidTranscript ? safeTranscript : ''
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

  // Advanced content analysis function - ensures questions are answerable from content
  const analyzeContentForQuestions = (summary: string, transcript: string, title: string) => {
    const specificQuestions: string[] = []
    const contextualQuestions: string[] = []
    const deepDiveQuestions: string[] = []
    
    // Use primary content (summary preferred, then transcript)
    const primaryContent = summary || transcript
    const secondaryContent = summary ? transcript : ''
    
    if (!primaryContent) {
      return { specificQuestions, contextualQuestions, deepDiveQuestions }
    }
    
    // Extract key entities and concepts from content
    const contentAnalysis = extractKeyEntities(primaryContent)
    
    // Generate specific questions only for concepts that are explained in the content
    contentAnalysis.concepts.forEach(concept => {
      if (concept.length > 2 && concept.length < 20) {
        // Only ask if the concept appears to be explained (has context around it)
        const conceptContext = findConceptContext(primaryContent, concept)
        if (conceptContext.isExplained) {
          specificQuestions.push(`${concept}について、動画で説明されていた内容をもう少し詳しく教えて`)
        }
      }
    })
    
    // Generate questions for numbers that have context in the content
    contentAnalysis.numbers.forEach(number => {
      const numberContext = findNumberContext(primaryContent, number)
      if (numberContext.hasExplanation) {
        specificQuestions.push(`動画で言及されていた「${number}」について詳しく説明して`)
      }
    })
    
    // Generate questions for methods that are actually described
    contentAnalysis.methods.forEach(method => {
      const methodContext = findMethodContext(primaryContent, method)
      if (methodContext.isDescribed) {
        specificQuestions.push(`動画で紹介されていた「${method}」について詳しく教えて`)
      }
    })
    
    // Generate contextual questions only for themes present in content
    if (contentAnalysis.hasResults && hasResultsDetails(primaryContent)) {
      contextualQuestions.push('動画で紹介されていた結果について、より詳しく説明して')
    }
    
    if (contentAnalysis.hasComparison && hasComparisonDetails(primaryContent)) {
      contextualQuestions.push('動画で比較されていた内容について、違いをもっと詳しく教えて')
    }
    
    if (contentAnalysis.hasProcess && hasProcessDetails(primaryContent)) {
      contextualQuestions.push('動画で説明されていたプロセスの重要なポイントを教えて')
    }
    
    // Extract quotes and specific mentions that have enough context
    const quotes = extractMeaningfulQuotes(primaryContent)
    quotes.forEach(quote => {
      if (quote.length > 5 && quote.length < 30) {
        deepDiveQuestions.push(`動画で「${quote}」と言っていたのはどういう意味ですか？`)
      }
    })
    
    // Generate questions about specific examples mentioned in the content
    const examples = extractExamples(primaryContent)
    examples.forEach(example => {
      deepDiveQuestions.push(`動画で例として挙げられていた「${example}」について詳しく教えて`)
    })
    
    // Only include title-based questions if the title content is actually discussed
    if (title && isTitleContentDiscussed(primaryContent, title)) {
      contextualQuestions.push(`動画のタイトル「${title}」に関する内容で、特に重要だと思うポイントは？`)
    }
    
    return { specificQuestions, contextualQuestions, deepDiveQuestions }
  }

  // Helper functions to validate content availability
  const findConceptContext = (content: string, concept: string) => {
    const conceptRegex = new RegExp(`${concept}(?:とは|について|に関して|を|が|は).{10,}`, 'g')
    const matches = content.match(conceptRegex)
    return { isExplained: matches && matches.length > 0 }
  }

  const findNumberContext = (content: string, number: string) => {
    const numberRegex = new RegExp(`${number}.{5,50}(?:理由|根拠|なぜ|について|意味|効果|結果)`, 'g')
    const matches = content.match(numberRegex)
    return { hasExplanation: matches && matches.length > 0 }
  }

  const findMethodContext = (content: string, method: string) => {
    const methodRegex = new RegExp(`${method}.{10,100}(?:手順|方法|やり方|ステップ|プロセス)`, 'g')
    const matches = content.match(methodRegex)
    return { isDescribed: matches && matches.length > 0 }
  }

  const hasResultsDetails = (content: string) => {
    return /結果.{20,}|成果.{20,}|効果.{20,}/.test(content)
  }

  const hasComparisonDetails = (content: string) => {
    return /比較.{30,}|違い.{20,}|対比.{20,}/.test(content)
  }

  const hasProcessDetails = (content: string) => {
    return /手順.{30,}|ステップ.{30,}|プロセス.{30,}/.test(content)
  }

  const extractMeaningfulQuotes = (content: string) => {
    const quotes = content.match(/「([^」]{5,30})」/g) || []
    return quotes.map(quote => quote.replace(/[「」]/g, ''))
      .filter(quote => {
        // Filter out common generic phrases
        const genericPhrases = ['そうですね', 'はい', 'ありがとう', 'よろしく', 'おつかれ']
        return !genericPhrases.some(phrase => quote.includes(phrase))
      })
  }

  const extractExamples = (content: string) => {
    const examplePatterns = [
      /例えば([^。]{5,30})/g,
      /具体的には([^。]{5,30})/g,
      /実際に([^。]{5,30})/g
    ]
    
    const examples: string[] = []
    examplePatterns.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const example = match.replace(/(例えば|具体的には|実際に)/, '').trim()
          if (example.length > 3) {
            examples.push(example)
          }
        })
      }
    })
    
    return [...new Set(examples)]
  }

  const isTitleContentDiscussed = (content: string, title: string) => {
    // Check if title keywords appear with substantial discussion
    const titleWords = title.split(/[\s\-_]+/).filter(word => word.length > 2)
    return titleWords.some(word => {
      const wordRegex = new RegExp(`${word}.{50,}`, 'g')
      return wordRegex.test(content)
    })
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
    <div className="bg-white rounded-lg shadow p-6 h-[600px] flex flex-col">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Chat</h2>
      
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-gray-500 text-center">
              {!hasAnyContentForUI ? "Upload a video first to start chatting..." : "Start a conversation about the video..."}
            </p>
            
            {/* Sample Deep Dive Questions - only show when we have transcript/summary */}
            {hasAnyContentForUI && (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <h3 className="text-xs font-medium text-gray-600 mb-2">💡 質問サンプル</h3>
                <div className="flex flex-wrap gap-1">
                  {sampleQuestions.slice(0, 3).map((question, index) => (
                    <span
                      key={index}
                      onClick={() => handleSampleQuestionClick(question)}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 text-xs rounded cursor-pointer transition-colors"
                      title="クリックでチャットに質問を入力"
                    >
                      {question}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">質問をクリックして簡単に深掘り！</p>
              </div>
            )}
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-4xl px-4 py-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.role === 'assistant' ? (
                  <MarkdownRenderer content={message.content} className="text-base" />
                ) : (
                  <p className="text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
                )}
                <p className={`text-xs mt-2 ${
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
            <div className="bg-gray-100 text-gray-900 max-w-4xl px-4 py-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="loading" />
                <span className="text-base">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      

      <form onSubmit={sendMessage} className="flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={!hasAnyContentForUI ? "Upload a video first to start chatting..." : "Ask about the video..."}
          className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-gray-500 focus:border-gray-500 text-base px-4 py-2"
          disabled={loading || !hasAnyContentForUI}
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || !hasAnyContentForUI}
          className="px-6 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 text-base"
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default ChatInterface