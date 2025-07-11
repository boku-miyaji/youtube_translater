# 動画ファイル対応: MOV/MP4形式の動画解析サポート

## フロントマター
- **Issue**: 18
- **Title**: 動画ファイル対応: MOV/MP4形式の動画解析サポート
- **Type**: Feature
- **Description**: youtubeの動画のみではなく、movやmp4などの動画ファイルも対象にいれ、同様の解析ができるようにする

## 概要・要件分析

### 🎯 目標
YouTube動画に加えて、ローカルの動画ファイル（MOV/MP4）をアップロードし、同様の解析機能（文字起こし、要約、記事生成）を提供する。

### 📋 機能要件

#### 必須機能
1. **動画ファイルアップロード**
   - MOV/MP4形式のサポート
   - ドラッグ&ドロップインターフェース
   - プログレス表示
   - エラーハンドリング

2. **動画解析機能**
   - 文字起こし（Whisper API使用）
   - 要約生成
   - 記事生成
   - チャット機能

3. **ファイル管理**
   - 一時的な動画ファイル保存
   - 処理完了後の自動削除
   - ファイルサイズ制限

#### 非機能要件
1. **パフォーマンス**
   - 最大ファイルサイズ: 500MB
   - アップロード時間: 10分以内
   - 処理時間: 動画時間の2-3倍以内

2. **セキュリティ**
   - ファイル形式検証
   - ウイルススキャン
   - 一時ファイル自動削除
   - アクセス制御

3. **可用性**
   - アップロード失敗時の再試行
   - 処理中断時の状態保持
   - エラー時のユーザーフィードバック

## 技術設計

### 🏗️ アーキテクチャ概要

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Storage       │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │File Upload  │ │───▶│ │File Handler │ │───▶│ │Temp Storage │ │
│ │Component    │ │    │ │             │ │    │ │             │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │        │        │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │Analysis UI  │ │◀───│ │Video        │ │───▶│ │Processed    │ │
│ │             │ │    │ │Processor    │ │    │ │Data         │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 🔧 実装詳細

#### 1. フロントエンド実装

**新規コンポーネント**
```typescript
// components/VideoFileUpload.tsx
interface VideoFileUploadProps {
  onFileSelected: (file: File) => void;
  maxSize: number;
  acceptedFormats: string[];
  isUploading: boolean;
  uploadProgress: number;
}

interface VideoFile {
  file: File;
  id: string;
  name: string;
  size: number;
  duration?: number;
  thumbnail?: string;
}
```

**既存コンポーネント修正**
```typescript
// pages/AnalyzePage.tsx
// URLとファイルアップロードの両方に対応
interface AnalyzePageState {
  inputType: 'url' | 'file';
  youtubeUrl?: string;
  videoFile?: VideoFile;
  isProcessing: boolean;
  progress: ProcessingProgress;
}
```

#### 2. バックエンド実装

**新規APIエンドポイント**
```typescript
// /api/upload-video-file
POST /api/upload-video-file
Content-Type: multipart/form-data
Body: {
  file: File,
  options: {
    language: string,
    model: string,
    generateSummary: boolean,
    generateArticle: boolean
  }
}

Response: {
  fileId: string,
  originalName: string,
  size: number,
  duration: number,
  status: 'uploaded' | 'processing' | 'completed' | 'failed'
}
```

**処理パイプライン**
```typescript
// services/VideoFileProcessor.ts
class VideoFileProcessor {
  async processVideoFile(file: File): Promise<ProcessingResult> {
    // 1. ファイル検証
    await this.validateFile(file);
    
    // 2. 一時保存
    const tempPath = await this.saveTempFile(file);
    
    // 3. メタデータ抽出
    const metadata = await this.extractMetadata(tempPath);
    
    // 4. 文字起こし
    const transcript = await this.transcribeVideo(tempPath);
    
    // 5. 要約・記事生成
    const analysis = await this.generateAnalysis(transcript);
    
    // 6. 一時ファイル削除
    await this.cleanupTempFile(tempPath);
    
    return {
      metadata,
      transcript,
      analysis,
      costs: this.calculateCosts(metadata, transcript, analysis)
    };
  }
}
```

#### 3. ストレージ設計

**一時ファイル保存**
```typescript
// utils/FileStorage.ts
interface TempFileConfig {
  maxSize: number;          // 500MB
  allowedTypes: string[];   // ['video/mp4', 'video/quicktime']
  retentionTime: number;    // 24時間
  cleanupInterval: number;  // 1時間
}

class TempFileManager {
  private tempDir = process.env.TEMP_UPLOAD_DIR || '/tmp/uploads';
  
  async saveFile(file: File): Promise<string> {
    const filename = `${Date.now()}-${crypto.randomUUID()}.${this.getExtension(file)}`;
    const filepath = path.join(this.tempDir, filename);
    
    // ファイル保存
    await fs.writeFile(filepath, file.stream());
    
    // 自動削除スケジュール
    this.scheduleCleanup(filepath);
    
    return filepath;
  }
  
  async cleanupExpiredFiles(): Promise<void> {
    // 24時間以上前のファイルを削除
  }
}
```

### 📊 データモデル

#### 既存モデル拡張
```typescript
// types/VideoMetadata.ts
interface VideoMetadata {
  // 既存フィールド
  videoId?: string;        // YouTube video ID (optional)
  title: string;
  duration: number;
  views?: number;          // YouTube only
  channel?: string;        // YouTube only
  
  // 新規フィールド
  source: 'youtube' | 'file';
  fileId?: string;         // File upload ID
  originalFilename?: string;
  fileSize?: number;       // bytes
  uploadedAt?: string;     // ISO timestamp
  
  // 共通フィールド
  transcriptSource: 'youtube' | 'whisper';
  costs: DetailedCosts;
  analysisTime: AnalysisTimeInfo;
}
```

#### 新規モデル
```typescript
// types/VideoFile.ts
interface VideoFileUpload {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed' | 'deleted';
  tempPath: string;
  processingResult?: ProcessingResult;
  error?: string;
}

interface ProcessingResult {
  metadata: VideoMetadata;
  transcript: TranscriptSegment[];
  summary?: string;
  article?: string;
  costs: DetailedCosts;
  analysisTime: AnalysisTimeInfo;
}
```

## テスト戦略

### 🧪 テストカテゴリ

#### 1. ユニットテスト
```typescript
// tests/VideoFileProcessor.test.ts
describe('VideoFileProcessor', () => {
  describe('validateFile', () => {
    test('should accept valid MP4 file', async () => {
      const file = createMockFile('video.mp4', 'video/mp4', 100 * 1024 * 1024);
      await expect(processor.validateFile(file)).resolves.not.toThrow();
    });
    
    test('should reject oversized file', async () => {
      const file = createMockFile('large.mp4', 'video/mp4', 600 * 1024 * 1024);
      await expect(processor.validateFile(file)).rejects.toThrow('File too large');
    });
    
    test('should reject invalid file type', async () => {
      const file = createMockFile('video.avi', 'video/avi', 100 * 1024 * 1024);
      await expect(processor.validateFile(file)).rejects.toThrow('Unsupported file type');
    });
  });
});
```

#### 2. 統合テスト
```typescript
// tests/integration/VideoFileUpload.test.ts
describe('Video File Upload Flow', () => {
  test('should process complete video file upload', async () => {
    // 1. ファイルアップロード
    const uploadResponse = await request(app)
      .post('/api/upload-video-file')
      .attach('file', 'tests/fixtures/sample.mp4')
      .expect(200);
    
    // 2. 処理完了まで待機
    await waitForProcessing(uploadResponse.body.fileId);
    
    // 3. 結果確認
    const result = await request(app)
      .get(`/api/processing-result/${uploadResponse.body.fileId}`)
      .expect(200);
    
    expect(result.body.transcript).toBeDefined();
    expect(result.body.summary).toBeDefined();
    expect(result.body.costs).toBeDefined();
  });
});
```

#### 3. E2Eテスト
```typescript
// tests/e2e/VideoFileAnalysis.test.ts
describe('Video File Analysis E2E', () => {
  test('should analyze uploaded video file', async () => {
    await page.goto('/analyze');
    
    // ファイルアップロード
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/sample.mp4');
    
    // 分析開始
    await page.click('[data-testid="analyze-button"]');
    
    // 結果確認
    await expect(page.locator('[data-testid="transcript"]')).toBeVisible();
    await expect(page.locator('[data-testid="summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="cost-info"]')).toBeVisible();
  });
});
```

## セキュリティ・パフォーマンス考慮事項

### 🔒 セキュリティ対策

#### 1. ファイル検証
```typescript
// security/FileValidator.ts
class FileValidator {
  private allowedMimeTypes = ['video/mp4', 'video/quicktime'];
  private maxFileSize = 500 * 1024 * 1024; // 500MB
  
  async validateFile(file: File): Promise<void> {
    // MIMEタイプチェック
    if (!this.allowedMimeTypes.includes(file.type)) {
      throw new Error('Unsupported file type');
    }
    
    // ファイルサイズチェック
    if (file.size > this.maxFileSize) {
      throw new Error('File too large');
    }
    
    // ファイルシグネチャ検証
    await this.validateFileSignature(file);
    
    // ウイルススキャン（オプション）
    await this.scanForVirus(file);
  }
  
  private async validateFileSignature(file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    const signature = new Uint8Array(buffer.slice(0, 12));
    
    // MP4 signature check
    if (signature[4] === 0x66 && signature[5] === 0x74 && signature[6] === 0x79 && signature[7] === 0x70) {
      return; // Valid MP4
    }
    
    throw new Error('Invalid file signature');
  }
}
```

