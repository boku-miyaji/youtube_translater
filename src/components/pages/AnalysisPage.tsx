import React from 'react'
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
                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  ⏱️ 処理時間分析
                  <span className="text-xs text-gray-500">（動画1分あたりの処理時間）</span>
                </h3>
              </div>
              <div className="px-6 py-4">
                <div className="space-y-4">
                  {(() => {
                    // Calculate processing time per minute of video
                    const processingTimePerMinute = history
                      .filter(h => h.analysisTime?.duration && h.metadata?.basic?.duration)
                      .map(h => {
                        const processingTime = h.analysisTime!.duration
                        const videoDuration = h.metadata!.basic!.duration
                        return processingTime / (videoDuration / 60) // seconds per minute of video
                      })
                    
                    const avgTimePerMinute = processingTimePerMinute.length > 0 ? 
                      processingTimePerMinute.reduce((a, b) => a + b, 0) / processingTimePerMinute.length : 0
                    const minTimePerMinute = processingTimePerMinute.length > 0 ? Math.min(...processingTimePerMinute) : 0
                    const maxTimePerMinute = processingTimePerMinute.length > 0 ? Math.max(...processingTimePerMinute) : 0
                    
                    // Calculate transcription time per minute of video
                    const transcriptionTimePerMinute = history
                      .filter(h => h.analysisTime?.transcription && h.metadata?.basic?.duration)
                      .map(h => {
                        const transcriptionTime = h.analysisTime!.transcription
                        const videoDuration = h.metadata!.basic!.duration
                        return transcriptionTime / (videoDuration / 60) // seconds per minute of video
                      })
                    
                    const avgTranscriptionPerMinute = transcriptionTimePerMinute.length > 0 ? 
                      transcriptionTimePerMinute.reduce((a, b) => a + b, 0) / transcriptionTimePerMinute.length : 0
                    const minTranscriptionPerMinute = transcriptionTimePerMinute.length > 0 ? 
                      Math.min(...transcriptionTimePerMinute) : 0
                    const maxTranscriptionPerMinute = transcriptionTimePerMinute.length > 0 ? 
                      Math.max(...transcriptionTimePerMinute) : 0
                    
                    // Calculate summary time per minute of video
                    const summaryTimePerMinute = history
                      .filter(h => h.analysisTime?.summary && h.metadata?.basic?.duration)
                      .map(h => {
                        const summaryTime = h.analysisTime!.summary
                        const videoDuration = h.metadata!.basic!.duration
                        return summaryTime / (videoDuration / 60) // seconds per minute of video
                      })
                    
                    const avgSummaryPerMinute = summaryTimePerMinute.length > 0 ? 
                      summaryTimePerMinute.reduce((a, b) => a + b, 0) / summaryTimePerMinute.length : 0
                    const minSummaryPerMinute = summaryTimePerMinute.length > 0 ? 
                      Math.min(...summaryTimePerMinute) : 0
                    const maxSummaryPerMinute = summaryTimePerMinute.length > 0 ? 
                      Math.max(...summaryTimePerMinute) : 0
                    
                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">合計処理時間（平均）:</span>
                          <span className="text-sm font-bold text-blue-600">
                            {avgTimePerMinute > 0 ? `${avgTimePerMinute.toFixed(1)}秒` : '―'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">合計処理時間（最短）:</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {minTimePerMinute > 0 ? `${minTimePerMinute.toFixed(1)}秒` : '―'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">合計処理時間（最長）:</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {maxTimePerMinute > 0 ? `${maxTimePerMinute.toFixed(1)}秒` : '―'}
                          </span>
                        </div>
                        <div className="border-t border-gray-200 pt-2 mt-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-indigo-700">文字起こし（平均）:</span>
                            <span className="text-sm font-bold text-indigo-600">
                              {avgTranscriptionPerMinute > 0 ? `${avgTranscriptionPerMinute.toFixed(1)}秒` : '―'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-indigo-700">文字起こし（最短）:</span>
                            <span className="text-sm font-semibold text-indigo-500">
                              {minTranscriptionPerMinute > 0 ? `${minTranscriptionPerMinute.toFixed(1)}秒` : '―'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-indigo-700">文字起こし（最長）:</span>
                            <span className="text-sm font-semibold text-indigo-500">
                              {maxTranscriptionPerMinute > 0 ? `${maxTranscriptionPerMinute.toFixed(1)}秒` : '―'}
                            </span>
                          </div>
                        </div>
                        <div className="border-t border-gray-200 pt-2 mt-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-green-700">要約生成（平均）:</span>
                            <span className="text-sm font-bold text-green-600">
                              {avgSummaryPerMinute > 0 ? `${avgSummaryPerMinute.toFixed(1)}秒` : '―'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-green-700">要約生成（最短）:</span>
                            <span className="text-sm font-semibold text-green-500">
                              {minSummaryPerMinute > 0 ? `${minSummaryPerMinute.toFixed(1)}秒` : '―'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-green-700">要約生成（最長）:</span>
                            <span className="text-sm font-semibold text-green-500">
                              {maxSummaryPerMinute > 0 ? `${maxSummaryPerMinute.toFixed(1)}秒` : '―'}
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
                const normalizedProcessingTimes = history
                  .filter(h => h.analysisTime?.duration && h.metadata?.basic?.duration)
                  .map(h => {
                    const processingTime = h.analysisTime!.duration
                    const videoDuration = h.metadata!.basic!.duration
                    return processingTime / (videoDuration / 60) // seconds per minute of video
                  })
                
                return normalizedProcessingTimes.length > 0 ? (
                  <HistogramChart
                    title="処理時間の分布（動画1分あたり）"
                    data={normalizedProcessingTimes}
                    bins={6}
                    xAxisLabel="動画１分あたりの処理時間（秒）"
                    yAxisLabel="頻度"
                    color="#f59e0b"
                  />
                ) : (
                  <p className="text-center text-gray-500">処理時間データがありません</p>
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