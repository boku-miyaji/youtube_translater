import React from 'react'

interface CostChartProps {
  data: any[]
}

const CostChart: React.FC<CostChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No cost data available</p>
      </div>
    )
  }

  // Group data by date
  const dailyCosts = data.reduce((acc: any, cost) => {
    const date = new Date(cost.timestamp).toLocaleDateString()
    if (!acc[date]) {
      acc[date] = 0
    }
    acc[date] += cost.totalCost || 0
    return acc
  }, {})

  const chartData = Object.entries(dailyCosts)
    .slice(-30) // Last 30 days
    .map(([date, cost]) => ({ date, cost: cost as number }))

  const maxCost = Math.max(...chartData.map(d => d.cost))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Daily Cost Trend (Last 30 Days)</span>
        <span>Max: ${maxCost.toFixed(4)}</span>
      </div>
      
      <div className="space-y-2">
        <div className="h-48 flex items-end space-x-1">
          {chartData.map((item, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-gray-500 rounded-t hover:bg-gray-600 transition-colors"
                style={{
                  height: `${(item.cost / maxCost) * 180}px`,
                  minHeight: '2px'
                }}
                title={`${item.date}: $${item.cost.toFixed(4)}`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-600 px-1">
          {chartData.map((item, index) => {
            // Show every 3rd date to avoid crowding
            if (index % 3 === 0 || index === chartData.length - 1) {
              return (
                <span key={index} className="text-center font-mono">
                  {item.date.split('/').slice(0, 2).join('/')}
                </span>
              )
            }
            return <span key={index} className="invisible">·</span>
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Total Cost:</span>
          <div className="font-medium">${data.reduce((sum, cost) => sum + (cost.totalCost || 0), 0).toFixed(4)}</div>
        </div>
        <div>
          <span className="text-gray-600">Average Cost:</span>
          <div className="font-medium">${(data.reduce((sum, cost) => sum + (cost.totalCost || 0), 0) / data.length).toFixed(4)}</div>
        </div>
        <div>
          <span className="text-gray-600">Min Cost:</span>
          <div className="font-medium">${Math.min(...data.map(d => d.totalCost || 0)).toFixed(4)}</div>
        </div>
        <div>
          <span className="text-gray-600">Max Cost:</span>
          <div className="font-medium">${Math.max(...data.map(d => d.totalCost || 0)).toFixed(4)}</div>
        </div>
      </div>
    </div>
  )
}

export default CostChart