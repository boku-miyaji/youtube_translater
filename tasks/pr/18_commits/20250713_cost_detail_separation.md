# Issue #18 分析コスト詳細の分離表示

## 問題
Analysis画面のコスト詳細分析で、文字起こしと要約のコストが1つのリストとして表示されており、それぞれの詳細情報が見にくかった。

## 変更内容

### AnalyzePage.tsx（line 1242-1323）
分析コストの表示を改善し、文字起こしと要約を別々のセクションに分離：

#### 変更前
```tsx
<div className="space-y-1 text-sm">
  <div className="flex justify-between items-center">
    <span className="text-gray-800 font-medium">文字起こし:</span>
    <span className="font-semibold text-black">
      ${currentVideo.costs.transcription.toFixed(4)}
      {currentVideo.transcriptSource === 'subtitle' && (
        <span className="ml-2 text-sm text-gray-700 font-medium">(YouTube字幕)</span>
      )}
    </span>
  </div>
  <div className="flex justify-between items-center">
    <span className="text-gray-800 font-medium">要約:</span>
    <span className="font-semibold text-black">
      ${currentVideo.costs.summary.toFixed(4)}
    </span>
  </div>
</div>
```

#### 変更後
```tsx
<div className="space-y-2">
  {/* 文字起こしコスト詳細 */}
  <div className="bg-gray-50 p-2 rounded border border-gray-200">
    <div className="text-xs font-semibold text-gray-700 mb-1">📝 文字起こし</div>
    <div className="space-y-1 text-xs">
      <div className="flex justify-between">
        <span className="text-gray-600">方法:</span>
        <span className="text-gray-800">
          {currentVideo.transcriptSource === 'subtitle' ? 'YouTube字幕' : 'Whisper AI'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">コスト:</span>
        <span className="font-semibold text-black">
          {currentVideo.costs.transcription > 0 ? 
            `$${currentVideo.costs.transcription.toFixed(4)}` : 
            '無料'
          }
        </span>
      </div>
      {currentVideo.analysisTime?.transcription && (
        <div className="flex justify-between">
          <span className="text-gray-600">処理時間:</span>
          <span className="text-gray-800">
            {Math.round(currentVideo.analysisTime.transcription)}秒
          </span>
        </div>
      )}
    </div>
  </div>
  
  {/* 要約コスト詳細 */}
  <div className="bg-gray-50 p-2 rounded border border-gray-200">
    <div className="text-xs font-semibold text-gray-700 mb-1">📋 要約生成</div>
    <div className="space-y-1 text-xs">
      <div className="flex justify-between">
        <span className="text-gray-600">コスト:</span>
        <span className="font-semibold text-black">
          ${currentVideo.costs.summary.toFixed(4)}
        </span>
      </div>
      {currentVideo.analysisTime?.summary && (
        <div className="flex justify-between">
          <span className="text-gray-600">処理時間:</span>
          <span className="text-gray-800">
            {Math.round(currentVideo.analysisTime.summary)}秒
          </span>
        </div>
      )}
    </div>
  </div>
</div>
```

## 改善点
1. **セクション分離**: 文字起こしと要約が独立したボックスで表示
2. **詳細情報追加**: 処理方法、処理時間を表示
3. **視覚的改善**: 背景色とボーダーで各セクションを明確に区別
4. **アイコン追加**: 📝文字起こし、📋要約生成でわかりやすく表示
5. **タイトル変更**: 「分析コスト」→「分析コスト（実績）」で実際のコストであることを明確化

## 効果
- ユーザーが文字起こしと要約のコストを一目で区別できる
- 各処理にかかった時間も確認できる
- 処理方法（YouTube字幕 or Whisper AI）が明確に表示される
- 想定コスト内訳と同じような形式で統一感のあるUI