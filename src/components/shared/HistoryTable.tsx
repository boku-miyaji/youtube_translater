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

  // Format duration from seconds to HH:MM:SS or MM:SS
  const formatDuration = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return 'Unknown'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // Format analysis date with detailed timestamp
  const formatAnalysisDate = (timestamp: string): string => {
    if (!timestamp) return 'Unknown'
    
    const date = new Date(timestamp)
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }
    
    return date.toLocaleString('ja-JP', options)
  }

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
    
    // Ensure summary is always a string with comprehensive extraction
    let summary = ''
    
    // Priority 1: object with content field (most common for historical videos)
    if (video.summary?.content && typeof video.summary.content === 'string') {
      summary = video.summary.content
    } 
    // Priority 2: direct string value
    else if (typeof video.summary === 'string') {
      summary = video.summary
    } 
    // Priority 3: object with content field (backup conversion)
    else if (video.summary && typeof video.summary === 'object' && video.summary.content) {
      // Handle cases where content might be nested or need conversion
      const content = video.summary.content
      if (typeof content === 'string') {
        summary = content
      } else if (typeof content === 'object' && content.content) {
        summary = String(content.content)
      } else {
        summary = String(content)
      }
    }
    // Priority 4: try to extract from metadata if available
    else if (video.metadata?.summary) {
      if (typeof video.metadata.summary === 'string') {
        summary = video.metadata.summary
      } else if (video.metadata.summary.content) {
        summary = String(video.metadata.summary.content)
      }
    }
    
    const timestampedSegments = video.timestampedSegments || video.metadata?.timestampedSegments || []
    
    console.log('🏛️ HistoryTable: Extracted data:')
    console.log('  - transcript source:', video.transcript ? 'direct' : video.metadata?.transcript ? 'metadata' : 'none')
    console.log('  - transcript length:', transcript ? transcript.length : 0)
    console.log('  - transcript preview:', transcript ? transcript.substring(0, 100) + '...' : 'EMPTY')
    console.log('  - summary source:', video.summary?.content ? 'summary.content' : video.summary ? 'direct' : 'none')
    console.log('  - summary length:', summary ? summary.length : 0)
    console.log('  - summary preview:', summary ? summary.substring(0, 100) + '...' : 'EMPTY')
    console.log('  - timestampedSegments source:', video.timestampedSegments ? 'direct' : video.metadata?.timestampedSegments ? 'metadata' : 'none')
    console.log('  - timestampedSegments count:', timestampedSegments ? timestampedSegments.length : 0)
    
    // Additional debugging for summary structure
    console.log('🔍 Summary structure analysis:')
    console.log('  - video.summary type:', typeof video.summary)
    console.log('  - video.summary keys:', video.summary && typeof video.summary === 'object' ? Object.keys(video.summary) : 'NOT_OBJECT')
    console.log('  - video.summary.content type:', video.summary?.content ? typeof video.summary.content : 'MISSING')
    console.log('  - video.summary.content length:', video.summary?.content ? 
      (typeof video.summary.content === 'string' ? video.summary.content.length : 'NOT_STRING') : 'MISSING')
    
    // Calculate detailed costs from history data
    const pricing = { whisper: 0.006 }; // $0.006 per minute
    let transcriptionCost = 0;
    let summaryCost = 0;
    let articleCost = 0;

    // Calculate transcription cost
    if (video.method === 'whisper' && video.metadata?.basic?.duration) {
      const durationMinutes = Math.ceil(video.metadata.basic.duration / 60);
      transcriptionCost = durationMinutes * pricing.whisper;
    }

    // Get summary cost
    if (video.summary?.cost) {
      summaryCost = video.summary.cost;
    } else if (video.method === 'whisper' && video.cost) {
      // Fallback: use entry.cost as summary cost for old data
      summaryCost = video.cost;
    }

    const detailedCosts = {
      transcription: transcriptionCost,
      summary: summaryCost,
      article: articleCost,
      total: transcriptionCost + summaryCost + articleCost
    };

    console.log('🏛️ HistoryTable: Calculated costs:', detailedCosts);
    
    // Set current video with complete data including summary, costs, and analysis time
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
      timestampedSegments: timestampedSegments,
      transcriptSource: video.method,
      costs: detailedCosts,
      analysisTime: video.analysisTime
    }
    
    console.log('🏛️ HistoryTable: Final constructed videoData:', {
      ...videoData,
      transcript: `${transcript ? 'PRESENT' : 'MISSING'} (${transcript?.length || 0} chars)`,
      summary: `${summary ? 'PRESENT' : 'MISSING'} (${summary?.length || 0} chars)`,
      timestampedSegments: `${timestampedSegments?.length || 0} segments`,
      analysisTime: video.analysisTime ? 'PRESENT' : 'MISSING'
    })
    
    // Critical debugging - what will be passed to ChatInterface
    console.log('📤 Data to be passed to ChatInterface:')
    console.log('  - videoData.transcript:', videoData.transcript ? {
      type: typeof videoData.transcript,
      length: videoData.transcript.length,
      preview: videoData.transcript.substring(0, 100) + '...'
    } : 'MISSING')
    console.log('  - videoData.summary:', videoData.summary ? {
      type: typeof videoData.summary,
      length: videoData.summary.length,
      preview: videoData.summary.substring(0, 100) + '...'
    } : 'MISSING')
    
    console.log('🕒 HistoryTable: Analysis time data:', video.analysisTime)
    
    console.log('🏛️ HistoryTable: Calling setCurrentVideo...')
    setCurrentVideo(videoData)
    
    console.log('🏛️ HistoryTable: Navigating to /analyze...')
    navigate('/analyze')
    
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
              Analysis Date
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
              <tr 
                key={index} 
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleViewVideo(item)}
              >
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
                              parent.innerHTML = '<span class="text-app-primary text-sm">🎬</span>';
                            }
                          }}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-app-background flex items-center justify-center">
                          <span className="text-app-primary text-sm">🎬</span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4 min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {item.title || item.metadata?.basic?.title || 'Unknown Title'}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        📺 {item.metadata?.basic?.channel || 'Unknown Channel'}
                      </div>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <div className="flex items-center">
                          <span className="mr-1">⏱️</span>
                          <span className="font-medium">{formatDuration(item.metadata?.basic?.duration || item.duration)}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="mr-1">📅</span>
                          <span className="font-medium">{formatAnalysisDate(item.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDuration(item.metadata?.basic?.duration || item.duration)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex flex-col">
                    <span className="font-medium">{formatAnalysisDate(item.timestamp)}</span>
                    <span className="text-xs text-gray-500">
                      {item.timestamp ? `(${new Date(item.timestamp).toLocaleDateString()})` : ''}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-app-background text-app-primary">
                    👁️ View Results
                  </span>
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