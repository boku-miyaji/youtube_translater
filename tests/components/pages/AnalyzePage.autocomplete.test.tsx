import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import AnalyzePage from '../../../src/components/pages/AnalyzePage'
import { useHistory } from '../../../src/hooks/useHistory'
import { useAppStore } from '../../../src/store/appStore'

// Mock dependencies
jest.mock('../../../src/hooks/useHistory')
jest.mock('../../../src/store/appStore')
jest.mock('../../../src/components/shared/TranscriptViewer', () => ({
  __esModule: true,
  default: () => <div>TranscriptViewer</div>
}))
jest.mock('../../../src/components/shared/ChatInterface', () => ({
  __esModule: true,
  default: () => <div>ChatInterface</div>
}))

const mockHistoryData = [
  {
    id: '1',
    url: 'https://www.youtube.com/watch?v=abc123',
    title: 'Test Video 1',
    thumbnail: 'https://img.youtube.com/vi/abc123/default.jpg',
    timestamp: '2025-01-09T10:00:00Z',
    metadata: {
      basic: {
        title: 'Test Video 1',
        thumbnail: 'https://img.youtube.com/vi/abc123/default.jpg'
      }
    }
  },
  {
    id: '2',
    url: 'https://www.youtube.com/watch?v=def456',
    title: 'Another Test Video',
    thumbnail: 'https://img.youtube.com/vi/def456/default.jpg',
    timestamp: '2025-01-08T10:00:00Z',
    metadata: {
      basic: {
        title: 'Another Test Video',
        thumbnail: 'https://img.youtube.com/vi/def456/default.jpg'
      }
    }
  },
  {
    id: '3',
    url: 'https://www.youtube.com/watch?v=ghi789',
    title: 'Third Video Test',
    timestamp: '2025-01-07T10:00:00Z',
    metadata: {
      basic: {
        title: 'Third Video Test'
      }
    }
  }
]

