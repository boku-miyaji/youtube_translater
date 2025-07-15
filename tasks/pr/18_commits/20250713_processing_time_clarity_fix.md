# Issue #18 処理時間表示の明確化

## 問題
「秒/分」という表示が分かりにくく、「分」が動画時間を指すことが不明確だった。

## 変更内容

### server.ts（line 431, 451）
処理時間の表示形式を「動画1分あたり○秒」に変更：

```typescript
// 変更前
const transcriptionRate = `${transcriptionSecondsPerVideoMinute.toFixed(1)}秒/分`;
const summaryRate = `${summarySecondsPerVideoMinute.toFixed(1)}秒/分`;

// 変更後
const transcriptionRate = `動画1分あたり${transcriptionSecondsPerVideoMinute.toFixed(1)}秒`;
const summaryRate = `動画1分あたり${summarySecondsPerVideoMinute.toFixed(1)}秒`;
```

### types/index.ts（line 400-401, 426-427）
型定義のコメントを更新：
```typescript
// 変更前
transcriptionRate?: string;  // e.g., "30.0秒/分"
summaryRate?: string;        // e.g., "60.0秒/分"

// 変更後
transcriptionRate?: string;  // e.g., "動画1分あたり30.0秒"
summaryRate?: string;        // e.g., "動画1分あたり60.0秒"
```

## 効果
- 「分」が動画時間を指すことが明確になった
- 「動画1分あたり○秒で処理」という分かりやすい日本語表現になった
- ユーザーが処理速度を直感的に理解できるようになった

## 表示例
- 変更前：「文字起こし速度: 7.5秒/分」「要約生成速度: 30.0秒/分」
- 変更後：「文字起こし速度: 動画1分あたり7.5秒」「要約生成速度: 動画1分あたり30.0秒」