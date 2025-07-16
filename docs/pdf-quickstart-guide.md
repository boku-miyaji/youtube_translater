# PDF処理機能 クイックスタートガイド

## 概要

YouTube TranslaterアプリケーションのPDF処理機能を使用すると、PDFファイルからテキストを抽出し、AIによる要約を生成できます。

## 基本的な使い方

### 1. PDF URLから処理

```javascript
// フロントエンドから
const response = await fetch('/api/analyze-pdf', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://arxiv.org/pdf/2401.00001.pdf',
    language: 'ja',
    gptModel: 'gpt-4o-mini',
    generateSummary: 'true'
  })
});

const result = await response.json();
console.log(result.transcript); // 抽出されたテキスト
console.log(result.summary);    // 生成された要約
```

### 2. PDFファイルをアップロード

```javascript
// フロントエンドから
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('language', 'ja');
formData.append('gptModel', 'gpt-4o-mini');
formData.append('generateSummary', 'true');

const response = await fetch('/api/analyze-pdf', {
  method: 'POST',
  body: formData
});
```

## 処理の流れ

```
1. PDF受信（URL/ファイル）
   ↓
2. PDFバッファ取得
   ↓
3. テキスト抽出（pdf-parse）
   ↓
4. 構造解析（オプション）
   ↓
5. 要約生成（OpenAI API）
   ↓
6. レスポンス返却
```

## 重要な設定

### 環境変数

```bash
OPENAI_API_KEY=your-api-key-here
```

### 制限事項

- **ファイルサイズ**: 最大50MB
- **対応形式**: テキストベースのPDFのみ（OCR未対応）
- **URL**: HTTPSかつ学術ドメイン推奨

## よくある質問

### Q: PDFの要約が空になる

A: OpenAI APIのクォータを確認してください。また、以下の修正が適用されているか確認：

```typescript
// server.ts の修正
if (shouldGenerateSummary) {  // && pdfMetadata を削除
  // 要約生成処理
}
```

### Q: どんなPDFでも処理できる？

A: 現在はテキストベースのPDFのみ対応。スキャンされた画像PDFは将来対応予定。

### Q: 処理時間はどれくらい？

A: 一般的な学術論文（10-20ページ）で1-4秒程度。

## トラブルシューティングチェックリスト

- [ ] OpenAI APIキーが設定されている
- [ ] APIクォータが残っている
- [ ] PDFファイルが50MB以下
- [ ] URLがHTTPSである
- [ ] サーバーが起動している（ポート8080）

## サンプルコード

### 完全な実装例

```typescript
// クライアント側
async function analyzePDF(url: string) {
  try {
    setLoading(true);
    
    const response = await fetch('/api/analyze-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        language: 'ja',
        gptModel: 'gpt-4o-mini',
        generateSummary: 'true',
        extractStructure: 'true'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 結果の表示
    setTranscript(data.transcript);
    setSummary(data.summary);
    setPdfMetadata(data.pdfMetadata);
    
  } catch (error) {
    console.error('PDF processing failed:', error);
  } finally {
    setLoading(false);
  }
}
```

## 開発者向けTips

1. **デバッグ**: `console.log`でサーバー側の処理状況を確認
2. **テスト**: cURLコマンドでAPIを直接テスト
3. **エラー処理**: try-catchで適切にエラーハンドリング
4. **コスト管理**: OpenAI APIの使用量を監視

## 関連ドキュメント

- [PDF処理ロジック詳細](./pdf-processing-logic.md)
- [実装の技術詳細](./pdf-implementation-details.md)
- [API仕様書](../src/types/index.ts)

---

最終更新: 2025年7月17日