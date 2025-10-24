import { describe, it, expect } from '@jest/globals'

describe('PDF Timing Calculation', () => {
  // Simulate the server-side timing calculation logic
  const calculatePdfTiming = (rawExtractionMs: number, rawSummaryMs: number) => {
    // Calculate extraction duration with minimum value to prevent 0-second display issues  
    const rawExtractionDuration = rawExtractionMs / 1000
    const extractionDuration = rawExtractionDuration < 1 ? 
      parseFloat(rawExtractionDuration.toFixed(1)) : 
      Math.round(rawExtractionDuration)

    // Calculate summary duration with sub-second precision  
    const rawSummaryDuration = rawSummaryMs / 1000
    const summaryDuration = rawSummaryDuration > 0 && rawSummaryDuration < 1 ? 
      parseFloat(rawSummaryDuration.toFixed(1)) : 
      Math.round(rawSummaryDuration)
    
    // Ensure timing values are reasonable (>= 0) and preserve sub-second precision
    const validatedExtractionDuration = Math.max(0, extractionDuration || 0)
    const validatedSummaryDuration = Math.max(0, summaryDuration || 0)
    
    return {
      extraction: validatedExtractionDuration,
      summary: validatedSummaryDuration,
      total: validatedExtractionDuration + validatedSummaryDuration
    }
  }

  describe('extraction duration calculation', () => {
    it('should preserve sub-second durations with 1 decimal place', () => {
      const result = calculatePdfTiming(300, 0) // 0.3 seconds
      expect(result.extraction).toBe(0.3)
      expect(typeof result.extraction).toBe('number')
    })

    it('should preserve very small durations', () => {
      const result = calculatePdfTiming(50, 0) // 0.05 seconds -> should become 0.1
      expect(result.extraction).toBe(0.1)
      expect(result.extraction).toBeGreaterThan(0)
    })

    it('should round durations >= 1 second to whole numbers', () => {
      const result = calculatePdfTiming(1500, 0) // 1.5 seconds -> should become 2
      expect(result.extraction).toBe(2)
      expect(Number.isInteger(result.extraction)).toBe(true)
    })

    it('should handle exactly 1 second correctly', () => {
      const result = calculatePdfTiming(1000, 0) // 1.0 seconds
      expect(result.extraction).toBe(1)
      expect(Number.isInteger(result.extraction)).toBe(true)
    })

    it('should handle 0 milliseconds', () => {
      const result = calculatePdfTiming(0, 0)
      expect(result.extraction).toBe(0)
      expect(result.extraction).not.toBeNull()
      expect(result.extraction).not.toBeUndefined()
    })
  })

  describe('summary duration calculation', () => {
    it('should handle sub-second summary times', () => {
      const result = calculatePdfTiming(0, 800) // 0.8 seconds
      expect(result.summary).toBe(0.8)
      expect(typeof result.summary).toBe('number')
    })

    it('should handle zero summary time', () => {
      const result = calculatePdfTiming(300, 0)
      expect(result.summary).toBe(0)
      expect(result.summary).not.toBeNull()
    })

    it('should round summary times >= 1 second', () => {
      const result = calculatePdfTiming(0, 2300) // 2.3 seconds -> should become 2
      expect(result.summary).toBe(2)
      expect(Number.isInteger(result.summary)).toBe(true)
    })
  })

  describe('total time calculation', () => {
    it('should correctly sum extraction and summary times', () => {
      const result = calculatePdfTiming(300, 700) // 0.3 + 0.7 = 1.0
      expect(result.extraction).toBe(0.3)
      expect(result.summary).toBe(0.7)
      expect(result.total).toBe(1.0)
    })

    it('should handle mixed integer and decimal values', () => {
      const result = calculatePdfTiming(300, 2000) // 0.3 + 2 = 2.3
      expect(result.extraction).toBe(0.3)
      expect(result.summary).toBe(2)
      expect(result.total).toBe(2.3)
    })

    it('should never produce negative values', () => {
      const result = calculatePdfTiming(-100, -200) // negative inputs
      expect(result.extraction).toBeGreaterThanOrEqual(0)
      expect(result.summary).toBeGreaterThanOrEqual(0)
      expect(result.total).toBeGreaterThanOrEqual(0)
    })
  })

  describe('edge cases', () => {
    it('should handle very fast processing (< 10ms)', () => {
      const result = calculatePdfTiming(5, 3) // 0.005 + 0.003 seconds
      expect(result.extraction).toBeGreaterThanOrEqual(0)
      expect(result.summary).toBeGreaterThanOrEqual(0)
      expect(result.total).toBeGreaterThanOrEqual(0)
    })

    it('should handle large processing times', () => {
      const result = calculatePdfTiming(120000, 180000) // 2 minutes + 3 minutes
      expect(result.extraction).toBe(120)
      expect(result.summary).toBe(180)
      expect(result.total).toBe(300)
    })
  })
})