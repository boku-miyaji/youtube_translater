import React from 'react'

interface LineChartProps {
  data: { date: string; value: number }[]
  title?: string
  yAxisLabel?: string
  color?: string
  showArea?: boolean
}

const LineChart: React.FC<LineChartProps> = ({ 
  data, 
  title, 
  yAxisLabel = 'Value',
  color = '#3b82f6',
  showArea = true 
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data available</p>
      </div>
    )
  }

  const maxValue = Math.max(...data.map(d => d.value))
  const minValue = Math.min(...data.map(d => d.value))
  const valueRange = maxValue - minValue || 1
  const chartHeight = 200
  const chartWidth = 600
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const plotWidth = chartWidth - padding.left - padding.right
  const plotHeight = chartHeight - padding.top - padding.bottom

  // Create points
  const points = data.map((item, index) => {
    const x = padding.left + (index / (data.length - 1)) * plotWidth
    const y = padding.top + plotHeight - ((item.value - minValue) / valueRange) * plotHeight
    return { x, y, value: item.value, date: item.date }
  })

  // Create path
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  // Create area path
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + plotHeight} L ${padding.left} ${padding.top + plotHeight} Z`

  // Y-axis labels
  const yAxisSteps = 5
  const yAxisLabels = Array.from({ length: yAxisSteps }, (_, i) => {
    const value = minValue + (valueRange / (yAxisSteps - 1)) * i
    const y = padding.top + plotHeight - (i / (yAxisSteps - 1)) * plotHeight
    return { value: value.toFixed(1), y }
  })

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      )}
      
      <div className="relative">
        <svg width={chartWidth} height={chartHeight} className="overflow-visible">
          {/* Grid lines */}
          {yAxisLabels.map((label, index) => (
            <line
              key={index}
              x1={padding.left}
              y1={label.y}
              x2={chartWidth - padding.right}
              y2={label.y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}

          {/* Y-axis labels */}
          {yAxisLabels.map((label, index) => (
            <text
              key={index}
              x={padding.left - 10}
              y={label.y + 5}
              textAnchor="end"
              className="text-xs fill-gray-600"
            >
              {label.value}
            </text>
          ))}

          {/* Y-axis label */}
          <text
            x={15}
            y={chartHeight / 2}
            textAnchor="middle"
            className="text-xs fill-gray-700 font-medium"
            transform={`rotate(-90 15 ${chartHeight / 2})`}
          >
            {yAxisLabel}
          </text>

          {/* Area */}
          {showArea && (
            <path
              d={areaPath}
              fill={color}
              fillOpacity="0.1"
            />
          )}

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2"
          />

          {/* Points */}
          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill={color}
                className="cursor-pointer hover:r-6 transition-all"
                title={`${point.date}: ${point.value}`}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="2"
                fill="white"
              />
            </g>
          ))}

          {/* X-axis labels */}
          {points.map((point, index) => {
            // Show every nth label to avoid crowding
            if (index % Math.ceil(data.length / 10) === 0 || index === data.length - 1) {
              return (
                <text
                  key={index}
                  x={point.x}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  className="text-xs fill-gray-600"
                >
                  {point.date.split(' ')[0]}
                </text>
              )
            }
            return null
          })}
        </svg>

        {/* Value tooltips on hover */}
        <div className="absolute inset-0 pointer-events-none">
          {points.map((point, index) => (
            <div
              key={index}
              className="absolute opacity-0 hover:opacity-100 pointer-events-auto transition-opacity bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg"
              style={{
                left: point.x - 30,
                top: point.y - 35,
              }}
            >
              <div className="font-medium">{point.value}</div>
              <div className="text-gray-300">{point.date}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default LineChart