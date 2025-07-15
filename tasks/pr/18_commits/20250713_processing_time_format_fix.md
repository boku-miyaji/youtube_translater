# Issue #18 処理時間表示フォーマット修正

## 問題
1. 文字起こし速度が「8.0x速」などと表示され、意味がわからない
2. 要約生成速度が「分/分」と表示され、意味がわからない

## 原因分析
server.tsの`calculateProcessingTime`関数で以下の問題があった：

1. **文字起こし速度**：
   - 処理時間が実時間より短い場合（`transcriptionMinutesPerVideoMinute < 1`）、倍速表示（例：8.0x速）
   - 処理時間が実時間より長い場合、「分/分」形式で表示

2. **要約生成速度**：
   - 常に「分/分」形式で表示（例：0.50分/分）
   - 単位が直感的でない

## 実装内容

### 1. server.ts（line 429-431, 449-451）
処理時間の表示形式を「秒/分」に統一：

```typescript
// 変更前
// Calculate transcription rate
const transcriptionMinutesPerVideoMinute = (transcriptionTime / 60) / durationMinutes;
let transcriptionRate: string;
if (transcriptionMinutesPerVideoMinute < 1) {
  // If processing is faster than real-time, show as "Xx速"
  const speedMultiplier = 1 / transcriptionMinutesPerVideoMinute;
  transcriptionRate = `${speedMultiplier.toFixed(1)}x速`;
} else {
  // Show as minutes per video minute
  transcriptionRate = `${transcriptionMinutesPerVideoMinute.toFixed(2)}分/分`;
}

// 変更後
// Calculate transcription rate (seconds per video minute)
const transcriptionSecondsPerVideoMinute = transcriptionTime / durationMinutes;
const transcriptionRate = `${transcriptionSecondsPerVideoMinute.toFixed(1)}秒/分`;
```

同様に要約生成速度も修正：
```typescript
// 変更前
const summaryMinutesPerVideoMinute = (summaryTime / 60) / durationMinutes;
const summaryRate = `${summaryMinutesPerVideoMinute.toFixed(2)}分/分`;

// 変更後
const summarySecondsPerVideoMinute = summaryTime / durationMinutes;
const summaryRate = `${summarySecondsPerVideoMinute.toFixed(1)}秒/分`;
```

### 2. types/index.ts（line 400-401, 426-427）
型定義のコメントを更新：
```typescript
// 変更前
transcriptionRate?: string;  // e.g., "10x速" or "0.1分/分"
summaryRate?: string;        // e.g., "0.5分/分"

// 変更後
transcriptionRate?: string;  // e.g., "30.0秒/分"
summaryRate?: string;        // e.g., "60.0秒/分"
```

## 効果
- 処理時間の表示が統一され、「動画1分あたり○秒で処理」という直感的な表現になった
- 「8.0x速」のような分かりにくい表現を排除
- 「分/分」という単位の混乱を解消

## 表示例
- 変更前：「文字起こし速度: 8.0x速」「要約生成速度: 0.50分/分」
- 変更後：「文字起こし速度: 7.5秒/分」「要約生成速度: 30.0秒/分」

## コミット
- `fix: Improve processing time display format to be more intuitive`