import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import HistoryPage from '../../../src/components/pages/HistoryPage'
import { useHistory } from '../../../src/hooks/useHistory'
import { useAppStore } from '../../../src/store/appStore'

// Mock dependencies
jest.mock('../../../src/hooks/useHistory')
jest.mock('../../../src/store/appStore')
jest.mock('../../../src/components/shared/HistoryTable', () => ({
  __esModule: true,
  default: ({ data }: { data: any[] }) => (
    <div data-testid="history-table">
      {data.map((item, index) => (
        <div key={index} data-testid={`history-item-${index}`}>
          {item.title} - {item.metadata?.basic?.channel}
        </div>
      ))}
    </div>
  )
}))

const mockHistoryData = [
  {
    id: '1',
    title: 'Video from Channel A',
    videoId: 'abc123',
    timestamp: '2025-01-09T10:00:00Z',
    metadata: {
      basic: {
        title: 'Video from Channel A',
        channel: 'Channel A',
        duration: 300
      }
    }
  },
  {
    id: '2', 
    title: 'Video from Channel B',
    videoId: 'def456',
    timestamp: '2025-01-08T10:00:00Z',
    metadata: {
      basic: {
        title: 'Video from Channel B',
        channel: 'Channel B',
        duration: 450
      }
    }
  },
  {
    id: '3',
    title: 'Another video from Channel A',
    videoId: 'ghi789',
    timestamp: '2025-01-07T10:00:00Z',
    metadata: {
      basic: {
        title: 'Another video from Channel A',
        channel: 'Channel A',
        duration: 600
      }
    }
  }
]

describe('HistoryPage Channel Filter Feature', () => {
  beforeEach(() => {
    // Mock useAppStore
    ;(useAppStore as jest.Mock).mockReturnValue({
      setCurrentVideo: jest.fn()
    })

    // Mock useHistory with test data
    ;(useHistory as jest.Mock).mockReturnValue({
      data: mockHistoryData,
      isLoading: false,
      error: null
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <HistoryPage />
      </BrowserRouter>
    )
  }

  test('renders channel filter dropdown with available channels', async () => {
    renderComponent()
    
    const channelSelect = screen.getByLabelText('Filter by Channel')
    expect(channelSelect).toBeInTheDocument()
    
    // Check for "All Channels" option
    expect(screen.getByDisplayValue('All Channels')).toBeInTheDocument()
    
    // Check for available channels
    expect(screen.getByText('📺 Channel A')).toBeInTheDocument()
    expect(screen.getByText('📺 Channel B')).toBeInTheDocument()
  })

  test('filters videos by selected channel', async () => {
    renderComponent()
    
    const channelSelect = screen.getByLabelText('Filter by Channel')
    
    // Initially all videos should be visible
    expect(screen.getByText('3 videos found')).toBeInTheDocument()
    
    // Filter by Channel A
    fireEvent.change(channelSelect, { target: { value: 'Channel A' } })
    
    await waitFor(() => {
      expect(screen.getByText('2 videos found')).toBeInTheDocument()
      expect(screen.getByText('(filtered from 3 total)')).toBeInTheDocument()
    })
  })

  test('shows filter summary when channel is selected', async () => {
    renderComponent()
    
    const channelSelect = screen.getByLabelText('Filter by Channel')
    
    // Filter by Channel B
    fireEvent.change(channelSelect, { target: { value: 'Channel B' } })
    
    await waitFor(() => {
      expect(screen.getByText('Filters:')).toBeInTheDocument()
      expect(screen.getByText('📺 Channel B')).toBeInTheDocument()
    })
  })

  test('can clear channel filter', async () => {
    renderComponent()
    
    const channelSelect = screen.getByLabelText('Filter by Channel')
    
    // Filter by Channel A
    fireEvent.change(channelSelect, { target: { value: 'Channel A' } })
    
    await waitFor(() => {
      expect(screen.getByText('2 videos found')).toBeInTheDocument()
    })
    
    // Clear filter using the x button
    const clearButton = screen.getByRole('button', { name: '×' })
    fireEvent.click(clearButton)
    
    await waitFor(() => {
      expect(screen.getByText('3 videos found')).toBeInTheDocument()
      expect(screen.queryByText('Filters:')).not.toBeInTheDocument()
    })
  })

  test('can combine search and channel filters', async () => {
    renderComponent()
    
    const searchInput = screen.getByLabelText('Search')
    const channelSelect = screen.getByLabelText('Filter by Channel')
    
    // Filter by Channel A
    fireEvent.change(channelSelect, { target: { value: 'Channel A' } })
    
    // Then search for "Another"
    fireEvent.change(searchInput, { target: { value: 'Another' } })
    
    await waitFor(() => {
      expect(screen.getByText('1 videos found')).toBeInTheDocument()
      expect(screen.getByText('(filtered from 3 total)')).toBeInTheDocument()
    })
    
    // Should show both filters
    expect(screen.getByText('Filters:')).toBeInTheDocument()
    expect(screen.getByText('🔍 "Another"')).toBeInTheDocument()
    expect(screen.getByText('📺 Channel A')).toBeInTheDocument()
  })

  test('can clear all filters at once', async () => {
    renderComponent()
    
    const searchInput = screen.getByLabelText('Search')
    const channelSelect = screen.getByLabelText('Filter by Channel')
    
    // Apply both filters
    fireEvent.change(searchInput, { target: { value: 'video' } })
    fireEvent.change(channelSelect, { target: { value: 'Channel A' } })
    
    await waitFor(() => {
      expect(screen.getByText('Filters:')).toBeInTheDocument()
    })
    
    // Clear all filters
    const clearAllButton = screen.getByText('Clear all')
    fireEvent.click(clearAllButton)
    
    await waitFor(() => {
      expect(screen.getByText('3 videos found')).toBeInTheDocument()
      expect(screen.queryByText('Filters:')).not.toBeInTheDocument()
    })
  })

  test('shows channel count in results header', async () => {
    renderComponent()
    
    expect(screen.getByText('📺 2 channels available')).toBeInTheDocument()
  })

  test('handles empty history gracefully', async () => {
    ;(useHistory as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    })
    
    renderComponent()
    
    const channelSelect = screen.getByLabelText('Filter by Channel')
    expect(channelSelect).toBeInTheDocument()
    
    // Should only have "All Channels" option
    expect(screen.getByDisplayValue('All Channels')).toBeInTheDocument()
    expect(screen.queryByText('📺')).not.toBeInTheDocument()
  })

  test('includes channel name in search functionality', async () => {
    renderComponent()
    
    const searchInput = screen.getByLabelText('Search')
    
    // Search by channel name
    fireEvent.change(searchInput, { target: { value: 'Channel B' } })
    
    await waitFor(() => {
      expect(screen.getByText('1 videos found')).toBeInTheDocument()
    })
  })
})