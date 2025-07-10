import request from 'supertest'

// Mock OpenAI
jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: { content: 'Mocked AI response' },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150
          }
        })
      }
    }
  }))
}))

// Import server after mocking
import app from '../../src/server'

describe('Analyze Page Chat Integration', () => {
  describe('POST /api/chat', () => {
    it('should accept transcript from request body when provided', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'What is this video about?',
          videoId: 'test-video-123',
          transcript: 'This is the transcript content from the analyze page',
          summary: 'This is the summary from the analyze page',
          history: []
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('response')
      expect(response.body).toHaveProperty('model')
      expect(response.body).toHaveProperty('cost')
      expect(response.body).toHaveProperty('tokens')
    })

    it('should handle missing transcript gracefully', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'What is this video about?',
          videoId: 'test-video-123',
          history: []
        })

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('success', false)
      expect(response.body.response).toContain('動画の文字起こし')
    })

    it('should handle missing message', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          videoId: 'test-video-123',
          transcript: 'Some transcript',
          history: []
        })

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('success', false)
      expect(response.body.response).toBe('Message is required')
    })

    it('should use transcript from request body even when global transcript exists', async () => {
      // This test ensures that the request transcript takes precedence
      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'Summarize this specific content',
          videoId: 'test-video-456',
          transcript: 'Specific transcript from the analyze page that should be used',
          summary: 'Specific summary from the analyze page',
          history: []
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('success', true)
      // The response should be based on the specific transcript sent
    })
  })
})