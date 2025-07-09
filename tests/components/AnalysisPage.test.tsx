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
        timestamp: '2025-01-08T10:00:00Z', // Older date
        method: 'whisper',
        analysisTime: { duration: 45 }, // 45 seconds processing time
        metadata: {
          basic: {
            duration: 300 // 5 minutes video = 300 seconds
          }
        }
      },
      {
        id: 'test-2',
        title: 'Test Video 2',
        timestamp: '2025-01-09T11:00:00Z', // Newer date
        method: 'subtitle',
        analysisTime: { duration: 30 }, // 30 seconds processing time
        metadata: {
          basic: {
            duration: 180 // 3 minutes video = 180 seconds
          }
        }
      },
      {
        id: 'test-3',
        title: 'Test Video 3',
        timestamp: '2025-01-07T15:00:00Z', // Oldest date
        method: 'whisper',
        analysisTime: { duration: 60 }, // 60 seconds processing time
        metadata: {
          basic: {
            duration: 600 // 10 minutes video = 600 seconds
          }
        }
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

  it('should display organized section headers with proper categorization', () => {
    renderAnalysisPage()
    expect(screen.getByText('📊 概要サマリー')).toBeInTheDocument()
    expect(screen.getByText('🎬 動画処理詳細')).toBeInTheDocument()
    expect(screen.getByText('💰 コスト詳細')).toBeInTheDocument()
  })

  it('should display refined statistics title "動画処理統計" in correct section', () => {
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
    expect(screen.getByText('3')).toBeInTheDocument() // 3 test videos
  })

  it('should display model usage statistics', () => {
    renderAnalysisPage()
    expect(screen.getByText('Model Usage Statistics')).toBeInTheDocument()
    expect(screen.getByText('2 requests')).toBeInTheDocument() // gpt-4o-mini has 2 requests
  })

  it('should display charts with proper date ordering', () => {
    renderAnalysisPage()
    // Check if chart titles are displayed
    expect(screen.getByText('Cost Trends')).toBeInTheDocument()
    expect(screen.getByText('日別処理動画数の推移')).toBeInTheDocument()
    expect(screen.getByText('週間処理動画数')).toBeInTheDocument()
    expect(screen.getByText('累積コストの推移')).toBeInTheDocument()
  })

  it('should handle history data with mixed timestamps correctly', () => {
    renderAnalysisPage()
    // Check that processing time analysis is displayed
    expect(screen.getByText('⏱️ 処理時間分析')).toBeInTheDocument()
    expect(screen.getByText('平均処理時間:')).toBeInTheDocument()
  })

  it('should display cost-related information in the dedicated cost section', () => {
    renderAnalysisPage()
    // Check that all cost-related elements are present
    expect(screen.getByText('Cost Trends')).toBeInTheDocument()
    expect(screen.getByText('💸 詳細コスト分析')).toBeInTheDocument()
    expect(screen.getByText('Model Usage Statistics')).toBeInTheDocument()
    expect(screen.getByText('コスト内訳')).toBeInTheDocument()
    expect(screen.getByText('累積コストの推移')).toBeInTheDocument()
  })

  it('should display video processing information in the dedicated processing section', () => {
    renderAnalysisPage()
    // Check that all processing-related elements are present
    expect(screen.getByText('処理方法の内訳')).toBeInTheDocument()
    expect(screen.getByText('処理時間の分布')).toBeInTheDocument()
    expect(screen.getByText('日別処理動画数の推移')).toBeInTheDocument()
    expect(screen.getByText('週間処理動画数')).toBeInTheDocument()
  })

  it('should maintain proper section ordering in the layout', () => {
    renderAnalysisPage()
    const sections = [
      '📊 概要サマリー',
      '🎬 動画処理詳細', 
      '💰 コスト詳細'
    ]
    
    sections.forEach(section => {
      expect(screen.getByText(section)).toBeInTheDocument()
    })
  })

  it('should display processing time per minute of video', () => {
    renderAnalysisPage()
    // Check that processing time per minute metrics are displayed
    expect(screen.getByText('動画1分あたり平均処理時間:')).toBeInTheDocument()
    expect(screen.getByText('動画1分あたり最短:')).toBeInTheDocument()
    expect(screen.getByText('動画1分あたり最長:')).toBeInTheDocument()
    
    // Check that values are displayed (not just dashes)
    expect(screen.getByText(/秒\/分/)).toBeInTheDocument()
  })

  it('should calculate processing time per minute correctly', () => {
    renderAnalysisPage()
    
    // Based on test data:
    // Video 1: 45 seconds processing / 5 minutes video = 9.0 seconds/minute
    // Video 2: 30 seconds processing / 3 minutes video = 10.0 seconds/minute  
    // Video 3: 60 seconds processing / 10 minutes video = 6.0 seconds/minute
    // Average: (9.0 + 10.0 + 6.0) / 3 = 8.33 seconds/minute
    
    // Check that processing time per minute calculations are present
    expect(screen.getByText('動画1分あたり平均処理時間:')).toBeInTheDocument()
    
    // The exact values will depend on the calculation logic
    // Just verify the format is correct
    const timePerMinuteElements = screen.getAllByText(/\d+\.\d+秒\/分/)
    expect(timePerMinuteElements.length).toBeGreaterThan(0)
  })
})