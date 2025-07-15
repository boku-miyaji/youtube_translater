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
  
  // Debug logging
  console.log('🔍 AnalysisProgress - Props:', {
    isAnalyzing,
    estimatedTime,
    hasEstimatedTime: !!estimatedTime,
    estimatedTimeDetails: estimatedTime ? {
      transcription: estimatedTime.transcription,
      summary: estimatedTime.summary,
      total: estimatedTime.total,
      formatted: estimatedTime.formatted
    } : null
  })
  
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-30" />
      
      {/* Progress content */}
      <div className="relative w-full max-w-2xl mx-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-300 shadow-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-blue-900 flex items-center gap-3">
            <span className="text-3xl animate-pulse">📊</span>
            解析進捗状況
          </h3>
          <div className="text-right">
            <div className="text-lg font-bold text-blue-800 bg-white px-4 py-2 rounded-lg shadow-md">
              残り時間: <span className="text-xl">{formatTime(remainingTime)}</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              推定合計時間: {estimatedTime.formatted}
            </div>
          </div>
        </div>
        
        {/* Overall Progress */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">全体進捗</span>
            <span className="text-lg font-bold text-blue-700">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 ease-out rounded-full shadow-sm"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        {/* Stage Progress */}
        <div className="mb-4 bg-white/70 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">{getStageLabel()}</span>
            <span className="text-sm font-bold text-green-600">{Math.round(stageProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${stageProgress}%` }}
            />
          </div>
        </div>
        
        {/* Stage Indicators */}
        <div className="flex items-center justify-between bg-white/50 rounded-lg p-3">
          <div className="flex items-center space-x-6">
            <div className={`flex items-center space-x-2 ${currentStage === 'transcription' ? 'text-blue-700 font-bold' : 'text-gray-500'}`}>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${currentStage === 'transcription' ? 'bg-blue-600' : currentStage === 'complete' ? 'bg-green-500' : 'bg-gray-300'}`}>
                {currentStage === 'transcription' && (
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                )}
                {currentStage === 'complete' && '✓'}
              </div>
              <span className="text-sm">文字起こし</span>
            </div>
            <div className="text-gray-300">→</div>
            <div className={`flex items-center space-x-2 ${currentStage === 'summary' ? 'text-blue-700 font-bold' : currentStage === 'complete' ? 'text-gray-600' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${currentStage === 'summary' ? 'bg-blue-600' : currentStage === 'complete' ? 'bg-green-500' : 'bg-gray-300'}`}>
                {currentStage === 'summary' && (
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                )}
                {currentStage === 'complete' && '✓'}
              </div>
              <span className="text-sm">要約生成</span>
            </div>
          </div>
          <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
            経過: {formatTime(elapsedTime)}
          </span>
        </div>
      </div>
      </div>
    </div>
  )
}

export default AnalysisProgress