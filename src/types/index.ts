export interface VideoMetadata {
  basic: {
    title: string;
    videoId: string;
    duration: number;
    channel: string;
    viewCount: number;
    likes: number;
    uploadDate?: string;
    publishDate?: string;
    category?: string;
    description?: string;
    thumbnail?: string;
  };
  chapters: Chapter[];
  captions: Caption[];
  stats: {
    formatCount: number;
    hasSubtitles: boolean;
    keywords: string[];
  };
  transcript?: string;
  timestampedSegments?: TimestampedSegment[];
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
  message: string;
  error?: string;
  fromHistory?: boolean;
  costs?: SessionCosts;
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