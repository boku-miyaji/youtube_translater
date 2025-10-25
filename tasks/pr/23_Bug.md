# Pull Request: Fix cost and time calculation issues (#23)

## 概要

料金計算と時間計算の精度を大幅に改善しました。特にPDF処理において、推定時間が実際の54倍もずれていた問題を修正し、チャット料金の表示、履歴データを活用した予測、詳細な根拠表示など、ユーザーエクスペリエンスを向上させる機能を実装しました。

## 実装した機能

### 1. チャット料金追跡（Chat Cost Tracking）
- チャット機能使用時の料金を追跡・表示
- 総コストにチャット料金を含めて表示
- リアルタイムでコスト更新

### 2. PDF処理時間計算の修正
- **PDF抽出時間**: WhisperベースからページベースCalculationに変更
- **正規化の実装**: ページ数による正規化（秒/ページ）
- **デフォルト値の最適化**:
  - 抽出: 1.5秒/ページ → 0.5秒/ページ
  - 要約: 48秒/ページ → 1.5秒/ページ (gpt-4o-mini)
  - 結果: 18分59秒の予測 → 47秒（実際21秒）

### 3. 履歴データ活用による時間推定
- `AnalysisProgressDatabase`による実績データ追跡
- コンテンツタイプ別（PDF/動画/音声）の統計
- サンプル数に基づく信頼度計算
- 2件以上の実績で履歴ベースの推定に自動切り替え

### 4. 事前推定機能（Pre-Analysis Estimation）
- **YouTube URL**: URL入力時に動画時間を取得し、コスト・時間を推定
- **PDF URL**: PDFをダウンロードしてページ数を取得し、正確な推定を提供
- リアルタイムでの推定表示

### 5. 詳細な根拠表示（Detailed Rationale）
トグルボタンで表示・非表示を切り替え可能な詳細根拠：

#### 表示項目
- **データソース**: 履歴データ使用 or デフォルト係数使用
- **正規化方法**: ページベース（PDF）/ 分ベース（動画）
- **コスト内訳**:
  - 文字起こし/テキスト抽出コスト
  - 要約生成コスト
  - 単位あたりコスト（$/分 or $/ページ）
  - 計算式: "23ページ × $0.000270/ページ = $0.0062"
- **処理時間内訳**:
  - 文字起こし/テキスト抽出時間
  - 要約生成時間
  - 単位あたり時間（秒/分 or 秒/ページ）
  - 計算式: "23ページ × 1.5秒/ページ = 35秒"
  - パーセンテージ表示
- **影響要因**: モデル選択、コンテンツ特性、サーバー負荷など

#### UI改善
- 簡潔な表示: 冗長な情報を削減し、スキャン可能な構造に
- 一貫性: 動画とPDFで同じフォーマット
- アクセシビリティ: トグルボタンでオンデマンド表示

### 6. バグ修正
- **ボタンの誤動作**: 「推定の詳細を見る」ボタンが解析を開始してしまう問題を修正
- **表示形式**: 合計時間ではなくレート表示されていた問題を修正
- **durationMinutes欠落**: PDF解析完了後に詳細根拠が表示されない問題を修正

## テスト結果

### 時間推定精度の改善

**23ページPDFの例**:
| 項目 | 修正前 | 修正後 | 実際 | 精度 |
|------|--------|--------|------|------|
| 抽出時間 | 35秒 | 12秒 | 0.1秒 | 大幅改善 |
| 要約時間 | 1104秒 | 35秒 | 21秒 | 大幅改善 |
| 合計 | 18分59秒 | 47秒 | 21秒 | ✅ |
| 誤差 | 54倍 | 2.2倍 | - | 96%改善 |

### 型チェック・ビルド
- ✅ TypeScript型チェック通過
- ✅ サーバービルド成功
- ✅ クライアントビルド成功

### 機能テスト
- ✅ YouTube URL推定表示
- ✅ PDF URL推定表示（ページ数取得）
- ✅ 詳細根拠のトグル表示
- ✅ チャット料金追跡
- ✅ 履歴データ活用（2件以上処理後）
- ✅ PDF/動画それぞれで正しい正規化

## 変更ファイル一覧

### コアロジック
- **src/server.ts** (+386, -165)
  - `/api/estimate-cost-pdf` エンドポイント追加・強化
  - `calculateProcessingTime()` 関数のPDF対応
  - PDF処理のデフォルト値最適化
  - 履歴データ活用ロジック
  - analysisTime に durationMinutes 追加

- **src/database/analysis-progress.ts** (+34)
  - `calculateContentTypeStats()` でPDFの正規化を修正
  - PDF用の統計計算（秒/ページ）

