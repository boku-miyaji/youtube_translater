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
  // Helper function to process timestamps in text content
  const processTimestamps = (text: string): (string | JSX.Element)[] => {
    if (!onSeek || !text) return [text]
    
    const parts: (string | JSX.Element)[] = []
    let lastIndex = 0
    let keyIndex = 0
    
    const timestampRegex = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g
    let match
    
    while ((match = timestampRegex.exec(text)) !== null) {
      const [fullMatch, minutes, seconds, hours] = match
      const matchStart = match.index
      
      // Add text before timestamp
      if (matchStart > lastIndex) {
        parts.push(text.substring(lastIndex, matchStart))
      }
      
      // Calculate total seconds
      const totalSeconds = hours 
        ? parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)
        : parseInt(minutes) * 60 + parseInt(seconds)
      
      // Add clickable timestamp
      parts.push(
        <span
          key={`timestamp-${keyIndex++}`}
          className="timestamp-link"
          onClick={() => onSeek(totalSeconds)}
          title={`クリックで動画の${fullMatch}にジャンプ`}
        >
          {fullMatch}
        </span>
      )
      
      lastIndex = matchStart + fullMatch.length
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }
    
    return parts.length > 1 ? parts : [text]
  }

  // Helper function to process questions in text content
  const processQuestions = (text: string, processedContent: React.ReactNode): React.ReactNode => {
    if (!onQuestionClick) return processedContent
    
    const hasQuestion = /[?？]/.test(text)
    if (!hasQuestion) return processedContent
    
    const questions = text.match(/[^.!?]*[?？][^.!?]*/g)
    if (!questions || questions.length === 0) return processedContent
    
    return (
      <>
        {processedContent}
        {questions.map((question, index) => {
          const trimmedQuestion = question.trim()
          if (trimmedQuestion.length > 3) {
            return (
              <span
                key={index}
                className="question-button"
                onClick={() => onQuestionClick(trimmedQuestion)}
                title="クリックでチャットに質問を送る"
              >
                💬 質問
              </span>
            )
          }
          return null
        })}
      </>
    )
  }

  // Minimal custom components - only for timestamp and question processing
  const components: Components = {
    // Process text nodes for timestamps
    text: ({ children }) => {
      const textValue = children?.toString() || ''
      if (!textValue) return <>{children}</>
      
      const timestampParts = processTimestamps(textValue)
      if (timestampParts.length > 1) {
        return <>{timestampParts}</>
      }
      
      return <>{children}</>
    },

    // Process paragraphs for questions
    p: ({ children }) => {
      const textContent = children?.toString() || ''
      
      // Process timestamps in paragraph content first
      const processedContent = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          const timestampParts = processTimestamps(child)
          return timestampParts.length > 1 ? timestampParts : child
        }
        return child
      })
      
      // Then process questions
      const withQuestions = processQuestions(textContent, processedContent)
      
      return <p>{withQuestions}</p>
    },

    // Process list items for timestamps and questions
    li: ({ children }) => {
      const textContent = children?.toString() || ''
      
      // Process timestamps in list item content
      const processedContent = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          const timestampParts = processTimestamps(child)
          return timestampParts.length > 1 ? timestampParts : child
        }
        return child
      })
      
      // Then process questions
      const withQuestions = processQuestions(textContent, processedContent)
      
      return <li>{withQuestions}</li>
    },

    // Handle inline code that might be timestamps
    code: ({ children, inline }) => {
      if (inline && onSeek) {
        const codeText = children?.toString() || ''
        const timeMatch = codeText.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
        
        if (timeMatch) {
          const [, minutes, seconds, hours] = timeMatch
          const totalSeconds = hours 
            ? parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)
            : parseInt(minutes) * 60 + parseInt(seconds)
          
          return (
            <span
              className="timestamp-link"
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

  return (
    <div className={`prose-tx ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer