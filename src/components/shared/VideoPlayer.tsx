import React from 'react'
import { VideoMetadata } from '../../types'

interface VideoPlayerProps {
  video: VideoMetadata
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ video }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Video Player</h2>
      
      {video.basic?.videoId && (
        <div className="aspect-w-16 aspect-h-9 mb-4">
          <iframe
            src={`https://www.youtube.com/embed/${video.basic.videoId}`}
            title={video.basic.title || 'YouTube Video'}
            className="w-full h-64 rounded-lg"
            allowFullScreen
          />
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-medium text-gray-900">{video.basic?.title || 'Unknown Title'}</h3>
        <p className="text-sm text-gray-600">
          Duration: {video.basic?.duration || 'Unknown'} | 
          Channel: {video.basic?.channel || 'Unknown'} |
          Views: {video.basic?.viewCount ? video.basic.viewCount.toLocaleString() : 'Unknown'}
        </p>
        {video.basic?.description && (
          <p className="text-sm text-gray-600 line-clamp-3">{video.basic.description}</p>
        )}
      </div>
    </div>
  )
}

export default VideoPlayer