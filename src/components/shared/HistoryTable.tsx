import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'

interface HistoryTableProps {
  data: any[]
  sortBy: string
}

const HistoryTable: React.FC<HistoryTableProps> = ({ data, sortBy }) => {
  const { setCurrentVideo } = useAppStore()
  const navigate = useNavigate()

  const sortedData = [...data].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return (a.title || '').localeCompare(b.title || '')
      case 'duration':
        return (a.duration || 0) - (b.duration || 0)
      case 'timestamp':
      default:
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    }
  })

  const handleViewVideo = (video: any) => {
    console.log('🏛️ HistoryTable: CLICK EVENT TRIGGERED')
    console.log('🏛️ HistoryTable: Raw video data:', video)
    console.log('🏛️ HistoryTable: Video structure keys:', Object.keys(video))
    console.log('🏛️ HistoryTable: Video metadata structure:', video.metadata ? Object.keys(video.metadata) : 'No metadata')
    
    // Handle both HistoryEntry and direct video data structures
    const transcript = video.transcript || video.metadata?.transcript || ''
    const summary = video.summary?.content || video.summary || ''
    const timestampedSegments = video.timestampedSegments || video.metadata?.timestampedSegments || []
    
    console.log('🏛️ HistoryTable: Extracted data:')
    console.log('  - transcript source:', video.transcript ? 'direct' : video.metadata?.transcript ? 'metadata' : 'none')
    console.log('  - summary source:', video.summary?.content ? 'summary.content' : video.summary ? 'direct' : 'none')
    console.log('  - timestampedSegments source:', video.timestampedSegments ? 'direct' : video.metadata?.timestampedSegments ? 'metadata' : 'none')
    
    // Set current video with complete data including summary
    const videoData = {
      basic: {
        title: video.title || video.metadata?.basic?.title || 'Unknown Title',
        videoId: video.videoId || video.id || video.metadata?.basic?.videoId || '',
        duration: video.metadata?.basic?.duration || video.duration || 0,
        channel: video.metadata?.basic?.channel || 'Unknown',
        viewCount: video.metadata?.basic?.viewCount || 0,
        likes: video.metadata?.basic?.likes || 0,
        uploadDate: video.metadata?.basic?.uploadDate || '',
        publishDate: video.metadata?.basic?.publishDate || '',
        category: video.metadata?.basic?.category || '',
        description: video.metadata?.basic?.description || '',
        thumbnail: video.thumbnail || video.metadata?.basic?.thumbnail
      },
      chapters: video.metadata?.chapters || [],
      captions: video.metadata?.captions || [],
      stats: video.metadata?.stats || {
        formatCount: 0,
        hasSubtitles: false,
        keywords: []
      },
      transcript: transcript,
      summary: summary,
      timestampedSegments: timestampedSegments
    }
    
    console.log('🏛️ HistoryTable: Final constructed videoData:', {
      ...videoData,
      transcript: `${transcript ? 'PRESENT' : 'MISSING'} (${transcript?.length || 0} chars)`,
      summary: `${summary ? 'PRESENT' : 'MISSING'} (${summary?.length || 0} chars)`,
      timestampedSegments: `${timestampedSegments?.length || 0} segments`
    })
    
    console.log('🏛️ HistoryTable: Calling setCurrentVideo...')
    setCurrentVideo(videoData)
    
    console.log('🏛️ HistoryTable: Navigating to /upload...')
    navigate('/upload')
    
    console.log('🏛️ HistoryTable: CLICK EVENT COMPLETE')
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Video
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Duration
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                No history available
              </td>
            </tr>
          ) : (
            sortedData.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      {(item.thumbnail || item.metadata?.basic?.thumbnail || item.videoId || item.id || item.metadata?.basic?.videoId) ? (
                        <img
                          className="h-10 w-10 rounded object-cover"
                          src={item.thumbnail || item.metadata?.basic?.thumbnail || `https://img.youtube.com/vi/${item.videoId || item.id || item.metadata?.basic?.videoId}/mqdefault.jpg`}
                          alt={item.title || 'Video thumbnail'}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const currentSrc = target.src;
                            const videoId = item.videoId || item.id || item.metadata?.basic?.videoId;
                            
                            if (videoId && currentSrc.includes('mqdefault')) {
                              target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                              return;
                            }
                            if (videoId && currentSrc.includes('hqdefault')) {
                              target.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                              return;
                            }
                            
                            // Final fallback to icon
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.className = 'h-10 w-10 rounded bg-app-background flex items-center justify-center';
                              parent.innerHTML = '<span class="text-indigo-600 text-sm">🎬</span>';
                            }
                          }}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-app-background flex items-center justify-center">
                          <span className="text-indigo-600 text-sm">🎬</span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {item.title || item.metadata?.basic?.title || 'Unknown Title'}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {item.metadata?.basic?.videoId || 'Unknown'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.duration || 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleViewVideo(item)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default HistoryTable