import React, { useState } from 'react'
import { useHistory } from '../../hooks/useHistory'
import HistoryTable from '../shared/HistoryTable'

const HistoryPage: React.FC = () => {
  const { data: history, isLoading, error } = useHistory()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('timestamp')
  const [selectedChannel, setSelectedChannel] = useState('')

  // Get unique channels from history data
  const availableChannels = React.useMemo(() => {
    if (!history) return []
    
    const channels = history
      .map((item: any) => item.metadata?.basic?.channel || 'Unknown Channel')
      .filter((channel: string) => channel && channel !== 'Unknown Channel')
    
    return [...new Set(channels)].sort()
  }, [history])

  const filteredHistory = history ? history.filter((item: any) => {
    const matchesSearch = item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.videoId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.metadata?.basic?.channel || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesChannel = selectedChannel === '' || 
                          (item.metadata?.basic?.channel || 'Unknown Channel') === selectedChannel
    
    return matchesSearch && matchesChannel
  }) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">History</h1>
        <p className="mt-2 text-gray-600">View and manage your processed videos.</p>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, video ID, or channel..."
              className="mt-1 block w-full border-app-medium rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="channel" className="block text-sm font-medium text-gray-700">
              Filter by Channel
            </label>
            <select
              id="channel"
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="mt-1 block w-full border-app-medium rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Channels</option>
              {availableChannels.map((channel) => (
                <option key={channel} value={channel}>
                  📺 {channel}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="block text-sm font-medium text-gray-700">
              Sort By
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="mt-1 block w-full border-app-medium rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="timestamp">Date</option>
              <option value="title">Title</option>
              <option value="duration">Duration</option>
            </select>
          </div>
        </div>
        
        {/* Filter Summary */}
        {(searchTerm || selectedChannel) && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Active filters:</span>
            <div className="flex flex-wrap items-center gap-2">
              {searchTerm && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 border border-gray-200">
                  🔍 "{searchTerm}"
                  <button
                    onClick={() => setSearchTerm('')}
                    className="ml-2 text-gray-500 hover:text-gray-700 text-lg leading-none"
                    title="Remove search filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedChannel && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 border border-gray-200">
                  📺 {selectedChannel}
                  <button
                    onClick={() => setSelectedChannel('')}
                    className="ml-2 text-gray-500 hover:text-gray-700 text-lg leading-none"
                    title="Remove channel filter"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedChannel('')
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                title="Clear all filters"
              >
                Clear all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="bg-white rounded-lg shadow">
        {/* Results Header */}
        {!isLoading && !error && (
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">
                  {filteredHistory.length} videos found
                </span>
                {(searchTerm || selectedChannel) && history && (
                  <span>
                    (filtered from {history.length} total)
                  </span>
                )}
              </div>
              {availableChannels.length > 0 && (
                <div className="text-xs text-gray-500">
                  📺 {availableChannels.length} channels available
                </div>
              )}
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="p-6">
            <p className="text-gray-500">Loading history...</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <p className="text-red-500">Error loading history: {error.message}</p>
          </div>
        ) : (
          <HistoryTable 
            data={filteredHistory} 
            sortBy={sortBy}
          />
        )}
      </div>
    </div>
  )
}

export default HistoryPage