import fs from 'fs';
import path from 'path';

// Database schema for tracking analysis progress
export interface AnalysisProgressRecord {
  id: string;
  startTime: string;
  endTime: string;
  contentType: 'youtube' | 'audio' | 'pdf';
  contentDuration: number; // in seconds
  transcriptionModel: string;
  gptModel: string;
  
  // Progress tracking
  transcriptionStartTime: string;
  transcriptionEndTime: string;
  transcriptionDuration: number; // actual time taken in seconds
  
  summaryStartTime: string;
  summaryEndTime: string;
  summaryDuration: number; // actual time taken in seconds
  
  // Content characteristics that affect processing time
  contentLength: number; // transcript length in characters
  audioQuality?: 'high' | 'medium' | 'low';
  language?: string;
  
  // Results
  success: boolean;
  error?: string;
  
  // Additional metadata
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisProgressStats {
  transcriptionStats: {
    averageSecondsPerMinute: number;
    confidenceLevel: number;
    sampleSize: number;
    modelStats: Record<string, {
      averageSecondsPerMinute: number;
      sampleSize: number;
    }>;
  };
  summaryStats: {
    averageSecondsPerMinute: number;
    confidenceLevel: number;
    sampleSize: number;
    modelStats: Record<string, {
      averageSecondsPerMinute: number;
      sampleSize: number;
    }>;
  };
  contentTypeStats: Record<string, {
    transcriptionAverage: number;
    summaryAverage: number;
    sampleSize: number;
  }>;
}

export class AnalysisProgressDatabase {
  private dbPath: string;
  private records: AnalysisProgressRecord[] = [];

  constructor() {
    this.dbPath = path.join('history', 'analysis-progress.json');
    this.ensureDirectoryExists();
    this.loadRecords();
  }

