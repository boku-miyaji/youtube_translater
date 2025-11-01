// YouTube Data API v3 service with rate limiting and caching
import { google, youtube_v3 } from 'googleapis';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Rate limiting configuration
const RATE_LIMIT = {
  // Global QPS limit (0.2-0.5 req/sec recommended)
  maxRequestsPerSecond: 0.3,
  // Minimum delay between requests (milliseconds)
  minDelayMs: 1000 / 0.3, // ~3.3 seconds
  // Maximum jitter to add (avoid uniform intervals)
  maxJitterMs: 2000,
  // Last request timestamp
  lastRequestTime: 0
};

// Cache configuration
const CACHE_CONFIG = {
  // Cache directory
  dir: path.join(process.cwd(), '.cache', 'youtube'),
  // Cache TTL in milliseconds
  metadataTTL: 24 * 60 * 60 * 1000, // 24 hours
  transcriptTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  audioTTL: 1 * 60 * 60 * 1000 // 1 hour (shorter for audio)
};

// Ensure cache directory exists
if (!fs.existsSync(CACHE_CONFIG.dir)) {
  fs.mkdirSync(CACHE_CONFIG.dir, { recursive: true });
}

// YouTube API client singleton
let youtubeClient: youtube_v3.Youtube | null = null;

/**
 * Initialize YouTube Data API v3 client
 */
export function initYouTubeAPI(): youtube_v3.Youtube {
  if (!youtubeClient) {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY is not configured in environment variables');
    }

    youtubeClient = google.youtube({
      version: 'v3',
      auth: apiKey
    });

    console.log('✅ YouTube Data API v3 initialized');
  }

  return youtubeClient;
}

/**
 * Add jittered delay to avoid bot detection
 * Implements exponential backoff with jitter
 */
