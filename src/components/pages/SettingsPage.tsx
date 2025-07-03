import React, { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'

// Default prompts
const DEFAULT_PROMPTS = {
  summarize: `Please provide a clear and concise summary of the video content.
Focus on the main points and key insights while maintaining accuracy.`,
  article: `Please create a well-structured article based on the video content.
Include an introduction, main sections with clear headings, and a conclusion.
Ensure the content is engaging and informative for readers.`,
  chat: `You are a helpful AI assistant that can answer questions about the video content.
Provide accurate, detailed responses based on the transcript information.
Be friendly and informative in your responses.`
}

const SettingsPage: React.FC = () => {
  const { language, setLanguage } = useAppStore()
  const [prompts, setPrompts] = useState<any>(DEFAULT_PROMPTS)
  const [loading, setLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    try {
      const response = await fetch('/api/prompts')
      if (response.ok) {
        const data = await response.json()
        console.log('Loaded prompts data:', data)
        
        // Ensure all values are strings
        const processedData = {}
        Object.keys(data).forEach(key => {
          if (typeof data[key] === 'string') {
            processedData[key] = data[key]
          } else if (data[key]?.template) {
            // Handle case where data might be objects with template property
            processedData[key] = data[key].template
          } else {
            // Fallback to default for invalid data
            processedData[key] = DEFAULT_PROMPTS[key] || ''
          }
        })
        
        // Merge with defaults to ensure all prompts have values
        setPrompts({
          ...DEFAULT_PROMPTS,
          ...processedData
        })
      } else {
        // If API fails, use defaults
        setPrompts(DEFAULT_PROMPTS)
      }
    } catch (error) {
      console.error('Error loading prompts:', error)
      // If API fails, use defaults
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

  const handlePromptChange = (key: string, value: string) => {
    setPrompts({ ...prompts, [key]: value })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">Configure your preferences and system settings.</p>
      </div>

      {/* Language Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Language Settings</h2>
        <div className="max-w-sm">
          <label htmlFor="language" className="block text-sm font-medium text-gray-700">
            Default Transcription Language
          </label>
          <p className="text-xs text-gray-500 mt-1 mb-2">
            The default language for video transcription and processing
          </p>
          <select
            id="language"
            value={language || 'original'}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="ja">Japanese (日本語)</option>
            <option value="en">English</option>
            <option value="original">Original Language</option>
          </select>
        </div>
      </div>

      {/* Prompt Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Prompt Settings</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="summarize" className="block text-sm font-medium text-gray-700">
              Summarize Prompt
            </label>
            <textarea
              id="summarize"
              rows={4}
              value={prompts.summarize || DEFAULT_PROMPTS.summarize}
              onChange={(e) => handlePromptChange('summarize', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={DEFAULT_PROMPTS.summarize}
              disabled={!isLoaded}
            />
          </div>

          <div>
            <label htmlFor="article" className="block text-sm font-medium text-gray-700">
              Article Generation Prompt
            </label>
            <textarea
              id="article"
              rows={4}
              value={prompts.article || DEFAULT_PROMPTS.article}
              onChange={(e) => handlePromptChange('article', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={DEFAULT_PROMPTS.article}
              disabled={!isLoaded}
            />
          </div>

          <div>
            <label htmlFor="chat" className="block text-sm font-medium text-gray-700">
              Chat System Prompt
            </label>
            <textarea
              id="chat"
              rows={4}
              value={prompts.chat || DEFAULT_PROMPTS.chat}
              onChange={(e) => handlePromptChange('chat', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={DEFAULT_PROMPTS.chat}
              disabled={!isLoaded}
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={savePrompts}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
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
        <h2 className="text-lg font-medium text-gray-900 mb-4">Data Management</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Export your data for backup or migration</p>
            <button
              onClick={() => window.open('/api/export', '_blank')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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