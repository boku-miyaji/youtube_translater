---
issue: 20
title: "入力形式拡張: 音声ファイル・PDF対応"
type: Feature
description: |
  入力形式を増やす。音声ファイル、論文のPDFのURLも同様に解析できるようにする。
---

# 設計書: 入力形式拡張 - 音声ファイル・PDF対応

## 1. 概要・要件分析

### 1.1 背景
現在のシステムはYouTube動画とMOV/MP4ファイルの解析に特化しているが、ユーザーからより多様な入力形式への対応が求められている。特に音声ファイル（ポッドキャスト、講演録音など）と学術論文PDFの解析ニーズが高い。

### 1.2 要件
- **音声ファイル対応**
  - 対応形式: MP3, WAV, M4A, AAC, OGG, FLAC
  - ファイルアップロード機能
  - 音声の文字起こしと要約生成
  
- **PDF対応**
  - URLからのPDF取得
  - ローカルPDFファイルのアップロード
  - テキスト抽出と構造解析
  - 論文特有の構造（Abstract、References等）の認識

### 1.3 非機能要件
- 既存機能との互換性維持
- 統一されたUX体験
- 処理時間の最適化
- セキュリティ（ファイルサイズ制限、マルウェア対策）

## 2. 技術設計

### 2.1 アーキテクチャ概要

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Backend API    │     │  Processing     │
│                 │     │                  │     │  Services       │
│ ┌─────────────┐ │     │ ┌──────────────┐ │     │ ┌─────────────┐ │
│ │Input Select │ │────▶│ │File Handler  │ │────▶│ │Audio Parser │ │
│ └─────────────┘ │     │ └──────────────┘ │     │ └─────────────┘ │
│ ┌─────────────┐ │     │ ┌──────────────┐ │     │ ┌─────────────┐ │
│ │File Upload  │ │────▶│ │Type Detector │ │────▶│ │PDF Parser   │ │
│ └─────────────┘ │     │ └──────────────┘ │     │ └─────────────┘ │
│ ┌─────────────┐ │     │ ┌──────────────┐ │     │ ┌─────────────┐ │
│ │Progress UI  │ │◀────│ │Process Queue │ │◀────│ │Transcriber  │ │
│ └─────────────┘ │     │ └──────────────┘ │     │ └─────────────┘ │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### 2.2 実装詳細

#### 2.2.1 Frontend変更

**入力タイプ選択UI（AnalyzePage.tsx）**
```typescript
enum InputType {
  YOUTUBE_URL = 'youtube',
  VIDEO_FILE = 'video',
  AUDIO_FILE = 'audio',  // 新規
  PDF_URL = 'pdf_url',   // 新規
  PDF_FILE = 'pdf_file'  // 新規
}

interface FileTypeConfig {
  accept: string;
  maxSize: number;
  icon: string;
}

const FILE_TYPE_CONFIGS: Record<InputType, FileTypeConfig> = {
  [InputType.AUDIO_FILE]: {
    accept: '.mp3,.wav,.m4a,.aac,.ogg,.flac',
    maxSize: 500 * 1024 * 1024, // 500MB
    icon: '🎵'
  },
  [InputType.PDF_FILE]: {
    accept: '.pdf',
    maxSize: 50 * 1024 * 1024, // 50MB
    icon: '📄'
  }
  // ... existing configs
}
```

#### 2.2.2 Backend API拡張

**ファイルタイプ検出（server.ts）**
```typescript
interface FileTypeInfo {
  type: 'video' | 'audio' | 'pdf';
  mimeType: string;
  extension: string;
}

function detectFileType(file: Express.Multer.File): FileTypeInfo {
  const mimeTypeMap = {
    'audio/mpeg': { type: 'audio', extension: 'mp3' },
    'audio/wav': { type: 'audio', extension: 'wav' },
    'audio/mp4': { type: 'audio', extension: 'm4a' },
    'application/pdf': { type: 'pdf', extension: 'pdf' },
    // ... more mappings
  };
  
  // Magic number validation for security
  const magicNumbers = {
    pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
    mp3: [0x49, 0x44, 0x33],       // ID3
    // ... more magic numbers
  };
  
  return validateAndDetectType(file, mimeTypeMap, magicNumbers);
}
```

