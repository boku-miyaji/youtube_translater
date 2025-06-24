# TypeScript移行戦略

## 概要
YouTube翻訳アプリケーションを完全にTypeScriptへ移行するための計画書です。JavaScriptの後方互換性は考慮せず、TypeScriptファーストの設計を採用します。

## 移行方針

### 基本原則
1. **完全移行**: JavaScriptファイルは段階的に削除し、TypeScriptのみの構成へ
2. **型安全性最優先**: 厳格な型チェックによる品質向上
3. **モダンアーキテクチャ**: TypeScriptの特性を活かした設計
4. **テスト駆動**: 各段階で動作確認を実施

## フェーズ別移行計画

### フェーズ1: 基盤整備 ✅
- [x] TypeScript依存関係の追加
- [x] tsconfig.json設定（strict mode有効）
- [x] 型定義ファイル（src/types/index.ts）実装
- [x] ビルドスクリプト整備

### フェーズ2: JavaScript完全削除とリファクタリング 🚧
既存のJavaScriptファイルを削除し、TypeScriptで再実装：

1. **server.js → 削除**
   - src/server.tsが完全に置き換え
   - package.jsonのスクリプトから削除
   - JavaScript版の起動オプションを廃止

2. **レガシーファイルの削除**
   - server-backup.js → 削除
   - test-server.js → 削除
   - hotspot-analysis.js → src/utils/hotspotAnalysis.ts
   - metadata-demo.js → src/utils/metadataDemo.ts
   - youtube-*.js → src/services/youtubeService.ts

3. **モジュール化とリファクタリング**
   - 巨大なserver.tsを機能別に分割
   - utils、services、middlewareに整理
   - 依存性注入パターンの採用

### フェーズ3: アーキテクチャ最適化 ⏳
- [ ] Clean Architecture原則の適用
- [ ] DIコンテナ（tsyringe等）の導入
- [ ] インターフェース駆動設計
- [ ] エラーハンドリングの統一

### フェーズ4: フロントエンド TypeScript化 ⏳
- [ ] public/index.htmlのJavaScript分離
- [ ] React/Vue.js等のフレームワーク導入検討
- [ ] APIクライアントのTypeScript化
- [ ] 型安全なAPI通信の実装

### フェーズ5: テストとCI/CD ⏳
- [ ] Jest + TypeScript設定
- [ ] 100%型カバレッジ目標
- [ ] GitHub Actions設定
- [ ] 自動デプロイパイプライン

## ファイル構造設計（TypeScriptのみ）

```
src/
├── index.ts                 # エントリーポイント
├── app.ts                   # Express アプリケーション設定
├── types/
│   ├── index.ts            ✅ 共通型定義
│   ├── api.ts              # API専用型
│   └── domain.ts           # ドメインモデル
├── controllers/             # コントローラー層
│   ├── youtubeController.ts
│   ├── chatController.ts
│   └── historyController.ts
├── services/                # ビジネスロジック層
│   ├── youtubeService.ts
│   ├── openaiService.ts
│   ├── whisperService.ts
│   └── dataService.ts
├── repositories/            # データアクセス層
│   ├── historyRepository.ts
│   └── costRepository.ts
├── utils/                   # ユーティリティ
│   ├── textFormatting.ts
│   ├── costCalculator.ts
│   ├── fileManager.ts
│   └── validation.ts
├── middleware/              # Express middleware
│   ├── errorHandler.ts
│   ├── logger.ts
│   └── cors.ts
├── config/                  # 設定管理
│   ├── index.ts
│   ├── api.ts
│   └── environment.ts
└── __tests__/              # テストファイル
    ├── unit/
    └── integration/
```

**JavaScriptファイルは一切残さない設計**

## 型定義設計

### 主要インターface
- `VideoMetadata`: YouTube動画のメタデータ
- `HistoryEntry`: 履歴エントリ
- `SessionCosts`: セッションコスト
- `CostEntry`: コスト履歴
- `TimestampedSegment`: タイムスタンプ付きセグメント
- `ChatRequest/Response`: チャット関連
- `UploadRequest/Response`: アップロード関連

### API Request/Response型
すべてのAPI endpointで適切な型定義を使用

## 開発フロー

### 1. 開発環境（TypeScriptのみ）
```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番サーバー起動
npm start

# 型チェック
npm run type-check

# テスト実行
npm test
```

### 2. JavaScript削除手順
1. 対応するTypeScriptファイルの実装完了確認
2. テストカバレッジ確認
3. JavaScriptファイル削除
4. package.jsonから関連スクリプト削除
5. 全体動作確認

### 3. コードレビュー
- 型安全性の確認
- パフォーマンス影響の確認
- コード品質の確認

## 品質保証

### 型チェック
```bash
# 型チェック実行
npx tsc --noEmit

# Watch mode
npm run build:watch
```

### テストスイート
```bash
# ユニットテスト
npm test

# E2Eテスト
npm run test:e2e
```

### 静的解析
```bash
# ESLint
npm run lint

# Prettier
npm run format
```

## マイルストーン

### M1: 基盤完成 ✅ (2025-01-23)
- TypeScript環境構築
- 基本型定義完成
- サーバー移行完了

### M2: JavaScript完全削除 (2025-01-31)
- すべてのJavaScriptファイル削除
- package.jsonのクリーンアップ
- TypeScriptのみでの動作確認

### M3: アーキテクチャ最適化 (2025-02-15)
- レイヤードアーキテクチャ実装
- DIコンテナ導入
- 型安全性の最大化

### M4: フロントエンド刷新 (2025-02-28)
- TypeScriptベースのSPA化
- 型安全なAPI通信
- モダンUIフレームワーク導入

### M5: 品質保証完了 (2025-03-15)
- テストカバレッジ90%以上
- CI/CDパイプライン完成
- パフォーマンス最適化

## 注意事項

### JavaScript削除時の注意
1. **バックアップ不要**: Gitで管理されているため削除は躊躇なく実行
2. **段階的削除**: 機能単位で削除し、都度動作確認
3. **設定ファイル更新**: package.json、起動スクリプト等の整合性確保

### 型エラーへの対応
1. `any`型は一切使用禁止
2. `unknown`型とType Guardsで安全に処理
3. strictNullChecks必須

### アーキテクチャ原則
1. **SOLID原則**の遵守
2. **依存性逆転**の原則適用
3. **インターフェース分離**の徹底

### パフォーマンス最適化
1. Tree-shakingを意識したモジュール設計
2. 動的インポートの活用
3. ビルド最適化の継続的改善

## 参考リソース

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express + TypeScript Best Practices](https://blog.logrocket.com/how-to-set-up-node-typescript-express/)
- [Node.js TypeScript Migration Guide](https://nodejs.org/en/docs/guides/typescript/)

---
**最終更新**: 2025-01-23  
**ステータス**: フェーズ1完了、フェーズ2準備中  
**方針**: JavaScript後方互換性なし、TypeScriptファーストで完全移行