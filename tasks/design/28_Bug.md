---
issue: 28
title: 'fix: improve error handling in /api/summarize endpoint'
type: Bug
description: |
  /api/summarize エンドポイントのエラーハンドリングが不適切で、実際のエラー原因がユーザーに伝わらない。
  エラー発生時に適切なエラーメッセージとステータスコードを返すよう改善する。
---

# Design Document: Improve Error Handling in /api/summarize Endpoint

## Overview

The `/api/summarize` endpoint currently has inadequate error handling that obscures the actual error causes from users. When `generateSummary()` function encounters an error, it returns `null`, which leads to a generic "API rate limit reached" message being sent to the client, regardless of the actual error cause.

## Problem Analysis

### Current Issues

1. **Loss of Error Information in `generateSummary()` (server.ts:1760-1764)**
   ```typescript
   } catch (error) {
     console.error('❌ === generateSummary ERROR ===');
     console.error('  - Error type:', error?.constructor?.name);
     console.error('  - Error message:', error?.message);
     console.error('  - Full error:', error);
     return null;  // ← Error information is lost here
   }
   ```
   - The function catches all errors and returns `null`
   - Error details are logged but not propagated to the caller
   - Caller cannot distinguish between different error types

2. **Inaccurate Error Response in `/api/summarize` Endpoint (server.ts:4430-4435)**
   ```typescript
   if (!summary) {
     console.error('❌ generateSummary returned null');
     return res.status(503).json({
       error: '⚠️ 要約の生成に失敗しました。APIの利用制限に達している可能性があります。'
     });
   }
   ```
   - Always returns "API rate limit" message when `generateSummary` returns `null`
   - Actual causes (network errors, configuration issues, OpenAI API errors) are hidden
   - Status code 503 is not always appropriate

3. **Client-Side Error Handling (TranscriptViewer.tsx:53-64)**
   ```typescript
   if (!response.ok) {
     const errorText = await response.text()
     console.error('Summary generation failed:', response.status, errorText)
     throw new Error(`Failed to generate summary: ${response.status} ${response.statusText}`)
   }
   ```
   - Displays server error message directly in alert
   - No user-friendly error recovery options
   - No differentiation based on error type

4. **Browser Extension Conflict**
   - Error message: "Unchecked runtime.lastError: The message port closed before a response was received"
   - This indicates potential browser extension interference or response timeout

### Root Causes

1. **Swallowed Exceptions**: `generateSummary` catches all errors but doesn't re-throw them
2. **Insufficient Error Classification**: No distinction between different error types
3. **Generic Error Messages**: Users receive misleading messages
4. **Poor Error Propagation**: Error context is lost between layers

## Technical Design

### 1. Enhanced Error Classification

Define specific error types for better error handling:

```typescript
// Error types for better classification
enum SummaryErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  API_KEY_MISSING = 'API_KEY_MISSING',
  API_KEY_INVALID = 'API_KEY_INVALID',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MODEL_ERROR = 'MODEL_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

// Extended OpenAIError with error type classification
class SummaryError extends OpenAIError {
  errorType: SummaryErrorType;
  originalError?: Error;

  constructor(
    message: string,
    statusCode: number,
    errorType: SummaryErrorType,
    originalError?: Error
  ) {
    super(message, statusCode, errorType);
    this.errorType = errorType;
    this.originalError = originalError;
  }
}
```

### 2. Improved `generateSummary()` Error Handling

Modify the error handling to properly classify and propagate errors:

```typescript
async function generateSummary(
  /* ... parameters ... */
): Promise<Summary> {  // Changed: no longer returns null
  console.log('🎯 === generateSummary DEBUG START ===');
  // ... existing code ...

  try {
    // ... existing summary generation logic ...

    return summary;

  } catch (error) {
    console.error('❌ === generateSummary ERROR ===');
    console.error('  - Error type:', error?.constructor?.name);
    console.error('  - Error message:', error?.message);
    console.error('  - Full error:', error);

    // Classify and re-throw error with appropriate type
    if (error instanceof OpenAIError) {
      // Already a properly classified error
      throw error;
    }

    // Check for specific OpenAI API errors
    if (error?.response?.status === 429) {
      throw new SummaryError(
        '⚠️ OpenAI API の利用制限に達しています。しばらく待ってから再試行してください。',
        429,
        SummaryErrorType.RATE_LIMIT,
        error as Error
      );
    }

    if (error?.response?.status === 401) {
      throw new SummaryError(
        '⚠️ OpenAI API キーが無効です。設定を確認してください。',
        401,
        SummaryErrorType.API_KEY_INVALID,
        error as Error
      );
    }

    if (error?.response?.status === 400) {
      throw new SummaryError(
        '⚠️ リクエストが無効です。入力内容を確認してください。',
        400,
        SummaryErrorType.INVALID_REQUEST,
        error as Error
      );
    }

    // Network errors
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
      throw new SummaryError(
        '⚠️ ネットワークエラーが発生しました。接続を確認してください。',
        503,
        SummaryErrorType.NETWORK_ERROR,
        error as Error
      );
    }

    // Generic error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new SummaryError(
      `⚠️ 要約の生成中にエラーが発生しました: ${errorMessage}`,
      500,
      SummaryErrorType.UNKNOWN,
      error as Error
    );
  }
}
```

