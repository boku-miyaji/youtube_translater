import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import OpenAI from 'openai';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import axios from 'axios';

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
console.log('🔧 Loading environment from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
} else {
  console.log('✅ Environment loaded successfully');
  console.log('  - Parsed keys:', result.parsed ? Object.keys(result.parsed) : 'NONE');
}

// Manually set the environment variables if they were parsed but not set
if (result.parsed && !process.env.OPENAI_API_KEY) {
  console.log('🔧 Manually setting OPENAI_API_KEY from parsed values');
  process.env.OPENAI_API_KEY = result.parsed.OPENAI_API_KEY;
}
import { YoutubeTranscript } from 'youtube-transcript-api';
import {
  VideoMetadata,
  HistoryEntry,
  SessionCosts,
  Pricing,
  CostEntry,
  ArticleHistoryEntry,
  TimestampedSegment,
  Summary,
  PromptsConfig,
  TranscriptionResult,
  SubtitlesResult,
  UploadVideoFileResponse,
  CostEstimationRequest,
  CostEstimationResponse,
  FileCostEstimationResponse,
  AudioMetadata,
  PDFMetadata,
  PDFContent,
  PDFSection,
  AudioUploadResponse,
  PDFAnalysisResponse,
  FileTypeInfo,
  AnalysisType
} from './types/index';
import { formatProcessingTime } from './utils/formatTime';
import { analysisProgressDB } from './database/analysis-progress';


const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Add CSP middleware
app.use((req: Request, res: Response, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.youtube.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: blob: https:; " +
    "connect-src 'self' http://localhost:8080 http://127.0.0.1:8080; " +
    "frame-src https://www.youtube.com https://youtube.com; " +
    "media-src *"
  );
  next();
});

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    server: 'typescript',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Debug endpoint to check current state
app.get('/debug/state', (req: Request, res: Response) => {
  res.json({
    hasTranscript: !!currentTranscript,
    transcriptLength: currentTranscript ? currentTranscript.length : 0,
    transcriptPreview: currentTranscript ? currentTranscript.substring(0, 200) : '',
    hasMetadata: !!currentMetadata,
    metadataTitle: currentMetadata ? currentMetadata.basic.title : '',
    hasArticle: !!currentArticle,
    articleLength: currentArticle ? currentArticle.length : 0
  });
});

console.log('🔑 OpenAI API Key check:', process.env.OPENAI_API_KEY ? 'CONFIGURED' : 'MISSING');
console.log('  - API Key length:', process.env.OPENAI_API_KEY?.length || 0);
console.log('  - API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 10) + '...');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Create necessary directories
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
if (!fs.existsSync('transcripts')) {
  fs.mkdirSync('transcripts');
}
if (!fs.existsSync('history')) {
  fs.mkdirSync('history');
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomUUID();
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${extension}`);
  }
});

// File filter for video, audio, and PDF files
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    // Video
    'video/mp4', 'video/quicktime', 'video/x-msvideo',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/flac',
    // PDF
    'application/pdf'
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only video files (MP4, MOV, AVI), audio files (MP3, WAV, M4A, AAC, OGG, FLAC), and PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: fileFilter
});

let currentTranscript = '';
let currentMetadata: VideoMetadata | null = null;
const currentVideo: VideoMetadata | null = null;
// let currentSummary: Summary | null = null;
let currentTimestampedSegments: TimestampedSegment[] = [];
let currentArticle: string | null = null;
let sessionCosts: SessionCosts = {
  whisper: 0,
  gpt: 0,
  pdf: 0,
  total: 0
};

// 料金設定（2025年1月時点のOpenAI公式価格）
const pricing: Pricing = {
  input: 0.50 / 1000000, // Default input price (gpt-3.5-turbo)
  output: 1.50 / 1000000, // Default output price (gpt-3.5-turbo)
  whisper: 0.006, // $0.006 per minute (for backward compatibility)
  transcription: {
    'whisper-1': 0.006, // $0.006 per minute
    'gpt-4o-transcribe': 6.0 / 1000000, // $6 per 1M audio tokens
    'gpt-4o-mini-transcribe': 3.0 / 1000000 // $3 per 1M audio tokens
  },
  models: {
    'gpt-3.5-turbo': {
      input: 0.50 / 1000000, // $0.50 per 1M tokens
      output: 1.50 / 1000000  // $1.50 per 1M tokens
    },
    'gpt-4o-mini': {
      input: 0.15 / 1000000, // $0.15 per 1M tokens
      output: 0.60 / 1000000  // $0.60 per 1M tokens
    },
    'gpt-4o': {
      input: 2.50 / 1000000, // $2.50 per 1M tokens
      output: 10.00 / 1000000  // $10.00 per 1M tokens
    },
    'gpt-4-turbo': {
      input: 10.00 / 1000000, // $10.00 per 1M tokens
      output: 30.00 / 1000000  // $30.00 per 1M tokens
    },
    'gpt-4': {
      input: 30.00 / 1000000, // $30.00 per 1M tokens
      output: 60.00 / 1000000  // $60.00 per 1M tokens
    }
  }
};

// Processing speed for each model (video minutes per real-time minute)
const processingSpeed = {
  transcription: {
    'whisper-1': 10, // Whisper processes ~10 minutes of video per minute
    'gpt-4o-transcribe': 8, // GPT-4o processes ~8 minutes of video per minute
    'gpt-4o-mini-transcribe': 12 // GPT-4o Mini processes ~12 minutes of video per minute
  },
  summary: {
    'gpt-4o-mini': 0.5, // Processing time coefficient (lower = slower)
    'gpt-4o': 0.4,
    'gpt-4-turbo': 0.3,
    'gpt-4': 0.25,
    'gpt-3.5-turbo': 0.6
  }
};

// Helper function to get the correct response format for transcription models

// 履歴ファイルのパス
const historyFile = path.join('history', 'transcripts.json');
const costsFile = path.join('history', 'costs.json');

// Video file processing utilities
async function extractVideoMetadata(filePath: string): Promise<{ duration: number; title: string }> {
  return new Promise((resolve, reject) => {
    // Validate input file exists
    if (!fs.existsSync(filePath)) {
      reject(new Error(`Video file not found: ${filePath}`));
      return;
    }
    
    console.log('📊 Extracting video metadata from:', filePath);
    
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('Error extracting video metadata:', err);
        reject(err);
        return;
      }

      const duration = metadata.format.duration || 0;
      const filename = path.basename(filePath, path.extname(filePath));
      
      console.log('📊 Video metadata extracted:', { 
        duration: Math.round(duration), 
        filename,
        format: metadata.format 
      });
      
      resolve({
        duration: Math.round(duration),
        title: filename
      });
    });
  });
}

async function transcribeVideoFile(filePath: string, transcriptionModel: string = 'whisper-1'): Promise<{ text: string; segments: TimestampedSegment[] }> {
  try {
    console.log('🎵 Starting Whisper transcription for:', filePath);
    
    // Validate input file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Video file not found: ${filePath}`);
    }
    
    // Convert video to audio using ffmpeg - use WAV format with PCM encoding for better compatibility
    const audioPath = filePath.replace(/\.(mp4|mov|avi)$/i, '.wav');
    
    console.log('🎵 Audio extraction path:', audioPath);
    
    await new Promise<void>((resolve, reject) => {
      ffmpeg(filePath)
        .output(audioPath)
        .audioCodec('pcm_s16le') // Use PCM 16-bit little-endian, which is universally supported
        .audioFrequency(16000)   // 16kHz sample rate for Whisper (recommended)
        .audioChannels(1)        // Mono for better transcription accuracy
        .on('progress', (progress) => {
          console.log('Audio extraction progress:', progress.percent + '% done');
        })
        .on('end', () => {
          console.log('Audio extraction completed');
          resolve();
        })
        .on('error', (err) => {
          console.error('Error extracting audio:', err);
          reject(err);
        })
        .run();
    });

    // Validate audio file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found after extraction: ${audioPath}`);
    }
    
    console.log('🎵 Starting Whisper API transcription...');
    
    // For video files, always use whisper-1 to ensure we get timestamps
    // GPT-4o models don't support timestamp_granularities
    const actualModel = (transcriptionModel === 'gpt-4o-transcribe' || transcriptionModel === 'gpt-4o-mini-transcribe') 
      ? 'whisper-1' 
      : transcriptionModel;
    
    if (actualModel !== transcriptionModel) {
      console.log(`⚠️ Using whisper-1 instead of ${transcriptionModel} to ensure timestamp support for video files`);
    }
    
    // Transcribe using Whisper API
    let transcription;
    try {
      transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: actualModel,
        response_format: 'verbose_json', // Always use verbose_json for video files to get timestamps
        timestamp_granularities: ['segment']
      });
    } catch (error) {
      handleOpenAIError(error);
    }
    
    console.log('🎵 Whisper API transcription completed');

    // Clean up audio file
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }

    // Convert Whisper segments to our format
    const segments: TimestampedSegment[] = (transcription as any).segments?.map((segment: any) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text.trim()
    })) || [];

    return {
      text: transcription.text,
      segments
    };
  } catch (error) {
    console.error('Error transcribing video file:', error);
    throw error;
  }
}

async function cleanupTempFile(filePath: string, delay: number = 60000): Promise<void> {
  // Schedule file cleanup after delay
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up temporary file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error cleaning up file ${filePath}:`, error);
    }
  }, delay);
}


// Calculate transcription cost based on model
function calculateTranscriptionCost(transcriptionModel: string, durationMinutes: number, audioTokens?: number): number {
  const model = transcriptionModel as keyof typeof pricing.transcription;
  
  if (model === 'whisper-1') {
    // Whisper-1 uses per-minute pricing
    return durationMinutes * pricing.transcription[model];
  } else if (model === 'gpt-4o-transcribe' || model === 'gpt-4o-mini-transcribe') {
    // GPT-4o models use per-audio-token pricing
    // Estimate audio tokens: approximately 25 tokens per second of audio
    const estimatedAudioTokens = audioTokens || Math.ceil(durationMinutes * 60 * 25);
    return estimatedAudioTokens * pricing.transcription[model];
  }
  
  // Fallback to whisper pricing
  return durationMinutes * pricing.transcription['whisper-1'];
}


// Calculate estimated processing time based on model and video duration using historical data
function calculateProcessingTime(
  transcriptionModel: string, 
  gptModel: string, 
  durationMinutes: number,
  contentType: 'youtube' | 'audio' | 'pdf' = 'youtube'
): {
  transcription: number;
  summary: number;
  total: number;
  formatted: string;
  isHistoricalEstimate?: boolean;
  transcriptionRate: string;  // e.g., "10x速" or "0.1分/分"
  summaryRate: string;        // e.g., "0.5分/分"
  durationMinutes: number;    // Pass through for UI
  confidenceLevel: number;    // How confident we are in the estimate (0-1)
} {
  // Get historical analysis statistics
  const stats = analysisProgressDB.getAnalysisStats();
  
  let transcriptionTime: number;
  let summaryTime: number;
  let isHistoricalEstimate = false;
  let confidenceLevel = 0.1; // Default low confidence
  
  // Calculate transcription time
  if (stats.transcriptionStats.sampleSize > 0) {
    // Use historical data for transcription model if available
    const modelStats = stats.transcriptionStats.modelStats[transcriptionModel];
    if (modelStats && modelStats.sampleSize >= 2) {
      transcriptionTime = Math.ceil(durationMinutes * modelStats.averageSecondsPerMinute);
      confidenceLevel = Math.max(confidenceLevel, Math.min(0.9, modelStats.sampleSize / 10));
      console.log(`📊 Using historical data for transcription time: ${transcriptionTime}s (${modelStats.sampleSize} samples)`);
    } else {
      // Use overall transcription average
      transcriptionTime = Math.ceil(durationMinutes * stats.transcriptionStats.averageSecondsPerMinute);
      confidenceLevel = Math.max(confidenceLevel, stats.transcriptionStats.confidenceLevel);
      console.log(`📊 Using overall transcription average: ${transcriptionTime}s (${stats.transcriptionStats.sampleSize} samples)`);
    }
    isHistoricalEstimate = true;
  } else {
    // Fall back to default speed coefficients
    const transcriptionSpeed = processingSpeed.transcription[transcriptionModel as keyof typeof processingSpeed.transcription] || 10;
    transcriptionTime = Math.ceil((durationMinutes / transcriptionSpeed) * 60);
    console.log(`📊 Using default transcription coefficients: ${transcriptionTime}s`);
  }
  
  // Calculate summary time
  if (stats.summaryStats.sampleSize > 0) {
    // Use historical data for GPT model if available
    const modelStats = stats.summaryStats.modelStats[gptModel];
    if (modelStats && modelStats.sampleSize >= 2) {
      summaryTime = Math.ceil(durationMinutes * modelStats.averageSecondsPerMinute);
      confidenceLevel = Math.max(confidenceLevel, Math.min(0.9, modelStats.sampleSize / 10));
      console.log(`📊 Using historical data for summary time: ${summaryTime}s (${modelStats.sampleSize} samples)`);
    } else {
      // Use overall summary average
      summaryTime = Math.ceil(durationMinutes * stats.summaryStats.averageSecondsPerMinute);
      confidenceLevel = Math.max(confidenceLevel, stats.summaryStats.confidenceLevel);
      console.log(`📊 Using overall summary average: ${summaryTime}s (${stats.summaryStats.sampleSize} samples)`);
    }
    isHistoricalEstimate = true;
  } else {
    // Fall back to default speed coefficients
    const summarySpeed = processingSpeed.summary[gptModel as keyof typeof processingSpeed.summary] || 0.5;
    summaryTime = Math.ceil(durationMinutes * 60 * summarySpeed);
    console.log(`📊 Using default summary coefficients: ${summaryTime}s`);
  }
  
  // Apply content type adjustments if we have data
  if (stats.contentTypeStats[contentType] && stats.contentTypeStats[contentType].sampleSize >= 2) {
    const contentTypeStats = stats.contentTypeStats[contentType];
    const transcriptionAdjustment = contentTypeStats.transcriptionAverage / stats.transcriptionStats.averageSecondsPerMinute;
    const summaryAdjustment = contentTypeStats.summaryAverage / stats.summaryStats.averageSecondsPerMinute;
    
    transcriptionTime = Math.ceil(transcriptionTime * transcriptionAdjustment);
    summaryTime = Math.ceil(summaryTime * summaryAdjustment);
    
    console.log(`📊 Applied content type adjustments for ${contentType}: transcription x${transcriptionAdjustment.toFixed(2)}, summary x${summaryAdjustment.toFixed(2)}`);
  }
  
  // Calculate rates for display
  const transcriptionSecondsPerVideoMinute = transcriptionTime / durationMinutes;
  const summarySecondsPerVideoMinute = summaryTime / durationMinutes;
  const transcriptionRate = `動画1分あたり${transcriptionSecondsPerVideoMinute.toFixed(1)}秒`;
  const summaryRate = `動画1分あたり${summarySecondsPerVideoMinute.toFixed(1)}秒`;
  
  const totalTime = transcriptionTime + summaryTime;
  
  return {
    transcription: transcriptionTime,
    summary: summaryTime,
    total: totalTime,
    formatted: formatProcessingTime(totalTime),
    isHistoricalEstimate,
    transcriptionRate,
    summaryRate,
    durationMinutes,
    confidenceLevel
  };
}


// Format duration to human readable format
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}時間${minutes}分${secs}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${secs}秒`;
  } else {
    return `${secs}秒`;
  }
}

// Detect file type based on MIME type and magic numbers
function detectFileType(file: any): FileTypeInfo {
  const mimeTypeMap: Record<string, { type: 'video' | 'audio' | 'pdf'; extension: string }> = {
    // Video
    'video/mp4': { type: 'video', extension: 'mp4' },
    'video/quicktime': { type: 'video', extension: 'mov' },
    'video/x-msvideo': { type: 'video', extension: 'avi' },
    // Audio
    'audio/mpeg': { type: 'audio', extension: 'mp3' },
    'audio/wav': { type: 'audio', extension: 'wav' },
    'audio/mp4': { type: 'audio', extension: 'm4a' },
    'audio/aac': { type: 'audio', extension: 'aac' },
    'audio/ogg': { type: 'audio', extension: 'ogg' },
    'audio/flac': { type: 'audio', extension: 'flac' },
    // PDF
    'application/pdf': { type: 'pdf', extension: 'pdf' }
  };

  const fileTypeInfo = mimeTypeMap[file.mimetype];
  if (!fileTypeInfo) {
    throw new Error(`Unsupported file type: ${file.mimetype}`);
  }

  return {
    type: fileTypeInfo.type,
    mimeType: file.mimetype,
    extension: fileTypeInfo.extension
  };
}

