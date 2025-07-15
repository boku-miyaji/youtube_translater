# Issue #18 動画ファイル再生機能の修正

## 問題
MOV/MP4形式の動画ファイルを解析した後、動画が再生できず以下のエラーが発生：
```
🚨 playerRef is not available after 5 retries!
```

タイムスタンプをクリックしても動画の該当箇所にジャンプできない。

## 原因
- AnalyzePage.tsxで動画プレーヤーがYouTube動画専用になっていた
- `currentVideo.basic?.videoId`が存在する場合のみプレーヤーを表示
- アップロードされた動画ファイル（`currentVideo.basic?.videoPath`）用のプレーヤーが実装されていなかった

## 実装内容

### 1. HTML5ビデオプレーヤーの追加（src/components/pages/AnalyzePage.tsx:1097-1117）
```tsx
{currentVideo.basic?.videoPath && !currentVideo.basic?.videoId && (
  <video
    ref={(video) => {
      if (video && !playerRef) {
        console.log('🎥 Setting video element as playerRef')
        setPlayerRef(video as any)
      }
    }}
    src={currentVideo.basic.videoPath}
    controls
    className="w-full h-full bg-black"
    onLoadedMetadata={(e) => {
      console.log('📹 Video loaded:', currentVideo.basic.videoPath)
    }}
    onError={(e) => {
      console.error('❌ Video loading error:', e)
    }}
  >
    Your browser does not support the video tag.
  </video>
)}
```

### 2. シーク機能の改善（src/components/pages/AnalyzePage.tsx:1375-1409）
HTML5ビデオとYouTubeプレーヤーの両方に対応：

```typescript
// HTML5ビデオ要素の場合
if (playerRef.currentTime !== undefined) {
  console.log('🎥 Using HTML5 video seek')
  playerRef.currentTime = time
  // 一時停止中の場合は自動再生
  if (playerRef.paused) {
    playerRef.play().catch((e: any) => {
      console.log('⚠️ Auto-play prevented:', e)
    })
  }
}
// YouTubeプレーヤーAPIの場合
else if (playerRef.seekTo) {
  console.log('🎥 Using YouTube player seek')
  playerRef.seekTo(time, true)
  // 既存のYouTube再生ロジック
}
```

## 技術的詳細

### プレーヤー判定条件
- **YouTube動画**: `currentVideo.basic?.videoId`が存在する場合
- **アップロード動画**: `currentVideo.basic?.videoPath`が存在し、`videoId`が存在しない場合

### プレーヤーAPI差異
- **YouTube Player API**: `seekTo(time, allowSeekAhead)`メソッド
- **HTML5 Video API**: `currentTime`プロパティへの直接代入

### ファイル配信
- サーバー側で`/uploads`ディレクトリを静的ファイルとして配信（server.ts:67）
- 動画ファイルのパスは`/uploads/{filename}`形式

## 効果
- MOV/MP4ファイルの再生が可能に
- タイムスタンプクリックで動画の該当位置にジャンプ可能
- YouTube動画と同じユーザー体験を提供