import React from 'react'
import { Link } from 'react-router-dom'
import { useHistory } from '../../hooks/useHistory'
import { useCosts } from '../../hooks/useCosts'

const DashboardPage: React.FC = () => {
  const { data: history, isLoading: historyLoading } = useHistory()
  const { data: costs, isLoading: costsLoading } = useCosts()

  const recentVideos = history ? history.slice(0, 5) : []
  const todaysCosts = costs ? costs.filter(cost => {
    const today = new Date().toDateString()
    return new Date(cost.timestamp).toDateString() === today
  }) : []

  const totalTodaysCost = todaysCosts.reduce((sum, cost) => sum + (cost.totalCost || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome back! Here's your activity overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Today's Usage */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <span className="text-2xl">💰</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today's Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                {costsLoading ? '...' : `$${totalTodaysCost.toFixed(4)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Total Videos */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-2xl">📹</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Videos</p>
              <p className="text-2xl font-bold text-gray-900">
                {historyLoading ? '...' : history?.length || 0}
              </p>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">System Status</p>
              <p className="text-2xl font-bold text-green-600">Online</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Videos */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Recent Videos</h2>
            <Link
              to="/history"
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              View all
            </Link>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {historyLoading ? (
            <div className="px-6 py-4">
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : recentVideos.length > 0 ? (
            recentVideos.map((video: any, index: number) => (
              <div key={index} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {video.title || 'Unknown Title'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {video.videoId && `ID: ${video.videoId}`}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm text-gray-500">
                      {video.timestamp && new Date(video.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-4">
              <p className="text-gray-500">No videos processed yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Upload */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Upload</h2>
        <Link
          to="/upload"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <span className="mr-2">📤</span>
          Upload New Video
        </Link>
      </div>
    </div>
  )
}

export default DashboardPage