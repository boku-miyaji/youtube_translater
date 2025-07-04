import React, { useRef, useEffect } from 'react'
import { VideoMetadata } from '../../types'

interface VideoPlayerProps {
  video: VideoMetadata
  onPlayerReady?: (player: any) => void
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, onPlayerReady }) => {
  const playerRef = useRef<any>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Format duration from seconds to readable format
  const formatDuration = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return 'Unknown'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // Format view count
  const formatViewCount = (count: number): string => {
    if (!count || isNaN(count)) return 'Unknown'
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M views`
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K views`
    }
    return `${count.toLocaleString()} views`
  }

  useEffect(() => {
    // YouTube Player API initialization
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

    // @ts-ignore
    window.onYouTubeIframeAPIReady = () => {
      if (iframeRef.current && video.basic?.videoId) {
        // @ts-ignore
        playerRef.current = new window.YT.Player(iframeRef.current, {
          events: {
            onReady: () => {
              if (onPlayerReady && playerRef.current) {
                onPlayerReady(playerRef.current)
              }
            }
          }
        })
      }
    }

    return () => {
      // @ts-ignore
      delete window.onYouTubeIframeAPIReady
    }
  }, [video.basic?.videoId, onPlayerReady])
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Video Player</h2>
      
      {video.basic?.videoId && (
        <div className="aspect-w-16 aspect-h-9 mb-4">
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${video.basic.videoId}?enablejsapi=1`}
            title={video.basic.title || 'YouTube Video'}
            className="w-full h-64 rounded-lg"
            allowFullScreen
          />
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900 text-lg">{video.basic?.title || 'Unknown Title'}</h3>
        
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <span className="text-gray-400">⏱</span>
            <span>{formatDuration(video.basic?.duration || 0)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">📺</span>
            <span>{video.basic?.channel || 'Unknown Channel'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">👁</span>
            <span>{formatViewCount(video.basic?.viewCount || 0)}</span>
          </div>
          {video.basic?.likes && (
            <div className="flex items-center gap-1">
              <span className="text-gray-400">👍</span>
              <span>{video.basic.likes.toLocaleString()}</span>
            </div>
          )}
        </div>

        {video.basic?.uploadDate && (
          <p className="text-xs text-gray-500">
            Uploaded: {new Date(video.basic.uploadDate).toLocaleDateString()}
          </p>
        )}

        {video.basic?.description && (
          <details className="text-sm text-gray-600">
            <summary className="cursor-pointer hover:text-gray-800 font-medium">
              Description
            </summary>
            <p className="mt-2 whitespace-pre-wrap">{video.basic.description}</p>
          </details>
        )}

        {video.chapters && video.chapters.length > 0 && (
          <details className="text-sm text-gray-600">
            <summary className="cursor-pointer hover:text-gray-800 font-medium">
              Chapters ({video.chapters.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {video.chapters.map((chapter, index) => (
                <li key={index} className="flex gap-2">
                  <span className="font-mono text-xs">{chapter.timestamp}</span>
                  <span>{chapter.title}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {video.stats?.keywords && video.stats.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {video.stats.keywords.slice(0, 5).map((keyword, index) => (
              <span
                key={index}
                className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
              >
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default VideoPlayer