describe('AnalyzePage Autocomplete Feature', () => {
  beforeEach(() => {
    // Mock useAppStore
    ;(useAppStore as jest.Mock).mockReturnValue({
      currentVideo: null,
      setCurrentVideo: jest.fn(),
      loading: false,
      setLoading: jest.fn()
    })

    // Mock useHistory
    ;(useHistory as jest.Mock).mockReturnValue({
      data: mockHistoryData
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <AnalyzePage />
      </BrowserRouter>
    )
  }

  test('shows autocomplete suggestions when typing in URL input', async () => {
    renderComponent()
    
    const urlInput = screen.getByTestId('url-input')
    
    // Type a search term
    fireEvent.change(urlInput, { target: { value: 'test' } })
    fireEvent.focus(urlInput)
    
    // Wait for suggestions to appear
    await waitFor(() => {
      expect(screen.getByText('🎬 Test Video 1')).toBeInTheDocument()
      expect(screen.getByText('🎬 Another Test Video')).toBeInTheDocument()
      expect(screen.getByText('🎬 Third Video Test')).toBeInTheDocument()
    })
  })

  test('filters suggestions based on input text', async () => {
    renderComponent()
    
    const urlInput = screen.getByTestId('url-input')
    
    // Type a more specific search term
    fireEvent.change(urlInput, { target: { value: 'another' } })
    fireEvent.focus(urlInput)
    
    // Only matching suggestion should appear
    await waitFor(() => {
      expect(screen.getByText('🎬 Another Test Video')).toBeInTheDocument()
      expect(screen.queryByText('🎬 Test Video 1')).not.toBeInTheDocument()
      expect(screen.queryByText('🎬 Third Video Test')).not.toBeInTheDocument()
    })
  })

  test('shows suggestions sorted by most recent first', async () => {
    renderComponent()
    
    const urlInput = screen.getByTestId('url-input')
    
    fireEvent.change(urlInput, { target: { value: 'video' } })
    fireEvent.focus(urlInput)
    
    await waitFor(() => {
      const suggestions = screen.getAllByText(/🎬.*Test Video|🎬.*Another Test Video|🎬.*Third Video Test/)
      // Check order - most recent should be first
      expect(suggestions[0]).toHaveTextContent('🎬 Test Video 1')
      expect(suggestions[1]).toHaveTextContent('🎬 Another Test Video')
      expect(suggestions[2]).toHaveTextContent('🎬 Third Video Test')
    })
  })

  test('limits suggestions to 5 items', async () => {
    // Mock more history items
    const manyHistoryItems = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      url: `https://www.youtube.com/watch?v=id${i}`,
      title: `Video ${i}`,
      timestamp: new Date(2025, 0, 10 - i).toISOString(),
      metadata: { basic: { title: `Video ${i}` } }
    }))
    
    ;(useHistory as jest.Mock).mockReturnValue({
      data: manyHistoryItems
    })
    
    renderComponent()
    
    const urlInput = screen.getByTestId('url-input')
    fireEvent.change(urlInput, { target: { value: 'video' } })
    fireEvent.focus(urlInput)
    
    await waitFor(() => {
      const suggestions = screen.getAllByText(/🎬 Video \d/)
      expect(suggestions).toHaveLength(5)
    })
  })

  test('clicking suggestion fills the URL input', async () => {
    renderComponent()
    
    const urlInput = screen.getByTestId('url-input') as HTMLInputElement
    
    fireEvent.change(urlInput, { target: { value: 'test' } })
    fireEvent.focus(urlInput)
    
    await waitFor(() => {
      const suggestion = screen.getByText('🎬 Test Video 1')
      fireEvent.click(suggestion.closest('div')!)
    })
    
    expect(urlInput.value).toBe('https://www.youtube.com/watch?v=abc123')
  })

  test('hides suggestions when input loses focus', async () => {
    renderComponent()
    
    const urlInput = screen.getByTestId('url-input')
    
    fireEvent.change(urlInput, { target: { value: 'test' } })
    fireEvent.focus(urlInput)
    
    await waitFor(() => {
      expect(screen.getByText('🎬 Test Video 1')).toBeInTheDocument()
    })
    
    fireEvent.blur(urlInput)
    
    await waitFor(() => {
      expect(screen.queryByText('🎬 Test Video 1')).not.toBeInTheDocument()
    }, { timeout: 500 })
  })

  test('searches by URL as well as title', async () => {
    renderComponent()
    
    const urlInput = screen.getByTestId('url-input')
    
    // Search by part of URL
    fireEvent.change(urlInput, { target: { value: 'abc123' } })
    fireEvent.focus(urlInput)
    
    await waitFor(() => {
      expect(screen.getByText('🎬 Test Video 1')).toBeInTheDocument()
      expect(screen.queryByText('🎬 Another Test Video')).not.toBeInTheDocument()
    })
  })

  test('shows no suggestions when no matches found', async () => {
    renderComponent()
    
    const urlInput = screen.getByTestId('url-input')
    
    fireEvent.change(urlInput, { target: { value: 'nonexistent' } })
    fireEvent.focus(urlInput)
    
    await waitFor(() => {
      expect(screen.queryByText('🎬 Test Video 1')).not.toBeInTheDocument()
      expect(screen.queryByText('🎬 Another Test Video')).not.toBeInTheDocument()
      expect(screen.queryByText('🎬 Third Video Test')).not.toBeInTheDocument()
    })
  })

  test('handles empty history gracefully', async () => {
    ;(useHistory as jest.Mock).mockReturnValue({
      data: []
    })
    
    renderComponent()
    
    const urlInput = screen.getByTestId('url-input')
    
    fireEvent.change(urlInput, { target: { value: 'test' } })
    fireEvent.focus(urlInput)
    
    // No suggestions should appear
    await waitFor(() => {
      expect(screen.queryByText(/🎬.*Test Video/)).not.toBeInTheDocument()
    })
  })

  test('handles null history gracefully', async () => {
    ;(useHistory as jest.Mock).mockReturnValue({
      data: null
    })
    
    renderComponent()
    
    const urlInput = screen.getByTestId('url-input')
    
    fireEvent.change(urlInput, { target: { value: 'test' } })
    fireEvent.focus(urlInput)
    
    // No suggestions should appear and no errors
    await waitFor(() => {
      expect(screen.queryByText(/🎬.*Test Video/)).not.toBeInTheDocument()
    })
  })
})