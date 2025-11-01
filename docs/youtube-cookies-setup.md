# YouTube Bot 検出を回避する方法

## 問題

YouTube は bot アクセスを検出してブロックすることがあります。エラーメッセージ:
```
Sign in to confirm you're not a bot
```

## 解決策

ブラウザで YouTube にログインした状態のクッキーを使用することで、bot 検出を回避できます。

## セットアップ手順

### 方法 1: ブラウザ拡張機能を使用（推奨）

1. **Chrome/Edge の場合**
   - 拡張機能 "Get cookies.txt LOCALLY" をインストール
   - https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc

2. **YouTube にログイン**
   - ブラウザで https://youtube.com にアクセス
   - Google アカウントでログイン

3. **クッキーをエクスポート**
   - YouTube のページで拡張機能アイコンをクリック
   - "Export as JSON" を選択
   - クッキーの JSON データをコピー

4. **環境変数に設定**
   - プロジェクトの `.env` ファイルを開く
   - 以下の行を追加:
   ```bash
   YOUTUBE_COOKIES='[{"name":"...", "value":"..."}]'
   ```
   - コピーしたクッキー JSON をシングルクォートの中に貼り付け

### 方法 2: ブラウザの開発者ツールを使用

1. **YouTube にログイン**
   - ブラウザで https://youtube.com にアクセス
   - Google アカウントでログイン

2. **開発者ツールを開く**
   - Chrome/Edge: F12 または右クリック → 検証
   - Firefox: F12 または右クリック → 要素を調査

3. **Console タブでクッキーを取得**
   - 以下のコードを実行:
   ```javascript
   copy(JSON.stringify(document.cookie.split('; ').map(c => {
     const [name, ...value] = c.split('=');
     return { name, value: value.join('='), domain: '.youtube.com' };
   })))
   ```
   - クッキーがクリップボードにコピーされます

4. **環境変数に設定**
   - `.env` ファイルに追加:
   ```bash
   YOUTUBE_COOKIES='[コピーしたJSON]'
   ```

### 方法 3: User-Agent のみ使用（クッキーなし）

クッキーを設定しなくても、アプリケーションは自動的に Chrome ブラウザの User-Agent を使用します。
多くの場合、これだけで bot 検出を回避できます。

**User-Agent:**
```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

**追加ヘッダー:**
- `Accept-Language: ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7`
- `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8`
- `Connection: keep-alive`

## .env ファイルの例

```bash
# OpenAI API キー（必須）
OPENAI_API_KEY=sk-...

# YouTube クッキー（オプション - bot 検出を回避するため）
YOUTUBE_COOKIES='[{"name":"VISITOR_INFO1_LIVE","value":"...","domain":".youtube.com"},{"name":"CONSENT","value":"...","domain":".youtube.com"}]'
```

## 確認方法

1. アプリケーションを起動
2. ログを確認:
   ```
   🎥 ytdl-core configuration: {
     hasCookies: true,
     userAgent: 'Chrome/120.0.0.0'
   }
   ```
3. `hasCookies: true` と表示されていれば設定成功

## トラブルシューティング

### クッキーを設定したのに bot 検出される

1. **クッキーが期限切れの可能性**
   - ブラウザで YouTube に再ログイン
   - クッキーを再エクスポート
   - `.env` ファイルを更新

2. **クッキーの形式が間違っている**
   - JSON 配列形式であることを確認: `[{...}]`
   - シングルクォートで囲むこと: `'[...]'`
   - ダブルクォートはエスケープ不要

3. **IP アドレスがブロックされている**
   - 短時間に大量のリクエストを送った場合
   - しばらく（30分〜1時間）待つ
   - VPN を使用している場合は無効にする

### User-Agent だけで動作する場合

クッキーがなくても動作する場合があります:
- 新しい動画
- 人気の動画
- 字幕付きの動画

クッキーがあると成功率が上がります:
- 制限付き動画
- 古い動画
- 年齢制限のある動画

## セキュリティ注意事項

⚠️ **重要**: クッキーには認証情報が含まれています

- `.env` ファイルを Git にコミットしない（`.gitignore` に追加済み）
- クッキーを公開リポジトリに push しない
- 定期的にクッキーを更新する
- 本番環境では環境変数として安全に管理する

## 実装の詳細

### コード内での処理

**server.ts:**
```typescript
// ytdl-core の設定
const getYtdlOptions = () => {
  const options: any = {
    requestOptions: {
      headers: {
        'User-Agent': 'Mozilla/5.0 ...',
        'Accept-Language': 'ja-JP,ja;q=0.9,...',
        // ...
      }
    }
  };

  // 環境変数からクッキーを読み込む
  if (process.env.YOUTUBE_COOKIES) {
    options.agent = ytdl.createAgent(JSON.parse(process.env.YOUTUBE_COOKIES));
  }

  return options;
};

// すべての ytdl 呼び出しで使用
const info = await ytdl.getInfo(url, getYtdlOptions());
```

### 対応している操作

以下の操作で bot 検出回避が有効:
- ✅ コスト予測 (`/api/estimate-cost-url`)
- ✅ メタデータ取得 (`getYouTubeMetadata`)
- ✅ 動画情報取得 (`/api/upload-youtube`)
- ✅ 音声ダウンロード (`downloadYouTubeAudio`)

## 参考リンク

- [@distube/ytdl-core ドキュメント](https://github.com/distubejs/ytdl-core)
- [YouTube の bot 検出について](https://github.com/distubejs/ytdl-core#does-ytdl-core-work-with-live-videos)
- [クッキーの形式](https://github.com/distubejs/ytdl-core#cookie-support)
