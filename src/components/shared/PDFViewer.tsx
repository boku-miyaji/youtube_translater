import React from 'react'

interface PDFViewerProps {
  pdfUrl?: string
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

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl, pdfContent }) => {
  if (!pdfContent) {
    return (
      <div className="bg-gray-100 rounded-lg p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center text-gray-500">
          <span className="text-4xl mb-2 block">📄</span>
          <p className="text-sm">No PDF content available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">PDF Content</h3>
        <span className="text-sm text-gray-500">{pdfContent.pageCount} pages</span>
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
  )
}

export default PDFViewer