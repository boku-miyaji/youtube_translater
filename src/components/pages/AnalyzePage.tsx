import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import TranscriptViewer from '../shared/TranscriptViewer'
import ChatInterface from '../shared/ChatInterface'
const AnalyzePage: React.FC = () => {
  const { currentVideo, setCurrentVideo, loading, setLoading } = useAppStore()
  const location = useLocation()
  const [url, setUrl] = useState('')
  const [language, setLanguage] = useState('original')
  const [model, setModel] = useState('gpt-4o-mini')
  const [urlError, setUrlError] = useState('')
  const [playerRef, setPlayerRef] = useState<any>(null)
  const [prefillQuestion, setPrefillQuestion] = useState<string>('')
  const [videoPreview, setVideoPreview] = useState<{title: string, thumbnail: string} | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [formCollapsed, setFormCollapsed] = useState(false)
  const [showCostInfo, setShowCostInfo] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (location.state?.url) {
      setUrl(location.state.url)
      // Auto-submit if autoAnalyze flag is set
      if (location.state.autoAnalyze) {
        // Small delay to allow state to settle
        setTimeout(() => {
          const form = document.querySelector('form')
          if (form) {
            form.requestSubmit()
          }
        }, 100)
      }
    }
  }, [location.state])

  // YouTube URL validation function
  const validateYouTubeUrl = (url: string): boolean => {
    const patterns = [
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/
    ]
    return patterns.some(pattern => pattern.test(url))
  }

  // Extract YouTube video ID
  const extractVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
    const match = url.match(regex)
    return match ? match[1] : null
  }

  // Generate instant preview
  const generateVideoPreview = (url: string) => {
    const videoId = extractVideoId(url)
    if (videoId) {
      setVideoPreview({
        title: 'YouTube Video',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      })
    } else {
      setVideoPreview(null)
    }
  }

  const handleUrlChange = (value: string) => {
    setUrl(value)
    setUrlError('')
    setVideoPreview(null)
    
    if (value.trim()) {
      if (validateYouTubeUrl(value.trim())) {
        // Generate instant preview for valid URLs
        generateVideoPreview(value.trim())
      } else {
        setUrlError('Please enter a valid YouTube URL')
      }
    }
  }

  // Handle paste event for instant preview
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text')
    if (pastedText && validateYouTubeUrl(pastedText)) {
      setTimeout(() => generateVideoPreview(pastedText), 100)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    // Validate URL before processing
    if (!validateYouTubeUrl(url.trim())) {
      setUrlError('Please enter a valid YouTube URL')
      return
    }

    setLoading(true)
    setUrlError('')
    // Expand form during analysis
    setFormCollapsed(false)
    try {
      console.log('Sending request to /api/upload-youtube with:', { url: url.trim(), language, model })
      const response = await fetch('/api/upload-youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          language,
          model,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Video processing failed:', response.status, response.statusText, errorText)
        throw new Error(`Failed to process video: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      console.log('🕒 AnalyzePage: Server response analysis time:', data.analysisTime)
      console.log('🕒 AnalyzePage: Metadata analysis time:', data.metadata?.analysisTime)
      
      // Convert server response to VideoMetadata format
      const videoMetadata = {
        basic: {
          title: data.title,
          videoId: data.metadata?.basic?.videoId || '',
          duration: data.metadata?.basic?.duration || 0,
          channel: data.metadata?.basic?.channel || 'Unknown',
          viewCount: data.metadata?.basic?.viewCount || 0,
          likes: data.metadata?.basic?.likes || 0,
          uploadDate: data.metadata?.basic?.uploadDate || '',
          publishDate: data.metadata?.basic?.publishDate || '',
          category: data.metadata?.basic?.category || '',
          description: data.metadata?.basic?.description || ''
        },
        chapters: data.metadata?.chapters || [],
        captions: data.metadata?.captions || [],
        stats: data.metadata?.stats || {
          formatCount: 0,
          hasSubtitles: false,
          keywords: []
        },
        transcript: data.transcript,
        summary: data.summary,
        timestampedSegments: data.timestampedSegments || [],
        transcriptSource: data.method as 'subtitle' | 'whisper',
        costs: data.costs || {
          transcription: 0,
          summary: 0,
          article: 0,
          total: 0
        },
        analysisTime: data.analysisTime
      }
      
      console.log('🕒 AnalyzePage: Final videoMetadata analysis time:', videoMetadata.analysisTime)
      
      setCurrentVideo(videoMetadata)
      // Auto-collapse form after successful analysis
      setFormCollapsed(true)
    } catch (error) {
      console.error('Error processing video:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to process video: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // Handle question clicks from TranscriptViewer
  const handleQuestionClick = (question: string) => {
    setPrefillQuestion(question)
    // Clear the question after a brief delay to allow ChatInterface to pick it up
    setTimeout(() => setPrefillQuestion(''), 100)
  }

  // Handle article generation cost update
  const handleArticleGenerated = (cost: number) => {
    if (currentVideo && currentVideo.costs) {
      const updatedCosts = {
        ...currentVideo.costs,
        article: cost,
        total: currentVideo.costs.transcription + currentVideo.costs.summary + cost
      }
      
      setCurrentVideo({
        ...currentVideo,
        costs: updatedCosts
      })
    }
  }

  // Handle form collapse/expand toggle
  const toggleFormCollapse = () => {
    setFormCollapsed(!formCollapsed)
  }


  // Debug current video data
  useEffect(() => {
    console.log('🎬 UploadPage: VIDEO DATA CHANGED EVENT')
    if (currentVideo) {
      console.log('🎬 UploadPage: Current video received:', {
        title: currentVideo.basic?.title,
        videoId: currentVideo.basic?.videoId,
        transcript: currentVideo.transcript ? `PRESENT (${currentVideo.transcript.length} chars)` : 'MISSING',
        summary: currentVideo.summary ? `PRESENT (${currentVideo.summary.length} chars)` : 'MISSING',
        timestampedSegments: `${currentVideo.timestampedSegments?.length || 0} segments`,
        chapters: `${currentVideo.chapters?.length || 0} chapters`,
        captions: `${currentVideo.captions?.length || 0} captions`
      })
      
      // Detailed content inspection
      if (currentVideo.transcript) {
        console.log('🎬 UploadPage: Transcript preview:', currentVideo.transcript.substring(0, 100) + '...')
      }
      if (currentVideo.summary) {
        console.log('🎬 UploadPage: Summary preview:', currentVideo.summary.substring(0, 100) + '...')
      }
      if (currentVideo.timestampedSegments?.length) {
        console.log('🎬 UploadPage: First timestamped segment:', currentVideo.timestampedSegments[0])
      }
      
    } else {
      console.log('🎬 UploadPage: No current video (cleared)')
    }
    console.log('🎬 UploadPage: VIDEO DATA CHANGE EVENT COMPLETE')
  }, [currentVideo])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Header Section */}
      <div className="text-center lg:text-left">
        <h1 className="text-display text-app-primary flex items-center justify-center lg:justify-start gap-3">
          🎥 Analyze Video
        </h1>
        <p className="mt-3 text-body text-app-secondary max-w-2xl">
          Transform YouTube videos into insights with AI-powered transcription, summaries, and interactive chat.
        </p>
      </div>

      {/* Control Bar - Collapsible Form */}
      <div className="transition-all duration-300 ease-in-out">
        <div className="card-modern overflow-hidden">
          {/* Collapsed State - Minimal Display with Editable URL */}
          {formCollapsed && currentVideo && (
            <div className="p-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-medium text-app-primary whitespace-nowrap">🔗 URL:</span>
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="url"
                      value={url}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      onPaste={handleUrlPaste}
                      placeholder="https://www.youtube.com/watch?v=... または動画タイトルを入力"
                      className={`w-full px-3 py-2 text-sm rounded-lg border-2 transition-all duration-200 focus-ring font-mono ${
                        urlError 
                          ? 'border-red-300 bg-red-50 text-red-900 placeholder-red-400' 
                          : 'border-gray-200 hover:border-gray-300 focus:border-blue-500 bg-white'
                      }`}
                      required
                    />
                    
                    {urlError && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                        ⚠️ {urlError}
                      </div>
                    )}
                  </div>
                </div>

                {/* URL Preview Card in Collapsed State */}
                {videoPreview && !urlError && (
                  <div className="url-preview-card mb-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={videoPreview.thumbnail} 
                        alt="Video thumbnail"
                        className="w-12 h-9 object-cover rounded shadow-sm"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="36" fill=""%23e5e7eb""%3E%3Crect width="48" height="36"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill=""%23676767"" font-size="10"%3E📹%3C/text%3E%3C/svg%3E'
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-blue-800">
                          ✅ Valid YouTube URL detected
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={toggleFormCollapse}
                    type="button"
                    className="btn-modern px-3 py-2 text-xs text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
                    title="Expand form for advanced options"
                  >
                    <span className="flex items-center gap-1">
                      ⚙️ Advanced
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  
                  <button
                    type="submit"
                    disabled={loading || !url.trim() || !!urlError}
                    className="btn-modern btn-success px-4 py-2 text-sm text-white font-semibold shadow-elevation-hover flex-shrink-0"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Analyzing...</span>
                      </div>
                    ) : (
                      <span className="flex items-center gap-2">
                        ⚡ <span className="hidden sm:inline">Analyze</span>
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Expanded State - Full Form */}
          {(!formCollapsed || !currentVideo) && (
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Form Header with Collapse Button */}
                {currentVideo && (
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-app-primary">Analyze New Video</h3>
                    <button
                      type="button"
                      onClick={toggleFormCollapse}
                      className="btn-modern px-3 py-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
                      title="Minimize form"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        Minimize
                      </span>
                    </button>
                  </div>
                )}

                {/* URL Input with Preview */}
                <div className="space-y-4">
                  <div className="relative">
                    <label htmlFor="url" className="block text-sm font-medium text-app-primary mb-2">
                      <span className="flex items-center gap-2">
                        🔗 YouTube URL
                      </span>
                    </label>
                    <input
                      type="url"
                      id="url"
                      ref={inputRef}
                      value={url}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      onPaste={handleUrlPaste}
                      placeholder="https://www.youtube.com/watch?v=... または動画タイトルを入力"
                      className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 focus-ring text-body ${
                        urlError 
                          ? 'border-red-300 bg-red-50 text-red-900 placeholder-red-400' 
                          : 'border-gray-200 hover:border-gray-300 focus:border-blue-500 bg-white'
                      }`}
                      data-testid="url-input"
                      required
                    />
                    
                    {urlError && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                        ⚠️ {urlError}
                      </div>
                    )}
                  </div>

                  {/* URL Preview Card */}
                  {videoPreview && !urlError && (
                    <div className="url-preview-card">
                      <div className="flex items-center gap-4">
                        <img 
                          src={videoPreview.thumbnail} 
                          alt="Video thumbnail"
                          className="w-20 h-15 object-cover rounded-lg shadow-sm"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="60" fill="%23e5e7eb"%3E%3Crect width="80" height="60"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%236b7280"%3E📹%3C/text%3E%3C/svg%3E'
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm text-blue-800">
                            ✅ Valid YouTube URL detected
                          </div>
                          <p className="text-xs text-blue-600 mt-1 opacity-75">
                            Ready to analyze
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Settings Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="language" className="block text-sm font-medium text-app-primary mb-2">
                      🌐 Language
                    </label>
                    <select
                      id="language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus-ring text-body bg-white"
                    >
                      <option value="original">Original</option>
                      <option value="ja">Japanese</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="model" className="block text-sm font-medium text-app-primary mb-2">
                      🤖 AI Model
                    </label>
                    <select
                      id="model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus-ring text-body bg-white"
                    >
                      <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                      <option value="gpt-4o">GPT-4o (Balanced)</option>
                      <option value="gpt-4">GPT-4 (Premium)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                    <button
                      type="submit"
                      disabled={loading || !url.trim() || !!urlError}
                      className="btn-modern btn-success w-full h-10 text-white font-semibold shadow-elevation-hover"
                      data-testid="analyze-button"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span className="text-tabular">Analyzing...</span>
                        </div>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          ⚡ Analyze Video
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Loading State with Skeleton */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="skeleton h-64 w-full rounded-xl"></div>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="skeleton h-12 w-full rounded-lg"></div>
              <div className="skeleton h-6 w-3/4 rounded"></div>
              <div className="skeleton h-6 w-1/2 rounded"></div>
              <div className="skeleton h-40 w-full rounded-lg"></div>
            </div>
          </div>
        </div>
      )}

      {/* Video Content - 3-Tier Layout */}
      {currentVideo && !loading && (
        <div className="space-y-8">
          {/* Top Tier: Full-Width Video Player (16:9) */}
          <div className="w-full">
            <div className="card-modern overflow-hidden">
              {/* Video iframe with proper 16:9 aspect ratio */}
              <div className="aspect-video">
                {currentVideo.basic?.videoId && (
                  <iframe
                    ref={(iframe) => {
                      if (iframe && !playerRef) {
                        // Initialize YouTube Player API when iframe is ready
                        const initPlayer = () => {
                          if (window.YT && window.YT.Player) {
                            const player = new window.YT.Player(iframe, {
                              events: {
                                onReady: (event: any) => {
                                  setPlayerRef(event.target)
                                }
                              }
                            })
                          }
                        }
                        
                        if (window.YT) {
                          initPlayer()
                        } else {
                          // Load YouTube API if not already loaded
                          const tag = document.createElement('script')
                          tag.src = 'https://www.youtube.com/iframe_api'
                          const firstScriptTag = document.getElementsByTagName('script')[0]
                          firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
                          
                          window.onYouTubeIframeAPIReady = initPlayer
                        }
                      }
                    }}
                    src={`https://www.youtube.com/embed/${currentVideo.basic.videoId}?enablejsapi=1`}
                    title={currentVideo.basic.title || 'YouTube Video'}
                    className="w-full h-full"
                    allowFullScreen
                  />
                )}
              </div>
              
              {/* Video metadata outside aspect ratio container */}
              <div className="p-6 space-y-3">
                <h3 className="text-subheading text-app-primary font-semibold">
                  {currentVideo.basic?.title || 'Unknown Title'}
                </h3>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">⏱</span>
                    <span className="text-tabular">
                      {currentVideo.basic?.duration ? 
                        `${Math.floor(currentVideo.basic.duration / 60)}:${(currentVideo.basic.duration % 60).toString().padStart(2, '0')}` 
                        : 'Unknown'
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">📺</span>
                    <span className="truncate max-w-32">{currentVideo.basic?.channel || 'Unknown Channel'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">👁</span>
                    <span className="text-tabular">
                      {currentVideo.basic?.viewCount ? 
                        currentVideo.basic.viewCount >= 1000000 ? 
                          `${(currentVideo.basic.viewCount / 1000000).toFixed(1)}M views` :
                        currentVideo.basic.viewCount >= 1000 ?
                          `${(currentVideo.basic.viewCount / 1000).toFixed(1)}K views` :
                          `${currentVideo.basic.viewCount.toLocaleString()} views`
                        : 'Unknown views'
                      }
                    </span>
                  </div>
                  {currentVideo.basic?.likes && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">👍</span>
                      <span className="text-tabular">{currentVideo.basic.likes.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {currentVideo.basic?.uploadDate && (
                  <p className="text-xs text-gray-500">
                    Uploaded: {new Date(currentVideo.basic.uploadDate).toLocaleDateString()}
                  </p>
                )}

                {currentVideo.basic?.description && (
                  <details className="text-sm text-gray-600">
                    <summary className="cursor-pointer hover:text-gray-800 font-medium py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                      📝 Description
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
                      <p className="whitespace-pre-wrap text-body">{currentVideo.basic.description}</p>
                    </div>
                  </details>
                )}

                {currentVideo.chapters && currentVideo.chapters.length > 0 && (
                  <details className="text-sm text-gray-600">
                    <summary className="cursor-pointer hover:text-gray-800 font-medium py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                      📑 Chapters ({currentVideo.chapters.length})
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
                      <ul className="space-y-2">
                        {currentVideo.chapters.map((chapter, index) => (
                          <li key={index} className="flex gap-3 items-start">
                            <span className="font-mono text-xs bg-white px-2 py-1 rounded border text-indigo-600 font-semibold min-w-fit">
                              {chapter.timestamp}
                            </span>
                            <span className="text-body">{chapter.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                )}

                {currentVideo.stats?.keywords && currentVideo.stats.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {currentVideo.stats.keywords.slice(0, 5).map((keyword, index) => (
                      <span
                        key={index}
                        className="inline-block px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-200 transition-colors hover:bg-blue-100"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}

                {/* Cost and Analysis Time Information */}
                {(currentVideo.costs || currentVideo.analysisTime) && (
                  <div className="bg-gray-50 p-3 rounded border border-gray-300 shadow-sm">
                    {/* Toggle Button */}
                    <button
                      onClick={() => setShowCostInfo(!showCostInfo)}
                      className="w-full flex items-center justify-between px-2 py-2 mb-3 text-sm font-bold text-slate-900 bg-white rounded border border-gray-200 hover:bg-gray-50"
                      style={{ color: '#000000' }}
                    >
                      <span className="flex items-center gap-1">
                        <span>{showCostInfo ? '📊' : '📊'}</span>
                        分析情報 {showCostInfo ? '（非表示にする）' : '（表示する）'}
                      </span>
                      <svg
                        className={`w-4 h-4 transition-transform ${showCostInfo ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {/* Content */}
                    {showCostInfo && (
                      <div className="bg-white p-3 rounded border border-gray-200">
                        <div className="space-y-4">
                        {/* Cost Information */}
                        {currentVideo.costs && (
                          <div>
                            <h4 className="text-sm font-semibold text-black mb-2 flex items-center gap-1">
                              💰 分析コスト
                            </h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-800 font-medium">文字起こし:</span>
                                <span className="font-semibold text-black">
                                {currentVideo.costs.transcription > 0 ? 
                                  `$${currentVideo.costs.transcription.toFixed(4)}` : 
                                  '無料'
                                }
                                {currentVideo.transcriptSource === 'subtitle' && (
                                  <span className="ml-2 text-sm text-gray-700 font-medium">(YouTube字幕)</span>
                                )}
                                {currentVideo.transcriptSource === 'whisper' && (
                                  <span className="ml-2 text-sm text-gray-700 font-medium">(Whisper AI)</span>
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-800 font-medium">要約:</span>
                              <span className="font-semibold text-black">
                                ${currentVideo.costs.summary.toFixed(4)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-800 font-medium">記事:</span>
                              <span className="font-semibold text-black">
                                {currentVideo.costs.article > 0 ? 
                                  `$${currentVideo.costs.article.toFixed(4)}` : 
                                  '未生成'
                                }
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-300">
                              <span className="text-black font-semibold">合計:</span>
                              <span className="font-bold text-black text-base">
                                ${currentVideo.costs.total.toFixed(4)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Analysis Time Information */}
                      {currentVideo.analysisTime && (
                        <div>
                          <h4 className="text-sm font-semibold text-black mb-2 flex items-center gap-1">
                            ⏱️ 解析時間
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-800 font-medium">開始:</span>
                              <span className="font-semibold text-black">
                                {new Date(currentVideo.analysisTime.startTime).toLocaleString('ja-JP', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-800 font-medium">終了:</span>
                              <span className="font-semibold text-black">
                                {new Date(currentVideo.analysisTime.endTime).toLocaleString('ja-JP', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-300">
                              <span className="text-black font-semibold">所要時間:</span>
                              <span className="font-bold text-black text-base">
                                {currentVideo.analysisTime.duration < 60 ? 
                                  `${currentVideo.analysisTime.duration}秒` : 
                                  `${Math.floor(currentVideo.analysisTime.duration / 60)}分${currentVideo.analysisTime.duration % 60}秒`
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Inference Statistics */}
                      {currentVideo.inferenceStats && (
                        <div>
                          <h4 className="text-sm font-semibold text-black mb-2 flex items-center gap-1">
                            🧠 推論統計
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-800 font-medium">API呼び出し数:</span>
                              <span className="font-semibold text-black">
                                {currentVideo.inferenceStats.apiCallCount}回
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-800 font-medium">合計トークン:</span>
                              <span className="font-semibold text-black">
                                {currentVideo.inferenceStats.totalTokens.input + currentVideo.inferenceStats.totalTokens.output}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-800 font-medium">効率スコア:</span>
                              <span className="font-bold text-black text-base">
                                {currentVideo.inferenceStats.efficiencyScore}/100
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Middle Tier: Full-Width Transcript/Summary/Article Tabs */}
          <div className="w-full">
            <TranscriptViewer 
              transcript={currentVideo.transcript}
              timestampedSegments={currentVideo.timestampedSegments}
              summary={currentVideo.summary}
              transcriptSource={currentVideo.transcriptSource}
              onSeek={(time) => {
                console.log('🎥 AnalyzePage: onSeek called with time:', time)
                console.log('🎥 AnalyzePage: playerRef available:', !!playerRef)
                
                const trySeek = (retryCount = 0) => {
                  if (playerRef) {
                    console.log('🎥 AnalyzePage: playerRef methods:', {
                      seekToWithAutoplay: !!playerRef.seekToWithAutoplay,
                      seekTo: !!playerRef.seekTo,
                      getPlayerState: !!playerRef.getPlayerState,
                      playVideo: !!playerRef.playVideo
                    })
                    
                    // Use the enhanced seekTo function with autoplay
                    if (playerRef.seekToWithAutoplay) {
                      console.log('🎥 Using seekToWithAutoplay')
                      playerRef.seekToWithAutoplay(time, true)
                    } else if (playerRef.seekTo) {
                      console.log('🎥 Using fallback seekTo method')
                      // Fallback to original method
                      playerRef.seekTo(time, true)
                      // Auto-play if not already playing
                      setTimeout(() => {
                        if (playerRef.getPlayerState && playerRef.getPlayerState() !== 1 && playerRef.playVideo) {
                          console.log('🎥 Auto-playing video after seek')
                          playerRef.playVideo()
                        }
                      }, 100)
                    } else {
                      console.error('🚨 No seek method available on playerRef!')
                    }
                  } else if (retryCount < 5) {
                    console.log(`⏳ Player not ready yet, retrying... (${retryCount + 1}/5)`)
                    setTimeout(() => trySeek(retryCount + 1), 500)
                  } else {
                    console.error('🚨 playerRef is not available after 5 retries!')
                    alert('動画プレーヤーの準備ができていません。ページを再読み込みしてください。')
                  }
                }
                
                trySeek()
              }}
              onQuestionClick={handleQuestionClick}
              onArticleGenerated={handleArticleGenerated}
            />
          </div>
          
          {/* Bottom Tier: Full-Width Chat and Q&A */}
          <div className="w-full">
            <div className="card-modern">
              {(() => {
                // 🔍 DEBUG: Log what we're passing to ChatInterface
                console.log('🎯 AnalyzePage passing to ChatInterface:')
                console.log('  - videoId:', currentVideo.basic?.videoId)
                console.log('  - transcript:', currentVideo.transcript ? {
                  type: typeof currentVideo.transcript,
                  length: typeof currentVideo.transcript === 'string' ? currentVideo.transcript.length : 'NOT_STRING',
                  preview: typeof currentVideo.transcript === 'string' ? currentVideo.transcript.substring(0, 100) + '...' : JSON.stringify(currentVideo.transcript).substring(0, 100) + '...'
                } : 'MISSING')
                console.log('  - summary:', currentVideo.summary ? {
                  type: typeof currentVideo.summary,
                  length: typeof currentVideo.summary === 'string' ? currentVideo.summary.length : 'NOT_STRING',
                  preview: typeof currentVideo.summary === 'string' ? currentVideo.summary.substring(0, 100) + '...' : JSON.stringify(currentVideo.summary).substring(0, 100) + '...'
                } : 'MISSING')
                
                return <ChatInterface 
                  videoId={currentVideo.basic?.videoId} 
                  prefillQuestion={prefillQuestion}
                  videoTitle={currentVideo.basic?.title}
                  transcript={currentVideo.transcript}
                  summary={currentVideo.summary}
                  gptModel={currentVideo.gptModel}
                />
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!currentVideo && !loading && (
        <div className="text-center py-12">
          <div className="empty-state card-modern p-12 max-w-md mx-auto">
            <div className="text-6xl mb-4 opacity-60">🎬</div>
            <h3 className="text-heading mb-2">Ready to Analyze</h3>
            <p className="text-body opacity-75">
              Paste a YouTube URL above to get started with AI-powered video analysis.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnalyzePage