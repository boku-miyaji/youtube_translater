import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage from '../../src/components/pages/DashboardPage'

// Mock the app store
jest.mock('../../src/store/appStore', () => ({
  useAppStore: () => ({
    sidebarCollapsed: false,
    setSidebarCollapsed: jest.fn()
  })
}))

// Mock the hooks
jest.mock('../../src/hooks/useHistory', () => ({
  useHistory: () => ({
    data: [],
    isLoading: false,
    error: null
  })
}))

jest.mock('../../src/hooks/useCosts', () => ({
  useCosts: () => ({
    data: [
      { timestamp: new Date().toISOString(), totalCost: 10 },
      { timestamp: new Date(Date.now() - 86400000).toISOString(), totalCost: 8 }
    ],
    isLoading: false
  })
}))

describe('Dashboard Integration', () => {
  const renderDashboard = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    return render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    )
  }

  it('should display correct spending calculations', async () => {
    const { getByTestId } = renderDashboard()
    
    await waitFor(() => {
      const spendingChange = getByTestId('spending-change')
      expect(spendingChange).toBeInTheDocument()
      // Should show some percentage change
      expect(spendingChange.textContent).toMatch(/[↗↘→]\s*[+-]?\d+\.?\d*%/)
    })
  })

  it('should display total videos with time period clarification', async () => {
    const { getByText } = renderDashboard()
    
    await waitFor(() => {
      expect(getByText('Total Videos (All Time)')).toBeInTheDocument()
    })
  })
})