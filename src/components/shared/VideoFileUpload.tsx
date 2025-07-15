import React, { useRef, useState, useCallback } from 'react'
import { VideoFile } from '../../types'

interface VideoFileUploadProps {
  onFileSelected: (file: VideoFile) => void
  maxSize: number
  acceptedFormats: string[]
  isUploading: boolean
  uploadProgress: number
  error?: string
}

const VideoFileUpload: React.FC<VideoFileUploadProps> = ({
  onFileSelected,
  maxSize,
  acceptedFormats,
  isUploading,
  uploadProgress,
  error
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [filePreview, setFilePreview] = useState<VideoFile | null>(null)

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Validate file
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!acceptedFormats.includes(file.type)) {
      return `Unsupported file type. Please upload ${acceptedFormats.join(', ')} files.`
    }

    // Check file size
    if (file.size > maxSize) {
      return `File too large. Maximum size is ${formatFileSize(maxSize)}.`
    }

    return null
  }

  // Generate video preview
  const generateVideoPreview = useCallback((file: File): Promise<VideoFile> => {
    return new Promise((resolve, reject) => {
      const videoElement = document.createElement('video')
      const fileUrl = URL.createObjectURL(file)
      
      // Set up cleanup function
      const cleanup = () => {
        try {
          URL.revokeObjectURL(fileUrl)
          videoElement.remove()
        } catch (error) {
          console.warn('Error during cleanup:', error)
        }
      }

      // Set up timeout to prevent hanging
      const timeout = setTimeout(() => {
        cleanup()
        // Resolve with basic info if preview generation fails
        resolve({
          file,
          id: Date.now().toString(),
          name: file.name,
          size: file.size
        })
      }, 10000) // 10 second timeout

      videoElement.preload = 'metadata'
      videoElement.muted = true // Required for some browsers
      
      videoElement.addEventListener('loadedmetadata', () => {
        try {
          // Generate thumbnail from video
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            clearTimeout(timeout)
            cleanup()
            resolve({
              file,
              id: Date.now().toString(),
              name: file.name,
              size: file.size,
              duration: videoElement.duration
            })
            return
          }
          
          canvas.width = 320
          canvas.height = 180
          
          // Seek to a good position for thumbnail
          const seekTime = Math.min(1, videoElement.duration * 0.1) // 10% into video or 1 second
          videoElement.currentTime = seekTime
          
          videoElement.addEventListener('seeked', () => {
            try {
              ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
              const thumbnail = canvas.toDataURL('image/jpeg', 0.7)
              
              const videoFile: VideoFile = {
                file,
                id: Date.now().toString(),
                name: file.name,
                size: file.size,
                duration: videoElement.duration,
                thumbnail
              }
              
              clearTimeout(timeout)
              cleanup()
              resolve(videoFile)
            } catch (error) {
              console.warn('Error generating thumbnail:', error)
              clearTimeout(timeout)
              cleanup()
              resolve({
                file,
                id: Date.now().toString(),
                name: file.name,
                size: file.size,
                duration: videoElement.duration
              })
            }
          }, { once: true })
        } catch (error) {
          console.warn('Error in loadedmetadata handler:', error)
          clearTimeout(timeout)
          cleanup()
          resolve({
            file,
            id: Date.now().toString(),
            name: file.name,
            size: file.size
          })
        }
      }, { once: true })

      // Enhanced error handling
      videoElement.addEventListener('error', (e) => {
        console.warn('Video loading error:', e)
        clearTimeout(timeout)
        cleanup()
        resolve({
          file,
          id: Date.now().toString(),
          name: file.name,
          size: file.size
        })
      }, { once: true })

      // Set the source last to trigger loading
      videoElement.src = fileUrl
    })
  }, [])

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      console.error('File validation failed:', validationError)
      return
    }

    try {
      const videoFile = await generateVideoPreview(file)
      setFilePreview(videoFile)
      onFileSelected(videoFile)
    } catch (error) {
      console.error('Error generating video preview:', error)
      // Still proceed with file upload even if preview fails
      const videoFile: VideoFile = {
        file,
        id: Date.now().toString(),
        name: file.name,
        size: file.size
      }
      setFilePreview(videoFile)
      onFileSelected(videoFile)
    }
  }

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [])

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  // Open file dialog
  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-4">
      {/* File Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
          ${isDragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
          }
          ${isUploading ? 'pointer-events-none opacity-75' : 'cursor-pointer'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="space-y-4">
          <div className="text-4xl text-gray-400">
            {isUploading ? (
              <div className="flex justify-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              '🎬'
            )}
          </div>

          {isUploading ? (
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-700">
                Uploading and processing...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">
                {uploadProgress}% complete
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-700">
                Drop your video file here
              </p>
              <p className="text-sm text-gray-500">
                or click to browse
              </p>
              <p className="text-xs text-gray-400">
                Supports {acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')} • Max {formatFileSize(maxSize)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-center gap-2 text-red-800">
            <span className="text-lg">⚠️</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* File Preview */}
      {filePreview && !isUploading && (
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-start gap-4">
            {filePreview.thumbnail ? (
              <img 
                src={filePreview.thumbnail} 
                alt="Video thumbnail"
                className="w-20 h-15 object-cover rounded-lg shadow-sm"
              />
            ) : (
              <div className="w-20 h-15 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-gray-400 text-lg">🎬</span>
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-blue-900 truncate">
                {filePreview.name}
              </h4>
              <div className="mt-1 space-y-1 text-xs text-blue-700">
                <p>Size: {formatFileSize(filePreview.size)}</p>
                {filePreview.duration && (
                  <p>Duration: {Math.floor(filePreview.duration / 60)}:{(filePreview.duration % 60).toFixed(0).padStart(2, '0')}</p>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-blue-800">
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                  ✅ Ready to analyze
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoFileUpload