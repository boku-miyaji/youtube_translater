import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '🏠', color: 'from-blue-500 to-indigo-600' },
  { name: 'Upload', href: '/upload', icon: '📤', color: 'from-green-500 to-emerald-600' },
  { name: 'History', href: '/history', icon: '📚', color: 'from-purple-500 to-violet-600' },
  { name: 'Analysis', href: '/analysis', icon: '📊', color: 'from-orange-500 to-red-600' },
  { name: 'Settings', href: '/settings', icon: '⚙️', color: 'from-gray-500 to-slate-600' },
]

const Sidebar: React.FC = () => {
  const { sidebarCollapsed } = useAppStore()

  return (
    <div className={`bg-white/95 backdrop-blur-xl shadow-2xl border-r border-white/30 transition-all duration-300 relative z-40 ${
      sidebarCollapsed ? 'w-20' : 'w-80'
    }`}>
      {/* Sidebar background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-gray-50/40 to-white/60 backdrop-blur-sm"></div>
      
      <nav className="relative h-full px-6 py-8">
        {/* Navigation header */}
        {!sidebarCollapsed && (
          <div className="mb-8 pb-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-700 mb-2">Navigation</h2>
            <p className="text-sm text-gray-500">Choose your workspace</p>
          </div>
        )}
        
        <div className="space-y-4">
          {navigation.map((item, index) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center px-5 py-4 text-sm font-semibold rounded-3xl transition-all duration-300 relative overflow-hidden ${
                  isActive
                    ? `bg-gradient-to-r ${item.color} text-white shadow-2xl transform scale-105 shadow-indigo-500/25`
                    : 'text-gray-600 hover:bg-white/80 hover:text-gray-900 hover:shadow-xl hover:scale-102 hover:shadow-gray-300/50'
                }`
              }
            >
              {/* Active indicator */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${item.color} transition-all duration-300 ${
                sidebarCollapsed ? 'opacity-0' : 'opacity-100'
              }`}></div>
              
              <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-300 ${
                sidebarCollapsed ? 'mr-0' : 'mr-5'
              }`}>
                <span className="text-xl">{item.icon}</span>
              </div>
              
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1">
                    <span className="truncate font-bold text-base">{item.name}</span>
                    <div className="text-xs opacity-75 mt-0.5">
                      {item.name === 'Dashboard' && 'Overview & Analytics'}
                      {item.name === 'Upload' && 'Add New Content'}
                      {item.name === 'History' && 'Past Transcriptions'}
                      {item.name === 'Analysis' && 'Data Insights'}
                      {item.name === 'Settings' && 'Configuration'}
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </div>
        
        {/* Bottom section */}
        {!sidebarCollapsed && (
          <div className="absolute bottom-6 left-6 right-6">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 text-white text-center shadow-lg">
              <div className="text-2xl mb-2">🚀</div>
              <div className="text-sm font-semibold">Pro Tips</div>
              <div className="text-xs opacity-90 mt-1">Use keyboard shortcuts for faster navigation</div>
            </div>
          </div>
        )}
      </nav>
    </div>
  )
}

export default Sidebar