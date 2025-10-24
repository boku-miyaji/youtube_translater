# Design Document: Fix Cost and Time Calculation Issues

**Issue**: #23
**Title**: Fix cost and time calculation issues
**Type**: Bug
**Created**: 2025-10-24

## 📋 Issue Description

```
料金計算と時間計算修正。
料金：chatした時にかかった料金も表示
時間：pdfの計算時間が全く正しくない。
```

### Problem Summary
1. **Cost Calculation**: Chat usage costs are not being displayed
2. **Time Calculation**: PDF processing time calculation is completely incorrect

---

## 🔍 Requirements Analysis

### Current Issues

#### 1. Chat Cost Display Issue
**Problem**: チャット機能を使用した際の料金が表示されていない

**Expected Behavior**:
- ユーザーがチャットでAIと対話した際のAPI使用料金を表示
- 累積コストとセッションごとのコストを分けて表示
- リアルタイムでコスト更新

**Current Behavior**:
- チャットコストが計算されていない、または表示されていない可能性
- コスト情報がUIに反映されていない

#### 2. PDF Time Calculation Issue
**Problem**: PDFの処理時間計算が全く正しくない

**Expected Behavior**:
- PDF extraction時間の正確な計測
- PDF summary生成時間の正確な計測
- 合計処理時間の正確な表示

**Current Behavior**:
- 処理時間が不正確（おそらく0秒表示や「計測中...」のまま）
- タイムスタンプの記録または計算に問題がある可能性

---

## 🏗️ Technical Design

### 1. Cost Calculation Architecture

#### Current Cost Structure Investigation

Based on the codebase analysis, costs are tracked in:
- `src/types/index.ts`: `CostBreakdown` interface
- Server responses include `costs` object
- Frontend displays costs in various components

**Root Cause Analysis**:

**Hypothesis 1**: Chat API costs not being tracked in session
- Server `/api/chat` endpoint may not be returning cost information
- Frontend may not be accumulating chat costs

**Hypothesis 2**: Cost state management issue
- Cost updates from chat may not trigger re-renders
- State might be reset incorrectly

**Hypothesis 3**: Display logic issue
- Chat costs might be calculated but not shown in UI
- Conditional rendering might hide cost information

#### Proposed Solution

##### Backend Changes (src/server.ts)

1. **Chat Endpoint Cost Tracking**
```typescript
// Ensure /api/chat endpoint calculates and returns costs
app.post('/api/chat', async (req, res) => {
  // ... existing chat logic

  // Calculate API cost
  const promptTokens = /* count tokens in prompt */
  const completionTokens = /* count tokens in completion */
  const cost = calculateCost(promptTokens, completionTokens, model)

  // Add to session costs
  if (req.session.costs) {
    req.session.costs.chat = (req.session.costs.chat || 0) + cost
    req.session.costs.total = (req.session.costs.total || 0) + cost
  }

  res.json({
    success: true,
    response: aiResponse,
    cost: cost,  // Individual message cost
    costs: req.session.costs  // Cumulative costs
  })
})
```

2. **Cost Calculation Function Enhancement**
```typescript
function calculateCost(
  promptTokens: number,
  completionTokens: number,
  model: string
): number {
  const pricing = {
    'gpt-4': { prompt: 0.03, completion: 0.06 },
    'gpt-3.5-turbo': { prompt: 0.0015, completion: 0.002 },
    // ... other models
  }

  const rates = pricing[model] || pricing['gpt-3.5-turbo']
  return (promptTokens / 1000 * rates.prompt) +
         (completionTokens / 1000 * rates.completion)
}
```

##### Frontend Changes

1. **ChatInterface Component Enhancement**
```typescript
// src/components/shared/ChatInterface.tsx

interface ChatInterfaceProps {
  // ... existing props
  onCostUpdate?: (cost: number) => void
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  // ... existing props
  onCostUpdate
}) => {
  const [sessionCosts, setSessionCosts] = useState<CostBreakdown>({
    transcription: 0,
    summary: 0,
    article: 0,
    chat: 0,
    total: 0
  })

  const sendMessage = async () => {
    // ... existing logic

    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, videoId })
    })

    const data = await response.json()

    // Update costs
    if (data.costs) {
      setSessionCosts(data.costs)
      onCostUpdate?.(data.cost)
    }
  }

  return (
    <div>
      {/* Chat UI */}

      {/* Cost Display */}
      {sessionCosts.chat > 0 && (
        <div className="text-xs text-gray-500 mt-2">
          💬 Chat cost: ${sessionCosts.chat.toFixed(4)}
        </div>
      )}
    </div>
  )
}
```

