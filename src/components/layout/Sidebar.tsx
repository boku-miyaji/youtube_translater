import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
  { name: 'Upload', href: '/upload', icon: '📹' },
  { name: 'History', href: '/history', icon: '📚' },
  { name: 'Analysis', href: '/analysis', icon: '📊' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
]

const Sidebar: React.FC = () => {
  const { sidebarCollapsed } = useAppStore()

  return (
    <div className={`bg-white shadow-sm border-r border-gray-200 transition-all duration-300 ${
      sidebarCollapsed ? 'w-16' : 'w-64'
    }`}>
      <nav className="h-full px-3 py-4">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    isActive
                      ? 'bg-indigo-100 text-indigo-700 border-r-4 border-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <span className="text-lg mr-3">{item.icon}</span>
                {!sidebarCollapsed && (
                  <span className="truncate">{item.name}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export default Sidebar