  private ensureDirectoryExists() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadRecords() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf-8');
        this.records = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading analysis progress records:', error);
      this.records = [];
    }
  }

  private saveRecords() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.records, null, 2));
    } catch (error) {
      console.error('Error saving analysis progress records:', error);
    }
  }

  // Create new analysis progress record
  createRecord(
    contentType: 'youtube' | 'audio' | 'pdf',
    contentDuration: number,
    transcriptionModel: string,
    gptModel: string,
    contentLength: number,
    audioQuality?: 'high' | 'medium' | 'low',
    language?: string
  ): string {
    const id = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const record: AnalysisProgressRecord = {
      id,
      startTime: now,
      endTime: '',
      contentType,
      contentDuration,
      transcriptionModel,
      gptModel,
      transcriptionStartTime: '',
      transcriptionEndTime: '',
      transcriptionDuration: 0,
      summaryStartTime: '',
      summaryEndTime: '',
      summaryDuration: 0,
      contentLength,
      audioQuality,
      language,
      success: false,
      createdAt: now,
      updatedAt: now
    };

    this.records.push(record);
    this.saveRecords();
    return id;
  }

  // Update transcription progress
  updateTranscriptionProgress(id: string, startTime: string, endTime?: string) {
    const record = this.records.find(r => r.id === id);
    if (record) {
      record.transcriptionStartTime = startTime;
      if (endTime) {
        record.transcriptionEndTime = endTime;
        record.transcriptionDuration = Math.ceil(
          (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
        );
      }
      record.updatedAt = new Date().toISOString();
      this.saveRecords();
    }
  }

  // Update summary progress
  updateSummaryProgress(id: string, startTime: string, endTime?: string) {
    const record = this.records.find(r => r.id === id);
    if (record) {
      record.summaryStartTime = startTime;
      if (endTime) {
        record.summaryEndTime = endTime;
        record.summaryDuration = Math.ceil(
          (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
        );
      }
      record.updatedAt = new Date().toISOString();
      this.saveRecords();
    }
  }

  // Complete analysis
  completeAnalysis(id: string, success: boolean, error?: string) {
    const record = this.records.find(r => r.id === id);
    if (record) {
      record.endTime = new Date().toISOString();
      record.success = success;
      record.error = error;
      record.updatedAt = new Date().toISOString();
      this.saveRecords();
    }
  }

  // Get analysis statistics
  getAnalysisStats(): AnalysisProgressStats {
    const successfulRecords = this.records.filter(r => r.success && r.transcriptionDuration > 0 && r.summaryDuration > 0);
    
    if (successfulRecords.length === 0) {
      return this.getDefaultStats();
    }

    // Calculate transcription statistics
    const transcriptionStats = this.calculateTranscriptionStats(successfulRecords);
    const summaryStats = this.calculateSummaryStats(successfulRecords);
    const contentTypeStats = this.calculateContentTypeStats(successfulRecords);

    return {
      transcriptionStats,
      summaryStats,
      contentTypeStats
    };
  }

  private calculateTranscriptionStats(records: AnalysisProgressRecord[]) {
    const transcriptionTimes = records.map(r => ({
      secondsPerMinute: r.transcriptionDuration / (r.contentDuration / 60),
      model: r.transcriptionModel
    }));

    const averageSecondsPerMinute = transcriptionTimes.reduce((sum, t) => sum + t.secondsPerMinute, 0) / transcriptionTimes.length;
    
    // Calculate model-specific stats
    const modelStats: Record<string, { averageSecondsPerMinute: number; sampleSize: number }> = {};
    const modelGroups = transcriptionTimes.reduce((groups, t) => {
      if (!groups[t.model]) groups[t.model] = [];
      groups[t.model].push(t.secondsPerMinute);
      return groups;
    }, {} as Record<string, number[]>);

    Object.keys(modelGroups).forEach(model => {
      const times = modelGroups[model];
      modelStats[model] = {
        averageSecondsPerMinute: times.reduce((sum, t) => sum + t, 0) / times.length,
        sampleSize: times.length
      };
    });

    return {
      averageSecondsPerMinute,
      confidenceLevel: Math.min(0.95, records.length / 10), // Confidence increases with sample size
      sampleSize: records.length,
      modelStats
    };
  }

  private calculateSummaryStats(records: AnalysisProgressRecord[]) {
    const summaryTimes = records.map(r => ({
      secondsPerMinute: r.summaryDuration / (r.contentDuration / 60),
      model: r.gptModel
    }));

    const averageSecondsPerMinute = summaryTimes.reduce((sum, t) => sum + t.secondsPerMinute, 0) / summaryTimes.length;
    
    // Calculate model-specific stats
    const modelStats: Record<string, { averageSecondsPerMinute: number; sampleSize: number }> = {};
    const modelGroups = summaryTimes.reduce((groups, t) => {
      if (!groups[t.model]) groups[t.model] = [];
      groups[t.model].push(t.secondsPerMinute);
      return groups;
    }, {} as Record<string, number[]>);

    Object.keys(modelGroups).forEach(model => {
      const times = modelGroups[model];
      modelStats[model] = {
        averageSecondsPerMinute: times.reduce((sum, t) => sum + t, 0) / times.length,
        sampleSize: times.length
      };
    });

    return {
      averageSecondsPerMinute,
      confidenceLevel: Math.min(0.95, records.length / 10), // Confidence increases with sample size
      sampleSize: records.length,
      modelStats
    };
  }

  private calculateContentTypeStats(records: AnalysisProgressRecord[]) {
    const contentTypeStats: Record<string, { transcriptionAverage: number; summaryAverage: number; sampleSize: number }> = {};

    const contentTypeGroups = records.reduce((groups, r) => {
      if (!groups[r.contentType]) groups[r.contentType] = [];
      groups[r.contentType].push(r);
      return groups;
    }, {} as Record<string, AnalysisProgressRecord[]>);

    Object.keys(contentTypeGroups).forEach(contentType => {
      const records = contentTypeGroups[contentType];

      // IMPORTANT: PDF uses page-based calculation, video/audio use duration-based
      if (contentType === 'pdf') {
        // For PDF: contentDuration represents page count, not seconds
        // Calculate seconds per page
        const transcriptionAverage = records.reduce((sum, r) => sum + r.transcriptionDuration / r.contentDuration, 0) / records.length;
        const summaryAverage = records.reduce((sum, r) => sum + r.summaryDuration / r.contentDuration, 0) / records.length;

        contentTypeStats[contentType] = {
          transcriptionAverage, // seconds per page
          summaryAverage,       // seconds per page
          sampleSize: records.length
        };
      } else {
        // For video/audio: contentDuration is in seconds, calculate seconds per minute
        const transcriptionAverage = records.reduce((sum, r) => sum + r.transcriptionDuration / (r.contentDuration / 60), 0) / records.length;
        const summaryAverage = records.reduce((sum, r) => sum + r.summaryDuration / (r.contentDuration / 60), 0) / records.length;

        contentTypeStats[contentType] = {
          transcriptionAverage, // seconds per minute
          summaryAverage,       // seconds per minute
          sampleSize: records.length
        };
      }
    });

    return contentTypeStats;
  }

  private getDefaultStats(): AnalysisProgressStats {
    return {
      transcriptionStats: {
        averageSecondsPerMinute: 6, // Default: 6 seconds per minute of content
        confidenceLevel: 0.1,
        sampleSize: 0,
        modelStats: {}
      },
      summaryStats: {
        averageSecondsPerMinute: 30, // Default: 30 seconds per minute of content
        confidenceLevel: 0.1,
        sampleSize: 0,
        modelStats: {}
      },
      contentTypeStats: {}
    };
  }

  // Get recent records for debugging
  getRecentRecords(limit = 10): AnalysisProgressRecord[] {
    return this.records
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  // Clean up old records (keep last 100 successful + 50 failed)
  cleanupOldRecords() {
    const successfulRecords = this.records.filter(r => r.success).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const failedRecords = this.records.filter(r => !r.success).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    this.records = [
      ...successfulRecords.slice(0, 100),
      ...failedRecords.slice(0, 50)
    ];
    
    this.saveRecords();
  }
}

// Export singleton instance
export const analysisProgressDB = new AnalysisProgressDatabase();