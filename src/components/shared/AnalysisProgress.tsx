import React, { useEffect, useState } from 'react'

interface AnalysisProgressProps {
  isAnalyzing: boolean
  estimatedTime?: {
    transcription: number
    summary: number
    total: number
    formatted: string
  }
}

const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ isAnalyzing, estimatedTime }) => {
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [currentStage, setCurrentStage] = useState<'transcription' | 'summary' | 'complete'>('transcription')
  
  useEffect(() => {
    if (isAnalyzing && !startTime) {
      setStartTime(Date.now())
      setCurrentStage('transcription')
    } else if (!isAnalyzing) {
      setStartTime(null)
      setElapsedTime(0)
      setCurrentStage('transcription')
    }
  }, [isAnalyzing, startTime])
  
  useEffect(() => {
    if (isAnalyzing && startTime && estimatedTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        setElapsedTime(elapsed)
        
        // Update stage based on elapsed time
        if (elapsed < estimatedTime.transcription) {
          setCurrentStage('transcription')
        } else if (elapsed < estimatedTime.total) {
          setCurrentStage('summary')
        } else {
          setCurrentStage('complete')
        }
      }, 100)
      
      return () => clearInterval(interval)
    }
  }, [isAnalyzing, startTime, estimatedTime])
  
  if (!isAnalyzing || !estimatedTime) {
    return null
  }
  
  // Calculate progress percentage
  const calculateProgress = () => {
    if (!estimatedTime) return 0
    
    const totalEstimated = estimatedTime.total
    const progress = Math.min((elapsedTime / totalEstimated) * 100, 95) // Cap at 95% to handle estimation errors
    
    return progress
  }
  
  // Calculate stage-specific progress
  const calculateStageProgress = () => {
    if (!estimatedTime) return 0
    
    if (currentStage === 'transcription') {
      return Math.min((elapsedTime / estimatedTime.transcription) * 100, 100)
    } else if (currentStage === 'summary') {
      const summaryElapsed = elapsedTime - estimatedTime.transcription
      return Math.min((summaryElapsed / estimatedTime.summary) * 100, 100)
    }
    
    return 100
  }
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  const getStageLabel = () => {
    switch (currentStage) {
      case 'transcription':
        return '文字起こし処理中...'
      case 'summary':
        return '要約生成中...'
      case 'complete':
        return '完了処理中...'
    }
  }
  
  const progress = calculateProgress()
  const stageProgress = calculateStageProgress()
  const remainingTime = Math.max(0, estimatedTime.total - elapsedTime)
  
  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
      <div className="bg-white rounded-lg shadow-elevation-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">解析進捗状況</h3>
          <span className="text-xs text-gray-500">
            予想残り時間: {formatTime(remainingTime)}
          </span>
        </div>
        
        {/* Overall Progress */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">全体進捗</span>
            <span className="text-xs font-medium text-gray-900">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        {/* Stage Progress */}
        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">{getStageLabel()}</span>
            <span className="text-xs font-medium text-gray-900">{Math.round(stageProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-300 ease-out"
              style={{ width: `${stageProgress}%` }}
            />
          </div>
        </div>
        
        {/* Stage Indicators */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-1 ${currentStage === 'transcription' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-2 h-2 rounded-full ${currentStage === 'transcription' ? 'bg-blue-600 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-xs">文字起こし</span>
            </div>
            <div className={`flex items-center space-x-1 ${currentStage === 'summary' ? 'text-blue-600' : currentStage === 'complete' ? 'text-gray-600' : 'text-gray-400'}`}>
              <div className={`w-2 h-2 rounded-full ${currentStage === 'summary' ? 'bg-blue-600 animate-pulse' : currentStage === 'complete' ? 'bg-gray-600' : 'bg-gray-400'}`} />
              <span className="text-xs">要約生成</span>
            </div>
          </div>
          <span className="text-xs text-gray-500">
            経過: {formatTime(elapsedTime)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default AnalysisProgress