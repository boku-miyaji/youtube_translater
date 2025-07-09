import React from 'react'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import AnalysisPage from '../../src/components/pages/AnalysisPage'

// Mock the react-query
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({
    data: [
      {
        videoId: 'test-video-1',
        title: 'Test Video 1',
        gptModel: 'gpt-4o-mini',
        totalCost: 0.0045,
        whisperCost: 0.0020,
        gptCost: 0.0025,
        timestamp: '2025-01-09T10:00:00Z',
        method: 'whisper',
        language: 'original'
      },
      {
        videoId: 'test-video-2',
        title: 'Test Video 2',
        gptModel: 'gpt-4o',
        totalCost: 0.0078,
        whisperCost: 0.0030,
        gptCost: 0.0048,
        timestamp: '2025-01-09T11:00:00Z',
        method: 'subtitle',
        language: 'ja'
      }
    ],
    isLoading: false,
    error: null
  }))
}))

// Mock the hooks
jest.mock('../../src/hooks/useCosts', () => ({
  useCosts: jest.fn(() => ({
    data: [
      {
        videoId: 'test-video-1',
        title: 'Test Video 1',
        gptModel: 'gpt-4o-mini',
        totalCost: 0.0045,
        whisperCost: 0.0020,
        gptCost: 0.0025,
        timestamp: '2025-01-09T10:00:00Z',
        method: 'whisper',
        language: 'original'
      },
      {
        videoId: 'test-video-2',
        title: 'Test Video 2',
        gptModel: 'gpt-4o',
        totalCost: 0.0078,
        whisperCost: 0.0030,
        gptCost: 0.0048,
        timestamp: '2025-01-09T11:00:00Z',
        method: 'subtitle',
        language: 'ja'
      }
    ],
    isLoading: false,
    error: null
  }))
}))

jest.mock('../../src/hooks/useHistory', () => ({
  useHistory: jest.fn(() => ({
    data: [
      {
        id: 'test-1',
        title: 'Test Video 1',
        timestamp: '2025-01-09T10:00:00Z',
        method: 'whisper',
        analysisTime: { duration: 45 }
      },
      {
        id: 'test-2',
        title: 'Test Video 2',
        timestamp: '2025-01-09T11:00:00Z',
        method: 'subtitle',
        analysisTime: { duration: 30 }
      }
    ]
  }))
}))

describe('AnalysisPage Component', () => {
  const renderAnalysisPage = () => {
    return render(
      <BrowserRouter>
        <AnalysisPage />
      </BrowserRouter>
    )
  }

  it('should render analysis page title', () => {
    renderAnalysisPage()
    expect(screen.getByText('Analysis')).toBeInTheDocument()
  })

  it('should display refined section title "データ分析" instead of "視覚的分析"', () => {
    renderAnalysisPage()
    expect(screen.getByText('📊 データ分析')).toBeInTheDocument()
    expect(screen.queryByText('📊 視覚的分析')).not.toBeInTheDocument()
  })

  it('should display refined statistics title "動画処理統計" instead of "動画分析統計"', () => {
    renderAnalysisPage()
    expect(screen.getByText('📊 動画処理統計')).toBeInTheDocument()
    expect(screen.queryByText('📊 動画分析統計')).not.toBeInTheDocument()
  })

  it('should display correct model names without "Unknown"', () => {
    renderAnalysisPage()
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument()
  })

  it('should display cost information correctly', () => {
    renderAnalysisPage()
    // Check if total cost is displayed
    expect(screen.getByText('Total Cost')).toBeInTheDocument()
    // Check if costs are calculated and displayed
    expect(screen.getByText('$0.0123')).toBeInTheDocument() // 0.0045 + 0.0078
  })

  it('should display this month costs correctly', () => {
    renderAnalysisPage()
    expect(screen.getByText('This Month')).toBeInTheDocument()
  })

  it('should display total requests count', () => {
    renderAnalysisPage()
    expect(screen.getByText('Total Requests')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // 2 test videos
  })

  it('should display model usage statistics', () => {
    renderAnalysisPage()
    expect(screen.getByText('Model Usage Statistics')).toBeInTheDocument()
    expect(screen.getByText('1 requests')).toBeInTheDocument() // Each model has 1 request
  })
})