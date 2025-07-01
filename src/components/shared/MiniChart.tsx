import React from 'react'

interface MiniChartProps {
  data: number[]
  color: string
  height?: number
}

const MiniChart: React.FC<MiniChartProps> = ({ data, color, height = 40 }) => {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  return (
    <svg width="100%" height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      
      {/* Area chart */}
      <path
        d={`M 0,${height} ${data.map((value, index) => {
          const x = (index / (data.length - 1)) * 100
          const y = height - ((value - min) / range) * height
          return `L ${x},${y}`
        }).join(' ')} L 100,${height} Z`}
        fill={`url(#gradient-${color})`}
        className="transition-all duration-300"
      />
      
      {/* Line chart */}
      <path
        d={`M ${data.map((value, index) => {
          const x = (index / (data.length - 1)) * 100
          const y = height - ((value - min) / range) * height
          return `${x},${y}`
        }).join(' L ')}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        className="transition-all duration-300"
      />
      
      {/* Data points */}
      {data.map((value, index) => {
        const x = (index / (data.length - 1)) * 100
        const y = height - ((value - min) / range) * height
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="2"
            fill={color}
            className="transition-all duration-300 hover:r-3"
          />
        )
      })}
    </svg>
  )
}

export default MiniChart