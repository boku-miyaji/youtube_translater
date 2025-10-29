# Design Document: Add comprehensive tech stack documentation

---

**Issue**: #25
**Title**: Add comprehensive tech stack documentation
**Type**: Task
**Description**: docs,README整備。google Cloud Runに載せれるように整備

---

## 1. 概要・要件分析

### 1.1 背景

現在、プロジェクトの技術スタックは分散して記載されており、新規参加者や外部協力者がプロジェクトの全体像を把握しづらい状況にあります。また、Google Cloud Runへのデプロイを見据えた環境整備が必要です。

### 1.2 目的

1. **技術スタックの可視化**: `docs/tech-stack.md` (既存) への適切なアクセス導線を構築
2. **READMEの構造化**: 目次追加とドキュメント間のナビゲーション改善
3. **Google Cloud Run対応**: コンテナ化とクラウドデプロイの準備

### 1.3 スコープ

**In-Scope**:
- README.mdへの目次追加と技術スタックセクション追加
- Dockerfileの作成（マルチステージビルド）
- .dockerignoreの作成
- Cloud Run設定ドキュメントの作成
- デプロイ手順のREADME追記

**Out-of-Scope**:
- CI/CDパイプラインの実装（別タスク）
- モニタリング・ロギング設定（別タスク）
- カスタムドメイン設定（別タスク）

### 1.4 成功基準

1. ✅ README.mdに目次が追加され、tech-stack.mdへのリンクが明確
2. ✅ Dockerイメージがローカルでビルド・起動成功
3. ✅ Cloud Runへの手動デプロイ手順が文書化されている
4. ✅ デプロイ後の動作確認項目がリストアップされている

---

## 2. 技術設計

### 2.1 README.md構造変更

#### 2.1.1 現状分析

現在のREADME.mdは以下の構成：
- プロジェクト説明
- 新機能紹介
- 主な機能
- クイックスタート
- （その後の詳細説明）

**問題点**:
- 目次がなく、長文ドキュメントのナビゲーションが困難
- 技術スタックへの言及が散発的
- 開発者向けドキュメントへのリンクが不明確

#### 2.1.2 改善案

```markdown
# 🎥 YouTube AI Assistant

[既存のバッジ類]

## 📑 目次

- [✨ 新機能](#-新機能v200)
- [🌟 主な機能](#-主な機能)
- [🚀 クイックスタート](#-クイックスタート)
- [📚 ドキュメント](#-ドキュメント)
  - [技術スタック](docs/tech-stack.md)
  - [PDF処理詳細](docs/pdf-implementation-details.md)
  - [PDF処理ロジック](docs/pdf-processing-logic.md)
  - [PDFクイックスタートガイド](docs/pdf-quickstart-guide.md)
- [🐳 Docker / Cloud Runデプロイ](#-docker--cloud-runデプロイ)
- [🔧 トラブルシューティング](#-トラブルシューティング)
- [📄 ライセンス](#-ライセンス)

## 📚 ドキュメント

開発者向けの詳細ドキュメント：

- **[技術スタック](docs/tech-stack.md)** - フロントエンド・バックエンド・インフラの全技術スタック
- **[PDF処理詳細](docs/pdf-implementation-details.md)** - PDF処理実装の詳細
- **[PDF処理ロジック](docs/pdf-processing-logic.md)** - PDF処理のアルゴリズム
- **[PDFクイックスタートガイド](docs/pdf-quickstart-guide.md)** - PDF機能の使い方

## 🐳 Docker / Cloud Runデプロイ

[新規セクション - 詳細は後述]
```

**変更箇所**:
1. 目次の追加（`## 📑 目次`）
2. ドキュメントセクションの追加（`## 📚 ドキュメント`）
3. Dockerデプロイセクションの追加（`## 🐳 Docker / Cloud Runデプロイ`）

### 2.2 Dockerfile設計

#### 2.2.1 基本方針

- **マルチステージビルド**: ビルド時依存と実行時依存を分離
- **軽量化**: 本番イメージサイズを最小化
- **FFmpeg対応**: 音声処理に必要なFFmpegをインストール
- **セキュリティ**: 非rootユーザーで実行

#### 2.2.2 Dockerfile構成