**音声処理パイプライン**
```typescript
async function processAudioFile(
  file: Express.Multer.File,
  options: ProcessingOptions
): Promise<AnalysisResult> {
  // 1. ファイル検証
  const fileInfo = detectFileType(file);
  if (fileInfo.type !== 'audio') {
    throw new Error('Invalid audio file');
  }
  
  // 2. 音声メタデータ抽出
  const metadata = await extractAudioMetadata(file.path);
  
  // 3. 文字起こし処理（既存のWhisper/GPT-4o使用）
  const transcription = await transcribeAudio(file.path, options);
  
  // 4. 要約生成
  const summary = await generateSummary(transcription, options);
  
  return {
    type: 'audio',
    metadata,
    transcription,
    summary,
    processingTime: calculateProcessingTime()
  };
}
```

**PDF処理パイプライン**
```typescript
async function processPDF(
  input: string | Express.Multer.File,
  options: ProcessingOptions
): Promise<AnalysisResult> {
  // 1. PDFソース判定とダウンロード
  let pdfBuffer: Buffer;
  if (typeof input === 'string') {
    pdfBuffer = await downloadPDF(input);
  } else {
    pdfBuffer = await fs.readFile(input.path);
  }
  
  // 2. テキスト抽出
  const textContent = await extractPDFText(pdfBuffer);
  
  // 3. 構造解析（論文の場合）
  const structure = await analyzePDFStructure(textContent);
  
  // 4. 要約生成（構造を考慮）
  const summary = await generateStructuredSummary(
    textContent, 
    structure,
    options
  );
  
  return {
    type: 'pdf',
    metadata: structure,
    content: textContent,
    summary,
    processingTime: calculateProcessingTime()
  };
}
```

### 2.3 データモデル

**拡張されたAnalysisResult型**
```typescript
interface AnalysisResult {
  id: string;
  type: 'youtube' | 'video' | 'audio' | 'pdf';
  url?: string;
  fileName?: string;
  fileSize?: number;
  
  // 共通フィールド
  summary: Summary;
  processingTime: ProcessingTime;
  cost: CostEstimation;
  
  // タイプ別フィールド
  transcription?: Transcription;  // video, audio
  pdfContent?: PDFContent;         // pdf only
  metadata: MediaMetadata | PDFMetadata;
}

interface PDFContent {
  fullText: string;
  sections: PDFSection[];
  pageCount: number;
  language: string;
}

interface PDFSection {
  title: string;
  content: string;
  pageRange: [number, number];
  type: 'abstract' | 'introduction' | 'methodology' | 
        'results' | 'conclusion' | 'references' | 'other';
}

interface PDFMetadata {
  title?: string;
  authors?: string[];
  publicationDate?: string;
  doi?: string;
  journal?: string;
  pageCount: number;
  fileSize: number;
}
```

### 2.4 UI/UXの変更

1. **入力タイプ選択の拡張**
   - 5つのボタン（YouTube URL、動画ファイル、音声ファイル、PDF URL、PDFファイル）
   - アイコンとツールチップで各タイプを明確に表示

2. **プログレス表示の適応**
   - PDFの場合：「テキスト抽出中」「構造解析中」のステップ追加
   - 音声の場合：既存の動画処理と同様の表示

3. **結果表示の最適化**
   - PDF：セクション別の要約表示
   - 音声：タイムスタンプ付き文字起こし表示

## 3. テスト戦略

### 3.1 単体テスト

```typescript
// ファイルタイプ検出のテスト
describe('detectFileType', () => {
  it('should correctly identify MP3 files', () => {
    const mockFile = createMockFile('audio.mp3', 'audio/mpeg');
    const result = detectFileType(mockFile);
    expect(result.type).toBe('audio');
    expect(result.extension).toBe('mp3');
  });
  
  it('should reject invalid PDF magic numbers', () => {
    const mockFile = createMockFile('fake.pdf', 'application/pdf');
    mockFile.buffer = Buffer.from('not a pdf');
    expect(() => detectFileType(mockFile)).toThrow();
  });
});

// PDF処理のテスト
describe('processPDF', () => {
  it('should extract text from academic paper', async () => {
    const pdfPath = 'test/fixtures/sample-paper.pdf';
    const result = await processPDF(pdfPath, defaultOptions);
    expect(result.pdfContent.sections).toHaveLength(6);
    expect(result.metadata.authors).toBeDefined();
  });
});
```

