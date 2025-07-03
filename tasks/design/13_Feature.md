---
issue: 13
title: "UI改善: 画面分離とサイドバー追加"
type: Feature
description: |
  一つの画面で全てを表示するのをやめ、使用料金・履歴は別のページとして表示したい。サイドバーでそれぞれの画面を選択できるようにしたい
---

# UI改善設計: 画面分離とサイドバー追加

## 概要・要件分析

### 現状の課題
- **単一ページ構成**: 全機能が1つのHTML（1800+行）に集約
- **UI密度過多**: 動画プレーヤー、履歴、コスト分析、チャット等が同一画面に混在
- **認知負荷高**: ユーザーが必要な情報を見つけにくい
- **スケーラビリティ欠如**: 新機能追加時の画面レイアウト困難

### 目標
1. **機能別画面分離**: 関連性の高い機能をグループ化
2. **サイドバー導入**: 直感的なナビゲーション提供
3. **UX向上**: 各画面で専用の最適化されたレイアウト
4. **将来拡張性**: 新機能追加時の柔軟性確保

### 機能要件
- **必須**: 既存全機能の保持
- **必須**: 画面間での状態共有（選択動画等）
- **必須**: レスポンシブデザイン対応
- **推奨**: ページ遷移時のスムーズな体験
- **推奨**: 各画面のブックマーク可能性

## 技術設計

### アーキテクチャ設計

#### 1. 画面構成設計
```
┌─────────────────────────────────────────────────────────┐
│ Header (Fixed)                                          │
├─────────────┬───────────────────────────────────────────┤
│             │                                           │
│  Sidebar    │  Main Content Area                        │
│  (Fixed)    │  (Route-based)                           │
│             │                                           │
│ • Dashboard │  Route: /dashboard                        │
│ • Upload    │  Route: /upload                          │
│ • History   │  Route: /history                         │
│ • Analysis  │  Route: /analysis                        │
│ • Settings  │  Route: /settings                        │
│             │                                           │
└─────────────┴───────────────────────────────────────────┘
```

#### 2. 画面別機能分散

**Dashboard (`/dashboard`)**
- 最近処理した動画 (最大5件)
- 今日の使用量サマリー
- クイックアップロード
- システム状態表示

**Upload (`/upload`)**
- YouTube URL入力
- 言語・モデル選択
- 動画プレーヤー・メタデータ表示
- 文字起こし・要約結果表示
- 記事生成機能
- チャット機能

**History (`/history`)**
- 処理履歴一覧 (Timeline/Channel/Tag view)
- 検索・フィルタリング機能
- 詳細表示・再生機能
- 一括操作 (削除・エクスポート)

**Analysis (`/analysis`)**
- コスト分析 (日次・月次・累計)
- 使用量グラフ
- モデル別統計
- コスト予測機能

**Settings (`/settings`)**
- プロンプト設定
- 言語設定
- APIキー管理
- エクスポート・インポート

#### 3. 技術スタック選定

**Frontend Framework**: React + TypeScript
- **理由**: 既存のTypeScript型定義活用、コンポーネント化、エコシステム
- **代替**: Vue.js（学習コスト低）、Next.js（SSR必要時）

**Routing**: React Router v6
- **理由**: 標準的、ネストされたルーティング対応、TypeScript親和性
- **設定**: Hash routing (`HashRouter`) - SPAデプロイ簡素化

**State Management**: Zustand + React Query
- **理由**: Redux比較で軽量、学習コスト低、TypeScript親和性高
- **React Query**: サーバー状態管理、キャッシュ、再取得

**UI Framework**: Tailwind CSS + Headless UI
- **理由**: 既存CSS移行容易、一貫性、カスタマイズ性
- **代替**: Material-UI（コンポーネント豊富）、Chakra UI（シンプル）

#### 4. 状態管理設計

```typescript
// Global State (Zustand)
interface AppState {
  // UI State
  sidebarCollapsed: boolean
  currentVideo: VideoMetadata | null
  loading: boolean
  
  // User Preferences
  language: string
  theme: 'light' | 'dark'
  
  // Actions
  setSidebarCollapsed: (collapsed: boolean) => void
  setCurrentVideo: (video: VideoMetadata | null) => void
  setLoading: (loading: boolean) => void
}

// Server State (React Query)
const useHistory = () => useQuery({
  queryKey: ['history'],
  queryFn: fetchHistory
})

const useCosts = () => useQuery({
  queryKey: ['costs'],
  queryFn: fetchCosts
})
```

#### 5. コンポーネント設計

```typescript
// Layout Components
<AppLayout>
  <Header />
  <div className="flex">
    <Sidebar />
    <MainContent>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </MainContent>
  </div>
</AppLayout>

// Shared Components
- VideoPlayer
- TranscriptViewer
- ChatInterface
- HistoryTable
- CostChart
- ArticleEditor
```

### 実装詳細