// Extract metadata from audio file
async function extractAudioMetadata(filePath: string): Promise<AudioMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      const format = metadata.format;

      resolve({
        basic: {
          title: (format.tags?.title as string) || path.basename(filePath, path.extname(filePath)),
          artist: format.tags?.artist as string | undefined,
          album: format.tags?.album as string | undefined,
          duration: Math.round(format.duration || 0),
          bitrate: format.bit_rate ? parseInt(format.bit_rate.toString()) : undefined,
          sampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate.toString()) : undefined,
          channels: audioStream?.channels,
          format: path.extname(filePath).substring(1).toUpperCase(),
          audioPath: filePath
        }
      });
    });
  });
}

// Download PDF from URL
async function downloadPDF(url: string): Promise<Buffer> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 seconds timeout
      maxContentLength: 50 * 1024 * 1024, // 50MB max
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; YouTubeTranslator/1.0)'
      }
    });

    // Verify it's a PDF
    const buffer = Buffer.from(response.data);
    const header = buffer.toString('utf8', 0, 4);
    if (header !== '%PDF') {
      throw new Error('Downloaded file is not a valid PDF');
    }

    return buffer;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to download PDF: ${error.message}`);
    }
    throw error;
  }
}

// Extract text from PDF
async function extractPDFText(pdfBuffer: Buffer): Promise<PDFContent> {
  try {
    const data = await pdfParse(pdfBuffer);
    
    // Basic text extraction
    const fullText = data.text;
    const pageCount = data.numpages;
    
    // Simple section detection based on common academic paper patterns
    const sections: PDFSection[] = [];
    const sectionPatterns = [
      { pattern: /abstract/i, type: 'abstract' },
      { pattern: /introduction/i, type: 'introduction' },
      { pattern: /methodology|methods/i, type: 'methodology' },
      { pattern: /results/i, type: 'results' },
      { pattern: /conclusion/i, type: 'conclusion' },
      { pattern: /references|bibliography/i, type: 'references' }
    ];

    // Split text into lines and detect sections
    const lines = fullText.split('\n');
    let currentSection: PDFSection | null = null;
    let currentContent: string[] = [];

    lines.forEach((line, _index) => {
      const trimmedLine = line.trim();
      
      // Check if this line is a section header
      for (const { pattern, type } of sectionPatterns) {
        if (pattern.test(trimmedLine) && trimmedLine.length < 50) {
          // Save previous section if exists
          if (currentSection && currentContent.length > 0) {
            currentSection.content = currentContent.join('\n').trim();
            sections.push(currentSection);
          }
          
          // Start new section
          currentSection = {
            title: trimmedLine,
            content: '',
            pageRange: [1, pageCount], // Simplified - would need more complex logic for real page tracking
            type: type as any
          };
          currentContent = [];
          break;
        }
      }
      
      // Add content to current section
      if (currentSection) {
        currentContent.push(line);
      }
    });

    // Save last section
    if (currentSection && currentContent.length > 0) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    // Detect language (simplified - just check for common patterns)
    const language = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(fullText) ? 'ja' : 'en';

    return {
      fullText,
      sections,
      pageCount,
      language
    };
  } catch (error) {
    throw new Error(`Failed to extract PDF text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Analyze PDF structure and extract metadata
function analyzePDFStructure(pdfContent: PDFContent): PDFMetadata {
  const { fullText, sections, pageCount } = pdfContent;
  
  // Extract title (usually first few lines)
  const lines = fullText.split('\n').filter(line => line.trim());
  const title = lines[0] || 'Untitled PDF';
  
  // Extract authors (simple heuristic - lines after title before abstract)
  const authors: string[] = [];
  const abstractIndex = sections.findIndex(s => s.type === 'abstract');
  if (abstractIndex > -1) {
    const abstractLine = fullText.toLowerCase().indexOf('abstract');
    const beforeAbstract = fullText.substring(0, abstractLine).split('\n');
    // Simple heuristic: lines between title and abstract that contain names
    beforeAbstract.slice(1, 5).forEach(line => {
      if (line.trim() && !line.toLowerCase().includes('university') && line.length < 100) {
        authors.push(line.trim());
      }
    });
  }
  
  // Extract abstract
  const abstractSection = sections.find(s => s.type === 'abstract');
  const abstract = abstractSection?.content.substring(0, 500);
  
  // Extract keywords (if present)
  const keywords: string[] = [];
  const keywordsMatch = fullText.match(/keywords?:?\s*([^\n]+)/i);
  if (keywordsMatch) {
    keywords.push(...keywordsMatch[1].split(/[,;]/).map(k => k.trim()));
  }

  return {
    title,
    authors: authors.filter(a => a.length > 0),
    abstract,
    keywords,
    pageCount,
    fileSize: 0 // Will be set later
  };
}

// Error handling for OpenAI API errors
class OpenAIError extends Error {
  statusCode: number;
  errorType: string;
  
  constructor(message: string, statusCode: number, errorType: string) {
    super(message);
    this.name = 'OpenAIError';
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}

// Handle OpenAI API errors with user-friendly messages
function handleOpenAIError(error: any): never {
  console.error('OpenAI API Error:', error);
  
  // Check for quota exceeded error specifically
  if (error?.code === 'insufficient_quota' || error?.error?.code === 'insufficient_quota') {
    throw new OpenAIError(
      '💳 APIクォータが不足しています。プランをアップグレードしてください。',
      503,
      'quota_exceeded'
    );
  }
  
  // Check if it's an OpenAI API error
  if (error?.response?.status) {
    const status = error.response.status;
    const errorMessage = error.response?.data?.error?.message || error.message;
    
    switch (status) {
      case 429:
        throw new OpenAIError(
          '⚠️ APIの利用制限に達しました。しばらく時間をおいてからお試しください。',
          503,
          'quota_exceeded'
        );
      case 401:
        throw new OpenAIError(
          '🔐 API認証エラーが発生しました。管理者にお問い合わせください。',
          503,
          'auth_error'
        );
      case 500:
      case 502:
      case 503:
        throw new OpenAIError(
          '🔧 OpenAI APIサービスが一時的に利用できません。しばらくしてからお試しください。',
          503,
          'service_unavailable'
        );
      default:
        throw new OpenAIError(
          `🚫 AI処理中にエラーが発生しました: ${errorMessage}`,
          502,
          'api_error'
        );
    }
  } else if (error?.code === 'insufficient_quota') {
    throw new OpenAIError(
      '💳 APIクォータが不足しています。プランをアップグレードしてください。',
      503,
      'quota_exceeded'
    );
  }
  
  // Generic error
  throw new OpenAIError(
    '❌ AI処理中に予期しないエラーが発生しました。',
    500,
    'unknown_error'
  );
}

// Helper function to send error responses with appropriate status codes
function sendErrorResponse(res: Response, error: any, defaultMessage: string): void {
  if (error instanceof OpenAIError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      errorType: error.errorType,
      message: defaultMessage
    });
  } else {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('sendErrorResponse - Error details:', error);
    res.status(500).json({
      success: false,
      error: errorMessage || defaultMessage,
      message: defaultMessage
    });
  }
}


// Estimate GPT costs for summary and article
function estimateGPTCosts(durationMinutes: number, gptModel: string, generateSummary: boolean = true, generateArticle: boolean = false): { summary: number; article: number } {
  const modelPricing = pricing.models[gptModel as keyof typeof pricing.models] || pricing.models['gpt-4o-mini'];
  
  // Rough estimates based on video length
  // These are conservative estimates - actual costs may vary
  const baseInputTokens = Math.min(4000, durationMinutes * 15); // Estimate based on transcript length
  const summaryOutputTokens = generateSummary ? Math.min(1000, durationMinutes * 8) : 0;
  const articleOutputTokens = generateArticle ? Math.min(2000, durationMinutes * 12) : 0;
  
  const summaryCost = generateSummary ? 
    (baseInputTokens * modelPricing.input) + (summaryOutputTokens * modelPricing.output) : 0;
  
  const articleCost = generateArticle ? 
    ((baseInputTokens + summaryOutputTokens) * modelPricing.input) + (articleOutputTokens * modelPricing.output) : 0;
  
  return {
    summary: summaryCost,
    article: articleCost
  };
}

function loadHistory(): HistoryEntry[] {
  if (fs.existsSync(historyFile)) {
    try {
      const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      
      // Migration: Add default analysisTime for entries that don't have it
      let migrationApplied = false;
      const migratedHistory = history.map((entry: any) => {
        if (!entry.analysisTime && entry.timestamp) {
          // Create default analysis time based on video duration and timestamp
          const entryDate = new Date(entry.timestamp);
          const duration = entry.metadata?.basic?.duration || 60; // Default to 60 seconds
          const estimatedProcessingTime = Math.max(30, Math.floor(duration * 0.8)); // Estimate processing time
          
          const startTime = new Date(entryDate.getTime() - (estimatedProcessingTime * 1000));
          entry.analysisTime = {
            startTime: startTime.toISOString(),
            endTime: entryDate.toISOString(),
            duration: estimatedProcessingTime
          };
          migrationApplied = true;
          console.log(`Migration: Added analysisTime for entry ${entry.id} (${entry.title})`);
        }
        return entry;
      });
      
      // Save migrated data back to file
      if (migrationApplied) {
        saveHistory(migratedHistory);
        console.log('Migration completed: analysisTime fields added to historical entries');
      }
      
      return migratedHistory;
    } catch (error) {
      console.error('Error loading history:', error);
      return [];
    }
  }
  return [];
}

function saveHistory(history: HistoryEntry[]): void {
  try {
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Error saving history:', error);
  }
}

function loadCosts(): CostEntry[] {
  if (fs.existsSync(costsFile)) {
    try {
      return JSON.parse(fs.readFileSync(costsFile, 'utf8'));
    } catch (error) {
      console.error('Error loading costs:', error);
      return [];
    }
  }
  return [];
}

function saveCosts(costs: CostEntry[]): void {
  try {
    fs.writeFileSync(costsFile, JSON.stringify(costs, null, 2));
  } catch (error) {
    console.error('Error saving costs:', error);
  }
}


function addCostEntry(
  videoId: string,
  title: string,
  method: 'subtitle' | 'whisper' | 'pdf',
  language: string,
  gptModel: string,
  whisperCost: number,
  gptCost: number,
  totalCost: number,
  pdfCost: number = 0
): CostEntry {
  const costs = loadCosts();
  const entry: CostEntry = {
    videoId,
    title,
    method,
    language,
    gptModel,
    whisperCost,
    gptCost,
    pdfCost,
    totalCost,
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
  };
  
  costs.unshift(entry);
  
  // 最新1000件まで保持
  if (costs.length > 1000) {
    costs.splice(1000);
  }
  
  saveCosts(costs);
  return entry;
}

function addToHistory(
  videoId: string,
  title: string,
  url: string,
  transcript: string,
  method: 'subtitle' | 'whisper',
  cost: number = 0,
  metadata: VideoMetadata | null = null,
  summary: Summary | null = null,
  language: string = 'original',
  gptModel: string = 'gpt-4o-mini',
  timestampedSegments: TimestampedSegment[] = [],
  tags: string[] = [],
  mainTags: string[] = [],
  article: string | null = null,
  analysisTime: { 
    startTime: string; 
    endTime: string; 
    duration: number;
    transcription?: number;
    extraction?: number;
    summary?: number;
    total?: number;
  } | null = null
): HistoryEntry {
  const history = loadHistory();
  const entry: HistoryEntry = {
    id: videoId,
    title,
    url,
    transcript,
    method, // 'subtitle', 'whisper'
    language, // 'original', 'ja', 'en'
    gptModel, // GPTモデル情報
    cost,
    metadata,
    summary: typeof summary === 'string' ? summary : summary?.content || summary?.text || '',
    timestampedSegments, // タイムスタンプ付きセグメント
    tags, // サブタグ情報
    mainTags, // メインタグ情報
    article, // 生成された記事コンテンツ
    thumbnail: metadata?.basic?.thumbnail || undefined, // Extract thumbnail from metadata
    timestamp: new Date().toISOString(),
    savedAt: new Date().toISOString(),
    analysisTime: analysisTime || undefined
  };
  
  // 既存のエントリーがあれば更新、なければ追加
  const existingIndex = history.findIndex(item => item.id === videoId);
  if (existingIndex >= 0) {
    history[existingIndex] = entry;
  } else {
    history.unshift(entry);
  }
  
  // 最新100件まで保持
  if (history.length > 100) {
    history.splice(100);
  }
  
  saveHistory(history);
  return entry;
}

// YouTube metadata analysis
async function getYouTubeMetadata(url: string): Promise<VideoMetadata | null> {
  try {
    console.log('Fetching YouTube metadata for:', url);
    const info = await ytdl.getInfo(url);
    const videoDetails = info.videoDetails;
    const formats = info.formats;
    
    console.log('Successfully retrieved video info:');
    console.log('- Title:', videoDetails.title);
    console.log('- Channel:', videoDetails.author?.name);
    console.log('- Duration:', videoDetails.lengthSeconds);
    console.log('- View Count:', videoDetails.viewCount);
    
    // Chapter information extraction
    const description = videoDetails.description || '';
    const chapterRegex = /(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)/gm;
    const chapters = [];
    let match;
    
    while ((match = chapterRegex.exec(description)) !== null) {
      chapters.push({
        timestamp: match[1],
        title: match[2].trim()
      });
    }
    
    // Caption information
    const captions = (info as any).player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    
    // Extract thumbnail URL (preferably maxresdefault, then hqdefault, then mqdefault)
    let thumbnailUrl = '';
    if (videoDetails.thumbnails && videoDetails.thumbnails.length > 0) {
      // Sort thumbnails by width in descending order and pick the best quality
      const sortedThumbnails = [...videoDetails.thumbnails].sort((a: any, b: any) => 
        (b.width || 0) - (a.width || 0)
      );
      thumbnailUrl = sortedThumbnails[0]?.url || '';
    }
    
    const metadata = {
      basic: {
        title: videoDetails.title || 'Unknown Title',
        videoId: videoDetails.videoId || extractVideoId(url) || '',
        duration: parseInt(videoDetails.lengthSeconds || '0'),
        channel: videoDetails.author?.name || videoDetails.ownerChannelName || 'Unknown Channel',
        viewCount: parseInt(videoDetails.viewCount || '0'),
        likes: parseInt(String(videoDetails.likes || '0')),
        uploadDate: videoDetails.uploadDate || videoDetails.publishDate || '',
        publishDate: videoDetails.publishDate || videoDetails.uploadDate || '',
        category: videoDetails.category || 'Unknown Category',
        description: (videoDetails.description || '').slice(0, 2000), // Limit description length
        thumbnail: thumbnailUrl
      },
      chapters: chapters,
      captions: captions.map((cap: any) => ({
        language: cap.languageCode || cap.vssId || 'unknown',
        name: cap.name?.simpleText || cap.name?.runs?.[0]?.text || 'Unknown'
      })),
      stats: {
        formatCount: formats.length,
        hasSubtitles: captions.length > 0,
        keywords: (videoDetails.keywords || []).slice(0, 10) // Limit keywords to first 10
      }
    };
    
    console.log('Metadata extraction completed successfully');
    return metadata;
  } catch (error) {
    console.error('Metadata retrieval error:', error);
    console.log('Attempting to create fallback metadata...');
    
    // Create fallback metadata with at least the video ID
    const videoId = extractVideoId(url);
    if (videoId) {
      console.log('Creating fallback metadata with video ID:', videoId);
      
      // Try to extract title from URL or use fallback
      let fallbackTitle = 'Unable to retrieve title';
      try {
        const urlParams = new URL(url).searchParams;
        const titleFromUrl = urlParams.get('title') || urlParams.get('v');
        if (titleFromUrl) {
          fallbackTitle = `Video: ${titleFromUrl}`;
        }
      } catch {
        // URL parsing failed, use default
      }
      
      return {
        basic: {
          title: fallbackTitle,
          videoId: videoId,
          duration: 0,
          channel: 'Channel information unavailable',
          viewCount: 0,
          likes: 0,
          uploadDate: '',
          publishDate: '',
          category: 'Unknown Category',
          description: 'Video description could not be retrieved due to API limitations',
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        },
        chapters: [],
        captions: [],
        stats: {
          formatCount: 0,
          hasSubtitles: false,
          keywords: []
        }
      };
    }
    
    console.log('Failed to create fallback metadata - no video ID found');
    return null;
  }
}