2. **AnalyzePage Cost Display Update**
```typescript
// src/components/pages/AnalyzePage.tsx

// Add chat cost to total cost display
const totalCost = (currentVideo?.costs?.total || 0)

<div className="cost-summary">
  <div>Transcription: ${costs.transcription.toFixed(4)}</div>
  <div>Summary: ${costs.summary.toFixed(4)}</div>
  <div>Article: ${costs.article.toFixed(4)}</div>
  <div>Chat: ${costs.chat.toFixed(4)}</div>  {/* NEW */}
  <div className="font-bold">Total: ${costs.total.toFixed(4)}</div>
</div>
```

### 2. Time Calculation Architecture

#### Current Time Tracking Investigation

Based on Issue #20 and #21 commits, time calculation for PDF was previously problematic:
- `analysisTime` object tracks extraction and summary times
- PDF-specific timing was added in previous fixes
- Issue: Times might not be calculated or displayed correctly

**Root Cause Analysis**:

**Hypothesis 1**: PDF timing data not captured
- Server might not be recording start/end times for PDF processing
- Timestamps might be missing in response

**Hypothesis 2**: Time calculation logic error
- Duration calculation might be incorrect (unit mismatch: ms vs s)
- Zero or negative durations not handled

**Hypothesis 3**: Display logic issue
- Times might be calculated but display shows "計測中..." indefinitely
- Conditional rendering might not update after data arrives

#### Proposed Solution

##### Backend Changes (src/server.ts)

1. **PDF Endpoint Time Tracking Enhancement**
```typescript
// /api/analyze-pdf endpoint
app.post('/api/analyze-pdf', async (req, res) => {
  const startTime = Date.now()

  try {
    // PDF Extraction
    const extractionStart = Date.now()
    const pdfContent = await extractPdfText(file)
    const extractionEnd = Date.now()
    const extractionTime = (extractionEnd - extractionStart) / 1000 // seconds

    // Summary Generation
    const summaryStart = Date.now()
    const summary = await generateSummary(pdfContent.fullText)
    const summaryEnd = Date.now()
    const summaryTime = (summaryEnd - summaryStart) / 1000 // seconds

    const totalTime = (Date.now() - startTime) / 1000

    res.json({
      success: true,
      transcript: pdfContent.fullText,
      summary: summary,
      analysisTime: {
        extraction: extractionTime,
        summary: summaryTime,
        total: totalTime
      },
      // Ensure all timestamp fields are present
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString()
    })
  } catch (error) {
    // ... error handling
  }
})
```

2. **Time Validation Utility**
```typescript
function validateAnalysisTime(time: AnalysisTime): AnalysisTime {
  // Ensure all values are positive numbers
  return {
    extraction: Math.max(0, time.extraction || 0),
    summary: Math.max(0, time.summary || 0),
    total: Math.max(0, time.total || 0)
  }
}
```

##### Frontend Changes

1. **AnalyzePage Time Display Logic Fix**
```typescript
// src/components/pages/AnalyzePage.tsx

const getDisplayTime = (video: any): string => {
  // Handle PDF content
  if (isPdfContent(video)) {
    const analysisTime = video.analysisTime

    // Validate time data exists and is valid
    if (!analysisTime) {
      return '計測データなし'
    }

    const total = analysisTime.total ||
                  (analysisTime.extraction || 0) + (analysisTime.summary || 0)

    if (total <= 0) {
      return '計測エラー'
    }

    return formatProcessingTime(total)
  }

  // Handle video/audio content
  // ... existing logic
}

// Ensure formatProcessingTime handles edge cases
function formatProcessingTime(seconds: number): string {
  if (!seconds || seconds <= 0) {
    return '計測エラー'
  }

  if (seconds < 60) {
    return `${seconds.toFixed(1)}秒`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}分${remainingSeconds}秒`
}
```

2. **Add Debug Logging (Temporary)**
```typescript
useEffect(() => {
  if (currentVideo) {
    console.log('📊 Processing Time Debug:', {
      isPdf: isPdfContent(currentVideo),
      analysisTime: currentVideo.analysisTime,
      calculated: getDisplayTime(currentVideo)
    })
  }
}, [currentVideo])
```

---

## 🧪 Testing Strategy

### Test Cases for Cost Calculation

#### Unit Tests
```typescript
// tests/server/chat-cost-calculation.test.ts

