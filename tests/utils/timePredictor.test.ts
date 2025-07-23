import { ProcessingTimePredictor } from '../../src/utils/timePredictor'

describe('ProcessingTimePredictor', () => {
  describe('PDF processing time with small files', () => {
    it('should not round sub-second times to zero', () => {
      const predictor = new ProcessingTimePredictor([])
      
      // Test with very small PDF (100 characters)
      const result = predictor.predictProcessingTime({
        contentType: 'pdf',
        characterCount: 100,
        transcriptionModel: 'whisper-1',
        gptModel: 'gpt-4o-mini',
        language: 'ja'
      })

      // With updated rates: 100/1000 * 1.5 = 0.15 seconds for transcription
      // 100/1000 * 3 * 0.8 = 0.24 seconds for summary
      expect(result.transcription).toBeCloseTo(0.2, 1)
      expect(result.summary).toBeCloseTo(0.2, 1)
      expect(result.total).toBeGreaterThan(0)
      expect(result.total).toBeLessThan(1)
      expect(result.formatted).toMatch(/0\.\d sec/)
    })

    it('should handle medium-sized PDFs correctly', () => {
      const predictor = new ProcessingTimePredictor([])
      
      // Test with medium PDF (5000 characters)
      const result = predictor.predictProcessingTime({
        contentType: 'pdf',
        characterCount: 5000,
        transcriptionModel: 'whisper-1',
        gptModel: 'gpt-4o-mini',
        language: 'ja'
      })

      // 5000/1000 * 1.5 = 7.5 seconds for transcription
      // 5000/1000 * 3 * 0.8 = 12 seconds for summary
      expect(result.transcription).toBe(8) // rounded
      expect(result.summary).toBe(12) // rounded
      expect(result.total).toBe(20)
      expect(result.formatted).toBe('20 sec')
    })
  })

  describe('predictProcessingTime return values', () => {
    it('should preserve decimal values for times less than 1 second', () => {
      const predictor = new ProcessingTimePredictor([])
      
      const result = predictor.predictProcessingTime({
        contentType: 'pdf',
        characterCount: 50,
        transcriptionModel: 'whisper-1',
        gptModel: 'gpt-4o-mini',
        language: 'en'
      })

      // Verify the values are not rounded to 0
      expect(result.transcription).toBeGreaterThan(0)
      expect(result.transcription).toBeLessThan(1)
      expect(result.summary).toBeGreaterThan(0)
      expect(result.summary).toBeLessThan(1)
      
      // Verify decimal precision
      const transcriptionDecimals = result.transcription.toString().split('.')[1]
      const summaryDecimals = result.summary.toString().split('.')[1]
      
      // Should have at most 1 decimal place
      expect(transcriptionDecimals ? transcriptionDecimals.length : 0).toBeLessThanOrEqual(1)
      expect(summaryDecimals ? summaryDecimals.length : 0).toBeLessThanOrEqual(1)
    })

    it('should round values 1 second or greater to whole numbers', () => {
      const predictor = new ProcessingTimePredictor([])
      
      const result = predictor.predictProcessingTime({
        contentType: 'pdf',
        characterCount: 10000,
        transcriptionModel: 'whisper-1',
        gptModel: 'gpt-4o-mini',
        language: 'en'
      })

      // Values should be whole numbers
      expect(Number.isInteger(result.transcription)).toBe(true)
      expect(Number.isInteger(result.summary)).toBe(true)
      expect(Number.isInteger(result.total)).toBe(true)
    })
  })

  describe('rate display for PDF', () => {
    it('should show correct rate per 1000 characters', () => {
      const predictor = new ProcessingTimePredictor([])
      
      const result = predictor.predictProcessingTime({
        contentType: 'pdf',
        characterCount: 1000,
        transcriptionModel: 'whisper-1',
        gptModel: 'gpt-4o-mini',
        language: 'ja'
      })

      expect(result.transcriptionRate).toBe('1.50s/1k chars')
      expect(result.summaryRate).toBe('2.40s/1k chars')
    })

    it('should show correct rate per page when pageCount is provided', () => {
      const predictor = new ProcessingTimePredictor([])
      
      const result = predictor.predictProcessingTime({
        contentType: 'pdf',
        pageCount: 10,
        characterCount: 40000, // 4000 chars per page
        transcriptionModel: 'whisper-1',
        gptModel: 'gpt-4o-mini',
        language: 'ja'
      })

      expect(result.transcriptionRate).toBe('1.5s/page')
      expect(result.summaryRate).toBe('9.6s/page') // 12 * 0.8 (gpt-4o-mini coefficient)
    })
  })

  describe('PDF processing time with page count', () => {
    it('should prioritize page-based calculation over character-based', () => {
      const predictor = new ProcessingTimePredictor([])
      
      const result = predictor.predictProcessingTime({
        contentType: 'pdf',
        pageCount: 5,
        characterCount: 20000, // 4000 chars per page
        transcriptionModel: 'whisper-1',
        gptModel: 'gpt-4o-mini',
        language: 'ja'
      })

      // Should use page-based calculation: 5 * 1.5 = 7.5 → 8 seconds
      expect(result.transcription).toBe(8)
      // Should use page-based calculation: 5 * 12 * 0.8 = 48 seconds
      expect(result.summary).toBe(48)
      expect(result.total).toBe(56)
    })

    it('should fallback to character-based when no pageCount', () => {
      const predictor = new ProcessingTimePredictor([])
      
      const result = predictor.predictProcessingTime({
        contentType: 'pdf',
        characterCount: 5000,
        transcriptionModel: 'whisper-1',
        gptModel: 'gpt-4o-mini',
        language: 'ja'
      })

      // Should use character-based calculation: 5000/1000 * 1.5 = 7.5 → 8 seconds
      expect(result.transcription).toBe(8)
      // Should use character-based calculation: 5000/1000 * 3 * 0.8 = 12 seconds
      expect(result.summary).toBe(12)
    })
  })
})