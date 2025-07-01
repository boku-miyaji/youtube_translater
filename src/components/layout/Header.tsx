import React from 'react'
import { useAppStore } from '../../store/appStore'

const Header: React.FC = () => {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore()

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">YouTube 文字起こし & チャット</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">v1.0.0</span>
        </div>
      </div>
    </header>
  )
}

export default Header