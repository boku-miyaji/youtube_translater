# Issue #18 YouTube動画とアップロードファイルの判別修正

## 問題
MOV/MP4形式の動画ファイルを解析した後、再生時にYouTube動画として扱われ、存在しないYouTube IDで再生しようとしていた。

## 原因
履歴データから動画を再生する際、以下の問題があった：
1. HistoryTableとDashboardPageで、アップロードファイルのfileIdがvideoIdとして設定されていた
2. YouTube動画とアップロードファイルを区別する処理がなかった
3. 結果として、アップロードファイルもYouTubeプレーヤーで再生しようとしていた

## 実装内容

### 1. AnalyzePage.tsx（line 380, 390）
```typescript
// YouTube動画の場合のみvideoIdを設定
videoId: (inputType === 'url' && data.metadata?.basic?.videoId) ? data.metadata.basic.videoId : undefined,
// アップロードファイルの場合はvideoPathを設定
videoPath: (inputType === 'file' || data.source === 'file') ? (data.metadata?.basic?.videoPath || data.videoPath) : undefined
```

### 2. HistoryTable.tsx（line 148-159）
```typescript
// URLから動画タイプを判定
const isYouTubeVideo = video.url && (video.url.includes('youtube.com') || video.url.includes('youtu.be'));
const isUploadedFile = video.url && video.url.startsWith('file://');

// YouTube動画の場合のみvideoIdを設定
videoId: isYouTubeVideo ? (video.videoId || video.id || video.metadata?.basic?.videoId || '') : undefined,
// アップロードファイルの場合はvideoPathを設定
videoPath: isUploadedFile ? video.metadata?.basic?.videoPath : undefined,
```

### 3. DashboardPage.tsx（line 135-146）
同様の修正を実施

## 技術的詳細

### URL判定ロジック
- **YouTube動画**: URLに`youtube.com`または`youtu.be`が含まれる
- **アップロードファイル**: URLが`file://`で始まる（例：`file://example.mov`）

### プレーヤー選択
- **videoId**が存在する場合: YouTube iframe player
- **videoPath**が存在する場合: HTML5 video element
- 両方存在しない場合: エラー表示

## 効果
- アップロードした動画ファイルが正しくHTML5プレーヤーで再生される
- YouTube動画は従来通りYouTubeプレーヤーで再生される
- 履歴から動画を選択した場合も正しいプレーヤーが使用される

## 実装の工夫
- 既存のデータ構造を変更せず、判定ロジックの追加のみで対応
- URLベースの判定により、確実に動画タイプを識別
- 後方互換性を維持（既存のデータも正しく処理される）