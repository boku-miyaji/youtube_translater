# Issue #18 動画ファイルのタイムスタンプ対応

## 問題
MOV/MP4形式の動画ファイルの文字起こしでタイムスタンプが付与されず、単なる文字列の羅列になっていた。YouTube動画の解析では適切にタイムスタンプが付与されているのに対し、動画ファイルでは機能していなかった。

## 原因
GPT-4o-transcribeおよびGPT-4o-mini-transcribeモデルは、OpenAI APIの仕様上`timestamp_granularities`パラメータをサポートしていない。このパラメータは`verbose_json`レスポンスフォーマットでのみ利用可能で、GPT-4oモデルは`json`フォーマットしかサポートしていない。

## 実装内容

### 1. transcribeVideoFile関数の修正（src/server.ts:289-299）
```typescript
// GPT-4oモデルが選択されている場合、whisper-1を強制使用
const actualModel = (transcriptionModel === 'gpt-4o-transcribe' || transcriptionModel === 'gpt-4o-mini-transcribe') 
  ? 'whisper-1' 
  : transcriptionModel;

if (actualModel !== transcriptionModel) {
  console.log(`⚠️ Using whisper-1 instead of ${transcriptionModel} to ensure timestamp support for video files`);
}
```

### 2. transcribeAudio関数の修正（src/server.ts:1009-1015）
同様の処理を追加し、タイムスタンプが必要な場合はwhisper-1を使用

### 3. transcribeLargeAudio関数の修正（src/server.ts:1077-1080）
大きなファイルの分割処理でも同様の対応を実装

### 4. コスト計算の修正（src/server.ts:1638-1642）
モデルが強制的に変更された場合、実際に使用されるモデル（whisper-1）のコストで計算するよう修正

## 技術的詳細

### OpenAI API仕様の制約
- **Whisper-1**: `verbose_json`フォーマットをサポート、`timestamp_granularities`利用可能
- **GPT-4o系**: `json`または`text`フォーマットのみサポート、タイムスタンプ機能なし

### 対応方針
1. 動画ファイルの文字起こしではタイムスタンプが重要（再生位置との連携のため）
2. GPT-4oモデルが選択されても、自動的にwhisper-1に切り替えて処理
3. ユーザーにはコンソールログで通知
4. コスト計算は実際に使用されるモデルで行う

## 効果
- MOV/MP4ファイルでもYouTube動画と同様にタイムスタンプ付き文字起こしが可能
- TranscriptViewerコンポーネントでタイムスタンプをクリックして再生位置にジャンプ可能
- 動画視聴体験の一貫性を確保