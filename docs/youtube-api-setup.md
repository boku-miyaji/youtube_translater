# YouTube Data API v3 セットアップガイド

## 概要

このアプリケーションは YouTube Data API v3 を使用して動画のメタデータを取得します。

## なぜ YouTube Data API v3 が必要か

### 以前の問題

- 非公式ライブラリ (`ytdl-core`) を使用
- YouTube が bot として検出してブロック
- エラー: "Sign in to confirm you're not a bot"

### 現在の解決策

- **公式 API** を使用することで bot 検出を完全に回避
- **適切なレート制限** とキャッシュで YouTube サーバーへの負荷を最小化
- **利用規約に準拠** した安全な方法

## セットアップ手順

### ステップ 1: Google Cloud Console にアクセス

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. Google アカウントでログイン

### ステップ 2: プロジェクトを作成

1. 画面上部の「プロジェクトを選択」をクリック
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例: "youtube-transcription"）
4. 「作成」をクリック

### ステップ 3: YouTube Data API v3 を有効化

1. 左側のメニューから「API とサービス」→「ライブラリ」を選択
2. 検索バーに「YouTube Data API v3」と入力
3. 「YouTube Data API v3」を選択
4. 「有効にする」をクリック

### ステップ 4: API キーを作成

1. 左側のメニューから「API とサービス」→「認証情報」を選択
2. 「認証情報を作成」→「API キー」をクリック
3. API キーが生成されます
4. **重要**: API キーをコピーして安全な場所に保存

### ステップ 5: API キーを制限（推奨）

セキュリティのため、API キーを制限することを強く推奨します。

1. 生成された API キーの横にある「編集」アイコンをクリック
2. 「アプリケーションの制限」セクション:
   - **開発環境**: 「なし」を選択
   - **本番環境**: 「IP アドレス」を選択して、サーバーの IP を追加

3. 「API の制限」セクション:
   - 「キーを制限」を選択
   - 「YouTube Data API v3」のみにチェック

4. 「保存」をクリック

### ステップ 6: 環境変数を設定

#### ローカル開発環境

1. プロジェクトの `.env` ファイルを開く
2. 以下の行を追加:

```bash
YOUTUBE_API_KEY=YOUR_API_KEY_HERE
```

3. `YOUR_API_KEY_HERE` を実際の API キーに置き換え
4. ファイルを保存

#### 本番環境（Cloud Run）

**方法 A: 環境変数として直接設定（シンプル、推奨）**

Google Cloud Console から:

