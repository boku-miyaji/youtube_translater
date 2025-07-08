import React, { useRef, useEffect } from 'react'
import { VideoMetadata } from '../../types'

interface VideoPlayerProps {
  video: VideoMetadata
  onPlayerReady?: (player: any) => void
  onSeek?: (time: number) => void
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, onPlayerReady, onSeek }) => {
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

  // Expose seek function
  const seekTo = (time: number, autoplay: boolean = true) => {
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(time, true)
      if (autoplay && playerRef.current.getPlayerState() !== 1) {
        playerRef.current.playVideo()
      }
    }
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
                // Add seekTo method to the player reference
                playerRef.current.seekToWithAutoplay = seekTo
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
    <div className="w-full h-full flex flex-col">
      {video.basic?.videoId && (
        <div className="relative w-full h-full">
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${video.basic.videoId}?enablejsapi=1`}
            title={video.basic.title || 'YouTube Video'}
            className="absolute inset-0 w-full h-full rounded-lg"
            allowFullScreen
          />
        </div>
      )}

      <div className="p-6 space-y-3 flex-shrink-0">
        <h3 className="text-subheading text-app-primary font-semibold">{video.basic?.title || 'Unknown Title'}</h3>
        
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">⏱</span>
            <span className="text-tabular">{formatDuration(video.basic?.duration || 0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">📺</span>
            <span className="truncate max-w-32">{video.basic?.channel || 'Unknown Channel'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">👁</span>
            <span className="text-tabular">{formatViewCount(video.basic?.viewCount || 0)}</span>
          </div>
          {video.basic?.likes && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">👍</span>
              <span className="text-tabular">{video.basic.likes.toLocaleString()}</span>
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
            <summary className="cursor-pointer hover:text-gray-800 font-medium py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
              📝 Description
            </summary>
            <div className="mt-2 p-3 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
              <p className="whitespace-pre-wrap text-body">{video.basic.description}</p>
            </div>
          </details>
        )}

        {video.chapters && video.chapters.length > 0 && (
          <details className="text-sm text-gray-600">
            <summary className="cursor-pointer hover:text-gray-800 font-medium py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
              📑 Chapters ({video.chapters.length})
            </summary>
            <div className="mt-2 p-3 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
              <ul className="space-y-2">
                {video.chapters.map((chapter, index) => (
                  <li key={index} className="flex gap-3 items-start">
                    <span className="font-mono text-xs bg-white px-2 py-1 rounded border text-indigo-600 font-semibold min-w-fit">
                      {chapter.timestamp}
                    </span>
                    <span className="text-body">{chapter.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}

        {video.stats?.keywords && video.stats.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {video.stats.keywords.slice(0, 5).map((keyword, index) => (
              <span
                key={index}
                className="inline-block px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-200 transition-colors hover:bg-blue-100"
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