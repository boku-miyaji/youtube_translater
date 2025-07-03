import { useQuery } from '@tanstack/react-query'

const fetchCosts = async () => {
  const response = await fetch('/api/costs')
  if (!response.ok) {
    throw new Error('Failed to fetch costs')
  }
  return response.json()
}

export const useCosts = () => {
  return useQuery({
    queryKey: ['costs'],
    queryFn: fetchCosts,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}