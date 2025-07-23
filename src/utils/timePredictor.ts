import { formatProcessingTime } from './formatTime'

// Types for prediction system
export interface PredictionInput {
  contentType: 'youtube' | 'pdf' | 'audio' | 'video'
  duration?: number // YouTube/audio/video duration in seconds
  fileSize?: number // PDF/file size in bytes
  transcriptionModel: string
  gptModel: string
  language: string
  characterCount?: number // For PDF text length
}

export interface PredictionResult {
  transcription: number // predicted time in seconds
  summary: number // predicted time in seconds
  total: number // total predicted time in seconds
  confidence: number // confidence level 0-1
  formatted: string // formatted time string
  basedOn: 'historical' | 'model_default' | 'global_default'
  sampleSize: number // number of historical samples used
  transcriptionRate?: string // display rate (e.g., "6.2s/min")
  summaryRate?: string // display rate (e.g., "32.1s/min")
}

export interface HistoryEntry {
  id: string
  title: string
  url: string
  transcript: string
  method: 'subtitle' | 'whisper'
  language: string
  gptModel: string
  cost: number
  metadata?: any
  summary?: string
  timestamp: string
  analysisTime?: {
    startTime?: string
    endTime?: string
    duration?: number
    transcription?: number
    extraction?: number // for PDF
    summary?: number
    total?: number
  }
}

export interface ProcessingTimeStats {
  transcriptionStats: {
    [key: string]: {
      averageSecondsPerMinute: number
      averageSecondsPerMB?: number // for PDF
      averageSecondsPerKChar?: number // per 1000 characters
      sampleSize: number
      recentSamples: number[]
    }
  }
  summaryStats: {
    [key: string]: {
      averageSecondsPerMinute: number
      averageSecondsPerKChar: number
      sampleSize: number
      recentSamples: number[]
    }
  }
  contentTypeMultipliers: {
    [key: string]: {
      transcriptionMultiplier: number
      summaryMultiplier: number
      sampleSize: number
    }
  }
}

export class ProcessingTimePredictor {
  private historyData: HistoryEntry[] = []
  private stats: ProcessingTimeStats | null = null

  constructor(historyData: HistoryEntry[] = []) {
    this.historyData = historyData
    this.calculateStats()
  }

  // Main prediction function
  predictProcessingTime(input: PredictionInput): PredictionResult {
    const stats = this.getStats()
    
    // Default values (fallback)
    const defaults = {
      transcription: this.getDefaultTranscriptionTime(input),
      summary: this.getDefaultSummaryTime(input),
    }

    let transcriptionTime = defaults.transcription
    let summaryTime = defaults.summary
    let confidence = 0.1 // low confidence for defaults
    let basedOn: 'historical' | 'model_default' | 'global_default' = 'global_default'
    let sampleSize = 0

    // Try to use historical data first
    const historicalPrediction = this.getPredictionFromHistory(input, stats)
    if (historicalPrediction.confidence > 0.3) {
      transcriptionTime = historicalPrediction.transcription
      summaryTime = historicalPrediction.summary
      confidence = historicalPrediction.confidence
      basedOn = 'historical'
      sampleSize = historicalPrediction.sampleSize
    } else {
      // Use model-specific defaults if available
      const modelDefaults = this.getModelDefaults(input)
      if (modelDefaults.confidence > confidence) {
        transcriptionTime = modelDefaults.transcription
        summaryTime = modelDefaults.summary
        confidence = modelDefaults.confidence
        basedOn = 'model_default'
      }
    }

    // Apply content type multipliers if available
    const contentMultipliers = stats.contentTypeMultipliers[input.contentType]
    if (contentMultipliers && contentMultipliers.sampleSize >= 2) {
      transcriptionTime *= contentMultipliers.transcriptionMultiplier
      summaryTime *= contentMultipliers.summaryMultiplier
      confidence = Math.min(0.95, confidence + 0.1) // slight confidence boost
    }

    const totalTime = transcriptionTime + summaryTime

    // Generate display rates
    const transcriptionRate = this.generateRateString(input, transcriptionTime, 'transcription')
    const summaryRate = this.generateRateString(input, summaryTime, 'summary')

    return {
      transcription: transcriptionTime < 1 ? parseFloat(transcriptionTime.toFixed(1)) : Math.round(transcriptionTime),
      summary: summaryTime < 1 ? parseFloat(summaryTime.toFixed(1)) : Math.round(summaryTime),
      total: totalTime < 1 ? parseFloat(totalTime.toFixed(1)) : Math.round(totalTime),
      confidence,
      formatted: formatProcessingTime(totalTime),
      basedOn,
      sampleSize,
      transcriptionRate,
      summaryRate
    }
  }