// Time format function (convert seconds to mm:ss format)
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Format transcript (without timestamps)
function formatTranscript(transcript: string): string {
  if (!transcript) return '';
  
  let formatted = transcript
    .replace(/\s+/g, ' ')
    .trim();
  
  // Japanese punctuation line breaks
  formatted = formatted
    .replace(/([。！？])/g, '$1\n\n')
    .replace(/([、])/g, '$1 ');
  
  // English sentence endings line breaks
  formatted = formatted
    .replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2');
  
  // Split long sentences (around 100 characters)
  formatted = formatted
    .replace(/(.{100,}?)([。！？、,.])/g, '$1$2\n');
  
  // Add line breaks for specific patterns
  formatted = formatted
    .replace(/(です|ます|だ|である)([。]?)\s*([あ-ん])/g, '$1$2\n\n$3')
    .replace(/([。])\s*(そして|しかし|ところで|また|さらに|一方|つまり|なお|ちなみに)/g, '$1\n\n$2')
    .replace(/([？])\s*([あ-んア-ン])/g, '$1\n\n$2');
  
  // Unify multiple line breaks
  formatted = formatted
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n\s+\n/g, '\n\n');
  
  // Remove leading whitespace
  formatted = formatted
    .split('\n')
    .map(line => line.trim())
    .join('\n');
  
  // Remove empty lines while preserving paragraph spacing
  formatted = formatted
    .replace(/\n\n+/g, '\n\n')
    .trim();
  
  return formatted;
}

// Format timestamped transcript
function formatTimestampedTranscript(timestampedSegments: TimestampedSegment[]): string {
  if (!timestampedSegments || timestampedSegments.length === 0) return '';
  
  return timestampedSegments.map(segment => {
    const startTime = formatTime(segment.start);
    const text = segment.text.trim();
    return `<div class="timestamp-segment" data-start="${segment.start}"><div class="timestamp-row"><span class="timestamp-time" onclick="seekToTime(${segment.start})">${startTime}</span><span class="timestamp-text">${text}</span></div></div>`;
  }).join('');
}

// Load prompts from prompts.json
function loadPrompts(): PromptsConfig {
  const promptsFile = 'prompts.json';
  if (fs.existsSync(promptsFile)) {
    try {
      return JSON.parse(fs.readFileSync(promptsFile, 'utf8'));
    } catch (error) {
      console.error('Error loading prompts:', error);
      return {};
    }
  }
  return {};
}

// Summary generation
async function generateSummary(
  transcript: string,
  metadata: VideoMetadata | null,
  gptModel: string = 'gpt-4o-mini',
  timestampedSegments: TimestampedSegment[] = [],
  contentType: 'youtube' | 'pdf' | 'audio' = 'youtube'
): Promise<Summary | null> {
  console.log('🎯 === generateSummary DEBUG START ===');
  console.log('  - Transcript length:', transcript?.length || 0);
  console.log('  - Has metadata:', !!metadata);
  console.log('  - GPT Model:', gptModel);
  console.log('  - Content Type:', contentType);
  console.log('  - Timestamped segments count:', timestampedSegments?.length || 0);
  console.log('  - OpenAI client configured:', !!openai);
  console.log('  - API Key exists:', !!process.env.OPENAI_API_KEY);
  
  try {
    const hasTimestamps = timestampedSegments && timestampedSegments.length > 0;
    
    // Load from prompts file
    const prompts = loadPrompts();
    let promptTemplate = '';
    
    // Get base template and context
    if (prompts && prompts.summarize && prompts.summarize.base && prompts.summarize.contexts && prompts.summarize.contexts[contentType]) {
      const baseTemplate = prompts.summarize.base.template;
      const context = prompts.summarize.contexts[contentType];
      
      // First replace context variables in base template
      promptTemplate = baseTemplate
        .replace(/\{\{contentType\}\}/g, context.contentType)
        .replace(/\{\{contextInfo\}\}/g, context.contextInfo)
        .replace(/\{\{overviewInstruction\}\}/g, context.overviewInstruction)
        .replace(/\{\{timeReference\}\}/g, context.timeReference)
        .replace(/\{\{additionalSections\}\}/g, context.additionalSections)
        .replace(/\{\{questionSectionTitle\}\}/g, context.questionSectionTitle)
        .replace(/\{\{questionExamples\}\}/g, context.questionExamples)
        .replace(/\{\{additionalNotes\}\}/g, context.additionalNotes);
      
      console.log(`📝 Using ${contentType} context with base prompt template from prompts.json`);
    } else if (prompts && prompts.summarize && prompts.summarize[contentType] && prompts.summarize[contentType].template) {
      // Backward compatibility: check old structure
      promptTemplate = prompts.summarize[contentType].template;
      console.log(`📝 Using legacy ${contentType} prompt template from prompts.json`);
    } else {
      // Default prompts for each content type
      console.log(`📝 Using default ${contentType} prompt template`);
      
      if (contentType === 'pdf') {
        promptTemplate = `あなたは学術論文・文書の分析専門家です。以下のPDF文書のテキストを分析し、学術的で構造化された要約を生成してください。

文書情報: タイトル={{title}}, 著者={{authors}}, ページ数={{pageCount}}

要約の形式:
## 📋 文書概要
(研究の目的、対象、手法を2-3文で要約)
## 🎯 主要な貢献・発見
- (論文の核となる新規性や主張を3-5個の箇条書きで)
## 🔬 研究手法・アプローチ
(使用された手法、実験設計、データセットなど)
## 📊 主要な結果・知見
(数値結果、統計的知見、重要な発見)
## 🔑 キーワード・専門用語
(重要な専門用語や概念を分かりやすく説明)
## 📈 実用的価値・応用
(研究成果の実際の応用可能性や影響)

注意事項: 学術的な正確性を重視、専門用語は適切に説明、数値や統計結果は具体的に記載
{{transcriptContent}}`;
      } else if (contentType === 'audio') {
        promptTemplate = `あなたは音声コンテンツの分析専門家です。以下の音声ファイルの文字起こしを分析し、音声特有の特徴を考慮した要約を生成してください。

音声情報: タイトル={{title}}, 長さ={{duration}}
{{timestampNote}}

要約の形式:
## 📋 音声概要
(音声の目的、内容、形式を2-3文で要約)
## 🎯 主要なトピック
- (重要な話題を3-5個の箇条書きで。時間参照を含める)
## 💡 詳細な内容
(各トピックの詳しい説明。具体的な時間を含める)
## 🔑 キーワード・用語
(重要な専門用語や固有名詞を説明。初出時間を含める)
## 📈 実践的価値
(聞き手が実際に活用できる内容。関連時間を含める)

注意事項: 音声特有の表現やニュアンスを考慮、時間参照は自然な文章の中に組み込む
{{transcriptContent}}`;
      } else {
        // YouTube default
        promptTemplate = `あなたは動画コンテンツの分析専門家です。以下のYouTube動画の文字起こしを分析し、読みやすくコンパクトな要約を生成してください。
動画情報: タイトル={{title}}, 長さ={{duration}}, チャンネル={{channel}}
{{timestampNote}}
出力形式（重要：節間に余分な空行を入れない）:
## 📋 動画概要
(動画の目的と内容を2-3文で簡潔に)
## 🎯 主要ポイント
- (重要な内容を3-5個の箇条書きで。時間参照を含める)
## 💡 詳細解説
(各ポイントの詳しい説明。具体的な時間を含める)
## 🔑 キーワード・用語
(重要な専門用語や概念を説明。初出時間を含める)
## 📈 実践的価値
(視聴者が実際に活用できる内容。関連時間を含める)
注意事項: 情報は正確で簡潔に、専門用語は分かりやすく説明、時間参照は自然な文章中に組み込む(例: 3:45で説明)。セクション間には空行を入れず、コンパクトに出力すること。
{{transcriptContent}}`;
      }
    }
    
    // Template variable replacement based on content type
    let title: string, duration: string, channel: string, authors: string, pageCount: string, language: string, format: string;
    
    if (contentType === 'pdf') {
      // PDF metadata handling
      const pdfMeta = (metadata as any)?.pdfMetadata || metadata; // Check for pdfMetadata field first
      title = pdfMeta?.title || pdfMeta?.basic?.title || '不明';
      authors = (pdfMeta?.authors && Array.isArray(pdfMeta.authors)) ? pdfMeta.authors.join(', ') : '不明';
      pageCount = pdfMeta?.pageCount?.toString() || '不明';
      language = pdfMeta?.language || '不明';
      duration = '不明'; // PDFs don't have duration
      channel = '不明'; // PDFs don't have channels
      format = 'PDF';
    } else if (contentType === 'audio') {
      // Audio metadata handling
      title = metadata?.basic?.title || '不明';
      duration = metadata?.basic?.duration ? Math.floor(metadata.basic.duration/60) + '分' + (metadata.basic.duration%60) + '秒' : '不明';
      channel = metadata?.basic?.channel || '不明';
      format = '音声ファイル';
      authors = '不明';
      pageCount = '不明';
      language = '不明';
    } else {
      // YouTube/video metadata handling
      title = metadata?.basic?.title || '不明';
      duration = metadata?.basic?.duration ? Math.floor(metadata.basic.duration/60) + '分' + (metadata.basic.duration%60) + '秒' : '不明';
      channel = metadata?.basic?.channel || '不明';
      authors = '不明';
      pageCount = '不明';
      language = '不明';
      format = '動画';
    }
    
    const timestampNote = hasTimestamps ? 
      `⚠️ 重要: タイムスタンプ情報が利用可能です。要約の各セクションで言及する内容には、該当する時間を必ず含めてください。
      
時間の表記方法:
- 特定の時点を参照する場合: その時間を直接記載 (例: 2:15 に説明されています)
- 範囲を示す場合: 開始時間のみ記載 (例: 4:30 から詳しく解説されています)
- 複数の関連箇所がある場合: 各時間を記載 (例: 1:20 と 5:45 で言及されています)

重要: 時間は必ず "分:秒" の形式で記載してください。フロントエンドでクリック可能なリンクとして表示されます。

タイムスタンプ付き文字起こし:
${timestampedSegments.map(segment => {
  const startTime = formatTime(segment.start);
  const endTime = formatTime(segment.start + segment.duration);
  return `[${startTime}-${endTime}] ${segment.text}`;
}).join('\n')}` :
      (contentType === 'pdf' ? 
        `ℹ️ 注意: この文書にはタイムスタンプ情報がありません。論文の構造と内容の論理的な流れを意識して要約を作成してください。` :
        `ℹ️ 注意: この${format}にはタイムスタンプ情報がありません。内容の順序や流れを意識して要約を作成してください。`);
    
    const transcriptContent = hasTimestamps ? '' : `${contentType === 'pdf' ? '文書内容' : '文字起こし内容'}:\n${transcript}`;
    
    const systemMessage = promptTemplate
      .replace(/\{\{title\}\}/g, title)
      .replace(/\{\{duration\}\}/g, duration)
      .replace(/\{\{channel\}\}/g, channel)
      .replace(/\{\{authors\}\}/g, authors)
      .replace(/\{\{pageCount\}\}/g, pageCount)
      .replace(/\{\{language\}\}/g, language)
      .replace(/\{\{format\}\}/g, format)
      .replace(/\{\{timestampNote\}\}/g, timestampNote)
      .replace(/\{\{transcriptContent\}\}/g, transcriptContent);

    const maxTokens = gptModel === 'gpt-3.5-turbo' ? 1500 : 2000;

    console.log('🤖 === OPENAI API CALL (generateSummary) ===');
    console.log('  - Model:', gptModel);
    console.log('  - Max tokens:', maxTokens);
    console.log('  - System message length:', systemMessage.length);
    console.log('  - System message preview:', systemMessage.substring(0, 200) + '...');

    let response;
    
    // Check for mock mode
    if (process.env.MOCK_OPENAI === 'true') {
      console.log('🎭 Using MOCK response for OpenAI API');
      
      // PDFコンテンツ用のモックレスポンスを生成
      const isPDFContent = transcriptContent.toLowerCase().includes('pdf') || 
                          transcriptContent.includes('論文') || 
                          transcriptContent.includes('研究');
      
      if (isPDFContent) {
        response = {
          choices: [{
            message: {
              content: `## 📋 文書概要
この文書は、PDFから抽出されたテキストの要約です。[モックモード: 実際のOpenAI APIは使用されていません]

## 🎯 主要ポイント
- PDFの内容が正常に抽出されています
- テキスト解析により主要な概念が識別されました
- 文書の構造が適切に認識されています

## 💡 詳細解説
抽出されたテキスト: "${transcriptContent.substring(0, 100)}..."

このPDFには重要な情報が含まれています。実際の要約を生成するには、有効なOpenAI APIキーが必要です。

## 🔑 キーワード・用語
PDFから抽出された主要な用語が表示されます。

## 📈 実践的価値
この文書の内容は、関連分野の研究や実務に活用できます。`
            }
          }]
        };
      } else {
        // 動画コンテンツ用のデフォルトモックレスポンス
        response = {
          choices: [{
            message: {
              content: `## 📋 動画概要
このコンテンツは、動画の文字起こしから生成された要約です。[モックモード]

## 🎯 主要ポイント
- 動画の文字起こしが正常に取得されました
- 主要なトピックが識別されています
- 内容の構造が分析されました

## 💡 詳細解説
文字起こし内容: "${transcriptContent.substring(0, 100)}..."

## 🔑 キーワード・用語
動画から抽出された重要な用語とその説明。

## 📈 実践的価値
この動画の内容を実践に活用する方法。`
            }
          }]
        };
      }
    } else {
      try {
        response = await openai.chat.completions.create({
          model: gptModel,
          messages: [
            {
              role: 'system',
              content: systemMessage
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.3
        });
        console.log('✅ OpenAI API call successful');
      } catch (error) {
        console.error('❌ OpenAI API error in generateSummary:', error);
        console.error('  - Error type:', error?.constructor?.name);
        console.error('  - Error message:', error?.message);
        console.error('  - Error response:', error?.response);
        console.error('  - Error status:', error?.response?.status);
        if (error instanceof OpenAIError) {
          throw error; // Re-throw OpenAIError to be handled by the caller
        }
        handleOpenAIError(error);
      }
    }

    const inputTokens = Math.ceil(systemMessage.length / 4);
    const outputTokens = Math.ceil((response.choices[0].message.content || '').length / 4);
    
    // Get model pricing with fallback (0 cost in mock mode)
    const modelPricing = process.env.MOCK_OPENAI === 'true' ? 
      { input: 0, output: 0 } :
      pricing.models[gptModel as keyof typeof pricing.models] || {
        input: pricing.input,
        output: pricing.output
      };
    const summaryCost = (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);
    
    sessionCosts.gpt += summaryCost;
    sessionCosts.total += summaryCost;

    console.log('🎯 === generateSummary DEBUG END ===');
    console.log('  - Summary generated successfully');
    console.log('  - Summary length:', response.choices[0].message.content?.length || 0);
    console.log('  - Cost:', summaryCost);
    console.log('  - Tokens:', { input: inputTokens, output: outputTokens });

    return {
      content: response.choices[0].message.content || '',
      model: gptModel,
      cost: summaryCost,
      tokens: { input: inputTokens, output: outputTokens }
    };

  } catch (error) {
    console.error('❌ === generateSummary ERROR ===');
    console.error('  - Error type:', error?.constructor?.name);
    console.error('  - Error message:', error?.message);
    console.error('  - Full error:', error);
    return null;
  }
}

async function downloadYouTubeAudio(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = ytdl(url, { quality: 'highestaudio' });
    
    ffmpeg(stream)
      .audioCodec('libmp3lame')
      .audioBitrate(64)
      .audioChannels(1)
      .audioFrequency(16000)
      .toFormat('mp3')
      .on('error', (err: Error) => {
        console.error('FFmpeg error:', err);
        reject(err);
      })
      .on('end', () => {
        console.log('Audio extraction completed');
        resolve();
      })
      .save(outputPath);
  });
}

async function transcribeAudio(audioPath: string, language: string = 'original', transcriptionModel: string = 'whisper-1'): Promise<TranscriptionResult> {
  const stats = fs.statSync(audioPath);
  const fileSizeInBytes = stats.size;
  const maxSize = 25 * 1024 * 1024; // 25MB
  
  if (fileSizeInBytes > maxSize) {
    // Split processing for large files
    return await transcribeLargeAudio(audioPath, language, transcriptionModel);
  }
  
  const audioFile = fs.createReadStream(audioPath);
  
  // For audio transcription with timestamps, we need to ensure we use a model that supports it
  const actualModel = (transcriptionModel === 'gpt-4o-transcribe' || transcriptionModel === 'gpt-4o-mini-transcribe') 
    ? 'whisper-1' 
    : transcriptionModel;
  
  if (actualModel !== transcriptionModel) {
    console.log(`⚠️ Using whisper-1 instead of ${transcriptionModel} to ensure timestamp support`);
  }
  
  const transcriptionParams: any = {
    file: audioFile,
    model: actualModel,
    response_format: 'verbose_json', // Always use verbose_json to get timestamps
    timestamp_granularities: ['segment']
  };
  
  // Add language setting
  if (language !== 'original') {
    transcriptionParams.language = language;
  }
  
  let transcription;
  try {
    transcription = await openai.audio.transcriptions.create(transcriptionParams);
  } catch (error) {
    handleOpenAIError(error);
  }
  
  return {
    text: transcription.text,
    timestampedSegments: (transcription as any).segments ? (transcription as any).segments.map((segment: any) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text
    })) : []
  };
}

