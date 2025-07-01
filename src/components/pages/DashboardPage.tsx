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
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
          Welcome back! Here's your activity overview and quick insights.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Today's Usage */}
        <div className="group bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-indigo-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <span className="text-3xl">💰</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">Today's Cost</div>
              <div className="text-3xl font-bold text-gray-900 mt-1">
                {costsLoading ? (
                  <div className="animate-pulse bg-gray-200 h-8 w-24 rounded"></div>
                ) : (
                  `$${totalTodaysCost.toFixed(4)}`
                )}
              </div>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full w-3/4 animate-pulse"></div>
          </div>
        </div>

        {/* Total Videos */}
        <div className="group bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg">
              <span className="text-3xl">📹</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Videos</div>
              <div className="text-3xl font-bold text-gray-900 mt-1">
                {historyLoading ? (
                  <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                ) : (
                  history?.length || 0
                )}
              </div>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full w-2/3"></div>
          </div>
        </div>

        {/* System Status */}
        <div className="group bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-4 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl shadow-lg">
              <span className="text-3xl">✅</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">System Status</div>
              <div className="text-3xl font-bold text-green-600 mt-1 flex items-center">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse mr-2"></div>
                Online
              </div>
            </div>
          </div>
          <div className="text-sm text-green-600 font-medium">All systems operational</div>
        </div>
      </div>

      {/* Recent Videos */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100">
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="mr-3">📚</span>
              Recent Videos
            </h2>
            <Link
              to="/history"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors duration-200"
            >
              View all
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {historyLoading ? (
            <div className="px-8 py-6">
              <div className="animate-pulse flex space-x-4">
                <div className="rounded-xl bg-gray-200 h-12 w-12"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ) : recentVideos.length > 0 ? (
            recentVideos.map((video: any, index: number) => (
              <div key={index} className="px-8 py-6 hover:bg-gray-50 transition-colors duration-200 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-lg">🎬</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors duration-200">
                        {video.title || 'Unknown Title'}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center mt-1">
                        <span className="mr-2">🆔</span>
                        {video.videoId || 'No ID'}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-lg">
                      {video.timestamp ? new Date(video.timestamp).toLocaleDateString() : 'Unknown date'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-8 py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-gray-400">📹</span>
              </div>
              <p className="text-gray-500 text-lg">No videos processed yet</p>
              <p className="text-gray-400 text-sm mt-1">Upload your first video to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Upload */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Ready to upload?</h2>
            <p className="text-indigo-100 text-lg">Start transcribing your next video with AI-powered analysis</p>
          </div>
          <Link
            to="/upload"
            className="inline-flex items-center px-8 py-4 bg-white text-indigo-600 font-semibold rounded-2xl hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-white focus:ring-opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <span className="mr-3 text-xl">📤</span>
            Upload New Video
          </Link>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage