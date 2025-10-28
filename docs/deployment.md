# Google Cloud Run デプロイガイド

このガイドでは、YouTube AI AssistantをGoogle Cloud Runにデプロイする手順を詳しく説明します。

---

## 📋 目次

- [前提条件](#前提条件)
- [初回セットアップ](#初回セットアップ)
- [デプロイ手順](#デプロイ手順)
- [環境変数の設定](#環境変数の設定)
- [カスタムドメイン設定](#カスタムドメイン設定)
- [モニタリング](#モニタリング)
- [トラブルシューティング](#トラブルシューティング)
- [コスト見積もり](#コスト見積もり)

---

## 前提条件

### 必要なもの

1. **Googleアカウント**
   - Google Cloud Platform (GCP) にアクセス可能なアカウント

2. **gcloud CLI**
   - インストール: https://cloud.google.com/sdk/docs/install
   - バージョン確認:
     ```bash
     gcloud version
     ```

3. **OpenAI APIキー**
   - OpenAI Platform (https://platform.openai.com/) で取得
   - 課金設定が有効であること

4. **Docker**（ローカルテスト用）
   - インストール: https://docs.docker.com/get-docker/

### 推奨する前提知識

- Docker の基本的な使い方
- Google Cloud Platform の基礎知識
- コマンドラインの基本操作

---

## 初回セットアップ

### 1. GCPプロジェクトの作成

```bash
# 新しいプロジェクトを作成
gcloud projects create PROJECT_ID --name="YouTube AI Assistant"

# プロジェクトを選択
gcloud config set project PROJECT_ID

# 課金アカウントをリンク（必須）
gcloud beta billing accounts list
gcloud beta billing projects link PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
```

### 2. 必要なAPIの有効化

```bash
# Cloud Run API
gcloud services enable run.googleapis.com

# Container Registry API
gcloud services enable containerregistry.googleapis.com

# Cloud Build API
gcloud services enable cloudbuild.googleapis.com

# Secret Manager API
gcloud services enable secretmanager.googleapis.com
```

### 3. gcloud 認証とデフォルト設定

```bash
# Google アカウントで認証
gcloud auth login

# Application Default Credentials の設定
gcloud auth application-default login

# デフォルトリージョンの設定（東京）
gcloud config set run/region asia-northeast1
```

---

## デプロイ手順

### ステップ1: Secret Manager でAPIキーを設定

OpenAI APIキーを安全に保存します。

```bash
# シークレットを作成
echo -n "YOUR_OPENAI_API_KEY" | gcloud secrets create openai-api-key \
  --data-file=- \
  --replication-policy="automatic"

# シークレットが作成されたか確認
gcloud secrets list

# Cloud Run サービスアカウントに権限を付与
PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### ステップ2: Dockerイメージのビルドとプッシュ

#### 方法A: Cloud Build を使用（推奨）

```bash
# プロジェクトルートで実行
gcloud builds submit --tag gcr.io/PROJECT_ID/youtube-ai-assistant

# ビルド履歴を確認
gcloud builds list --limit=5
```

#### 方法B: ローカルビルド + プッシュ

```bash
# ローカルでビルド
docker build -t gcr.io/PROJECT_ID/youtube-ai-assistant .

# GCRに認証
gcloud auth configure-docker

# イメージをプッシュ
docker push gcr.io/PROJECT_ID/youtube-ai-assistant
```

### ステップ3: Cloud Run にデプロイ

```bash
gcloud run deploy youtube-ai-assistant \
  --image gcr.io/PROJECT_ID/youtube-ai-assistant \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-secrets OPENAI_API_KEY=openai-api-key:latest
```

#### パラメータ説明

| パラメータ | 値 | 理由 |
|-----------|-----|------|
| `--memory` | 2Gi | 動画処理とFFmpegのため |
| `--cpu` | 2 | 並列処理とパフォーマンス向上 |
| `--timeout` | 300 | 長時間動画の処理対応（5分） |
| `--concurrency` | 80 | 同時リクエスト数 |
| `--min-instances` | 0 | コスト削減（使用時のみ起動） |
| `--max-instances` | 10 | 負荷分散とコスト上限 |

### ステップ4: デプロイ確認

```bash
# サービスURLを取得
SERVICE_URL=$(gcloud run services describe youtube-ai-assistant \
  --platform managed \
  --region asia-northeast1 \
  --format 'value(status.url)')

echo "サービスURL: $SERVICE_URL"

# ヘルスチェック
curl $SERVICE_URL/api/health

# 期待される出力:
# {
#   "status": "healthy",
#   "timestamp": "2025-10-26T...",
#   "uptime": ...,
#   "memory": {...},
#   "version": "2.0.0"
# }
```

### ステップ5: 動作確認

```bash
# YouTube動画処理テスト
curl -X POST $SERVICE_URL/api/upload-youtube \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "language": "en",
    "gptModel": "gpt-4o-mini"
  }'
```

---

## 環境変数の設定

### 現在設定されている環境変数

```bash
# 環境変数一覧を確認
gcloud run services describe youtube-ai-assistant \
  --region asia-northeast1 \
  --format 'value(spec.template.spec.containers[0].env)'
```

### 環境変数の更新

```bash
# 新しい環境変数を追加
gcloud run services update youtube-ai-assistant \
  --region asia-northeast1 \
  --set-env-vars NEW_VAR=value

# 複数の環境変数を設定
gcloud run services update youtube-ai-assistant \
  --region asia-northeast1 \
  --set-env-vars VAR1=value1,VAR2=value2
```

### シークレットの更新

```bash
# 新しいシークレットバージョンを作成
echo -n "NEW_API_KEY" | gcloud secrets versions add openai-api-key \
  --data-file=-

# Cloud Run に新しいバージョンを適用（自動更新）
gcloud run services update youtube-ai-assistant \
  --region asia-northeast1 \
  --update-secrets OPENAI_API_KEY=openai-api-key:latest
```

---

## カスタムドメイン設定

### ドメインマッピング

```bash
# カスタムドメインをマッピング
gcloud run domain-mappings create \
  --service youtube-ai-assistant \
  --domain yourdomain.com \
  --region asia-northeast1

# DNS設定情報を取得
gcloud run domain-mappings describe \
  --domain yourdomain.com \
  --region asia-northeast1
```

### DNSレコードの設定

上記コマンドで取得したCNAMEレコードをDNSプロバイダー（Cloudflare、Route53など）に追加します。

**例**:
```
Type: CNAME
Name: yourdomain.com (または www)
Value: ghs.googlehosted.com
```

### SSL証明書

Cloud Run は自動的にLet's Encrypt証明書を発行します。DNS設定後、数分～数時間で有効になります。

---

## モニタリング

### Cloud Logging でログを確認

```bash
# リアルタイムログ
gcloud run services logs tail youtube-ai-assistant \
  --region asia-northeast1

# 過去1時間のログ
gcloud run services logs read youtube-ai-assistant \
  --region asia-northeast1 \
  --limit 50
```

### Cloud Monitoring でメトリクスを確認

Google Cloud Console で以下を確認できます:
- リクエスト数
- レスポンスタイム
- エラー率
- インスタンス数
- メモリ使用量
- CPU使用率

アクセス: https://console.cloud.google.com/run

### アラート設定

```bash
# エラー率が5%を超えたら通知
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Cloud Run Error Rate Alert" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05
```

---

## トラブルシューティング

### 問題1: デプロイが失敗する

**症状**: `gcloud run deploy` がエラーで終了

**解決策**:
```bash
# ビルドログを確認
gcloud builds list --limit=1
gcloud builds log BUILD_ID

# よくある原因:
# 1. Dockerfile のシンタックスエラー → Dockerfile を修正
# 2. メモリ不足 → Cloud Build のマシンタイプを変更
# 3. タイムアウト → --timeout フラグを増やす
```

### 問題2: コンテナが起動しない

**症状**: デプロイは成功するが、サービスがエラーを返す

**解決策**:
```bash
# コンテナログを確認
gcloud run services logs read youtube-ai-assistant \
  --region asia-northeast1 \
  --limit 100

# よくある原因:
# 1. PORT環境変数の不一致 → Dockerfile で PORT=8080 を設定
# 2. 依存関係エラー → package.json を確認
# 3. シークレットアクセスエラー → IAM権限を確認
```

### 問題3: タイムアウトエラー

**症状**: 長い動画の処理中にタイムアウト

**解決策**:
```bash
# タイムアウトを延長（最大3600秒）
gcloud run services update youtube-ai-assistant \
  --region asia-northeast1 \
  --timeout 600
```

### 問題4: メモリ不足エラー

**症状**: `Memory limit exceeded` エラー

**解決策**:
```bash
# メモリを増やす（最大32Gi）
gcloud run services update youtube-ai-assistant \
  --region asia-northeast1 \
  --memory 4Gi
```

### 問題5: Cold Start が遅い

**症状**: 最初のリクエストに10秒以上かかる

**解決策**:
```bash
# 最小インスタンス数を1に設定（有料）
gcloud run services update youtube-ai-assistant \
  --region asia-northeast1 \
  --min-instances 1
```

### ログの高度な検索

```bash
# エラーログのみ抽出
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=youtube-ai-assistant AND \
  severity>=ERROR" \
  --limit 50 \
  --format json

# 特定の時間範囲のログ
gcloud logging read "resource.type=cloud_run_revision AND \
  timestamp>=\"2025-10-26T00:00:00Z\"" \
  --limit 100
```

---

## コスト見積もり

### 料金計算の基準（東京リージョン）

**Cloud Run 料金**:
- CPU時間: $0.00002400 / vCPU秒
- メモリ: $0.00000250 / GiB秒
- リクエスト: $0.40 / 100万リクエスト

**無料枠**（毎月）:
- CPU時間: 180,000 vCPU秒
- メモリ: 360,000 GiB秒
- リクエスト: 200万リクエスト

### シナリオ別コスト見積もり

#### シナリオ1: 小規模利用（月100リクエスト）

**前提**:
- リクエスト数: 100回/月
- 平均処理時間: 30秒
- メモリ: 2GB
- CPU: 2vCPU

**計算**:
```
CPU時間: 100 × 30秒 × 2 vCPU = 6,000 vCPU秒
メモリ: 100 × 30秒 × 2 GB = 6,000 GB秒
リクエスト: 100回

CPU料金: 6,000 × $0.000024 = $0.144
メモリ料金: 6,000 × $0.0000025 = $0.015
リクエスト料金: 100 × $0.0000004 = $0.00004

月額合計: $0.16 （無料枠内）
```

#### シナリオ2: 中規模利用（月1,000リクエスト）

**前提**:
- リクエスト数: 1,000回/月
- 平均処理時間: 45秒
- メモリ: 2GB
- CPU: 2vCPU

**計算**:
```
CPU時間: 1,000 × 45秒 × 2 = 90,000 vCPU秒
メモリ: 1,000 × 45秒 × 2 = 90,000 GB秒
リクエスト: 1,000回

CPU料金: 90,000 × $0.000024 = $2.16
メモリ料金: 90,000 × $0.0000025 = $0.225
リクエスト料金: 1,000 × $0.0000004 = $0.0004

月額合計: $2.39
```

#### シナリオ3: 最小インスタンス1台常駐

**前提**:
- 最小インスタンス: 1台
- 稼働時間: 730時間/月（常時）
- メモリ: 2GB
- CPU: 2vCPU
- アイドル時のCPU使用率: 10%

**計算**:
```
CPU時間: 730時間 × 3600秒 × 2 vCPU × 0.1 = 525,600 vCPU秒
メモリ: 730時間 × 3600秒 × 2 GB = 5,256,000 GB秒

CPU料金: (525,600 - 180,000) × $0.000024 = $8.29
メモリ料金: (5,256,000 - 360,000) × $0.0000025 = $12.24

月額合計: $20.53
```

### コスト削減のヒント

1. **最小インスタンス = 0** に設定（使用時のみ起動）
2. **不要なログを削減** - ログ保存料金を節約
3. **リージョンの選択** - 最も近いリージョンを使用
4. **処理時間の最適化** - コードのパフォーマンス改善
5. **メモリの適正化** - 実際の使用量に合わせて調整

---

## 更新とロールバック

### サービスの更新

```bash
# 新しいイメージをビルド
gcloud builds submit --tag gcr.io/PROJECT_ID/youtube-ai-assistant

# 新しいバージョンをデプロイ（自動的にトラフィックが移行）
gcloud run deploy youtube-ai-assistant \
  --image gcr.io/PROJECT_ID/youtube-ai-assistant \
  --region asia-northeast1
```

### リビジョンの管理

```bash
# 全リビジョンを表示
gcloud run revisions list \
  --service youtube-ai-assistant \
  --region asia-northeast1

# 特定のリビジョンにトラフィックを分割
gcloud run services update-traffic youtube-ai-assistant \
  --to-revisions REVISION_1=50,REVISION_2=50 \
  --region asia-northeast1
```

### ロールバック

```bash
# 以前のリビジョンに戻す
gcloud run services update-traffic youtube-ai-assistant \
  --to-revisions PREVIOUS_REVISION=100 \
  --region asia-northeast1

# または、以前のリビジョンを再デプロイ
gcloud run deploy youtube-ai-assistant \
  --image gcr.io/PROJECT_ID/youtube-ai-assistant@sha256:OLD_SHA \
  --region asia-northeast1
```

---

## セキュリティベストプラクティス

### 1. 認証の追加（オプション）

```bash
# 認証必須に変更
gcloud run services update youtube-ai-assistant \
  --region asia-northeast1 \
  --no-allow-unauthenticated

# サービスアカウントを作成して権限を付与
gcloud iam service-accounts create youtube-ai-invoker

gcloud run services add-iam-policy-binding youtube-ai-assistant \
  --region asia-northeast1 \
  --member="serviceAccount:youtube-ai-invoker@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

### 2. VPC コネクタ（プライベートネットワーク）

```bash
# VPCコネクタを作成
gcloud compute networks vpc-access connectors create youtube-ai-connector \
  --region asia-northeast1 \
  --range 10.8.0.0/28

# Cloud Run に適用
gcloud run services update youtube-ai-assistant \
  --region asia-northeast1 \
  --vpc-connector youtube-ai-connector
```

### 3. Binary Authorization（イメージ検証）

```bash
# Binary Authorization を有効化
gcloud services enable binaryauthorization.googleapis.com

# ポリシーを設定
gcloud beta run services update youtube-ai-assistant \
  --region asia-northeast1 \
  --binary-authorization default
```

---

## まとめ

このガイドに従うことで、YouTube AI AssistantをGoogle Cloud Runに安全かつ効率的にデプロイできます。

**デプロイ後のチェックリスト**:
- [ ] ヘルスチェックが正常に応答する
- [ ] YouTube動画処理が動作する
- [ ] PDF処理が動作する
- [ ] チャット機能が動作する
- [ ] ログが正常に記録されている
- [ ] メモリ使用量が適正範囲内
- [ ] コストが予算内に収まっている

**参考リンク**:
- [Cloud Run 公式ドキュメント](https://cloud.google.com/run/docs)
- [Secret Manager ドキュメント](https://cloud.google.com/secret-manager/docs)
- [Cloud Run 料金](https://cloud.google.com/run/pricing)
- [Cloud Logging ドキュメント](https://cloud.google.com/logging/docs)

---

**最終更新**: 2025-10-26
**バージョン**: 1.0.0