#### 1. ファイル構造
```
src/
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── shared/
│   │   ├── VideoPlayer.tsx
│   │   ├── TranscriptViewer.tsx
│   │   ├── ChatInterface.tsx
│   │   └── HistoryTable.tsx
│   └── pages/
│       ├── DashboardPage.tsx
│       ├── UploadPage.tsx
│       ├── HistoryPage.tsx
│       ├── AnalysisPage.tsx
│       └── SettingsPage.tsx
├── hooks/
│   ├── useHistory.ts
│   ├── useCosts.ts
│   └── useUpload.ts
├── store/
│   └── appStore.ts
├── types/
│   └── index.ts (既存活用)
└── utils/
    ├── api.ts
    └── constants.ts
```

#### 2. 段階的移行戦略

**Phase 1: 基盤構築 (1-2週間)**
- React環境構築
- 基本レイアウト (Header, Sidebar, Routing)
- 既存API統合
- 基本的な状態管理

**Phase 2: 主要画面移行 (2-3週間)**
- Upload画面の完全移行
- History画面の移行
- 既存機能の動作確認

**Phase 3: 分析・設定画面 (1-2週間)**
- Analysis画面の高度なグラフ実装
- Settings画面の移行
- Dashboard画面の実装

**Phase 4: 最適化・改善 (1週間)**
- パフォーマンス最適化
- UX改善
- バグ修正

#### 3. データモデル設計

既存の型定義を活用し、画面固有の追加型のみ定義:

```typescript
// 画面固有の型
interface DashboardData {
  recentVideos: VideoMetadata[]
  todaysCosts: SessionCosts
  systemStatus: SystemStatus
}

interface AnalyticsData {
  costTrends: CostTrendData[]
  usageStats: UsageStats
  predictions: CostPrediction[]
}
```

## テスト戦略

### 1. Unit Testing
**フレームワーク**: Jest + React Testing Library
**対象**:
- 各コンポーネントの独立動作
- カスタムフックの状態管理
- ユーティリティ関数

**重要テストケース**:
```typescript
// Example: Sidebar navigation
test('sidebar navigation works correctly', () => {
  render(<AppLayout />)
  fireEvent.click(screen.getByText('History'))
  expect(screen.getByTestId('history-page')).toBeInTheDocument()
})
```

### 2. Integration Testing
**対象**:
- 画面間の状態共有
- API との統合
- ルーティング動作

### 3. E2E Testing
**フレームワーク**: Playwright
**シナリオ**:
- 動画アップロード → 履歴確認 → 分析画面確認のフル操作
- サイドバー経由の全画面アクセス
- レスポンシブ動作確認

### 4. Performance Testing
**指標**:
- 初期読み込み時間: < 3秒
- 画面遷移時間: < 500ms
- メモリ使用量: 既存比150%以内

## セキュリティ・パフォーマンス考慮事項

### セキュリティ
1. **XSS対策**: React の自動エスケープ活用
2. **CSRF対策**: 既存のAPIトークン機構継続使用
3. **機密データ**: API キーの適切な管理 (環境変数)
4. **ルーティング**: 認証不要だが、将来の拡張性考慮

### パフォーマンス
1. **Code Splitting**: React.lazy での画面単位分割
2. **Bundle Size**: 既存 vanilla JS と同等以下を目標
3. **Memory Management**: 
   - 大きなデータ (履歴・コスト) の仮想化
   - 不要なコンポーネントのアンマウント
4. **API Optimization**:
   - React Query でのキャッシュ活用
   - 必要データのみ取得する改善

```typescript
// Code splitting example
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'))
```

### アクセシビリティ
1. **キーボードナビゲーション**: サイドバー・画面遷移対応
2. **スクリーンリーダー**: ARIA ラベル適切設定
3. **色覚**: 分析グラフでの色以外の区別手法

## 未解決の設計課題

### 1. 状態永続化
**課題**: 画面遷移時の状態保持方法
**選択肢**:
- LocalStorage (簡単、容量制限あり)
- SessionStorage (セッション限定)
- URL パラメータ (ブックマーク可能)

**推奨**: 重要な状態のみ LocalStorage、一時的状態は SessionStorage

### 2. 既存ユーザーの移行
**課題**: 既存のブックマークや操作フローの変更
**対策**:
- 既存URL (`/`) を Dashboard へリダイレクト
- 移行案内の表示
- 段階的ロールアウト検討

### 3. SEO・共有対応
**課題**: 各画面の個別URL共有時のメタデータ
**解決策**: 
- 動的メタタグ設定
- Open Graph 対応
- 将来的に SSR 検討

### 4. オフライン対応
**課題**: ネットワーク不安定時の体験
**検討**: 
- Service Worker による基本機能のオフライン化
- 履歴データのローカルキャッシュ
- 再接続時の自動同期

### 5. モバイル体験
**課題**: サイドバーのモバイル対応
**解決策**:
- ハンバーガーメニュー
- スワイプジェスチャー
- タブレット向け最適化

---

この設計により、現在の単一画面アプリケーションを機能別に分離し、ユーザビリティを大幅に向上させることができます。段階的な実装により、既存機能を保持しながら安全に移行が可能です。