1. [Cloud Run コンソール](https://console.cloud.google.com/run) にアクセス
2. サービスを選択
3. 「新しいリビジョンを編集してデプロイ」をクリック
4. 「変数とシークレット」タブを選択
5. **「変数」セクション**で「変数を追加」をクリック
6. 以下を入力:
   - **名前**: `YOUTUBE_API_KEY`
   - **値**: `your_actual_api_key`
7. 「デプロイ」をクリック

**方法 B: Secret Manager を使用（より安全、推奨）**

⚠️ **重要**: Secret Manager にシークレットを作成しただけでは不十分です。環境変数として**公開**する必要があります。

1. まず、Secret Manager にシークレットを作成:
   - [Secret Manager](https://console.cloud.google.com/security/secret-manager) にアクセス
   - 「シークレットを作成」をクリック
   - **名前**: `youtube-api-key`
   - **シークレットの値**: `your_actual_api_key`
   - 「シークレットを作成」をクリック

2. **重要**: Cloud Run サービスアカウントにシークレットへのアクセス権を付与:
   - Secret Manager で作成したシークレット `youtube-api-key` をクリック
   - 右側の **「権限」** タブをクリック
   - **「アクセス権を付与」** をクリック
   - **新しいプリンシパル**: Cloud Run サービスアカウント（例: `sa-dev@your-project.iam.gserviceaccount.com`）
   - **ロール**: `Secret Manager のシークレット アクセサー` を選択
   - **「保存」** をクリック

   💡 サービスアカウント名の確認方法:
   ```bash
   gcloud run services describe youtube-translater \
     --region=asia-northeast1 \
     --format='value(spec.template.spec.serviceAccountName)'
   ```

3. 次に、Cloud Run でシークレットを環境変数として公開:
   - [Cloud Run コンソール](https://console.cloud.google.com/run) にアクセス
   - サービスを選択
   - 「新しいリビジョンを編集してデプロイ」をクリック
   - 「変数とシークレット」タブを選択
   - **「シークレットを参照」セクション**で「シークレットを参照」をクリック
   - Secret Manager から `youtube-api-key` を選択
   - 「環境変数として公開」を選択
   - **環境変数名**: `YOUTUBE_API_KEY` と入力（正確に）
   - **バージョン**: `latest` を選択
   - 「完了」→「デプロイ」をクリック

**gcloud CLI から設定:**

方法 A: 環境変数として直接設定:
```bash
gcloud run services update youtube-translater \
  --set-env-vars YOUTUBE_API_KEY=your_actual_api_key \
  --region asia-northeast1
```

方法 B: Secret Manager から設定（事前にシークレット作成が必要）:
```bash
# 1. Secret Manager にシークレットを作成（初回のみ）
echo -n "your_actual_api_key" | gcloud secrets create youtube-api-key \
  --data-file=- \
  --replication-policy=automatic

# 2. Cloud Run サービスアカウントにシークレットへのアクセス権を付与
SERVICE_ACCOUNT=$(gcloud run services describe youtube-translater \
  --region=asia-northeast1 \
  --format='value(spec.template.spec.serviceAccountName)')

gcloud secrets add-iam-policy-binding youtube-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

# 3. Cloud Run サービスにシークレットを環境変数として公開
gcloud run services update youtube-translater \
  --update-secrets=YOUTUBE_API_KEY=youtube-api-key:latest \
  --region asia-northeast1
```

**Cloud Build から設定:**

方法 A: 環境変数として直接設定:
```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/youtube-translater', '.']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/youtube-translater']

  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'youtube-translater'
      - '--image=gcr.io/$PROJECT_ID/youtube-translater'
      - '--region=asia-northeast1'
      - '--set-env-vars=YOUTUBE_API_KEY=your_actual_api_key'
```

方法 B: Secret Manager から設定（推奨）:
```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/youtube-translater', '.']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/youtube-translater']

  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'youtube-translater'
      - '--image=gcr.io/$PROJECT_ID/youtube-translater'
      - '--region=asia-northeast1'
      - '--platform=managed'
      # ⭐ Secret Manager のシークレットを環境変数として公開
      - '--update-secrets=YOUTUBE_API_KEY=youtube-api-key:latest'
```

⚠️ **注意**: Secret Manager を使用する場合、事前に `youtube-api-key` シークレットを作成しておく必要があります。

#### 他のプラットフォーム

**Heroku:**
```bash
heroku config:set YOUTUBE_API_KEY=your_actual_api_key
```

**Vercel:**
```bash
vercel env add YOUTUBE_API_KEY
# または Vercel Dashboard で設定
```

**Docker Compose:**
```yaml
services:
  app:
    environment:
      - YOUTUBE_API_KEY=your_actual_api_key
    # または
    env_file:
      - .env
```

### ステップ 7: 動作確認

1. アプリケーションを起動:
   ```bash
   npm start
   ```

2. ログを確認:
   ```
   🔑 YouTube API Key check: CONFIGURED
     - API Key length: 39
     - API Key prefix: AIzaSyXXXX...
   ```

3. 「CONFIGURED」と表示されていれば成功！

## クォータと制限

### デフォルトのクォータ

- **1日あたり**: 10,000 units
- **動画情報取得**: 1 unit per video

### クォータの計算例

```
動画メタデータ取得: 1 unit
→ 1日に最大 10,000 本の動画情報を取得可能
```

### クォータの確認方法

1. Google Cloud Console にアクセス
2. 「API とサービス」→「ダッシュボード」を選択
3. 「YouTube Data API v3」をクリック
4. 「クォータ」タブで使用状況を確認

### クォータを増やす方法

1. Google Cloud Console の「クォータ」ページにアクセス
2. 「YouTube Data API v3」を検索
3. 「割り当ての増加をリクエスト」をクリック
4. リクエストフォームに記入
5. 承認を待つ（通常 1-2 営業日）

## アプリケーションのキャッシュとレート制限

### 自動的に実装されている機能

1. **強力なキャッシュ**
   - メタデータ: 24時間キャッシュ
   - キャッシュディレクトリ: `.cache/youtube/`
   - 同じ動画への重複リクエストを防止

2. **レート制限**
   - デフォルト: 0.3 requests/second
   - ジッタ付き遅延（均等間隔を避ける）
   - YouTube サーバーへの負荷を最小化

3. **エラーハンドリング**
   - クォータ超過の検出
   - 適切なエラーメッセージ
   - 自動リトライなし（手動で再試行）

### キャッシュの管理

**キャッシュのクリア:**
```bash
rm -rf .cache/youtube/
```

**キャッシュサイズの確認:**
```bash
du -sh .cache/youtube/
```

## トラブルシューティング

### エラー: "YouTube API quota exceeded"

**原因**: 1日のクォータ（10,000 units）を使い切った

**解決策**:
1. 翌日まで待つ（クォータは太平洋標準時の午前0時にリセット）
2. クォータの増加をリクエスト
3. キャッシュを活用（重複リクエストを避ける）

### エラー: "YOUTUBE_API_KEY is not configured"

**原因**: 環境変数が設定されていない

**解決策（ローカル環境）**:
1. `.env` ファイルに `YOUTUBE_API_KEY` を追加
2. API キーが正しくコピーされているか確認
3. アプリケーションを再起動

**解決策（Cloud Run）**:

⚠️ **よくある間違い**: Secret Manager にシークレットを作成しただけでは動作しません！

Secret Manager のシークレットは、Cloud Run サービスで**環境変数として公開**する必要があります:

1. Cloud Run コンソールでサービスを選択
2. 「新しいリビジョンを編集してデプロイ」をクリック
3. 「変数とシークレット」タブ → 「シークレットを参照」
4. Secret Manager から `youtube-api-key` を選択
5. 「環境変数として公開」を選択
6. **環境変数名**: `YOUTUBE_API_KEY`（大文字小文字を正確に）
7. デプロイ

または gcloud CLI で:
```bash
gcloud run services update youtube-translater \
  --update-secrets=YOUTUBE_API_KEY=youtube-api-key:latest \
  --region=asia-northeast1
```

**確認方法**:
```bash
# 環境変数が設定されているか確認
gcloud run services describe youtube-translater \
  --region=asia-northeast1 \
  --format='get(spec.template.spec.containers[0].env)'
```

`YOUTUBE_API_KEY` が表示されない場合は、シークレットが環境変数として公開されていません。

### エラー: "Permission denied on secret" （Secret Manager）

**エラーメッセージ例**:
```
Permission denied on secret: projects/XXX/secrets/YOUTUBE_API_KEY/versions/latest
for Revision service account sa-xxx@xxx.iam.gserviceaccount.com.
The service account used must be granted the 'Secret Manager Secret Accessor' role
```

**原因**: Cloud Run サービスアカウントに Secret Manager へのアクセス権限がない

**解決策（Console）**:
1. [Secret Manager](https://console.cloud.google.com/security/secret-manager) を開く
2. シークレット（`youtube-api-key` または `YOUTUBE_API_KEY`）をクリック
3. 右側の **「権限」** タブをクリック
4. **「アクセス権を付与」** をクリック
5. **新しいプリンシパル**: エラーメッセージに表示されているサービスアカウント（例: `sa-dev@xxx.iam.gserviceaccount.com`）
6. **ロール**: `Secret Manager のシークレット アクセサー` を選択
7. **「保存」** をクリック
8. Cloud Run サービスを再デプロイ

**解決策（gcloud CLI）**:
```bash
# サービスアカウント名を取得
SERVICE_ACCOUNT=$(gcloud run services describe youtube-translater \
  --region=asia-northeast1 \
  --format='value(spec.template.spec.serviceAccountName)')

# シークレットへのアクセス権を付与
gcloud secrets add-iam-policy-binding youtube-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

# Cloud Run サービスを再デプロイ
gcloud run services update youtube-translater \
  --region=asia-northeast1
```

**確認方法**:
```bash
# IAM ポリシーを確認
gcloud secrets get-iam-policy youtube-api-key
```

サービスアカウントに `roles/secretmanager.secretAccessor` が付与されていることを確認してください。

### エラー: "Invalid API key"

**原因**: API キーが無効または制限されている

**解決策**:
1. API キーが正しくコピーされているか確認
2. Google Cloud Console で API キーの制限を確認
3. 必要に応じて API キーを再生成

### エラー: "API key restrictions"

**原因**: API キーが特定の IP またはリファラーに制限されている

**解決策**:
1. Google Cloud Console で API キーの制限を確認
2. 開発環境では「なし」に設定
3. 本番環境では適切な IP を追加

## セキュリティのベストプラクティス

### API キーの保護

✅ **すべきこと:**
- `.env` ファイルに保存
- `.gitignore` に `.env` を追加
- 環境変数として管理
- 本番環境では API キーを制限

❌ **してはいけないこと:**
- API キーをコードにハードコード
- API キーを公開リポジトリにコミット
- API キーを他人と共有
- 制限なしの API キーを本番環境で使用

### API キーの制限

**開発環境:**
```
アプリケーションの制限: なし
API の制限: YouTube Data API v3 のみ
```

**本番環境:**
```
アプリケーションの制限: IP アドレス（サーバーの IP）
API の制限: YouTube Data API v3 のみ
リファラーの制限: 必要に応じて設定
```

## コスト

### YouTube Data API v3

- **基本**: 無料
- **クォータ**: 10,000 units/日（無料）
- **追加クォータ**: リクエストベース（通常は無料範囲内で十分）

### Google Cloud

- **プロジェクト作成**: 無料
- **API 有効化**: 無料
- **API キー**: 無料

⚠️ **注意**: 他の Google Cloud サービスを使用する場合は課金が発生する可能性があります。

## 参考リンク

### 公式ドキュメント

- [YouTube Data API v3 Overview](https://developers.google.com/youtube/v3/getting-started)
- [YouTube Data API v3 Reference](https://developers.google.com/youtube/v3/docs)
- [API キーの取得](https://developers.google.com/youtube/v3/getting-started#before-you-start)
- [クォータ管理](https://developers.google.com/youtube/v3/getting-started#quota)

### 利用規約

- [YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service)
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)

### コミュニティ

- [Stack Overflow - YouTube API](https://stackoverflow.com/questions/tagged/youtube-api)
- [YouTube API Support](https://support.google.com/youtube/topic/9257498)

## まとめ

✅ **完了したら:**
1. Google Cloud プロジェクトを作成
2. YouTube Data API v3 を有効化
3. API キーを生成
4. API キーを制限（セキュリティ）
5. `.env` ファイルに設定
6. アプリケーションを起動して確認

🎉 これで bot 検出の問題なく YouTube 動画のメタデータを取得できます！

---

**最終更新**: 2025-11-01
**バージョン**: 1.0
