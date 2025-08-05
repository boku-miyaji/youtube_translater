import { detectInputTypeFromUrl, isValidYouTubeUrl, isValidPdfUrl } from '../inputTypeDetection'
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