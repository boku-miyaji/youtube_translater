# Issue #18 Dashboard画面のQuick Analyzeに動画ファイルアップロード機能追加

## 問題
Dashboard画面のQuick Analyzeセクションで、YouTube URLのみサポートしており、動画ファイルのアップロードができなかった。Analyze画面では既に両方をサポートしている。

## 実装内容

### 1. DashboardPage.tsx
- **必要なインポートを追加**（line 7-8）：
  - `VideoFileUpload`コンポーネント
  - `VideoFile`型定義

- **状態管理の追加**（line 16-18）：
  ```typescript
  const [inputType, setInputType] = useState<'url' | 'file'>('url')
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null)
  const [fileError, setFileError] = useState('')
  ```

- **ハンドラー関数の追加**（line 86-106）：
  - `handleQuickAnalyze`: URLとファイル両方に対応
  - `handleFileSelected`: ファイル選択時の処理
  - `handleInputTypeChange`: 入力タイプ切り替え時の処理

- **UIの更新**（line 240-294）：
  - 入力タイプ選択ボタンを追加（YouTube URL / Video File）
  - 条件付きレンダリングでURLインプットとファイルアップロードを切り替え
  - Analyze Nowボタンに無効状態の制御を追加

### 2. AnalyzePage.tsx
- **location.stateの処理を更新**（line 35-54）：
  - Dashboard画面から渡されたvideoFileを受け取る処理を追加
  - inputTypeを'file'に設定してファイルアップロードモードに切り替え

## 技術的詳細
1. **状態管理**: 入力タイプ（URL/ファイル）を管理し、それぞれの入力値を保持
2. **ナビゲーション**: React Routerのstateを使用してAnalyze画面に情報を渡す
3. **UIの一貫性**: Analyze画面と同じ入力切り替えパターンを採用
4. **エラーハンドリング**: ファイルエラーの状態管理を実装

## 効果
- Dashboard画面からも動画ファイルを直接アップロードして解析できるようになった
- Analyze画面と同等の機能をQuick Analyzeで提供
- ユーザーエクスペリエンスの向上