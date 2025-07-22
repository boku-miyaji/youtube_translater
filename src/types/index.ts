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
  // Analysis type for different content types
  analysisType?: AnalysisType;
}

// Extended metadata for audio files
export interface AudioMetadata {
  basic?: {
    title?: string;
    artist?: string;
    album?: string;
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    format?: string;
    audioPath?: string;
  };
  transcript?: string;
  summary?: string;
  timestampedSegments?: TimestampedSegment[];
  costs?: DetailedCosts;
  analysisTime?: {
    transcription: number;
    summary: number;
    total: number;
  };
  source?: 'file';
  fileId?: string;
  originalFilename?: string;
  fileSize?: number;
  uploadedAt?: string;
}

// Metadata for PDF files
export interface PDFMetadata {
  title?: string;
  authors?: string[];
  publicationDate?: string;
  doi?: string;
  journal?: string;
  pageCount: number;
  fileSize: number;
  abstract?: string;
  keywords?: string[];
}

export interface PDFContent {
  fullText: string;
  sections: PDFSection[];
  pageCount: number;
  language: string;
}

export interface PDFSection {
  title: string;
  content: string;
  pageRange: [number, number];
  type: 'abstract' | 'introduction' | 'methodology' | 
        'results' | 'conclusion' | 'references' | 'other';
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

// Analysis result types
export type AnalysisType = 'youtube' | 'video' | 'audio' | 'pdf';

export interface AnalysisResult {
  id: string;
  type: AnalysisType;
  url?: string;
  fileName?: string;
  fileSize?: number;
  
  // Common fields
  summary: Summary;
  processingTime: ProcessingTime;
  cost: number;  // Total cost
  costs?: DetailedCosts;  // Detailed cost breakdown
  
  // Type-specific fields
  transcription?: TranscriptionResult;  // video, audio
  pdfContent?: PDFContent;               // pdf only
  metadata: VideoMetadata | AudioMetadata | PDFMetadata;
}

export interface ProcessingTime {
  transcription?: number;
  extraction?: number;  // For PDF text extraction
  summary: number;
  total: number;
}

export interface ApiResponse {
  success?: boolean;
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
  // Extended for new file types
  analysisType?: AnalysisType;
  pdfContent?: PDFContent;
  audioMetadata?: AudioMetadata;
  pdfMetadata?: PDFMetadata;
}

export interface PromptTemplate {
  name: string;
  template: string;
}

export interface PromptContext {
  contentType: string;
  contextInfo: string;
  overviewInstruction: string;
  timeReference: string;
  additionalSections: string;
  questionSectionTitle: string;
  questionExamples: string;
  additionalNotes: string;
}

export interface ContentTypePrompts {
  base?: PromptTemplate;
  contexts?: {
    youtube?: PromptContext;
    pdf?: PromptContext;
    audio?: PromptContext;
    [key: string]: PromptContext | undefined;
  };
  // Legacy support
  youtube?: PromptTemplate;
  pdf?: PromptTemplate;
  audio?: PromptTemplate;
  [key: string]: PromptTemplate | PromptContext | { [key: string]: PromptContext | undefined } | undefined;
}

export interface PromptsConfig {
  summarize?: ContentTypePrompts;
  article?: PromptTemplate;
  chat?: PromptTemplate;
  [key: string]: ContentTypePrompts | PromptTemplate | undefined;
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

// Input type enums
export enum InputType {
  YOUTUBE_URL = 'youtube',
  VIDEO_FILE = 'video',
  AUDIO_FILE = 'audio',
  PDF_URL = 'pdf_url',
  PDF_FILE = 'pdf_file'
}

// File type detection
export interface FileTypeInfo {
  type: 'video' | 'audio' | 'pdf';
  mimeType: string;
  extension: string;
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

// Extended for audio files
export interface AudioFile {
  file: File;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  format?: string;
}

// PDF file interface
export interface PDFFile {
  file: File;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  pageCount?: number;
}

export interface VideoUploadRequest {
  file: File;
  language?: string;
  gptModel?: string;
  transcriptionModel?: TranscriptionModel;
  generateSummary?: boolean;
  generateArticle?: boolean;
}

// Audio upload request
export interface AudioUploadRequest {
  file: File;
  language?: string;
  gptModel?: string;
  transcriptionModel?: TranscriptionModel;
  generateSummary?: boolean;
}

// PDF upload/URL request
export interface PDFAnalysisRequest {
  url?: string;
  file?: File;
  language?: string;
  gptModel?: string;
  generateSummary?: boolean;
  extractStructure?: boolean;
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

// Audio upload response
export interface AudioUploadResponse extends ApiResponse {
  fileId?: string;
  originalName?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
  audioMetadata?: AudioMetadata;
  analysisTime?: {
    transcription: number;
    summary: number;
    total: number;
  };
}

// PDF analysis response
export interface PDFAnalysisResponse extends ApiResponse {
  fileId?: string;
  originalName?: string;
  size?: number;
  pdfContent?: PDFContent;
  pdfMetadata?: PDFMetadata;
  analysisTime?: {
    startTime?: string;
    endTime?: string;
    duration?: number;
    extraction?: number;
    transcription?: number;
    summary: number;
    total: number;
  };
}

// Session cost tracking
export interface SessionCosts {
  whisper: number;
  gpt: number;
  pdf: number;  // Added for PDF processing costs
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
    transcription?: number;
    extraction?: number;  // Added for PDF processing
    summary?: number;
    total?: number;
    startTime?: string;
    endTime?: string;
    duration?: number;
  };
  source?: 'url' | 'file';
  fileId?: string;
  originalFilename?: string;
  fileSize?: number;
  // Additional fields used in server
  url?: string;
  method?: 'subtitle' | 'whisper';
  language?: string;
  gptModel?: string;
  cost?: number;
  timestampedSegments?: TimestampedSegment[];
  tags?: string[];
  mainTags?: string[];
  thumbnail?: string;
  timestamp?: string;
}

// Cost entry for tracking individual costs
export interface CostEntry {
  date: string;
  service?: 'whisper' | 'gpt' | 'pdf' | 'total';
  cost?: number;
  // Additional fields used in server
  videoId?: string;
  title?: string;
  method?: 'subtitle' | 'whisper' | 'pdf';
  language?: string;
  gptModel?: string;
  whisperCost?: number;
  gptCost?: number;
  pdfCost?: number;  // Added for PDF processing costs
  totalCost?: number;
  timestamp?: string;
}

// Article history entry
export interface ArticleHistoryEntry {
  date: string;
  article: string;
  id?: string;
  type?: string;
  timestamp?: string;
}

// Summary interface  
export interface Summary {
  text?: string;
  content?: string;
  sections?: Array<{
    title: string;
    content: string;
  }>;
  model?: string;
  cost?: number;
  tokens?: {
    input: number;
    output: number;
  };
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
    isHistoricalEstimate?: boolean;  // true if summary time is based on historical data
    transcriptionRate?: string;  // e.g., "動画1分あたり30.0秒"
    summaryRate?: string;        // e.g., "動画1分あたり60.0秒"
    durationMinutes?: number;    // video duration in minutes
    confidenceLevel?: number;  // 0-1, how confident we are in the estimate
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
    isHistoricalEstimate?: boolean;  // true if summary time is based on historical data
    transcriptionRate?: string;  // e.g., "動画1分あたり30.0秒"
    summaryRate?: string;        // e.g., "動画1分あたり60.0秒"
    durationMinutes?: number;    // video duration in minutes
    confidenceLevel?: number;  // 0-1, how confident we are in the estimate
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