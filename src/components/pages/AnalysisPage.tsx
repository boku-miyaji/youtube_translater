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
    const model = cost.model || 'Unknown'
    if (!acc[model]) {
      acc[model] = { count: 0, totalCost: 0 }
    }
    acc[model].count += 1
    acc[model].totalCost += cost.totalCost || 0
    return acc
  }, {}) : {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-app-primary">Analysis</h1>
        <p className="mt-2 text-app-secondary">View your usage statistics and cost analysis.</p>
      </div>

      {/* Cost Overview */}
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

      {/* Cost Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-app-primary mb-4">Cost Trends</h2>
        {isLoading ? (
          <p className="text-app-muted">Loading chart...</p>
        ) : error ? (
          <p className="text-app-error">Error loading cost data</p>
        ) : (
          <CostChart data={costs || []} />
        )}
      </div>

      {/* Model Statistics */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Model Usage Statistics</h2>
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

      {/* Visual Analytics Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-app-primary mb-6">📊 視覚的分析</h2>
        
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

        {/* Full Width Charts */}
        <div className="space-y-6 mt-6">
          {/* Daily Processing Trend */}
          {history && history.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              {(() => {
                // Group by date
                const dailyData = history.reduce((acc: any, item) => {
                  const date = new Date(item.timestamp).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
                  acc[date] = (acc[date] || 0) + 1
                  return acc
                }, {})

                // Convert to array and sort by date
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

          {/* Processing Time Distribution */}
          {history && history.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              {(() => {
                const processingTimes = history
                  .map(h => h.analysisTime?.duration)
                  .filter(Boolean) as number[]
                
                return processingTimes.length > 0 ? (
                  <HistogramChart
                    title="処理時間の分布"
                    data={processingTimes}
                    bins={8}
                    xAxisLabel="処理時間"
                    yAxisLabel="頻度"
                    color="#f59e0b"
                  />
                ) : (
                  <p className="text-center text-gray-500">処理時間データがありません</p>
                )
              })()}
            </div>
          )}

          {/* Weekly Processing Volume */}
          {history && history.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              {(() => {
                // Group by week
                const weeklyData: { [key: string]: number } = {}
                const now = new Date()
                
                for (let i = 0; i < 8; i++) {
                  const weekStart = new Date(now)
                  weekStart.setDate(now.getDate() - i * 7)
                  weekStart.setHours(0, 0, 0, 0)
                  
                  const weekEnd = new Date(weekStart)
                  weekEnd.setDate(weekStart.getDate() + 7)
                  
                  const weekLabel = `${(weekStart.getMonth() + 1)}/${weekStart.getDate()}`
                  
                  weeklyData[weekLabel] = history.filter(h => {
                    const timestamp = new Date(h.timestamp)
                    return timestamp >= weekStart && timestamp < weekEnd
                  }).length
                }
                
                const data = Object.entries(weeklyData)
                  .map(([label, value]) => ({ label, value }))
                  .reverse()
                
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
                
                // Get last 30 data points
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
        </div>
      </div>

      {/* Detailed Analysis Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video Analysis Statistics */}
        {history && history.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                📊 動画分析統計
              </h2>
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
              <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                ⏱️ 処理時間分析
              </h2>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-4">
                {(() => {
                  const processingTimes = history.map(h => h.analysisTime?.duration).filter(Boolean)
                  const avgTime = processingTimes.length > 0 ? 
                    processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length : 0
                  const minTime = processingTimes.length > 0 ? Math.min(...processingTimes) : 0
                  const maxTime = processingTimes.length > 0 ? Math.max(...processingTimes) : 0
                  
                  return (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">平均処理時間:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {avgTime < 60 ? `${Math.round(avgTime)}秒` : `${Math.floor(avgTime / 60)}分${Math.round(avgTime % 60)}秒`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">最短時間:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {minTime < 60 ? `${minTime}秒` : `${Math.floor(minTime / 60)}分${minTime % 60}秒`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">最長時間:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {maxTime < 60 ? `${maxTime}秒` : `${Math.floor(maxTime / 60)}分${maxTime % 60}秒`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">処理効率:</span>
                        <span className="text-sm font-bold text-gray-900">
                          {processingTimes.length > 0 ? `${(processingTimes.length / (avgTime / 60)).toFixed(1)}本/分` : '0本/分'}
                        </span>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Cost Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {costs && costs.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                💸 詳細コスト分析
              </h2>
            </div>
            <div className="px-6 py-4">
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
            </div>
          </div>
        )}

        {/* Cost Breakdown Pie Chart */}
        {costs && costs.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            {(() => {
              const whisperTotal = costs.reduce((sum, cost) => sum + cost.whisperCost, 0)
              const gptTotal = costs.reduce((sum, cost) => sum + cost.gptCost, 0)
              
              return (
                <PieChart
                  title="コスト内訳"
                  data={[
                    {
                      name: 'Whisper AI',
                      value: Math.round(whisperTotal * 10000) / 10000,
                      color: '#ef4444'
                    },
                    {
                      name: 'GPT',
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
      </div>
    </div>
  )
}

export default AnalysisPage