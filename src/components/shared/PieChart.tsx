import React from 'react'

interface PieChartProps {
  data: { name: string; value: number; color: string }[]
  title?: string
  showLegend?: boolean
  size?: number
}

const PieChart: React.FC<PieChartProps> = ({ data, title, showLegend = true, size = 200 }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  if (total === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data available</p>
      </div>
    )
  }

  let currentAngle = -90 // Start from top

  const slices = data.map((item, index) => {
    const percentage = (item.value / total) * 100
    const angle = (percentage / 100) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    // Convert angles to radians
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    // Calculate path
    const radius = size / 2
    const centerX = radius
    const centerY = radius

    const x1 = centerX + radius * Math.cos(startRad)
    const y1 = centerY + radius * Math.sin(startRad)
    const x2 = centerX + radius * Math.cos(endRad)
    const y2 = centerY + radius * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    const path = `
      M ${centerX} ${centerY}
      L ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
      Z
    `

    return {
      path,
      color: item.color,
      name: item.name,
      value: item.value,
      percentage: percentage.toFixed(1)
    }
  })

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      )}
      
      <div className="flex items-center justify-center gap-8">
        <div className="relative">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {slices.map((slice, index) => (
              <path
                key={index}
                d={slice.path}
                fill={slice.color}
                stroke="white"
                strokeWidth="2"
                className="transition-opacity hover:opacity-80 cursor-pointer"
                title={`${slice.name}: ${slice.value} (${slice.percentage}%)`}
              />
            ))}
          </svg>
          
          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{total}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
          </div>
        </div>

        {showLegend && (
          <div className="space-y-2">
            {data.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: item.color }}
                />
                <div className="text-sm">
                  <span className="font-medium text-gray-900">{item.name}:</span>
                  <span className="ml-1 text-gray-600">
                    {item.value} ({((item.value / total) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default PieChart