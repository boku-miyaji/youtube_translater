import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import TranscriptViewer from '../shared/TranscriptViewer'
import ChatInterface from '../shared/ChatInterface'
import VideoFileUpload from '../shared/VideoFileUpload'
import { VideoFile } from '../../types'
const AnalyzePage: React.FC = () => {
  const { currentVideo, setCurrentVideo, loading, setLoading } = useAppStore()
  const location = useLocation()
  const [inputType, setInputType] = useState<'url' | 'file'>('url')
  const [url, setUrl] = useState('')
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null)
  const [language, setLanguage] = useState('original')
  const [model, setModel] = useState('gpt-4o-mini')
  const [urlError, setUrlError] = useState('')
  const [fileError, setFileError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [playerRef, setPlayerRef] = useState<any>(null)
  const [prefillQuestion, setPrefillQuestion] = useState<string>('')
  const [videoPreview, setVideoPreview] = useState<{title: string, thumbnail: string} | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [formCollapsed, setFormCollapsed] = useState(false)
  const [showCostInfo, setShowCostInfo] = useState(true)
  const [costEstimation, setCostEstimation] = useState<any>(null)
  const [loadingCostEstimation, setLoadingCostEstimation] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const costEstimationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isFirstModelChange = useRef(true)

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
    console.log('🔄 handleUrlChange called with value:', value)
    setUrl(value)
    setUrlError('')
    setVideoPreview(null)
    setCostEstimation(null)
    setLoadingCostEstimation(false)
    
    // Clear previous timeout
    if (costEstimationTimeoutRef.current) {
      console.log('🔄 Clearing previous cost estimation timeout')
      clearTimeout(costEstimationTimeoutRef.current)
      costEstimationTimeoutRef.current = null
    }
    
    if (value.trim()) {
      if (validateYouTubeUrl(value.trim())) {
        console.log('✅ Valid YouTube URL detected, generating preview')
        // Generate instant preview for valid URLs
        generateVideoPreview(value.trim())
        
        // Estimate cost for valid URLs with a delay using ref for cleanup
        console.log('⏰ Setting timeout for cost estimation in 1000ms')
        costEstimationTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Starting cost estimation for URL:', value.trim())
          estimateCostForUrl(value.trim())
        }, 1000) // Reduced delay to 1 second for faster response
      } else {
        console.log('❌ Invalid YouTube URL')
        setUrlError('Please enter a valid YouTube URL')
      }
    }
  }

  // Handle paste event for instant preview
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text')
    console.log('📋 Paste event detected with text:', pastedText)
    if (pastedText && validateYouTubeUrl(pastedText)) {
      console.log('✅ Valid pasted URL, will trigger preview and cost estimation')
      setTimeout(() => {
        generateVideoPreview(pastedText)
        // Also estimate cost for pasted URLs
        setTimeout(() => {
          console.log('🔄 Starting cost estimation for pasted URL:', pastedText)
          estimateCostForUrl(pastedText)
        }, 1000) // Consistent 1 second delay
      }, 100)
    }
  }

  // Estimate cost for YouTube URL
  const estimateCostForUrl = async (url: string) => {
    console.log('💰 estimateCostForUrl called with:', url)
    
    if (!validateYouTubeUrl(url.trim())) {
      console.log('❌ Invalid YouTube URL, skipping cost estimation')
      return
    }
    
    console.log('✅ Valid YouTube URL, starting cost estimation...')
    setLoadingCostEstimation(true)
    setCostEstimation(null)
    
    try {
      console.log('📡 Making API call to /api/estimate-cost-url')
      const response = await fetch('/api/estimate-cost-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          gptModel: model,
          generateSummary: true,
          generateArticle: false
        }),
      })
      
      console.log('📡 API response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('💰 Cost estimation result:', data)
        setCostEstimation(data)
      } else {
        let errorDetails = ''
        try {
          const errorData = await response.json()
          errorDetails = JSON.stringify(errorData, null, 2)
          console.error('❌ Failed to estimate cost (JSON):', response.status, errorData)
        } catch {
          const errorText = await response.text()
          errorDetails = errorText
          console.error('❌ Failed to estimate cost (Text):', response.status, errorText)
        }
        // Set error state with details for debugging
        setCostEstimation({
          success: false,
          error: `API Error ${response.status}: ${errorDetails}`,
          debug: true
        })
      }
    } catch (error) {
      console.error('❌ Error estimating cost:', error)
    } finally {
      setLoadingCostEstimation(false)
      console.log('✅ Cost estimation completed')
    }
  }

  // Estimate cost for video file
  const estimateCostForFile = async (file: VideoFile) => {
    setLoadingCostEstimation(true)
    setCostEstimation(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file.file)
      formData.append('gptModel', model)
      formData.append('generateSummary', 'true')
      formData.append('generateArticle', 'false')
      
      const response = await fetch('/api/estimate-cost-file', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        const data = await response.json()
        setCostEstimation(data)
      } else {
        console.error('Failed to estimate cost for file')
      }
    } catch (error) {
      console.error('Error estimating cost for file:', error)
    } finally {
      setLoadingCostEstimation(false)
    }
  }

  // Handle video file selection
  const handleFileSelected = (file: VideoFile) => {
    setVideoFile(file)
    setFileError('')
    setUploadProgress(0)
    // Estimate cost for the selected file
    estimateCostForFile(file)
  }

  // Handle input type change
  const handleInputTypeChange = (type: 'url' | 'file') => {
    setInputType(type)
    // Clear previous selections and errors
    setUrl('')
    setVideoFile(null)
    setUrlError('')
    setFileError('')
    setVideoPreview(null)
    setUploadProgress(0)
    setCostEstimation(null)
    setLoadingCostEstimation(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate input based on type
    if (inputType === 'url') {
      if (!url.trim()) return
      if (!validateYouTubeUrl(url.trim())) {
        setUrlError('Please enter a valid YouTube URL')
        return
      }
    } else if (inputType === 'file') {
      if (!videoFile) {
        setFileError('Please select a video file')
        return
      }
    }

    setLoading(true)
    setUrlError('')
    setFileError('')
    setUploadProgress(0)
    // Expand form during analysis
    setFormCollapsed(false)
    
    try {
      let response: Response
      let data: any

      if (inputType === 'url') {
        // Handle YouTube URL processing
        console.log('Sending request to /api/upload-youtube with:', { url: url.trim(), language, model })
        response = await fetch('/api/upload-youtube', {
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
          console.error('YouTube video processing failed:', response.status, response.statusText, errorText)
          throw new Error(`Failed to process YouTube video: ${response.status} ${response.statusText}`)
        }

        data = await response.json()
      } else {
        // Handle file upload processing
        const formData = new FormData()
        formData.append('file', videoFile!.file)
        formData.append('language', language)
        formData.append('gptModel', model)
        formData.append('generateSummary', 'true')
        formData.append('generateArticle', 'false')

        console.log('Sending request to /api/upload-video-file with:', { 
          filename: videoFile!.name, 
          size: videoFile!.size,
          language, 
          model 
        })

        response = await fetch('/api/upload-video-file', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Video file processing failed:', response.status, response.statusText, errorText)
          throw new Error(`Failed to process video file: ${response.status} ${response.statusText}`)
        }

        data = await response.json()
      }
      
      console.log('🕒 AnalyzePage: Server response analysis time:', data.analysisTime)
      console.log('🕒 AnalyzePage: Metadata analysis time:', data.metadata?.analysisTime)
      
      // Convert server response to VideoMetadata format
      const videoMetadata = {
        basic: {
          title: data.title,
          videoId: inputType === 'url' ? data.metadata?.basic?.videoId : undefined,
          duration: data.metadata?.basic?.duration || 0,
          channel: data.metadata?.basic?.channel,
          viewCount: data.metadata?.basic?.viewCount,
          likes: data.metadata?.basic?.likes,
          uploadDate: data.metadata?.basic?.uploadDate,
          publishDate: data.metadata?.basic?.publishDate,
          category: data.metadata?.basic?.category,
          description: data.metadata?.basic?.description,
          videoPath: inputType === 'file' ? data.metadata?.basic?.videoPath : undefined
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
        analysisTime: data.analysisTime,
        // Add file-specific metadata
        source: inputType,
        fileId: data.fileId,
        originalFilename: data.originalName,
        fileSize: data.size,
        uploadedAt: data.uploadedAt
      }
      
      console.log('🕒 AnalyzePage: Final videoMetadata analysis time:', videoMetadata.analysisTime)
      
      setCurrentVideo(videoMetadata)
      // Auto-collapse form after successful analysis
      setFormCollapsed(true)
    } catch (error) {
      console.error('Error processing video:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (inputType === 'file') {
        setFileError(`Failed to process video file: ${errorMessage}`)
      } else {
        alert(`Failed to process video: ${errorMessage}`)
      }
    } finally {
      setLoading(false)
      setUploadProgress(0)
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

  // Render cost estimation display
  const renderCostEstimation = () => {
    console.log('🎨 renderCostEstimation called - loadingCostEstimation:', loadingCostEstimation, 'costEstimation:', costEstimation)
    
    if (loadingCostEstimation) {
      console.log('🎨 Rendering loading state')
      return (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-2 text-blue-800">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">想定コストを計算中...</span>
          </div>
        </div>
      )
    }

    if (costEstimation && costEstimation.success) {
      console.log('🎨 Rendering cost estimation result')
      const costs = costEstimation.estimatedCosts
      return (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200">
          <div className="flex items-start gap-2">
            <span className="text-green-600 text-lg">💰</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-green-800 mb-1">
                想定コスト（概算）
              </div>
              <div className="text-xs text-green-700 space-y-1">
                <div className="flex justify-between">
                  <span>動画時間:</span>
                  <span className="font-mono">{costEstimation.durationFormatted}</span>
                </div>
                <div className="flex justify-between">
                  <span>使用モデル:</span>
                  <span className="font-mono">{costEstimation.gptModel || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>文字起こし:</span>
                  <span className="font-mono">${costs.transcription.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span>要約生成:</span>
                  <span className="font-mono">${costs.summary.toFixed(4)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-green-300 pt-1">
                  <span>合計:</span>
                  <span className="font-mono">${costs.total.toFixed(4)}</span>
                </div>
              </div>
              <div className="text-xs text-green-600 mt-1">
                ※実際のコストは使用するモデルやトークン数により変動します
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (costEstimation && costEstimation.debug) {
      console.log('🎨 Rendering cost estimation error')
      return (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-start gap-2">
            <span className="text-red-600 text-lg">⚠️</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-red-800 mb-1">
                コスト予測エラー
              </div>
              <div className="text-xs text-red-700">
                {costEstimation.error}
              </div>
              <div className="text-xs text-red-600 mt-1">
                詳細はコンソールログを確認してください
              </div>
            </div>
          </div>
        </div>
      )
    }

    console.log('🎨 No cost estimation to render - returning null')
    return null
  }


  // Debug cost estimation state changes
  useEffect(() => {
    console.log('💰 Cost estimation state changed:', {
      loadingCostEstimation,
      costEstimation: costEstimation ? {
        success: costEstimation.success,
        title: costEstimation.title,
        duration: costEstimation.duration,
        hasEstimatedCosts: !!costEstimation.estimatedCosts
      } : null
    })
  }, [costEstimation, loadingCostEstimation])

  // Auto re-calculate cost estimation when model changes
  useEffect(() => {
    console.log('🔄 Model changed to:', model)
    
    // Skip the first render to avoid initial calculation
    if (isFirstModelChange.current) {
      isFirstModelChange.current = false
      console.log('🔄 Skipping initial model change')
      return
    }
    
    // Only re-calculate if we have existing cost estimation
    if (costEstimation && costEstimation.success && !loadingCostEstimation) {
      console.log('🔄 Re-calculating cost estimation due to model change')
      
      if (inputType === 'url' && url.trim() && validateYouTubeUrl(url.trim())) {
        // Re-estimate for URL
        estimateCostForUrl(url.trim())
      } else if (inputType === 'file' && videoFile) {
        // Re-estimate for file
        estimateCostForFile(videoFile)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]) // Only depend on model changes to avoid infinite loops

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
          Transform YouTube videos and local video files into insights with AI-powered transcription, summaries, and interactive chat.
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
                      autoComplete="off"
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

                {/* Cost Estimation Display in Collapsed State */}
                {inputType === 'url' && renderCostEstimation()}

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

                {/* Input Type Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-app-primary mb-3">
                      📥 Input Type
                    </label>
                    <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => handleInputTypeChange('url')}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                          inputType === 'url'
                            ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          🔗 YouTube URL
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInputTypeChange('file')}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                          inputType === 'file'
                            ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          📁 Video File
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Conditional Input Section */}
                {inputType === 'url' ? (
                  /* URL Input with Preview */
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
                        autoComplete="off"
                        data-testid="url-input"
                        required={inputType === 'url'}
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

                    {/* Cost Estimation Display for URL */}
                    {renderCostEstimation()}
                  </div>
                ) : (
                  /* Video File Upload */
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-app-primary mb-2">
                      <span className="flex items-center gap-2">
                        📁 Video File Upload
                      </span>
                    </label>
                    <VideoFileUpload
                      onFileSelected={handleFileSelected}
                      maxSize={500 * 1024 * 1024} // 500MB
                      acceptedFormats={['video/mp4', 'video/quicktime']}
                      isUploading={loading}
                      uploadProgress={uploadProgress}
                      error={fileError}
                    />

                    {/* Cost Estimation Display for File */}
                    {renderCostEstimation()}
                  </div>
                )}

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
                      <option value="gpt-4o-mini">GPT-4o Mini (Fast) - $0.60/$2.40/1M</option>
                      <option value="gpt-4o">GPT-4o (Balanced) - $5.00/$15.00/1M</option>
                      <option value="gpt-4">GPT-4 (Premium) - $10.00/$30.00/1M</option>
                      <option value="gpt-4.1-nano">GPT-4.1 Nano (Ultra Fast) - $0.10/$0.40/1M</option>
                      <option value="gpt-4.1-mini">GPT-4.1 Mini (Fast) - $0.40/$1.60/1M</option>
                      <option value="gpt-4.1">GPT-4.1 (Advanced) - $2.00/$8.00/1M</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                    <button
                      type="submit"
                      disabled={
                        loading || 
                        (inputType === 'url' && (!url.trim() || !!urlError)) ||
                        (inputType === 'file' && (!videoFile || !!fileError))
                      }
                      className="btn-modern btn-success w-full h-10 text-white font-semibold shadow-elevation-hover"
                      data-testid="analyze-button"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span className="text-tabular">
                            {inputType === 'file' ? 'Processing...' : 'Analyzing...'}
                          </span>
                        </div>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          ⚡ {inputType === 'file' ? 'Process Video' : 'Analyze Video'}
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