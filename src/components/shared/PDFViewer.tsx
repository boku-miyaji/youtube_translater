import React, { useRef, forwardRef, useImperativeHandle } from 'react'

interface PDFViewerProps {
  pdfUrl?: string
  title?: string
  pdfContent?: {
    fullText: string
    sections: Array<{
      title: string
      content: string
      pageRange: [number, number]
      type: string
    }>
    pageCount: number
    language: string
  }
}

export interface PDFViewerRef {
  jumpToPage: (page: number) => void
}

const PDFViewer = forwardRef<PDFViewerRef, PDFViewerProps>(({ pdfUrl, title, pdfContent }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useImperativeHandle(ref, () => ({
    jumpToPage: (page: number) => {
      console.log(`📄 PDFViewer: jumpToPage called with page ${page}`);
      console.log(`📄 PDFViewer: iframeRef.current available:`, !!iframeRef.current);
      console.log(`📄 PDFViewer: pdfUrl:`, pdfUrl);
      
      if (iframeRef.current && pdfUrl) {
        // Use PDF URL fragment to jump to specific page
        const baseUrl = pdfUrl.split('#')[0] // Remove existing fragment
        const newUrl = `${baseUrl}#page=${page}`
        console.log(`📄 PDFViewer: Setting iframe src to: ${newUrl}`);
        iframeRef.current.src = newUrl
        console.log(`📄 PDFViewer: Successfully jumped to page ${page}`)
      } else {
        console.warn('📄 PDFViewer: Cannot jump to page - no PDF URL or iframe ref')
        console.warn('📄 PDFViewer: iframeRef.current:', iframeRef.current);
        console.warn('📄 PDFViewer: pdfUrl:', pdfUrl);
      }
    }
  }), [pdfUrl])
  // If we have a PDF URL, embed the actual PDF (similar to YouTube player)
  if (pdfUrl) {
    return (
      <div className="w-full">
        <div className="card-modern overflow-hidden">
          <div className="aspect-video">
            <iframe
              ref={iframeRef}
              src={pdfUrl}
              title={title || 'PDF Document'}
              className="w-full h-full"
              allowFullScreen
            />
          </div>
          {pdfContent && (
            <div className="p-6 space-y-3">
              <h3 className="text-subheading text-app-primary font-semibold">
                {title || 'PDF Document'}
              </h3>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <span>📄 {pdfContent.pageCount} pages</span>
                <span>🌐 {pdfContent.language}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Fallback to text content display if no URL available
  if (!pdfContent) {
    return (
      <div className="card-modern">
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-center text-gray-500">
            <span className="text-4xl mb-2 block">📄</span>
            <p className="text-sm">No PDF content available</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card-modern">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-subheading text-app-primary font-semibold">PDF Content</h3>
          <span className="text-sm text-gray-500">📄 {pdfContent.pageCount} pages</span>
        </div>
        
        <div className="space-y-6">
          {pdfContent.sections.map((section, index) => (
            <div key={index} className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium text-gray-900 mb-2">
                {section.title}
                <span className="text-xs text-gray-500 ml-2">
                  (Pages {section.pageRange[0]}-{section.pageRange[1]})
                </span>
              </h4>
              <p className="text-gray-700 text-sm whitespace-pre-wrap">
                {section.content.substring(0, 500)}
                {section.content.length > 500 && '...'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

PDFViewer.displayName = 'PDFViewer'

export default PDFViewer