- **src/types/index.ts** (+7)
  - `PDFAnalysisResponse` に durationMinutes 追加
  - `HistoryEntry` に durationMinutes 追加
  - `addToHistory` パラメータ型更新

### フロントエンド
- **src/components/pages/AnalyzePage.tsx** (+400)
  - `estimateCostForPDFUrl()` 関数追加
  - `generateEstimationRationale()` 関数実装
  - PDF URL estimation triggering
  - 詳細根拠UI実装
  - トグルボタン実装

- **src/components/shared/ChatInterface.tsx** (+31)
  - チャットコスト追跡機能

### テスト
- **tests/utils/cost-time-calculations.test.ts** (新規)
  - コスト・時間計算のユニットテスト

### ドキュメント
- **tasks/pr/23_commits/** (8ファイル)
  - 各コミットの詳細な変更記録

## 技術的ハイライト

### 1. コンテンツタイプ別の正規化

```typescript
// PDF: ページベース
const secondsPerPage = extractionTime / pageCount;
stats.pdf.transcriptionAverage = secondsPerPage;

// Video: 分ベース
const secondsPerMinute = extractionTime / (duration / 60);
stats.video.transcriptionAverage = secondsPerMinute;
```

### 2. 履歴データ活用

```typescript
if (stats.contentTypeStats.pdf && stats.contentTypeStats.pdf.sampleSize >= 2) {
  // 履歴データ使用
  summaryTime = pageCount * stats.contentTypeStats.pdf.summaryAverage;
  isHistoricalEstimate = true;
} else {
  // デフォルト値使用
  summaryTime = pageCount * 1.5; // 現実的なデフォルト
}
```

### 3. PDF URL からの正確な推定

```typescript
// PDFをダウンロードして実際のページ数を取得
const pdfBuffer = await downloadPDF(url);
const pdfContent = await extractPDFText(pdfBuffer);
const actualPageCount = pdfContent.pageCount;
// 正確なページ数で推定
const processingTime = calculateProcessingTime('pdf-parse', gptModel, actualPageCount, 'pdf');
```

## 人間が最終チェックすべき項目

### 機能確認
- [ ] YouTube URL入力時に推定コスト・時間が表示される
- [ ] PDF URL入力時に推定コスト・時間が表示される（PDFダウンロード後）
- [ ] 「推定の詳細を見る」ボタンで詳細根拠が表示・非表示切り替え
- [ ] 詳細根拠に以下が含まれる:
  - [ ] データソース（履歴 or デフォルト）
  - [ ] コスト内訳（単位あたりコスト含む）
  - [ ] 処理時間内訳（単位あたり時間含む）
  - [ ] 計算式（"Xページ × Y/ページ = Z"形式）
  - [ ] 影響要因
- [ ] チャット使用時に料金が追跡・表示される
- [ ] 2件目のPDF解析後、履歴データを使った推定に切り替わる

### 精度確認
- [ ] PDF推定時間が実際の処理時間の2-3倍以内に収まる
- [ ] 動画推定時間が実際の処理時間の2-3倍以内に収まる
- [ ] コスト推定が実際のコストの±20%以内

### UI/UX確認
- [ ] 推定表示が読みやすい
- [ ] 詳細根拠が冗長すぎない
- [ ] 動画とPDFで表示形式が統一されている
- [ ] ボタンのアクションが意図通り（解析開始しない）

### エッジケース
- [ ] 非常に大きなPDF（100ページ以上）での推定
- [ ] 非常に長い動画（2時間以上）での推定
- [ ] 履歴データがない状態（初回）での推定
- [ ] ネットワークエラー時の挙動

### パフォーマンス
- [ ] PDF URL推定のダウンロード時間が許容範囲内（数秒）
- [ ] 詳細根拠の表示・非表示が即座に切り替わる
- [ ] ページロード時間に影響がない

## Breaking Changes

なし。すべて後方互換性を維持しています。

## 次のステップ

1. 人間による最終チェック
2. 本番環境へのデプロイ
3. ユーザーフィードバック収集
4. 必要に応じてデフォルト値の微調整

## 関連Issue

- Issue #23: Fix cost and time calculation issues

## コミット数

合計: 19コミット（docs含む）
機能実装: 15コミット

---

**レビュワーへのNote**:
このPRは複数の機能改善とバグ修正を含む大きな変更です。特に「PDF処理時間の精度」と「詳細根拠表示」の部分を重点的にレビューしてください。履歴データ活用により、使えば使うほど推定精度が向上する設計になっています。