async function transcribeLargeAudio(audioPath: string, language: string = 'original', transcriptionModel: string = 'whisper-1'): Promise<TranscriptionResult> {
  const segmentDuration = 600; // Split every 10 minutes
  const segmentPaths: string[] = [];
  
  return new Promise((resolve, reject) => {
    // First get the audio length
    ffmpeg.ffprobe(audioPath, async (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const duration = metadata?.format?.duration || 0;
      const segments = Math.ceil(duration / segmentDuration);
      const transcripts: any[] = [];
      
      try {
        // Process each segment
        for (let i = 0; i < segments; i++) {
          const startTime = i * segmentDuration;
          const segmentPath = audioPath.replace('.mp3', `_segment_${i}.mp3`);
          segmentPaths.push(segmentPath);
          
          await new Promise<void>((segResolve, segReject) => {
            ffmpeg(audioPath)
              .seekInput(startTime)
              .duration(segmentDuration)
              .on('error', segReject)
              .on('end', () => segResolve())
              .save(segmentPath);
          });
          
          // Transcribe segment
          const audioFile = fs.createReadStream(segmentPath);
          
          // For audio transcription with timestamps, we need to ensure we use a model that supports it
          const actualModel = (transcriptionModel === 'gpt-4o-transcribe' || transcriptionModel === 'gpt-4o-mini-transcribe') 
            ? 'whisper-1' 
            : transcriptionModel;
          
          const transcriptionParams: any = {
            file: audioFile,
            model: actualModel,
            response_format: 'verbose_json', // Always use verbose_json to get timestamps
            timestamp_granularities: ['segment']
          };
          
          // Add language setting
          if (language !== 'original') {
            transcriptionParams.language = language;
          }
          
          let transcription;
          try {
            transcription = await openai.audio.transcriptions.create(transcriptionParams);
          } catch (error) {
            handleOpenAIError(error);
          }
          
          transcripts.push({
            text: transcription.text,
            segments: (transcription as any).segments || [],
            offset: startTime
          });
        }
        
        // Delete segment files
        segmentPaths.forEach(path => {
          if (fs.existsSync(path)) {
            fs.unlinkSync(path);
          }
        });
        
        // Integrate segments with timestamp information
        const allSegments: TimestampedSegment[] = [];
        let combinedText = '';
        
        transcripts.forEach(transcriptResult => {
          combinedText += (combinedText ? ' ' : '') + transcriptResult.text;
          transcriptResult.segments.forEach((segment: any) => {
            allSegments.push({
              start: segment.start + transcriptResult.offset,
              end: segment.end + transcriptResult.offset,
              text: segment.text
            });
          });
        });
        
        resolve({
          text: combinedText,
          timestampedSegments: allSegments
        });
        
      } catch (error) {
        // Delete segment files
        segmentPaths.forEach(path => {
          if (fs.existsSync(path)) {
            fs.unlinkSync(path);
          }
        });
        reject(error);
      }
    });
  });
}

async function getYouTubeSubtitles(videoId: string, preferredLanguage: string = 'original'): Promise<SubtitlesResult | null> {
  const languageOrder = getLanguageOrder(preferredLanguage);
  
  for (const lang of languageOrder) {
    try {
      console.log(`Trying to get ${lang} subtitles...`);
      const transcripts = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: lang
      });
      
      if (transcripts && transcripts.length > 0) {
        console.log(`Found ${lang} subtitles`);
        return {
          text: transcripts.map(item => item.text).join(' '),
          detectedLanguage: lang,
          timestampedSegments: transcripts.map(item => ({
            start: parseFloat(item.offset),
            end: parseFloat(item.offset) + parseFloat(item.duration),
            text: item.text
          }))
        };
      }
    } catch {
      console.log(`No ${lang} subtitles found`);
      continue;
    }
  }
  
  console.log('No subtitles available in any language');
  return null;
}

function getLanguageOrder(preferredLanguage: string): string[] {
  switch (preferredLanguage) {
    case 'ja':
      return ['ja', 'en'];
    case 'en':
      return ['en', 'ja'];
    case 'original':
    default:
      // For original, try available subtitles in priority order
      return ['ja', 'en', 'ko', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'ru'];
  }
}

function extractVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function calculateAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata?.format?.duration || 0);
      }
    });
  });
}

// Article history management
function getArticleHistoryFile(videoId: string): string {
  return path.join('history', `article_${videoId}.json`);
}

function loadArticleHistory(videoId: string): ArticleHistoryEntry[] {
  const historyFile = getArticleHistoryFile(videoId);
  if (fs.existsSync(historyFile)) {
    try {
      return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    } catch (error) {
      console.error('Error loading article history:', error);
      return [];
    }
  }
  return [];
}

function saveArticleHistory(videoId: string, history: ArticleHistoryEntry[]): void {
  const historyFile = getArticleHistoryFile(videoId);
  try {
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Error saving article history:', error);
  }
}

function addArticleToHistory(
  videoId: string,
  article: string,
  type: 'generated' | 'merged' | 'pre-merge' | 'edited' = 'generated'
): void {
  const history = loadArticleHistory(videoId);
  const entry: ArticleHistoryEntry = {
    article,
    type,
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    id: `${type}_${Date.now()}`
  };
  
  history.unshift(entry);
  
  // Keep only the latest 50 entries
  if (history.length > 50) {
    history.splice(50);
  }
  
  saveArticleHistory(videoId, history);
}

// Analyze whether article context is needed for chat
async function analyzeNeedForArticleContext(message: string): Promise<boolean> {
  try {
    const analysisPrompt = `以下のメッセージを分析して、既存の解説記事の内容が回答に必要かどうかを判断してください。

メッセージ: "${message}"

判断基準:
- 記事の内容について質問している
- 記事の改善や修正を求めている  
- 記事の特定の部分について言及している
- 「記事」「解説」「内容」などの単語が含まれている
- 動画の内容について詳しく聞いている

回答は "YES" または "NO" のみで答えてください。`;

    let response;
    try {
      response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 10,
        temperature: 0
      });
    } catch (error) {
      handleOpenAIError(error);
    }

    const result = (response.choices[0].message.content || '').trim().toUpperCase();
    return result === 'YES';
  } catch (error) {
    console.error('Error analyzing article context need:', error);
    // Default to including context for safety
    return true;
  }
}

// Inference Statistics Calculation
function calculateInferenceStats(
  method: 'subtitle' | 'whisper',
  transcriptionCost: number,
  summaryCost: number,
  summaryResult: any,
  analysisDuration: number,
  totalCost: number,
  model: string
): any {
  // Calculate API call count
  let apiCallCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  
  // Transcription tokens (only for Whisper)
  const transcriptionTokens = method === 'whisper' ? 
    { input: 0, output: Math.ceil(transcriptionCost / 0.006 * 1000) } : // Estimate based on cost
    { input: 0, output: 0 };
  
  // Summary tokens
  const summaryTokens = summaryResult ? 
    summaryResult.tokens : 
    { input: 0, output: 0 };
  
  // Count API calls
  if (method === 'whisper') apiCallCount++;
  if (summaryResult) apiCallCount++;
  
  // Calculate total tokens
  totalInputTokens = transcriptionTokens.input + summaryTokens.input;
  totalOutputTokens = transcriptionTokens.output + summaryTokens.output;
  
  // Calculate efficiency metrics
  const tokensPerSecond = analysisDuration > 0 ? 
    (totalInputTokens + totalOutputTokens) / analysisDuration : 0;
  
  const costPerToken = (totalInputTokens + totalOutputTokens) > 0 ? 
    totalCost / (totalInputTokens + totalOutputTokens) : 0;
  
  // Calculate efficiency score (0-100)
  const baseScore = 80;
  const speedBonus = Math.min(tokensPerSecond / 10, 20); // Up to 20 points for speed
  const costEfficiencyBonus = Math.max(0, 5 - (costPerToken * 10000)); // Bonus for low cost per token
  const efficiencyScore = Math.min(100, Math.max(0, baseScore + speedBonus + costEfficiencyBonus));
  
  return {
    apiCallCount,
    totalTokens: { input: totalInputTokens, output: totalOutputTokens },
    modelUsed: model,
    tokensPerSecond: Math.round(tokensPerSecond * 100) / 100,
    costPerToken: Math.round(costPerToken * 100000) / 100000,
    efficiencyScore: Math.round(efficiencyScore),
    sessionCosts: { ...sessionCosts },
    callBreakdown: {
      transcription: { 
        tokens: transcriptionTokens, 
        cost: transcriptionCost, 
        method 
      },
      summary: { 
        tokens: summaryTokens, 
        cost: summaryCost 
      }
    }
  };
}

// API Endpoints

