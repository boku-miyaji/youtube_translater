import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface MarkdownRendererProps {
  content: string
  onSeek?: (time: number) => void
  onPageJump?: (page: number) => void
  onQuestionClick?: (question: string) => void
  className?: string
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  onSeek, 
  onPageJump,
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

  // Helper function to process PDF page references in text content
  const processPageReferences = (text: string): (string | JSX.Element)[] => {
    if (!onPageJump || !text) return [text]
    
    const parts: (string | JSX.Element)[] = []
    let lastIndex = 0
    let keyIndex = 0
    
    // Match patterns like "p.15", "p.20-23", "p.12 と p.45"
    const pageRegex = /\bp\.(\d+)(?:-(\d+))?/g
    let match
    
    console.log('📄 MarkdownRenderer: Processing page references in text:', text.substring(0, 100) + '...');
    
    while ((match = pageRegex.exec(text)) !== null) {
      const [fullMatch, startPage, endPage] = match
      const matchStart = match.index
      
      console.log('📄 MarkdownRenderer: Found page reference:', fullMatch, 'at position', matchStart);
      
      // Add text before page reference
      if (matchStart > lastIndex) {
        parts.push(text.substring(lastIndex, matchStart))
      }
      
      const pageNumber = parseInt(startPage)
      console.log('📄 MarkdownRenderer: Creating clickable link for page:', pageNumber);
      
      // Add clickable page reference
      parts.push(
        <span
          key={`page-${keyIndex++}`}
          className="page-link"
          onClick={() => {
            console.log('📄 MarkdownRenderer: Page link clicked for page:', pageNumber);
            onPageJump(pageNumber);
          }}
          title={`クリックでPDFの${pageNumber}ページにジャンプ`}
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

  // Helper function to process both timestamps and page references
  const processContent = (text: string): (string | JSX.Element)[] => {
    if (!text) return [text]
    
    // First process timestamps
    let parts = processTimestamps(text)
    
    // Then process page references in each text part
    const finalParts: (string | JSX.Element)[] = []
    for (const part of parts) {
      if (typeof part === 'string') {
        const pageProcessed = processPageReferences(part)
        finalParts.push(...pageProcessed)
      } else {
        finalParts.push(part)
      }
    }
    
    return finalParts
  }

  // Minimal custom components - for timestamp, page reference, and question processing
  const components: Components = {
    // Process text nodes for timestamps and page references
    text: ({ children }) => {
      const textValue = children?.toString() || ''
      if (!textValue) return <>{children}</>
      
      const processedParts = processContent(textValue)
      if (processedParts.length > 1) {
        return <>{processedParts}</>
      }
      
      return <>{children}</>
    },

    // Process paragraphs for timestamps, page references, and questions
    p: ({ children }) => {
      const textContent = children?.toString() || ''
      
      // Process timestamps and page references in paragraph content first
      const processedContent = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          const processedParts = processContent(child)
          return processedParts.length > 1 ? processedParts : child
        }
        return child
      })
      
      // Then process questions
      const withQuestions = processQuestions(textContent, processedContent)
      
      return <p>{withQuestions}</p>
    },

    // Process list items for timestamps, page references, and questions
    li: ({ children }) => {
      const textContent = children?.toString() || ''
      
      // Process timestamps and page references in list item content
      const processedContent = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          const processedParts = processContent(child)
          return processedParts.length > 1 ? processedParts : child
        }
        return child
      })
      
      // Then process questions
      const withQuestions = processQuestions(textContent, processedContent)
      
      return <li>{withQuestions}</li>
    },

    // Handle inline code that might be timestamps or page references
    code: ({ children, inline }) => {
      if (inline) {
        const codeText = children?.toString() || ''
        
        // Check for timestamp pattern
        if (onSeek) {
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
        
        // Check for page reference pattern
        if (onPageJump) {
          const pageMatch = codeText.match(/^p\.(\d+)(?:-(\d+))?$/)
          
          if (pageMatch) {
            const [, startPage] = pageMatch
            const pageNumber = parseInt(startPage)
            
            return (
              <span
                className="page-link"
                onClick={() => onPageJump(pageNumber)}
                title={`クリックでPDFの${pageNumber}ページにジャンプ`}
              >
                {codeText}
              </span>
            )
          }
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