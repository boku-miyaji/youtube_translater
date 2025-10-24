# 推定時間の精度問題調査

## ユーザーからの報告

> 推定時間はどうやって算出している？かなり実際と違います。

## 現在の推定時間算出方法

### 1. バックエンド (`server.ts` - `calculateProcessingTime()`)

```typescript
function calculateProcessingTime(transcriptionModel, gptModel, durationMinutes, contentType)
```

**優先順位:**
1. **履歴データ** (最優先): 過去の実行データから平均を算出
   - モデル別の統計 (サンプル数 >= 2)
   - 全体の平均 (サンプル数 > 0)
2. **デフォルト係数** (フォールバック): 履歴データがない場合

**デフォルト係数:**
```typescript
const processingSpeed = {
  transcription: {
    'whisper-1': 10,              // 10倍速 (10分の動画を1分で処理)
    'gpt-4o-transcribe': 8,       // 8倍速
    'gpt-4o-mini-transcribe': 12  // 12倍速
  },
  summary: {
    'gpt-4o-mini': 0.5,   // 動画1分あたり0.5分かかる
    'gpt-4o': 0.4,
    'gpt-4-turbo': 0.3,
    'gpt-4': 0.25,
    'gpt-3.5-turbo': 0.6
  }
}
```

### 2. フロントエンド (`AnalyzePage.tsx` - `generateImprovedTimePrediction()`)

**YouTube URL の問題点 (Line 161-162):**
```typescript
// For YouTube, we need to estimate duration or use a default
const estimatedDuration = 300 // Default 5 minutes - could be improved with YouTube API
```

**致命的な問題:**
- YouTube URL の場合、**常に5分と仮定**
- 実際の動画が30分でも1時間でも、5分として計算される
- これが「かなり実際と違う」原因

### 3. 推定時間の流れ

```
ユーザーがURL入力
  ↓
フロントエンド: generateImprovedTimePrediction()
  - YouTube: 5分と仮定 ← 問題！
  - PDF: 10ページと仮定
  - Audio/Video File: 実際の長さを使用
  ↓
UI に推定時間を表示 (不正確)
  ↓
ユーザーが解析開始
  ↓
バックエンド: /api/estimate-cost-url
  - ytdl.getInfo() で実際の動画時間を取得 ← 正確！
  - 正しい推定時間を計算
  ↓
でも、すぐ解析が始まるので、この正確な推定は表示されない可能性
```

## 問題点の詳細

### 問題 1: YouTube URL の仮定が不正確

**現状:**
```typescript
const estimatedDuration = 300 // Always 5 minutes
```

**実際:**
- 10秒のショート動画 → 5分と推定 → 30倍も過大評価
- 1時間の講義動画 → 5分と推定 → 12分の1に過小評価

**影響:**
- ユーザーが表示された推定時間を信頼できない
- 「30秒で終わる」と表示されて実際は10分かかる
- または「5分かかる」と表示されて実際は30秒で終わる

### 問題 2: デフォルト係数が楽観的すぎる

**whisper-1: 10倍速の仮定**
```
10分の動画 → 1分で文字起こし完了
```

**実際の所要時間 (ネットワーク・API遅延含む):**
- Whisper API のレスポンス時間
- ネットワーク遅延
- サーバー負荷
- → 実際は3-5倍速程度かもしれない

**gpt-4o-mini summary: 0.5 係数**
```
10分の動画 → 5分で要約完了
```

**実際:**
- GPT API のレスポンス時間は変動する
- トークン数が多い場合、さらに時間がかかる
- → 実際は 0.8-1.0 かもしれない

### 問題 3: 信頼度が表示されない

**現状:**
```jsx
{processingTime.isHistoricalEstimate && (
  <span>過去の実績から算出</span>
)}
```

**問題:**
- 履歴データがある場合のみバッジ表示
- デフォルト係数使用時に警告なし
- YouTube URL の5分仮定について説明なし
- 信頼度 (confidenceLevel) が UI に表示されない

