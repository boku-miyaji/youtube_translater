export interface YouTubeMetadata {
  title: string;
  channel: string;
  viewCount: number;
  likes: number;
  duration: number;
  uploadDate: string;
  publishDate: string;
  category: string;
  description: string;
  chapters: Array<{
    title: string;
    start: number;
  }>;
  captions: string[];
  stats: {
    formatCount: number;
    hasSubtitles: boolean;
    keywords: string[];
  };
}

export interface YouTubeApiError {
  status: 'error';
  message: string;
  code?: string;
}

export interface VideoMetadata {
  basic?: {
    title?: string;
    videoId?: string;
    duration?: number;
    channel?: string;
    viewCount?: number;
    likes?: number;
    uploadDate?: string;
    publishDate?: string;
    category?: string;
    description?: string;
    videoPath?: string;  // Path to local video file
    thumbnail?: string;  // YouTube thumbnail URL
  };
  chapters?: Array<{ title: string; start: number }>;
  captions?: string[];
  stats?: {
    formatCount: number;
    hasSubtitles: boolean;
    keywords: string[];
  };
  transcript?: string;
  summary?: string;
  timestampedSegments?: TimestampedSegment[];
  transcriptSource?: 'subtitle' | 'whisper';
  // Computed properties
  costs?: DetailedCosts;
  analysisTime?: {
    transcription: number;
    summary: number;
    total: number;
  };
  // File-specific properties
  source?: 'url' | 'file';
  fileId?: string;
  originalFilename?: string;
  fileSize?: number;
  uploadedAt?: string;
}

export interface VideoListItem {
  id: string;
  title: string;
  channel: string;
  uploadDate: string;
  viewCount: number;
  likes: number;
  savedAt: string;
  analyzedAt?: string;
  previewImage?: string;  // YouTube thumbnail URL or file preview
  source: 'youtube' | 'file';  // Source of the video
  fileDetails?: {  // Additional details for uploaded files
    originalName: string;
    size: number;
    mimeType: string;
  };
}

export interface HistoryListResponse {
  videos: VideoListItem[];
  totalCount: number;
}

export interface ApiResponse {
  title?: string;
  videoId?: string;
  metadata?: {
    basic?: {
      title?: string;
      videoId?: string;
      duration?: number;
      channel?: string;
      viewCount?: number;
      likes?: number;
      uploadDate?: string;
      publishDate?: string;
      category?: string;
      description?: string;
      videoPath?: string;
      thumbnail?: string;
    };
    chapters?: Array<{ title: string; start: number }>;
    captions?: string[];
    stats?: {
      formatCount: number;
      hasSubtitles: boolean;
      keywords: string[];
    };
    analysisTime?: {
      transcription: number;
      summary: number;
      total: number;
    };
  };
  transcript?: string;
  summary?: string;
  method?: 'subtitle' | 'whisper';
  detectedLanguage?: string;
  timestampedSegments?: TimestampedSegment[];
  cost?: number;
  costs?: DetailedCosts;
  message: string;
  error?: string;
  fromHistory?: boolean;
}

export interface PromptTemplate {
  name: string;
  template: string;
}

export interface PromptsConfig {
  summary?: PromptTemplate;
  article?: PromptTemplate;
  [key: string]: PromptTemplate | undefined;
}

export interface TranscriptionResult {
  text: string;
  timestampedSegments: TimestampedSegment[];
}

export interface SubtitlesResult {
  text: string;
  detectedLanguage: string;
  timestampedSegments: TimestampedSegment[];
}

// Transcription models
export type TranscriptionModel = 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe' | 'whisper-1';

// Express request extensions
export interface UploadYouTubeRequest {
  url: string;
  language?: string;
  gptModel?: string;
  transcriptionModel?: TranscriptionModel;
  mainTags?: string[];
  tags?: string;
  forceRegenerate?: boolean;
}

export interface ChatRequest {
  message: string;
  gptModel?: string;
}

export interface RegenerateSummaryRequest {
  url: string;
  language?: string;
  gptModel?: string;
}

export interface LoadFromHistoryRequest {
  videoId: string;
}

export interface SaveArticleRequest {
  videoId: string;
  article: string;
}

export interface PromptSaveRequest {
  type: string;
  template: string;
}

