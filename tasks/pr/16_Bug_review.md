以下では **「可読性・保守性」「安全性」「パフォーマンス」「UI/UX」** の 4 つの観点に分けて、現在の実装をどうリファクタリングするとより良くなるかを指摘＋提案します。
「全部やる」必要はありませんが、**① Markdown パーサー導入 → ② React コンポーネント化** だけでも劇的に読みやすくなります。

---

## 1. 可読性・保守性

| 問題点                                                                                | 改善アイデア                                                                                                                                                              |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **巨大なコンポーネント**<br>1 ファイルに UI ロジック・API コール・Markdown 変換が混在 | - `TranscriptTab.tsx` / `SummaryTab.tsx` / `ArticleTab.tsx` など **タブ単位で分割**<br>- `MarkdownRenderer.tsx` に Markdown→React 変換を切り出す                          |
| **正規表現だらけの Markdown 変換**                                                    | - `react-markdown` + `remark-gfm` を使い、「見出し・リスト」はデフォルトレンダラーに任せる<br>- タイムスタンプ／質問だけ **カスタム `components`** で置換する（例は後述） |
| **Tailwind クラスがインラインで氾濫**                                                 | - `clsx` で条件付きクラスを整理<br>- 繰り返すスタイルは `@apply` や Tailwind プリセット (`prose`) にまとめる                                                              |
| **Union 型を文字列ハードコード**                                                      | - `enum TabType { Transcript='transcript', Summary='summary', Article='article' }` にするとスペルミス防止                                                                 |

### ⬇︎ `react-markdown` でタイムスタンプを React に変換する例

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MarkdownRenderer: React.FC<{
  md: string;
  onSeek?: (sec: number) => void;
  onQuestionClick?: (q: string) => void;
}> = ({ md, onSeek, onQuestionClick }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      // インラインコードをタイムスタンプ判定
      text({ node, children }) {
        const txt = String(children);
        const m = txt.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (m && onSeek) {
          const [, mm, ss, hh] = m;
          const sec = hh ? +hh * 3600 + +mm * 60 + +ss : +mm * 60 + +ss;
          return (
            <span className="timestamp-style cursor-pointer" onClick={() => onSeek(sec)}>
              {txt}
            </span>
          );
        }
        return <>{children}</>;
      },

      // p 要素内の「?」終端文を検出して質問タグ化
      p({ node, children }) {
        // 質問抽出は好きなロジックで
        return <p className="mb-2 leading-relaxed">{children}</p>;
      },
    }}
  >
    {md}
  </ReactMarkdown>
);
```

- **正規表現は最小限**、しかも React ノードなので危険な `dangerouslySetInnerHTML` が不要
- Tailwind クラスも一元管理しやすい

---

## 2. 安全性（XSS & イベントハンドリング）

| 問題点                                                                   | 改善アイデア                                                                                                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dangerouslySetInnerHTML` による全挿入                                   | Markdown パーサー＋React レンダラーで **エスケープを自動化**                                                                                                 |
| `document.addEventListener('click', …, true)` で**グローバルキャプチャ** | - クリック処理は **各カスタムコンポーネント内で直接 onClick**<br>- どうしても文字列 HTML を使う場合は `ref.current.querySelectorAll('.time-ref')` で範囲限定 |

---

## 3. パフォーマンス

| 症状                                     | 改善策                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `markdownToHtml()` が **毎レンダー再走** | `useMemo(() => convert(md), [md])` でキャッシュ                                  |
| 長大な文字起こしを全部レンダリング       | - `react-window` で **バーチャルリスト**<br>- あるいはセグメント単位でページング |
| API コールのローディング管理が局所       | `react-query` / `SWR` を使い **キャッシュ & retry** を自動化                     |

---

## 4. UI/UX & アクセシビリティ

| いま                                   | 改善ポイント                                         |
| -------------------------------------- | ---------------------------------------------------- |
| ボタン要素に `type` 未指定             | `<button type="button">` を明示                      |
| スピナーは毎回同じ生 HTML              | `LoadingSpinner` コンポーネントを共通化              |
| アイコン＋テキストを複数箇所で直書き   | `TabButton` コンポーネントに集約                     |
| スクロール位置がタブ切替で保持されない | `useRef` で div.scrollTop を保存／復元               |
| カラーユニバーサル & キーボード操作    | `aria-label`, `role="tab"`, `aria-selected` 等を追加 |

---

## まとめ ― ざっくり改革ロードマップ

1. **Markdown パーサー導入**
   - `react-markdown/remark-gfm` + カスタム `components`
   - `dangerouslySetInnerHTML` & 大量正規表現を撤廃

2. **関心ごと分離**
   - Tabs・レンダラー・API フックをファイル分割
   - `useMarkdown.ts`, `useArticle.ts` のようなカスタム Hook

3. **状態管理を React Query に統一**
   - フェッチとキャッシュ、`loading/error` を簡潔に

4. **UI 部品をコンポーネント化**
   - ボタン・スピナー・カードを再利用
   - Tailwind `prose` + `@apply` でクラス激減

5. **アクセシビリティ & テスト**
   - `aria-*` 属性追加、`jest-react-testing-library` でクリック動作テスト

この順番で進めると **XSS リスク減・コード半分・見通しは倍** くらいの効果が得られます。
どこから手を付けるか迷う場合は **① Markdown パーサー化** だけでもまず試してみてください。
