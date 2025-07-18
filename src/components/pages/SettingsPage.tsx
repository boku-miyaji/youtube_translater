import React, { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { PromptsConfig } from '../../types'

// Default prompts for each content type
const DEFAULT_PROMPTS: PromptsConfig = {
  summarize: {
    youtube: {
      name: 'YouTube動画要約プロンプト',
      template: `あなたは動画コンテンツの分析専門家です。以下のYouTube動画の文字起こしを分析し、読みやすくコンパクトな要約を生成してください。
動画情報: タイトル={{title}}, 長さ={{duration}}, チャンネル={{channel}}
{{timestampNote}}
出力形式（重要：節間に余分な空行を入れない）:
## 📋 動画概要
(動画の目的と内容を2-3文で簡潔に)
## 🎯 主要ポイント
- (重要な内容を3-5個の箇条書きで。時間参照を含める)
## 💡 詳細解説
(各ポイントの詳しい説明。具体的な時間を含める)
## 🔑 キーワード・用語
(重要な専門用語や概念を説明。初出時間を含める)
## 📈 実践的価値
(視聴者が実際に活用できる内容。関連時間を含める)
注意事項: 情報は正確で簡潔に、専門用語は分かりやすく説明、時間参照は自然な文章中に組み込む(例: 3:45で説明)。セクション間には空行を入れず、コンパクトに出力すること。
{{transcriptContent}}`
    },
    pdf: {
      name: 'PDF論文要約プロンプト',
      template: `あなたは学術論文・文書の分析専門家です。以下のPDF文書のテキストを分析し、学術的で構造化された要約を生成してください。

文書情報: タイトル={{title}}, 著者={{authors}}, ページ数={{pageCount}}

要約の形式:
## 📋 文書概要
(研究の目的、対象、手法を2-3文で要約)
## 🎯 主要な貢献・発見
- (論文の核となる新規性や主張を3-5個の箇条書きで)
## 🔬 研究手法・アプローチ
(使用された手法、実験設計、データセットなど)
## 📊 主要な結果・知見
(数値結果、統計的知見、重要な発見)
## 🔑 キーワード・専門用語
(重要な専門用語や概念を分かりやすく説明)
## 📈 実用的価値・応用
(研究成果の実際の応用可能性や影響)

注意事項: 学術的な正確性を重視、専門用語は適切に説明、数値や統計結果は具体的に記載
{{transcriptContent}}`
    },
    audio: {
      name: '音声コンテンツ要約プロンプト',
      template: `あなたは音声コンテンツの分析専門家です。以下の音声ファイルの文字起こしを分析し、音声特有の特徴を考慮した要約を生成してください。

音声情報: タイトル={{title}}, 長さ={{duration}}
{{timestampNote}}

要約の形式:
## 📋 音声概要
(音声の目的、内容、形式を2-3文で要約)
## 🎯 主要なトピック
- (重要な話題を3-5個の箇条書きで。時間参照を含める)
## 💡 詳細な内容
(各トピックの詳しい説明。具体的な時間を含める)
## 🔑 キーワード・用語
(重要な専門用語や固有名詞を説明。初出時間を含める)
## 📈 実践的価値
(聞き手が実際に活用できる内容。関連時間を含める)

注意事項: 音声特有の表現やニュアンスを考慮、時間参照は自然な文章の中に組み込む
{{transcriptContent}}`
    }
  },
  article: {
    name: '解説記事プロンプト',
    template: `あなたは動画内容専門の解説記事ライターです。以下の文字起こしから、動画で実際に説明されている内容のみを使用して、コンパクトで読みやすい解説記事を作成してください。\n\n**絶対条件（違反禁止）**:\n✅ 文字起こしに明確に記載されている内容のみ使用\n❌ 一般的なプログラミング解説・チュートリアルは絶対禁止\n❌ 文字起こしにない外部知識・理論は絶対禁止\n❌ 「初心者向け」など汎用的な内容は絶対禁止\n❌ YouTube APIの使い方など、動画と無関係な内容は絶対禁止\n\n**出力形式（セクション間の空行なし）**:\n## 📖 この動画で学べること\n（動画の話者が実際に説明している内容を簡潔に）\n\n## 🎯 動画のポイント\n- （動画で実際に言及されているポイントを箇条書きで）\n\n## 💡 具体的な内容\n（動画で示されている実例・デモ・コード・手順を具体的に）\n\n## 🔧 動画で紹介されている活用方法\n（話者が実際に推奨・紹介している実用的な使い方のみ）\n\n## 📝 動画のまとめ\n（話者の結論や言及された価値を明確に）\n\n**文字起こし:**\n{transcript}\n\n**再度確認**: 文字起こしに明記されていない内容は一切追加しないでください。動画で実際に話されている内容のみを基に記事を作成してください。`
  },
  chat: {
    name: 'チャットシステムプロンプト',
    template: `あなたは動画内容に関する質問に答える親切なAIアシスタントです。提供された動画の文字起こし情報に基づいて、正確で詳細な回答を提供してください。\n\n回答の際は以下を心がけてください：\n- 文字起こしの内容に基づいた正確な情報を提供\n- 分かりやすく親切な口調で回答\n- 必要に応じて具体例や詳細な説明を含める\n- 動画内で言及されていない内容については明確に区別\n- ユーザーの理解度に合わせた説明\n\n動画の内容について何でもお気軽にお聞きください。`
  }
}

const SettingsPage: React.FC = () => {
  const { language, setLanguage } = useAppStore()
  const [prompts, setPrompts] = useState<PromptsConfig>(DEFAULT_PROMPTS)
  const [loading, setLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<'summarize' | 'article' | 'chat'>('summarize')
  const [activeSummarizeTab, setActiveSummarizeTab] = useState<'youtube' | 'pdf' | 'audio'>('youtube')

  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    try {
      const response = await fetch('/api/prompts')
      if (response.ok) {
        const data = await response.json()
        console.log('Loaded prompts data:', data)
        
        // Merge loaded data with defaults
        const mergedPrompts: PromptsConfig = {
          ...DEFAULT_PROMPTS,
          ...data,
          summarize: {
            ...DEFAULT_PROMPTS.summarize,
            ...(data.summarize || {})
          }
        }
        
        setPrompts(mergedPrompts)
      } else {
        setPrompts(DEFAULT_PROMPTS)
      }
    } catch (error) {
      console.error('Error loading prompts:', error)
      setPrompts(DEFAULT_PROMPTS)
    } finally {
      setIsLoaded(true)
    }
  }

  const savePrompts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prompts),
      })
      if (response.ok) {
        alert('Settings saved successfully!')
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving prompts:', error)
      alert('Failed to save settings. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePromptChange = (category: string, subcategory: string | null, value: string) => {
    if (subcategory) {
      // For nested prompts like summarize.youtube
      setPrompts({
        ...prompts,
        [category]: {
          ...prompts[category],
          [subcategory]: {
            ...prompts[category]?.[subcategory],
            template: value
          }
        }
      })
    } else {
      // For top-level prompts like article, chat
      setPrompts({
        ...prompts,
        [category]: {
          ...prompts[category],
          template: value
        }
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-app-primary">Settings</h1>
        <p className="mt-2 text-app-secondary">Configure your preferences and system settings.</p>
      </div>

      {/* Language Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-app-primary mb-4">Language Settings</h2>
        <div className="max-w-sm">
          <label htmlFor="language" className="block text-sm font-medium text-app-primary">
            Default Transcription Language
          </label>
          <p className="text-xs text-app-muted mt-1 mb-2">
            The default language for video transcription and processing
          </p>
          <select
            id="language"
            value={language || 'original'}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-1 block w-full border-app-medium rounded-md shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
          >
            <option value="ja">Japanese (日本語)</option>
            <option value="en">English</option>
            <option value="original">Original Language</option>
          </select>
        </div>
      </div>

      {/* Prompt Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-app-primary mb-4">Prompt Settings</h2>
        
        {/* Main Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('summarize')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'summarize'
                  ? 'border-gray-900 text-gray-900 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              要約 (Summarize)
            </button>
            <button
              onClick={() => setActiveTab('article')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'article'
                  ? 'border-gray-900 text-gray-900 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              記事 (Article)
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'chat'
                  ? 'border-gray-900 text-gray-900 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              チャット (Chat)
            </button>
          </nav>
        </div>

        <div className="mt-6">
          {activeTab === 'summarize' && (
            <div>
              {/* Content Type Tabs for Summarize */}
              <div className="mb-4">
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-4">
                    <button
                      onClick={() => setActiveSummarizeTab('youtube')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeSummarizeTab === 'youtube'
                          ? 'border-gray-900 text-gray-900 font-semibold'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      YouTube
                    </button>
                    <button
                      onClick={() => setActiveSummarizeTab('pdf')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeSummarizeTab === 'pdf'
                          ? 'border-gray-900 text-gray-900 font-semibold'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => setActiveSummarizeTab('audio')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeSummarizeTab === 'audio'
                          ? 'border-gray-900 text-gray-900 font-semibold'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      音声 (Audio)
                    </button>
                  </nav>
                </div>
              </div>

              {/* Summarize Content */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-app-primary mb-2">
                  {activeSummarizeTab === 'youtube' && 'YouTube動画要約プロンプト'}
                  {activeSummarizeTab === 'pdf' && 'PDF論文要約プロンプト'}
                  {activeSummarizeTab === 'audio' && '音声コンテンツ要約プロンプト'}
                </label>
                <textarea
                  rows={10}
                  value={prompts.summarize?.[activeSummarizeTab]?.template || DEFAULT_PROMPTS.summarize?.[activeSummarizeTab]?.template || ''}
                  onChange={(e) => handlePromptChange('summarize', activeSummarizeTab, e.target.value)}
                  className="mt-1 block w-full border-app-medium rounded-md shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 font-mono text-sm"
                  disabled={!isLoaded}
                />
                <p className="mt-2 text-xs text-gray-500">
                  使用可能な変数: {'{{title}}'}, {'{{duration}}'}, {'{{channel}}'} (YouTube), {'{{authors}}'}, {'{{pageCount}}'} (PDF), {'{{transcriptContent}}'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'article' && (
            <div>
              <label className="block text-sm font-medium text-app-primary mb-2">
                解説記事生成プロンプト
              </label>
              <textarea
                rows={10}
                value={prompts.article?.template || DEFAULT_PROMPTS.article?.template || ''}
                onChange={(e) => handlePromptChange('article', null, e.target.value)}
                className="mt-1 block w-full border-app-medium rounded-md shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 font-mono text-sm"
                disabled={!isLoaded}
              />
              <p className="mt-2 text-xs text-gray-500">
                使用可能な変数: {'{transcript}'}
              </p>
            </div>
          )}

          {activeTab === 'chat' && (
            <div>
              <label className="block text-sm font-medium text-app-primary mb-2">
                チャットシステムプロンプト
              </label>
              <textarea
                rows={10}
                value={prompts.chat?.template || DEFAULT_PROMPTS.chat?.template || ''}
                onChange={(e) => handlePromptChange('chat', null, e.target.value)}
                className="mt-1 block w-full border-app-medium rounded-md shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 font-mono text-sm"
                disabled={!isLoaded}
              />
              <p className="mt-2 text-xs text-gray-500">
                チャットシステムの初期プロンプトを設定します
              </p>
            </div>
          )}
        </div>

        <div className="mt-6">
          <button
            onClick={savePrompts}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-gray-700 text-white border border-transparent text-sm font-medium rounded-md shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:hover:bg-gray-700 transition-colors"
          >
            {loading ? (
              <>
                <div className="loading mr-2" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>

      {/* Export/Import */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-app-primary mb-4">Data Management</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-app-secondary mb-2">Export your data for backup or migration</p>
            <button
              onClick={() => window.open('/api/export', '_blank')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"
            >
              <span className="mr-2">📤</span>
              Export Data
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage