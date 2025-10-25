# 🎥 YouTube AI Assistant

YouTube動画のURLを入力するだけで、音声を自動的に文字起こしし、その内容に対してAIを活用した質問応答ができるモダンなWebアプリケーションです。

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-orange)

## 📑 目次

- [✨ 新機能](#-新機能v200)
- [🌟 主な機能](#-主な機能)
- [🚀 クイックスタート](#-クイックスタート)
- [📖 使用方法](#-使用方法)
- [📚 ドキュメント](#-ドキュメント)
- [🐳 Docker / Cloud Run デプロイ](#-docker--cloud-run-デプロイ)
- [🏗️ システム構成](#️-システム構成)
- [💡 機能詳細](#-機能詳細)
- [🔧 開発・カスタマイズ](#-開発カスタマイズ)
- [📊 料金目安](#-料金目安)
- [🤝 コントリビューション](#-コントリビューション)
- [📄 ライセンス](#-ライセンス)

## ✨ 新機能（v2.0.0）

### 🎨 モダンUIデザイン
- **ガラスモーフィズム効果** - 美しいグラデーション背景とガラス風デザイン
- **レスポンシブデザイン** - スマホ・タブレット・デスクトップ完全対応
- **アニメーション効果** - スムーズなホバー・フェードイン効果
- **カスタムスクロールバー** - モダンで使いやすいスクロール体験

### 🔧 機能拡張
- **Markdownレンダリング** - 要約が美しくフォーマットされて表示
- **GPTモデル選択** - 用途に応じて4種類のモデルから選択可能
- **言語選択改善** - より柔軟な言語設定とフォールバック機能
- **履歴機能強化** - チャンネル名・URL表示で管理しやすく

## 🌟 主な機能

### 📝 文字起こし機能
- **多言語字幕対応** - YouTube字幕を自動取得（日本語・英語・その他10言語対応）
- **言語選択機能** - Original（自動判定）・日本語・英語から選択可能
- **Whisper API音声認識** - 字幕がない場合は高精度な音声認識で文字起こし
- **大容量動画対応** - 25MB超過時は自動分割処理
- **テキスト整形** - 読みやすい段落・改行の自動挿入

### 🤖 AI要約・質問応答
- **構造化要約** - Markdownレンダリングで美しく表示される全体要約・主要ポイント・トピック別詳細要約
- **GPTモデル選択** - GPT-4o-mini（推奨）、GPT-4o（高品質）、GPT-4-turbo（最高品質）、GPT-3.5-turbo（高速・低コスト）から選択
- **推奨質問生成** - AIが内容に基づいて質問候補を自動生成
- **深掘り対話** - 動画内容について詳細な質問応答が可能
- **リアルタイム料金表示** - モデル別の使用料金をリアルタイム計算

### 📊 メタデータ分析
- **動画情報表示** - タイトル・チャンネル・再生回数・長さ
- **チャプター分析** - タイムスタンプ付きセクション情報
- **統計情報** - いいね数・カテゴリ・字幕対応言語

### 💰 料金管理・履歴機能
- **モデル別料金計算** - Whisper・各GPTモデルの使用料金を詳細表示
- **履歴管理** - 最大100件の処理履歴を自動保存（チャンネル名・YouTube URL付き）
- **重複処理回避** - 同一動画・言語・モデル設定での再処理時は履歴から瞬時に取得
- **YouTube連携** - 履歴から直接YouTube動画にアクセス可能

## 🚀 クイックスタート

### 必要な環境
- Node.js (v14以上)
- FFmpeg (音声処理用)
- OpenAI APIキー

### インストール

1. **リポジトリのクローン**
```bash
git clone https://github.com/miyajiyuta/youtube_translator.git
cd youtube_translator
```

2. **依存関係のインストール**
```bash
npm install
```

3. **環境変数の設定**
```bash
cp .env.example .env
```
`.env`ファイルを編集してOpenAI APIキーを設定：
```
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
# オプション: モックモード（開発・テスト用）
# MOCK_OPENAI=true
```

> **📝 モックモードについて**: `MOCK_OPENAI=true`を設定すると、実際のOpenAI APIを呼び出さずにモックレスポンスを返します。APIクォータを消費せずに開発・テストが可能です。本番環境では必ずこの設定を削除またはコメントアウトしてください。

> **⚠️ 重要**: PDFの実際の要約を生成するには、モックモードを無効にして有効なOpenAI APIキーが必要です。APIクォータが不足している場合は、新しいAPIキーを取得するか、プランをアップグレードしてください。

4. **サーバーの起動**
```bash
# 開発モード（サーバーとクライアント両方を起動）
npm run dev:client  # Viteクライアント開発サーバー（別ターミナル）
npm run dev         # Express APIサーバー

# 本番モード
npm run build:all   # クライアントとサーバーをビルド
npm start          # 本番サーバー起動
```

5. **ブラウザでアクセス**
```
http://localhost:3000
```

## 📖 使用方法

1. **YouTube動画の処理**
   - YouTubeのURLを入力欄に貼り付け
   - 文字起こし言語を選択（Original・日本語・英語）
   - GPTモデルを選択（用途に応じて4種類から選択）
   - 「文字起こし開始」ボタンをクリック
   - 自動的に字幕取得 → 音声認識 → 要約生成を実行

2. **要約の確認**
   - Markdownで美しくレンダリングされた要約を確認
   - 全体要約・主要ポイント・トピック別詳細を構造化表示
   - 動画情報（タイトル・チャンネル・再生回数・チャプター等）を表示

3. **AI質問応答**
   - 推奨質問をクリックして即座に質問
   - または自由に質問を入力して送信
   - 動画内容に基づいた詳細な回答を取得

4. **履歴管理**
   - 過去の処理結果を履歴から再読み込み
   - チャンネル名・YouTube URLから動画を特定
   - 言語・モデル設定別に管理
   - 料金情報を確認して使用量を管理

## 📚 ドキュメント

開発者向けの詳細ドキュメント：

- **[技術スタック](docs/tech-stack.md)** - フロントエンド・バックエンド・インフラの全技術スタック解説
- **[PDF処理詳細](docs/pdf-implementation-details.md)** - PDF処理実装の詳細仕様
- **[PDF処理ロジック](docs/pdf-processing-logic.md)** - PDF処理のアルゴリズム解説
- **[PDFクイックスタートガイド](docs/pdf-quickstart-guide.md)** - PDF機能の使い方

## 🐳 Docker / Cloud Run デプロイ

### ローカルDockerビルド

```bash
# ビルド
docker build -t youtube-ai-assistant .

# 起動
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=your_api_key_here \
  youtube-ai-assistant

# ヘルスチェック
curl http://localhost:3000/api/health
```

### Google Cloud Run デプロイ

```bash
# 1. Google Cloud認証
gcloud auth login
gcloud config set project <PROJECT_ID>

# 2. ビルドとプッシュ
gcloud builds submit --tag gcr.io/<PROJECT_ID>/youtube-ai-assistant

# 3. Cloud Runにデプロイ
gcloud run deploy youtube-ai-assistant \
  --image gcr.io/<PROJECT_ID>/youtube-ai-assistant \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-secrets OPENAI_API_KEY=openai-api-key:latest
```

詳細な手順やトラブルシューティングは[技術スタックドキュメント](docs/tech-stack.md#-docker--cloud-run-デプロイ)を参照してください。

## 🏗️ システム構成

### 技術スタック
- **バックエンド**: Node.js, Express.js
- **フロントエンド**: HTML5, CSS3, Vanilla JavaScript, Marked.js
- **AI API**: OpenAI API (Whisper, GPT-4o-mini, GPT-4o, GPT-4-turbo, GPT-3.5-turbo)
- **YouTube処理**: @distube/ytdl-core, youtube-transcript-api
- **音声処理**: fluent-ffmpeg
- **デザイン**: Glassmorphism, Responsive Design, CSS Grid/Flexbox

### ディレクトリ構造
```
youtube_translater/
├── server.js              # メインサーバーファイル
├── src/server.ts          # TypeScript版サーバー
├── package.json           # 依存関係定義
├── tsconfig.json          # TypeScript設定
├── 要件定義書.md          # 詳細な要件定義
├── public/
│   └── index.html         # フロントエンドUI
├── uploads/               # 一時音声ファイル
├── transcripts/           # 文字起こしファイル
└── history/               # 履歴データ
    └── transcripts.json   # 履歴JSON
```

### API エンドポイント
- `POST /upload-youtube` - YouTube動画処理（言語・モデル選択対応）
- `POST /chat` - AI質問応答（モデル選択対応）
- `GET /history` - 履歴取得
- `POST /load-from-history` - 履歴からの読み込み
- `GET /suggested-questions` - 推奨質問取得
- `GET /costs` - 料金情報取得
- `GET /metadata` - メタデータ取得

## 💡 機能詳細

### 文字起こし処理フロー
1. **URL検証** → **YouTube字幕取得** → **音声抽出・圧縮** → **Whisper API文字起こし** → **テキスト整形**

### 要約生成
- 選択したGPTモデルに応じて最適化された要約生成
- Markdownフォーマットで構造化された見やすい要約
- 動画の長さ・内容に応じて適切な要約レベルを自動調整
- トピック別詳細要約で深掘り質問に対応
- 推奨質問の自動生成で効率的な学習をサポート

### 料金最適化
- YouTube字幕優先利用でWhisper API料金を節約
- 履歴機能で重複処理を回避（言語・モデル設定まで考慮）
- 音声圧縮により処理コストを削減
- モデル別料金の透明な表示で予算管理をサポート

## 🔧 開発・カスタマイズ

### TypeScript対応
```bash
npm run dev  # TypeScript版サーバーの実行
```

### 設定のカスタマイズ
- `server.js`内の`pricing`オブジェクトで料金設定を変更
- `formatTranscript`関数で文字起こし整形ルールを調整
- `generateSummary`関数で要約形式をカスタマイズ

## 📊 料金目安

### モデル別料金（2024年6月時点）
- **Whisper API**: $0.006/分
- **GPT-4o-mini**: 入力$0.15/100万トークン、出力$0.60/100万トークン（推奨）
- **GPT-4o**: 入力$5.00/100万トークン、出力$15.00/100万トークン（高品質）
- **GPT-4-turbo**: 入力$10.00/100万トークン、出力$30.00/100万トークン（最高品質）
- **GPT-3.5-turbo**: 入力$0.50/100万トークン、出力$1.50/100万トークン（高速・低コスト）

### 実際のコスト例
- **字幕利用時**: 完全無料
- **10分動画（Whisper + GPT-4o-mini）**: 約$0.08
- **10分動画（Whisper + GPT-4o）**: 約$0.15

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🙏 謝辞

- OpenAI - Whisper・GPT API群
- @distube/ytdl-core - YouTube動画処理
- youtube-transcript-api - YouTube字幕取得
- Marked.js - Markdownレンダリング
- CSS Glassmorphism Community - デザインインスピレーション

---

**🤖 Generated with [Claude Code](https://claude.ai/code)**