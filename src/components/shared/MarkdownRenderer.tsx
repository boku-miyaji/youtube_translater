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
  // Helper function to process timestamps in any text content
  const processTimestamps = (text: string): (string | JSX.Element)[] => {
    if (!onSeek || !text) return [text]
    
    const parts: (string | JSX.Element)[] = []
    let lastIndex = 0
    let keyIndex = 0
    
    // More comprehensive timestamp pattern
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
          className="timestamp-style font-mono text-sm font-medium cursor-pointer transition-all"
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
  // Preprocess content to apply smart block separation and clean up lists
  const preprocessContent = (md: string): string => {
    // Convert list items that look like headers to actual headers
    let processed = md.replace(/^\* \*\*([^:]+):\*\*(.*)$/gim, '#### $1\n$2\n')
    processed = processed.replace(/^\* ([^:]+):(.+)$/gim, '#### $1\n$2\n')
    
    // Remove empty list items (just * with whitespace or nothing)
    processed = processed.replace(/^\*\s*$/gim, '')
    
    // Convert remaining list items to regular paragraphs, preserving only meaningful lists
    // First, identify what should remain as lists (short, simple items)
    const lines = processed.split('\n')
    const processedLines = lines.map(line => {
      const listMatch = line.match(/^\* (.+)$/)
      if (listMatch) {
        const content = listMatch[1].trim()
        // Keep as list only if it's short, doesn't contain timestamps, and looks like a true list item
        const hasTimestamp = /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(content)
        const isLongContent = content.length > 80
        const looksLikeHeader = content.includes(':') && content.length < 50
        
        if (hasTimestamp || isLongContent || looksLikeHeader) {
          // Convert to paragraph
          return content
        } else {
          // Keep as list item but clean
          return `* ${content}`
        }
      }
      return line
    })
    processed = processedLines.join('\n')
    
    // Remove multiple consecutive empty lines
    processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n')
    
    // Add extra line breaks before headings for enhanced block separation
    // This helps create visual separation between content blocks
    processed = processed.replace(/([^\n])\n(#{1,6}\s)/gim, '$1\n\n$2')
    
    return processed
  }

  const components: Components = {
    // Handle paragraph elements with timestamp processing and block spacing
    p: ({ children }) => {
      const textContent = children?.toString() || ''
      
      // Process timestamps in paragraph content
      const processedContent = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          const timestampParts = processTimestamps(child)
          return timestampParts.length > 1 ? timestampParts : child
        }
        return child
      })
      
      // Check if this paragraph contains a question
      const hasQuestion = /[?？]/.test(textContent)
      if (hasQuestion && onQuestionClick) {
        const questions = textContent.match(/[^.!?]*[?？][^.!?]*/g)
        if (questions && questions.length > 0) {
          return (
            <p className="mb-4">
              {processedContent}
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
      
      // Use larger margin for better block separation
      return <p className="mb-4">{processedContent}</p>
    },

    // Handle headings with enhanced block separation for better readability
    h1: ({ children }) => <h1 className="text-2xl font-bold mt-8 mb-3 first:mt-0">{children}</h1>,
    h2: ({ children }) => <h2 className="text-xl font-bold mt-8 mb-3 first:mt-0">{children}</h2>,
    h3: ({ children }) => <h3 className="text-lg font-semibold mt-6 mb-2 first:mt-0">{children}</h3>,
    h4: ({ children }) => <h4 className="text-base font-semibold mt-6 mb-2 first:mt-0">{children}</h4>,

    // Handle lists with enhanced spacing for block separation
    ul: ({ children }) => <ul className="list-none mb-6 mt-2">{children}</ul>,
    ol: ({ children }) => <ol className="list-none mb-6 mt-2">{children}</ol>,
    li: ({ children }) => {
      const content = children?.toString() || ''
      
      // Process timestamps in list items
      const processedContent = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          const timestampParts = processTimestamps(child)
          return timestampParts.length > 1 ? timestampParts : child
        }
        return child
      })
      
      // Very restrictive criteria for adding bullets
      const shouldAddBullet = 
        content.length > 5 && // Must have substantial content
        content.length < 60 && // Must be reasonably short
        !content.includes(':') && // No colons (likely headers)
        !content.includes('時間') && // No time-related words
        !/\b\d{1,2}:\d{2}/.test(content) && // No timestamps
        !/^[A-Z]/.test(content.trim()) && // Not starting with capital (likely title)
        !content.includes('について') && // Not descriptive text
        content.split(' ').length < 10 && // Not too many words
        content.trim().length === content.length // No leading/trailing whitespace issues
      
      return (
        <li className="ml-0 mb-1">
          {shouldAddBullet ? '• ' : ''}{processedContent}
        </li>
      )
    },

    // Handle strong/bold text
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,

    // Enhanced text processing for timestamps
    text: ({ children }) => {
      const textValue = children?.toString() || ''
      if (!textValue || !onSeek) return <>{children}</>
      
      const timestampParts = processTimestamps(textValue)
      if (timestampParts.length > 1) {
        return <>{timestampParts}</>
      }
      
      return <>{children}</>
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