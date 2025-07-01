import React, { useState } from 'react'
import { useHistory } from '../../hooks/useHistory'
import HistoryTable from '../shared/HistoryTable'

const HistoryPage: React.FC = () => {
  const { data: history, isLoading, error } = useHistory()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('timestamp')

  const filteredHistory = history ? history.filter((item: any) =>
    item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.videoId?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">History</h1>
        <p className="mt-2 text-gray-600">View and manage your processed videos.</p>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or video ID..."
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="sort" className="block text-sm font-medium text-gray-700">
              Sort By
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="timestamp">Date</option>
              <option value="title">Title</option>
              <option value="duration">Duration</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-lg shadow">
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