async function addJitteredDelay(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - RATE_LIMIT.lastRequestTime;

  // Calculate required delay
  let delayMs = RATE_LIMIT.minDelayMs - timeSinceLastRequest;

  if (delayMs > 0) {
    // Add random jitter (0 to maxJitterMs)
    const jitter = Math.random() * RATE_LIMIT.maxJitterMs;
    delayMs += jitter;

    console.log(`⏳ Rate limiting: waiting ${Math.round(delayMs)}ms (jitter: ${Math.round(jitter)}ms)`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  RATE_LIMIT.lastRequestTime = Date.now();
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Generate cache key for a video
 */
function getCacheKey(videoId: string, type: 'metadata' | 'transcript' | 'audio'): string {
  return crypto.createHash('sha256').update(`${type}:${videoId}`).digest('hex');
}

/**
 * Get cache file path
 */
function getCacheFilePath(cacheKey: string): string {
  return path.join(CACHE_CONFIG.dir, `${cacheKey}.json`);
}

/**
 * Check if cache is valid
 */
function isCacheValid(filePath: string, ttl: number): boolean {
  try {
    const stats = fs.statSync(filePath);
    const age = Date.now() - stats.mtimeMs;
    return age < ttl;
  } catch {
    return false;
  }
}

/**
 * Read from cache
 */
function readCache<T>(cacheKey: string, ttl: number): T | null {
  const filePath = getCacheFilePath(cacheKey);

  if (!isCacheValid(filePath, ttl)) {
    return null;
  }

  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const cached = JSON.parse(data);
    console.log(`✅ Cache HIT: ${cacheKey}`);
    return cached as T;
  } catch (error) {
    console.warn(`⚠️ Cache read error: ${error}`);
    return null;
  }
}

/**
 * Write to cache
 */
function writeCache<T>(cacheKey: string, data: T): void {
  const filePath = getCacheFilePath(cacheKey);

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ Cache WRITE: ${cacheKey}`);
  } catch (error) {
    console.error(`❌ Cache write error: ${error}`);
  }
}

/**
 * Video metadata from YouTube Data API v3
 */
export interface YouTubeVideoMetadata {
  id: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  duration: string; // ISO 8601 duration (e.g., "PT15M33S")
  durationSeconds: number;
  viewCount: string;
  likeCount: string;
  thumbnails: {
    default?: { url?: string; width?: number; height?: number };
    medium?: { url?: string; width?: number; height?: number };
    high?: { url?: string; width?: number; height?: number };
    standard?: { url?: string; width?: number; height?: number };
    maxres?: { url?: string; width?: number; height?: number };
  };
  tags?: string[];
  categoryId: string;
  liveBroadcastContent: string;
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
}

/**
 * Convert ISO 8601 duration to seconds
 */
function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Get video metadata using YouTube Data API v3
 * Implements strong caching and rate limiting
 */
export async function getVideoMetadata(videoIdOrUrl: string): Promise<YouTubeVideoMetadata> {
  // Extract video ID if URL is provided
  const videoId = extractVideoId(videoIdOrUrl);
  if (!videoId) {
    throw new Error(`Invalid YouTube video ID or URL: ${videoIdOrUrl}`);
  }

  // Check cache first
  const cacheKey = getCacheKey(videoId, 'metadata');
  const cached = readCache<YouTubeVideoMetadata>(cacheKey, CACHE_CONFIG.metadataTTL);

  if (cached) {
    return cached;
  }

  // Rate limiting with jitter
  await addJitteredDelay();

  // Initialize API client
  const youtube = initYouTubeAPI();

  console.log(`📊 Fetching metadata for video: ${videoId}`);

  try {
    // Call YouTube Data API v3
    // Cost: 1 quota unit
    const response = await youtube.videos.list({
      part: ['snippet', 'contentDetails', 'statistics'],
      id: [videoId]
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const video = response.data.items[0];
    const snippet = video.snippet!;
    const contentDetails = video.contentDetails!;
    const statistics = video.statistics!;

    // Build metadata object
    const metadata: YouTubeVideoMetadata = {
      id: videoId,
      title: snippet.title || '',
      description: snippet.description || '',
      channelId: snippet.channelId || '',
      channelTitle: snippet.channelTitle || '',
      publishedAt: snippet.publishedAt || '',
      duration: contentDetails.duration || 'PT0S',
      durationSeconds: parseDuration(contentDetails.duration || 'PT0S'),
      viewCount: statistics.viewCount || '0',
      likeCount: statistics.likeCount || '0',
      thumbnails: snippet.thumbnails || {},
      tags: snippet.tags,
      categoryId: snippet.categoryId || '',
      liveBroadcastContent: snippet.liveBroadcastContent || 'none',
      defaultLanguage: snippet.defaultLanguage,
      defaultAudioLanguage: snippet.defaultAudioLanguage
    };

    // Write to cache
    writeCache(cacheKey, metadata);

    console.log(`✅ Metadata fetched: "${metadata.title}" (${metadata.durationSeconds}s)`);

    return metadata;
  } catch (error: any) {
    // Handle quota exceeded error
    if (error.code === 403 && error.message?.includes('quotaExceeded')) {
      throw new Error('YouTube API quota exceeded. Please try again later.');
    }

    // Handle other API errors
    if (error.response?.data?.error) {
      const apiError = error.response.data.error;
      throw new Error(`YouTube API error: ${apiError.message} (${apiError.code})`);
    }

    throw error;
  }
}

/**
 * Get rate limiting statistics
 */
export function getRateLimitStats() {
  return {
    maxRequestsPerSecond: RATE_LIMIT.maxRequestsPerSecond,
    minDelayMs: RATE_LIMIT.minDelayMs,
    maxJitterMs: RATE_LIMIT.maxJitterMs,
    timeSinceLastRequest: Date.now() - RATE_LIMIT.lastRequestTime,
    cacheDir: CACHE_CONFIG.dir,
    cacheTTLs: {
      metadata: `${CACHE_CONFIG.metadataTTL / 1000 / 60 / 60}h`,
      transcript: `${CACHE_CONFIG.transcriptTTL / 1000 / 60 / 60 / 24}d`,
      audio: `${CACHE_CONFIG.audioTTL / 1000 / 60 / 60}h`
    }
  };
}
