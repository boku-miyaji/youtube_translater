import React, { useState } from 'react'
import { useCosts } from '../../hooks/useCosts'
import { useHistory } from '../../hooks/useHistory'
import CostChart from '../shared/CostChart'
import PieChart from '../shared/PieChart'
import LineChart from '../shared/LineChart'
import HistogramChart from '../shared/HistogramChart'
import BarChart from '../shared/BarChart'

const AnalysisPage: React.FC = () => {
  const { data: costs, isLoading, error } = useCosts()
  const { data: history } = useHistory()
  const [selectedContentType, setSelectedContentType] = useState<'all' | 'youtube' | 'audio' | 'pdf'>('all')

  const totalCost = costs ? costs.reduce((sum, cost) => sum + (cost.totalCost || 0), 0) : 0
  const thisMonthCosts = costs ? costs.filter(cost => {
    const thisMonth = new Date().getMonth()
    const thisYear = new Date().getFullYear()
    const costDate = new Date(cost.timestamp)
    return costDate.getMonth() === thisMonth && costDate.getFullYear() === thisYear
  }) : []
  const thisMonthTotal = thisMonthCosts.reduce((sum, cost) => sum + (cost.totalCost || 0), 0)

  const modelStats = costs ? costs.reduce((acc: any, cost) => {
    // Extract model from cost data using the correct field name
    const model = cost.gptModel || 'GPT-4o Mini'
    if (!acc[model]) {
      acc[model] = { count: 0, totalCost: 0 }
    }
    acc[model].count += 1
    acc[model].totalCost += cost.totalCost || 0
    return acc
  }, {}) : {}

  // Helper function to determine content type from history entry
  const getContentType = (historyEntry: any): 'youtube' | 'audio' | 'pdf' => {
    // Check if it's PDF based on analysisTime structure (has extraction field)
    if (historyEntry.analysisTime?.extraction !== undefined) {
      return 'pdf'
    }
    // Check if it's audio based on file extension or metadata
    if (historyEntry.originalFilename && 
        /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(historyEntry.originalFilename)) {
      return 'audio'
    }
    // Check method for audio files uploaded
    if (historyEntry.method === 'whisper' && !historyEntry.url) {
      return 'audio'
    }
    // Default to youtube (includes both YouTube URLs and video files)
    return 'youtube'
  }

  // Helper function to get first stage processing name
  const getFirstStageName = (contentType: 'youtube' | 'audio' | 'pdf'): string => {
    switch (contentType) {
      case 'pdf':
        return '文書解析'
      case 'audio':
      case 'youtube':
      default:
        return '文字起こし'
    }
  }

  // Helper function to get first stage processing time
  const getFirstStageTime = (historyEntry: any, contentType: 'youtube' | 'audio' | 'pdf'): number | null => {
    if (!historyEntry.analysisTime) return null
    
    switch (contentType) {
      case 'pdf':
        return historyEntry.analysisTime.extraction || null
      case 'audio':
      case 'youtube':
      default:
        return historyEntry.analysisTime.transcription || null
    }
  }

  // Helper function to normalize processing time based on content type
  const normalizeProcessingTime = (processingTime: number, historyEntry: any, contentType: 'youtube' | 'audio' | 'pdf'): number => {
    switch (contentType) {
      case 'pdf':
        // For PDF, normalize by page count if available, otherwise return absolute time
        const pageCount = historyEntry.metadata?.pdfMetadata?.pageCount || historyEntry.pdfMetadata?.pageCount
        return pageCount ? processingTime / pageCount : processingTime
      case 'audio':
      case 'youtube':
      default:
        // For audio/video, normalize by duration in minutes
        const duration = historyEntry.metadata?.basic?.duration
        return duration ? processingTime / (duration / 60) : processingTime
    }
  }

  // Helper function to get normalization unit
  const getNormalizationUnit = (contentType: 'youtube' | 'audio' | 'pdf'): string => {
    switch (contentType) {
      case 'pdf':
        return 'ページあたり'
      case 'audio':
        return '音声1分あたり'
      case 'youtube':
      default:
        return '動画1分あたり'
    }
  }

  // Filter history based on selected content type
  const getFilteredHistory = () => {
    if (!history) return []
    if (selectedContentType === 'all') return history
    return history.filter(h => getContentType(h) === selectedContentType)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-app-primary">Analysis</h1>
        <p className="mt-2 text-app-secondary">View your usage statistics and cost analysis.</p>
      </div>

      {/* 1. 概要サマリー (Summary Overview) */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-app-primary">📊 概要サマリー</h2>
          <div className="h-px bg-gray-300 flex-1"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-app-info-light rounded-lg">
                <span className="text-2xl">💰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-app-secondary">Total Cost</p>
                <p className="text-2xl font-bold text-app-primary">
                  {isLoading ? '...' : `$${totalCost.toFixed(4)}`}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-app-success-light rounded-lg">
                <span className="text-2xl">📅</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-app-secondary">This Month</p>
                <p className="text-2xl font-bold text-app-primary">
                  {isLoading ? '...' : `$${thisMonthTotal.toFixed(4)}`}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-app-background rounded-lg">
                <span className="text-2xl">🔢</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-app-secondary">Total Requests</p>
                <p className="text-2xl font-bold text-app-primary">
                  {isLoading ? '...' : costs?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. コスト詳細 (Cost Details) */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-app-primary">💰 コスト詳細</h2>
          <div className="h-px bg-gray-300 flex-1"></div>
        </div>

        {/* Cost Trends Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-app-primary mb-4">Cost Trends</h3>
          {isLoading ? (
            <p className="text-app-muted">Loading chart...</p>
          ) : error ? (
            <p className="text-app-error">Error loading cost data</p>
          ) : (
            <CostChart data={costs || []} />
          )}
        </div>

        {/* Cost Analysis Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Detailed Cost Analysis */}
          {costs && costs.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  💸 詳細コスト分析
                  <span className="text-xs text-gray-500">（文字起こし・要約別）</span>
                </h3>
              </div>
              <div className="px-6 py-4 space-y-6">
                {/* 総計セクション */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(() => {
                    const totalCost = costs.reduce((sum, cost) => sum + cost.totalCost, 0)
                    const avgCost = costs.length > 0 ? totalCost / costs.length : 0
                    const todayCosts = costs.filter(c => 
                      new Date(c.timestamp).toDateString() === new Date().toDateString()
                    )
                    const todayTotal = todayCosts.reduce((sum, cost) => sum + cost.totalCost, 0)
                    
                    return (
                      <>
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-700">総コスト</p>
                          <p className="text-2xl font-bold text-gray-900">
                            ${totalCost.toFixed(4)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-700">平均コスト</p>
                          <p className="text-2xl font-bold text-gray-900">
                            ${avgCost.toFixed(4)}
                          </p>
                          <p className="text-xs text-gray-500">per video</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-700">今日の合計</p>
                          <p className="text-2xl font-bold text-blue-600">
                            ${todayTotal.toFixed(4)}
                          </p>
                        </div>
                      </>
                    )
                  })()}
                </div>
                
                {/* 文字起こし・要約別の詳細 */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">処理タイプ別コスト内訳</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(() => {
                      const whisperTotal = costs.reduce((sum, cost) => sum + cost.whisperCost, 0)
                      const gptTotal = costs.reduce((sum, cost) => sum + cost.gptCost, 0)
                      const whisperCount = costs.filter(cost => cost.whisperCost > 0).length
                      const gptCount = costs.filter(cost => cost.gptCost > 0).length
                      
                      return (
                        <>
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-sm font-medium text-red-800">📝 文字起こし (Whisper AI)</h5>
                              <span className="text-xs text-red-600">{whisperCount} 件</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-red-700">合計:</span>
                                <span className="font-semibold text-red-900">${whisperTotal.toFixed(4)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-red-700">平均:</span>
                                <span className="font-medium text-red-800">
                                  ${whisperCount > 0 ? (whisperTotal / whisperCount).toFixed(4) : '0.0000'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-sm font-medium text-blue-800">📋 要約生成 (GPT)</h5>
                              <span className="text-xs text-blue-600">{gptCount} 件</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-blue-700">合計:</span>
                                <span className="font-semibold text-blue-900">${gptTotal.toFixed(4)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-blue-700">平均:</span>
                                <span className="font-medium text-blue-800">
                                  ${gptCount > 0 ? (gptTotal / gptCount).toFixed(4) : '0.0000'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Model Usage Statistics */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Model Usage Statistics</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {isLoading ? (
                <div className="px-6 py-4">
                  <p className="text-gray-500">Loading...</p>
                </div>
              ) : Object.keys(modelStats).length > 0 ? (
                Object.entries(modelStats).map(([model, stats]: [string, any]) => (
                  <div key={model} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{model}</p>
                        <p className="text-sm text-gray-500">{stats.count} requests</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          ${stats.totalCost.toFixed(4)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Avg: ${(stats.totalCost / stats.count).toFixed(4)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-4">
                  <p className="text-gray-500">No usage data available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cost Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost Breakdown Pie Chart */}
          {costs && costs.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              {(() => {
                const whisperTotal = costs.reduce((sum, cost) => sum + cost.whisperCost, 0)
                const gptTotal = costs.reduce((sum, cost) => sum + cost.gptCost, 0)
                
                return (
                  <PieChart
                    title="コスト内訳（文字起こし vs 要約）"
                    data={[
                      {
                        name: '文字起こし (Whisper AI)',
                        value: Math.round(whisperTotal * 10000) / 10000,
                        color: '#ef4444'
                      },
                      {
                        name: '要約生成 (GPT)',
                        value: Math.round(gptTotal * 10000) / 10000,
                        color: '#3b82f6'
                      }
                    ]}
                    size={200}
                    showLegend={true}
                  />
                )
              })()}
            </div>
          )}

          {/* Model Usage Bar Chart */}
          {costs && Object.keys(modelStats).length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <BarChart
                title="AIモデル別使用回数"
                data={Object.entries(modelStats).map(([model, stats]: [string, any]) => ({
                  label: model,
                  value: stats.count
                }))}
                xAxisLabel="モデル"
                yAxisLabel="使用回数"
                color="#8b5cf6"
              />
            </div>
          )}
        </div>

        {/* Cumulative Cost Trend */}
        {costs && costs.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            {(() => {
              // Sort costs by date
              const sortedCosts = [...costs].sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              )
              
              // Calculate cumulative costs
              let cumulative = 0
              const cumulativeData = sortedCosts.map(cost => {
                cumulative += cost.totalCost
                return {
                  date: new Date(cost.timestamp).toLocaleDateString('ja-JP', { 
                    month: 'short', 
                    day: 'numeric' 
                  }),
                  value: Math.round(cumulative * 10000) / 10000
                }
              })
              
              // Get last 30 data points (already sorted by date)
              const recentData = cumulativeData.slice(-30)
              
              return (
                <LineChart
                  title="累積コストの推移"
                  data={recentData}
                  yAxisLabel="累積コスト ($)"
                  color="#ef4444"
                  showArea={true}
                />
              )
            })()}
          </div>
        )}
      </section>

      {/* 3. 動画処理詳細 (Video Processing Details) */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-app-primary">🎬 動画処理詳細</h2>
          <div className="h-px bg-gray-300 flex-1"></div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video Processing Statistics */}
          {history && history.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  📊 動画処理統計
                </h3>
              </div>
              <div className="px-6 py-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">総処理動画数:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {history.length}本
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">今週の処理:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {history.filter(h => 
                        new Date(h.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      ).length}本
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Whisper AI処理:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {history.filter(h => h.method === 'whisper').length}本
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">YouTube字幕処理:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {history.filter(h => h.method === 'subtitle').length}本
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Processing Time Analysis */}
          {history && history.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium text-gray-900">⏱️ 処理時間分析</h3>
                    <span className="text-xs text-gray-500">
                      {selectedContentType === 'all' ? '（全コンテンツタイプ）' : `（${getNormalizationUnit(selectedContentType as any)}の処理時間）`}
                    </span>
                  </div>
                  
                  {/* Content Type Filter Tabs */}
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    {[
                      { key: 'all', label: '全て', icon: '📊' },
                      { key: 'youtube', label: '動画', icon: '🎥' },
                      { key: 'audio', label: '音声', icon: '🎵' },
                      { key: 'pdf', label: 'PDF', icon: '📄' }
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setSelectedContentType(tab.key as any)}
                        className={`px-3 py-1 text-xs font-medium transition-colors ${
                          selectedContentType === tab.key
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {tab.icon} {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="space-y-4">
                  {(() => {
                    const filteredHistory = getFilteredHistory()
                    
                    if (filteredHistory.length === 0) {
                      return (
                        <p className="text-center text-gray-500 py-4">
                          {selectedContentType === 'all' ? '処理時間データがありません' : `${getNormalizationUnit(selectedContentType as any).replace('あたり', '')}の処理時間データがありません`}
                        </p>
                      )
                    }

                    // Calculate processing time statistics with appropriate normalization
                    const processingTimeData = filteredHistory
                      .filter(h => h.analysisTime?.duration || h.analysisTime?.total)
                      .map(h => {
                        const contentType = getContentType(h)
                        const processingTime = h.analysisTime!.duration || h.analysisTime!.total
                        return normalizeProcessingTime(processingTime, h, contentType)
                      })
                      .filter(time => time > 0)
                    
                    const avgTimePerUnit = processingTimeData.length > 0 ? 
                      processingTimeData.reduce((a, b) => a + b, 0) / processingTimeData.length : 0
                    const minTimePerUnit = processingTimeData.length > 0 ? Math.min(...processingTimeData) : 0
                    const maxTimePerUnit = processingTimeData.length > 0 ? Math.max(...processingTimeData) : 0
                    
                    // Calculate first stage processing time (transcription/extraction)
                    const firstStageData = filteredHistory
                      .map(h => {
                        const contentType = getContentType(h)
                        const firstStageTime = getFirstStageTime(h, contentType)
                        return firstStageTime ? normalizeProcessingTime(firstStageTime, h, contentType) : null
                      })
                      .filter(time => time !== null && time > 0) as number[]
                    
                    const avgFirstStagePerUnit = firstStageData.length > 0 ? 
                      firstStageData.reduce((a, b) => a + b, 0) / firstStageData.length : 0
                    const minFirstStagePerUnit = firstStageData.length > 0 ? Math.min(...firstStageData) : 0
                    const maxFirstStagePerUnit = firstStageData.length > 0 ? Math.max(...firstStageData) : 0
                    
                    // Calculate summary time
                    const summaryData = filteredHistory
                      .map(h => {
                        const contentType = getContentType(h)
                        const summaryTime = h.analysisTime?.summary
                        return summaryTime ? normalizeProcessingTime(summaryTime, h, contentType) : null
                      })
                      .filter(time => time !== null && time > 0) as number[]
                    
                    const avgSummaryPerUnit = summaryData.length > 0 ? 
                      summaryData.reduce((a, b) => a + b, 0) / summaryData.length : 0
                    const minSummaryPerUnit = summaryData.length > 0 ? Math.min(...summaryData) : 0
                    const maxSummaryPerUnit = summaryData.length > 0 ? Math.max(...summaryData) : 0
                    
                    // Get appropriate first stage name
                    const firstStageName = selectedContentType === 'all' ? '第一段階処理' : 
                      getFirstStageName(selectedContentType === 'pdf' ? 'pdf' : 
                                      selectedContentType === 'audio' ? 'audio' : 'youtube')
                    
                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">合計処理時間（平均）:</span>
                          <span className="text-sm font-bold text-blue-600">
                            {avgTimePerUnit > 0 ? `${avgTimePerUnit.toFixed(1)}秒` : '―'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">合計処理時間（最短）:</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {minTimePerUnit > 0 ? `${minTimePerUnit.toFixed(1)}秒` : '―'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">合計処理時間（最長）:</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {maxTimePerUnit > 0 ? `${maxTimePerUnit.toFixed(1)}秒` : '―'}
                          </span>
                        </div>
                        <div className="border-t border-gray-200 pt-2 mt-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-indigo-700">{firstStageName}（平均）:</span>
                            <span className="text-sm font-bold text-indigo-600">
                              {avgFirstStagePerUnit > 0 ? `${avgFirstStagePerUnit.toFixed(1)}秒` : '―'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-indigo-700">{firstStageName}（最短）:</span>
                            <span className="text-sm font-semibold text-indigo-500">
                              {minFirstStagePerUnit > 0 ? `${minFirstStagePerUnit.toFixed(1)}秒` : '―'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-indigo-700">{firstStageName}（最長）:</span>
                            <span className="text-sm font-semibold text-indigo-500">
                              {maxFirstStagePerUnit > 0 ? `${maxFirstStagePerUnit.toFixed(1)}秒` : '―'}
                            </span>
                          </div>
                        </div>
                        <div className="border-t border-gray-200 pt-2 mt-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-green-700">要約生成（平均）:</span>
                            <span className="text-sm font-bold text-green-600">
                              {avgSummaryPerUnit > 0 ? `${avgSummaryPerUnit.toFixed(1)}秒` : '―'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-green-700">要約生成（最短）:</span>
                            <span className="text-sm font-semibold text-green-500">
                              {minSummaryPerUnit > 0 ? `${minSummaryPerUnit.toFixed(1)}秒` : '―'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-green-700">要約生成（最長）:</span>
                            <span className="text-sm font-semibold text-green-500">
                              {maxSummaryPerUnit > 0 ? `${maxSummaryPerUnit.toFixed(1)}秒` : '―'}
                            </span>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Processing Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Processing Method Distribution */}
          {history && history.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <PieChart
                title="処理方法の内訳"
                data={[
                  {
                    name: 'Whisper AI',
                    value: history.filter(h => h.method === 'whisper').length,
                    color: '#3b82f6'
                  },
                  {
                    name: 'YouTube字幕',
                    value: history.filter(h => h.method === 'subtitle').length,
                    color: '#10b981'
                  }
                ]}
                size={250}
              />
            </div>
          )}

          {/* Processing Time Distribution (Normalized) */}
          {history && history.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              {(() => {
                const filteredHistory = getFilteredHistory()
                const normalizedProcessingTimes = filteredHistory
                  .filter(h => h.analysisTime?.duration || h.analysisTime?.total)
                  .map(h => {
                    const contentType = getContentType(h)
                    const processingTime = h.analysisTime!.duration || h.analysisTime!.total
                    return normalizeProcessingTime(processingTime, h, contentType)
                  })
                  .filter(time => time > 0)
                
                const unit = selectedContentType === 'all' ? 'ユニット' : 
                           getNormalizationUnit(selectedContentType as any).replace('の処理時間', '')
                
                return normalizedProcessingTimes.length > 0 ? (
                  <HistogramChart
                    title={`処理時間の分布（${unit}あたり）`}
                    data={normalizedProcessingTimes}
                    bins={6}
                    xAxisLabel={`${unit}あたりの処理時間（秒）`}
                    yAxisLabel="頻度"
                    color="#f59e0b"
                  />
                ) : (
                  <p className="text-center text-gray-500">
                    {selectedContentType === 'all' ? '処理時間データがありません' : 
                     `${unit.replace('あたり', '')}の処理時間データがありません`}
                  </p>
                )
              })()}
            </div>
          )}
        </div>

        {/* Processing Trends */}
        <div className="space-y-6">
          {/* Daily Processing Trend */}
          {history && history.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              {(() => {
                // Sort history by timestamp first (oldest to newest)
                const sortedHistory = [...history].sort((a, b) => 
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                )

                // Group by date
                const dailyData = sortedHistory.reduce((acc: any, item) => {
                  const date = new Date(item.timestamp).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
                  acc[date] = (acc[date] || 0) + 1
                  return acc
                }, {})

                // Convert to array and maintain chronological order
                const sortedData = Object.entries(dailyData)
                  .map(([date, count]) => ({ date, value: count as number }))
                  .slice(-14) // Last 14 days

                return (
                  <LineChart
                    title="日別処理動画数の推移"
                    data={sortedData}
                    yAxisLabel="処理数"
                    color="#6366f1"
                    showArea={true}
                  />
                )
              })()}
            </div>
          )}

          {/* Weekly Processing Volume */}
          {history && history.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              {(() => {
                // Group by week
                const weeklyData: { label: string; value: number; timestamp: number }[] = []
                const now = new Date()
                
                for (let i = 7; i >= 0; i--) { // Start from oldest week (7 weeks ago) to newest
                  const weekStart = new Date(now)
                  weekStart.setDate(now.getDate() - i * 7)
                  weekStart.setHours(0, 0, 0, 0)
                  
                  const weekEnd = new Date(weekStart)
                  weekEnd.setDate(weekStart.getDate() + 7)
                  
                  const weekLabel = `${(weekStart.getMonth() + 1)}/${weekStart.getDate()}`
                  
                  const count = history.filter(h => {
                    const timestamp = new Date(h.timestamp)
                    return timestamp >= weekStart && timestamp < weekEnd
                  }).length
                  
                  weeklyData.push({
                    label: weekLabel,
                    value: count,
                    timestamp: weekStart.getTime()
                  })
                }
                
                const data = weeklyData.map(item => ({ label: item.label, value: item.value }))
                
                return (
                  <BarChart
                    title="週間処理動画数"
                    data={data}
                    xAxisLabel="週開始日"
                    yAxisLabel="処理数"
                    color="#10b981"
                  />
                )
              })()}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default AnalysisPage