  private calculateStats(): void {
    if (this.historyData.length === 0) {
      this.stats = {
        transcriptionStats: {},
        summaryStats: {},
        contentTypeMultipliers: {}
      }
      return
    }

    const stats: ProcessingTimeStats = {
      transcriptionStats: {},
      summaryStats: {},
      contentTypeMultipliers: {}
    }

    // Filter recent entries (last 30 days) for better prediction
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentEntries = this.historyData.filter(entry => {
      const entryDate = new Date(entry.timestamp)
      return entryDate >= thirtyDaysAgo && entry.analysisTime
    })

    // Group by transcription method
    const transcriptionGroups: { [key: string]: any[] } = {}
    const summaryGroups: { [key: string]: any[] } = {}
    const contentTypeGroups: { [key: string]: any[] } = {}

    recentEntries.forEach(entry => {
      if (!entry.analysisTime) return

      const transcriptionKey = entry.method || 'whisper'
      const summaryKey = entry.gptModel || 'gpt-4o-mini'
      const contentType = this.inferContentType(entry)

      // Group transcription data
      if (!transcriptionGroups[transcriptionKey]) {
        transcriptionGroups[transcriptionKey] = []
      }

      // Group summary data
      if (!summaryGroups[summaryKey]) {
        summaryGroups[summaryKey] = []
      }

      // Group content type data
      if (!contentTypeGroups[contentType]) {
        contentTypeGroups[contentType] = []
      }

      const analysisTime = entry.analysisTime
      const duration = entry.metadata?.basic?.duration || 300 // default 5 min
      const textLength = (entry.transcript?.length || 0) / 1000 // in thousands of characters

      transcriptionGroups[transcriptionKey].push({
        time: analysisTime.transcription || analysisTime.extraction || 0,
        duration,
        textLength,
        entry
      })

      summaryGroups[summaryKey].push({
        time: analysisTime.summary || 0,
        duration,
        textLength,
        entry
      })

      contentTypeGroups[contentType].push({
        transcriptionTime: analysisTime.transcription || analysisTime.extraction || 0,
        summaryTime: analysisTime.summary || 0,
        duration,
        textLength,
        entry
      })
    })

    // Calculate transcription statistics
    Object.keys(transcriptionGroups).forEach(key => {
      const samples = transcriptionGroups[key]
      if (samples.length >= 2) {
        // Remove outliers (beyond 2 standard deviations)
        const cleanSamples = this.removeOutliers(samples.map(s => s.time))
        const rates = samples
          .filter(s => cleanSamples.includes(s.time) && s.duration > 0)
          .map(s => s.time / (s.duration / 60)) // seconds per minute

        if (rates.length > 0) {
          stats.transcriptionStats[key] = {
            averageSecondsPerMinute: rates.reduce((a, b) => a + b, 0) / rates.length,
            sampleSize: rates.length,
            recentSamples: rates.slice(-5)
          }

          // Add per-character rate for text-based content
          const charRates = samples
            .filter(s => cleanSamples.includes(s.time) && s.textLength > 0)
            .map(s => s.time / s.textLength)
          
          if (charRates.length > 0) {
            stats.transcriptionStats[key].averageSecondsPerKChar = 
              charRates.reduce((a, b) => a + b, 0) / charRates.length
          }
        }
      }
    })

    // Calculate summary statistics
    Object.keys(summaryGroups).forEach(key => {
      const samples = summaryGroups[key]
      if (samples.length >= 2) {
        const cleanSamples = this.removeOutliers(samples.map(s => s.time))
        const rates = samples
          .filter(s => cleanSamples.includes(s.time) && s.duration > 0)
          .map(s => s.time / (s.duration / 60))

        const charRates = samples
          .filter(s => cleanSamples.includes(s.time) && s.textLength > 0)
          .map(s => s.time / s.textLength)

        if (rates.length > 0 && charRates.length > 0) {
          stats.summaryStats[key] = {
            averageSecondsPerMinute: rates.reduce((a, b) => a + b, 0) / rates.length,
            averageSecondsPerKChar: charRates.reduce((a, b) => a + b, 0) / charRates.length,
            sampleSize: Math.min(rates.length, charRates.length),
            recentSamples: rates.slice(-5)
          }
        }
      }
    })

    // Calculate content type multipliers (relative to youtube baseline)
    const youtubeBaseline = contentTypeGroups['youtube']
    if (youtubeBaseline && youtubeBaseline.length >= 2) {
      const baselineTranscription = youtubeBaseline.reduce((sum, sample) => 
        sum + sample.transcriptionTime, 0) / youtubeBaseline.length
      const baselineSummary = youtubeBaseline.reduce((sum, sample) => 
        sum + sample.summaryTime, 0) / youtubeBaseline.length

      Object.keys(contentTypeGroups).forEach(contentType => {
        const samples = contentTypeGroups[contentType]
        if (samples.length >= 2) {
          const avgTranscription = samples.reduce((sum, sample) => 
            sum + sample.transcriptionTime, 0) / samples.length
          const avgSummary = samples.reduce((sum, sample) => 
            sum + sample.summaryTime, 0) / samples.length

          stats.contentTypeMultipliers[contentType] = {
            transcriptionMultiplier: avgTranscription / baselineTranscription,
            summaryMultiplier: avgSummary / baselineSummary,
            sampleSize: samples.length
          }
        }
      })
    }

    this.stats = stats
  }

