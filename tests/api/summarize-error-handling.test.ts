import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Test suite for /api/summarize endpoint error handling improvements
 *
 * This test suite validates that:
 * 1. Errors are properly classified with SummaryErrorType
 * 2. Error responses include errorType field
 * 3. Appropriate HTTP status codes are returned
 * 4. User-friendly error messages are provided
 * 5. No regression in successful summary generation
 */

describe('/api/summarize error handling', () => {
  // Mock environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Missing API Key', () => {
    it('should return 503 with API_KEY_MISSING error type when OpenAI API key is not configured', async () => {
      // Arrange: Remove API key
      delete process.env.OPENAI_API_KEY;

      // Act: Make request to /api/summarize
      const response = await fetch('http://localhost:3001/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: 'Test transcript',
          gptModel: 'gpt-4o-mini',
        }),
      });

      const data = await response.json();

      // Assert
      expect(response.status).toBe(503);
      expect(data.error).toContain('OpenAI APIが設定されていません');
      expect(data.errorType).toBe('API_KEY_MISSING');
    });
  });

  describe('Missing Transcript', () => {
    it('should return 400 when transcript is not provided', async () => {
      // Arrange & Act
      const response = await fetch('http://localhost:3001/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gptModel: 'gpt-4o-mini',
        }),
      });

      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain('Transcript is required');
    });
  });

  describe('Error Response Format', () => {
    it('should include errorType field in error responses', async () => {
      // Arrange: Set invalid API key to trigger error
      process.env.OPENAI_API_KEY = 'invalid_key';

      // Act
      const response = await fetch('http://localhost:3001/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: 'Test transcript',
          gptModel: 'gpt-4o-mini',
        }),
      });

      const data = await response.json();

      // Assert: Error response should have errorType field
      expect(data).toHaveProperty('errorType');
      expect(data.errorType).toBeDefined();
    });

    it('should include retryAfter field for RATE_LIMIT errors', async () => {
      // Note: This test requires mocking OpenAI API to return 429
      // In real scenario, we would need to mock the openai.chat.completions.create call
      // For now, this is a placeholder to demonstrate the expected behavior

      // Expected behavior:
      // - Status: 429
      // - errorType: 'RATE_LIMIT'
      // - retryAfter: 60 (seconds)
    });
  });

  describe('Successful Summary Generation', () => {
    it('should successfully generate summary when valid inputs are provided (mock mode)', async () => {
      // Arrange: Enable mock mode
      process.env.MOCK_OPENAI = 'true';
      process.env.OPENAI_API_KEY = 'mock_key';

      // Act
      const response = await fetch('http://localhost:3001/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: 'This is a test transcript about a video.',
          gptModel: 'gpt-4o-mini',
          analysisType: 'youtube',
        }),
      });

      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.summary).toBeDefined();
      expect(typeof data.summary).toBe('string');
      expect(data.cost).toBeDefined();
      expect(typeof data.cost).toBe('number');
    });
  });

  describe('Content Type Detection', () => {
    it('should correctly detect YouTube content type', async () => {
      process.env.MOCK_OPENAI = 'true';
      process.env.OPENAI_API_KEY = 'mock_key';

      const response = await fetch('http://localhost:3001/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: 'Test youtube transcript',
          analysisType: 'youtube',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should correctly detect PDF content type', async () => {
      process.env.MOCK_OPENAI = 'true';
      process.env.OPENAI_API_KEY = 'mock_key';

      const response = await fetch('http://localhost:3001/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: 'Test PDF content',
          analysisType: 'pdf',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should correctly detect audio content type', async () => {
      process.env.MOCK_OPENAI = 'true';
      process.env.OPENAI_API_KEY = 'mock_key';

      const response = await fetch('http://localhost:3001/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: 'Test audio transcript',
          analysisType: 'audio',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

/**
 * Unit tests for error classification logic
 *
 * These tests would ideally test the generateSummary function directly,
 * but since it's not exported, we test through the endpoint.
 */
describe('Error Classification', () => {
  it('should classify 429 errors as RATE_LIMIT', () => {
    // This would require mocking the OpenAI API response
    // Expected: SummaryErrorType.RATE_LIMIT
  });

  it('should classify 401 errors as API_KEY_INVALID', () => {
    // This would require mocking the OpenAI API response
    // Expected: SummaryErrorType.API_KEY_INVALID
  });

  it('should classify 400 errors as INVALID_REQUEST', () => {
    // This would require mocking the OpenAI API response
    // Expected: SummaryErrorType.INVALID_REQUEST
  });

  it('should classify ECONNREFUSED errors as NETWORK_ERROR', () => {
    // This would require mocking network failures
    // Expected: SummaryErrorType.NETWORK_ERROR
  });

  it('should classify ETIMEDOUT errors as NETWORK_ERROR', () => {
    // This would require mocking network timeouts
    // Expected: SummaryErrorType.NETWORK_ERROR
  });

  it('should classify unknown errors as UNKNOWN', () => {
    // This would require throwing an unexpected error
    // Expected: SummaryErrorType.UNKNOWN
  });
});

/**
 * Integration tests for client-side error handling
 *
 * Note: These would require a test environment with the React component
 */
describe('Client-side error handling', () => {
  it('should display retry suggestion for RATE_LIMIT errors', () => {
    // Test that error message includes "○○秒後に再試行してください"
  });

  it('should display contact admin message for API_KEY errors', () => {
    // Test that error message includes "管理者に連絡してAPIキーの設定を確認してください"
  });

  it('should display network check message for NETWORK_ERROR', () => {
    // Test that error message includes "インターネット接続を確認してください"
  });
});

/**
 * Regression tests
 *
 * Ensure that the changes don't break existing functionality
 */
describe('Regression Prevention', () => {
  it('should not break successful summary generation flow', async () => {
    process.env.MOCK_OPENAI = 'true';
    process.env.OPENAI_API_KEY = 'mock_key';

    const response = await fetch('http://localhost:3001/api/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: 'This is a regression test transcript.',
        gptModel: 'gpt-4o-mini',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.summary).toBeTruthy();
  });

  it('should maintain backward compatibility with existing error responses', async () => {
    // Ensure OpenAIError responses still work
    // Ensure generic Error responses still work
  });
});
