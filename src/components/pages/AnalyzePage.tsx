import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import TranscriptViewer from '../shared/TranscriptViewer'
import PDFViewer, { PDFViewerRef } from '../shared/PDFViewer'
import ChatInterface from '../shared/ChatInterface'
import VideoFileUpload from '../shared/VideoFileUpload'
import AnalysisProgress from '../shared/AnalysisProgress'
import { VideoFile, AudioFile, PDFFile, InputType } from '../../types'
import { formatProcessingTime } from '../../utils/formatTime'
import { ProcessingTimePredictor, PredictionInput, PredictionResult, createTimePredictor } from '../../utils/timePredictor'
import { detectInputTypeFromUrl, detectInputTypeFromUrlWithConfidence, detectInputTypeFromFile, DetectionResult } from '../../utils/inputTypeDetection'
const AnalyzePage: React.FC = () => {
  const { currentVideo, setCurrentVideo, loading, setLoading } = useAppStore()
  const location = useLocation()
  const [inputMode, setInputMode] = useState<'url' | 'file'>('url')
  const [inputType, setInputType] = useState<InputType>(InputType.YOUTUBE_URL)
  const [isManualInputTypeSelection, setIsManualInputTypeSelection] = useState(false)
  const [detectedType, setDetectedType] = useState<DetectionResult | null>(null)
  const [url, setUrl] = useState('')
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null)
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null)
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null)
  const [language, setLanguage] = useState('original')
  const [model, setModel] = useState('gpt-4o-mini')
  const [transcriptionModel, setTranscriptionModel] = useState<'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe' | 'whisper-1'>('gpt-4o-transcribe')
  const [urlError, setUrlError] = useState('')
  const [fileError, setFileError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [playerRef, setPlayerRef] = useState<any>(null)
  const pdfViewerRef = useRef<PDFViewerRef>(null)
  const [prefillQuestion, setPrefillQuestion] = useState<string>('')
  const [videoPreview, setVideoPreview] = useState<{title: string, thumbnail: string} | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [formCollapsed, setFormCollapsed] = useState(false)
  const [showCostInfo, setShowCostInfo] = useState(true)
  const [costEstimation, setCostEstimation] = useState<any>(null)
  const [loadingCostEstimation, setLoadingCostEstimation] = useState(false)
  const [estimatedProcessingTime, setEstimatedProcessingTime] = useState<any>(null)
  const [historicalData, setHistoricalData] = useState<any[]>([])
  const [timePredictor, setTimePredictor] = useState<ProcessingTimePredictor | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const costEstimationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isFirstModelChange = useRef(true)
  const [showEstimationRationale, setShowEstimationRationale] = useState(false)

  useEffect(() => {
    if (location.state?.url) {
      setUrl(location.state.url)
      setInputType(InputType.YOUTUBE_URL)
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
    } else if (location.state?.videoFile && location.state?.inputType === 'file') {
      // Handle file passed from Dashboard
      setInputType(InputType.VIDEO_FILE)
      setVideoFile(location.state.videoFile)
    }
  }, [location.state])

  // Load historical data for time prediction on component mount
  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        const response = await fetch('/api/history')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.history) {
            console.log('📊 Loaded historical data for time prediction:', data.history.length, 'entries')
            setHistoricalData(data.history)
            
            // Initialize time predictor
            const predictor = createTimePredictor(data.history)
            setTimePredictor(predictor)
            
            // Log statistics for debugging
            const statsSummary = predictor.getStatsSummary()
            console.log('🎯 Time prediction stats:', statsSummary)
          }
        } else {
          console.warn('Failed to load historical data for time prediction')
        }
      } catch (error) {
        console.error('Error loading historical data:', error)
      }
    }

    loadHistoricalData()
  }, [])

  // Auto-update time prediction when input changes
  useEffect(() => {
    if (!timePredictor) return

    const updateTimePrediction = () => {
      let shouldPredict = false
      let inputValue = ''

      // Check if we have valid inputs for prediction
      if (inputType === InputType.YOUTUBE_URL && url.trim() && validateYouTubeUrl(url.trim())) {
        shouldPredict = true
        inputValue = url.trim()
      } else if (inputType === InputType.PDF_URL && url.trim() && validatePDFUrl(url.trim())) {
        shouldPredict = true
        inputValue = url.trim()
      } else if (inputType === InputType.VIDEO_FILE && videoFile) {
        shouldPredict = true
        inputValue = 'video-file'
      } else if (inputType === InputType.AUDIO_FILE && audioFile) {
        shouldPredict = true
        inputValue = 'audio-file'
      }

      if (shouldPredict) {
        const prediction = generateImprovedTimePrediction(inputType, inputValue, language, transcriptionModel, model)
        if (prediction && prediction.confidence > 0.2) {
          const updatedProcessingTime = {
            transcription: prediction.transcription,
            summary: prediction.summary,
            total: prediction.total,
            formatted: prediction.formatted,
            confidence: prediction.confidence,
            basedOn: prediction.basedOn,
            sampleSize: prediction.sampleSize,
            transcriptionRate: prediction.transcriptionRate,
            summaryRate: prediction.summaryRate
          }
          setEstimatedProcessingTime(updatedProcessingTime)
          console.log('🔄 Auto-updated time prediction:', {
            inputType,
            confidence: prediction.confidence,
            basedOn: prediction.basedOn
          })
        }
      }
    }

    // Debounce the update to avoid too many calls
    const timeoutId = setTimeout(updateTimePrediction, 500)
    return () => clearTimeout(timeoutId)
  }, [inputType, url, language, transcriptionModel, model, videoFile, audioFile, timePredictor])

  // Generate improved time prediction using historical data
  const generateImprovedTimePrediction = (inputType: InputType, url: string, language: string, transcriptionModel: string, model: string): PredictionResult | null => {
    if (!timePredictor) {
      console.warn('Time predictor not initialized yet')
      return null
    }

    try {
      let predictionInput: PredictionInput

      if (inputType === InputType.YOUTUBE_URL) {
        // IMPORTANT: For YouTube URLs entered by user, we don't have the actual duration yet
        // We use a conservative estimate that will be replaced with accurate time once analysis starts
        // The backend will fetch real duration using ytdl.getInfo()
        const estimatedDuration = 600 // Conservative: assume 10 minutes (was 5, increased for safety)
        console.warn(`⚠️ YouTube URL: Using estimated duration of ${estimatedDuration}s. Actual duration will be fetched by backend.`);
        predictionInput = {
          contentType: 'youtube',
          duration: estimatedDuration,
          transcriptionModel,
          gptModel: model,
          language
        }
      } else if (inputType === InputType.PDF_URL) {
        // For PDF, use realistic page-based estimation
        const estimatedPageCount = 10 // Default page count for academic paper
        const avgCharsPerPage = 4000 // Average characters per page
        const estimatedCharacterCount = estimatedPageCount * avgCharsPerPage
        predictionInput = {
          contentType: 'pdf',
          characterCount: estimatedCharacterCount,
          pageCount: estimatedPageCount,
          transcriptionModel: 'extraction', // PDF doesn't need transcription model
          gptModel: model,
          language
        }
      } else if (inputType === InputType.AUDIO_FILE && audioFile) {
        predictionInput = {
          contentType: 'audio',
          duration: audioFile.duration || 300, // Use actual duration if available
          transcriptionModel,
          gptModel: model,
          language
        }
      } else if (inputType === InputType.VIDEO_FILE && videoFile) {
        predictionInput = {
          contentType: 'video',
          duration: videoFile.duration || 300, // Use actual duration if available
          transcriptionModel,
          gptModel: model,
          language
        }
      } else {
        console.warn('Unsupported input type for time prediction:', inputType)
        return null
      }

      const prediction = timePredictor.predictProcessingTime(predictionInput)
      
      console.log('🎯 Generated improved time prediction:', {
        inputType,
        prediction,
        confidence: prediction.confidence,
        basedOn: prediction.basedOn,
        sampleSize: prediction.sampleSize
      })

      return prediction
    } catch (error) {
      console.error('Error generating time prediction:', error)
      return null
    }
  }

  // YouTube URL validation function
  const validateYouTubeUrl = (url: string): boolean => {
    const patterns = [
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/
    ]
    return patterns.some(pattern => pattern.test(url))
  }

  // PDF URL validation function
  const validatePDFUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url)
      // Check if HTTPS
      if (parsed.protocol !== 'https:') return false
      
      // Check if URL ends with .pdf or common academic domains
      const isPDFExtension = parsed.pathname.toLowerCase().endsWith('.pdf')
      const isAcademicDomain = /arxiv\.org|\.edu|doi\.org/.test(parsed.hostname)
      
      return isPDFExtension || isAcademicDomain
    } catch {
      return false
    }
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
      // Auto-detect input type with confidence
      const detection = detectInputTypeFromUrlWithConfidence(value.trim())
      setDetectedType(detection)

      // Auto-update input type if not manually selected
      if (!isManualInputTypeSelection) {
        if (detection.type !== inputType) {
          console.log(`🔍 Auto-detected input type: ${detection.type} (${detection.displayName}, confidence: ${detection.confidence})`)
          setInputType(detection.type)
        }
      }
      
      // Handle based on current input type
      if (inputType === InputType.YOUTUBE_URL && validateYouTubeUrl(value.trim())) {
        console.log('✅ Valid YouTube URL detected, generating preview')
        // Generate instant preview for valid URLs
        generateVideoPreview(value.trim())
        
        // Estimate cost for valid URLs with a delay using ref for cleanup
        console.log('⏰ Setting timeout for cost estimation in 200ms')
        costEstimationTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Starting cost estimation for URL:', value.trim())
          estimateCostForUrl(value.trim())
        }, 200) // Reduced delay to 200ms for faster response
      } else if (inputType === InputType.PDF_URL && validatePDFUrl(value.trim())) {
        console.log('✅ Valid PDF URL detected')
        // Could add PDF preview logic here if needed
      } else if (inputType === InputType.YOUTUBE_URL) {
        console.log('❌ Invalid YouTube URL')
        setUrlError('Please enter a valid YouTube URL')
      } else if (inputType === InputType.PDF_URL) {
        console.log('❌ Invalid PDF URL')
        setUrlError('Please enter a valid PDF URL')
      }
    } else {
      // Reset to default when input is cleared
      setIsManualInputTypeSelection(false)
      setInputType(InputType.YOUTUBE_URL)
    }
  }

  // Handle paste event for instant preview
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text')
    console.log('📋 Paste event detected with text:', pastedText)
    
    // Auto-detect input type on paste if not manually selected
    if (!isManualInputTypeSelection && pastedText) {
      const detectedType = detectInputTypeFromUrl(pastedText)
      if (detectedType !== inputType) {
        console.log(`🔍 Auto-detected input type on paste: ${detectedType}`)
        setInputType(detectedType)
      }
    }
    
    if (pastedText && inputType === InputType.YOUTUBE_URL && validateYouTubeUrl(pastedText)) {
      console.log('✅ Valid pasted YouTube URL, will trigger preview and cost estimation')
      setTimeout(() => {
        generateVideoPreview(pastedText)
        // Also estimate cost for pasted URLs
        setTimeout(() => {
          console.log('🔄 Starting cost estimation for pasted URL:', pastedText)
          estimateCostForUrl(pastedText)
        }, 200) // Consistent 200ms delay
      }, 100)
    } else if (pastedText && inputType === InputType.PDF_URL && validatePDFUrl(pastedText)) {
      console.log('✅ Valid pasted PDF URL')
      // Could add PDF preview logic here if needed
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
          transcriptionModel: transcriptionModel,
          generateSummary: true,
          generateArticle: false
        }),
      })
      
      console.log('📡 API response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('💰 Cost estimation result:', data)
        setCostEstimation(data)
        if (data.estimatedProcessingTime) {
          console.log('💡 Setting estimatedProcessingTime:', data.estimatedProcessingTime)
          setEstimatedProcessingTime(data.estimatedProcessingTime)
        } else {
          console.log('⚠️ No estimatedProcessingTime in response')
        }
      } else {
        let errorDetails = ''
        try {
          const errorData = await response.clone().json()
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
      formData.append('transcriptionModel', transcriptionModel)
      formData.append('generateSummary', 'true')
      formData.append('generateArticle', 'false')
      
      const response = await fetch('/api/estimate-cost-file', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        const data = await response.json()
        setCostEstimation(data)
        if (data.estimatedProcessingTime) {
          console.log('💡 Setting estimatedProcessingTime:', data.estimatedProcessingTime)
          setEstimatedProcessingTime(data.estimatedProcessingTime)
        } else {
          console.log('⚠️ No estimatedProcessingTime in response')
        }
      } else {
        console.error('Failed to estimate cost for file')
      }
    } catch (error) {
      console.error('Error estimating cost for file:', error)
    } finally {
      setLoadingCostEstimation(false)
    }
  }

  // Handle file selection based on input type
  const handleFileSelected = (file: VideoFile) => {
    // Auto-detect file type from MIME type
    const detectedFileType = detectInputTypeFromFile(file.file)

    console.log(`🔍 Auto-detected file type: ${detectedFileType} for file: ${file.name} (MIME: ${file.type})`)

    // Update inputType if in file mode and not manually selected
    if (inputMode === 'file' && !isManualInputTypeSelection) {
      setInputType(detectedFileType)
    }

    // Determine file type and set appropriate state based on detected type
    if (detectedFileType === InputType.VIDEO_FILE) {
      setVideoFile(file)
      setAudioFile(null)
      setPdfFile(null)
    } else if (detectedFileType === InputType.AUDIO_FILE) {
      // Convert VideoFile to AudioFile
      const audioFile: AudioFile = {
        file: file.file,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        format: file.type.split('/')[1] // e.g., 'audio/mp3' -> 'mp3'
      }
      setAudioFile(audioFile)
      setVideoFile(null)
      setPdfFile(null)
    } else if (detectedFileType === InputType.PDF_FILE) {
      // Convert VideoFile to PDFFile
      const pdfFile: PDFFile = {
        file: file.file,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      }
      setPdfFile(pdfFile)
      setVideoFile(null)
      setAudioFile(null)
    }

    setFileError('')
    setUploadProgress(0)
    // Estimate cost for the selected file
    estimateCostForFile(file)
  }

  // Handle input mode change (URL vs File)
  const handleInputModeChange = (mode: 'url' | 'file') => {
    setInputMode(mode)
    // Clear previous selections and errors
    setUrl('')
    setVideoFile(null)
    setAudioFile(null)
    setPdfFile(null)
    setUrlError('')
    setFileError('')
    setVideoPreview(null)
    setUploadProgress(0)
    setCostEstimation(null)
    setLoadingCostEstimation(false)
    setEstimatedProcessingTime(null)
    setDetectedType(null)
    setIsManualInputTypeSelection(false)

    // Set default input type based on mode
    if (mode === 'url') {
      setInputType(InputType.YOUTUBE_URL)
    } else {
      setInputType(InputType.VIDEO_FILE)
    }
  }

  // Handle input type change
  const handleInputTypeChange = (type: InputType) => {
    setInputType(type)
    setIsManualInputTypeSelection(true) // Mark as manual selection
    // Clear previous selections and errors
    setUrl('')
    setVideoFile(null)
    setAudioFile(null)
    setPdfFile(null)
    setUrlError('')
    setFileError('')
    setVideoPreview(null)
    setUploadProgress(0)
    setCostEstimation(null)
    setLoadingCostEstimation(false)
    setEstimatedProcessingTime(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate input based on type
    if (inputType === InputType.YOUTUBE_URL) {
      if (!url.trim()) return
      if (!validateYouTubeUrl(url.trim())) {
        setUrlError('Please enter a valid YouTube URL')
        return
      }
    } else if (inputType === InputType.VIDEO_FILE) {
      if (!videoFile) {
        setFileError('Please select a video file')
        return
      }
    } else if (inputType === InputType.AUDIO_FILE) {
      if (!audioFile) {
        setFileError('Please select an audio file')
        return
      }
    } else if (inputType === InputType.PDF_URL) {
      if (!url.trim()) return
      if (!validatePDFUrl(url.trim())) {
        setUrlError('Please enter a valid PDF URL')
        return
      }
    } else if (inputType === InputType.PDF_FILE) {
      if (!pdfFile) {
        setFileError('Please select a PDF file')
        return
      }
    }

    // Get estimated processing time - try improved prediction first
    let processingTime = estimatedProcessingTime || costEstimation?.estimatedProcessingTime
    
    // Generate improved prediction using historical data
    const improvedPrediction = generateImprovedTimePrediction(inputType, url.trim(), language, transcriptionModel, model)
    
    if (improvedPrediction && improvedPrediction.confidence > 0.3) {
      // Use improved prediction if confidence is reasonable
      processingTime = {
        transcription: improvedPrediction.transcription,
        summary: improvedPrediction.summary,
        total: improvedPrediction.total,
        formatted: improvedPrediction.formatted,
        confidence: improvedPrediction.confidence,
        basedOn: improvedPrediction.basedOn,
        sampleSize: improvedPrediction.sampleSize,
        transcriptionRate: improvedPrediction.transcriptionRate,
        summaryRate: improvedPrediction.summaryRate
      }
      setEstimatedProcessingTime(processingTime)
      console.log('🎯 Using improved time prediction:', {
        confidence: improvedPrediction.confidence,
        basedOn: improvedPrediction.basedOn,
        sampleSize: improvedPrediction.sampleSize,
        prediction: processingTime
      })
    } else if (!processingTime) {
      // Fall back to defaults only if no other prediction is available
      console.log('⚠️ No processing time available, setting default fallback')
      const defaultTime = {
        transcription: 30, // 30 seconds for transcription
        summary: 60,       // 60 seconds for summary
        total: 90,         // 90 seconds total
        formatted: '1 min 30 sec',
        confidence: 0.1,
        basedOn: 'global_default' as const,
        sampleSize: 0
      }
      processingTime = defaultTime
      setEstimatedProcessingTime(defaultTime)
      console.log('📉 Using default fallback prediction')
    }
    
    // Debug log for estimated processing time
    console.log('🚀 Starting analysis with processing time:', {
      estimatedProcessingTime,
      costEstimationTime: costEstimation?.estimatedProcessingTime,
      finalProcessingTime: processingTime
    })
    
    // If we have cost estimation with processing time, ensure it's set
    if (costEstimation?.estimatedProcessingTime && !estimatedProcessingTime) {
      console.log('📋 Setting processing time from cost estimation')
      setEstimatedProcessingTime(costEstimation.estimatedProcessingTime)
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

      if (inputType === InputType.YOUTUBE_URL) {
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
            transcriptionModel,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('YouTube video processing failed:', response.status, response.statusText, errorText)
          throw new Error(`Failed to process YouTube video: ${response.status} ${response.statusText}`)
        }

        data = await response.json()
      } else if (inputType === InputType.VIDEO_FILE) {
        // Handle video file upload processing
        const formData = new FormData()
        formData.append('file', videoFile!.file)
        formData.append('language', language)
        formData.append('gptModel', model)
        formData.append('transcriptionModel', transcriptionModel)
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
      } else if (inputType === InputType.AUDIO_FILE) {
        // Handle audio file upload processing
        const formData = new FormData()
        formData.append('file', audioFile!.file)
        formData.append('language', language)
        formData.append('gptModel', model)
        formData.append('transcriptionModel', transcriptionModel)
        formData.append('generateSummary', 'true')

        console.log('Sending request to /api/upload-audio-file with:', { 
          filename: audioFile!.name, 
          size: audioFile!.size,
          language, 
          model 
        })
        
        response = await fetch('/api/upload-audio-file', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Audio file processing failed:', response.status, response.statusText, errorText)
          throw new Error(`Failed to process audio file: ${response.status} ${response.statusText}`)
        }

        data = await response.json()
      } else if (inputType === InputType.PDF_URL) {
        // Handle PDF URL processing with retry logic for network errors
        console.log('Sending request to /api/analyze-pdf with:', { url: url.trim(), language, model })
        
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
          try {
            response = await fetch('/api/analyze-pdf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: url.trim(),
                language,
                gptModel: model,
                generateSummary: true,
                extractStructure: true,
              }),
            })

            if (!response.ok) {
              const errorText = await response.text()
              console.error('PDF URL processing failed:', response.status, response.statusText, errorText)
              throw new Error(`Failed to process PDF URL: ${response.status} ${response.statusText}`)
            }

            data = await response.json()
            break; // Success, exit retry loop
            
          } catch (networkError: any) {
            console.error(`PDF processing attempt ${retryCount + 1} failed:`, networkError);
            
            // Check if it's a network error that might benefit from retry
            const errorMessage = networkError.message || networkError.toString();
            const isNetworkError = errorMessage.includes('ERR_CONTENT_LENGTH_MISMATCH') ||
                                   errorMessage.includes('ERR_NETWORK') ||
                                   errorMessage.includes('Failed to fetch') ||
                                   errorMessage.includes('network');
            
            if (isNetworkError && retryCount < maxRetries) {
              retryCount++;
              console.log(`Retrying PDF processing (attempt ${retryCount + 1}/${maxRetries + 1})...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Wait before retry
              continue;
            } else {
              // Either not a network error or exhausted retries
              throw networkError;
            }
          }
        }
      } else if (inputType === InputType.PDF_FILE) {
        // Handle PDF file upload processing
        const formData = new FormData()
        formData.append('file', pdfFile!.file)
        formData.append('language', language)
        formData.append('gptModel', model)
        formData.append('generateSummary', 'true')
        formData.append('extractStructure', 'true')

        console.log('Sending request to /api/analyze-pdf with:', { 
          filename: pdfFile!.name, 
          size: pdfFile!.size,
          language, 
          model 
        })

        response = await fetch('/api/analyze-pdf', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('PDF file processing failed:', response.status, response.statusText, errorText)
          throw new Error(`Failed to process PDF file: ${response.status} ${response.statusText}`)
        }

        data = await response.json()
      } else {
        throw new Error('Invalid input type')
      }
      
      console.log('🕒 AnalyzePage: Server response analysis time:', data.analysisTime)
      console.log('🕒 AnalyzePage: Metadata analysis time:', data.metadata?.analysisTime)
      
      // Detailed analysis time inspection
      if (data.analysisTime) {
        console.log('🔍 === SERVER ANALYSIS TIME INSPECTION ===');
        console.log('📊 data.analysisTime keys:', Object.keys(data.analysisTime));
        console.log('📅 data.analysisTime.startTime:', data.analysisTime.startTime);
        console.log('📅 data.analysisTime.endTime:', data.analysisTime.endTime);
        console.log('📅 data.analysisTime.duration:', data.analysisTime.duration);
        console.log('📅 data.analysisTime.extraction:', data.analysisTime.extraction);
        console.log('📅 data.analysisTime.total:', data.analysisTime.total);
        console.log('🔍 =========================================');
      } else {
        console.log('❌ data.analysisTime is missing or null');
      }
      
      // Convert server response to VideoMetadata format
      const videoMetadata = {
        basic: {
          title: data.title,
          // Only set videoId for YouTube videos, not for uploaded files
          videoId: (inputType === InputType.YOUTUBE_URL && data.metadata?.basic?.videoId) ? data.metadata.basic.videoId : undefined,
          duration: data.metadata?.basic?.duration || 0,
          channel: data.metadata?.basic?.channel,
          viewCount: data.metadata?.basic?.viewCount,
          likes: data.metadata?.basic?.likes,
          uploadDate: data.metadata?.basic?.uploadDate,
          publishDate: data.metadata?.basic?.publishDate,
          category: data.metadata?.basic?.category,
          description: data.metadata?.basic?.description,
          // Set videoPath for uploaded files
          videoPath: (inputType === InputType.VIDEO_FILE || data.source === 'file') ? (data.metadata?.basic?.videoPath || data.videoPath) : undefined,
          // Set audioPath for audio files
          audioPath: (inputType === InputType.AUDIO_FILE) ? (data.metadata?.basic?.audioPath || data.audioPath) : undefined,
          // Set pdfUrl for PDF files from URL input
          pdfUrl: (inputType === InputType.PDF_URL) ? url.trim() : undefined
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
        transcriptSource: (inputType === InputType.PDF_URL || inputType === InputType.PDF_FILE) ? 'pdf' : (data.method as 'subtitle' | 'whisper'),
        costs: data.costs || {
          transcription: 0,
          summary: 0,
          article: 0,
          total: 0
        },
        analysisTime: (() => {
          console.log('🔧 Setting analysisTime in videoMetadata');
          console.log('🔧 Source data.analysisTime:', data.analysisTime);
          
          // Ensure we have the required fields for PDF analysis
          if ((inputType === InputType.PDF_URL || inputType === InputType.PDF_FILE) && data.analysisTime) {
            const analysisTime = { ...data.analysisTime };

            // Ensure total is correctly calculated for PDFs
            if (!analysisTime.total && analysisTime.extraction !== undefined && analysisTime.summary !== undefined) {
              analysisTime.total = (analysisTime.extraction || 0) + (analysisTime.summary || 0);
              console.log('🔧 Calculated missing PDF total time:', analysisTime.total);
            }

            console.log('🔧 Created analysisTime copy for PDF:', analysisTime);
            return analysisTime;
          }

          return data.analysisTime;
        })(),
        // Add analysis type from server response or infer from input type
        analysisType: data.analysisType || (inputType === InputType.PDF_URL || inputType === InputType.PDF_FILE ? 'pdf' : undefined),
        // Add file-specific metadata
        source: inputType,
        fileId: data.fileId,
        originalFilename: data.originalName,
        fileSize: data.size,
        uploadedAt: data.uploadedAt,
        // PDF-specific content for page navigation
        pdfContent: data.pdfContent
      }
      
      // Debug PDF content received from server
      if (inputType === InputType.PDF_URL || inputType === InputType.PDF_FILE) {
        console.log('📄 === PDF CONTENT DEBUG ===');
        console.log('  - data.pdfContent exists:', !!data.pdfContent);
        console.log('  - data.pdfContent.pageSegments length:', data.pdfContent?.pageSegments?.length || 0);
        console.log('  - videoMetadata.pdfContent exists:', !!videoMetadata.pdfContent);
        console.log('  - videoMetadata.pdfContent.pageSegments length:', videoMetadata.pdfContent?.pageSegments?.length || 0);
        if (data.pdfContent?.pageSegments && data.pdfContent.pageSegments.length > 0) {
          console.log('  - First page segment:', data.pdfContent.pageSegments[0]);
        }
      }
      
      console.log('🕒 AnalyzePage: Final videoMetadata analysis time:', videoMetadata.analysisTime)
      console.log('🕒 AnalyzePage: Final videoMetadata analysisType:', videoMetadata.analysisType)
      console.log('🕒 AnalyzePage: Final videoMetadata source:', videoMetadata.source)
      console.log('🕒 AnalyzePage: inputType:', inputType)
      
      // Special debugging for PDF analysis
      if (inputType === InputType.PDF_URL || inputType === InputType.PDF_FILE) {
        console.log('📄 ===== PDF ANALYSIS DEBUG =====');
        console.log('📄 Server analysisTime:', data.analysisTime);
        console.log('📄 VideoMetadata analysisTime:', videoMetadata.analysisTime);
        
        if (videoMetadata.analysisTime) {
          console.log('📄 VideoMetadata analysisTime keys:', Object.keys(videoMetadata.analysisTime));
          console.log('📄 VideoMetadata startTime:', videoMetadata.analysisTime.startTime);
          console.log('📄 VideoMetadata startTime type:', typeof videoMetadata.analysisTime.startTime);
          console.log('📄 VideoMetadata endTime:', videoMetadata.analysisTime.endTime);
          console.log('📄 VideoMetadata endTime type:', typeof videoMetadata.analysisTime.endTime);
          console.log('📄 VideoMetadata duration:', videoMetadata.analysisTime.duration);
          console.log('📄 VideoMetadata extraction:', videoMetadata.analysisTime.extraction);
          console.log('📄 VideoMetadata total:', videoMetadata.analysisTime.total);
        } else {
          console.log('❌ VideoMetadata analysisTime is null/undefined');
        }
        console.log('📄 ===============================');
      }
      
      setCurrentVideo(videoMetadata)
      // Auto-collapse form after successful analysis
      setFormCollapsed(true)
    } catch (error) {
      console.error('Error processing video:', error)
      let errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Provide user-friendly error messages for common network issues
      if (errorMessage.includes('ERR_CONTENT_LENGTH_MISMATCH')) {
        errorMessage = 'PDF processing failed due to network issues. The file may be too large or there was a connection problem. Please try again with a smaller PDF.'
      } else if (errorMessage.includes('ERR_NETWORK') || errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network connection error. Please check your internet connection and try again.'
      }
      
      if (inputType === InputType.VIDEO_FILE || inputType === InputType.AUDIO_FILE || inputType === InputType.PDF_FILE) {
        setFileError(`Failed to process file: ${errorMessage}`)
      } else if (inputType === InputType.PDF_URL) {
        setUrlError(`Failed to process PDF: ${errorMessage}`)
      } else {
        alert(`Failed to process: ${errorMessage}`)
      }
    } finally {
      setLoading(false)
      setUploadProgress(0)
      // Clear estimated processing time after analysis
      setEstimatedProcessingTime(null)
    }
  }

  // Handle question clicks from TranscriptViewer
  const handleQuestionClick = (question: string) => {
    setPrefillQuestion(question)
    // Clear the question after a brief delay to allow ChatInterface to pick it up
    setTimeout(() => setPrefillQuestion(''), 100)
  }

  // Handle chat cost update
  const handleChatCostUpdate = (messageCost: number, totalChatCost: number) => {
    if (currentVideo && currentVideo.costs) {
      const updatedCosts = {
        ...currentVideo.costs,
        chat: totalChatCost,
        total: currentVideo.costs.transcription + currentVideo.costs.summary + currentVideo.costs.article + totalChatCost
      }

      setCurrentVideo({
        ...currentVideo,
        costs: updatedCosts
      })
    }
  }

  // Handle article generation cost update
  const handleArticleGenerated = (cost: number) => {
    if (currentVideo && currentVideo.costs) {
      const updatedCosts = {
        ...currentVideo.costs,
        article: cost,
        total: currentVideo.costs.transcription + currentVideo.costs.summary + cost + (currentVideo.costs.chat || 0)
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

  // Generate detailed rationale for the estimation
  const generateEstimationRationale = (processingTime: any, costs: any) => {
    const contentType =
      (inputType === InputType.PDF_URL || inputType === InputType.PDF_FILE) ? 'pdf' :
      (inputType === InputType.AUDIO_FILE) ? 'audio' : 'youtube';

    const isPDF = contentType === 'pdf';
    const isHistorical = processingTime?.isHistoricalEstimate;

    const rationale = {
      title: "推定時間の算出根拠",
      sections: [] as Array<{title: string, content: string[]}>
    };

    // Section 1: Data Source
    if (isHistorical) {
      rationale.sections.push({
        title: "📊 データソース",
        content: [
          `過去の実績データから推定しています`,
          `サンプル数: ${processingTime.sampleSize || '不明'}件`,
          `信頼度: ${processingTime.confidence ? Math.round(processingTime.confidence * 100) : '?'}%`,
          isHistorical ? "✓ 精度の高い予測が可能です" : ""
        ].filter(Boolean)
      });
    } else {
      rationale.sections.push({
        title: "📊 データソース",
        content: [
          "デフォルト係数を使用しています",
          "履歴データがないため、標準的な処理速度で推定",
          "実際の処理時間は変動する可能性があります",
          "処理を重ねることで精度が向上します"
        ]
      });
    }

    // Section 2: Normalization Method
    const transcriptionTime = processingTime.transcription;
    const summaryTime = processingTime.summary;

    const normalizationContent = [];

    if (isPDF) {
      normalizationContent.push(
        "PDF: ページベースの正規化",
        "",
        `テキスト抽出: ${formatProcessingTime(transcriptionTime)}`,
        processingTime.transcriptionRate ? `  → 速度: ${processingTime.transcriptionRate}` : "",
        `要約生成: ${formatProcessingTime(summaryTime)}`,
        processingTime.summaryRate ? `  → 速度: ${processingTime.summaryRate}` : "",
        "",
        "ページ数 × 処理速度 = 推定時間"
      );
    } else {
      normalizationContent.push(
        "動画/音声: 分ベースの正規化",
        "",
        `文字起こし: ${formatProcessingTime(transcriptionTime)}`,
        processingTime.transcriptionRate ? `  → 速度: ${processingTime.transcriptionRate}` : "",
        `要約生成: ${formatProcessingTime(summaryTime)}`,
        processingTime.summaryRate ? `  → 速度: ${processingTime.summaryRate}` : "",
        "",
        "動画時間(分) × 処理速度 = 推定時間"
      );
    }

    rationale.sections.push({
      title: "⚖️ 正規化方法",
      content: normalizationContent.filter(Boolean)
    });

    // Section 3: Cost Breakdown
    const durationMinutes = processingTime.durationMinutes || 0;
    const costPerMinuteTranscription = durationMinutes > 0 ? costs.transcription / durationMinutes : 0;
    const costPerMinuteSummary = durationMinutes > 0 ? costs.summary / durationMinutes : 0;
    const costPerMinuteTotal = durationMinutes > 0 ? costs.total / durationMinutes : 0;

    const costContent = [];

    if (isPDF) {
      // For PDF, show per-page cost
      costContent.push(
        `文字起こし: $${costs.transcription.toFixed(4)}`,
        `要約生成: $${costs.summary.toFixed(4)}`,
        `合計: $${costs.total.toFixed(4)}`,
        "",
        durationMinutes > 0 ? `このPDF (${durationMinutes}ページ) の場合:` : "このPDFの場合:",
        durationMinutes > 0 ? `1ページあたり: 約$${(costs.total / durationMinutes).toFixed(6)}` : "",
        "ページ数が多いほどコストが増加します"
      );
    } else {
      // For video/audio, show per-minute cost
      costContent.push(
        `文字起こし: $${costs.transcription.toFixed(4)}`,
        durationMinutes > 0 ? `  → 1分あたり: 約$${costPerMinuteTranscription.toFixed(6)}` : "",
        `要約生成: $${costs.summary.toFixed(4)}`,
        durationMinutes > 0 ? `  → 1分あたり: 約$${costPerMinuteSummary.toFixed(6)}` : "",
        `合計: $${costs.total.toFixed(4)}`,
        durationMinutes > 0 ? `  → 1分あたり: 約$${costPerMinuteTotal.toFixed(6)}` : "",
        "",
        durationMinutes > 0 ? `この動画 (${durationMinutes}分) の場合:` : "この動画の場合:",
        durationMinutes > 0 ? `${durationMinutes}分 × $${costPerMinuteTotal.toFixed(6)}/分 = $${costs.total.toFixed(4)}` : "",
        "動画が長いほどコストが増加します"
      );
    }

    rationale.sections.push({
      title: "💰 コスト内訳",
      content: costContent.filter(Boolean)
    });

    // Section 4: Processing Breakdown
    const total = processingTime.total;

    rationale.sections.push({
      title: "⏱️ 処理時間内訳",
      content: [
        `${isPDF ? 'テキスト抽出' : '文字起こし'}: ${formatProcessingTime(transcriptionTime)} (${Math.round(transcriptionTime / total * 100)}%)`,
        `要約生成: ${formatProcessingTime(summaryTime)} (${Math.round(summaryTime / total * 100)}%)`,
        `合計: ${formatProcessingTime(total)}`,
        "",
        isPDF ?
          "PDFからのテキスト抽出は高速です" :
          "文字起こしが処理時間の大部分を占めます"
      ]
    });

    // Section 5: Factors
    rationale.sections.push({
      title: "📝 影響要因",
      content: isPDF ? [
        "• ページ数: ページが多いほど時間がかかります",
        "• テキスト量: 1ページあたりの文字数",
        "• 要約モデル: GPT-4oはGPT-4o-miniより遅いですが高品質",
        "• サーバー負荷: 混雑時は遅くなる可能性があります"
      ] : [
        "• 動画の長さ: 長いほど時間がかかります",
        "• 音声品質: 音質が悪いと文字起こしに時間がかかる場合があります",
        "• 文字起こしモデル: GPT-4oはWhisperより高速です",
        "• 要約モデル: GPT-4oはGPT-4o-miniより遅いですが高品質",
        "• サーバー負荷: 混雑時は遅くなる可能性があります"
      ]
    });

    return rationale;
  };

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
      console.log('🎨 Rendering cost estimation result', {
        costs: costEstimation.estimatedCosts,
        processingTime: costEstimation.estimatedProcessingTime
      })
      const costs = costEstimation.estimatedCosts
      const processingTime = costEstimation.estimatedProcessingTime
      return (
        <div className="space-y-3">
          {/* Cost Estimation */}
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-start gap-2">
              <span className="text-green-600 text-lg">💰</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-green-800 mb-2">
                  想定コスト内訳（概算）
                </div>
                <div className="text-xs text-green-700 space-y-1">
                  <div className="flex justify-between">
                    <span>動画時間:</span>
                    <span className="font-mono">{costEstimation.durationFormatted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>文字起こしモデル:</span>
                    <span className="font-mono text-xs">{transcriptionModel === 'gpt-4o-transcribe' ? 'GPT-4o' : transcriptionModel === 'gpt-4o-mini-transcribe' ? 'GPT-4o Mini' : 'Whisper-1'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>要約AIモデル:</span>
                    <span className="font-mono text-xs">{costEstimation.gptModel || model || 'N/A'}</span>
                  </div>
                  <div className="border-t border-green-200 mt-1 pt-1"></div>
                  <div className="flex justify-between">
                    <span>
                      {(inputType === InputType.PDF_URL || inputType === InputType.PDF_FILE) ? 
                        'PDF解析費用:' : '文字起こし費用:'
                      }
                    </span>
                    <span className="font-mono">
                      {(inputType === InputType.PDF_URL || inputType === InputType.PDF_FILE) ? 
                        '無料' : `$${costs.transcription.toFixed(4)}`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>要約生成費用:</span>
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
          
          {/* Processing Time Estimation */}
          {processingTime && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 text-lg">⏱️</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2 flex-wrap">
                    <span>想定処理時間（概算）</span>
                    {processingTime.isHistoricalEstimate ? (
                      <span className="text-xs font-normal text-green-700 bg-green-100 px-2 py-1 rounded">
                        ✓ 過去の実績から算出
                      </span>
                    ) : (
                      <span className="text-xs font-normal text-orange-700 bg-orange-100 px-2 py-1 rounded">
                        ⚠️ デフォルト値 (参考程度)
                      </span>
                    )}
                    {inputType === InputType.YOUTUBE_URL && (
                      <span className="text-xs font-normal text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                        ℹ️ 動画の長さを仮定
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-blue-700 space-y-1">
                    <div className="flex justify-between">
                      <span>{getFirstStageSpeedLabel().replace('速度', '時間')}:</span>
                      <span className="font-mono">{formatProcessingTime(processingTime.transcription)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>要約生成時間:</span>
                      <span className="font-mono">{formatProcessingTime(processingTime.summary)}</span>
                    </div>
                    <div className="border-t border-blue-200 mt-1 pt-1"></div>
                    <div className="flex justify-between font-medium">
                      <span>合計処理時間:</span>
                      <span className="font-mono">{processingTime.formatted}</span>
                    </div>
                    {processingTime.basedOn && (
                      <div className="border-t border-blue-200 mt-1 pt-1">
                        <div className="flex justify-between text-xs">
                          <span>予測根拠:</span>
                          <span className={`font-mono ${
                            processingTime.basedOn === 'historical' ? 'text-green-600' :
                            processingTime.basedOn === 'model_default' ? 'text-blue-600' :
                            'text-gray-500'
                          }`}>
                            {processingTime.basedOn === 'historical' ? `履歴データ (${processingTime.sampleSize || 0}件)` :
                             processingTime.basedOn === 'model_default' ? 'モデル標準値' :
                             'デフォルト値'}
                          </span>
                        </div>
                        {processingTime.confidence && (
                          <div className="flex justify-between text-xs">
                            <span>予測信頼度:</span>
                            <span className={`font-mono ${
                              processingTime.confidence >= 0.7 ? 'text-green-600' :
                              processingTime.confidence >= 0.4 ? 'text-yellow-600' :
                              'text-red-500'
                            }`}>
                              {Math.round(processingTime.confidence * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {renderProcessingTimeNote()}
                    {processingTime.basedOn === 'historical' && (
                      <div className="text-green-600 mt-1">
                        ✓ 過去の実績データから予測 - 精度が向上しています
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Rationale Toggle */}
          {processingTime && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowEstimationRationale(!showEstimationRationale)}
                className="w-full p-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 flex items-center gap-2">
                    <span>📋</span>
                    <span>推定の詳細な根拠を見る</span>
                  </span>
                  <span className="text-gray-500">
                    {showEstimationRationale ? '▲' : '▼'}
                  </span>
                </div>
              </button>

              {showEstimationRationale && (() => {
                const rationale = generateEstimationRationale(processingTime, costs);
                return (
                  <div className="mt-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="space-y-3">
                      {rationale.sections.map((section, index) => (
                        <div key={index} className="space-y-1">
                          <div className="text-sm font-semibold text-gray-800">
                            {section.title}
                          </div>
                          <div className="text-xs text-gray-700 space-y-0.5">
                            {section.content.map((line, lineIndex) => (
                              <div key={lineIndex}>{line}</div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
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

  // Render processing time note based on content type
  const renderProcessingTimeNote = () => {
    // Determine content type from current input type or current video analysis type
    let contentType = 'youtube'; // default
    
    if (currentVideo?.analysisType) {
      contentType = currentVideo.analysisType;
    } else if (inputType === InputType.PDF_URL || inputType === InputType.PDF_FILE) {
      contentType = 'pdf';
    } else if (inputType === InputType.AUDIO_FILE) {
      contentType = 'audio';
    } else if (inputType === InputType.VIDEO_FILE) {
      contentType = 'youtube'; // treat video files as youtube-like
    }

    switch (contentType) {
      case 'pdf':
        return '※文書ページあたりの処理時間を表示（実際の時間はサーバー負荷により変動）';
      case 'audio':
        return '※音声1分あたりの処理時間を表示（実際の時間はサーバー負荷により変動）';
      case 'youtube':
      default:
        return '※動画1分あたりの処理時間を表示（実際の時間はサーバー負荷により変動）';
    }
  }

  // Get first stage title based on content type
  const getFirstStageTitle = () => {
    const contentType = currentVideo?.analysisType || 'youtube';
    switch (contentType) {
      case 'pdf':
        return '📄 PDFテキスト抽出';
      case 'audio':
        return '🎵 文字起こし';
      case 'youtube':
      default:
        return '📝 文字起こし';
    }
  }

  // Get first stage method based on content type
  const getFirstStageMethod = () => {
    if (isPdfContent(currentVideo)) {
      return 'PDF Parser';
    } else if (currentVideo?.analysisType === 'audio') {
      return 'Whisper AI';
    } else {
      // YouTube or other video content
      return currentVideo?.transcriptSource === 'subtitle' ? 'YouTube字幕' : 'Whisper AI';
    }
  }

  // Get first stage processing time based on content type
  const getFirstStageProcessingTime = () => {
    if (!currentVideo?.analysisTime) {
      console.log('❌ getFirstStageProcessingTime: No analysisTime data');
      return null;
    }
    
    const isPdf = isPdfContent(currentVideo);
    console.log(`📊 getFirstStageProcessingTime: isPdf=${isPdf}, analysisTime=`, currentVideo.analysisTime);

    if (isPdf) {
      const analysisTime = currentVideo.analysisTime;

      // Log all timing fields for debugging
      console.log('📄 PDF Timing Fields:', {
        extraction: analysisTime.extraction,
        summary: analysisTime.summary,
        total: analysisTime.total,
        duration: analysisTime.duration
      });

      // Priority 1: extraction field (specific for PDF text extraction)
      if (analysisTime.extraction !== undefined && typeof analysisTime.extraction === 'number' && analysisTime.extraction >= 0) {
        console.log(`✅ PDF using extraction time: ${analysisTime.extraction}s (テキスト抽出のみ)`);
        return analysisTime.extraction;
      }
      
      // Priority 2: transcription field (in case extraction is named differently)
      if (analysisTime.transcription !== undefined && typeof analysisTime.transcription === 'number' && analysisTime.transcription >= 0) {
        console.log(`✅ PDF using transcription time: ${analysisTime.transcription}`);
        return analysisTime.transcription;
      }
      
      // Priority 3: For completed PDF analysis, provide fallback to prevent "計測中..." display
      // If we have a summary time, it means analysis completed - use minimal extraction time
      if (analysisTime.summary !== undefined && typeof analysisTime.summary === 'number' && analysisTime.summary >= 0) {
        console.log('⚠️ PDF: Using fallback extraction time (0.1s) as analysis is completed with summary');
        return 0.1; // Minimal fallback to indicate completion
      }
      
      // If no timing data is available, return null (will show "計測中...")
      console.log('❌ PDF: No valid extraction timing data found. Available fields:', Object.keys(analysisTime));
      console.log('❌ PDF: extraction =', analysisTime.extraction, ', transcription =', analysisTime.transcription, ', summary =', analysisTime.summary);
      return null;
    } else {
      // For audio/video content
      return currentVideo.analysisTime.transcription || null;
    }
  }

  // Get first stage speed label based on content type
  const getFirstStageSpeedLabel = () => {
    // Determine content type from current input type or current video analysis type
    let contentType = 'youtube'; // default
    
    if (currentVideo?.analysisType) {
      contentType = currentVideo.analysisType;
    } else if (inputType === InputType.PDF_URL || inputType === InputType.PDF_FILE) {
      contentType = 'pdf';
    } else if (inputType === InputType.AUDIO_FILE) {
      contentType = 'audio';
    } else if (inputType === InputType.VIDEO_FILE) {
      contentType = 'youtube'; // treat video files as youtube-like
    }

    switch (contentType) {
      case 'pdf':
        return '文書解析速度';
      case 'audio':
        return '文字起こし速度';
      case 'youtube':
      default:
        return '文字起こし速度';
    }
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
    console.log('🔄 Model changed to:', model, 'Transcription model:', transcriptionModel)
    
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
  }, [model, transcriptionModel]) // Depend on both model changes to avoid infinite loops

  // Helper function to safely format date
  const formatSafeDate = (timestamp: string | undefined | null, fallback: string = '不明'): string => {
    console.log(`📅 formatSafeDate called with:`, {
      timestamp,
      type: typeof timestamp,
      isNull: timestamp === null,
      isUndefined: timestamp === undefined,
      isEmpty: timestamp === '',
      currentVideoAnalysisTime: currentVideo?.analysisTime
    });
    
    try {
      // Basic validation
      if (!timestamp || timestamp === '' || timestamp === null || timestamp === undefined) {
        console.log('❌ formatSafeDate: Invalid or empty timestamp');
        return fallback;
      }
      
      // Convert to string and validate
      const timeStr = String(timestamp).trim();
      if (timeStr === '' || timeStr === 'null' || timeStr === 'undefined') {
        console.log('❌ formatSafeDate: Invalid timestamp string:', timeStr);
        return fallback;
      }
      
      // Create date object
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) {
        console.log('❌ formatSafeDate: Cannot parse date:', timeStr);
        return fallback;
      }
      
      // Format date
      const formatted = date.toLocaleString('ja-JP', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      console.log(`✅ formatSafeDate: Successfully formatted "${timeStr}" → "${formatted}"`);
      return formatted;
    } catch (error) {
      console.log('❌ formatSafeDate: Exception occurred:', error);
      return fallback;
    }
  }

  // Helper function to safely format duration
  const formatSafeDuration = (duration: number | undefined | null, forceCalculatePdfTotal: boolean = false): string => {
    console.log(`⏱️ formatSafeDuration: input=${duration}, isPdf=${isPdfContent(currentVideo)}, forceCalculate=${forceCalculatePdfTotal}`);
    
    let effectiveDuration = duration;
    
    // Special handling for PDF total duration calculation
    if (forceCalculatePdfTotal && isPdfContent(currentVideo) && currentVideo?.analysisTime) {
      const analysisTime = currentVideo.analysisTime;
      const extraction = analysisTime.extraction;
      const summary = analysisTime.summary;
      
      console.log(`⏱️ PDF force calculation - extraction: ${extraction}, summary: ${summary}`);
      
      if (extraction && typeof extraction === 'number' && extraction >= 0 &&
          summary && typeof summary === 'number' && summary >= 0) {
        effectiveDuration = extraction + summary;
        console.log(`⏱️ PDF force calculated total: ${extraction} + ${summary} = ${effectiveDuration}`);
      }
    }
    
    // If input duration is invalid and we have a current video with analysis time
    if ((!effectiveDuration || isNaN(effectiveDuration) || effectiveDuration <= 0) && currentVideo?.analysisTime) {
      const analysisTime = currentVideo.analysisTime;
      
      if (isPdfContent(currentVideo)) {
        // For PDFs, try multiple fallback sources
        // Priority 1: total field (most comprehensive)
        if (analysisTime.total && typeof analysisTime.total === 'number' && analysisTime.total >= 0) {
          console.log(`⏱️ PDF using total: ${analysisTime.total}`);
          effectiveDuration = analysisTime.total;
        }
        // Priority 2: extraction field
        else if (analysisTime.extraction && typeof analysisTime.extraction === 'number' && analysisTime.extraction >= 0) {
          console.log(`⏱️ PDF using extraction: ${analysisTime.extraction}`);
          effectiveDuration = analysisTime.extraction;
        }
        // Priority 3: duration field
        else if (analysisTime.duration && typeof analysisTime.duration === 'number' && analysisTime.duration >= 0) {
          console.log(`⏱️ PDF using duration: ${analysisTime.duration}`);
          effectiveDuration = analysisTime.duration;
        }
      } else {
        // For video/audio content
        if (analysisTime.total && typeof analysisTime.total === 'number' && analysisTime.total > 0) {
          console.log(`⏱️ Video/Audio using total: ${analysisTime.total}`);
          effectiveDuration = analysisTime.total;
        }
      }
    }
    
    if (!effectiveDuration || isNaN(effectiveDuration) || effectiveDuration <= 0) {
      console.log('❌ formatSafeDuration: No valid duration available after all fallbacks');
      return '計測中...';
    }
    
    console.log(`✅ formatSafeDuration: Using duration ${effectiveDuration} seconds`);
    
    // For sub-second durations, show with one decimal place
    if (effectiveDuration < 1) {
      const roundedDuration = Math.round(effectiveDuration * 10) / 10;
      return `${roundedDuration}秒`;
    }
    // For durations less than 60 seconds, round to nearest integer
    else if (effectiveDuration < 60) {
      const safeDuration = Math.round(effectiveDuration);
      return `${safeDuration}秒`;
    } 
    // For longer durations, use minutes and seconds
    else {
      const safeDuration = Math.round(effectiveDuration);
      const minutes = Math.floor(safeDuration / 60);
      const seconds = safeDuration % 60;
      return `${minutes}分${seconds}秒`;
    }
  }

  // Helper function to detect if video is PDF based on URL and method
  const isPdfContent = (video: any): boolean => {
    // Check by input type first (most reliable for current session)
    if (inputType === InputType.PDF_URL || inputType === InputType.PDF_FILE) {
      console.log('📄 PDF detected by inputType');
      return true;
    }
    
    // Check by analysis type
    if (video?.analysisType === 'pdf') {
      console.log('📄 PDF detected by analysisType');
      return true;
    }
    
    // Check by URL
    if (video?.url && video.url.includes('.pdf')) {
      console.log('📄 PDF detected by URL');
      return true;
    }
    
    // Check by filename
    if (video?.originalFilename && video.originalFilename.toLowerCase().endsWith('.pdf')) {
      console.log('📄 PDF detected by filename');
      return true;
    }
    
    // Legacy check by method (non-YouTube subtitle)
    if (video?.method === 'subtitle' && !video?.url?.includes('youtube.com') && !video?.url?.includes('youtu.be')) {
      console.log('📄 PDF detected by method');
      return true;
    }
    
    return false;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display text-app-primary flex items-center justify-center lg:justify-start gap-3">
              🎥 Analyze Video
            </h1>
            <p className="mt-3 text-body text-app-secondary max-w-2xl">
              Transform YouTube videos, PDFs, and local files into insights with AI-powered analysis. Just paste a URL and I'll automatically detect the content type.
            </p>
          </div>
          
          {/* Test Button for Development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                  setUrl(testUrl)
                  handleUrlChange(testUrl)
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
              >
                🧪 Test URL
              </button>
              <div className="text-xs text-gray-500 text-center">Dev Mode</div>
            </div>
          )}
        </div>
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
                {inputType === InputType.YOUTUBE_URL && renderCostEstimation()}

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

                {/* Input Mode Selection - URL or File Upload */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-app-primary">
                        📥 Input Mode
                      </label>
                      {detectedType && inputMode === 'url' && (
                        <span className={`text-xs flex items-center gap-1 ${
                          detectedType.confidence === 'high' ? 'text-green-600' :
                          detectedType.confidence === 'medium' ? 'text-yellow-600' :
                          'text-gray-600'
                        }`}>
                          🔍 Detected: {detectedType.displayName}
                          {detectedType.confidence === 'high' && ' ✓'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-1 bg-white rounded-lg border border-gray-300">
                      <button
                        type="button"
                        onClick={() => handleInputModeChange('url')}
                        className={`px-4 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                          inputMode === 'url'
                            ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                            : 'bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                        title="Enter any URL (YouTube, PDF, audio, video)"
                      >
                        <span className="flex flex-col items-center gap-2">
                          <span className="text-2xl">🔗</span>
                          <span className="text-sm font-semibold">URL Input</span>
                          <span className="text-xs opacity-80">YouTube, PDF, Audio, Video</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInputModeChange('file')}
                        className={`px-4 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                          inputMode === 'file'
                            ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                            : 'bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                        title="Upload video, audio, or PDF file"
                      >
                        <span className="flex flex-col items-center gap-2">
                          <span className="text-2xl">📁</span>
                          <span className="text-sm font-semibold">File Upload</span>
                          <span className="text-xs opacity-80">Video, Audio, PDF</span>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Conditional Input Section */}
                {inputMode === 'url' ? (
                  /* URL Input - Auto-detects YouTube, PDF, Audio, Video */
                  <div className="space-y-4">
                    <div className="relative">
                      <label htmlFor="url" className="block text-sm font-medium text-app-primary mb-2">
                        <span className="flex items-center gap-2">
                          🔗 Enter URL
                          {detectedType && (
                            <span className="text-xs font-normal opacity-75">
                              ({detectedType.displayName})
                            </span>
                          )}
                        </span>
                      </label>
                      <input
                        type="url"
                        id="url"
                        ref={inputRef}
                        value={url}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        onPaste={handleUrlPaste}
                        placeholder="Enter any URL: YouTube, PDF, audio, video..."
                        className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 focus-ring text-body ${
                          urlError
                            ? 'border-red-300 bg-red-50 text-red-900 placeholder-red-400'
                            : detectedType && detectedType.confidence === 'high'
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300 focus:border-blue-500 bg-white'
                        }`}
                        autoComplete="off"
                        data-testid="url-input"
                        required={inputMode === 'url'}
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
                  /* File Upload - Auto-detects Video, Audio, PDF */
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-app-primary mb-2">
                      <span className="flex items-center gap-2">
                        📁 Upload File
                        {(videoFile || audioFile || pdfFile) && (
                          <span className="text-xs font-normal opacity-75">
                            ({videoFile ? 'Video' : audioFile ? 'Audio' : 'PDF'})
                          </span>
                        )}
                      </span>
                    </label>
                    <VideoFileUpload
                      onFileSelected={handleFileSelected}
                      maxSize={500 * 1024 * 1024} // 500MB
                      acceptedFormats={[
                        // Video formats
                        'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
                        // Audio formats
                        'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/flac',
                        // PDF format
                        'application/pdf'
                      ]}
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
                  <div className="lg:col-span-1">
                    <label htmlFor="language" className="block text-app-primary mb-2">
                      <div className="text-sm font-medium">🌐 Language</div>
                      <div className="text-xs text-gray-500">
                        {inputType === InputType.PDF_URL || inputType === InputType.PDF_FILE ? 'PDF言語' : '文字起こし言語'}
                      </div>
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

                  {/* Only show transcription model for video/audio files */}
                  {(inputType === InputType.YOUTUBE_URL || inputType === InputType.VIDEO_FILE || inputType === InputType.AUDIO_FILE) && (
                    <div className="lg:col-span-1">
                      <label htmlFor="transcriptionModel" className="block text-app-primary mb-2">
                        <div className="text-sm font-medium">🎵 Transcription</div>
                        <div className="text-xs text-gray-500">文字起こしモデル</div>
                      </label>
                      <select
                        id="transcriptionModel"
                        value={transcriptionModel}
                        onChange={(e) => setTranscriptionModel(e.target.value as 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe' | 'whisper-1')}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus-ring text-body bg-white"
                      >
                        <option value="gpt-4o-transcribe">GPT-4o Transcribe - $6/1M tokens</option>
                        <option value="gpt-4o-mini-transcribe">GPT-4o Mini - $3/1M tokens</option>
                        <option value="whisper-1">Whisper-1 - $6/minute</option>
                      </select>
                    </div>
                  )}

                  <div className={inputType === InputType.PDF_URL || inputType === InputType.PDF_FILE ? "lg:col-span-2" : "lg:col-span-1"}>
                    <label htmlFor="model" className="block text-app-primary mb-2">
                      <div className="text-sm font-medium">🤖 Summary AI</div>
                      <div className="text-xs text-gray-500">要約生成モデル</div>
                    </label>
                    <select
                      id="model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus-ring text-body bg-white"
                    >
                      <option value="gpt-4o-mini">GPT-4o Mini - $0.15/$0.60/1M</option>
                      <option value="gpt-4o">GPT-4o - $2.50/$10.00/1M</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo - $10.00/$30.00/1M</option>
                      <option value="gpt-4">GPT-4 - $30.00/$60.00/1M</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo - $0.50/$1.50/1M</option>
                    </select>
                  </div>
                </div>

                {/* Submit Button - Separate Row */}
                <div className="mt-4">
                  <button
                    type="submit"
                    disabled={
                      loading || 
                      (inputType === InputType.YOUTUBE_URL && (!url.trim() || !!urlError)) ||
                      (inputType === InputType.VIDEO_FILE && (!videoFile || !!fileError)) ||
                      (inputType === InputType.AUDIO_FILE && (!audioFile || !!fileError)) ||
                      (inputType === InputType.PDF_URL && (!url.trim() || !!urlError)) ||
                      (inputType === InputType.PDF_FILE && (!pdfFile || !!fileError))
                    }
                    className="btn-modern btn-success w-full text-white font-semibold shadow-elevation-hover"
                    data-testid="analyze-button"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span className="text-tabular">
                          {inputType === InputType.VIDEO_FILE || inputType === InputType.AUDIO_FILE || inputType === InputType.PDF_FILE ? 'Processing...' : 'Analyzing...'}
                        </span>
                      </div>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        ⚡ {(() => {
                          switch(inputType) {
                            case InputType.YOUTUBE_URL: return 'Analyze Video'
                            case InputType.VIDEO_FILE: return 'Process Video'
                            case InputType.AUDIO_FILE: return 'Process Audio'
                            case InputType.PDF_URL: return 'Analyze PDF'
                            case InputType.PDF_FILE: return 'Process PDF'
                            default: return 'Analyze'
                          }
                        })()}
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Loading State with Progress */}
      {loading && (
        <div className="space-y-6">
          {/* Analysis Progress Indicator */}
          <AnalysisProgress 
            isAnalyzing={loading}
            estimatedTime={estimatedProcessingTime || costEstimation?.estimatedProcessingTime}
          />
          
          {/* Skeleton Loading */}
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
                {currentVideo.basic?.videoPath && !currentVideo.basic?.videoId && (
                  <video
                    ref={(video) => {
                      if (video && !playerRef) {
                        console.log('🎥 Setting video element as playerRef')
                        setPlayerRef(video as any)
                      }
                    }}
                    src={currentVideo.basic.videoPath}
                    controls
                    className="w-full h-full bg-black"
                    onLoadedMetadata={(e) => {
                      console.log('📹 Video loaded:', currentVideo.basic.videoPath)
                    }}
                    onError={(e) => {
                      console.error('❌ Video loading error:', e)
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
                {currentVideo.basic?.pdfUrl && !currentVideo.basic?.videoId && !currentVideo.basic?.videoPath && (
                  <PDFViewer
                    ref={pdfViewerRef}
                    pdfUrl={currentVideo.basic.pdfUrl}
                    title={currentVideo.basic.title || 'PDF Document'}
                    pdfContent={currentVideo.pdfContent}
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
                    Uploaded: {formatSafeDate(currentVideo.basic.uploadDate, 'Unknown Date')}
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
                              💰 分析コスト（実績）
                            </h4>
                            <div className="space-y-2">
                              {/* 第一段階処理コスト詳細 */}
                              <div className="bg-gray-50 p-2 rounded border border-gray-200">
                                <div className="text-xs font-semibold text-gray-700 mb-1">{getFirstStageTitle()}</div>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">方法:</span>
                                    <span className="text-gray-800">
                                      {getFirstStageMethod()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">コスト:</span>
                                    <span className="font-semibold text-black">
                                      {(() => {
                                        if (isPdfContent(currentVideo)) {
                                          // For PDFs, show PDF parsing cost (which is currently free)
                                          return 'PDF解析: 無料';
                                        } else {
                                          // For audio/video, show transcription cost
                                          return currentVideo.costs.transcription > 0 ? 
                                            `$${currentVideo.costs.transcription.toFixed(4)}` : 
                                            '無料';
                                        }
                                      })()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">処理時間:</span>
                                    <span className="text-gray-800">
                                      {getFirstStageProcessingTime() ? 
                                        formatSafeDuration(getFirstStageProcessingTime()) : 
                                        '計測中...'
                                      }
                                    </span>
                                  </div>
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
                                        {formatSafeDuration(currentVideo.analysisTime.summary)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* 記事生成（もし生成されていれば） */}
                              {currentVideo.costs.article > 0 && (
                                <div className="bg-gray-50 p-2 rounded border border-gray-200">
                                  <div className="text-xs font-semibold text-gray-700 mb-1">📄 記事生成</div>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">コスト:</span>
                                      <span className="font-semibold text-black">
                                        ${currentVideo.costs.article.toFixed(4)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* チャット（もし使用していれば） */}
                              {currentVideo.costs.chat > 0 && (
                                <div className="bg-gray-50 p-2 rounded border border-gray-200">
                                  <div className="text-xs font-semibold text-gray-700 mb-1">💬 チャット</div>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">コスト:</span>
                                      <span className="font-semibold text-black">
                                        ${currentVideo.costs.chat.toFixed(4)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 合計 */}
                              <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-300">
                                <span className="text-sm text-black font-bold">合計コスト:</span>
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
                                {(() => {
                                  console.log('🔍 === ANALYSIS TIME DEBUG (START) ===');
                                  console.log('📊 Full currentVideo.analysisTime object:', currentVideo.analysisTime);
                                  console.log('📊 Object keys:', Object.keys(currentVideo.analysisTime || {}));
                                  
                                  // Try multiple ways to get start time
                                  let startTime = currentVideo.analysisTime.startTime;
                                  console.log('📅 Direct startTime field value:', startTime);
                                  
                                  // If startTime is not valid, try to use current date as fallback
                                  if (!startTime || startTime === null || startTime === undefined || startTime === '') {
                                    console.log('❌ startTime is invalid, trying fallbacks...');
                                    
                                    // Fallback 1: Check if it's available in a different field name
                                    const possibleStartFields = ['start', 'startedAt', 'analysisStart', 'createdAt'];
                                    for (const field of possibleStartFields) {
                                      if (currentVideo.analysisTime[field] && typeof currentVideo.analysisTime[field] === 'string') {
                                        console.log(`📅 Found startTime in field "${field}":`, currentVideo.analysisTime[field]);
                                        startTime = currentVideo.analysisTime[field];
                                        break;
                                      }
                                    }
                                    
                                    // Fallback 2: Use current date/time if still not found
                                    if (!startTime) {
                                      console.log('📅 Using current time as startTime fallback');
                                      startTime = new Date().toISOString();
                                    }
                                  }
                                  
                                  console.log('📅 Final startTime value:', startTime);
                                  console.log('📅 startTime type:', typeof startTime);
                                  console.log('🔍 =====================================');
                                  
                                  return formatSafeDate(startTime);
                                })()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-800 font-medium">終了:</span>
                              <span className="font-semibold text-black">
                                {(() => {
                                  console.log('🔍 === ANALYSIS TIME DEBUG (END) ===');
                                  
                                  // Try multiple ways to get end time
                                  let endTime = currentVideo.analysisTime.endTime;
                                  console.log('📅 Direct endTime field value:', endTime);
                                  
                                  // If endTime is not valid, try fallbacks
                                  if (!endTime || endTime === null || endTime === undefined || endTime === '') {
                                    console.log('❌ endTime is invalid, trying fallbacks...');
                                    
                                    // Fallback 1: Check if it's available in a different field name
                                    const possibleEndFields = ['end', 'endedAt', 'analysisEnd', 'completedAt', 'finishedAt'];
                                    for (const field of possibleEndFields) {
                                      if (currentVideo.analysisTime[field] && typeof currentVideo.analysisTime[field] === 'string') {
                                        console.log(`📅 Found endTime in field "${field}":`, currentVideo.analysisTime[field]);
                                        endTime = currentVideo.analysisTime[field];
                                        break;
                                      }
                                    }
                                    
                                    // Fallback 2: Calculate from startTime + duration
                                    if (!endTime && currentVideo.analysisTime.startTime && currentVideo.analysisTime.duration) {
                                      try {
                                        const startDate = new Date(currentVideo.analysisTime.startTime);
                                        const durationMs = currentVideo.analysisTime.duration * 1000;
                                        const endDate = new Date(startDate.getTime() + durationMs);
                                        endTime = endDate.toISOString();
                                        console.log('📅 Calculated endTime from startTime + duration:', endTime);
                                      } catch (error) {
                                        console.log('❌ Failed to calculate endTime:', error);
                                      }
                                    }
                                    
                                    // Fallback 3: Use current date/time if still not found
                                    if (!endTime) {
                                      console.log('📅 Using current time as endTime fallback');
                                      endTime = new Date().toISOString();
                                    }
                                  }
                                  
                                  console.log('📅 Final endTime value:', endTime);
                                  console.log('📅 endTime type:', typeof endTime);
                                  console.log('🔍 ===================================');
                                  
                                  return formatSafeDate(endTime);
                                })()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-300">
                              <span className="text-black font-semibold">所要時間:</span>
                              <span className="font-bold text-black text-base">
                                {(() => {
                                  console.log('⏱️ === TOTAL DURATION CALCULATION DEBUG ===');
                                  console.log('⏱️ Full analysisTime object:', currentVideo.analysisTime);
                                  console.log('⏱️ analysisTime keys:', Object.keys(currentVideo.analysisTime || {}));
                                  console.log('⏱️ isPdfContent result:', isPdfContent(currentVideo));
                                  
                                  let totalDuration;
                                  
                                  // For PDF analysis, prioritize the 'total' field from server
                                  if (isPdfContent(currentVideo)) {
                                    const serverTotal = currentVideo.analysisTime.total;
                                    const extraction = currentVideo.analysisTime.extraction;
                                    const summary = currentVideo.analysisTime.summary;
                                    const duration = currentVideo.analysisTime.duration;
                                    
                                    console.log('⏱️ PDF server total field:', serverTotal, 'type:', typeof serverTotal);
                                    console.log('⏱️ PDF extraction time:', extraction, 'type:', typeof extraction);
                                    console.log('⏱️ PDF summary time:', summary, 'type:', typeof summary);
                                    console.log('⏱️ PDF duration field:', duration, 'type:', typeof duration);
                                    
                                    // First priority: use server-calculated total
                                    if (serverTotal && typeof serverTotal === 'number' && serverTotal > 0) {
                                      totalDuration = serverTotal;
                                      console.log(`⏱️ PDF using server total: ${totalDuration}`);
                                    }
                                    // Fallback: calculate extraction + summary if both are available
                                    else if (extraction && typeof extraction === 'number' && extraction >= 0 &&
                                        summary && typeof summary === 'number' && summary >= 0) {
                                      totalDuration = extraction + summary;
                                      console.log(`⏱️ PDF calculated total: ${extraction} + ${summary} = ${totalDuration}`);
                                    }
                                    // If timing data is incomplete, don't show misleading total time
                                    else {
                                      console.log('❌ PDF: Incomplete timing data - cannot calculate accurate total');
                                      console.log('❌ PDF: serverTotal:', serverTotal, ', extraction:', extraction, ', summary:', summary);
                                      // Show "計測中..." (measuring...) or similar instead of misleading data
                                      totalDuration = null;
                                    }
                                  } else {
                                    // For non-PDF content, use duration field as before
                                    totalDuration = currentVideo.analysisTime.duration;
                                    console.log('⏱️ Non-PDF using duration field:', totalDuration);
                                  }
                                  
                                  console.log('⏱️ Final total duration:', totalDuration);
                                  console.log('⏱️ ==========================================');
                                  
                                  return formatSafeDuration(totalDuration);
                                })()}
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
              analysisType={currentVideo.analysisType}
              onSeek={(time) => {
                console.log('🎥 AnalyzePage: onSeek called with time:', time)
                console.log('🎥 AnalyzePage: playerRef available:', !!playerRef)
                
                const trySeek = (retryCount = 0) => {
                  if (playerRef) {
                    // Check if it's an HTML5 video element
                    if (playerRef.currentTime !== undefined) {
                      console.log('🎥 Using HTML5 video seek')
                      playerRef.currentTime = time
                      // Auto-play if paused
                      if (playerRef.paused) {
                        playerRef.play().catch((e: any) => {
                          console.log('⚠️ Auto-play prevented:', e)
                        })
                      }
                    }
                    // YouTube player API methods
                    else if (playerRef.seekTo) {
                      console.log('🎥 Using YouTube player seek')
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
              onPageJump={(page) => {
                console.log('📄 AnalyzePage: onPageJump called with page:', page)
                console.log('📄 AnalyzePage: pdfViewerRef.current available:', !!pdfViewerRef.current)
                console.log('📄 AnalyzePage: currentVideo.basic?.pdfUrl:', currentVideo.basic?.pdfUrl)
                if (pdfViewerRef.current) {
                  pdfViewerRef.current.jumpToPage(page)
                } else {
                  console.warn('🚨 PDF viewer not available for page jump')
                  alert(`PDF navigation to page ${page} - PDF viewer not available`)
                }
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
                  contentType={currentVideo.analysisType || 'youtube'}
                  onCostUpdate={handleChatCostUpdate}
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