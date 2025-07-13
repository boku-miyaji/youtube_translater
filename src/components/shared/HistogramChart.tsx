import React from 'react'

interface HistogramChartProps {
  data: number[]
  bins?: number
  title?: string
  xAxisLabel?: string
  yAxisLabel?: string
  color?: string
}

const HistogramChart: React.FC<HistogramChartProps> = ({ 
  data, 
  bins = 10,
  title,
  xAxisLabel = 'Value',
  yAxisLabel = 'Frequency',
  color = '#10b981'
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data available</p>
      </div>
    )
  }

  // Calculate histogram bins
  const min = Math.min(...data)
  const max = Math.max(...data)
  const binWidth = (max - min) / bins
  
  const histogram = Array.from({ length: bins }, (_, i) => {
    const binStart = min + i * binWidth
    const binEnd = binStart + binWidth
    const count = data.filter(value => 
      i === bins - 1 ? value >= binStart && value <= binEnd : value >= binStart && value < binEnd
    ).length
    
    return {
      range: `${binStart.toFixed(0)}-${binEnd.toFixed(0)}`,
      start: binStart,
      end: binEnd,
      count,
      percentage: (count / data.length) * 100
    }
  })

  const maxCount = Math.max(...histogram.map(bin => bin.count))
  const chartHeight = 200
  const barWidth = 40
  const gap = 10
  const chartWidth = bins * (barWidth + gap) + 60

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      )}
      
      <div className="overflow-x-auto">
        <svg width={chartWidth} height={chartHeight + 60} className="min-w-full">
          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
            const y = chartHeight - (ratio * chartHeight) + 20
            const value = Math.round(ratio * maxCount)
            return (
              <g key={index}>
                <line
                  x1="50"
                  y1={y}
                  x2={chartWidth - 10}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                <text
                  x="45"
                  y={y + 4}
                  textAnchor="end"
                  className="text-xs fill-gray-600"
                >
                  {value}
                </text>
              </g>
            )
          })}

          {/* Y-axis label */}
          <text
            x="15"
            y={chartHeight / 2 + 20}
            textAnchor="middle"
            className="text-xs fill-gray-700 font-medium"
            transform={`rotate(-90 15 ${chartHeight / 2 + 20})`}
          >
            {yAxisLabel}
          </text>

          {/* Bars */}
          {histogram.map((bin, index) => {
            const barHeight = (bin.count / maxCount) * chartHeight
            const x = 60 + index * (barWidth + gap)
            const y = chartHeight - barHeight + 20
            
            return (
              <g key={index}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  className="transition-opacity hover:opacity-80 cursor-pointer"
                  rx="2"
                />
                <title>{`${bin.range}秒: ${bin.count}件 (${bin.percentage.toFixed(1)}%)`}</title>
                
                {/* Value label on top of bar */}
                {bin.count > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 5}
                    textAnchor="middle"
                    className="text-xs fill-gray-700 font-medium"
                  >
                    {bin.count}
                  </text>
                )}
                
                {/* X-axis label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 35}
                  textAnchor="middle"
                  className="text-xs fill-gray-600 font-medium"
                  transform={`rotate(-30 ${x + barWidth / 2} ${chartHeight + 35})`}
                >
                  {bin.range}
                </text>
              </g>
            )
          })}

          {/* X-axis label */}
          <text
            x={chartWidth / 2}
            y={chartHeight + 55}
            textAnchor="middle"
            className="text-xs fill-gray-700 font-medium"
          >
            {xAxisLabel}
          </text>
        </svg>
      </div>

      {/* Summary statistics */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <span className="text-gray-600">平均:</span>
          <span className="ml-1 font-medium text-gray-900">
            {(data.reduce((a, b) => a + b, 0) / data.length).toFixed(1)}秒
          </span>
        </div>
        <div className="text-center">
          <span className="text-gray-600">中央値:</span>
          <span className="ml-1 font-medium text-gray-900">
            {data.sort((a, b) => a - b)[Math.floor(data.length / 2)].toFixed(1)}秒
          </span>
        </div>
        <div className="text-center">
          <span className="text-gray-600">標準偏差:</span>
          <span className="ml-1 font-medium text-gray-900">
            {Math.sqrt(data.reduce((sum, value) => {
              const diff = value - data.reduce((a, b) => a + b, 0) / data.length
              return sum + diff * diff
            }, 0) / data.length).toFixed(1)}秒
          </span>
        </div>
      </div>
    </div>
  )
}

export default HistogramChart