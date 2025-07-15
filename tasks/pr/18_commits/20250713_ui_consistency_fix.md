# Issue #18 UIの色の濃さ統一

## 問題
想定コスト内訳と想定処理時間の表示で色の濃さが異なり、想定処理時間が強調されているように見えていた。

## 原因
- **想定コスト内訳**: `bg-green-50 border border-green-200`（薄い緑背景）
- **想定処理時間**: `bg-gradient-to-r from-blue-100 to-indigo-100 border-2 border-blue-300 shadow-md`（グラデーション背景、太い枠線、影付き）

処理時間の表示に以下の要素が追加されていたため、視覚的に強調されていた：
1. グラデーション背景（from-blue-100 to-indigo-100）
2. 太い枠線（border-2）
3. 影効果（shadow-md）
4. アイコンのアニメーション（animate-pulse）
5. 大きいアイコンサイズ（text-2xl）
6. 太字の強調（font-bold、font-semibold）

## 実装内容

### AnalyzePage.tsx（line 536-569）
処理時間表示のスタイリングをコスト表示と統一：

```typescript
// 変更前
<div className="p-4 rounded-lg bg-gradient-to-r from-blue-100 to-indigo-100 border-2 border-blue-300 shadow-md">
  <div className="flex items-start gap-3">
    <span className="text-blue-700 text-2xl animate-pulse">⏱️</span>
    <div className="flex-1">
      <div className="text-base font-bold text-blue-900 mb-3">

// 変更後
<div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
  <div className="flex items-start gap-2">
    <span className="text-blue-600 text-lg">⏱️</span>
    <div className="flex-1">
      <div className="text-sm font-medium text-blue-800 mb-2">
```

### 変更点の詳細
1. **背景色**: グラデーション → 単色（bg-blue-50）
2. **枠線**: border-2 → border（標準の太さ）
3. **影**: shadow-md → なし
4. **パディング**: p-4 → p-3
5. **アイコン**: text-2xl animate-pulse → text-lg（アニメーションなし）
6. **文字サイズ**: text-base → text-sm、text-sm → text-xs
7. **フォント強度**: font-bold → font-medium

## 効果
- 想定コストと想定処理時間の表示が同じ視覚的重みを持つようになった
- 両方の情報が同等の重要度として表示される
- UIの一貫性が向上

## コミット
- `fix: Unify color intensity between cost and processing time displays`