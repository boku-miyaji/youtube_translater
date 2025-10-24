# PDF処理時間の調査メモ

## ユーザーからの指摘

> pdfなどの文書の処理時間はどうやって求めている？文字起こし（文字抽出）に想定よりも時間かかっています。そんなにかからないはず。ようやくの方が時間がかかるのでは？

## 現在の実装

### バックエンド (server.ts)

```typescript
// 1. リクエスト開始
const analysisStartTime = new Date();  // 2870行目

// 2. ファイルダウンロード/アップロード処理
// ... (PDFバッファ取得)

// 3. PDF テキスト抽出
const extractionStartTime = new Date();        // 2949行目
const pdfContent = await extractPDFText(pdfBuffer);
const extractionEndTime = new Date();          // 2951行目
const extractionDuration = ...                 // 2953行目

// 4. 要約生成
const summaryStartTime = new Date();           // 2968行目
const summary = await generateSummary(...);
const summaryEndTime = new Date();             // 3031行目
const summaryDuration = ...                    // 3078行目

// 5. 最終計算
const totalAnalysisTime = analysisEndTime - analysisStartTime  // wall clock
const actualProcessingTime = extraction + summary              // 実処理時間
```

**送信される時間データ:**
```typescript
analysisTime: {
  duration: totalAnalysisTime,      // 全体の壁時計時間（ファイルI/O含む）
  extraction: extractionDuration,   // extractPDFText()の実行時間のみ
  summary: summaryDuration,         // 要約生成の実行時間のみ
  total: actualProcessingTime       // extraction + summary
}
```

### フロントエンド (AnalyzePage.tsx)

**表示ラベル (2180行目):**
```typescript
getFirstStageTitle() → '📄 文書解析'
```

**表示時間 (2207行目):**
```typescript
getFirstStageProcessingTime() → analysisTime.extraction
```

## 問題点の特定

### 問題1: ラベルが不明確
- ユーザーは「文字起こし（文字抽出）」と表現
- UIは「文書解析」と表示
- → **何を測っているのか不明確**

### 問題2: 表示される時間の誤解
ユーザーの期待:
- テキスト抽出 → 速い（数秒以内）
- 要約生成 → 遅い（数十秒）

実際の表示:
- 「文書解析」の時間が長い？

### 仮説

**仮説A: extractionDuration が実際に長い**
- `extractPDFText()` が重い処理をしている可能性
- PDFパース、OCR、構造解析など

**仮説B: 間違ったフィールドを表示している**
- `duration`（wall clock）を表示している？
- フォールバックロジックで `total` を使っている？

**仮説C: ラベルの混乱**
- 「文書解析」というラベルが全体処理を指していると誤解
- 実際は extraction のみを表示しているが、ユーザーが理解していない

## 解決策

### 1. ラベルを明確化
```typescript
// 変更前
'📄 文書解析'

// 変更後
'📄 PDFテキスト抽出'
```

### 2. 処理時間の内訳を詳細表示
```
📄 PDFテキスト抽出
  方法: PDF Parser
  コスト: 無料
  処理時間: 2.3秒

📋 要約生成
  コスト: $0.0012
  処理時間: 15.7秒

⏱️ 合計処理時間: 18.0秒
```

### 3. デバッグログ追加
バックエンドで詳細ログを出力:
```typescript
console.log(`📄 PDF Analysis Timing:`);
console.log(`   File I/O: ${fileIoTime}s`);
console.log(`   Text Extraction: ${extractionDuration}s`);
console.log(`   Summary Generation: ${summaryDuration}s`);
console.log(`   Total Processing: ${actualProcessingTime}s`);
console.log(`   Wall Clock: ${totalAnalysisTime}s`);
```

## 実装変更点

1. `getFirstStageTitle()` のラベルを変更
2. コンソールログを追加して実際の値を確認可能に
3. 必要に応じて処理時間の測定方法を見直し
