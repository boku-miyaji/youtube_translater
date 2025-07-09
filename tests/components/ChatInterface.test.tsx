import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ChatInterface from '../../src/components/shared/ChatInterface'

// Mock fetch globally
global.fetch = jest.fn()

describe('ChatInterface Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    ;(global.fetch as jest.Mock).mockClear()
  })

  const defaultProps = {
    videoId: 'test-video-id',
    videoTitle: 'Test Video',
    transcript: 'Test transcript content',
    summary: 'Test summary content'
  }

  it('should render chat interface correctly', () => {
    render(<ChatInterface {...defaultProps} />)
    
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ask about the video...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('should use the correct API endpoint when sending messages', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ response: 'Test response' })
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    render(<ChatInterface {...defaultProps} />)
    
    const input = screen.getByPlaceholderText('Ask about the video...')
    const sendButton = screen.getByRole('button', { name: /send/i })
    
    // Type a message and send it
    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Test message',
          videoId: 'test-video-id',
          history: [],
        }),
      })
    })
  })

  it('should handle API errors gracefully', async () => {
    const mockResponse = {
      ok: false,
      status: 404
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    render(<ChatInterface {...defaultProps} />)
    
    const input = screen.getByPlaceholderText('Ask about the video...')
    const sendButton = screen.getByRole('button', { name: /send/i })
    
    // Type a message and send it
    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument()
    })

    // Should display error message
    await waitFor(() => {
      expect(screen.getByText(/Sorry, I encountered an error/)).toBeInTheDocument()
    })
  })

  it('should display sample questions when no messages exist', () => {
    render(<ChatInterface {...defaultProps} />)
    
    expect(screen.getByText('💡 深掘り質問サンプル')).toBeInTheDocument()
    expect(screen.getByText('質問をクリックして簡単に深掘り！')).toBeInTheDocument()
  })

  it('should generate smart questions based on content', () => {
    const propsWithRichContent = {
      ...defaultProps,
      summary: 'この動画では機械学習について説明されています。アルゴリズムの実装方法や結果の分析について詳しく解説されています。',
      transcript: 'より詳細な機械学習の解説がここに含まれています。'
    }
    
    render(<ChatInterface {...propsWithRichContent} />)
    
    // Should generate questions based on the content
    expect(screen.getByText('💡 深掘り質問サンプル')).toBeInTheDocument()
    
    // Check if questions are generated (they should be clickable elements)
    const questionElements = screen.getAllByTitle('クリックでチャットに質問を入力')
    expect(questionElements.length).toBeGreaterThan(0)
  })

  it('should handle prefilled questions correctly', () => {
    const propsWithPrefill = {
      ...defaultProps,
      prefillQuestion: 'この動画の要点を教えて'
    }
    
    render(<ChatInterface {...propsWithPrefill} />)
    
    const input = screen.getByPlaceholderText('Ask about the video...')
    expect(input).toHaveValue('この動画の要点を教えて')
  })

  it('should clear input after sending message', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ response: 'Test response' })
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    render(<ChatInterface {...defaultProps} />)
    
    const input = screen.getByPlaceholderText('Ask about the video...')
    const sendButton = screen.getByRole('button', { name: /send/i })
    
    // Type a message and send it
    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.click(sendButton)

    // Input should be cleared after sending
    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })
})