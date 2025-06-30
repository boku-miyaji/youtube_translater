# PR: 文字起こしのデフォルト言語をOriginalに設定

## 🎯 Issue
Closes #11

## 📝 概要
YouTubeの文字起こし機能において、言語選択のデフォルト値を「日本語」から「Original (自動判定)」に変更しました。これにより、ユーザーは動画の元の言語で自動的に文字起こしが行われるようになります。

## 🔧 実装内容

### 1. UI変更
- **ファイル**: `public/index.html`
- **変更内容**: 
  - 言語選択ドロップダウン（`#languageSelect`）のデフォルト選択を「Original (自動判定)」に変更
  - `selected`属性を`ja`オプションから`original`オプションに移動

### 2. テスト追加
- **ファイル**: `tests/default-language.test.ts`
- **内容**:
  - デフォルト言語が「Original」に設定されていることを確認するユニットテスト
  - 言語選択の変更が正しく動作することを確認するテスト
  - アップロード機能で言語パラメータが正しく送信されることを確認する統合テスト

- **ファイル**: `tests/verify-default-language.ts`
- **内容**:
  - 実装の正確性を検証する簡易スクリプト
  - HTMLファイルの内容を直接チェックして設定を確認

## 🧪 テスト結果

実装検証スクリプトの実行結果:
```
✓ Checking language select dropdown:
  - Original (自動判定) is selected: ✅ YES
  - 日本語 is selected: ✅ NO
  - English is selected: ✅ NO

✅ SUCCESS: Default language is correctly set to "Original"
```

## 🚀 動作確認

1. アプリケーションを起動
2. 言語選択ドロップダウンを確認
3. デフォルトで「Original (自動判定)」が選択されていることを確認
4. YouTube URLを入力して文字起こしを実行
5. 動画の元の言語で文字起こしが行われることを確認

## 📋 チェックリスト

- [x] コードの実装完了
- [x] テストコードの追加
- [x] 実装の検証完了
- [x] 既存機能への影響なし（後方互換性維持）
- [x] UIの動作確認

## 💡 補足

- サーバー側のコードは既に`original`言語をサポートしているため、変更は不要でした
- `getLanguageOrder()`関数は`original`の場合、複数言語での字幕取得を試みます
- Whisper APIは`original`を指定すると自動言語検出モードで動作します

## 🔄 今後の改善案

1. ユーザーの言語選択を localStorage に保存して次回アクセス時に復元
2. 言語自動検出の結果をUIに表示
3. より多くの言語オプションの追加