describe('Chat Cost Calculation', () => {
  test('should calculate cost for GPT-3.5-turbo correctly', () => {
    const cost = calculateCost(100, 200, 'gpt-3.5-turbo')
    expect(cost).toBeCloseTo(0.00055) // (100/1000)*0.0015 + (200/1000)*0.002
  })

  test('should accumulate chat costs in session', async () => {
    const session = { costs: { chat: 0.001, total: 0.01 } }
    const newCost = 0.0005

    // Simulate adding new chat cost
    session.costs.chat += newCost
    session.costs.total += newCost

    expect(session.costs.chat).toBe(0.0015)
    expect(session.costs.total).toBe(0.0105)
  })
})
```

#### Integration Tests
```typescript
// tests/api/chat-cost-tracking.test.ts

describe('Chat API Cost Tracking', () => {
  test('should return cost in chat response', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({ message: 'test', videoId: '123' })

    expect(response.body).toHaveProperty('cost')
    expect(response.body).toHaveProperty('costs')
    expect(response.body.costs).toHaveProperty('chat')
    expect(typeof response.body.cost).toBe('number')
  })
})
```

#### Manual Test Cases
1. **Chat Cost Display**
   - [ ] Open analyze page with processed video
   - [ ] Send multiple chat messages
   - [ ] Verify chat cost appears and increases
   - [ ] Verify total cost includes chat cost
   - [ ] Refresh page and verify costs persist

### Test Cases for Time Calculation

#### Unit Tests
```typescript
// tests/utils/time-calculation.test.ts

describe('Time Calculation', () => {
  test('should format time correctly for seconds', () => {
    expect(formatProcessingTime(45)).toBe('45.0秒')
  })

  test('should format time correctly for minutes', () => {
    expect(formatProcessingTime(125)).toBe('2分5秒')
  })

  test('should handle zero time', () => {
    expect(formatProcessingTime(0)).toBe('計測エラー')
  })

  test('should handle negative time', () => {
    expect(formatProcessingTime(-10)).toBe('計測エラー')
  })
})

describe('PDF Time Validation', () => {
  test('should validate and correct invalid times', () => {
    const input = { extraction: -1, summary: 5, total: 0 }
    const result = validateAnalysisTime(input)

    expect(result.extraction).toBe(0)
    expect(result.summary).toBe(5)
    expect(result.total).toBe(0)
  })
})
```

#### Integration Tests
```typescript
// tests/api/pdf-time-tracking.test.ts

