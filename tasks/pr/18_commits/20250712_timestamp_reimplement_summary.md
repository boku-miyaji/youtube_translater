# Issue #18 4-reimplement実行結果（タイムスタンプ対応）

## 実装概要
MOV/MP4形式の動画ファイルの文字起こしにタイムスタンプを付与する機能を実装しました。

## 課題
- 動画ファイルの文字起こしでタイムスタンプが表示されない
- YouTube動画では正常にタイムスタンプが付与される
- TranscriptViewerコンポーネントでタイムスタンプセグメントが空になっていた

## 原因分析
1. GPT-4o-transcribeモデルは`timestamp_granularities`パラメータをサポートしていない
2. タイムスタンプ取得には`verbose_json`レスポンスフォーマットが必要
3. GPT-4oモデルは`json`フォーマットのみサポート

## 実装内容

### 1. モデル自動切り替え機能（src/server.ts）
GPT-4oモデルが選択された場合、自動的にwhisper-1に切り替える処理を追加：

```typescript
const actualModel = (transcriptionModel === 'gpt-4o-transcribe' || transcriptionModel === 'gpt-4o-mini-transcribe') 
  ? 'whisper-1' 
  : transcriptionModel;
```

### 2. 対象関数
- `transcribeVideoFile`: 動画ファイル処理
- `transcribeAudio`: 音声ファイル処理
- `transcribeLargeAudio`: 大容量ファイル処理

### 3. コスト計算の調整
実際に使用されるモデル（whisper-1）のコストで計算するよう修正

## 技術的な工夫
1. **ユーザー体験の維持**: モデル選択UIはそのまま維持し、内部で自動切り替え
2. **透明性の確保**: コンソールログでモデル切り替えを通知
3. **一貫性の確保**: YouTube動画と同じタイムスタンプ体験を提供

## 結果
- 動画ファイルでもタイムスタンプ付き文字起こしが正常に動作
- TranscriptViewerでタイムスタンプクリックによる再生位置ジャンプが可能
- コスト計算も正確に反映

## コミット履歴
1. `60c7a92`: feat: Ensure timestamp support for video file transcriptions
2. `857d1a4`: docs: Add timestamp support implementation documentation