### 3. Updated `/api/summarize` Endpoint

Remove the null check and let errors propagate to the catch block:

```typescript
app.post('/api/summarize', async (req: Request, res: Response) => {
  console.log('📝 === /api/summarize REQUEST ===');
  console.log('  - Has transcript:', !!req.body.transcript);
  console.log('  - Transcript length:', req.body.transcript?.length || 0);
  console.log('  - GPT Model:', req.body.gptModel || 'gpt-4o-mini');

  try {
    const { transcript, gptModel = 'gpt-4o-mini', contentType, analysisType } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY is not configured');
      return res.status(503).json({
        error: '⚠️ OpenAI APIが設定されていません。管理者にお問い合わせください。',
        errorType: SummaryErrorType.API_KEY_MISSING
      });
    }

    // Determine content type
    let detectedContentType: 'youtube' | 'pdf' | 'audio' = 'youtube';
    if (contentType) {
      detectedContentType = contentType;
    } else if (analysisType === 'pdf') {
      detectedContentType = 'pdf';
    } else if (analysisType === 'audio') {
      detectedContentType = 'audio';
    }

    console.log('📝 Detected content type:', detectedContentType);

    // Generate summary (no longer returns null)
    const summary = await generateSummary(
      transcript,
      null,
      gptModel,
      [],
      detectedContentType
    );

    console.log('✅ Summary generated successfully');
    res.json({
      success: true,
      summary: summary.content,
      cost: summary.cost || 0
    });

  } catch (error) {
    console.error('❌ Error in /api/summarize:', error);
    console.error('  - Error type:', error?.constructor?.name);
    console.error('  - Error message:', error?.message);

    // Handle SummaryError with detailed error type
    if (error instanceof SummaryError) {
      console.log('  - Returning SummaryError with status:', error.statusCode);
      console.log('  - Error type:', error.errorType);
      return res.status(error.statusCode).json({
        error: error.message,
        errorType: error.errorType,
        // Include retry suggestion for rate limits
        retryAfter: error.errorType === SummaryErrorType.RATE_LIMIT ? 60 : undefined
      });
    }

    // Handle OpenAIError (backward compatibility)
    if (error instanceof OpenAIError) {
      console.log('  - Returning OpenAIError with status:', error.statusCode);
      return res.status(error.statusCode).json({
        error: error.message,
        errorType: SummaryErrorType.UNKNOWN
      });
    }

    // Generic error fallback
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary';
    console.log('  - Returning generic error');
    return res.status(500).json({
      error: `⚠️ ${errorMessage}`,
      errorType: SummaryErrorType.UNKNOWN
    });
  }
});
```

### 4. Client-Side Error Handling Improvements

Update `TranscriptViewer.tsx` to handle different error types:

```typescript
const generateSummary = async () => {
  if (!transcript) return

  setLoadingSummary(true)
  try {
    const response = await fetch('/api/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
        analysisType: analysisType || 'youtube'
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      console.error('Summary generation failed:', response.status, errorData)

      // Handle specific error types
      const errorType = errorData.errorType
      let userMessage = errorData.error || 'Failed to generate summary'

      // Add user-friendly instructions based on error type
      if (errorType === 'RATE_LIMIT') {
        const retryAfter = errorData.retryAfter || 60
        userMessage += `\n\n${retryAfter}秒後に再試行してください。`
      } else if (errorType === 'API_KEY_MISSING' || errorType === 'API_KEY_INVALID') {
        userMessage += '\n\n管理者に連絡してAPIキーの設定を確認してください。'
      } else if (errorType === 'NETWORK_ERROR') {
        userMessage += '\n\nインターネット接続を確認してください。'
      }

      throw new Error(userMessage)
    }

    const data = await response.json()
    setSummary(data.summary)
  } catch (error) {
    console.error('Error generating summary:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    alert(`要約の生成に失敗しました:\n\n${errorMessage}`)
  } finally {
    setLoadingSummary(false)
  }
}
```

