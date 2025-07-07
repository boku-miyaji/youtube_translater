import React from 'react'
import { useAppStore } from '../../store/appStore'

const Header: React.FC = () => {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore()

  return (
    <header className="bg-white/90 backdrop-blur-xl shadow-lg border-b border-white/20 px-6 py-4 relative z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-3 rounded-2xl bg-indigo-100/80 text-indigo-600 hover:text-white hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 shadow-md hover:shadow-lg z-50 relative border border-indigo-200 hover:border-indigo-600"
            data-testid="sidebar-toggle"
            title={sidebarCollapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
          >
            {sidebarCollapsed ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="menu-icon">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="close-icon">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">🎬</span>
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                YouTube Transcriber
              </h1>
              <p className="text-sm text-gray-500 font-medium">AI-Powered Video Analysis</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-2 rounded-xl border border-green-200 shadow-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-sm"></div>
            <span className="text-sm font-semibold text-green-700">All Systems Online</span>
          </div>
          <div className="flex items-center space-x-2 bg-gray-100/80 px-3 py-2 rounded-xl">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-600">v1.0.0</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header