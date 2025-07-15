# Issue #18 GPT-4o-Transcribe Response Format修正

## 問題
GPT-4o-transcribeモデルを使用時に以下のエラーが発生:
```
400 response_format 'verbose_json' is not compatible with model 'gpt-4o-transcribe-api-ev3'. Use 'json' or 'text' instead.
```

## 原因
- すべてのトランスクリプションAPIコールで`response_format: 'verbose_json'`がハードコードされていた
- GPT-4oベースのトランスクリプションモデルは`verbose_json`フォーマットをサポートしていない
- GPT-4oモデルは`json`または`text`フォーマットのみサポート

## 実装内容

### 1. ヘルパー関数の作成（src/server.ts:202）
```typescript
function getTranscriptionResponseFormat(model: string): 'verbose_json' | 'json' {
  if (model === 'gpt-4o-transcribe' || model === 'gpt-4o-mini-transcribe') {
    return 'json';
  }
  return 'verbose_json';
}
```

### 2. APIコールの更新
以下の3箇所でresponse_formatを動的に設定するように修正:

1. **メイントランスクリプションフロー（line 295）**
   ```typescript
   response_format: getTranscriptionResponseFormat(transcriptionModel),
   ```

2. **通常の音声ファイル処理（line 1002）**
   ```typescript
   response_format: getTranscriptionResponseFormat(transcriptionModel),
   ```

3. **大きな音声ファイルのセグメント処理（line 1061）**
   ```typescript
   response_format: getTranscriptionResponseFormat(transcriptionModel),
   ```

## 効果
- GPT-4o-transcribeモデルでの400エラーが解消
- 異なるトランスクリプションモデル間での互換性を確保
- 将来的な新しいモデルの追加にも対応しやすい設計

## 技術的詳細
- Whisper-1モデル: `verbose_json`フォーマットを使用（詳細な情報を含む）
- GPT-4oモデル: `json`フォーマットを使用（標準的なJSON形式）
- TypeScriptの型定義により、戻り値は`'verbose_json' | 'json'`に制限