export interface MergeArticleRequest {
  existingArticle: string;
  userInstruction: string;
  aiResponse: string;
  gptModel?: string;
  videoId?: string;
}

// New types for video file upload
export interface VideoFile {
  file: File;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  preview?: string;  // Data URL for preview
}

export interface VideoUploadRequest {
  file: File;
  language?: string;
  gptModel?: string;
  transcriptionModel?: TranscriptionModel;
  generateSummary?: boolean;
  generateArticle?: boolean;
}

export interface VideoUploadResponse extends ApiResponse {
  fileId?: string;
  originalName?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
  analysisTime?: {
    transcription: number;
    summary: number;
    total: number;
  };
}

// Session cost tracking
export interface SessionCosts {
  whisper: number;
  gpt: number;
  total: number;
}

// History entry for stored videos
export interface HistoryEntry {
  id: string;
  videoId?: string;
  title: string;
  channel?: string;
  uploadDate?: string;
  savedAt: string;
  transcript?: string;
  summary?: string;
  article?: string;
  metadata?: VideoMetadata;
  costs?: DetailedCosts;
  analysisTime?: {
    transcription: number;
    summary: number;
    total: number;
  };
  source?: 'url' | 'file';
  fileId?: string;
  originalFilename?: string;
  fileSize?: number;
}

// Cost entry for tracking individual costs
export interface CostEntry {
  date: string;
  service: 'whisper' | 'gpt' | 'total';
  cost: number;
}

// Article history entry
export interface ArticleHistoryEntry {
  date: string;
  article: string;
}

// Summary interface  
export interface Summary {
  text: string;
  sections?: Array<{
    title: string;
    content: string;
  }>;
}

// Upload video file response
export interface UploadVideoFileResponse {
  title: string;
  metadata: VideoMetadata;
  transcript: string;
  summary: string;
  timestampedSegments: TimestampedSegment[];
  method: 'subtitle' | 'whisper';
  detectedLanguage?: string;
  costs: DetailedCosts;
  analysisTime: {
    transcription: number;
    summary: number;
    total: number;
  };
}

// Pricing configuration
export interface Pricing {
  input: number;
  output: number;
  whisper?: number;  // per minute
  transcription?: {
    'whisper-1': number;  // per minute
    'gpt-4o-transcribe': number;  // per 1M tokens
    'gpt-4o-mini-transcribe': number;  // per 1M tokens
  };
  models?: {
    [key: string]: {
      input: number;
      output: number;
    };
  };
}

export interface TimestampedSegment {
  start: number;
  end: number;
  text: string;
  duration?: number;
}

export interface DetailedCosts {
  transcription: number;
  summary: number;
  article: number;
  total: number;
}

// Cost estimation types
export interface CostEstimationRequest {
  url: string;
  gptModel?: string;
  transcriptionModel?: TranscriptionModel;
  generateSummary?: boolean;
  generateArticle?: boolean;
}

export interface CostEstimationResponse {
  success: boolean;
  title?: string;
  duration?: number;  // seconds
  durationFormatted?: string;
  gptModel?: string;  // GPT model used for cost calculation
  estimatedCosts?: {
    transcription: number;
    summary: number;
    article: number;
    total: number;
  };
  estimatedProcessingTime?: {
    transcription: number;  // seconds
    summary: number;        // seconds
    total: number;          // seconds
    formatted: string;      // e.g., "2 min 30 sec"
  };
  error?: string;
  message?: string;
}

export interface FileCostEstimationResponse {
  success: boolean;
  filename?: string;
  duration?: number;  // seconds
  durationFormatted?: string;
  gptModel?: string;  // GPT model used for cost calculation
  estimatedCosts?: {
    transcription: number;
    summary: number;
    article: number;
    total: number;
  };
  estimatedProcessingTime?: {
    transcription: number;  // seconds
    summary: number;        // seconds
    total: number;          // seconds
    formatted: string;      // e.g., "2 min 30 sec"
  };
  error?: string;
  message?: string;
}

// Progress tracking interface
export interface AnalysisProgress {
  stage: 'transcription' | 'summary' | 'complete';
  percentage: number;
  message: string;
  estimatedRemainingTime: number;  // seconds
}