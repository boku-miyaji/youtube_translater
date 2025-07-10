export interface VideoMetadata {
  basic: {
    title: string;
    videoId?: string;        // YouTube video ID (optional for file uploads)
    duration: number;
    channel?: string;        // YouTube only
    viewCount?: number;      // YouTube only
    likes?: number;          // YouTube only
    uploadDate?: string;
    publishDate?: string;
    category?: string;
    description?: string;
    thumbnail?: string;
    videoPath?: string;      // Path to uploaded video file (for local files)
  };
  chapters: Chapter[];
  captions: Caption[];
  stats: {
    formatCount: number;
    hasSubtitles: boolean;
    keywords: string[];
  };
  transcript?: string;
  summary?: string;
  timestampedSegments?: TimestampedSegment[];
  transcriptSource?: 'subtitle' | 'whisper';
  costs?: DetailedCosts;
  analysisTime?: AnalysisTimeInfo;
  inferenceStats?: InferenceStats;
  // New fields for file uploads
  source?: 'youtube' | 'file';
  fileId?: string;         // File upload ID
  originalFilename?: string;
  fileSize?: number;       // bytes
  uploadedAt?: string;     // ISO timestamp
}

export interface Chapter {
  timestamp: string;
  title: string;
}

export interface Caption {
  language: string;
  name: string;
}

export interface TimestampedSegment {
  start: number;
  duration: number;
  text: string;
}

export interface Summary {
  content: string;
  model: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
  };
}

export interface AnalysisTimeInfo {
  startTime: string;
  endTime: string;
  duration: number; // seconds
}

export interface InferenceStats {
  apiCallCount: number;
  totalTokens: { input: number; output: number };
  modelUsed: string;
  tokensPerSecond: number;
  costPerToken: number;
  efficiencyScore: number;
  sessionCosts: SessionCosts;
  callBreakdown: {
    transcription: { tokens: { input: number; output: number }, cost: number, method: 'subtitle' | 'whisper' };
    summary: { tokens: { input: number; output: number }, cost: number };
    article?: { tokens: { input: number; output: number }, cost: number };
  };
}

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  transcript: string;
  method: 'subtitle' | 'whisper';
  language: string;
  gptModel: string;
  cost: number;
  metadata: VideoMetadata | null;
  summary: Summary | null;
  timestampedSegments: TimestampedSegment[];
  tags: string[];
  mainTags: string[];
  article: string | null;
  timestamp: string;
  thumbnail?: string;
  analysisTime?: AnalysisTimeInfo;
}

export interface SessionCosts {
  whisper: number;
  gpt: number;
  total: number;
}

export interface ModelPricing {
  input: number;
  output: number;
}

export interface Pricing {
  whisper: number;
  models: {
    [key: string]: ModelPricing;
  };
}

export interface CostEntry {
  videoId: string;
  title: string;
  method: 'subtitle' | 'whisper';
  language: string;
  gptModel: string;
  whisperCost: number;
  gptCost: number;
  totalCost: number;
  timestamp: string;
  date: string;
}

export interface ArticleHistoryEntry {
  article: string;
  type: 'generated' | 'merged' | 'pre-merge' | 'edited';
  timestamp: string;
  id: string;
}

export interface ChatMessage {
  message: string;
  gptModel?: string;
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  error?: string;
  model: string;
  cost: number;
  costs: SessionCosts;
  tokens: {
    input: number;
    output: number;
  };
}

export interface DetailedCosts {
  transcription: number;
  summary: number;
  article: number;
  total: number;
}

export interface UploadResponse {
  success: boolean;
  title?: string;
  transcript?: string;
  summary?: string;
  metadata?: VideoMetadata;
  method?: 'subtitle' | 'whisper';
  language?: string;
  gptModel?: string;
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

// Express request extensions
export interface UploadYouTubeRequest {
  url: string;
  language?: string;
  gptModel?: string;
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
  id: string;
  name: string;
  size: number;
  duration?: number;
  thumbnail?: string;
}

export interface VideoFileUpload {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed' | 'deleted';
  tempPath: string;
  processingResult?: ProcessingResult;
  error?: string;
}

export interface ProcessingResult {
  metadata: VideoMetadata;
  transcript: TimestampedSegment[];
  summary?: string;
  article?: string;
  costs: DetailedCosts;
  analysisTime: AnalysisTimeInfo;
}

export interface UploadVideoFileRequest {
  language?: string;
  gptModel?: string;
  generateSummary?: boolean;
  generateArticle?: boolean;
}

export interface UploadVideoFileResponse {
  success: boolean;
  fileId?: string;
  originalName?: string;
  size?: number;
  duration?: number;
  status?: 'uploaded' | 'processing' | 'completed' | 'failed';
  title?: string;
  transcript?: string;
  summary?: string;
  metadata?: VideoMetadata;
  method?: 'whisper';
  language?: string;
  gptModel?: string;
  timestampedSegments?: TimestampedSegment[];
  costs?: DetailedCosts;
  analysisTime?: AnalysisTimeInfo;
  message?: string;
  error?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}