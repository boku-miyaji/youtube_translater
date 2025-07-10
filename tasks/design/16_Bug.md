# UI/UX改善: 細かな機能修正

## Metadata

- **Issue**: 16
- **Title**: UI/UX改善: 細かな機能修正
- **Type**: Bug
- **Description**: 細かな機能修正 - サイドバー、Dashboard、Upload、Settings各種UI/UX問題の修正

## 概要・要件分析

### 現状の問題点

本Issue は複数のUI/UX問題を包含する統合的な修正タスクです。以下の主要領域で問題が発生しています：

1. **サイドバーの操作性**: 閉じるボタンの視認性とクリック領域の問題
2. **Dashboard の データ表示**: 計算ロジックと表示形式の問題
3. **Upload機能**: URL入力時のエラーハンドリング
4. **Settings**: デフォルト値の表示と言語設定の改善

### 技術的課題

- フロントエンド状態管理の不整合
- API通信エラーの適切なハンドリング不足
- UIコンポーネントの操作性設計の問題
- 設定値の永続化と初期表示の問題

## 技術設計

### アーキテクチャ考慮事項

#### 1. 状態管理アーキテクチャ

```typescript
// src/store/appStore.ts の拡張
interface AppState {
  sidebar: {
    isOpen: boolean;
    isAnimating: boolean;
  };
  dashboard: {
    dailySpending: number;
    lastDaySpending: number;
    totalVideos: number;
    dateRange: string;
  };
  settings: {
    defaultPrompt: string;
    defaultLanguage: string;
    isLoaded: boolean;
  };
}
```

#### 2. コンポーネント設計パターン

- **Compound Components**: サイドバーの複合コンポーネント化
- **Error Boundaries**: Upload機能のエラーハンドリング
- **Custom Hooks**: 設定値の管理と永続化

### 実装詳細

#### 1. サイドバー修正 (`src/components/layout/Sidebar.tsx`)

```typescript
// 問題: アイコンが半分しか表示されない
// 解決: CSS Grid + proper z-index management

const SidebarToggle = ({ isOpen, onToggle }: Props) => {
  return (
    <button
      className={`
        fixed top-4 left-4 z-50 p-2 rounded-lg
        bg-white shadow-lg border border-gray-200
        hover:bg-gray-50 transition-all duration-200
        ${isOpen ? 'translate-x-64' : 'translate-x-0'}
      `}
      onClick={onToggle}
    >
      {isOpen ? <X size={20} /> : <Menu size={20} />}
    </button>
  );
};
```

#### 2. Dashboard修正 (`src/components/pages/DashboardPage.tsx`)

```typescript
// 問題: Daily Spendingの計算ロジック
// 解決: 適切な比較計算とエラーハンドリング

const calculateSpendingChange = (current: number, previous: number) => {
  if (previous === 0) {
    return current > 0 ? '+100%' : '0%';
  }
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
};

// 問題: Recent Transcriptionsの表示
// 解決: useHistory hookの修正とエラーハンドリング強化
```

#### 3. Upload機能修正 (`src/components/pages/UploadPage.tsx`)

```typescript
// 問題: URL入力時のエラー
// 解決: バリデーションとエラーハンドリング

const validateYouTubeUrl = (url: string): boolean => {
  const patterns = [
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
  ];
  return patterns.some(pattern => pattern.test(url));
};
```

#### 4. Settings修正 (`src/components/pages/SettingsPage.tsx`)

```typescript
// 問題: デフォルト値の表示
// 解決: 設定値の適切な管理

const DEFAULT_PROMPT = `Please provide a clear and concise transcription of the video content.
Focus on accuracy and readability while maintaining the original meaning.`;

const DEFAULT_LANGUAGE = 'ja';

const useSettings = () => {
  const [settings, setSettings] = useState({
    defaultPrompt: DEFAULT_PROMPT,
    defaultLanguage: DEFAULT_LANGUAGE,
    isLoaded: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings({
        defaultPrompt: data.defaultPrompt || DEFAULT_PROMPT,
        defaultLanguage: data.defaultLanguage || DEFAULT_LANGUAGE,
        isLoaded: true,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSettings(prev => ({ ...prev, isLoaded: true }));
    }
  };
};
```

### データモデル設計

#### API エンドポイント拡張

```typescript
// src/server.ts に追加
app.get('/api/settings', (req, res) => {
  res.json({
    defaultPrompt: process.env.DEFAULT_PROMPT || DEFAULT_PROMPT,
    defaultLanguage: process.env.DEFAULT_LANGUAGE || 'ja',
  });
});

app.post('/api/settings', (req, res) => {
  const { defaultPrompt, defaultLanguage } = req.body;
  // 設定値の永続化ロジック
});
```

#### 型定義強化

```typescript
// src/types/index.ts
export interface Settings {
  defaultPrompt: string;
  defaultLanguage: string;
  lastUpdated: string;
}

export interface DashboardMetrics {
  dailySpending: number;
  previousSpending: number;
  totalVideos: number;
  dateRange: {
    start: string;
    end: string;
  };
}
```

## テスト戦略

### 1. ユニットテスト

```typescript
// tests/components/Sidebar.test.tsx
describe('Sidebar Component', () => {
  it('should toggle visibility correctly', () => {
    const { getByTestId } = render(<Sidebar />);
    const toggleButton = getByTestId('sidebar-toggle');

    fireEvent.click(toggleButton);
    expect(getByTestId('sidebar')).toHaveClass('translate-x-0');
  });

  it('should show proper close button icon when open', () => {
    const { getByTestId } = render(<Sidebar isOpen={true} />);
    expect(getByTestId('close-icon')).toBeInTheDocument();
  });
});
```

### 2. 統合テスト

```typescript
// tests/integration/Dashboard.test.tsx
describe('Dashboard Integration', () => {
  it('should display correct spending calculations', async () => {
    const mockData = {
      dailySpending: 10,
      previousSpending: 8
    };

    const { getByTestId } = render(<DashboardPage />);
    await waitFor(() => {
      expect(getByTestId('spending-change')).toHaveTextContent('+25.0%');
    });
  });
});
```

### 3. E2Eテスト

```typescript
// tests/e2e/ui-improvements.spec.ts
describe('UI Improvements', () => {
  it('should handle sidebar interactions properly', async () => {
    await page.goto('/');
    await page.click('[data-testid="sidebar-toggle"]');
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });

  it('should validate YouTube URLs in upload', async () => {
    await page.goto('/upload');
    await page.fill('[data-testid="url-input"]', 'invalid-url');
    await page.click('[data-testid="analyze-button"]');
    await expect(page.locator('[data-testid="url-error"]')).toBeVisible();
  });
});
```

## セキュリティ考慮事項

### 1. 入力バリデーション

- YouTube URL の厳密なパターンマッチング
- 設定値の型チェックとサニタイゼーション
- XSS対策のための適切なエスケープ処理

### 2. 設定値の保護

```typescript
// 機密情報の分離
const SAFE_SETTINGS = {
  defaultLanguage: string,
  // defaultPrompt は機密情報を含まないことを確認
};
```

## パフォーマンス考慮事項

### 1. レンダリング最適化

- サイドバーアニメーション: CSS Transform による GPU アクセラレーション
- Dashboard: React.memo による不要な再レンダリング防止
- Settings: debounced input による API呼び出し最適化

### 2. 状態管理の効率化

```typescript
// 状態の分割による部分的更新
const useDashboardMetrics = () => {
  return useQuery(['dashboard-metrics'], fetchMetrics, {
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
  });
};
```

## 未解決の設計課題

### 1. 国際化対応

- 現在の日本語ハードコーディング → i18n ライブラリの導入検討
- 設定画面での言語選択UI の改善

### 2. アクセシビリティ

- サイドバーのキーボードナビゲーション
- スクリーンリーダー対応のaria属性追加
- カラーコントラスト比の確認

### 3. 技術的負債

- 既存の `useHistory` hook の型安全性向上
- エラーハンドリングの統一化
- ログ出力の標準化

## 実装優先度

### High Priority (即座に修正)

1. サイドバーの閉じるボタン表示問題
2. Dashboard の計算ロジック修正
3. Upload URL バリデーション

### Medium Priority (次回リリース)

1. Settings デフォルト値表示
2. Recent Transcriptions エラーハンドリング
3. Quick Upload 機能追加

### Low Priority (将来的改善)

1. 国際化対応
2. アクセシビリティ向上
3. パフォーマンス最適化

## 完了基準

- [ ] サイドバーが正常に開閉し、ボタンが常に表示される
- [ ] Dashboard の計算が正確に表示される
- [ ] Upload 機能でエラーが適切にハンドリングされる
- [ ] Settings でデフォルト値が正しく表示される
- [ ] 全テストが通過する
- [ ] アクセシビリティチェックが完了する