#### 2. アクセス制御
```typescript
// middleware/FileAccessControl.ts
export const fileAccessMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const fileId = req.params.fileId;
  const userId = req.user?.id;
  
  // ファイルの所有者確認
  if (!isFileOwner(fileId, userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  next();
};
```

#### 3. 一時ファイル管理
```typescript
// security/TempFileCleanup.ts
class TempFileCleanup {
  private cleanupInterval = 60 * 60 * 1000; // 1時間
  private maxFileAge = 24 * 60 * 60 * 1000; // 24時間
  
  startCleanupScheduler(): void {
    setInterval(() => {
      this.cleanupExpiredFiles();
    }, this.cleanupInterval);
  }
  
  private async cleanupExpiredFiles(): Promise<void> {
    const tempDir = process.env.TEMP_UPLOAD_DIR || '/tmp/uploads';
    const files = await fs.readdir(tempDir);
    
    for (const file of files) {
      const filepath = path.join(tempDir, file);
      const stats = await fs.stat(filepath);
      
      if (Date.now() - stats.mtimeMs > this.maxFileAge) {
        await fs.unlink(filepath);
        console.log(`Cleaned up expired file: ${filepath}`);
      }
    }
  }
}
```

### ⚡ パフォーマンス最適化

#### 1. ファイルアップロード最適化
```typescript
// utils/FileUploadOptimizer.ts
class FileUploadOptimizer {
  async optimizeUpload(file: File): Promise<void> {
    // チャンクアップロード
    const chunkSize = 1024 * 1024; // 1MB chunks
    const chunks = Math.ceil(file.size / chunkSize);
    
    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      await this.uploadChunk(chunk, i, chunks);
    }
  }
  
  private async uploadChunk(chunk: Blob, index: number, total: number): Promise<void> {
    // 並行アップロード制御
    // リトライ機能
    // プログレス更新
  }
}
```

#### 2. 処理キュー管理
```typescript
// queue/VideoProcessingQueue.ts
class VideoProcessingQueue {
  private queue: Queue<VideoProcessingJob>;
  private concurrency = 3; // 同時処理数
  
  constructor() {
    this.queue = new Queue('video-processing', {
      concurrency: this.concurrency,
      timeout: 30 * 60 * 1000, // 30分タイムアウト
    });
  }
  
  async addJob(fileId: string, options: ProcessingOptions): Promise<void> {
    await this.queue.add('process-video', {
      fileId,
      options,
      attempts: 3,
      backoff: 'exponential'
    });
  }
}
```

## 未解決の設計課題

### 🤔 検討が必要な項目

1. **ストレージ戦略**
   - ローカルストレージ vs クラウドストレージ
   - 一時ファイルの保存場所
   - スケールアウト時の考慮

2. **処理能力**
   - 同時アップロード数の制限
   - 処理キューの管理
   - リソース使用量の制御

3. **コスト管理**
   - Whisper API使用料金の計算
   - ストレージコストの見積もり
   - ユーザー別の使用量制限

4. **エラーハンドリング**
   - 処理中断時のリカバリ
   - 部分的な失敗の処理
   - ユーザーへの適切なフィードバック

5. **スケーラビリティ**
   - 大量のファイルアップロード対応
   - 処理能力の動的スケーリング
   - データベースの分散化

### 🎯 次フェーズでの対応予定

1. **Phase 1**: 基本的なファイルアップロード機能
2. **Phase 2**: 処理最適化とエラーハンドリング強化
3. **Phase 3**: スケーラビリティ向上とコスト最適化

## 実装優先順位

### 🥇 高優先度
1. ファイルアップロード UI
2. ファイル検証とセキュリティ
3. 基本的な処理パイプライン
4. 一時ファイル管理

### 🥈 中優先度
1. 処理キュー管理
2. エラーハンドリング強化
3. パフォーマンス最適化
4. 詳細なテストカバレッジ

### 🥉 低優先度
1. 高度なファイル形式サポート
2. 並列処理最適化
3. 詳細な使用量分析
4. 管理画面機能

---

この設計書は動画ファイル対応機能の包括的な実装計画を提供します。セキュリティ、パフォーマンス、スケーラビリティを考慮した堅牢な実装を目指します。