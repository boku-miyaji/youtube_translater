import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface MarkdownRendererProps {
  content: string
  onSeek?: (time: number) => void
  onQuestionClick?: (question: string) => void
  className?: string
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  onSeek, 
  onQuestionClick, 
  className = '' 
}) => {
  // Preprocess content to apply smart block separation
  const preprocessContent = (md: string): string => {
    // Convert list items that look like headers to actual headers
    let processed = md.replace(/^\* \*\*([^:]+):\*\*(.*)$/gim, '#### $1\n$2\n')
    processed = processed.replace(/^\* ([^:]+):(.+)$/gim, '#### $1\n$2\n')
    
    // Add extra line breaks before headings for block separation
    processed = processed.replace(/^(#{1,6}\s)/gim, '\n$1')
    
    return processed
  }

  const components: Components = {
    // Handle paragraph elements with smart block separation
    p: ({ children }) => {
      const textContent = children?.toString() || ''
      
      // Check if this paragraph contains a question
      const hasQuestion = /[?？]/.test(textContent)
      if (hasQuestion && onQuestionClick) {
        const questions = textContent.match(/[^.!?]*[?？][^.!?]*/g)
        if (questions && questions.length > 0) {
          return (
            <p className="mb-1">
              {children}
              {questions.map((question, index) => {
                const trimmedQuestion = question.trim()
                if (trimmedQuestion.length > 3) {
                  return (
                    <span
                      key={index}
                      className="question-style cursor-pointer inline-block px-2 py-1 ml-2 rounded transition-all border shadow-sm"
                      onClick={() => onQuestionClick(trimmedQuestion)}
                      title="クリックでチャットに質問を送る"
                    >
                      💬 質問
                    </span>
                  )
                }
                return null
              })}
            </p>
          )
        }
      }
      
      return <p className="mb-1">{children}</p>
    },

    // Handle headings with smart block separation
    h1: ({ children }) => <h1 className="text-2xl font-bold mt-3 mb-0 first:mt-2">{children}</h1>,
    h2: ({ children }) => <h2 className="text-xl font-bold mt-3 mb-0 first:mt-1.5">{children}</h2>,
    h3: ({ children }) => <h3 className="text-lg font-semibold mt-3 mb-0 first:mt-1">{children}</h3>,
    h4: ({ children }) => <h4 className="text-base font-semibold mt-3 mb-0 first:mt-1">{children}</h4>,

    // Handle lists with no indentation and minimal spacing
    ul: ({ children }) => <ul className="list-none mb-0.5">{children}</ul>,
    ol: ({ children }) => <ol className="list-none mb-0.5">{children}</ol>,
    li: ({ children }) => <li className="ml-0 mb-0">• {children}</li>,

    // Handle strong/bold text
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,

    // Custom text processing for timestamps
    text: ({ value }) => {
      const timeMatch = value.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/)
      if (timeMatch && onSeek) {
        const [fullMatch, minutes, seconds, hours] = timeMatch
        const totalSeconds = hours 
          ? parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)
          : parseInt(minutes) * 60 + parseInt(seconds)
        
        // Replace timestamp in text with clickable component
        const beforeTimestamp = value.substring(0, timeMatch.index)
        const afterTimestamp = value.substring((timeMatch.index || 0) + fullMatch.length)
        
        return (
          <>
            {beforeTimestamp}
            <span
              className="timestamp-style font-mono text-sm font-medium cursor-pointer transition-all"
              onClick={() => onSeek(totalSeconds)}
              title={`クリックで動画の${fullMatch}にジャンプ`}
            >
              {fullMatch}
            </span>
            {afterTimestamp}
          </>
        )
      }
      
      return <>{value}</>
    },

    // Handle code elements (inline)
    code: ({ children, inline }) => {
      if (inline) {
        const codeText = children?.toString() || ''
        const timeMatch = codeText.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
        
        if (timeMatch && onSeek) {
          const [, minutes, seconds, hours] = timeMatch
          const totalSeconds = hours 
            ? parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)
            : parseInt(minutes) * 60 + parseInt(seconds)
          
          return (
            <span
              className="timestamp-style font-mono text-sm font-medium cursor-pointer transition-all"
              onClick={() => onSeek(totalSeconds)}
              title={`クリックで動画の${codeText}にジャンプ`}
            >
              {codeText}
            </span>
          )
        }
      }
      
      return <code className="font-mono text-sm bg-gray-100 px-1 rounded">{children}</code>
    }
  }

  const processedContent = preprocessContent(content)

  return (
    <div className={`prose prose-sm max-w-none text-gray-700 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer