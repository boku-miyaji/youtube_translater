# Issue #16 追加修正の差分

## 対応内容
レビューで指摘された追加の4つの問題を修正しました。

## 変更ファイル一覧
- src/components/pages/DashboardPage.tsx
- src/components/pages/SettingsPage.tsx  
- src/components/pages/UploadPage.tsx
- src/store/appStore.ts

## 詳細な差分

### 1. DashboardPage.tsx - Quick Uploadボタンのスタイル変更とクイック分析機能の実装

```diff
-import React from 'react'
-import { Link } from 'react-router-dom'
+import React, { useState } from 'react'
+import { Link, useNavigate } from 'react-router-dom'
 import { useHistory } from '../../hooks/useHistory'
 import { useCosts } from '../../hooks/useCosts'
 import MiniChart from '../shared/MiniChart'
@@ -7,6 +7,8 @@ import MiniChart from '../shared/MiniChart'
 const DashboardPage: React.FC = () => {
   const { data: history, isLoading: historyLoading, error: historyError } = useHistory()
   const { data: costs, isLoading: costsLoading } = useCosts()
+  const navigate = useNavigate()
+  const [quickUrl, setQuickUrl] = useState('')
 
   const recentVideos = history ? history.slice(0, 5) : []
   
@@ -44,6 +46,12 @@ const DashboardPage: React.FC = () => {
   const videoTrend = [2, 3, 1, 5, 4, 6, 3]
   const processingTimes = [45, 52, 38, 65, 43, 58, 41]
 
+  const handleQuickAnalyze = () => {
+    if (quickUrl.trim()) {
+      navigate('/upload', { state: { url: quickUrl.trim() } })
+    }
+  }
+
   return (
     <div className="space-y-10">
       {/* Hero Section */}
@@ -298,6 +306,8 @@ const DashboardPage: React.FC = () => {
               <div className="mb-4">
                 <input
                   type="text"
+                  value={quickUrl}
+                  onChange={(e) => setQuickUrl(e.target.value)}
                   placeholder="Paste YouTube URL here..."
                   className="w-full px-4 py-3 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/50"
                   data-testid="quick-url-input"
@@ -306,6 +316,7 @@ const DashboardPage: React.FC = () => {
               
               <div className="space-y-3">
                 <button
+                  onClick={handleQuickAnalyze}
                   className="w-full inline-flex items-center justify-center px-8 py-3 bg-white text-indigo-600 font-bold rounded-2xl hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-white focus:ring-opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                   data-testid="quick-analyze-button"
                 >
@@ -315,10 +326,10 @@ const DashboardPage: React.FC = () => {
                 
                 <Link
                   to="/upload"
-                  className="w-full inline-flex items-center justify-center px-8 py-3 bg-white/20 text-white font-semibold rounded-2xl hover:bg-white/30 focus:outline-none focus:ring-4 focus:ring-white focus:ring-opacity-50 transition-all duration-200 backdrop-blur-sm"
+                  className="inline-flex items-center justify-center px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors duration-200"
                 >
-                  <span className="mr-3 text-xl">📤</span>
-                  Full Upload Page
+                  <span className="mr-2 text-sm">📤</span>
+                  Go to full upload page →
                 </Link>
               </div>
             </div>
```

### 2. UploadPage.tsx - APIエンドポイントの修正とURLパラメータの受け取り

```diff
-import React, { useState } from 'react'
+import React, { useState, useEffect } from 'react'
+import { useLocation } from 'react-router-dom'
 import { useAppStore } from '../../store/appStore'
 import VideoPlayer from '../shared/VideoPlayer'
 import TranscriptViewer from '../shared/TranscriptViewer'
@@ -6,11 +7,18 @@ import ChatInterface from '../shared/ChatInterface'
 
 const UploadPage: React.FC = () => {
   const { currentVideo, setCurrentVideo, loading, setLoading } = useAppStore()
+  const location = useLocation()
   const [url, setUrl] = useState('')
-  const [language, setLanguage] = useState('Original')
+  const [language, setLanguage] = useState('original')
   const [model, setModel] = useState('gpt-4.1-mini')
   const [urlError, setUrlError] = useState('')
 
+  useEffect(() => {
+    if (location.state?.url) {
+      setUrl(location.state.url)
+    }
+  }, [location.state])
+
   // YouTube URL validation function
   const validateYouTubeUrl = (url: string): boolean => {
     const patterns = [
@@ -43,7 +51,7 @@ const UploadPage: React.FC = () => {
     setLoading(true)
     setUrlError('')
     try {
-      const response = await fetch('/api/process-video', {
+      const response = await fetch('/api/upload-youtube', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
```

### 3. appStore.ts - デフォルト言語の変更

```diff
@@ -24,7 +24,7 @@ export const useAppStore = create<AppState>((set) => ({
   sidebarCollapsed: false,
   currentVideo: null,
   loading: false,
-  language: 'ja',
+  language: 'original',
   theme: 'light',
   
   // Actions
```

### 4. SettingsPage.tsx - 言語設定のフォールバック値と選択肢の修正

```diff
@@ -92,13 +92,13 @@ const SettingsPage: React.FC = () => {
           </p>
           <select
             id="language"
-            value={language || 'ja'}
+            value={language || 'original'}
             onChange={(e) => setLanguage(e.target.value)}
             className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
           >
             <option value="ja">Japanese (日本語)</option>
             <option value="en">English</option>
-            <option value="Original">Original Language</option>
+            <option value="original">Original Language</option>
           </select>
         </div>
       </div>
```

## 修正内容のまとめ

1. **Dashboard Quick Uploadボタンの改善**
   - ボタンのスタイルを控えめなテキストリンクスタイルに変更
   - 「Full Upload Page」→「Go to full upload page →」に文言変更

2. **APIエンドポイントの修正**
   - `/api/process-video` → `/api/upload-youtube` に修正
   - バックエンドの実際のエンドポイントと一致するように

3. **クイック分析機能の実装**
   - DashboardページからURLを入力してUploadページに遷移する機能を追加
   - UploadページでURLパラメータを受け取る処理を実装

4. **デフォルト言語設定の修正**
   - appStoreのデフォルト言語を 'ja' → 'original' に変更
   - SettingsPageのフォールバック値も 'ja' → 'original' に変更
   - 言語選択肢の値を 'Original' → 'original' に統一（小文字）

## 注意事項
- バックエンドサーバー（ポート8080）が起動していない場合、APIエラーが発生します
- 開発時は `npm run dev`（バックエンド）と `npm run dev:client`（フロントエンド）を別々のターミナルで実行する必要があります