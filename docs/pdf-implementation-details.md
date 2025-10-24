# PDF機能実装の技術詳細

## 実装ファイル構成

### バックエンド

1. **`src/server.ts`**
   - `/api/analyze-pdf` エンドポイント
   - PDF処理の主要ロジック

2. **`src/types/index.ts`**
   - PDF関連の型定義
   - `PDFContent`, `PDFMetadata`, `PDFSection`, `PDFAnalysisResponse`

### フロントエンド

1. **`src/components/pages/AnalyzePage.tsx`**
   - PDF入力UI（URL/ファイルアップロード）
   - PDFの処理結果表示

2. **`src/components/shared/TranscriptViewer.tsx`**
   - PDFテキストの表示（transcriptとして）

## API仕様

### POST `/api/analyze-pdf`

#### リクエスト

**URLの場合（JSON）:**
```json
{
  "url": "https://arxiv.org/pdf/2401.00001.pdf",
  "language": "ja",
  "gptModel": "gpt-4o-mini",
  "generateSummary": "true",
  "extractStructure": "true"
}
```

**ファイルアップロードの場合（multipart/form-data）:**
- `file`: PDFファイル（最大50MB）
- `language`: 言語設定
- `gptModel`: 使用するGPTモデル
- `generateSummary`: 要約生成フラグ
- `extractStructure`: 構造解析フラグ

#### レスポンス

```typescript
interface PDFAnalysisResponse {
  success: boolean;
  title: string;
  fileId: string;
  originalName: string;
  size: number;
  transcript: string;  // PDFから抽出したテキスト
  summary: string;     // 生成された要約
  analysisType: 'pdf';
  pdfContent?: {
    fullText: string;
    sections: PDFSection[];
    pageCount: number;
    language: string;
  };
  pdfMetadata?: {
    title?: string;
    authors?: string[];
    publicationDate?: string;
    doi?: string;
    journal?: string;
    pageCount: number;
    fileSize: number;
    abstract?: string;
    keywords?: string[];
  };
  costs: {
    transcription: 0;  // PDFは文字起こし不要
    summary: number;
    article: 0;
    total: number;
  };
  analysisTime: {
    extraction: number;
    summary: number;
    total: number;
  };
  message: string;
}
```

## 実装の重要なポイント

### 1. PDFメタデータがない場合の処理

```typescript
// 修正前の問題のあるコード
if (shouldGenerateSummary && pdfMetadata) {
  // pdfMetadataがない場合、要約が生成されない
}

// 修正後のコード
if (shouldGenerateSummary) {
  const metadataForSummary = pdfMetadata || {
    title: fileName,
    pageCount: pdfContent.pageCount,
    fileSize: fileSize
  };
  // pdfMetadataがなくても要約を生成
}
```

### 2. エラーハンドリング

```typescript
try {
  summary = await generatePDFSummary(pdfContent, metadataForSummary, gptModel, language);
} catch (summaryError) {
  // エラーが発生しても処理を継続
  summary = '';
  summaryCost = 0;
  
  if (summaryError instanceof OpenAIError) {
    console.log('OpenAI API error detected, continuing without summary');
  }
}
```

### 3. フロントエンドとの連携

PDFの処理結果は`transcript`フィールドに格納され、既存の`TranscriptViewer`コンポーネントで表示されます：

```typescript
// AnalyzePage.tsx
const videoMetadata = {
  // ...
  transcript: data.transcript,  // PDFテキストがここに入る
  summary: data.summary,
  // ...
};

// TranscriptViewer.tsx
<TranscriptViewer 
  transcript={currentVideo.transcript}  // PDFテキストを表示
  summary={currentVideo.summary}
/>
```

## デバッグ情報

### ログ出力

処理の各段階でコンソールログを出力：

```typescript
console.log('📥 Downloading PDF from URL:', pdfUrl);
console.log('📄 Extracting text from PDF...');
console.log('🔍 Analyzing PDF structure...');
console.log('📝 Generating PDF summary...');
console.log('✅ PDF processed successfully');
```

### エラーログ

```typescript
console.error('Failed to download PDF:', error);
console.error('Failed to extract PDF text:', error);
console.error('Error generating PDF summary:', summaryError);
console.error('❌ Error processing PDF:', error);
```

## テスト方法

### 1. cURLでのテスト

```bash
# PDF URLの処理
curl -X POST http://localhost:8080/api/analyze-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://arxiv.org/pdf/2401.00001.pdf",
    "language": "ja",
    "gptModel": "gpt-4o-mini",
    "generateSummary": "true",
    "extractStructure": "true"
  }'

# レスポンスの確認
curl ... | jq '{
  success,
  title,
  hasTranscript: has("transcript"),
  transcriptLength: (.transcript | length),
  hasSummary: has("summary"),
  summaryLength: (.summary | length)
}'
```

### 2. ファイルアップロードのテスト

```bash
curl -X POST http://localhost:8080/api/analyze-pdf \
  -F "file=@/path/to/document.pdf" \
  -F "language=ja" \
  -F "gptModel=gpt-4o-mini" \
  -F "generateSummary=true"
```

## 既知の問題と対処法

### 1. 要約が生成されない

**原因**: 
- OpenAI APIのクォータ制限
- `pdfMetadata`が未設定で要約生成がスキップされる

**対処法**:
- APIクォータを確認
- 最新の修正が適用されているか確認

### 2. 日本語PDFの文字化け

**原因**: エンコーディングの問題

**対処法**: pdf-parseライブラリの制限。将来的にはより高度なPDF処理ライブラリへの移行を検討

### 3. 大きなPDFの処理タイムアウト

**原因**: ファイルサイズが大きすぎる

**対処法**:
- ファイルサイズ制限（50MB）の確認
- タイムアウト設定の調整
- ストリーミング処理の実装

## パフォーマンス指標

典型的な処理時間（16ページのPDF）：
- テキスト抽出: 0-1秒
- 構造解析: 0秒
- 要約生成: 1-3秒（OpenAI APIに依存）
- 合計: 1-4秒

## 今後の改善案

1. **バッチ処理**: 複数PDFの一括処理
2. **キャッシング**: 同じPDFの再処理を避ける
3. **プログレス表示**: リアルタイムの処理進捗
4. **部分的な処理**: 特定のページ範囲のみ処理
5. **より詳細なエラーメッセージ**: ユーザーフレンドリーなエラー表示