describe('PDF Time Tracking', () => {
  test('should return valid analysis time for PDF', async () => {
    const response = await request(app)
      .post('/api/analyze-pdf')
      .attach('file', 'test.pdf')

    expect(response.body).toHaveProperty('analysisTime')
    expect(response.body.analysisTime).toHaveProperty('extraction')
    expect(response.body.analysisTime).toHaveProperty('summary')
    expect(response.body.analysisTime).toHaveProperty('total')

    // All times should be positive
    expect(response.body.analysisTime.extraction).toBeGreaterThan(0)
    expect(response.body.analysisTime.summary).toBeGreaterThan(0)
    expect(response.body.analysisTime.total).toBeGreaterThan(0)
  })
})
```

#### Manual Test Cases
1. **PDF Time Display**
   - [ ] Upload PDF file
   - [ ] Verify extraction time appears (not "計測中...")
   - [ ] Verify summary time appears
   - [ ] Verify total time is sum of extraction + summary
   - [ ] Refresh page and verify times still display correctly
   - [ ] Check Analysis History for correct time display

2. **Video/Audio Time (Regression)**
   - [ ] Process YouTube video
   - [ ] Process audio file
   - [ ] Verify times still display correctly (no regression)

---

## 🔒 Security Considerations

### Cost Calculation Security

1. **Cost Validation**
   - Validate all cost values are non-negative
   - Prevent cost manipulation from client side
   - Server-side cost calculation only

2. **Session Cost Limit**
   - Consider implementing maximum cost per session
   - Alert users when approaching cost limits

### Time Calculation Security

1. **Timestamp Validation**
   - Ensure timestamps are valid dates
   - Handle timezone correctly (UTC)
   - Prevent negative durations

---

## ⚡ Performance Considerations

### Cost Calculation Performance

1. **Token Counting Efficiency**
   - Use efficient tokenization library
   - Cache token counts where possible
   - Avoid re-counting for the same text

2. **Cost Storage**
   - Store costs in session (already implemented)
   - Avoid unnecessary database writes
   - Use in-memory session storage

### Time Calculation Performance

1. **Timestamp Recording**
   - Use `Date.now()` for millisecond precision
   - Minimal overhead for timestamp recording
   - No external dependencies needed

2. **Display Updates**
   - Avoid re-calculating on every render
   - Use memoization for formatted time strings
   - Only update when underlying data changes

---

## 🚧 Implementation Plan

### Phase 1: Investigation & Debugging (Priority: HIGH)

1. **Add Debug Logging**
   - Log cost calculations in `/api/chat`
   - Log time calculations in `/api/analyze-pdf`
   - Log what data is being sent to frontend
   - Identify exact point of failure

2. **Reproduce Issues**
   - Test chat functionality and check console for cost data
   - Test PDF upload and check console for time data
   - Document exact behavior vs. expected behavior

### Phase 2: Cost Calculation Fix (Priority: HIGH)

1. **Backend Changes**
   - Update `/api/chat` endpoint to return costs
   - Ensure session cost accumulation
   - Add token counting if missing

2. **Frontend Changes**
   - Update ChatInterface to display costs
   - Update AnalyzePage to show chat costs in summary
   - Add cost state management

3. **Testing**
   - Write unit tests for cost calculation
   - Test chat cost accumulation
   - Verify UI displays costs correctly

### Phase 3: Time Calculation Fix (Priority: HIGH)

1. **Backend Changes**
   - Verify timestamp recording in `/api/analyze-pdf`
   - Add time validation
   - Ensure all time fields are populated

2. **Frontend Changes**
   - Fix `getDisplayTime()` logic for PDF
   - Add fallback for missing time data
   - Update `formatProcessingTime()` edge cases

3. **Testing**
   - Write unit tests for time formatting
   - Test PDF time display
   - Verify no regression for video/audio

### Phase 4: Clean Up & Documentation (Priority: MEDIUM)

1. **Remove Debug Logging**
   - Remove temporary console.log statements
   - Keep only essential logging

2. **Update Documentation**
   - Document cost calculation flow
   - Document time tracking implementation
   - Update README if needed

---

## ❓ Unresolved Design Questions

### Cost Calculation

1. **Q**: Should we display per-message cost or only cumulative cost?
   **A**: Display both - per-message for transparency, cumulative for total tracking

2. **Q**: Should chat costs persist across page refreshes?
   **A**: Yes, using session storage (already implemented for other costs)

3. **Q**: Should we add cost warnings/limits?
   **A**: Out of scope for this bug fix, but good for future enhancement

### Time Calculation

1. **Q**: What should we display if time data is missing?
   **A**: "計測データなし" instead of "計測中..." to indicate data issue

2. **Q**: Should we validate time ranges (e.g., max processing time)?
   **A**: Yes, add sanity check (e.g., flag if >10 minutes)

3. **Q**: How to handle timezone display?
   **A**: Use UTC internally, display in user's local timezone

---

## 📊 Success Metrics

### Cost Calculation
- ✅ Chat costs display correctly in UI
- ✅ Costs accumulate properly across multiple messages
- ✅ Total cost includes all components (transcription + summary + article + chat)
- ✅ No console errors related to cost calculation

### Time Calculation
- ✅ PDF processing time displays actual values (not "計測中...")
- ✅ Time values are logical (extraction + summary ≈ total)
- ✅ No "計測エラー" for valid PDF processing
- ✅ Times persist correctly after page refresh

---

## 🔗 Related Issues & PRs

- **Related to Issue #20**: PDF processing and time display issues
- **Related to Issue #21**: Content-type aware UI (may affect display logic)
- **Previous commits**: Multiple fixes for PDF time calculation

---

## 📝 Notes

- This is a critical bug affecting user experience and transparency
- Both issues impact core functionality (cost tracking and time display)
- Fixes should be tested thoroughly to avoid regression
- Consider adding automated tests to prevent future issues
