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
    <div className={`bg-white shadow-lg border-r border-gray-100 transition-all duration-300 ${
      sidebarCollapsed ? 'w-16' : 'w-72'
    }`}>
      <nav className="h-full px-4 py-6">
        <div className="space-y-3">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center px-4 py-3 text-sm font-medium rounded-2xl transition-all duration-200 ${
                  isActive
                    ? `bg-gradient-to-r ${item.color} text-white shadow-lg transform scale-105`
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-md hover:scale-102'
                }`
              }
            >
              <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 ${
                sidebarCollapsed ? 'mr-0' : 'mr-4'
              }`}>
                <span className="text-lg">{item.icon}</span>
              </div>
              {!sidebarCollapsed && (
                <span className="truncate font-semibold">{item.name}</span>
              )}
              {!sidebarCollapsed && (
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default Sidebar