// API version of upload endpoint
app.post('/api/upload-youtube', async (req: Request, res: Response) => {
  let progressId: string | undefined;
  
  try {
    const analysisStartTime = new Date();
    const analysisStartTimeISO = analysisStartTime.toISOString();
    console.log('API server: /api/upload-youtube called at', analysisStartTimeISO);
    const { url, language = 'original', model = 'gpt-4o-mini', transcriptionModel = 'whisper-1' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Processing video:', { url, language, model });

    // Get video metadata
    const metadata = await getYouTubeMetadata(url);
    if (!metadata) {
      return res.status(500).json({ error: 'Failed to retrieve video metadata' });
    }
    const videoId = metadata.basic.videoId;

    // Create progress tracking record
    progressId = analysisProgressDB.createRecord(
      'youtube',
      metadata.basic.duration,
      transcriptionModel,
      model,
      0, // We'll update this once we have the transcript
      undefined, // audioQuality not applicable for YouTube
      language
    );

    // Process transcript
    let transcript = '';
    let timestampedSegments: TimestampedSegment[] = [];
    let method: 'subtitle' | 'whisper' = 'subtitle';
    let detectedLanguage = language;
    let transcriptionDuration = 0;

    // Track transcription start time
    const transcriptionStartTime = new Date();
    analysisProgressDB.updateTranscriptionProgress(progressId, transcriptionStartTime.toISOString());

    // Try subtitle first
    console.log('Attempting subtitle extraction...');
    const subtitleResult = await getYouTubeSubtitles(videoId, language);
    
    if (subtitleResult) {
      transcript = subtitleResult.text;
      timestampedSegments = subtitleResult.timestampedSegments;
      detectedLanguage = subtitleResult.detectedLanguage;
      method = 'subtitle';
      console.log('Subtitle extraction successful');
      // Subtitle extraction is fast, estimate 1-2 seconds
      transcriptionDuration = Math.round((new Date().getTime() - transcriptionStartTime.getTime()) / 1000);
      analysisProgressDB.updateTranscriptionProgress(progressId, transcriptionStartTime.toISOString(), new Date().toISOString());
    } else {
      console.log('Subtitle extraction failed, trying Whisper...');
      try {
        // Download audio and transcribe
        const audioPath = path.join('uploads', `${Date.now()}_audio.mp3`);
        await downloadYouTubeAudio(url, audioPath);
        
        const transcriptionResult = await transcribeAudio(audioPath, language, transcriptionModel);
        transcript = transcriptionResult.text;
        timestampedSegments = transcriptionResult.timestampedSegments;
        method = 'whisper';
        console.log('Whisper transcription successful');
        
        // Clean up audio file
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }

        // Calculate actual transcription time
        transcriptionDuration = Math.round((new Date().getTime() - transcriptionStartTime.getTime()) / 1000);
        analysisProgressDB.updateTranscriptionProgress(progressId, transcriptionStartTime.toISOString(), new Date().toISOString());
      } catch (whisperError) {
        console.error('Whisper transcription failed:', whisperError);
        analysisProgressDB.completeAnalysis(progressId, false, 'Whisper transcription failed');
        throw new Error('Failed to extract transcript using both methods');
      }
    }

    // 文字起こしコストを計算
    let transcriptionCost = 0;
    if (method === 'whisper') {
      // Whisper cost is $0.006 per minute
      const durationMinutes = Math.ceil(metadata.basic.duration / 60);
      transcriptionCost = durationMinutes * pricing.whisper;
      sessionCosts.whisper += transcriptionCost;
      sessionCosts.total += transcriptionCost;
    }

    // Update progress database with transcript length
    analysisProgressDB.updateTranscriptionProgress(progressId, transcriptionStartTime.toISOString(), new Date().toISOString());
    
    // Track summary start time
    const summaryStartTime = new Date();
    let summaryDuration = 0;
    analysisProgressDB.updateSummaryProgress(progressId, summaryStartTime.toISOString());

    // Generate summary
    let summaryResult = null;
    try {
      console.log('Generating summary...');
      summaryResult = await generateSummary(transcript, metadata, model, timestampedSegments, 'youtube');
      console.log('Summary generation successful');
      // Calculate actual summary generation time
      summaryDuration = Math.round((new Date().getTime() - summaryStartTime.getTime()) / 1000);
      analysisProgressDB.updateSummaryProgress(progressId, summaryStartTime.toISOString(), new Date().toISOString());
    } catch (summaryError) {
      console.warn('Summary generation failed:', summaryError);
      summaryDuration = Math.round((new Date().getTime() - summaryStartTime.getTime()) / 1000);
      analysisProgressDB.updateSummaryProgress(progressId, summaryStartTime.toISOString(), new Date().toISOString());
    }

    // Update current state
    currentTranscript = transcript;
    currentMetadata = metadata;
    currentTimestampedSegments = timestampedSegments;

    // Calculate total cost
    const summaryCost = summaryResult?.cost || 0;
    const totalCost = transcriptionCost + summaryCost;
    
    // Debug cost calculation
    console.log('=== NEW PROCESSING COST CALCULATION DEBUG ===');
    console.log('Method:', method);
    console.log('Video duration:', metadata.basic.duration, 'seconds');
    console.log('Duration minutes:', Math.ceil(metadata.basic.duration / 60));
    console.log('Pricing whisper:', pricing.whisper);
    console.log('Transcription cost calculated:', transcriptionCost);
    console.log('Summary result:', summaryResult ? 'Present' : 'Missing');
    console.log('Summary cost from result:', summaryResult?.cost || 'N/A');
    console.log('Summary cost used:', summaryCost);
    console.log('Total cost:', totalCost);
    console.log('Session costs after:', sessionCosts);
    console.log('================================================');

    // Calculate analysis time with individual component times
    const analysisEndTime = new Date();
    const analysisDuration = Math.round((analysisEndTime.getTime() - analysisStartTime.getTime()) / 1000);
    const analysisTimeInfo = {
      startTime: analysisStartTimeISO,
      endTime: analysisEndTime.toISOString(),
      duration: analysisDuration,
      transcription: transcriptionDuration,
      summary: summaryDuration,
      total: transcriptionDuration + summaryDuration
    };

    console.log('=== ANALYSIS TIME INFO ===');
    console.log('Start time:', analysisStartTimeISO);
    console.log('End time:', analysisEndTime.toISOString());
    console.log('Total duration:', analysisDuration, 'seconds');
    console.log('Transcription duration:', transcriptionDuration, 'seconds');
    console.log('Summary duration:', summaryDuration, 'seconds');
    console.log('==========================')

    // Add to history
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _historyEntry = addToHistory(
      videoId,
      metadata.basic.title,
      url,
      transcript,
      method,
      totalCost,
      metadata,
      summaryResult,
      language,
      model,
      timestampedSegments,
      [],
      [],
      null,
      analysisTimeInfo
    );

    // Add cost entry for tracking
    if (totalCost > 0) {
      addCostEntry(
        videoId,
        metadata.basic.title,
        method,
        language,
        model,
        transcriptionCost,
        summaryCost,
        totalCost
      );
    }

    // Calculate inference statistics
    const inferenceStats = calculateInferenceStats(
      method,
      transcriptionCost,
      summaryCost,
      summaryResult,
      analysisDuration,
      totalCost,
      model
    );

    // Enhanced metadata with costs, analysis time, transcript source, and inference stats
    const enhancedMetadata = {
      ...metadata,
      costs: {
        transcription: transcriptionCost,
        summary: summaryCost,
        article: 0,
        total: totalCost
      },
      analysisTime: analysisTimeInfo,
      transcriptSource: method,
      inferenceStats: inferenceStats
    };

    res.json({
      success: true,
      videoId,
      title: metadata.basic.title,
      transcript,
      timestampedSegments,
      metadata: enhancedMetadata,
      summary: summaryResult?.content,
      method,
      language: detectedLanguage,
      detectedLanguage,
      gptModel: model,
      cost: totalCost,
      costs: {
        transcription: transcriptionCost,
        summary: summaryCost,
        article: 0, // Article is generated separately
        total: totalCost
      },
      analysisTime: analysisTimeInfo,
      message: 'Video transcribed and analyzed successfully'
    });

    // Complete progress tracking
    analysisProgressDB.completeAnalysis(progressId, true);
    
  } catch (error) {
    console.error('Error in /api/upload-youtube:', error);
    
    // Complete progress tracking with error
    if (progressId) {
      analysisProgressDB.completeAnalysis(progressId, false, error instanceof Error ? error.message : 'Unknown error');
    }
    
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Video file upload endpoint
app.post('/api/upload-video-file', upload.single('file'), async (req: Request, res: Response) => {
  console.log('🎬 Video file upload request received');
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  const analysisStartTime = new Date();
  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const fileSize = req.file.size;
  const fileId = path.basename(req.file.filename, path.extname(req.file.filename));

  // Extract request parameters
  const language = req.body.language || 'original';
  const gptModel = req.body.gptModel || 'gpt-4o-mini';
  const transcriptionModel = req.body.transcriptionModel || 'whisper-1';
  const shouldGenerateSummary = req.body.generateSummary === 'true';
  const shouldGenerateArticle = req.body.generateArticle === 'true';

  console.log('📝 Processing video file:', {
    originalName,
    fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
    language,
    gptModel,
    shouldGenerateSummary,
    shouldGenerateArticle
  });

  try {
    // 1. Extract video metadata
    console.log('📊 Extracting video metadata...');
    const videoMeta = await extractVideoMetadata(filePath);
    
    // 2. Transcribe video using Whisper
    console.log('🎵 Starting transcription...');
    const transcriptionStartTime = new Date();
    const transcriptionResult = await transcribeVideoFile(filePath, transcriptionModel);
    const transcriptionEndTime = new Date();
    const transcriptionDuration = Math.round((transcriptionEndTime.getTime() - transcriptionStartTime.getTime()) / 1000);
    
    // 3. Calculate costs
    const durationMinutes = videoMeta.duration / 60;
    // Since we force whisper-1 for GPT-4o models in video files, use whisper-1 cost
    const actualTranscriptionModel = (transcriptionModel === 'gpt-4o-transcribe' || transcriptionModel === 'gpt-4o-mini-transcribe') 
      ? 'whisper-1' 
      : transcriptionModel;
    const transcriptionCost = calculateTranscriptionCost(actualTranscriptionModel, durationMinutes);
    
    let summary = '';
    let summaryCost = 0;
    let summaryTokens = { input: 0, output: 0 };
    let summaryDuration = 0;

    // 4. Generate summary if requested
    if (shouldGenerateSummary && transcriptionResult.text) {
      console.log('📝 Generating summary...');
      const summaryStartTime = new Date();
      try {
        const summaryResponse = await generateSummary(
          transcriptionResult.text,
          null, // No YouTube metadata for file uploads
          gptModel,
          transcriptionResult.segments,
          'youtube'
        );
        
        if (summaryResponse) {
          summary = summaryResponse.content;
          summaryCost = summaryResponse.cost;
          // summaryTokens = summaryResponse.tokens;
        }
      } catch (error) {
        console.error('Error generating summary:', error);
        // Continue without summary
      }
      const summaryEndTime = new Date();
      summaryDuration = Math.round((summaryEndTime.getTime() - summaryStartTime.getTime()) / 1000);
    }

    const analysisEndTime = new Date();
    const analysisTime = {
      startTime: analysisStartTime.toISOString(),
      endTime: analysisEndTime.toISOString(),
      duration: Math.round((analysisEndTime.getTime() - analysisStartTime.getTime()) / 1000),
      transcription: transcriptionDuration,
      summary: summaryDuration,
      total: transcriptionDuration + summaryDuration
    };

    // 5. Create video metadata
    const videoMetadata: VideoMetadata = {
      basic: {
        title: originalName.replace(/\.[^/.]+$/, ''), // Remove extension
        duration: videoMeta.duration,
        videoPath: `/uploads/${req.file.filename}` // Path to serve the video file
      },
      chapters: [],
      captions: [],
      stats: {
        formatCount: 1,
        hasSubtitles: false,
        keywords: []
      },
      transcript: transcriptionResult.text,
      summary,
      timestampedSegments: transcriptionResult.segments,
      transcriptSource: 'whisper',
      costs: {
        transcription: transcriptionCost,
        summary: summaryCost,
        article: 0,
        total: transcriptionCost + summaryCost
      },
      analysisTime,
      source: 'file',
      fileId,
      originalFilename: originalName,
      fileSize,
      uploadedAt: new Date().toISOString()
    };

    // 6. Save to history
    const historyEntry: HistoryEntry = {
      id: fileId,
      title: videoMetadata.basic.title,
      url: `file://${originalName}`,
      transcript: transcriptionResult.text,
      method: 'whisper',
      language,
      gptModel,
      cost: transcriptionCost + summaryCost,
      metadata: videoMetadata,
      summary: summary || null,
      timestampedSegments: transcriptionResult.segments,
      tags: [],
      mainTags: [],
      article: null,
      timestamp: new Date().toISOString(),
      savedAt: new Date().toISOString(),
      analysisTime
    };

    const history = loadHistory();
    history.unshift(historyEntry);
    saveHistory(history);

    // 7. Save cost information
    const costEntry: CostEntry = {
      videoId: fileId,
      title: videoMetadata.basic.title,
      method: 'whisper',
      language,
      gptModel,
      whisperCost: transcriptionCost,
      gptCost: summaryCost,
      totalCost: transcriptionCost + summaryCost,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0]
    };

    const costs = loadCosts();
    costs.unshift(costEntry);
    saveCosts(costs);

    // 8. Schedule file cleanup (after 1 hour)
    await cleanupTempFile(filePath, 60 * 60 * 1000);

    // 9. Send response
    const response: UploadVideoFileResponse = {
      title: videoMetadata.basic.title || originalName,
      metadata: videoMetadata,
      transcript: transcriptionResult.text,
      summary: summary,
      timestampedSegments: transcriptionResult.segments,
      method: 'whisper',
      detectedLanguage: language,
      costs: {
        transcription: transcriptionCost,
        summary: summaryCost,
        article: 0,
        total: transcriptionCost + summaryCost
      },
      analysisTime: {
        transcription: transcriptionDuration,
        summary: summaryDuration,
        total: transcriptionDuration + summaryDuration
      }
    };

    console.log('✅ Video file processing completed successfully');
    res.json(response);

  } catch (error) {
    console.error('❌ Error processing video file:', error);
    
    // Clean up file on error
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up file after processing error:', cleanupError);
    }

    sendErrorResponse(res, error, 'Failed to process video file');
  }
});

// Audio file upload endpoint
app.post('/api/upload-audio-file', upload.single('file'), async (req: Request, res: Response) => {
  console.log('🎵 Audio file upload request received');
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  const analysisStartTime = new Date();
  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const fileSize = req.file.size;
  const fileId = path.basename(req.file.filename, path.extname(req.file.filename));

  // Verify file type
  try {
    const fileType = detectFileType(req.file);
    if (fileType.type !== 'audio') {
      throw new Error('Uploaded file is not an audio file');
    }
  } catch (error) {
    // Clean up file
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError);
    }
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid file type'
    });
  }

  // Extract request parameters
  const language = req.body.language || 'original';
  const gptModel = req.body.gptModel || 'gpt-4o-mini';
  const transcriptionModel = req.body.transcriptionModel || 'whisper-1';
  const shouldGenerateSummary = req.body.generateSummary === 'true';

  console.log('📝 Processing audio file:', {
    originalName,
    fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
    language,
    gptModel,
    transcriptionModel,
    shouldGenerateSummary
  });

  try {
    // 1. Extract audio metadata
    console.log('📊 Extracting audio metadata...');
    const audioMetadata = await extractAudioMetadata(filePath);
    
    // 2. Transcribe audio
    console.log('🎵 Starting audio transcription...');
    const transcriptionStartTime = new Date();
    
    // Use existing transcription function (it works for audio too)
    const transcriptionResult = await transcribeVideoFile(filePath, transcriptionModel);
    
    const transcriptionEndTime = new Date();
    const transcriptionDuration = Math.round((transcriptionEndTime.getTime() - transcriptionStartTime.getTime()) / 1000);
    
    // 3. Calculate costs
    const durationMinutes = audioMetadata.basic!.duration! / 60;
    const transcriptionCost = calculateTranscriptionCost(transcriptionModel, durationMinutes);

    // 4. Generate summary if requested
    let summary = '';
    let summaryCost = 0;
    let summaryStartTime: Date | null = null;
    let summaryEndTime: Date | null = null;
    
    if (shouldGenerateSummary) {
      console.log('📝 Generating summary...');
      summaryStartTime = new Date();
      
      // Create metadata for summary generation
      const audioAsVideoMetadata: VideoMetadata = {
        basic: {
          title: audioMetadata.basic!.title || originalName,
          duration: audioMetadata.basic!.duration
        }
      };
      
      let summaryResult;
      try {
        summaryResult = await generateSummary(
          transcriptionResult.text,
          audioAsVideoMetadata,
          gptModel,
          transcriptionResult.segments
        );
      } catch (summaryError) {
        console.error('Error generating audio summary:', summaryError);
        // Create a default summary result
        summaryResult = {
          content: '',
          cost: 0
        };
      }
      
      if (summaryResult) {
        summary = summaryResult.text || summaryResult.content || '';
        summaryCost = summaryResult.cost || 0;
      }
      summaryEndTime = new Date();
    }

    // 5. Track costs
    const totalCost = transcriptionCost + summaryCost;
    sessionCosts.whisper += transcriptionCost;
    sessionCosts.gpt += summaryCost;
    sessionCosts.total += totalCost;

    // Save to costs history
    const costEntry: CostEntry = {
      videoId: fileId,
      title: audioMetadata.basic!.title || originalName,
      method: 'whisper',
      language,
      gptModel,
      whisperCost: transcriptionCost,
      gptCost: summaryCost,
      totalCost,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString()
    };
    
    // Save to costs history
    const costs = loadCosts();
    costs.push(costEntry);
    saveCosts(costs);

    // 6. Save transcript
    const transcriptPath = path.join('transcripts', `${Date.now()}_${fileId}_${language}_${gptModel}_transcript.txt`);
    fs.writeFileSync(transcriptPath, transcriptionResult.text);

    // 7. Calculate analysis time
    const analysisEndTime = new Date();
    const totalAnalysisTime = Math.round((analysisEndTime.getTime() - analysisStartTime.getTime()) / 1000);
    const summaryDuration = summaryStartTime && summaryEndTime 
      ? Math.round((summaryEndTime.getTime() - summaryStartTime.getTime()) / 1000)
      : 0;

    // 8. Prepare response
    const response: AudioUploadResponse = {
      success: true,
      title: audioMetadata.basic!.title || originalName,
      fileId,
      originalName,
      size: fileSize,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
      transcript: transcriptionResult.text,
      summary,
      timestampedSegments: transcriptionResult.segments,
      method: 'whisper',
      costs: {
        transcription: transcriptionCost,
        summary: summaryCost,
        article: 0,
        total: totalCost
      },
      audioMetadata: {
        ...audioMetadata,
        transcript: transcriptionResult.text,
        summary,
        timestampedSegments: transcriptionResult.segments,
        costs: {
          transcription: transcriptionCost,
          summary: summaryCost,
          article: 0,
          total: totalCost
        },
        analysisTime: {
          transcription: transcriptionDuration,
          summary: summaryDuration,
          total: totalAnalysisTime
        },
        source: 'file',
        fileId,
        originalFilename: originalName,
        fileSize,
        uploadedAt: new Date().toISOString()
      },
      analysisTime: {
        transcription: transcriptionDuration,
        summary: summaryDuration,
        total: totalAnalysisTime
      },
      message: 'Audio file processed successfully'
    };

    // 9. Save to history using the existing addToHistory function
    addToHistory(
      fileId,  // videoId
      audioMetadata.basic!.title || originalName,  // title
      '',  // url (empty for uploaded files)
      transcriptionResult.text,  // transcript
      'whisper',  // method
      totalCost,  // cost
      response.audioMetadata as any,  // metadata
      summary ? { text: summary, cost: summaryCost } : null,  // summary
      language,  // language
      gptModel,  // gptModel
      transcriptionResult.segments,  // timestampedSegments
      [],  // tags
      [],  // mainTags
      null,  // article
      {  // analysisTime
        startTime: analysisStartTime.toISOString(),
        endTime: analysisEndTime.toISOString(),
        duration: totalAnalysisTime
      }
    );

    // 10. Clean up audio file after delay
    cleanupTempFile(filePath, 5 * 60 * 1000); // 5 minutes

    console.log('✅ Audio file processed successfully');
    res.json(response);

  } catch (error) {
    console.error('❌ Error processing audio file:', error);
    
    // Clean up file on error
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up file after processing error:', cleanupError);
    }

    sendErrorResponse(res, error, 'Failed to process audio file');
  }
});

// PDF analysis endpoint (handles both URL and file upload)
app.post('/api/analyze-pdf', upload.single('file'), async (req: Request, res: Response) => {
  console.log('📄 PDF analysis request received');
  
  const analysisStartTime = new Date();
  let pdfBuffer: Buffer;
  let fileName: string;
  let fileSize: number;
  let fileId: string;
  let filePath: string | undefined;
  let isUrlSource = false;

  try {
    // Determine source (URL or file)
    if (req.body.url) {
      // Handle PDF URL
      isUrlSource = true;
      const pdfUrl = req.body.url;
      console.log('📥 Downloading PDF from URL:', pdfUrl);
      
      // Validate URL
      const urlPattern = /^https:\/\/.+\.pdf$/i;
      const academicPattern = /arxiv\.org|\.edu|doi\.org/i;
      if (!urlPattern.test(pdfUrl) && !academicPattern.test(pdfUrl)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid PDF URL. Must be HTTPS and point to a PDF file or academic resource.'
        });
      }
      
      pdfBuffer = await downloadPDF(pdfUrl);
      fileName = path.basename(new URL(pdfUrl).pathname) || 'downloaded.pdf';
      fileSize = pdfBuffer.length;
      fileId = crypto.randomUUID();
      
    } else if (req.file) {
      // Handle PDF file upload
      const fileType = detectFileType(req.file);
      if (fileType.type !== 'pdf') {
        throw new Error('Uploaded file is not a PDF');
      }
      
      filePath = req.file.path;
      fileName = req.file.originalname;
      fileSize = req.file.size;
      fileId = path.basename(req.file.filename, path.extname(req.file.filename));
      pdfBuffer = fs.readFileSync(filePath);
      
    } else {
      return res.status(400).json({
        success: false,
        error: 'No PDF URL or file provided'
      });
    }

    // Extract request parameters
    const language = req.body.language || 'original';
    const gptModel = req.body.gptModel || 'gpt-4o-mini';
    const shouldGenerateSummary = req.body.generateSummary === 'true' || req.body.generateSummary === true;
    const shouldExtractStructure = req.body.extractStructure === 'true' || req.body.extractStructure === true;

    console.log('📝 Processing PDF:', {
      fileName,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      language,
      gptModel,
      shouldGenerateSummary,
      shouldExtractStructure,
      source: isUrlSource ? 'url' : 'file'
    });

    // 1. Extract PDF text
    console.log('📊 Extracting PDF text...');
    const extractionStartTime = new Date();
    const pdfContent = await extractPDFText(pdfBuffer);
    const extractionEndTime = new Date();
    const extractionDuration = Math.round((extractionEndTime.getTime() - extractionStartTime.getTime()) / 1000);
    
    // 2. Analyze PDF structure
    let pdfMetadata: PDFMetadata | undefined;
    if (shouldExtractStructure) {
      console.log('🔍 Analyzing PDF structure...');
      pdfMetadata = analyzePDFStructure(pdfContent);
      pdfMetadata.fileSize = fileSize;
    }

    // 3. Generate summary if requested
    let summary = '';
    let summaryCost = 0;
    let summaryStartTime: Date | null = null;
    let summaryEndTime: Date | null = null;
    
    if (shouldGenerateSummary) {
      console.log('📝 Generating PDF summary...');
      summaryStartTime = new Date();
      
      // If pdfMetadata is not available, create a minimal one
      const metadataForSummary = pdfMetadata || {
        title: fileName,
        pageCount: pdfContent.pageCount,
        fileSize: fileSize
      };
      
      try {
        // Prepare transcript for generateSummary
        const pdfTranscript = pdfContent.fullText;
        
        // Create metadata object compatible with VideoMetadata
        const pdfVideoMetadata = {
          basic: {
            title: metadataForSummary.title || fileName,
            duration: 0, // PDFs don't have duration
            thumbnail: '',
            channel: metadataForSummary.authors?.join(', ') || '',
            views: 0,
            likes: 0
          },
          detailed: {
            publishedAt: '',
            description: `PDF Document: ${metadataForSummary.pageCount} pages`
          },
          pdfMetadata: metadataForSummary // Preserve original PDF metadata
        };
        
        // Use generateSummary with 'pdf' content type
        const summaryResult = await generateSummary(
          pdfTranscript,
          pdfVideoMetadata as any,
          gptModel,
          [], // No timestamped segments for PDF
          'pdf' // Content type
        );
        
        summary = summaryResult?.content || summaryResult?.text || '';
        
        // Calculate summary cost
        const modelPricing = pricing.models[gptModel as keyof typeof pricing.models] || pricing.models['gpt-4o-mini'];
        const inputTokens = Math.ceil(pdfContent.fullText.length / 4); // Rough token estimate
        const outputTokens = Math.ceil(summary.length / 4);
        summaryCost = (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);
        
        summaryEndTime = new Date();
      } catch (summaryError) {
        console.error('Error generating PDF summary:', summaryError);
        // Continue without summary - don't fail the entire request
        summary = '';
        summaryCost = 0;
        summaryEndTime = new Date();
        
        // If it's an OpenAI error, we might want to include it in the response
        if (summaryError instanceof OpenAIError) {
          console.log('OpenAI API error detected, continuing without summary');
        }
      }
    }

    // 4. Track costs (PDF parsing is free, only summary cost)
    sessionCosts.gpt += summaryCost;
    sessionCosts.pdf += 0; // PDF parsing is currently free
    sessionCosts.total += summaryCost;

    // Save to costs history
    const costEntry: CostEntry = {
      videoId: fileId,
      title: pdfMetadata?.title || fileName,
      method: 'pdf', // PDF processing method
      language,
      gptModel,
      whisperCost: 0,
      gptCost: summaryCost,
      pdfCost: 0, // PDF parsing is currently free (no cost for PDF extraction)
      totalCost: summaryCost,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString()
    };
    
    // Save to costs history
    const costs = loadCosts();
    costs.push(costEntry);
    saveCosts(costs);

    // 5. Calculate analysis time
    const analysisEndTime = new Date();
    const totalAnalysisTime = Math.round((analysisEndTime.getTime() - analysisStartTime.getTime()) / 1000);
    const summaryDuration = summaryStartTime && summaryEndTime 
      ? Math.round((summaryEndTime.getTime() - summaryStartTime.getTime()) / 1000)
      : 0;
    
    // Validate timing values to ensure they are reasonable
    const validatedExtractionDuration = Math.max(0, extractionDuration || 0);
    const validatedSummaryDuration = Math.max(0, summaryDuration || 0);
    
    // Calculate actual processing time as extraction + summary
    const actualProcessingTime = validatedExtractionDuration + validatedSummaryDuration;
    
    console.log(`📊 PDF timing calculation (validated):`);
    console.log(`   📄 Extraction: ${extractionDuration}s → ${validatedExtractionDuration}s`);
    console.log(`   📝 Summary: ${summaryDuration}s → ${validatedSummaryDuration}s`); 
    console.log(`   ⏱️ Total processing: ${actualProcessingTime}s`);
    console.log(`   🕒 Wall clock: ${totalAnalysisTime}s`);

    // 6. Prepare response (limit content size to prevent network errors)
    let limitedPdfContent = undefined;
    if (shouldExtractStructure && pdfContent) {
      // Create a limited version of PDF content to prevent ERR_CONTENT_LENGTH_MISMATCH
      limitedPdfContent = {
        fullText: pdfContent.fullText.length > 50000 
          ? pdfContent.fullText.substring(0, 50000) + '... [Content truncated for network transmission]'
          : pdfContent.fullText,
        sections: pdfContent.sections.map(section => ({
          ...section,
          // Limit section content to 1000 chars each
          content: section.content.length > 1000 
            ? section.content.substring(0, 1000) + '... [Truncated]'
            : section.content
        })).slice(0, 20), // Limit to first 20 sections
        pageCount: pdfContent.pageCount,
        language: pdfContent.language
      };
    }

    const response: PDFAnalysisResponse = {
      success: true,
      title: pdfMetadata?.title || fileName,
      fileId,
      originalName: fileName,
      size: fileSize,
      transcript: pdfContent.fullText,  // Add the extracted text as transcript
      summary,
      pdfContent: limitedPdfContent,
      pdfMetadata,
      analysisType: 'pdf' as AnalysisType,  // Specify the analysis type
      // Add content metrics for better prediction
      contentMetrics: {
        pageCount: pdfContent.pageCount,
        characterCount: pdfContent.fullText.length,
        wordCount: pdfContent.fullText.split(/\s+/).length
      },
      costs: {
        transcription: 0,
        summary: summaryCost,
        article: 0,
        total: summaryCost
      },
      analysisTime: {
        startTime: analysisStartTime.toISOString(),
        endTime: analysisEndTime.toISOString(),
        duration: totalAnalysisTime,
        extraction: validatedExtractionDuration,
        summary: validatedSummaryDuration,
        total: actualProcessingTime
      },
      message: 'PDF analyzed successfully'
    };

    // 7. Save to history using the existing addToHistory function
    const pdfAsVideoMetadata: VideoMetadata = {
      basic: {
        title: pdfMetadata?.title || fileName
      }
    };
    
    addToHistory(
      fileId,  // videoId
      pdfMetadata?.title || fileName,  // title
      isUrlSource ? (req.body.url || '') : '',  // url
      pdfContent.fullText.substring(0, 5000),  // transcript (first 5000 chars of PDF text)
      'subtitle',  // method (PDFs don't need transcription)
      summaryCost,  // cost
      pdfAsVideoMetadata,  // metadata
      summary ? { text: summary, cost: summaryCost } : null,  // summary
      language,  // language
      gptModel,  // gptModel
      [],  // timestampedSegments (not applicable for PDFs)
      [],  // tags
      [],  // mainTags
      null,  // article
      {  // analysisTime
        startTime: analysisStartTime.toISOString(),
        endTime: analysisEndTime.toISOString(),
        duration: totalAnalysisTime,
        extraction: validatedExtractionDuration,
        summary: validatedSummaryDuration,
        total: actualProcessingTime
      }
    );

    // 8. Clean up file if uploaded
    if (filePath) {
      cleanupTempFile(filePath, 5 * 60 * 1000); // 5 minutes
    }

    console.log('✅ PDF processed successfully');
    res.json(response);

  } catch (error) {
    console.error('❌ Error processing PDF:', error);
    
    // Clean up file on error
    if (filePath) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up file after processing error:', cleanupError);
      }
    }

    sendErrorResponse(res, error, 'Failed to process PDF');
  }
});

