import request from 'supertest'
import { describe, it, expect } from '@jest/globals'

// Note: This test assumes the server is running on localhost:3001
// In a real test environment, you would mock the server or use a test server

describe('PDF Cost Estimation API', () => {
  const baseUrl = 'http://localhost:3001'

  describe('POST /api/estimate-cost-pdf', () => {
    it('should return cost estimation for PDF with default page count', async () => {
      const response = await request(baseUrl)
        .post('/api/estimate-cost-pdf')
        .send({
          gptModel: 'gpt-4o-mini',
          generateSummary: true
        })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        contentType: 'pdf',
        pageCount: 10, // default
        estimatedCharacterCount: 40000, // 10 pages * 4000 chars/page
        gptModel: 'gpt-4o-mini',
        estimatedCosts: {
          transcription: 0, // PDF parsing is free
          summary: expect.any(Number),
          article: 0,
          total: expect.any(Number)
        },
        estimatedProcessingTime: {
          transcription: 15, // 10 pages * 1.5s/page
          summary: expect.any(Number),
          total: expect.any(Number),
          formatted: expect.any(String),
          transcriptionRate: '1.5s/page',
          summaryRate: expect.any(String),
          basedOn: 'model_default',
          confidence: 0.6,
          isHistoricalEstimate: false
        }
      })
    })

    it('should return cost estimation for PDF with custom page count', async () => {
      const response = await request(baseUrl)
        .post('/api/estimate-cost-pdf')
        .send({
          pageCount: 20,
          gptModel: 'gpt-4o-mini',
          generateSummary: true
        })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        pageCount: 20,
        estimatedCharacterCount: 80000, // 20 pages * 4000 chars/page
        estimatedProcessingTime: {
          transcription: 30, // 20 pages * 1.5s/page
          transcriptionRate: '1.5s/page'
        }
      })
    })

    it('should return zero summary cost when generateSummary is false', async () => {
      const response = await request(baseUrl)
        .post('/api/estimate-cost-pdf')
        .send({
          pageCount: 5,
          gptModel: 'gpt-4o-mini',
          generateSummary: false
        })
        .expect(200)

      expect(response.body.estimatedCosts.summary).toBe(0)
      expect(response.body.estimatedCosts.total).toBe(0)
      expect(response.body.estimatedProcessingTime.summary).toBe(0)
      expect(response.body.estimatedProcessingTime.summaryRate).toBe('0s')
    })

    it('should handle different GPT models', async () => {
      const response = await request(baseUrl)
        .post('/api/estimate-cost-pdf')
        .send({
          pageCount: 10,
          gptModel: 'gpt-4',
          generateSummary: true
        })
        .expect(200)

      expect(response.body.gptModel).toBe('gpt-4')
      // GPT-4 should be more expensive than gpt-4o-mini
      expect(response.body.estimatedCosts.summary).toBeGreaterThan(0)
    })
  })
})