### 5. Logging and Monitoring Improvements

Add structured logging for better debugging:

```typescript
// Add to error handling in generateSummary
console.error('❌ === generateSummary ERROR ===');
console.error({
  timestamp: new Date().toISOString(),
  errorType: error?.constructor?.name,
  errorMessage: error?.message,
  errorCode: error?.code,
  statusCode: error?.response?.status,
  stack: error?.stack,
  context: {
    transcriptLength: transcript?.length || 0,
    gptModel,
    contentType
  }
});
```

## Data Models

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;               // User-friendly error message
  errorType: SummaryErrorType; // Classified error type
  retryAfter?: number;         // Seconds to wait before retry (for rate limits)
  details?: string;            // Additional technical details (optional, for debugging)
}
```

### Success Response Format (unchanged)

```typescript
interface SummaryResponse {
  success: true;
  summary: string;
  cost: number;
}
```

## Test Strategy

### Unit Tests

1. **`generateSummary()` Error Handling**
   - Test error classification for different OpenAI API errors (401, 429, 400, 500)
   - Test network error handling (ECONNREFUSED, ETIMEDOUT)
   - Test generic error fallback
   - Verify error is thrown (not returned as null)

2. **`/api/summarize` Endpoint**
   - Test missing transcript (400)
   - Test missing API key (503)
   - Test successful summary generation
   - Test error propagation from `generateSummary()`
   - Test error response format includes `errorType`

3. **Client-Side Error Handling**
   - Test different error types display appropriate messages
   - Test retry suggestion for rate limit errors
   - Test error fallback for malformed responses

### Integration Tests

1. **End-to-End Error Scenarios**
   - Simulate OpenAI API rate limit (429)
   - Simulate invalid API key (401)
   - Simulate network timeout
   - Verify user sees appropriate error messages

2. **Error Recovery**
   - Test retry after rate limit cooldown
   - Test behavior after fixing API key configuration

### Manual Testing Checklist

- [ ] Trigger rate limit error and verify message
- [ ] Remove API key and verify error message
- [ ] Disconnect network and verify error message
- [ ] Send invalid request and verify error message
- [ ] Verify browser console shows detailed error logs
- [ ] Verify error messages are user-friendly in Japanese

## Security Considerations

1. **Sensitive Information Exposure**
   - Do NOT include API keys in error messages
   - Do NOT expose internal system paths or configuration details
   - Sanitize error messages before sending to client

2. **Error Message Consistency**
   - Ensure error messages don't leak information about system architecture
   - Use generic messages for security-related errors (e.g., "Invalid API key" instead of "API key format incorrect")

## Performance Considerations

1. **Error Response Time**
   - Fast error responses (< 100ms) to avoid timeout issues
   - No unnecessary processing in error paths

2. **Logging Volume**
   - Structured logging to avoid performance overhead
   - Consider log aggregation for production monitoring

## Implementation Plan

### Phase 1: Server-Side Error Handling (High Priority)
1. Define `SummaryErrorType` enum and `SummaryError` class
2. Update `generateSummary()` to classify and throw errors
3. Update `/api/summarize` endpoint to handle new error types
4. Add structured logging

### Phase 2: Client-Side Error Handling (Medium Priority)
1. Update `TranscriptViewer.tsx` to handle error types
2. Improve error messages with actionable instructions
3. Add retry logic for rate limit errors (optional)

### Phase 3: Testing (High Priority)
1. Write unit tests for error classification
2. Write integration tests for end-to-end scenarios
3. Perform manual testing

### Phase 4: Monitoring and Documentation (Low Priority)
1. Add error tracking/monitoring (if applicable)
2. Update API documentation with error codes
3. Create troubleshooting guide for users

## Open Questions

1. Should we add automatic retry logic for transient errors (network timeouts, rate limits)?
2. Should we implement exponential backoff for rate limit errors?
3. Should we add error telemetry/tracking for production monitoring?
4. How should we handle the "runtime.lastError" browser extension conflict?
   - Possible solution: Add timeout handling for fetch requests
   - Possible solution: Document known extension conflicts

## Success Criteria

1. Users receive accurate, actionable error messages
2. Different error types are properly classified
3. Error logs contain sufficient information for debugging
4. No regression in successful summary generation
5. All tests pass
6. Error handling is backward compatible with existing clients

## References

- OpenAI API Error Codes: https://platform.openai.com/docs/guides/error-codes
- HTTP Status Codes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
- Error Handling Best Practices: https://www.rfc-editor.org/rfc/rfc7807
