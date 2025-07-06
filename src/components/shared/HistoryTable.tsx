import React from 'react'
import { useAppStore } from '../../store/appStore'

interface HistoryTableProps {
  data: any[]
  sortBy: string
}

const HistoryTable: React.FC<HistoryTableProps> = ({ data, sortBy }) => {
  const { setCurrentVideo } = useAppStore()

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
    // Set current video with complete data including summary
    setCurrentVideo({
      basic: {
        title: video.title || video.metadata?.basic?.title,
        videoId: video.videoId || video.id || video.metadata?.basic?.videoId,
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
      transcript: video.transcript,
      summary: video.summary, // Include existing summary
      timestampedSegments: video.timestampedSegments || []
    })
    // Navigate to upload page to show the historical video with all content
    window.location.hash = '/upload'
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
                              parent.className = 'h-10 w-10 rounded bg-indigo-100 flex items-center justify-center';
                              parent.innerHTML = '<span class="text-indigo-600 text-sm">🎬</span>';
                            }
                          }}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-indigo-100 flex items-center justify-center">
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