### 3.2 統合テスト

- 各ファイルタイプのE2Eフロー
- エラーケース（破損ファイル、サイズ超過、無効な形式）
- 同時アップロードのテスト

### 3.3 パフォーマンステスト

- 大容量音声ファイル（2時間以上）の処理
- 100ページ以上のPDFの処理
- 並行処理のスループット測定

## 4. セキュリティ考慮事項

### 4.1 ファイルアップロードセキュリティ

1. **ファイル検証**
   - MIMEタイプとマジックナンバーの二重チェック
   - ファイルサイズ制限の厳格な適用
   - 実行可能ファイルの拒否

2. **サニタイゼーション**
   - アップロードファイル名のサニタイズ
   - PDFからのJavaScript除去
   - メタデータのクリーニング

3. **アクセス制御**
   - 一時ファイルの適切な権限設定
   - 処理完了後の自動削除
   - ユーザー別の隔離

### 4.2 PDF URLセキュリティ

```typescript
const PDF_URL_WHITELIST = [
  /^https:\/\/arxiv\.org\//,
  /^https:\/\/.*\.edu\//,
  /^https:\/\/doi\.org\//,
  // 信頼できるドメインのみ
];

function validatePDFUrl(url: string): boolean {
  // URLの検証
  const parsed = new URL(url);
  
  // HTTPSのみ許可
  if (parsed.protocol !== 'https:') return false;
  
  // ホワイトリストチェック
  return PDF_URL_WHITELIST.some(pattern => pattern.test(url));
}
```

## 5. パフォーマンス考慮事項

### 5.1 処理の最適化

1. **音声処理**
   - チャンク単位での処理によるメモリ効率化
   - 並列処理による高速化（マルチコアCPU活用）

2. **PDF処理**
   - ストリーミング処理によるメモリ使用量削減
   - テキスト抽出のキャッシング

### 5.2 スケーラビリティ

```typescript
// ジョブキューの実装
interface ProcessingJob {
  id: string;
  type: 'audio' | 'pdf' | 'video';
  priority: number;
  retryCount: number;
  createdAt: Date;
}

class ProcessingQueue {
  async addJob(job: ProcessingJob): Promise<void> {
    // Redisベースのキュー実装
    await this.redis.lpush('processing_queue', JSON.stringify(job));
  }
  
  async processNext(): Promise<void> {
    const job = await this.redis.rpop('processing_queue');
    // ワーカープールでの処理
  }
}
```

## 6. 未解決の設計課題

### 6.1 技術的課題

1. **PDF OCR対応**
   - 画像ベースのPDFへの対応方法
   - OCRライブラリの選定（Tesseract.js vs Cloud Vision API）

2. **大容量ファイル処理**
   - 1GB以上の音声ファイルの処理方法
   - プログレッシブアップロードの実装

### 6.2 ビジネス課題

1. **コスト見積もり**
   - PDF処理のトークン数予測の精度
   - 音声ファイルの処理コスト計算

2. **ライセンス**
   - PDF抽出ライブラリのライセンス確認
   - 音声コーデックのライセンス問題

### 6.3 今後の検討事項

1. **機能拡張**
   - 画像ファイル（OCR）対応
   - 電子書籍（EPUB）対応
   - リアルタイム音声ストリーミング

2. **統合**
   - 外部ストレージサービス連携
   - クラウドストレージからの直接読み込み

## 7. 実装スケジュール案

1. **Phase 1: 音声ファイル対応（2週間）**
   - 基本的な音声アップロード機能
   - 既存の文字起こし機能の流用
   - UI/UXの拡張

2. **Phase 2: PDF基本対応（3週間）**
   - PDFテキスト抽出
   - 基本的な要約生成
   - URL/ファイル両対応

3. **Phase 3: PDF高度化（2週間）**
   - 論文構造解析
   - セクション別要約
   - メタデータ抽出

4. **Phase 4: 最適化とテスト（1週間）**
   - パフォーマンス最適化
   - セキュリティ強化
   - 包括的なテスト

---
*設計書作成日: 2025-07-15*