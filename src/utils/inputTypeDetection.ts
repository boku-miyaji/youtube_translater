import { InputType } from '../types'

/**
 * Detection result with confidence level
 */
export interface DetectionResult {
  type: InputType
  confidence: 'high' | 'medium' | 'low'
  displayName: string
}

/**
 * URL pattern definitions for different content types
 */
const URL_PATTERNS = {
  youtube: [
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//,
    /^(www\.)?(youtube\.com|youtu\.be)\//,
    /youtube\.com\/watch\?v=/,
    /youtu\.be\//,
    /youtube\.com\/embed\//
  ],
  pdf: [
    /\.pdf(\?|#|$)/i,
    /\/pdf\//i,
    /arxiv\.org\/pdf\//,
    /\/download\/.*\.pdf/i
  ],
  audio: [
    /\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|webm)(\?|#|$)/i
  ],
  video: [
    /\.(mp4|avi|mov|webm|mkv|wmv|flv|m4v|mpg|mpeg)(\?|#|$)/i
  ]
}

/**
 * Detects the input type based on the provided URL
 * @param url The URL to analyze
 * @returns The detected input type
 */
export function detectInputTypeFromUrl(url: string): InputType {
  const result = detectInputTypeFromUrlWithConfidence(url)
  return result.type
}

/**
 * Detects the input type with confidence level based on the provided URL
 * @param url The URL to analyze
 * @returns Detection result with type, confidence, and display name
 */
export function detectInputTypeFromUrlWithConfidence(url: string): DetectionResult {
  const trimmedUrl = url.trim().toLowerCase()

  // Check YouTube patterns (highest priority for video platforms)
  if (URL_PATTERNS.youtube.some(pattern => pattern.test(trimmedUrl))) {
    return {
      type: InputType.YOUTUBE_URL,
      confidence: 'high',
      displayName: 'YouTube Video'
    }
  }

  // Check PDF patterns
  if (URL_PATTERNS.pdf.some(pattern => pattern.test(trimmedUrl))) {
    return {
      type: InputType.PDF_URL,
      confidence: 'high',
      displayName: 'PDF Document'
    }
  }

  // Check audio file patterns
  if (URL_PATTERNS.audio.some(pattern => pattern.test(trimmedUrl))) {
    return {
      type: InputType.YOUTUBE_URL, // Backend will handle audio URL processing
      confidence: 'high',
      displayName: 'Audio File'
    }
  }

  // Check video file patterns
  if (URL_PATTERNS.video.some(pattern => pattern.test(trimmedUrl))) {
    return {
      type: InputType.YOUTUBE_URL, // Backend will handle video URL processing
      confidence: 'high',
      displayName: 'Video File'
    }
  }

  // Default to YouTube URL if no specific pattern matches
  // This maintains backward compatibility
  return {
    type: InputType.YOUTUBE_URL,
    confidence: 'low',
    displayName: 'URL'
  }
}

/**
 * Detects the input type based on file MIME type
 * @param file The file to analyze
 * @returns The detected input type
 */
export function detectInputTypeFromFile(file: File): InputType {
  const mimeType = file.type.toLowerCase()
  const fileName = file.name.toLowerCase()
  
  // Video MIME types
  const videoTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/x-flv'
  ]
  
  // Audio MIME types
  const audioTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
    'audio/flac',
    'audio/x-m4a',
    'audio/mp4'
  ]
  
  // PDF MIME type
  const pdfTypes = [
    'application/pdf',
    'application/x-pdf'
  ]
  
  // Check by MIME type first
  if (videoTypes.includes(mimeType)) {
    return InputType.VIDEO_FILE
  }
  
  if (audioTypes.includes(mimeType)) {
    return InputType.AUDIO_FILE
  }
  
  if (pdfTypes.includes(mimeType)) {
    return InputType.PDF_FILE
  }
  
  // Fallback to file extension if MIME type is not recognized
  if (fileName.endsWith('.mp4') || fileName.endsWith('.webm') || 
      fileName.endsWith('.ogv') || fileName.endsWith('.avi') || 
      fileName.endsWith('.mov') || fileName.endsWith('.mkv') || 
      fileName.endsWith('.flv')) {
    return InputType.VIDEO_FILE
  }
  
  if (fileName.endsWith('.mp3') || fileName.endsWith('.wav') || 
      fileName.endsWith('.ogg') || fileName.endsWith('.flac') || 
      fileName.endsWith('.m4a') || fileName.endsWith('.aac')) {
    return InputType.AUDIO_FILE
  }
  
  if (fileName.endsWith('.pdf')) {
    return InputType.PDF_FILE
  }
  
  // Default to video file if unable to determine
  return InputType.VIDEO_FILE
}

/**
 * Validates if a URL is a valid YouTube URL
 * @param url The URL to validate
 * @returns True if valid YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  const trimmedUrl = url.trim()
  const youtubePatterns = [
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//,
    /^(www\.)?(youtube\.com|youtu\.be)\//
  ]
  
  return youtubePatterns.some(pattern => pattern.test(trimmedUrl))
}

/**
 * Validates if a URL is a valid PDF URL
 * @param url The URL to validate
 * @returns True if valid PDF URL
 */
export function isValidPdfUrl(url: string): boolean {
  const trimmedUrl = url.trim().toLowerCase()
  
  // Must be a valid URL
  try {
    new URL(trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`)
  } catch {
    return false
  }
  
  // Check for PDF indicators
  return trimmedUrl.includes('.pdf') || trimmedUrl.includes('/pdf/')
}