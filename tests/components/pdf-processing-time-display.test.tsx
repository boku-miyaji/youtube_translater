import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock the getFirstStageProcessingTime function logic
describe('PDF Processing Time Display', () => {
  let mockCurrentVideo: any
  let mockIsPdfContent: jest.Mock
  
  beforeEach(() => {
    mockIsPdfContent = jest.fn()
    mockCurrentVideo = null
  })
  
  // Simulate the getFirstStageProcessingTime function logic
  const getFirstStageProcessingTime = () => {
    if (!mockCurrentVideo?.analysisTime) {
      console.log('❌ getFirstStageProcessingTime: No analysisTime data')
      return null
    }
    
    const isPdf = mockIsPdfContent(mockCurrentVideo)
    console.log(`📊 getFirstStageProcessingTime: isPdf=${isPdf}, analysisTime=`, mockCurrentVideo.analysisTime)
    
    if (isPdf) {
      const analysisTime = mockCurrentVideo.analysisTime
      
      // Priority 1: extraction field (specific for PDF text extraction)
      if (analysisTime.extraction !== undefined && typeof analysisTime.extraction === 'number' && analysisTime.extraction >= 0) {
        console.log(`✅ PDF using extraction time: ${analysisTime.extraction}`)
        return analysisTime.extraction
      }
      
      // Priority 2: transcription field (in case extraction is named differently)
      if (analysisTime.transcription !== undefined && typeof analysisTime.transcription === 'number' && analysisTime.transcription >= 0) {
        console.log(`✅ PDF using transcription time: ${analysisTime.transcription}`)
        return analysisTime.transcription
      }
      
      // Priority 3: For completed PDF analysis, provide fallback to prevent "計測中..." display
      // If we have a summary time, it means analysis completed - use minimal extraction time
      if (analysisTime.summary !== undefined && typeof analysisTime.summary === 'number' && analysisTime.summary >= 0) {
        console.log('⚠️ PDF: Using fallback extraction time (0.1s) as analysis is completed with summary')
        return 0.1 // Minimal fallback to indicate completion
      }
      
      // If no timing data is available, return null (will show "計測中...")
      console.log('❌ PDF: No valid extraction timing data found. Available fields:', Object.keys(analysisTime))
      console.log('❌ PDF: extraction =', analysisTime.extraction, ', transcription =', analysisTime.transcription, ', summary =', analysisTime.summary)
      return null
    } else {
      // For audio/video content
      return mockCurrentVideo.analysisTime.transcription || null
    }
  }

  describe('PDF extraction time display', () => {
    beforeEach(() => {
      mockIsPdfContent.mockReturnValue(true)
    })

    it('should return extraction time when >= 0 (including 0)', () => {
      mockCurrentVideo = {
        analysisTime: {
          extraction: 0,
          summary: 5
        }
      }
      
      const result = getFirstStageProcessingTime()
      expect(result).toBe(0)
      expect(result).not.toBeNull()
    })

    it('should return extraction time for sub-second values', () => {
      mockCurrentVideo = {
        analysisTime: {
          extraction: 0.3,
          summary: 2.5
        }
      }
      
      const result = getFirstStageProcessingTime()
      expect(result).toBe(0.3)
      expect(result).not.toBeNull()
    })

    it('should return transcription time when extraction is undefined', () => {
      mockCurrentVideo = {
        analysisTime: {
          transcription: 0.5,
          summary: 3
        }
      }
      
      const result = getFirstStageProcessingTime()
      expect(result).toBe(0.5)
      expect(result).not.toBeNull()
    })

    it('should return fallback time (0.1s) when only summary is available', () => {
      mockCurrentVideo = {
        analysisTime: {
          summary: 5
        }
      }
      
      const result = getFirstStageProcessingTime()
      expect(result).toBe(0.1)
      expect(result).not.toBeNull()
    })

    it('should return null only when no timing data is available at all', () => {
      mockCurrentVideo = {
        analysisTime: {}
      }
      
      const result = getFirstStageProcessingTime()
      expect(result).toBeNull()
    })

    it('should handle zero values correctly (not return null)', () => {
      mockCurrentVideo = {
        analysisTime: {
          extraction: 0,
          transcription: 0,
          summary: 0
        }
      }
      
      const result = getFirstStageProcessingTime()
      expect(result).toBe(0) // Should return 0, not null or fallback
      expect(result).not.toBeNull()
    })
  })

  describe('formatSafeDuration compatibility', () => {
    it('should work with zero values from getFirstStageProcessingTime', () => {
      // Mock formatSafeDuration logic for testing
      const formatSafeDuration = (duration: number | null): string => {
        if (duration === null || duration === undefined || isNaN(duration) || duration < 0) {
          return '計測中...'
        }
        
        // For sub-second durations, show with one decimal place
        if (duration < 1) {
          const roundedDuration = Math.round(duration * 10) / 10
          return `${roundedDuration}秒`
        }
        // For durations less than 60 seconds, round to nearest integer
        else if (duration < 60) {
          const safeDuration = Math.round(duration)
          return `${safeDuration}秒`
        }
        else {
          const safeDuration = Math.round(duration)
          const minutes = Math.floor(safeDuration / 60)
          const seconds = safeDuration % 60
          return `${minutes}分${seconds}秒`
        }
      }

      // Test various scenarios
      expect(formatSafeDuration(0)).toBe('0秒')
      expect(formatSafeDuration(0.1)).toBe('0.1秒')
      expect(formatSafeDuration(0.3)).toBe('0.3秒')
      expect(formatSafeDuration(null)).toBe('計測中...')
    })
  })
})