  private getPredictionFromHistory(input: PredictionInput, stats: ProcessingTimeStats): 
    { transcription: number, summary: number, confidence: number, sampleSize: number } {
    
    const transcriptionStats = stats.transcriptionStats[input.transcriptionModel] || 
                               stats.transcriptionStats['whisper'] || 
                               stats.transcriptionStats['whisper-1']
    
    const summaryStats = stats.summaryStats[input.gptModel]

    let transcriptionTime = 0
    let summaryTime = 0
    let confidence = 0
    let sampleSize = 0

    if (transcriptionStats && transcriptionStats.sampleSize >= 2) {
      if (input.contentType === 'pdf' && input.characterCount && transcriptionStats.averageSecondsPerKChar) {
        // PDF: use character-based prediction
        transcriptionTime = (input.characterCount / 1000) * transcriptionStats.averageSecondsPerKChar
      } else if (input.duration && transcriptionStats.averageSecondsPerMinute) {
        // YouTube/Audio/Video: use duration-based prediction
        transcriptionTime = (input.duration / 60) * transcriptionStats.averageSecondsPerMinute
      }

      if (transcriptionTime > 0) {
        confidence = Math.min(0.9, transcriptionStats.sampleSize / 10)
        sampleSize += transcriptionStats.sampleSize
      }
    }

    if (summaryStats && summaryStats.sampleSize >= 2) {
      if (input.characterCount && summaryStats.averageSecondsPerKChar) {
        // Use character-based prediction for summary
        summaryTime = (input.characterCount / 1000) * summaryStats.averageSecondsPerKChar
      } else if (input.duration && summaryStats.averageSecondsPerMinute) {
        // Use duration-based prediction for summary
        summaryTime = (input.duration / 60) * summaryStats.averageSecondsPerMinute
      }

      if (summaryTime > 0) {
        confidence = Math.max(confidence, Math.min(0.9, summaryStats.sampleSize / 10))
        sampleSize += summaryStats.sampleSize
      }
    }

    return {
      transcription: transcriptionTime,
      summary: summaryTime,
      confidence,
      sampleSize: Math.round(sampleSize / 2) // average since we counted both
    }
  }

  private getModelDefaults(input: PredictionInput): 
    { transcription: number, summary: number, confidence: number } {
    
    // Model-specific default processing speeds (based on typical performance)
    const transcriptionDefaults: { [key: string]: number } = {
      'whisper-1': 6.0,           // ~6 seconds per minute of audio
      'gpt-4o-transcribe': 8.0,   // slower but more accurate
      'gpt-4o-mini-transcribe': 4.0
    }

    const summaryDefaults: { [key: string]: number } = {
      'gpt-4o-mini': 0.8,   // coefficient for summary time calculation
      'gpt-4o': 1.2,
      'gpt-4-turbo': 1.5,
      'gpt-4': 2.0,
      'gpt-3.5-turbo': 0.6
    }

    let transcriptionTime = this.getDefaultTranscriptionTime(input)
    let summaryTime = this.getDefaultSummaryTime(input)
    let confidence = 0.3 // moderate confidence for model defaults

    // Apply model-specific rates
    const transcriptionRate = transcriptionDefaults[input.transcriptionModel]
    if (transcriptionRate && input.duration) {
      transcriptionTime = (input.duration / 60) * transcriptionRate
    } else if (input.contentType === 'pdf' && input.characterCount) {
      // PDF default: ~1.5 seconds per 1000 characters for extraction (more realistic)
      transcriptionTime = (input.characterCount / 1000) * 1.5
    }

    const summaryCoeff = summaryDefaults[input.gptModel]
    if (summaryCoeff && input.duration) {
      summaryTime = (input.duration / 60) * 30 * summaryCoeff // base 30s/min adjusted by model
    } else if (input.contentType === 'pdf' && input.characterCount) {
      // PDF summary: ~3 seconds per 1000 characters (more realistic)
      summaryTime = (input.characterCount / 1000) * 3 * (summaryCoeff || 0.8)
    }

    return {
      transcription: transcriptionTime,
      summary: summaryTime,
      confidence
    }
  }

  private getDefaultTranscriptionTime(input: PredictionInput): number {
    if (input.duration) {
      return (input.duration / 60) * 6 // 6 seconds per minute default
    } else if (input.characterCount) {
      return (input.characterCount / 1000) * 1.5 // 1.5 seconds per 1000 chars for PDF (more realistic)
    }
    return 30 // global fallback
  }

  private getDefaultSummaryTime(input: PredictionInput): number {
    if (input.duration) {
      return (input.duration / 60) * 30 // 30 seconds per minute default
    } else if (input.characterCount) {
      return (input.characterCount / 1000) * 3 // 3 seconds per 1000 chars for PDF (more realistic)
    }
    return 60 // global fallback
  }

  private generateRateString(input: PredictionInput, time: number, type: 'transcription' | 'summary'): string {
    if (input.duration && input.duration > 0) {
      const rate = time / (input.duration / 60)
      return `${rate.toFixed(1)}s/min`
    } else if (input.characterCount && input.characterCount > 0) {
      const rate = time / (input.characterCount / 1000)
      return `${rate.toFixed(2)}s/1k chars`
    }
    return `${formatProcessingTime(time)}`
  }

  private inferContentType(entry: HistoryEntry): string {
    if (entry.url.includes('.pdf') || entry.url.includes('arxiv') || entry.url.includes('doi')) {
      return 'pdf'
    }
    if (entry.url.includes('youtube.com') || entry.url.includes('youtu.be')) {
      return 'youtube'
    }
    if (entry.url.startsWith('file://')) {
      if (entry.url.includes('.mp3') || entry.url.includes('.wav')) {
        return 'audio'
      }
      return 'video'
    }
    return 'youtube' // default
  }

  private removeOutliers(data: number[]): number[] {
    if (data.length < 4) return data

    const sorted = [...data].sort((a, b) => a - b)
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length
    const stdDev = Math.sqrt(sorted.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / sorted.length)
    
    // Remove values beyond 2 standard deviations
    return data.filter(value => Math.abs(value - mean) <= 2 * stdDev)
  }

  private getStats(): ProcessingTimeStats {
    if (!this.stats) {
      this.calculateStats()
    }
    return this.stats!
  }

  // Public method to get statistics summary
  getStatsSummary(): { 
    totalHistoricalEntries: number,
    recentEntries: number,
    modelsWithStats: { transcription: string[], summary: string[] },
    contentTypes: string[]
  } {
    const stats = this.getStats()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentCount = this.historyData.filter(entry => 
      new Date(entry.timestamp) >= thirtyDaysAgo
    ).length

    return {
      totalHistoricalEntries: this.historyData.length,
      recentEntries: recentCount,
      modelsWithStats: {
        transcription: Object.keys(stats.transcriptionStats),
        summary: Object.keys(stats.summaryStats)
      },
      contentTypes: Object.keys(stats.contentTypeMultipliers)
    }
  }
}

// Utility function to create predictor instance (can be used from components)
export function createTimePredictor(historyData: HistoryEntry[]): ProcessingTimePredictor {
  return new ProcessingTimePredictor(historyData)
}