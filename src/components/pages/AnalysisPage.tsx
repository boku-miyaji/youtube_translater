import React from 'react'
import { useCosts } from '../../hooks/useCosts'
import CostChart from '../shared/CostChart'

const AnalysisPage: React.FC = () => {
  const { data: costs, isLoading, error } = useCosts()

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
    </div>
  )
}

export default AnalysisPage