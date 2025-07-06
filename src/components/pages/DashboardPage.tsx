import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useHistory } from '../../hooks/useHistory'
import { useCosts } from '../../hooks/useCosts'
import { useAppStore } from '../../store/appStore'
import MiniChart from '../shared/MiniChart'

const DashboardPage: React.FC = () => {
  const { data: history, isLoading: historyLoading, error: historyError } = useHistory()
  const { data: costs, isLoading: costsLoading } = useCosts()
  const { setCurrentVideo } = useAppStore()
  const navigate = useNavigate()
  const [quickUrl, setQuickUrl] = useState('')

  const recentVideos = history ? history.slice(0, 5) : []
  
  // Calculate today's and yesterday's costs
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  const todaysCosts = costs ? costs.filter(cost => {
    const costDate = new Date(cost.timestamp).toDateString()
    return costDate === today.toDateString()
  }) : []
  
  const yesterdaysCosts = costs ? costs.filter(cost => {
    const costDate = new Date(cost.timestamp).toDateString()
    return costDate === yesterday.toDateString()
  }) : []

  const totalTodaysCost = todaysCosts.reduce((sum, cost) => sum + (cost.totalCost || 0), 0)
  const totalYesterdaysCost = yesterdaysCosts.reduce((sum, cost) => sum + (cost.totalCost || 0), 0)
  
  // Calculate spending change percentage
  const calculateSpendingChange = (current: number, previous: number) => {
    if (previous === 0) {
      return current > 0 ? '+100%' : '0%'
    }
    const change = ((current - previous) / previous) * 100
    return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
  }
  
  const spendingChange = calculateSpendingChange(totalTodaysCost, totalYesterdaysCost)
  
  // Mock data for charts (replace with real data)
  const costTrend = [0.12, 0.19, 0.15, 0.25, 0.31, 0.28, 0.35]
  const videoTrend = [2, 3, 1, 5, 4, 6, 3]
  const processingTimes = [45, 52, 38, 65, 43, 58, 41]

  const handleQuickAnalyze = () => {
    if (quickUrl.trim()) {
      navigate('/upload', { state: { url: quickUrl.trim() } })
    }
  }

  const handleVideoClick = (video: any) => {
    // Set the current video in the app store
    setCurrentVideo({
      basic: {
        title: video.title,
        videoId: video.videoId || video.id,
        duration: video.metadata?.basic?.duration || 0,
        channel: video.metadata?.basic?.channel || 'Unknown',
        viewCount: video.metadata?.basic?.viewCount || 0,
        likes: video.metadata?.basic?.likes || 0,
        uploadDate: video.metadata?.basic?.uploadDate || '',
        publishDate: video.metadata?.basic?.publishDate || '',
        category: video.metadata?.basic?.category || '',
        description: video.metadata?.basic?.description || '',
        thumbnail: video.metadata?.basic?.thumbnail || video.thumbnail
      },
      chapters: video.metadata?.chapters || [],
      captions: video.metadata?.captions || [],
      stats: video.metadata?.stats || {
        formatCount: 0,
        hasSubtitles: false,
        keywords: []
      },
      transcript: video.transcript,
      timestampedSegments: video.timestampedSegments || []
    })
    
    // Navigate to upload page to show the historical video
    navigate('/upload')
  }

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="text-center relative z-10">
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full mb-6">
            <span className="text-2xl mr-3">🚀</span>
            <span className="text-indigo-700 font-semibold">Welcome to your AI Dashboard</span>
          </div>
          <h1 className="text-6xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Analytics Hub
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Monitor your video transcription performance with real-time insights and advanced analytics
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Today's Cost Card */}
        <div className="lg:col-span-2 group relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur-lg opacity-25 group-hover:opacity-40 transition-opacity duration-300"></div>
          <div className="relative bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/50 hover:shadow-indigo-500/25 transition-all duration-500">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                    <span className="text-2xl">💰</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Daily Spending</h3>
                    <p className="text-sm text-gray-500">API Costs & Usage</p>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  {costsLoading ? (
                    <div className="animate-pulse bg-gray-200 h-10 w-32 rounded-lg"></div>
                  ) : (
                    `$${totalTodaysCost.toFixed(4)}`
                  )}
                </div>
                <div className="flex items-center text-sm" data-testid="spending-change">
                  <span className={`font-semibold mr-2 ${
                    spendingChange.startsWith('+') ? 'text-green-500' : 
                    spendingChange.startsWith('-') ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {spendingChange.startsWith('+') ? '↗' : spendingChange.startsWith('-') ? '↘' : '→'} {spendingChange}
                  </span>
                  <span className="text-gray-500">vs yesterday</span>
                </div>
              </div>
            </div>
            <div className="h-16 -mx-2">
              <MiniChart data={costTrend} color="#6366f1" height={64} />
            </div>
          </div>
        </div>

        {/* Video Count Card */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl blur-lg opacity-25 group-hover:opacity-40 transition-opacity duration-300"></div>
          <div className="relative bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-2xl border border-white/50 hover:shadow-emerald-500/25 transition-all duration-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-xl">📹</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {historyLoading ? (
                    <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                  ) : (
                    history?.length || 0
                  )}
                </div>
                <div className="text-xs text-gray-500">Total Videos (All Time)</div>
              </div>
            </div>
            <div className="h-12 -mx-2">
              <MiniChart data={videoTrend} color="#10b981" height={48} />
            </div>
            <div className="flex items-center text-xs mt-2">
              <span className="text-emerald-500 font-semibold mr-1">↗ +3</span>
              <span className="text-gray-500">this week</span>
            </div>
          </div>
        </div>

        {/* Processing Time Card */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-600 rounded-3xl blur-lg opacity-25 group-hover:opacity-40 transition-opacity duration-300"></div>
          <div className="relative bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-2xl border border-white/50 hover:shadow-orange-500/25 transition-all duration-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-xl">⚡</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">47s</div>
                <div className="text-xs text-gray-500">Avg Process</div>
              </div>
            </div>
            <div className="h-12 -mx-2">
              <MiniChart data={processingTimes} color="#f97316" height={48} />
            </div>
            <div className="flex items-center text-xs mt-2">
              <span className="text-red-500 font-semibold mr-1">↘ -8s</span>
              <span className="text-gray-500">improved</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Recent Videos - Takes up 2 columns */}
        <div className="xl:col-span-2 group relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-3xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
          <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
            {/* Header */}
            <div className="px-8 py-6 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                    <span className="text-2xl">📚</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Recent Transcriptions</h2>
                    <p className="text-sm text-gray-600">Your latest video processing activities</p>
                  </div>
                </div>
                <Link
                  to="/history"
                  className="inline-flex items-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-2xl hover:bg-blue-50 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  View All
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
            
            {/* Content */}
            <div className="divide-y divide-gray-100">
              {historyError ? (
                <div className="px-8 py-16 text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-4xl text-red-400">⚠️</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-700 mb-2">Error loading history</h3>
                  <p className="text-gray-500 mb-6">Failed to fetch history: {historyError.message}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-red-500 to-orange-600 text-white font-semibold rounded-2xl hover:shadow-lg transition-all duration-200"
                  >
                    <span className="mr-2">🔄</span>
                    Retry
                  </button>
                </div>
              ) : historyLoading ? (
                <div className="px-8 py-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex space-x-4 py-4">
                      <div className="rounded-2xl bg-gray-200 h-16 w-16"></div>
                      <div className="flex-1 space-y-3">
                        <div className="h-4 bg-gray-200 rounded-lg w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded-lg w-1/2"></div>
                        <div className="h-2 bg-gray-200 rounded-lg w-1/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentVideos.length > 0 ? (
                recentVideos.map((video: any, index: number) => (
                  <div 
                    key={index} 
                    onClick={() => handleVideoClick(video)}
                    className="px-8 py-6 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-cyan-50/50 transition-all duration-300 group/item cursor-pointer"
                  >
                    <div className="flex items-center space-x-6">
                      {/* Video Thumbnail */}
                      <div className="relative">
                        {(video.thumbnail || video.metadata?.basic?.thumbnail || video.videoId || video.id) ? (
                          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg group-hover/item:scale-105 transition-transform duration-200">
                            <img
                              src={video.thumbnail || video.metadata?.basic?.thumbnail || `https://img.youtube.com/vi/${video.videoId || video.id}/mqdefault.jpg`}
                              alt={video.title || 'Video thumbnail'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                const currentSrc = target.src;
                                
                                // Try higher quality YouTube thumbnail first
                                if (currentSrc.includes('mqdefault')) {
                                  target.src = `https://img.youtube.com/vi/${video.videoId || video.id}/hqdefault.jpg`;
                                  return;
                                }
                                if (currentSrc.includes('hqdefault')) {
                                  target.src = `https://img.youtube.com/vi/${video.videoId || video.id}/maxresdefault.jpg`;
                                  return;
                                }
                                
                                // Final fallback to icon
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.className = 'w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg group-hover/item:scale-105 transition-transform duration-200';
                                  parent.innerHTML = '<span class="text-white text-2xl">🎬</span>';
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg group-hover/item:scale-105 transition-transform duration-200">
                            <span className="text-white text-2xl">🎬</span>
                          </div>
                        )}
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full border-2 border-white flex items-center justify-center">
                          <span className="text-xs">✓</span>
                        </div>
                      </div>
                      
                      {/* Video Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900 truncate group-hover/item:text-blue-600 transition-colors duration-200 mb-1">
                          {video.title || 'Unknown Title'}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <span className="mr-2">🆔</span>
                            <span className="font-mono">{video.videoId || video.id || 'No ID'}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="mr-2">📅</span>
                            <span>{video.timestamp ? new Date(video.timestamp).toLocaleDateString() : 'Unknown date'}</span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-gradient-to-r from-blue-500 to-cyan-600 h-2 rounded-full w-full"></div>
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      <div className="flex-shrink-0">
                        <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                          Complete
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-8 py-16 text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-4xl text-blue-400">📹</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-700 mb-2">No videos processed yet</h3>
                  <p className="text-gray-500 mb-6">Upload your first video to start transcribing with AI</p>
                  <Link 
                    to="/upload"
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold rounded-2xl hover:shadow-lg transition-all duration-200"
                  >
                    <span className="mr-2">🚀</span>
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Quick Actions */}
        <div className="space-y-6">
          {/* Quick Upload Card */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur-lg opacity-75 group-hover:opacity-90 transition-opacity duration-300"></div>
            <div className="relative bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 rounded-3xl p-8 text-white shadow-2xl">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  <span className="text-3xl">🚀</span>
                </div>
                <h3 className="text-2xl font-bold mb-2">Quick Upload</h3>
                <p className="text-white opacity-90">Transform your videos into text instantly</p>
              </div>
              
              {/* URL Input */}
              <div className="mb-4">
                <input
                  type="text"
                  value={quickUrl}
                  onChange={(e) => setQuickUrl(e.target.value)}
                  placeholder="Paste YouTube URL here..."
                  className="w-full px-4 py-3 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/50"
                  data-testid="quick-url-input"
                />
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={handleQuickAnalyze}
                  className="w-full inline-flex items-center justify-center px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:ring-opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  data-testid="quick-analyze-button"
                >
                  <span className="mr-3 text-xl">⚡</span>
                  Analyze Now
                </button>
                
                <Link
                  to="/upload"
                  className="w-full inline-flex items-center justify-center px-4 py-3 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-all duration-200 border border-white/30"
                >
                  <span className="mr-2">📤</span>
                  Go to full upload page
                </Link>
              </div>
            </div>
          </div>

          {/* System Health Card */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
            <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">System Health</h3>
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">API Status</span>
                  <span className="text-sm font-semibold text-green-600">Online</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Processing Queue</span>
                  <span className="text-sm font-semibold text-blue-600">0 pending</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Response Time</span>
                  <span className="text-sm font-semibold text-orange-600">1.2s avg</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center text-xs text-gray-500">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  All systems operational
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage