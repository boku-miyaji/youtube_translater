import { detectInputTypeFromUrl, detectInputTypeFromUrlWithConfidence, isValidYouTubeUrl, isValidPdfUrl } from '../inputTypeDetection'
import { InputType } from '../../types'

describe('Input Type Detection', () => {
  describe('detectInputTypeFromUrl', () => {
    it('should detect YouTube URLs correctly', () => {
      const youtubeUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'www.youtube.com/watch?v=abc123',
        'youtube.com/watch?v=xyz789',
        'https://youtube.com/embed/test123'
      ]

      youtubeUrls.forEach(url => {
        expect(detectInputTypeFromUrl(url)).toBe(InputType.YOUTUBE_URL)
      })
    })

    it('should detect PDF URLs correctly', () => {
      const pdfUrls = [
        'https://arxiv.org/pdf/2301.12345.pdf',
        'https://example.com/document.pdf',
        'https://site.com/download/paper.pdf?auth=token',
        'https://repository.com/pdf/research-paper.pdf#page=1'
      ]

      pdfUrls.forEach(url => {
        expect(detectInputTypeFromUrl(url)).toBe(InputType.PDF_URL)
      })
    })

    it('should detect audio file URLs correctly', () => {
      const audioUrls = [
        'https://example.com/podcast.mp3',
        'https://cdn.site.com/audio.wav',
        'https://music.com/song.m4a',
        'https://audio.org/file.ogg',
        'https://example.com/track.flac?id=123'
      ]

      audioUrls.forEach(url => {
        expect(detectInputTypeFromUrl(url)).toBe(InputType.YOUTUBE_URL) // Maps to YOUTUBE_URL for backend processing
      })
    })

    it('should detect video file URLs correctly', () => {
      const videoUrls = [
        'https://example.com/video.mp4',
        'https://cdn.site.com/movie.webm',
        'https://video.org/clip.avi',
        'https://media.com/recording.mov',
        'https://example.com/file.mkv?quality=hd'
      ]

      videoUrls.forEach(url => {
        expect(detectInputTypeFromUrl(url)).toBe(InputType.YOUTUBE_URL) // Maps to YOUTUBE_URL for backend processing
      })
    })

    it('should default to YouTube URL for unknown URLs', () => {
      const unknownUrls = [
        'https://example.com',
        'https://github.com/repo',
        'ftp://server.com/file'
      ]

      unknownUrls.forEach(url => {
        expect(detectInputTypeFromUrl(url)).toBe(InputType.YOUTUBE_URL)
      })
    })
  })

  describe('detectInputTypeFromUrlWithConfidence', () => {
    it('should detect YouTube URLs with high confidence', () => {
      const result = detectInputTypeFromUrlWithConfidence('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(result.type).toBe(InputType.YOUTUBE_URL)
      expect(result.confidence).toBe('high')
      expect(result.displayName).toBe('YouTube Video')
    })

    it('should detect PDF URLs with high confidence', () => {
      const result = detectInputTypeFromUrlWithConfidence('https://arxiv.org/pdf/2301.12345.pdf')
      expect(result.type).toBe(InputType.PDF_URL)
      expect(result.confidence).toBe('high')
      expect(result.displayName).toBe('PDF Document')
    })

    it('should detect audio URLs with high confidence', () => {
      const result = detectInputTypeFromUrlWithConfidence('https://example.com/podcast.mp3')
      expect(result.type).toBe(InputType.YOUTUBE_URL)
      expect(result.confidence).toBe('high')
      expect(result.displayName).toBe('Audio File')
    })

    it('should detect video URLs with high confidence', () => {
      const result = detectInputTypeFromUrlWithConfidence('https://example.com/video.mp4')
      expect(result.type).toBe(InputType.YOUTUBE_URL)
      expect(result.confidence).toBe('high')
      expect(result.displayName).toBe('Video File')
    })

    it('should return low confidence for unknown URLs', () => {
      const result = detectInputTypeFromUrlWithConfidence('https://example.com/page')
      expect(result.type).toBe(InputType.YOUTUBE_URL)
      expect(result.confidence).toBe('low')
      expect(result.displayName).toBe('URL')
    })
  })
  
  describe('isValidYouTubeUrl', () => {
    it('should validate YouTube URLs correctly', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=test')).toBe(true)
      expect(isValidYouTubeUrl('https://youtu.be/test')).toBe(true)
      expect(isValidYouTubeUrl('www.youtube.com/watch?v=test')).toBe(true)
      expect(isValidYouTubeUrl('https://example.com')).toBe(false)
      expect(isValidYouTubeUrl('not-a-url')).toBe(false)
    })
  })
  
  describe('isValidPdfUrl', () => {
    it('should validate PDF URLs correctly', () => {
      expect(isValidPdfUrl('https://example.com/doc.pdf')).toBe(true)
      expect(isValidPdfUrl('https://arxiv.org/pdf/1234.5678.pdf')).toBe(true)
      expect(isValidPdfUrl('https://site.com/pdf/document')).toBe(true)
      expect(isValidPdfUrl('https://example.com/page')).toBe(false)
      expect(isValidPdfUrl('not-a-url')).toBe(false)
    })
  })
})