```dockerfile
# ========================================
# Stage 1: Build Stage
# ========================================
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript server
RUN npm run build

# Build React client
RUN npm run build:client

# ========================================
# Stage 2: Production Stage
# ========================================
FROM node:20-alpine

# Install FFmpeg and other runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    tzdata

# Set timezone to Asia/Tokyo
ENV TZ=Asia/Tokyo

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prompts.json ./prompts.json

# Copy static files if any
COPY --from=builder /app/public ./public

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })" || exit 1

# Start application
CMD ["node", "dist/server.js"]
```

**設計ポイント**:
1. **マルチステージビルド**: builder stageでビルド、production stageで実行
2. **Alpine Linux**: 軽量なベースイメージ（~5MB）
3. **FFmpegインストール**: 音声処理に必須
4. **非rootユーザー**: セキュリティベストプラクティス
5. **ヘルスチェック**: Cloud Runの自動再起動に対応
6. **タイムゾーン設定**: ログのタイムスタンプを日本時間に

#### 2.2.3 予想イメージサイズ

- Builder stage: ~800MB（ビルドツール含む）
- Production stage: ~250-300MB（FFmpeg, Node.js, アプリコード）
  - node:20-alpine: ~120MB
  - FFmpeg: ~50MB
  - npm modules (production): ~80MB
  - アプリコード: ~10MB

### 2.3 .dockerignore設計

```dockerignore
# Git
.git
.gitignore

# Node modules (will be installed in container)
node_modules

# Build outputs (will be rebuilt)
dist

# Development files
.env
.env.local
*.log
npm-debug.log*

# IDE
.vscode
.idea
*.swp
*.swo

# Test files
**/*.test.ts
**/*.test.tsx
**/__tests__

# Documentation
*.md
!README.md
docs

# Tasks and project management
tasks
.claude

# Temporary files
tmp
temp
*.tmp

# User uploads (should be stored in cloud storage)
uploads/*
history/*
transcripts/*

# OS files
.DS_Store
Thumbs.db
```

**設計ポイント**:
1. **node_modules除外**: コンテナ内でnpm ciで再インストール
2. **dist除外**: コンテナ内でビルド
3. **環境変数ファイル除外**: Cloud Runの環境変数で管理
4. **ユーザーデータ除外**: 本番ではCloud StorageやDBを使用想定

### 2.4 Cloud Run設定

#### 2.4.1 必要な環境変数

```bash
OPENAI_API_KEY=<your-api-key>
PORT=8080  # Cloud Run default
NODE_ENV=production
```

#### 2.4.2 推奨設定

```yaml
# cloud-run.yaml (参考)
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: youtube-ai-assistant
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: '10'
        autoscaling.knative.dev/minScale: '0'
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
      - image: gcr.io/PROJECT_ID/youtube-ai-assistant:latest
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: production
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openai-api-key
              key: latest
        resources:
          limits:
            cpu: '2'
            memory: 2Gi
          requests:
            cpu: '1'
            memory: 512Mi
```

**設計ポイント**:
1. **CPU/メモリ**: 動画処理のため2CPU/2GBメモリ確保
2. **タイムアウト**: 長時間処理に対応するため300秒
3. **オートスケーリング**: 最小0（コスト削減）、最大10（負荷分散）
4. **シークレット管理**: Cloud Secret Managerでapi-key管理

#### 2.4.3 コスト見積もり

**前提**:
- リクエスト数: 月100リクエスト
- 平均処理時間: 30秒
- メモリ: 2GB
- CPU: 2vCPU

**Cloud Run料金** (東京リージョン):
- CPU時間: 100 req × 30s × 2 vCPU = 6000 vCPU-seconds ≈ $0.02
- メモリ: 100 req × 30s × 2GB = 6000 GB-seconds ≈ $0.01
- リクエスト: 100 req × $0.0000004 = $0.00004

**月額合計**: ~$0.03 (無料枠内)

### 2.5 デプロイ手順設計

#### 2.5.1 ローカルDockerビルド

```bash
# 1. イメージビルド
docker build -t youtube-ai-assistant .

# 2. ローカル起動テスト
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=<your-key> \
  youtube-ai-assistant

# 3. 動作確認
curl http://localhost:3000/api/health
```

#### 2.5.2 Cloud Runデプロイ