app.post('/upload-youtube', async (req: Request, res: Response) => {
  try {
    console.log('TypeScript server: /upload-youtube called');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { url, language = 'original', gptModel = 'gpt-4o-mini', transcriptionModel = 'whisper-1', mainTags = [], tags = '', forceRegenerate = false } = req.body;
    
    console.log('Parsed parameters:', { url, language, gptModel, mainTags, tags, forceRegenerate });
    
    if (!url) {
      console.log('Error: No URL provided');
      return res.status(400).json({ 
        success: false,
        title: '',
        transcript: '',
        metadata: {} as VideoMetadata,
        method: 'subtitle',
        language: '',
        gptModel: '',
        timestampedSegments: [],
        cost: 0,
        message: 'YouTube URL is required',
        costs: sessionCosts
      });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ 
        success: false,
        title: '',
        transcript: '',
        metadata: {} as VideoMetadata,
        method: 'subtitle',
        language: '',
        gptModel: '',
        timestampedSegments: [],
        cost: 0,
        message: 'Invalid YouTube URL',
        costs: sessionCosts
      });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ 
        success: false,
        title: '',
        transcript: '',
        metadata: {} as VideoMetadata,
        method: 'subtitle',
        language: '',
        gptModel: '',
        timestampedSegments: [],
        cost: 0,
        message: 'Could not extract video ID from URL',
        costs: sessionCosts
      });
    }

    // Check existing transcription from history (only if forceRegenerate is false)
    if (!forceRegenerate) {
      const history = loadHistory();
      const existingEntry = history.find(item => 
        item.id === videoId && 
        item.language === language && 
        item.gptModel === gptModel
      );
      if (existingEntry) {
        currentTranscript = existingEntry.transcript;
        currentMetadata = existingEntry.metadata;
        // currentSummary = existingEntry.summary;
        currentTimestampedSegments = existingEntry.timestampedSegments || [];
        currentArticle = existingEntry.article;
        
        // セッションコストに加算（履歴から復元しても料金は発生したものとして扱う）
        const totalCost = existingEntry.cost || 0;
        sessionCosts.total += totalCost;
        
        // Whisperコストとして計上（methodがwhisperの場合）
        if (existingEntry.method === 'whisper' && existingEntry.metadata?.basic?.duration) {
          const durationMinutes = Math.ceil(existingEntry.metadata.basic.duration / 60);
          const whisperCost = durationMinutes * pricing.whisper;
          sessionCosts.whisper += whisperCost;
        }
        
        // GPTコスト（要約分）を計上
        if (existingEntry.costs?.summary) {
          sessionCosts.gpt += existingEntry.costs.summary;
        }
        
        console.log('Restored from history:');
        console.log('- currentTranscript length:', currentTranscript.length);
        console.log('- currentMetadata title:', currentMetadata?.basic.title);
        console.log('- has currentArticle:', !!currentArticle);
        console.log('- Added to session costs:', totalCost);
        
        // Build detailed cost information from history entry
        let transcriptionCost = 0;
        let summaryCost = 0;
        const articleCost = 0;
        
        // 文字起こしコストを計算
        if (existingEntry.method === 'whisper' && existingEntry.metadata?.basic?.duration) {
          const durationMinutes = Math.ceil(existingEntry.metadata.basic.duration / 60);
          transcriptionCost = durationMinutes * pricing.whisper;
        }
        
        // 要約コストを取得
        if (existingEntry.costs?.summary) {
          summaryCost = existingEntry.costs.summary;
        } else if (existingEntry.method === 'whisper' && existingEntry.cost) {
          // 古い履歴データの場合、costフィールドが要約コストのみの場合がある
          // その場合は、costフィールドを要約コストとして使用
          summaryCost = existingEntry.cost;
        }
        
        // 記事コストを計算（履歴には保存されていないため、通常は0）
        // 将来的に記事コストも履歴に保存される場合に備えて残しておく
        
        const detailedCosts = {
          transcription: transcriptionCost,
          summary: summaryCost,
          article: articleCost,
          total: transcriptionCost + summaryCost + articleCost
        };
        
        // Debug cost calculation from history
        console.log('=== HISTORY COST CALCULATION DEBUG ===');
        console.log('Method:', existingEntry.method);
        console.log('Video duration:', existingEntry.metadata?.basic?.duration || 'N/A', 'seconds');
        console.log('Duration minutes:', existingEntry.metadata?.basic?.duration ? Math.ceil(existingEntry.metadata.basic.duration / 60) : 'N/A');
        console.log('Pricing whisper:', pricing.whisper);
        console.log('Transcription cost calculated:', transcriptionCost);
        console.log('Summary cost from costs.summary:', existingEntry.costs?.summary || 'N/A');
        console.log('Summary cost from entry.cost:', existingEntry.cost || 'N/A');
        console.log('Summary cost used:', summaryCost);
        console.log('Article cost:', articleCost);
        console.log('Total cost:', detailedCosts.total);
        console.log('Original history cost:', existingEntry.cost);
        console.log('Summary from history:', existingEntry.summary ? 'Present' : 'Missing');
        console.log('Summary cost logic used:', existingEntry.costs?.summary ? 'costs.summary' : (existingEntry.method === 'whisper' && existingEntry.cost ? 'entry.cost fallback' : 'no cost'));
        console.log('=====================================');
        
        // Enhanced metadata with costs, analysis time, and transcript source from history
        const enhancedHistoryMetadata = {
          ...(existingEntry.metadata || {}),
          costs: detailedCosts,
          analysisTime: existingEntry.analysisTime,
          transcriptSource: existingEntry.method
        };

        return res.json({
          success: true,
          title: existingEntry.title,
          transcript: existingEntry.transcript,
          summary: existingEntry.summary,
          metadata: enhancedHistoryMetadata,
          method: existingEntry.method,
          language: existingEntry.language,
          gptModel: existingEntry.gptModel,
          timestampedSegments: existingEntry.timestampedSegments || [],
          cost: detailedCosts.total,
          costs: detailedCosts,
          analysisTime: existingEntry.analysisTime,
          message: 'Retrieved from history',
          fromHistory: true
        });
      }
    }

    const videoInfo = await ytdl.getInfo(url);
    const videoTitle = videoInfo.videoDetails.title;

    // Get metadata
    console.log('Getting video metadata...');
    const metadata = await getYouTubeMetadata(url);
    currentMetadata = metadata;

    // First try YouTube subtitles
    console.log(`Checking for YouTube subtitles (preferred language: ${language})...`);
    const subtitlesResult = await getYouTubeSubtitles(videoId, language);
    
    let transcript: string;
    let method: 'subtitle' | 'whisper';
    let cost = 0;
    let detectedLanguage = language;
    let timestampedSegments: TimestampedSegment[] = [];

    if (subtitlesResult) {
      console.log(`Using YouTube subtitles (${subtitlesResult.detectedLanguage})`);
      transcript = subtitlesResult.text;
      timestampedSegments = subtitlesResult.timestampedSegments || [];
      method = 'subtitle';
      detectedLanguage = subtitlesResult.detectedLanguage;
    } else {
      console.log('No subtitles found, using Whisper transcription...');
      const audioPath = path.join('uploads', `${Date.now()}_audio.mp3`);

      await downloadYouTubeAudio(url, audioPath);
      
      // Calculate audio duration and cost
      const duration = await calculateAudioDuration(audioPath);
      const durationMinutes = Math.ceil(duration / 60);
      cost = durationMinutes * pricing.whisper;
      sessionCosts.whisper += cost;
      sessionCosts.total += cost;

      const transcriptionResult = await transcribeAudio(audioPath, language, transcriptionModel);
      transcript = transcriptionResult.text;
      timestampedSegments = transcriptionResult.timestampedSegments || [];
      method = 'whisper';

      fs.unlinkSync(audioPath);
    }

    // Format transcript
    const formattedTranscript = formatTranscript(transcript);
    currentTranscript = formattedTranscript;
    currentMetadata = metadata;
    currentTimestampedSegments = timestampedSegments;
    
    console.log('Updated server state:');
    console.log('- currentTranscript length:', currentTranscript.length);
    console.log('- currentMetadata title:', currentMetadata.basic.title);
    console.log('- First 200 chars of transcript:', currentTranscript.substring(0, 200));

    // Generate summary
    console.log('Generating summary...');
    const summary = await generateSummary(formattedTranscript, metadata, gptModel, timestampedSegments);
    // currentSummary = summary;

    // Save to history
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _entry = addToHistory(
      videoId,
      videoTitle,
      url,
      formattedTranscript,
      method,
      cost,
      metadata,
      summary,
      detectedLanguage,
      gptModel,
      timestampedSegments,
      typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
      mainTags
    );

    // Add cost entry
    addCostEntry(
      videoId,
      videoTitle,
      method,
      detectedLanguage,
      gptModel,
      method === 'whisper' ? cost : 0,
      summary ? summary.cost : 0,
      cost + (summary ? summary.cost : 0)
    );

    res.json({
      success: true,
      title: videoTitle,
      transcript: formattedTranscript,
      summary: summary?.content,
      metadata: metadata || {} as VideoMetadata,
      method: method,
      language: detectedLanguage,
      gptModel: gptModel,
      detectedLanguage: detectedLanguage,
      timestampedSegments: timestampedSegments,
      cost: cost + (summary ? summary.cost : 0),
      message: 'Video transcribed and analyzed successfully',
      costs: sessionCosts
    });

  } catch (error) {
    console.error('Error processing YouTube video:', error);
    res.status(500).json({ 
      success: false,
      title: '',
      transcript: '',
      metadata: {} as VideoMetadata,
      method: 'subtitle',
      language: '',
      gptModel: '',
      timestampedSegments: [],
      cost: 0,
      message: 'Failed to process YouTube video',
      costs: sessionCosts
    });
  }
});

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, videoId, history, gptModel = 'gpt-4o-mini', transcript, summary } = req.body;
    
    console.log('🎯 === CHAT API REQUEST DETAILS ===')
    console.log('  - Raw gptModel from request:', gptModel)
    console.log('  - Type of gptModel:', typeof gptModel)
    console.log('  - Request body keys:', Object.keys(req.body))
    
    // 🔍 COMPREHENSIVE DEBUG LOGGING
    console.log('\n🔍 === CHAT API DEBUG START ===')
    console.log('📥 Request body keys:', Object.keys(req.body))
    console.log('📥 Full request body (stringified):', JSON.stringify(req.body, null, 2))
    console.log('📥 Request body analysis:', {
      message: message ? `"${message.substring(0, 50)}..."` : 'MISSING',
      videoId: videoId || 'MISSING',
      historyLength: history?.length || 0,
      gptModel,
      transcript: transcript ? {
        type: typeof transcript,
        length: typeof transcript === 'string' ? transcript.length : 'NOT_STRING',
        preview: typeof transcript === 'string' ? transcript.substring(0, 100) + '...' : JSON.stringify(transcript).substring(0, 100) + '...',
        isEmptyString: transcript === '',
        isTruthy: !!transcript,
        trimmedLength: typeof transcript === 'string' ? transcript.trim().length : 'NOT_STRING'
      } : 'MISSING',
      summary: summary ? {
        type: typeof summary,
        length: typeof summary === 'string' ? summary.length : 'NOT_STRING',
        preview: typeof summary === 'string' ? summary.substring(0, 100) + '...' : JSON.stringify(summary).substring(0, 100) + '...',
        isEmptyString: summary === '',
        isTruthy: !!summary,
        trimmedLength: typeof summary === 'string' ? summary.trim().length : 'NOT_STRING'
      } : 'MISSING'
    })
    
    console.log('🌐 Global state:')
    console.log('  - currentTranscript:', currentTranscript ? `${currentTranscript.length} chars` : 'MISSING')
    console.log('  - currentVideo:', currentVideo ? 'EXISTS' : 'MISSING')
    console.log('  - currentVideo.transcript:', currentVideo?.transcript ? `${currentVideo.transcript.length} chars` : 'MISSING')
    console.log('  - 🚨 CRITICAL: currentVideo is always null on server side!')
    console.log('  - 🚨 CRITICAL: Server-side currentVideo state is not synchronized with client!')
    console.log('  - 🚨 CRITICAL: Chat will FAIL unless transcript is sent from client!')
    
    if (!message) {
      console.log('❌ Message validation failed')
      return res.status(400).json({ 
        success: false,
        response: 'Message is required',
        model: gptModel,
        cost: 0,
        costs: sessionCosts,
        tokens: { input: 0, output: 0 }
      });
    }

    // Check for transcript availability - prioritize transcript from request
    console.log('🔍 Transcript validation:')
    console.log('  - transcript from request:', transcript !== undefined ? {
      value: transcript,
      type: typeof transcript,
      length: typeof transcript === 'string' ? transcript.length : 'not string',
      isEmptyString: transcript === '',
      isTruthy: !!transcript,
      trimmedLength: typeof transcript === 'string' ? transcript.trim().length : 'not string'
    } : 'UNDEFINED')
    console.log('  - currentTranscript global:', currentTranscript ? `${currentTranscript.length} chars` : 'MISSING')
    
    // Proper validation for non-empty strings
    const hasValidTranscript = transcript && typeof transcript === 'string' && transcript.trim().length > 0
    const hasValidCurrentTranscript = currentTranscript && typeof currentTranscript === 'string' && currentTranscript.trim().length > 0
    
    console.log('  - hasValidTranscript:', hasValidTranscript)
    console.log('  - hasValidCurrentTranscript:', hasValidCurrentTranscript)
    
    // Priority order: 1) Valid request transcript, 2) Global currentTranscript, 3) currentVideo.transcript
    let transcriptContent = ''
    
    if (hasValidTranscript) {
      transcriptContent = transcript
      console.log('  - ✅ Using transcript from request:', transcriptContent.length, 'chars')
    } else if (hasValidCurrentTranscript) {
      transcriptContent = currentTranscript
      console.log('  - ✅ Using global currentTranscript:', transcriptContent.length, 'chars')
    } else {
      // Always check currentVideo as fallback for historical videos
      console.log('  - No valid transcript from request or global, checking currentVideo...')
      console.log('  - currentVideo exists:', !!currentVideo)
      console.log('  - currentVideo.transcript exists:', !!currentVideo?.transcript)
      console.log('  - currentVideo.transcript value:', currentVideo?.transcript ? {
        type: typeof currentVideo.transcript,
        length: currentVideo.transcript.length,
        preview: currentVideo.transcript.substring(0, 100) + '...'
      } : 'MISSING')
      
      // Try to get from currentVideo if available
      const hasValidCurrentVideoTranscript = currentVideo?.transcript && typeof currentVideo.transcript === 'string' && currentVideo.transcript.trim().length > 0
      console.log('  - hasValidCurrentVideoTranscript:', hasValidCurrentVideoTranscript)
      
      if (hasValidCurrentVideoTranscript) {
        transcriptContent = currentVideo.transcript;
        console.log('  - ✅ Using currentVideo.transcript:', transcriptContent.length, 'chars')
      } else {
        console.log('  - ❌ No valid transcript found anywhere - returning error')
        console.log('  - 🔍 DEBUG: All sources checked:')
        console.log('    - Request transcript: ', hasValidTranscript ? 'VALID' : 'INVALID')
        console.log('    - Global currentTranscript: ', hasValidCurrentTranscript ? 'VALID' : 'INVALID')
        console.log('    - CurrentVideo transcript: ', hasValidCurrentVideoTranscript ? 'VALID' : 'INVALID')
        return res.status(400).json({ 
          success: false,
          response: '動画の文字起こしが見つかりません。まず動画をアップロードしてから質問してください。',
          model: gptModel,
          cost: 0,
          costs: sessionCosts,
          tokens: { input: 0, output: 0 }
        });
      }
    }
    
    console.log('  - Final transcriptContent selected:', transcriptContent ? `${typeof transcriptContent} (${transcriptContent.length} chars)` : 'MISSING')
    
    // Final validation with proper string checking
    const hasValidFinalTranscript = transcriptContent && typeof transcriptContent === 'string' && transcriptContent.trim().length > 0
    console.log('  - hasValidFinalTranscript:', hasValidFinalTranscript)
    
    if (!hasValidFinalTranscript) {
      console.log('  - ❌ Final validation failed - no valid transcript content')
      return res.status(400).json({ 
        success: false,
        response: '動画の文字起こしがありません。動画をアップロードして文字起こしを生成してから質問してください。',
        model: gptModel,
        cost: 0,
        costs: sessionCosts,
        tokens: { input: 0, output: 0 }
      });
    }
    
    console.log('  - ✅ Transcript validation passed!')
    console.log('🔍 === CHAT API DEBUG END ===\n')

    // Analyze if article context is needed
    const needsArticleContext = await analyzeNeedForArticleContext(message);
    
    // Prepare system message
    let systemContent = `以下はYouTube動画の文字起こしです。この内容に基づいて質問に答えてください。\n\n${transcriptContent}`;
    
    // Add article context if needed and available
    if (needsArticleContext && currentArticle) {
      systemContent += `\n\n以下は既存の解説記事です:\n\n${currentArticle}`;
    }
    
    // Include conversation history for context if provided
    const messages = []
    
    // Add system message
    messages.push({
      role: 'system',
      content: systemContent
    })
    
    // Add conversation history if provided
    if (history && Array.isArray(history) && history.length > 0) {
      // Add previous messages (limit to last 10 for token efficiency)
      const recentHistory = history.slice(-10)
      for (const msg of recentHistory) {
        if (msg.role && msg.content) {
          messages.push({
            role: msg.role,
            content: msg.content
          })
        }
      }
    }
    
    // Add current user message
    messages.push({
      role: 'user',
      content: message
    })

    console.log('🤖 === OPENAI API CALL DEBUG ===')
    console.log('  - Model:', gptModel)
    console.log('  - Messages count:', messages.length)
    console.log('  - System content length:', systemContent.length)
    console.log('  - User message:', message.substring(0, 100) + '...')
    console.log('  - OpenAI instance ready:', !!openai)
    console.log('  - API Key configured:', process.env.OPENAI_API_KEY ? 'YES' : 'NO')
    
    let response;
    try {
      response = await openai.chat.completions.create({
        model: gptModel,
        messages: messages as any,
        max_tokens: 2000,
        temperature: 0.7
      });
    } catch (error) {
      handleOpenAIError(error);
    }

    console.log('🤖 === OPENAI API RESPONSE ===')
    console.log('  - Response received:', !!response)
    console.log('  - Choices count:', response.choices?.length || 0)
    console.log('  - First choice content:', response.choices[0]?.message?.content?.substring(0, 100) + '...')

    // Calculate cost with safer model pricing lookup
    const inputTokens = Math.ceil(systemContent.length / 4) + Math.ceil(message.length / 4);
    const outputTokens = Math.ceil((response.choices[0].message.content || '').length / 4);
    
    console.log('🤖 === PRICING DEBUG ===')
    console.log('  - Model for pricing:', gptModel)
    console.log('  - Available models:', Object.keys(pricing.models))
    console.log('  - Model exists in pricing:', gptModel in pricing.models)
    
    // Validate model and use fallback if needed
    if (!(gptModel in pricing.models)) {
      console.log('  - ⚠️ WARNING: Model not found in pricing, using fallback');
    }
    
    const modelPricing = pricing.models[gptModel as keyof typeof pricing.models] || pricing.models['gpt-4o-mini'];
    console.log('  - Using pricing for:', modelPricing === pricing.models['gpt-4o-mini'] ? 'gpt-4o-mini (fallback)' : gptModel)
    console.log('  - Input price per token:', modelPricing.input)
    console.log('  - Output price per token:', modelPricing.output)
    
    const chatCost = (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);
    
    sessionCosts.gpt += chatCost;
    sessionCosts.total += chatCost;

    res.json({
      success: true,
      response: response.choices[0].message.content || '',
      model: gptModel,
      cost: chatCost,
      costs: sessionCosts,
      tokens: { input: inputTokens, output: outputTokens }
    });

  } catch (error) {
    console.error('🚨 Error in chat:', error);
    
    let errorMessage = 'Failed to process chat message';
    let statusCode = 500;
    
    // Provide more specific error messages based on the error type
    if (error instanceof Error) {
      console.error('🚨 Error name:', error.name);
      console.error('🚨 Error message:', error.message);
      console.error('🚨 Error stack:', error.stack);
      
      // Check for specific OpenAI API errors
      if (error.message.includes('API key')) {
        errorMessage = 'OpenAI API設定エラー: APIキーを確認してください。';
        statusCode = 401;
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'リクエスト制限に達しました。しばらくしてから再度お試しください。';
        statusCode = 429;
      } else if (error.message.includes('model')) {
        errorMessage = 'AI モデルの設定に問題があります。管理者に連絡してください。';
        statusCode = 400;
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorMessage = 'ネットワークエラーが発生しました。接続を確認してください。';
        statusCode = 503;
      } else if (error.message.includes('token')) {
        errorMessage = 'リクエストが大きすぎます。短い質問をお試しください。';
        statusCode = 400;
      } else {
        // Include the actual error message for debugging
        errorMessage = `チャット処理エラー: ${error.message}`;
      }
    }
    
    console.error('🚨 Final error response:', { errorMessage, statusCode });
    
    res.status(statusCode).json({ 
      success: false,
      response: errorMessage,
      model: req.body.gptModel || 'gpt-4o-mini',
      cost: 0,
      costs: sessionCosts,
      tokens: { input: 0, output: 0 }
    });
  }
});

// Additional API endpoints
app.get('/transcript', (req: Request, res: Response) => {
  const timestampedTranscript = formatTimestampedTranscript(currentTimestampedSegments);
  res.json({
    transcript: currentTranscript || 'No transcript available',
    timestampedTranscript: timestampedTranscript,
    timestampedSegments: currentTimestampedSegments
  });
});

app.get('/history', (req: Request, res: Response) => {
  const history = loadHistory();
  res.json({
    success: true,
    history: history
  });
});

// API version of history endpoint
app.get('/api/history', (req: Request, res: Response) => {
  const history = loadHistory();
  res.json({
    success: true,
    history: history
  });
});

app.get('/costs', (req: Request, res: Response) => {
  const costs = loadCosts();
  res.json(costs);
});

// API version of costs endpoint
app.get('/api/costs', (req: Request, res: Response) => {
  const costs = loadCosts();
  res.json(costs);
});

app.get('/session-costs', (req: Request, res: Response) => {
  console.log('TypeScript server: /session-costs called');
  res.json({
    ...sessionCosts,
    server: 'typescript',
    timestamp: new Date().toISOString()
  });
});

app.post('/load-from-history', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const history = loadHistory();
    const entry = history.find(item => item.id === videoId);
    
    if (!entry) {
      return res.status(404).json({ error: 'Video not found in history' });
    }

    // Update current session variables
    currentTranscript = entry.transcript;
    currentMetadata = entry.metadata;
    // currentSummary = entry.summary;
    currentTimestampedSegments = entry.timestampedSegments || [];
    currentArticle = entry.article;

    res.json({
      success: true,
      entry: entry
    });

  } catch (error) {
    console.error('Error loading from history:', error);
    res.status(500).json({ error: 'Failed to load from history' });
  }
});

app.post('/regenerate-summary', async (req: Request, res: Response) => {
  try {
    const { url, gptModel = 'gpt-4o-mini' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!currentTranscript) {
      return res.status(400).json({ error: 'No transcript available' });
    }

    // Generate new summary
    const summary = await generateSummary(currentTranscript, currentMetadata, gptModel, currentTimestampedSegments);
    // currentSummary = summary;

    // Update history
    const videoId = extractVideoId(url);
    if (videoId) {
      const history = loadHistory();
      const entryIndex = history.findIndex(item => item.id === videoId);
      if (entryIndex >= 0) {
        history[entryIndex].summary = summary?.content || summary?.text || '';
        history[entryIndex].gptModel = gptModel;
        saveHistory(history);
      }
    }

    res.json({
      success: true,
      summary: summary?.content,
      cost: summary?.cost || 0,
      costs: sessionCosts
    });

  } catch (error) {
    console.error('Error regenerating summary:', error);
    res.status(500).json({ error: 'Failed to regenerate summary' });
  }
});

app.post('/save-article', async (req: Request, res: Response) => {
  try {
    const { videoId, article } = req.body;
    
    if (!videoId || !article) {
      return res.status(400).json({ error: 'Video ID and article are required' });
    }
    
    // Update currentArticle
    currentArticle = article;
    
    // Update history
    const history = loadHistory();
    const existingIndex = history.findIndex(item => item.id === videoId);
    
    if (existingIndex >= 0) {
      history[existingIndex].article = article;
      history[existingIndex].timestamp = new Date().toISOString();
      saveHistory(history);
      
      // Save to article history
      addArticleToHistory(videoId, article, 'edited');
      
      res.json({
        success: true,
        message: 'Article saved successfully'
      });
    } else {
      res.status(404).json({ error: 'Video not found in history' });
    }
    
  } catch (error) {
    console.error('Error saving article:', error);
    res.status(500).json({ error: 'Failed to save article' });
  }
});

app.get('/article-history/:videoId', (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const history = loadArticleHistory(videoId);
    res.json(history);
  } catch (error) {
    console.error('Error loading article history:', error);
    res.status(500).json({ error: 'Failed to load article history' });
  }
});

app.delete('/article-history/:videoId/:entryId', (req: Request, res: Response) => {
  try {
    const { videoId, entryId } = req.params;
    const history = loadArticleHistory(videoId);
    const filteredHistory = history.filter(entry => entry.id !== entryId);
    saveArticleHistory(videoId, filteredHistory);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting article history entry:', error);
    res.status(500).json({ error: 'Failed to delete article history entry' });
  }
});

// Deprecated: Old article generation endpoint - replaced by /api/generate-article
// This endpoint is kept for backward compatibility but should not be used
/*
app.post('/generate-article', async (req: Request, res: Response) => {
  console.log('⚠️ WARNING: Using deprecated /generate-article endpoint. Use /api/generate-article instead.');
  return res.status(410).json({ 
    success: false,
    error: 'This endpoint is deprecated. Please use /api/generate-article instead.' 
  });
});
*/

