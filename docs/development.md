# Development & CI/CD Guide

YouTube AI Assistantの開発ワークフローとCI/CD環境の使い方を説明します。

---

## 📋 Table of Contents

- [Overview](#overview)
- [Development Workflow](#development-workflow)
- [Environments](#environments)
- [CI/CD Pipelines](#cicd-pipelines)
- [PR Preview Environments](#pr-preview-environments)
- [Setup Instructions](#setup-instructions)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Overview

### Architecture

このプロジェクトは**Trunk-based development**と**PR Preview**を採用したモダンなCI/CDアーキテクチャを使用しています。

```
feature/* → PR作成 → PR Preview環境で確認
             ↓ マージ
          main ブランチ
             ↓ 自動デプロイ
          Dev環境（統合確認）
             ↓ 手動デプロイ
          Staging環境（本番前確認）
             ↓ 手動デプロイ + 承認
          Production環境（本番）
```

### Key Features

- ✅ **Automated CI**: 型チェック、Lint、ビルドが自動実行
- ✅ **PR Preview**: 各PRに独立した環境を自動作成
- ✅ **Continuous Deployment**: mainブランチへのpushでDev環境に自動デプロイ
- ✅ **Zero-downtime**: ヘルスチェック付きのローリングデプロイ
- ✅ **Secure**: Workload Identity Federation（サービスアカウントキー不要）

---

## Development Workflow

### 1. ローカル開発

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動（ホットリロード）
npm run dev

# 別ターミナルでクライアント開発サーバー
npm run dev:client
```

ブラウザで `http://localhost:5173` にアクセス（クライアント）
APIは `http://localhost:3000` で動作

### 2. 機能開発

```bash
# feature ブランチを作成
git checkout -b feature/new-feature

# コード実装

# 型チェック
npm run type-check

# Lint
npm run lint

# フォーマット
npm run format

# ビルド確認
npm run build:all
```

### 3. PR作成

```bash
# 変更をコミット
git add .
git commit -m "feat: add new feature"

# ブランチをプッシュ
git push -u origin feature/new-feature
```

GitHubでPRを作成すると：
1. **CI Pipeline**が自動実行（型チェック、Lint、ビルド）
2. **PR Preview環境**が自動デプロイ
3. PRにプレビューURLが自動コメントされる

### 4. レビューとマージ

- PRのプレビューURLで動作確認
- レビュアーも同じURLで確認可能
- CIが全てパスしたらマージ
- マージ後、PR Preview環境は自動削除

### 5. Dev環境での確認

mainにマージすると自動的にDev環境にデプロイされます。
複数のPRがマージされた後の統合確認に使用します。

---

## Environments

### 環境一覧

| 環境 | URL | デプロイ方法 | 用途 |
|------|-----|------------|------|
| **Local** | localhost:5173 | `npm run dev` | ローカル開発 |
| **PR Preview** | `youtube-ai-pr-{N}.run.app` | 自動（PR作成時） | PR確認・レビュー |
| **Dev** | `youtube-ai-dev.run.app` | 自動（main push時） | 統合確認 |
| **Staging** | `youtube-ai-stg.run.app` | 手動 | 本番前の最終確認 |
| **Production** | `youtube-ai-prod.run.app` | 手動 + 承認 | 本番環境 |

### 環境別の設定

| 設定項目 | Dev | Staging | Production |
|---------|-----|---------|-----------|
| CPU | 1 vCPU | 2 vCPU | 2 vCPU |
| Memory | 1 GB | 2 GB | 2 GB |
| Min Instances | 0 | 0 | 1 |
| Max Instances | 3 | 5 | 10 |
| Secret | openai-api-key-dev | openai-api-key-stg | openai-api-key-prod |
| Service Account | sa-dev | sa-stg | sa-prod |

---

## CI/CD Pipelines

### CI Pipeline (`.github/workflows/ci.yml`)

**トリガー**: 全ブランチへのpush、PRの作成/更新

**実行内容**:
1. Node.js 20のセットアップ
2. 依存関係のインストール（`npm ci`）
3. TypeScript型チェック
4. ESLint
5. Prettier format check
6. サーバービルド
7. クライアントビルド

**所要時間**: 約3-5分

**失敗時**:
- PRはマージできません
- エラーメッセージを確認して修正

### CD - Dev Pipeline (`.github/workflows/cd-dev.yml`)

**トリガー**: mainブランチへのpush、手動実行

**実行内容**:
1. Workload Identity Federationで認証
2. Dockerイメージのビルド
3. Artifact Registryへpush
4. Cloud Runにデプロイ（youtube-ai-dev）
5. ヘルスチェック

**所要時間**: 約5-7分

**自動ロールバック**: ヘルスチェック失敗時

### PR Preview Pipeline (`.github/workflows/pr-preview.yml`)

**トリガー**: PRの作成、更新、再オープン

**実行内容**:
1. PRごとに独立したCloud Runサービスを作成
   - サービス名: `youtube-ai-pr-{PR番号}`
2. Dockerイメージのビルドとデプロイ
3. ヘルスチェック
4. PRにプレビューURLをコメント

**リソース**: 512MB / 1 vCPU（最小構成）

**PR Previewの使い方**:
```markdown
## PRにコメントされる内容

🚀 Preview Environment Deployed

**URL**: https://youtube-ai-pr-123.run.app

**Status**: ✅ Health check passed

### Testing Checklist
- [ ] Application loads successfully
- [ ] YouTube video processing works
- [ ] PDF upload and processing works
- [ ] Chat functionality works
- [ ] No console errors
```

### PR Cleanup Pipeline (`.github/workflows/pr-cleanup.yml`)

**トリガー**: PRのclose/merge

**実行内容**:
1. PR Preview環境の存在確認
2. Cloud Runサービスの削除
3. PRにクリーンアップ完了をコメント

**コスト最適化**: 不要な環境を自動削除

---

## PR Preview Environments

### メリット

1. **マージ前に本番に近い環境で確認**
   - localhostではなく実際のCloud Run
   - 実際のSecret Managerを使用
   - 本番と同じDockerイメージ

2. **レビュアーも確認可能**
   - URLを共有するだけ
   - 環境構築不要

3. **独立した環境**
   - 他のPRと干渉しない
   - 自分のペースで確認できる

4. **自動クリーンアップ**
   - PR closeで自動削除
   - コスト管理が簡単

### 使い方

#### 実装者

1. PRを作成
2. GitHub Actionsが自動的にデプロイ（3-5分待つ）
3. PRにコメントされたURLにアクセス
4. 動作確認
5. バグがあれば追加コミット → 自動的に再デプロイ

#### レビュアー

1. PRのコメントにあるURLをクリック
2. 実際に操作して確認
3. レビューコメントに「Preview環境で確認済み✅」と記載

### 制限事項

- メモリ: 512MB（Devより少ない）
- Max instances: 1
- 長時間の動画処理は制限される可能性あり
- Dev環境のAPIキーを共有（本番とは別）

---

## Setup Instructions

### 初回セットアップ（管理者のみ）

#### 1. GCP IAM設定

自動セットアップスクリプトを実行:

```bash
./scripts/setup-gcp-iam.sh
```

このスクリプトは以下を自動的に実行します:
- 必要なGCP APIの有効化
- 環境別サービスアカウント作成（sa-dev, sa-stg, sa-prod）
- Workload Identity Poolとプロバイダーの作成
- GitHubシークレットの作成

#### 2. Secret Managerにシークレットを作成

```bash
# Dev環境用
echo -n "YOUR_DEV_OPENAI_API_KEY" | gcloud secrets create openai-api-key-dev \
  --data-file=- --replication-policy=automatic

# Staging環境用
echo -n "YOUR_STG_OPENAI_API_KEY" | gcloud secrets create openai-api-key-stg \
  --data-file=- --replication-policy=automatic

# Production環境用
echo -n "YOUR_PROD_OPENAI_API_KEY" | gcloud secrets create openai-api-key-prod \
  --data-file=- --replication-policy=automatic
```

#### 3. サービスアカウントにシークレットアクセス権限を付与

```bash
PROJECT_ID=$(gcloud config get-value project)

# Dev
gcloud secrets add-iam-policy-binding openai-api-key-dev \
  --member="serviceAccount:sa-dev@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Staging
gcloud secrets add-iam-policy-binding openai-api-key-stg \
  --member="serviceAccount:sa-stg@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Production
gcloud secrets add-iam-policy-binding openai-api-key-prod \
  --member="serviceAccount:sa-prod@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### 4. Artifact Registry作成

```bash
gcloud artifacts repositories create apps \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="App containers"
```

#### 5. GitHub Environment設定

GitHubリポジトリの Settings → Environments で以下を作成:

**Development**:
- Environment name: `development`
- Protection rules: なし

**Staging** (将来):
- Environment name: `staging`
- Required reviewers: 1人以上

**Production** (将来):
- Environment name: `production`
- Required reviewers: 2人以上

---

## Deployment

### Dev環境へのデプロイ

**自動デプロイ** - mainブランチへのpushで自動実行:
```bash
git checkout main
git pull
# 自動的にデプロイされる
```

**手動デプロイ** - GitHub Actionsから:
1. Actions → "CD - Deploy to Dev" → "Run workflow"
2. ブランチ: main
3. "Run workflow"をクリック

### Staging環境へのデプロイ（将来）

```bash
# GitHub Actionsから手動実行
# Actions → "CD - Deploy to Staging" → "Run workflow"
```

### Production環境へのデプロイ（将来）

```bash
# バージョンタグを作成
git tag v1.0.0
git push origin v1.0.0

# GitHub Actionsが自動実行
# 承認者が承認するとデプロイ開始
```

---

## Troubleshooting

### CI Pipeline Failed

**原因**: 型エラー、Lintエラー、ビルドエラー

**解決方法**:
```bash
# ローカルで確認
npm run type-check
npm run lint
npm run build:all

# エラーを修正
npm run lint:fix
npm run format

# 再コミット
git add .
git commit -m "fix: resolve CI errors"
git push
```

### PR Preview Deployment Failed

**原因**: Dockerビルドエラー、Cloud Runデプロイエラー

**確認**:
1. GitHub Actionsのログを確認
2. Dockerfile の構文チェック
3. GCP IAM権限を確認

**ローカルでDockerビルドテスト**:
```bash
docker build -t test-image .
docker run -p 8080:8080 -e PORT=8080 test-image
```

### Health Check Failed

**原因**: アプリケーションが起動していない、/healthz エンドポイントが応答しない

**確認**:
```bash
# ローカルでヘルスチェックエンドポイントを確認
npm run dev

# 別ターミナルで
curl http://localhost:3000/healthz
```

### Permission Denied

**原因**: Workload Identity Federationの設定ミス、IAMロール不足

**確認**:
```bash
# サービスアカウントの存在確認
gcloud iam service-accounts list

# IAMロールの確認
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:sa-dev@*"
```

**再セットアップ**:
```bash
./scripts/setup-gcp-iam.sh
```

### Deployment Stuck

**原因**: Cloud Runのリソース不足、タイムアウト

**解決**:
1. Cloud Consoleで Cloud Run サービスを確認
2. ログを確認（Error Reporting）
3. 必要に応じてリソースを増やす

**手動ロールバック**:
```bash
# 前のリビジョンにロールバック
gcloud run services update-traffic SERVICE_NAME \
  --to-revisions=REVISION_NAME=100 \
  --region=asia-northeast1
```

### Secret Not Found

**原因**: Secret Managerにシークレットが作成されていない、アクセス権限がない

**確認**:
```bash
# シークレットの存在確認
gcloud secrets list

# シークレットのIAMポリシー確認
gcloud secrets get-iam-policy openai-api-key-dev
```

**再作成**:
```bash
echo -n "YOUR_API_KEY" | gcloud secrets create openai-api-key-dev \
  --data-file=- --replication-policy=automatic

# アクセス権限付与
gcloud secrets add-iam-policy-binding openai-api-key-dev \
  --member="serviceAccount:sa-dev@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Best Practices

### 1. コミットメッセージ

Conventional Commitsを使用:
```
feat: add new feature
fix: resolve bug
docs: update documentation
refactor: refactor code
test: add tests
chore: update dependencies
```

### 2. ブランチ命名

```
feature/feature-name
fix/bug-name
refactor/component-name
docs/document-name
```

### 3. PR作成

- タイトルはConventional Commits形式
- 説明に変更内容を詳しく記載
- PR Previewで動作確認してからレビュー依頼
- レビュアーにもPreview環境での確認を依頼

### 4. レビュー

- コードレビューだけでなく動作確認も必須
- PR Preview環境で実際に操作
- レビューコメントに「Preview環境で確認済み」と記載

### 5. デプロイ

- Dev環境で十分に確認してからStagingへ
- Stagingで問題がなければProductionへ
- 本番デプロイは慎重に（承認者2名以上）

---

## Monitoring & Logs

### Cloud Run Logs

```bash
# Dev環境のログを表示
gcloud run services logs read youtube-ai-dev \
  --region=asia-northeast1 \
  --limit=100
```

### GitHub Actions Logs

1. GitHub → Actions タブ
2. 該当のワークフロー実行をクリック
3. 各ステップのログを確認

### Error Reporting

[Cloud Console → Error Reporting](https://console.cloud.google.com/errors)

---

## Cost Management

### コスト削減のポイント

1. **Min instances = 0（Dev/Staging）**
   - 使わない時は課金されない
   - コールドスタートは許容

2. **PR Preview自動削除**
   - PR closeで即削除
   - 古いPreviewは7日で自動削除（将来実装）

3. **適切なリソース配分**
   - Dev: 1GB/1vCPU（最小限）
   - Staging: 2GB/2vCPU（本番同等）
   - Production: 2GB/2vCPU + Min instance 1

4. **Artifact Registry のクリーンアップ**
   - 古いイメージは定期的に削除
   - 保持ポリシーを設定

### コスト見積もり

**Dev環境** (月間):
- Cloud Run: ほぼ無料（無料枠内）
- Artifact Registry: ~$1
- Secret Manager: 無料

**PR Preview** (PR 1件あたり):
- Cloud Run: ~$0.10-0.50
- すぐ削除されるため低コスト

---

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Artifact Registry](https://cloud.google.com/artifact-registry/docs)

---

**Last Updated**: 2025-10-29
**Version**: 1.0.0
**Maintainer**: DevOps Team