## 解決策

### 解決策 1: YouTube 動画の実際の長さを事前取得

**Option A: バックエンドで事前に取得**
```typescript
// 新しいエンドポイント
app.post('/api/get-youtube-duration', async (req, res) => {
  const info = await ytdl.getInfo(url);
  return { duration: info.videoDetails.lengthSeconds };
});
```

**Option B: YouTube Data API を使用**
```typescript
// YouTube Data API v3
// より軽量で高速
```

**Option C: フォールバック改善**
```typescript
// 5分固定ではなく、範囲を表示
const estimatedDuration = 300
const estimatedRange = {
  min: 60,  // 1 minute
  max: 600  // 10 minutes
}
// UI: "1-10分の動画として推定"
```

### 解決策 2: デフォルト係数をより保守的に

**現在:**
```typescript
transcription: { 'whisper-1': 10 }  // 10倍速
summary: { 'gpt-4o-mini': 0.5 }     // 0.5係数
```

**推奨:**
```typescript
transcription: { 'whisper-1': 5 }   // 5倍速 (より現実的)
summary: { 'gpt-4o-mini': 0.8 }     // 0.8係数 (より保守的)
```

**理由:**
- 過小評価より過大評価の方がユーザー体験が良い
- 「予想より早く終わった」＞「予想より遅い」

### 解決策 3: 推定精度の明示

**現在:**
```jsx
想定処理時間（概算）
```

**改善案:**
```jsx
想定処理時間（概算）
{!processingTime.isHistoricalEstimate && (
  <span className="text-xs text-orange-600">
    ⚠️ デフォルト値を使用 (参考程度)
  </span>
)}
{inputType === InputType.YOUTUBE_URL && !realDuration && (
  <span className="text-xs text-yellow-600">
    ℹ️ 動画の長さを仮定して算出
  </span>
)}
{processingTime.confidence && (
  <span className="text-xs">
    信頼度: {(processingTime.confidence * 100).toFixed(0)}%
  </span>
)}
```

### 解決策 4: リアルタイム更新

**現在:**
- 解析開始前に推定時間表示
- 解析中は更新されない

**改善案:**
```typescript
// バックエンドから正確な推定が返ってきたら更新
useEffect(() => {
  if (data.estimatedProcessingTime && data.duration) {
    setEstimatedProcessingTime(data.estimatedProcessingTime);
    console.log('📊 Updated estimate with real duration:', data.duration);
  }
}, [analysisResponse]);
```

## 推奨される実装順序

### Phase 1: 即効性のある修正 (今回実装)
1. ✅ デフォルト係数を保守的に調整
2. ✅ 推定精度の警告を UI に追加
3. ✅ YouTube URL の5分仮定を明示

### Phase 2: 精度向上 (次回)
1. YouTube 動画の実際の長さを事前取得
2. より詳細な履歴統計の活用
3. 信頼区間の表示 (例: 3-7分)

### Phase 3: 高度な改善 (将来)
1. 機械学習ベースの推定
2. ユーザー別の統計
3. リアルタイム進捗予測

## 期待される効果

### Before (現状)
```
YouTube 30分動画の場合:
  推定: "約1分30秒" (5分動画として計算、whisper 10倍速仮定)
  実際: "約15分"
  → ユーザー: "全然違う！"
```

### After (修正後)
```
YouTube 30分動画の場合:
  推定: "約3-10分 ⚠️ 動画の長さを仮定して算出"
  実際: "約15分"
  → ユーザー: "まあ範囲内かな"
```

## テスト方法

1. YouTube ショート動画 (10秒) で推定時間を確認
2. YouTube 長尺動画 (1時間) で推定時間を確認
3. PDF (5ページ vs 50ページ) で推定時間を確認
4. 履歴データがない新規環境で推定時間を確認
5. 履歴データがある環境で推定時間を確認
