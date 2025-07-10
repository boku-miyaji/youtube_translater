import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Sidebar from '../../src/components/layout/Sidebar'

// Mock the app store
jest.mock('../../src/store/appStore', () => ({
  useAppStore: () => ({
    sidebarCollapsed: false,
    setSidebarCollapsed: jest.fn()
  })
}))

describe('Sidebar Component', () => {
  const renderSidebar = (collapsed = false) => {
    const mockStore = {
      sidebarCollapsed: collapsed,
      setSidebarCollapsed: jest.fn()
    }
    
    jest.doMock('../../src/store/appStore', () => ({
      useAppStore: () => mockStore
    }))
    
    return render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    )
  }

  it('should render sidebar with navigation items', () => {
    const { getByTestId } = renderSidebar()
    expect(getByTestId('sidebar')).toBeInTheDocument()
  })

  it('should have correct width when collapsed', () => {
    const { getByTestId } = renderSidebar(true)
    const sidebar = getByTestId('sidebar')
    expect(sidebar).toHaveClass('w-20')
  })

  it('should have correct width when expanded', () => {
    const { getByTestId } = renderSidebar(false)
    const sidebar = getByTestId('sidebar')
    expect(sidebar).toHaveClass('w-80')
  })
})