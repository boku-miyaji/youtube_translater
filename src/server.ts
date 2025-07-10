import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import OpenAI from 'openai';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

// Manually set the environment variables if they were parsed but not set
if (result.parsed && !process.env.OPENAI_API_KEY) {
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
  SubtitlesResult
} from './types/index';

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
if (!fs.existsSync('transcripts')) {
  fs.mkdirSync('transcripts');
}
if (!fs.existsSync('history')) {
  fs.mkdirSync('history');
}

let currentTranscript = '';
let currentMetadata: VideoMetadata | null = null;
const currentVideo: VideoMetadata | null = null;
// let currentSummary: Summary | null = null;
let currentTimestampedSegments: TimestampedSegment[] = [];
let currentArticle: string | null = null;
let sessionCosts: SessionCosts = {
  whisper: 0,
  gpt: 0,
  total: 0
};

// 料金設定（2024年12月時点の最新公式価格）
const pricing: Pricing = {
  whisper: 0.006, // $0.006 per minute
  models: {
    'gpt-4o-mini': {
      input: 0.60 / 1000000, // $0.60 per 1M tokens
      output: 2.40 / 1000000  // $2.40 per 1M tokens
    },
    'gpt-4o': {
      input: 5.00 / 1000000, // $5.00 per 1M tokens
      output: 15.00 / 1000000  // $15.00 per 1M tokens
    },
    'gpt-4-turbo': {
      input: 10.00 / 1000000, // $10.00 per 1M tokens
      output: 30.00 / 1000000  // $30.00 per 1M tokens
    },
    'gpt-3.5-turbo': {
      input: 0.50 / 1000000, // $0.50 per 1M tokens
      output: 1.50 / 1000000  // $1.50 per 1M tokens
    },
    'gpt-4.1-nano': {
      input: 0.10 / 1000000, // $0.10 per 1M tokens
      output: 0.40 / 1000000  // $0.40 per 1M tokens
    },
    'gpt-4.1-mini': {
      input: 0.40 / 1000000, // $0.40 per 1M tokens
      output: 1.60 / 1000000  // $1.60 per 1M tokens
    },
    'gpt-4.1': {
      input: 2.00 / 1000000, // $2.00 per 1M tokens
      output: 8.00 / 1000000  // $8.00 per 1M tokens
    },
    'gpt-o3': {
      input: 2.00 / 1000000, // $2.00 per 1M tokens
      output: 8.00 / 1000000  // $8.00 per 1M tokens
    },
    'gpt-4o-mini-new': {
      input: 1.10 / 1000000, // $1.10 per 1M tokens
      output: 4.40 / 1000000  // $4.40 per 1M tokens
    }
  }
};

// 履歴ファイルのパス
const historyFile = path.join('history', 'transcripts.json');
const costsFile = path.join('history', 'costs.json');

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
  method: 'subtitle' | 'whisper',
  language: string,
  gptModel: string,
  whisperCost: number,
  gptCost: number,
  totalCost: number
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
  analysisTime: { startTime: string; endTime: string; duration: number } | null = null
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
    summary,
    timestampedSegments, // タイムスタンプ付きセグメント
    tags, // サブタグ情報
    mainTags, // メインタグ情報
    article, // 生成された記事コンテンツ
    thumbnail: metadata?.basic?.thumbnail || undefined, // Extract thumbnail from metadata
    timestamp: new Date().toISOString(),
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
  timestampedSegments: TimestampedSegment[] = []
): Promise<Summary | null> {
  try {
    const hasTimestamps = timestampedSegments && timestampedSegments.length > 0;
    
    // Load from prompts file
    const prompts = loadPrompts();
    let promptTemplate = '';
    
    if (prompts && prompts.summary && prompts.summary.template) {
      promptTemplate = prompts.summary.template;
    } else {
      // Default prompt
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
    
    // Template variable replacement
    const title = metadata?.basic?.title || '不明';
    const duration = metadata?.basic?.duration ? Math.floor(metadata.basic.duration/60) + '分' + (metadata.basic.duration%60) + '秒' : '不明';
    const channel = metadata?.basic?.channel || '不明';
    
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
      `ℹ️ 注意: この動画にはタイムスタンプ情報がありません。内容の順序や流れを意識して要約を作成してください。`;
    
    const timestampInstruction = hasTimestamps ? 'タイムスタンプ付き' : '内容の順序を意識';
    const transcriptContent = hasTimestamps ? '' : `文字起こし内容:\n${transcript}`;
    
    const systemMessage = promptTemplate
      .replace(/\{\{title\}\}/g, title)
      .replace(/\{\{duration\}\}/g, duration)
      .replace(/\{\{channel\}\}/g, channel)
      .replace(/\{\{timestampNote\}\}/g, timestampNote)
      .replace(/\{\{timestampInstruction\}\}/g, timestampInstruction)
      .replace(/\{\{transcriptContent\}\}/g, transcriptContent);

    const maxTokens = gptModel === 'gpt-3.5-turbo' ? 1500 : 2000;

    const response = await openai.chat.completions.create({
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

    const inputTokens = Math.ceil(systemMessage.length / 4);
    const outputTokens = Math.ceil((response.choices[0].message.content || '').length / 4);
    const modelPricing = pricing.models[gptModel];
    const summaryCost = (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);
    
    sessionCosts.gpt += summaryCost;
    sessionCosts.total += summaryCost;

    return {
      content: response.choices[0].message.content || '',
      model: gptModel,
      cost: summaryCost,
      tokens: { input: inputTokens, output: outputTokens }
    };

  } catch (error) {
    console.error('Summary generation error:', error);
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

async function transcribeAudio(audioPath: string, language: string = 'original'): Promise<TranscriptionResult> {
  const stats = fs.statSync(audioPath);
  const fileSizeInBytes = stats.size;
  const maxSize = 25 * 1024 * 1024; // 25MB
  
  if (fileSizeInBytes > maxSize) {
    // Split processing for large files
    return await transcribeLargeAudio(audioPath, language);
  }
  
  const audioFile = fs.createReadStream(audioPath);
  
  const transcriptionParams: any = {
    file: audioFile,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment']
  };
  
  // Add language setting
  if (language !== 'original') {
    transcriptionParams.language = language;
  }
  
  const transcription = await openai.audio.transcriptions.create(transcriptionParams);
  
  return {
    text: transcription.text,
    timestampedSegments: (transcription as any).segments ? (transcription as any).segments.map((segment: any) => ({
      start: segment.start,
      duration: segment.end - segment.start,
      text: segment.text
    })) : []
  };
}

async function transcribeLargeAudio(audioPath: string, language: string = 'original'): Promise<TranscriptionResult> {
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
          
          const transcriptionParams: any = {
            file: audioFile,
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['segment']
          };
          
          // Add language setting
          if (language !== 'original') {
            transcriptionParams.language = language;
          }
          
          const transcription = await openai.audio.transcriptions.create(transcriptionParams);
          
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
              duration: segment.end - segment.start,
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
            duration: parseFloat(item.duration),
            text: item.text
          }))
        };
      }
    } catch (error) {
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

    const response = await openai.chat.completions.create({
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
  try {
    const analysisStartTime = new Date().toISOString();
    console.log('API server: /api/upload-youtube called at', analysisStartTime);
    const { url, language = 'original', model = 'gpt-4o-mini' } = req.body;
    
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

    // Process transcript
    let transcript = '';
    let timestampedSegments: TimestampedSegment[] = [];
    let method: 'subtitle' | 'whisper' = 'subtitle';
    let detectedLanguage = language;

    // Try subtitle first
    console.log('Attempting subtitle extraction...');
    const subtitleResult = await getYouTubeSubtitles(videoId, language);
    
    if (subtitleResult) {
      transcript = subtitleResult.text;
      timestampedSegments = subtitleResult.timestampedSegments;
      detectedLanguage = subtitleResult.detectedLanguage;
      method = 'subtitle';
      console.log('Subtitle extraction successful');
    } else {
      console.log('Subtitle extraction failed, trying Whisper...');
      try {
        // Download audio and transcribe
        const audioPath = path.join('uploads', `${Date.now()}_audio.mp3`);
        await downloadYouTubeAudio(url, audioPath);
        
        const transcriptionResult = await transcribeAudio(audioPath, language);
        transcript = transcriptionResult.text;
        timestampedSegments = transcriptionResult.timestampedSegments;
        method = 'whisper';
        console.log('Whisper transcription successful');
        
        // Clean up audio file
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
      } catch (whisperError) {
        console.error('Whisper transcription failed:', whisperError);
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

    // Generate summary
    let summaryResult = null;
    try {
      console.log('Generating summary...');
      summaryResult = await generateSummary(transcript, metadata, model, timestampedSegments);
      console.log('Summary generation successful');
    } catch (summaryError) {
      console.warn('Summary generation failed:', summaryError);
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

    // Calculate analysis time
    const analysisEndTime = new Date().toISOString();
    const analysisDuration = Math.round((new Date(analysisEndTime).getTime() - new Date(analysisStartTime).getTime()) / 1000);
    const analysisTimeInfo = {
      startTime: analysisStartTime,
      endTime: analysisEndTime,
      duration: analysisDuration
    };

    console.log('=== ANALYSIS TIME INFO ===');
    console.log('Start time:', analysisStartTime);
    console.log('End time:', analysisEndTime);
    console.log('Duration:', analysisDuration, 'seconds');
    console.log('==========================');

    // Add to history
    const historyEntry = addToHistory(
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

  } catch (error) {
    console.error('Error in /api/upload-youtube:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/upload-youtube', async (req: Request, res: Response) => {
  try {
    console.log('TypeScript server: /upload-youtube called');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { url, language = 'original', gptModel = 'gpt-4o-mini', mainTags = [], tags = '', forceRegenerate = false } = req.body;
    
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
        if (existingEntry.summary?.cost) {
          sessionCosts.gpt += existingEntry.summary.cost;
        }
        
        console.log('Restored from history:');
        console.log('- currentTranscript length:', currentTranscript.length);
        console.log('- currentMetadata title:', currentMetadata?.basic.title);
        console.log('- has currentArticle:', !!currentArticle);
        console.log('- Added to session costs:', totalCost);
        
        // Build detailed cost information from history entry
        let transcriptionCost = 0;
        let summaryCost = 0;
        let articleCost = 0;
        
        // 文字起こしコストを計算
        if (existingEntry.method === 'whisper' && existingEntry.metadata?.basic?.duration) {
          const durationMinutes = Math.ceil(existingEntry.metadata.basic.duration / 60);
          transcriptionCost = durationMinutes * pricing.whisper;
        }
        
        // 要約コストを取得
        if (existingEntry.summary?.cost) {
          summaryCost = existingEntry.summary.cost;
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
        console.log('Summary cost from summary.cost:', existingEntry.summary?.cost || 'N/A');
        console.log('Summary cost from entry.cost:', existingEntry.cost || 'N/A');
        console.log('Summary cost used:', summaryCost);
        console.log('Article cost:', articleCost);
        console.log('Total cost:', detailedCosts.total);
        console.log('Original history cost:', existingEntry.cost);
        console.log('Summary from history:', existingEntry.summary ? 'Present' : 'Missing');
        console.log('Summary cost logic used:', existingEntry.summary?.cost ? 'summary.cost' : (existingEntry.method === 'whisper' && existingEntry.cost ? 'entry.cost fallback' : 'no cost'));
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
          summary: existingEntry.summary?.content,
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

      const transcriptionResult = await transcribeAudio(audioPath, language);
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
    const entry = addToHistory(
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
    
    const response = await openai.chat.completions.create({
      model: gptModel,
      messages: messages as any,
      max_tokens: 2000,
      temperature: 0.7
    });

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
        history[entryIndex].summary = summary;
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
  // Convert the server format to frontend format
  const frontendPrompts = {};
  Object.keys(prompts).forEach(key => {
    frontendPrompts[key] = prompts[key]?.template || '';
  });
  res.json(frontendPrompts);
});

app.post('/api/prompts', (req: Request, res: Response) => {
  try {
    const newPrompts = req.body;
    const prompts = loadPrompts();
    
    Object.keys(newPrompts).forEach(key => {
      if (newPrompts[key] && newPrompts[key].trim() !== '') {
        prompts[key] = {
          name: key,
          template: newPrompts[key]
        };
      } else {
        delete prompts[key];
      }
    });
    
    const promptsFile = 'prompts.json';
    fs.writeFileSync(promptsFile, JSON.stringify(prompts, null, 2));
    
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
  try {
    const { transcript, gptModel = 'gpt-4o-mini' } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    // Generate summary
    const summary = await generateSummary(transcript, null, gptModel, []);
    
    if (!summary) {
      return res.status(500).json({ error: 'Failed to generate summary' });
    }

    res.json({
      success: true,
      summary: summary.content,
      cost: summary.cost || 0
    });

  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
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
    
    const completion = await openai.chat.completions.create({
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false,
      error: `Failed to generate article: ${errorMessage}` 
    });
  }
});

// Reset session costs endpoint
app.post('/reset-session-costs', (_req: Request, res: Response) => {
  sessionCosts = {
    whisper: 0,
    gpt: 0,
    total: 0
  };
  console.log('Session costs reset');
  res.json({ success: true, message: 'Session costs reset', costs: sessionCosts });
});

// Server startup
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Reset session costs on server startup
  sessionCosts = {
    whisper: 0,
    gpt: 0,
    total: 0
  };
  console.log('Session costs initialized to zero');
});