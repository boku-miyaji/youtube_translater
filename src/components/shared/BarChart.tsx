import React from 'react'

interface BarChartProps {
  data: { label: string; value: number }[]
  title?: string
  xAxisLabel?: string
  yAxisLabel?: string
  color?: string
  horizontal?: boolean
}

const BarChart: React.FC<BarChartProps> = ({ 
  data, 
  title,
  xAxisLabel = 'Category',
  yAxisLabel = 'Value',
  color = '#6366f1',
  horizontal = false
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data available</p>
      </div>
    )
  }

  const maxValue = Math.max(...data.map(d => d.value))
  const chartHeight = 250
  const barWidth = horizontal ? 150 : Math.min(40, 500 / data.length - 10)
  const gap = 10
  const chartWidth = horizontal ? 400 : data.length * (barWidth + gap) + 80
  const padding = { top: 20, right: 20, bottom: 60, left: 60 }

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      )}
      
      <div className="overflow-x-auto">
        <svg width={chartWidth} height={chartHeight} className="min-w-full">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
            if (horizontal) {
              const x = padding.left + ratio * (chartWidth - padding.left - padding.right)
              const value = Math.round(ratio * maxValue)
              return (
                <g key={index}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={chartHeight - padding.bottom}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={chartHeight - padding.bottom + 15}
                    textAnchor="middle"
                    className="text-xs fill-gray-600"
                  >
                    {value}
                  </text>
                </g>
              )
            } else {
              const y = chartHeight - padding.bottom - ratio * (chartHeight - padding.top - padding.bottom)
              const value = Math.round(ratio * maxValue)
              return (
                <g key={index}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={chartWidth - padding.right}
                    y2={y}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="text-xs fill-gray-600"
                  >
                    {value}
                  </text>
                </g>
              )
            }
          })}

          {/* Axis labels */}
          <text
            x={horizontal ? chartWidth / 2 : 15}
            y={horizontal ? chartHeight - 5 : chartHeight / 2}
            textAnchor="middle"
            className="text-xs fill-gray-700 font-medium"
            transform={horizontal ? '' : `rotate(-90 15 ${chartHeight / 2})`}
          >
            {horizontal ? xAxisLabel : yAxisLabel}
          </text>

          {/* Bars */}
          {data.map((item, index) => {
            if (horizontal) {
              const barLength = (item.value / maxValue) * (chartWidth - padding.left - padding.right)
              const y = padding.top + index * (20 + gap)
              
              return (
                <g key={index}>
                  <rect
                    x={padding.left}
                    y={y}
                    width={barLength}
                    height={20}
                    fill={color}
                    className="transition-opacity hover:opacity-80 cursor-pointer"
                    rx="2"
                  />
                  <title>{`${item.label}: ${item.value}`}</title>
                  
                  {/* Value label */}
                  <text
                    x={padding.left + barLength + 5}
                    y={y + 14}
                    className="text-xs fill-gray-700 font-medium"
                  >
                    {item.value}
                  </text>
                  
                  {/* Category label */}
                  <text
                    x={padding.left - 5}
                    y={y + 14}
                    textAnchor="end"
                    className="text-xs fill-gray-600"
                  >
                    {item.label}
                  </text>
                </g>
              )
            } else {
              const barHeight = (item.value / maxValue) * (chartHeight - padding.top - padding.bottom)
              const x = padding.left + index * (barWidth + gap) + gap
              const y = chartHeight - padding.bottom - barHeight
              
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
                  <title>{`${item.label}: ${item.value}`}</title>
                  
                  {/* Value label on top of bar */}
                  {item.value > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 5}
                      textAnchor="middle"
                      className="text-xs fill-gray-700 font-medium"
                    >
                      {item.value}
                    </text>
                  )}
                  
                  {/* X-axis label */}
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight - padding.bottom + 15}
                    textAnchor="middle"
                    className="text-xs fill-gray-600"
                    transform={`rotate(-45 ${x + barWidth / 2} ${chartHeight - padding.bottom + 15})`}
                  >
                    {item.label}
                  </text>
                </g>
              )
            }
          })}
        </svg>
      </div>
    </div>
  )
}

export default BarChart