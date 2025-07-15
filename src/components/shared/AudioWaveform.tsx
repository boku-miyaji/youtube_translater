import React from 'react'

interface AudioWaveformProps {
  audioUrl?: string
  duration?: number
  currentTime?: number
  onSeek?: (time: number) => void
}

const AudioWaveform: React.FC<AudioWaveformProps> = ({ 
  audioUrl, 
  duration = 0, 
  currentTime = 0,
  onSeek 
}) => {
  return (
    <div className="bg-gray-100 rounded-lg p-4 h-32 flex items-center justify-center">
      <div className="text-center text-gray-500">
        <span className="text-3xl mb-2 block">🎵</span>
        <p className="text-sm">Audio waveform visualization coming soon</p>
        {duration > 0 && (
          <p className="text-xs mt-1">Duration: {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}</p>
        )}
      </div>
    </div>
  )
}

export default AudioWaveform