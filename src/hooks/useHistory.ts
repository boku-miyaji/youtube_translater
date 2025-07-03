import { useQuery } from '@tanstack/react-query'

const fetchHistory = async () => {
  const response = await fetch('/api/history')
  if (!response.ok) {
    throw new Error('Failed to fetch history')
  }
  const data = await response.json()
  return data.history || []
}

export const useHistory = () => {
  return useQuery({
    queryKey: ['history'],
    queryFn: fetchHistory,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}