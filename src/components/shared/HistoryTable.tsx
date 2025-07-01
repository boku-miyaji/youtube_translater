import React from 'react'
import { useAppStore } from '../../store/appStore'

interface HistoryTableProps {
  data: any[]
  sortBy: string
}

const HistoryTable: React.FC<HistoryTableProps> = ({ data, sortBy }) => {
  const { setCurrentVideo } = useAppStore()

  const sortedData = [...data].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return (a.title || '').localeCompare(b.title || '')
      case 'duration':
        return (a.duration || 0) - (b.duration || 0)
      case 'timestamp':
      default:
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    }
  })

  const handleViewVideo = (video: any) => {
    setCurrentVideo(video)
    // Navigate to upload page or show in modal
    window.location.hash = '/upload'
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Video
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Duration
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                No history available
              </td>
            </tr>
          ) : (
            sortedData.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      {item.thumbnail ? (
                        <img
                          className="h-10 w-10 rounded object-cover"
                          src={item.thumbnail}
                          alt=""
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500 text-xs">📹</span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {item.title || item.metadata?.basic?.title || 'Unknown Title'}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {item.metadata?.basic?.videoId || 'Unknown'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.duration || 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleViewVideo(item)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default HistoryTable