```bash
# 1. Google Cloud認証
gcloud auth login

# 2. プロジェクト設定
gcloud config set project <PROJECT_ID>

# 3. Container Registryに push
gcloud builds submit --tag gcr.io/<PROJECT_ID>/youtube-ai-assistant

# 4. Cloud Runにデプロイ
gcloud run deploy youtube-ai-assistant \
  --image gcr.io/<PROJECT_ID>/youtube-ai-assistant \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars NODE_ENV=production \
  --set-secrets OPENAI_API_KEY=openai-api-key:latest
```

#### 2.5.3 動作確認

```bash
# デプロイ後のURL取得
SERVICE_URL=$(gcloud run services describe youtube-ai-assistant \
  --platform managed \
  --region asia-northeast1 \
  --format 'value(status.url)')

# ヘルスチェック
curl $SERVICE_URL/api/health

# YouTube動画テスト
curl -X POST $SERVICE_URL/api/upload-youtube \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=test", "language": "ja", "gptModel": "gpt-4o-mini"}'
```

---

## 3. 実装詳細

### 3.1 README.md変更

**ファイル**: `README.md`

**変更内容**:
1. 目次セクションを先頭に追加（5-6行目あたり）
2. ドキュメントセクションを新規追加（70-80行目あたり）
3. Dockerデプロイセクションを新規追加（80-120行目あたり）

**サンプル** (Dockerセクション):
```markdown
## 🐳 Docker / Cloud Runデプロイ

### ローカルDockerビルド

docker build -t youtube-ai-assistant .
docker run -p 3000:3000 -e OPENAI_API_KEY=<your-key> youtube-ai-assistant


### Google Cloud Runデプロイ

詳細な手順は [デプロイガイド](docs/deployment.md) を参照してください。

bash
# ビルドとプッシュ
gcloud builds submit --tag gcr.io/<PROJECT_ID>/youtube-ai-assistant

# デプロイ
gcloud run deploy youtube-ai-assistant \
  --image gcr.io/<PROJECT_ID>/youtube-ai-assistant \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --set-secrets OPENAI_API_KEY=openai-api-key:latest

```

### 3.2 Dockerfile作成

**ファイル**: `Dockerfile` (新規作成、プロジェクトルート)

**内容**: セクション2.2.2参照

### 3.3 .dockerignore作成

**ファイル**: `.dockerignore` (新規作成、プロジェクトルート)

**内容**: セクション2.3参照

### 3.4 デプロイガイド作成（オプション）

**ファイル**: `docs/deployment.md` (新規作成)

**内容**:
- 前提条件（GCPアカウント、gcloud CLI）
- Secret Manager設定手順
- 初回デプロイ手順
- 更新デプロイ手順
- カスタムドメイン設定
- トラブルシューティング

### 3.5 ヘルスチェックエンドポイント追加

**ファイル**: `src/server.ts`

**追加コード**:
```typescript
// Health check endpoint for Docker/Cloud Run
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});
```

**理由**: Dockerのヘルスチェックとliveness probeに使用

---

## 4. データモデル

このタスクではデータモデルの変更はありません。

---

## 5. テスト戦略

### 5.1 ローカルDockerテスト

**目的**: Dockerイメージが正常にビルド・起動するか確認

**手順**:
```bash
# 1. ビルドテスト
docker build -t youtube-ai-assistant:test .

# 2. 起動テスト
docker run -d -p 3001:3000 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  --name youtube-test \
  youtube-ai-assistant:test

# 3. ヘルスチェック
curl http://localhost:3001/api/health

# 4. 機能テスト
curl -X POST http://localhost:3001/api/upload-youtube \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "language": "en", "gptModel": "gpt-4o-mini"}'

# 5. クリーンアップ
docker stop youtube-test
docker rm youtube-test
```

**期待結果**:
- ✅ ビルド成功（エラーなし）
- ✅ ヘルスチェックが200 OKを返す
- ✅ YouTube動画の処理が成功

### 5.2 Cloud Run環境テスト

**目的**: Cloud Run環境で正常動作するか確認

**手順**:
1. テスト用プロジェクトにデプロイ
2. ヘルスチェック確認
3. 短い動画（1-2分）で処理テスト
4. 長い動画（10分以上）で処理テスト
5. PDF処理テスト
6. チャット機能テスト

**チェックリスト**:
- [ ] コールドスタート時間 < 10秒
- [ ] 短い動画処理 < 60秒
- [ ] 長い動画処理 < 300秒（タイムアウト設定以内）
- [ ] エラーログが適切に記録される
- [ ] メモリ使用量が制限内に収まる
- [ ] 環境変数が正しく読み込まれる

### 5.3 負荷テスト（オプション）

**ツール**: Apache Bench or Locust

**シナリオ**:
```bash
# 10並列リクエスト × 50回
ab -n 50 -c 10 -p test-payload.json \
  -T "application/json" \
  https://<SERVICE_URL>/api/upload-youtube
```

**期待結果**:
- オートスケーリングが正常動作
- 全リクエストが正常完了
- 平均応答時間 < 30秒

### 5.4 リグレッションテスト

**目的**: 既存機能が壊れていないか確認

**テスト項目**:
1. YouTube URL処理（字幕あり/なし）
2. PDF URL処理
3. ビデオファイルアップロード
4. オーディオファイルアップロード
5. 履歴読み込み
6. チャット機能
7. 記事生成

**実施タイミング**: Dockerビルド後、本番デプロイ前

---

## 6. セキュリティ考慮事項

### 6.1 APIキー管理

**課題**: OpenAI APIキーの安全な管理

**対策**:
1. **Secret Manager使用**: GCP Secret Managerで管理
2. **環境変数からの読み取り**: Dockerfile内でハードコードしない
3. **最小権限**: APIキーのスコープを必要最小限に

```bash
# Secret Manager設定例
gcloud secrets create openai-api-key \
  --data-file=<(echo -n "$OPENAI_API_KEY") \
  --replication-policy="automatic"

# Cloud Runに権限付与
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:<SERVICE_ACCOUNT>@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 6.2 CORS設定

**現状**: `cors` middleware使用

**改善案**:
```typescript
// src/server.ts
import cors from 'cors';

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://your-domain.com',
  'https://www.your-domain.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

### 6.3 HTTPS強制

**Cloud Run**: デフォルトでHTTPS強制済み

**カスタムドメイン使用時**: Cloud Load BalancerでHTTPS→HTTPリダイレクト設定

### 6.4 DoS対策

**課題**: 大量リクエストによるサービス妨害

**対策**:
1. **Rate Limiting**: express-rate-limit使用
2. **タイムアウト設定**: 長時間処理のタイムアウト（300秒）
3. **ファイルサイズ制限**: multerで最大サイズ制限（既存: 100MB）

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 最大100リクエスト
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

### 6.5 依存関係の脆弱性スキャン

```bash
# npm audit
npm audit fix

# Snyk (推奨)
npx snyk test
npx snyk monitor
```

---

## 7. パフォーマンス考慮事項

### 7.1 コールドスタート最適化

**課題**: Cloud Runのコールドスタート時間

**現状予想**: 5-10秒

**改善策**:
1. **最小インスタンス設定**: 1インスタンス常駐（有料）
2. **イメージサイズ削減**: マルチステージビルドで250MB以下
3. **起動スクリプト最適化**: 遅延初期化を避ける

```typescript
// 改善例: OpenAIクライアントの初期化を最初のリクエスト時ではなく起動時に
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// サーバー起動時にpingして初期化
openai.models.list().catch(console.error);
```

### 7.2 メモリ使用量最適化

**課題**: 大容量動画処理時のメモリ逼迫

**現状**: 2GBメモリ設定

**モニタリング**:
```typescript
// ヘルスチェックでメモリ使用量を記録
app.get('/api/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: 'healthy',
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    }
  });
});
```

**改善策**:
- Stream処理の活用
- 一時ファイルの適切なクリーンアップ
- メモリリーク検出（--inspect flag使用）

### 7.3 ビルド時間最適化

**現状予想**: 5-8分

**改善策**:
1. **レイヤーキャッシング**: package.jsonのCOPYを先に行う（既に実装済み）
2. **Cloud Buildキャッシュ**: `--cache-from`オプション使用

```bash
gcloud builds submit \
  --tag gcr.io/<PROJECT_ID>/youtube-ai-assistant \
  --cache-from gcr.io/<PROJECT_ID>/youtube-ai-assistant:latest
```

### 7.4 応答時間最適化

**目標**:
- ヘルスチェック: < 100ms
- 短い動画（1分）: < 30秒
- 長い動画（10分）: < 180秒

**モニタリング**: Cloud Logging + Cloud Trace

---

## 8. 未解決の設計課題

### 8.1 ファイルストレージ

**課題**: 現在はローカルファイルシステム保存（`uploads/`, `history/`, `transcripts/`）

