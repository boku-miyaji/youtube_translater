import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import VideoPlayer from '../shared/VideoPlayer'
import TranscriptViewer from '../shared/TranscriptViewer'
import ChatInterface from '../shared/ChatInterface'

const UploadPage: React.FC = () => {
  const { currentVideo, setCurrentVideo, loading, setLoading } = useAppStore()
  const location = useLocation()
  const [url, setUrl] = useState('')
  const [language, setLanguage] = useState('original')
  const [model, setModel] = useState('gpt-4.1-mini')
  const [urlError, setUrlError] = useState('')
  const [playerRef, setPlayerRef] = useState<any>(null)
  const [prefillQuestion, setPrefillQuestion] = useState<string>('')

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

  const handleUrlChange = (value: string) => {
    setUrl(value)
    setUrlError('')
    
    if (value.trim() && !validateYouTubeUrl(value.trim())) {
      setUrlError('Please enter a valid YouTube URL')
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
        timestampedSegments: data.timestampedSegments || []
      }
      
      setCurrentVideo(videoMetadata)
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Video</h1>
        <p className="mt-2 text-gray-600">Process YouTube videos for transcription and analysis.</p>
      </div>

      {/* Upload Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700">
              YouTube URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className={`mt-1 block w-full rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 ${
                urlError ? 'border-red-300' : 'border-gray-300'
              }`}
              data-testid="url-input"
              required
            />
            {urlError && (
              <p className="mt-2 text-sm text-red-600" data-testid="url-error">
                {urlError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700">
                Language
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
              >
                <option value="Original">Original</option>
                <option value="Japanese">Japanese</option>
                <option value="English">English</option>
              </select>
            </div>

            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700">
                Model
              </label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
              >
                <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !url.trim() || !!urlError}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="analyze-button"
          >
            {loading ? (
              <>
                <div className="loading mr-2" />
                Processing...
              </>
            ) : (
              'Process Video'
            )}
          </button>
        </form>
      </div>

      {/* Video Content */}
      {currentVideo && (
        <div className="space-y-6">
          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Player - Left Side */}
            <div className="lg:col-span-1">
              <VideoPlayer 
                video={currentVideo} 
                onPlayerReady={(player) => setPlayerRef(player)}
              />
            </div>
            
            {/* Transcript Viewer - Right Side (Takes 2 columns) */}
            <div className="lg:col-span-2">
              <TranscriptViewer 
                transcript={currentVideo.transcript}
                timestampedSegments={currentVideo.timestampedSegments}
                summary={currentVideo.summary}
                onSeek={(time) => {
                  console.log('🎥 UploadPage: onSeek called with time:', time)
                  console.log('🎥 UploadPage: playerRef available:', !!playerRef)
                  
                  const trySeek = (retryCount = 0) => {
                    if (playerRef) {
                      console.log('🎥 UploadPage: playerRef methods:', {
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
              />
            </div>
          </div>
          
          {/* Chat Interface - Bottom */}
          <div className="w-full">
            <ChatInterface 
              videoId={currentVideo.basic?.videoId} 
              prefillQuestion={prefillQuestion}
              videoTitle={currentVideo.basic?.title}
              transcript={currentVideo.transcript}
              summary={currentVideo.summary}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default UploadPage