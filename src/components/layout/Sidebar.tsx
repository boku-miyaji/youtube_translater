import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '🏠', color: 'from-blue-500 to-indigo-600' },
  { name: 'Analyze', href: '/analyze', icon: '🔍', color: 'from-green-500 to-emerald-600' },
  { name: 'History', href: '/history', icon: '📚', color: 'from-purple-500 to-violet-600' },
  { name: 'Analysis', href: '/analysis', icon: '📊', color: 'from-orange-500 to-red-600' },
  { name: 'Settings', href: '/settings', icon: '⚙️', color: 'from-gray-500 to-slate-600' },
]

const Sidebar: React.FC = () => {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore()

  return (
    <div 
      className={`bg-white/95 backdrop-blur-xl shadow-2xl border-r border-white/30 transition-all duration-300 relative z-40 ${
        sidebarCollapsed ? 'w-16' : 'w-80'
      }`}
      data-testid="sidebar"
    >
      {/* Sidebar background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-gray-50/40 to-white/60 backdrop-blur-sm"></div>
      
      <nav className={`relative h-full py-8 ${
        sidebarCollapsed ? 'px-2' : 'px-6'
      }`}>
        {/* Toggle button */}
        <div className={`mb-6 ${sidebarCollapsed ? 'flex justify-center' : 'flex justify-end'}`}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2.5 rounded-xl bg-indigo-100/80 text-indigo-600 hover:text-white hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 shadow-md hover:shadow-lg border border-indigo-200 hover:border-indigo-600"
            data-testid="sidebar-toggle"
            title={sidebarCollapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
          >
            {sidebarCollapsed ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="menu-icon">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="close-icon">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>
        
        <div className="space-y-4">
          {navigation.map((item, index) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center text-sm font-semibold rounded-3xl transition-all duration-300 relative overflow-hidden ${
                  sidebarCollapsed ? 'px-2 py-3 mx-auto w-12 justify-center' : 'px-5 py-4'
                } ${
                  isActive
                    ? `bg-gradient-to-r ${item.color} text-white shadow-2xl transform scale-105 shadow-indigo-500/25`
                    : 'text-gray-600 hover:bg-white/80 hover:text-gray-900 hover:shadow-xl hover:scale-102 hover:shadow-gray-300/50'
                }`
              }
              title={sidebarCollapsed ? item.name : undefined}
            >
              {/* Active indicator */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${item.color} transition-all duration-300 ${
                sidebarCollapsed ? 'opacity-0' : 'opacity-100'
              }`}></div>
              
              <div className={`flex-shrink-0 flex items-center justify-center rounded-2xl transition-all duration-300 ${
                sidebarCollapsed ? 'w-12 h-12 mx-auto' : 'w-10 h-10 mr-5'
              }`}>
                <span className={`transition-all duration-300 ${
                  sidebarCollapsed ? 'text-2xl' : 'text-xl'
                }`}>{item.icon}</span>
              </div>
              
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1">
                    <span className="truncate font-bold text-base">{item.name}</span>
                    <div className="text-xs opacity-75 mt-0.5">
                      {item.name === 'Dashboard' && 'Overview & Analytics'}
                      {item.name === 'Analyze' && 'Analyze Content'}
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
      </nav>
    </div>
  )
}

export default Sidebar