**Cloud Run環境の制約**:
- ファイルシステムは一時的（コンテナ再起動で消失）
- 複数インスタンス間で共有不可

**検討事項**:
1. **Google Cloud Storage使用**: 永続的ストレージ
2. **Firestore使用**: 履歴データの保存
3. **Cloud SQL使用**: リレーショナルデータの保存

**推奨方向性**:
- アップロードファイル → Cloud Storage
- 履歴・メタデータ → Firestore
- コスト・使用状況 → Cloud SQL or Firestore

**影響範囲**: 中規模のコード変更が必要（別タスク推奨）

### 8.2 CI/CDパイプライン

**課題**: 現在は手動デプロイのみ

**検討事項**:
1. **GitHub Actions**: mainブランチpush時に自動デプロイ
2. **Cloud Build**: GCP nativeなビルド・デプロイ
3. **テスト自動化**: ビルド前に自動テスト実行

**推奨方向性**:
GitHub Actions + Cloud Buildの組み合わせ

**影響範囲**: `.github/workflows/`の追加が必要（別タスク推奨）

### 8.3 モニタリング・ロギング

**課題**: 現状はコンソールログのみ

**検討事項**:
1. **Cloud Logging**: 構造化ログの収集
2. **Cloud Monitoring**: メトリクス可視化
3. **Cloud Trace**: 分散トレーシング
4. **Error Reporting**: エラー集約

**推奨方向性**:
Winston + Google Cloud Logging Transport

**影響範囲**: ロギングライブラリの追加が必要（別タスク推奨）

### 8.4 カスタムドメイン

**課題**: `*.run.app` ドメインではなく独自ドメイン使用

**検討事項**:
1. Cloud Load Balancer設定
2. SSL証明書取得（Let's Encrypt or Cloud Certificate Manager）
3. DNS設定（Cloud DNS or外部DNS）

**推奨方向性**:
Cloud Load Balancer + Cloud Certificate Manager

**影響範囲**: インフラ設定のみ（コード変更不要、別タスク推奨）

---

## 9. 実装スケジュール

### Phase 1: README整備（優先度: 高）
- **所要時間**: 30分
- **タスク**:
  1. 目次追加
  2. ドキュメントセクション追加
  3. Dockerセクション追加（基本的な手順のみ）

### Phase 2: Docker化（優先度: 高）
- **所要時間**: 2時間
- **タスク**:
  1. Dockerfile作成
  2. .dockerignore作成
  3. ヘルスチェックエンドポイント追加
  4. ローカルビルド・テスト

### Phase 3: Cloud Run対応（優先度: 中）
- **所要時間**: 2時間
- **タスク**:
  1. Secret Manager設定
  2. Cloud Runデプロイ
  3. 動作確認
  4. デプロイ手順ドキュメント化

### Phase 4: 追加ドキュメント（優先度: 低）
- **所要時間**: 1時間
- **タスク**:
  1. docs/deployment.md作成
  2. トラブルシューティング追記

**総所要時間**: 5.5時間

---

## 10. 参考資料

### 10.1 公式ドキュメント

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Dockerfile Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)

### 10.2 参考プロジェクト

- [Google Cloud Run Samples](https://github.com/GoogleCloudPlatform/cloud-run-samples)
- [Express.js in Docker](https://github.com/vercel/next.js/tree/canary/examples/with-docker)

---

## 11. 付録

### 11.1 環境変数一覧

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|-------------|------|
| `OPENAI_API_KEY` | OpenAI APIキー | なし | ✅ |
| `PORT` | サーバーポート | 3000 | ❌ |
| `NODE_ENV` | 実行環境 | development | ❌ |
| `ALLOWED_ORIGINS` | CORS許可オリジン | なし | ❌ |
| `MOCK_OPENAI` | モックモード | false | ❌ |

### 11.2 Cloud Runリソース設定

| 項目 | 推奨値 | 理由 |
|------|--------|------|
| CPU | 2 vCPU | 動画処理の並列実行 |
| Memory | 2 GiB | FFmpegの音声処理 |
| Timeout | 300s | 長時間動画対応 |
| Concurrency | 80 | リクエスト並列処理 |
| Min instances | 0 | コスト削減 |
| Max instances | 10 | 負荷分散 |

---

**設計完了日**: 2025-10-26
**設計者**: Claude Code AI Assistant
**レビュー状況**: Pending
