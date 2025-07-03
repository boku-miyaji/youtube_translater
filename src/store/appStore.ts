import { create } from 'zustand'
import { VideoMetadata } from '../types'

interface AppState {
  // UI State
  sidebarCollapsed: boolean
  currentVideo: VideoMetadata | null
  loading: boolean
  
  // User Preferences
  language: string
  theme: 'light' | 'dark'
  
  // Actions
  setSidebarCollapsed: (collapsed: boolean) => void
  setCurrentVideo: (video: VideoMetadata | null) => void
  setLoading: (loading: boolean) => void
  setLanguage: (language: string) => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  sidebarCollapsed: false,
  currentVideo: null,
  loading: false,
  language: 'original',
  theme: 'light',
  
  // Actions
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setCurrentVideo: (video) => set({ currentVideo: video }),
  setLoading: (loading) => set({ loading }),
  setLanguage: (language) => set({ language }),
  setTheme: (theme) => set({ theme }),
}))