// Article retrieval endpoint
app.get('/article/:videoId', (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    
    // Load history to find the article
    const history = loadHistory();
    const entry = history.find(item => item.id === videoId);
    
    if (!entry || !entry.article) {
      return res.status(404).json({ 
        success: false,
        error: 'Article not found for this video' 
      });
    }
    
    res.json({
      success: true,
      article: entry.article,
      title: entry.title,
      metadata: entry.metadata
    });
    
  } catch (error) {
    console.error('Error retrieving article:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve article' 
    });
  }
});

// Prompts configuration endpoints
app.get('/prompts', (_req: Request, res: Response) => {
  const prompts = loadPrompts();
  res.json(prompts);
});

app.post('/prompts/save', (req: Request, res: Response) => {
  try {
    const { type, template } = req.body;
    
    if (!type) {
      return res.status(400).json({ error: 'Type is required' });
    }
    
    const prompts = loadPrompts();
    
    // 空文字の場合はプロンプトを削除（デフォルトに戻す）
    if (!template || template.trim() === '') {
      delete prompts[type];
    } else {
      prompts[type] = {
        name: type,
        template: template
      };
    }
    
    const promptsFile = 'prompts.json';
    fs.writeFileSync(promptsFile, JSON.stringify(prompts, null, 2));
    
    res.json({
      success: true,
      message: 'Prompt saved successfully'
    });
    
  } catch (error) {
    console.error('Error saving prompt:', error);
    res.status(500).json({ error: 'Failed to save prompt' });
  }
});

// Settings endpoints for frontend compatibility
app.get('/api/settings', (_req: Request, res: Response) => {
  const DEFAULT_PROMPT = `Please provide a clear and concise transcription of the video content.
Focus on accuracy and readability while maintaining the original meaning.`;
  
  res.json({
    defaultPrompt: process.env.DEFAULT_PROMPT || DEFAULT_PROMPT,
    defaultLanguage: process.env.DEFAULT_LANGUAGE || 'ja'
  });
});

app.post('/api/settings', (req: Request, res: Response) => {
  try {
    const { defaultPrompt, defaultLanguage } = req.body;
    // In a real app, you would save these to a database or config file
    res.json({ 
      success: true, 
      message: 'Settings saved successfully',
      settings: { defaultPrompt, defaultLanguage }
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.get('/api/prompts', (_req: Request, res: Response) => {
  const prompts = loadPrompts();
  res.json(prompts);
});

app.post('/api/prompts', (req: Request, res: Response) => {
  try {
    const newPrompts = req.body;
    
    const promptsFile = 'prompts.json';
    fs.writeFileSync(promptsFile, JSON.stringify(newPrompts, null, 2));
    
    res.json({
      success: true,
      message: 'Prompts saved successfully'
    });
  } catch (error) {
    console.error('Error saving prompts:', error);
    res.status(500).json({ error: 'Failed to save prompts' });
  }
});

// Summarize endpoint
app.post('/api/summarize', async (req: Request, res: Response) => {
  console.log('📝 === /api/summarize REQUEST ===');
  console.log('  - Has transcript:', !!req.body.transcript);
  console.log('  - Transcript length:', req.body.transcript?.length || 0);
  console.log('  - GPT Model:', req.body.gptModel || 'gpt-4o-mini');
  
  try {
    const { transcript, gptModel = 'gpt-4o-mini', contentType, analysisType } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY is not configured');
      return res.status(503).json({ 
        error: '⚠️ OpenAI APIが設定されていません。管理者にお問い合わせください。' 
      });
    }

    // Determine content type
    let detectedContentType: 'youtube' | 'pdf' | 'audio' = 'youtube'; // default
    
    if (contentType) {
      detectedContentType = contentType;
    } else if (analysisType === 'pdf') {
      detectedContentType = 'pdf';
    } else if (analysisType === 'audio') {
      detectedContentType = 'audio';
    }
    
    console.log('📝 Detected content type:', detectedContentType);

    // Generate summary
    const summary = await generateSummary(transcript, null, gptModel, [], detectedContentType);
    
    if (!summary) {
      console.error('❌ generateSummary returned null');
      return res.status(503).json({ 
        error: '⚠️ 要約の生成に失敗しました。APIの利用制限に達している可能性があります。' 
      });
    }

    console.log('✅ Summary generated successfully');
    res.json({
      success: true,
      summary: summary.content,
      cost: summary.cost || 0
    });

  } catch (error) {
    console.error('❌ Error in /api/summarize:', error);
    console.error('  - Error type:', error?.constructor?.name);
    console.error('  - Error message:', error?.message);
    
    // Use simplified error response for backward compatibility with frontend
    if (error instanceof OpenAIError) {
      console.log('  - Returning OpenAIError with status:', error.statusCode);
      res.status(error.statusCode).json({
        error: error.message
      });
    } else {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary';
      console.log('  - Returning generic error');
      res.status(500).json({
        error: errorMessage
      });
    }
  }
});

// Generate article endpoint for TranscriptViewer
app.post('/api/generate-article', async (req: Request, res: Response) => {
  try {
    console.log('🔄 /api/generate-article endpoint called');
    const { transcript, gptModel = 'gpt-4o-mini' } = req.body;
    
    console.log('Request data:', {
      hasTranscript: !!transcript,
      transcriptLength: transcript?.length || 0,
      gptModel
    });
    
    if (!transcript) {
      console.error('❌ No transcript provided in request');
      return res.status(400).json({ 
        success: false,
        error: 'Transcript is required' 
      });
    }

    if (transcript.length < 10) {
      console.error('❌ Transcript too short:', transcript.length);
      return res.status(400).json({ 
        success: false,
        error: 'Transcript is too short to generate a meaningful article' 
      });
    }

    // Load article prompt template
    const prompts = loadPrompts();
    const articlePrompt = prompts.article?.template || `あなたは動画内容専門の解説記事ライターです。以下の文字起こしから、動画で実際に説明されている内容のみを使用して、コンパクトで読みやすい解説記事を作成してください。

**絶対条件（違反禁止）**:
✅ 文字起こしに明確に記載されている内容のみ使用
❌ 一般的なプログラミング解説・チュートリアルは絶対禁止
❌ 文字起こしにない外部知識・理論は絶対禁止
❌ 「初心者向け」など汎用的な内容は絶対禁止
❌ YouTube APIの使い方など、動画と無関係な内容は絶対禁止

**出力形式（セクション間の空行なし）**:
## 📖 この動画で学べること
（動画の話者が実際に説明している内容を簡潔に）

## 🎯 動画のポイント
- （動画で実際に言及されているポイントを箇条書きで）

## 💡 具体的な内容
（動画で示されている実例・デモ・コード・手順を具体的に）

## 🔧 動画で紹介されている活用方法
（話者が実際に推奨・紹介している実用的な使い方のみ）

## 📝 動画のまとめ
（話者の結論や言及された価値を明確に）

**文字起こし:**
{transcript}

**再度確認**: 文字起こしに明記されていない内容は一切追加しないでください。動画で実際に話されている内容のみを基に記事を作成してください。`;

    // Replace template variables
    const finalPrompt = articlePrompt.replace('{transcript}', transcript);

    console.log('🤖 Generating article with OpenAI...');
    console.log('Model:', gptModel);
    console.log('Prompt length:', finalPrompt.length);
    console.log('Transcript preview (first 200 chars):', transcript.substring(0, 200) + '...');
    console.log('Using prompts.json template:', !!prompts.article?.template);
    
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: gptModel,
        messages: [
          {
            role: 'user',
            content: finalPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });
    } catch (error) {
      handleOpenAIError(error);
    }

    const article = completion.choices[0]?.message?.content || '';
    
    console.log('📄 Article generated:', {
      hasArticle: !!article,
      articleLength: article.length,
      tokensUsed: completion.usage
    });
    
    if (!article) {
      console.error('❌ OpenAI returned empty article');
      return res.status(500).json({ 
        success: false,
        error: 'OpenAI returned empty article content' 
      });
    }
    
    // Calculate cost
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const modelPricing = pricing.models[gptModel as keyof typeof pricing.models] || pricing.models['gpt-4o-mini'];
    const cost = (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);

    // Add to session costs
    sessionCosts.gpt += cost;
    sessionCosts.total += cost;
    
    // Update current article
    currentArticle = article;
    
    // Update history if we have current metadata
    if (currentMetadata) {
      const videoId = currentMetadata.basic.videoId;
      if (videoId) {
        const history = loadHistory();
        const existingIndex = history.findIndex(item => item.id === videoId);
        
        if (existingIndex >= 0) {
          // Update existing entry with the generated article
          history[existingIndex].article = article;
          history[existingIndex].timestamp = new Date().toISOString();
          saveHistory(history);
          
          // Also save to article history
          addArticleToHistory(videoId, article, 'generated');
          console.log('📝 Article saved to history for video:', videoId);
        } else {
          console.log('⚠️ Could not find existing history entry for video:', videoId);
        }
      }
    }

    console.log('✅ Article generation successful');
    res.json({
      success: true,
      article: article,
      cost: cost,
      tokens: {
        input: inputTokens,
        output: outputTokens
      }
    });

  } catch (error) {
    console.error('❌ Error generating article:', error);
    sendErrorResponse(res, error, 'Failed to generate article');
  }
});

// Reset session costs endpoint
app.post('/reset-session-costs', (_req: Request, res: Response) => {
  sessionCosts = {
    whisper: 0,
    gpt: 0,
    pdf: 0,
    total: 0
  };
  console.log('Session costs reset');
  res.json({ success: true, message: 'Session costs reset', costs: sessionCosts });
});

// Server startup
// Cost estimation for YouTube URL
app.post('/api/estimate-cost-url', async (req: Request, res: Response) => {
  console.log('📊 Cost estimation request for URL', req.body);
  
  try {
    const { url, gptModel = 'gpt-4o-mini', transcriptionModel = 'whisper-1', generateSummary = true, generateArticle = false }: CostEstimationRequest = req.body;
    
    console.log('📊 Request params:', { url, gptModel, generateSummary, generateArticle });
    
    if (!url) {
      console.log('❌ URL is missing from request');
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      } as CostEstimationResponse);
    }
    
    // Validate YouTube URL
    console.log('📊 Validating YouTube URL:', url);
    if (!ytdl.validateURL(url)) {
      console.log('❌ Invalid YouTube URL:', url);
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL'
      } as CostEstimationResponse);
    }
    
    // Get video info from YouTube
    console.log('📊 Getting video info from YouTube for:', url);
    const info = await ytdl.getInfo(url);
    console.log('📊 Got video info successfully');
    
    const videoDetails = info.videoDetails;
    const duration = parseInt(videoDetails.lengthSeconds || '0');
    const durationMinutes = Math.ceil(duration / 60);
    
    console.log('📊 Video details:', { title: videoDetails.title, duration, durationMinutes });
    
    // Calculate costs
    console.log('📊 Calculating costs...');
    const transcriptionCost = calculateTranscriptionCost(transcriptionModel, durationMinutes);
    const gptCosts = estimateGPTCosts(durationMinutes, gptModel, generateSummary, generateArticle);
    const totalCost = transcriptionCost + gptCosts.summary + gptCosts.article;
    
    console.log(`📊 Cost estimation for "${videoDetails.title}": ${duration}s, $${totalCost.toFixed(4)}`);
    
    // Calculate processing time
    const processingTime = calculateProcessingTime(transcriptionModel, gptModel, durationMinutes, 'youtube');
    console.log(`📊 Estimated processing time: ${processingTime.formatted}`);
    
    const response: CostEstimationResponse = {
      success: true,
      title: videoDetails.title,
      duration,
      durationFormatted: formatDuration(duration),
      gptModel,
      estimatedCosts: {
        transcription: transcriptionCost,
        summary: gptCosts.summary,
        article: gptCosts.article,
        total: totalCost
      },
      estimatedProcessingTime: processingTime,
      message: 'Cost estimation completed'
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error estimating cost for URL:');
    console.error('❌ Error details:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during cost estimation';
    console.error('❌ Error message to client:', errorMessage);
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined
    } as CostEstimationResponse);
  }
});

// Cost estimation for PDF
app.post('/api/estimate-cost-pdf', async (req: Request, res: Response) => {
  console.log('📊 Cost estimation request for PDF');
  
  try {
    const { url, pageCount = 10, gptModel = 'gpt-4o-mini', generateSummary = true }: {
      url?: string;
      pageCount?: number;
      gptModel?: string;
      generateSummary?: boolean;
    } = req.body;
    
    console.log('📊 Request params:', { url, pageCount, gptModel, generateSummary });
    
    // Estimate character count based on page count
    // Average academic paper has ~3000-5000 characters per page
    const avgCharsPerPage = 4000;
    const estimatedCharacterCount = pageCount * avgCharsPerPage;
    
    // Calculate PDF processing time (extraction + summary)
    // PDF extraction: roughly 0.5-2 seconds per page based on complexity
    const extractionTime = pageCount * 1.5; // 1.5 seconds per page
    
    // Summary cost estimation
    let summaryCost = 0;
    let summaryTime = 0;
    
    if (generateSummary) {
      // Estimate tokens: roughly 1 token per 4 characters
      const inputTokens = Math.ceil(estimatedCharacterCount / 4);
      const outputTokens = Math.ceil(inputTokens * 0.2); // Summary is typically 20% of input
      
      const modelPricing = pricing.models[gptModel as keyof typeof pricing.models] || pricing.models['gpt-4o-mini'];
      summaryCost = (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);
      
      // Summary generation time: depends on model and text length
      const summarySecondsPerKChar = gptModel.includes('gpt-4') ? 3 : 2;
      summaryTime = (estimatedCharacterCount / 1000) * summarySecondsPerKChar;
    }
    
    const totalTime = extractionTime + summaryTime;
    
    // Format processing time
    const processingTime = {
      transcription: extractionTime,
      summary: summaryTime,
      total: totalTime,
      formatted: formatProcessingTime(totalTime),
      transcriptionRate: `${(extractionTime / pageCount).toFixed(1)}s/page`,
      summaryRate: summaryCost > 0 ? `${(summaryTime / pageCount).toFixed(1)}s/page` : '0s',
      basedOn: 'model_default',
      confidence: 0.6,
      isHistoricalEstimate: false
    };
    
    const response = {
      success: true,
      contentType: 'pdf',
      pageCount,
      estimatedCharacterCount,
      gptModel,
      estimatedCosts: {
        transcription: 0, // PDF parsing is free
        summary: summaryCost,
        article: 0,
        total: summaryCost
      },
      estimatedProcessingTime: processingTime,
      message: 'PDF cost estimation completed'
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error estimating PDF cost:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during PDF cost estimation'
    });
  }
});

// Cost estimation for uploaded file
app.post('/api/estimate-cost-file', upload.single('file'), async (req: Request, res: Response) => {
  console.log('📊 Cost estimation request for file');
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    } as FileCostEstimationResponse);
  }
  
  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const gptModel = req.body.gptModel || 'gpt-4o-mini';
  const transcriptionModel = req.body.transcriptionModel || 'whisper-1';
  const generateSummary = req.body.generateSummary === 'true';
  const generateArticle = req.body.generateArticle === 'true';
  
  try {
    // Extract video metadata
    const videoMeta = await extractVideoMetadata(filePath);
    const duration = videoMeta.duration;
    const durationMinutes = Math.ceil(duration / 60);
    
    // Calculate costs
    const transcriptionCost = calculateTranscriptionCost(transcriptionModel, durationMinutes);
    const gptCosts = estimateGPTCosts(durationMinutes, gptModel, generateSummary, generateArticle);
    const totalCost = transcriptionCost + gptCosts.summary + gptCosts.article;
    
    console.log(`📊 Cost estimation for "${originalName}": ${duration}s, $${totalCost.toFixed(4)}`);
    
    // Calculate processing time
    const fileType = detectFileType(req.file);
    const contentType = fileType.type === 'video' ? 'youtube' : 'audio'; // Treat video files as youtube for processing estimation
    const processingTime = calculateProcessingTime(transcriptionModel, gptModel, durationMinutes, contentType);
    console.log(`📊 Estimated processing time: ${processingTime.formatted}`);
    
    // Clean up temporary file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    const response: FileCostEstimationResponse = {
      success: true,
      filename: originalName,
      duration,
      durationFormatted: formatDuration(duration),
      gptModel,
      estimatedCosts: {
        transcription: transcriptionCost,
        summary: gptCosts.summary,
        article: gptCosts.article,
        total: totalCost
      },
      estimatedProcessingTime: processingTime,
      message: 'Cost estimation completed'
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error estimating cost for file:', error);
    
    // Clean up file on error
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up file after estimation error:', cleanupError);
    }
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during cost estimation'
    } as FileCostEstimationResponse);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Reset session costs on server startup
  sessionCosts = {
    whisper: 0,
    gpt: 0,
    pdf: 0,
    total: 0
  };
  console.log('Session costs initialized to zero');
});