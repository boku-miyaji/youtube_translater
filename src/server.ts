import 'dotenv/config';
import express, { Request, Response } from 'express';
import multer from 'multer';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import OpenAI from 'openai';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { YoutubeTranscript } from 'youtube-transcript-api';
import {
  VideoMetadata,
  HistoryEntry,
  SessionCosts,
  Pricing,
  CostEntry,
  ArticleTemplate,
  ArticleHistoryEntry,
  TimestampedSegment,
  Summary,
  ChatRequest,
  ChatResponse,
  UploadYouTubeRequest,
  UploadResponse,
  SaveArticleRequest,
  LoadFromHistoryRequest,
  RegenerateSummaryRequest,
  PromptsConfig,
  TranscriptionResult,
  SubtitlesResult
} from './types/index';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const upload = multer({ dest: 'uploads/' });

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
let currentSummary: Summary | null = null;
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
const templatesFile = path.join('history', 'article_templates.json');

function loadHistory(): HistoryEntry[] {
  if (fs.existsSync(historyFile)) {
    try {
      return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
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

function loadTemplates(): ArticleTemplate[] {
  if (fs.existsSync(templatesFile)) {
    try {
      return JSON.parse(fs.readFileSync(templatesFile, 'utf8'));
    } catch (error) {
      console.error('Error loading templates:', error);
      return [];
    }
  }
  return [];
}

function saveTemplates(templates: ArticleTemplate[]): void {
  try {
    fs.writeFileSync(templatesFile, JSON.stringify(templates, null, 2));
  } catch (error) {
    console.error('Error saving templates:', error);
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
  article: string | null = null
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
    timestamp: new Date().toISOString()
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
    const info = await ytdl.getInfo(url);
    const videoDetails = info.videoDetails;
    const formats = info.formats;
    
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
    
    return {
      basic: {
        title: videoDetails.title,
        videoId: videoDetails.videoId,
        duration: parseInt(videoDetails.lengthSeconds),
        channel: videoDetails.author.name,
        viewCount: parseInt(videoDetails.viewCount || '0'),
        likes: parseInt(String(videoDetails.likes || '0')),
        uploadDate: videoDetails.uploadDate,
        publishDate: videoDetails.publishDate,
        category: videoDetails.category,
        description: videoDetails.description
      },
      chapters: chapters,
      captions: captions.map((cap: any) => ({
        language: cap.languageCode,
        name: cap.name.simpleText
      })),
      stats: {
        formatCount: formats.length,
        hasSubtitles: captions.length > 0,
        keywords: videoDetails.keywords || []
      }
    };
  } catch (error) {
    console.error('Metadata retrieval error:', error);
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
      promptTemplate = `あなたは動画コンテンツの分析専門家です。以下のYouTube動画の文字起こしを分析し、構造化された要約を生成してください。

動画情報:
-- タイトル: {{title}}
-- 長さ: {{duration}}
-- チャンネル: {{channel}}

{{timestampNote}}

要約の形式:
1. **📋 動画概要** (2-3文で動画の目的と内容を要約)
2. **🎯 主要ポイント** (重要な内容を3-5個の箇条書きで。{{timestampInstruction}})
3. **💡 詳細解説** (各ポイントの詳しい説明。{{timestampInstruction}})
4. **🔑 キーワード・用語** (重要な専門用語や概念を説明)
5. **📈 実践的価値** (視聴者が実際に活用できる内容)

注意事項:
- 情報は正確で簡潔に
- 専門用語は分かりやすく説明
- 実用性を重視
- タイムスタンプがある場合は必ず含める

{{transcriptContent}}`;
    }
    
    // Template variable replacement
    const title = metadata?.basic?.title || '不明';
    const duration = metadata?.basic?.duration ? Math.floor(metadata.basic.duration/60) + '分' + (metadata.basic.duration%60) + '秒' : '不明';
    const channel = metadata?.basic?.channel || '不明';
    
    const timestampNote = hasTimestamps ? 
      `⚠️ 重要: タイムスタンプ情報が利用可能です。要約の各セクションで言及する内容には、該当する時間帯を [開始時間-終了時間] の形式で必ず含めてください。
例: "プロジェクトの概要について説明されています [2:15-4:30]"

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

// API Endpoints

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
        currentSummary = existingEntry.summary;
        currentTimestampedSegments = existingEntry.timestampedSegments || [];
        currentArticle = existingEntry.article;
        return res.json({
          success: true,
          title: existingEntry.title,
          transcript: existingEntry.transcript,
          summary: existingEntry.summary?.content,
          metadata: existingEntry.metadata || {} as VideoMetadata,
          method: existingEntry.method,
          language: existingEntry.language,
          gptModel: existingEntry.gptModel,
          timestampedSegments: existingEntry.timestampedSegments || [],
          cost: existingEntry.cost,
          message: 'Retrieved from history',
          fromHistory: true,
          costs: sessionCosts
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
    currentTimestampedSegments = timestampedSegments;

    // Generate summary
    console.log('Generating summary...');
    const summary = await generateSummary(formattedTranscript, metadata, gptModel, timestampedSegments);
    currentSummary = summary;

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

app.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, gptModel = 'gpt-4o-mini' } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false,
        response: 'Message is required',
        model: gptModel,
        cost: 0,
        costs: sessionCosts,
        tokens: { input: 0, output: 0 }
      });
    }

    if (!currentTranscript) {
      return res.status(400).json({ 
        success: false,
        response: 'No transcript available. Please upload a YouTube video first.',
        model: gptModel,
        cost: 0,
        costs: sessionCosts,
        tokens: { input: 0, output: 0 }
      });
    }

    // Analyze if article context is needed
    const needsArticleContext = await analyzeNeedForArticleContext(message);
    
    // Prepare system message
    let systemContent = `以下はYouTube動画の文字起こしです。この内容に基づいて質問に答えてください。\n\n${currentTranscript}`;
    
    // Add article context if needed and available
    if (needsArticleContext && currentArticle) {
      systemContent += `\n\n以下は既存の解説記事です:\n\n${currentArticle}`;
    }

    const response = await openai.chat.completions.create({
      model: gptModel,
      messages: [
        {
          role: 'system',
          content: systemContent
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    });

    // Calculate cost
    const inputTokens = Math.ceil(systemContent.length / 4) + Math.ceil(message.length / 4);
    const outputTokens = Math.ceil((response.choices[0].message.content || '').length / 4);
    const modelPricing = pricing.models[gptModel];
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
    console.error('Error in chat:', error);
    res.status(500).json({ 
      success: false,
      response: 'Failed to process chat message',
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

app.get('/costs', (req: Request, res: Response) => {
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
    currentSummary = entry.summary;
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
    const { url, language = 'original', gptModel = 'gpt-4o-mini' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!currentTranscript) {
      return res.status(400).json({ error: 'No transcript available' });
    }

    // Generate new summary
    const summary = await generateSummary(currentTranscript, currentMetadata, gptModel, currentTimestampedSegments);
    currentSummary = summary;

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

// Template management endpoints
app.get('/templates', (req: Request, res: Response) => {
  const templates = loadTemplates();
  res.json(templates);
});

app.post('/templates', (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const templates = loadTemplates();
    const template: ArticleTemplate = {
      id: `template_${Date.now()}`,
      content: content,
      createdAt: new Date().toISOString(),
      structure: {
        hasTitle: content.includes('#'),
        hasIntroduction: content.includes('## はじめに') || content.includes('## Introduction'),
        headingLevels: [],
        hasCodeBlocks: content.includes('```'),
        hasLists: content.includes('- ') || content.includes('* ') || content.includes('1. '),
        hasConclusion: content.includes('## まとめ') || content.includes('## Conclusion'),
        pattern: 'auto-detected'
      }
    };
    
    templates.unshift(template);
    
    // Keep only the latest 100 templates
    if (templates.length > 100) {
      templates.splice(100);
    }
    
    saveTemplates(templates);
    
    res.json({
      success: true,
      template: template
    });
    
  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

// Prompts configuration endpoints
app.get('/prompts', (req: Request, res: Response) => {
  const prompts = loadPrompts();
  res.json(prompts);
});

app.post('/prompts/save', (req: Request, res: Response) => {
  try {
    const { type, template } = req.body;
    
    if (!type || !template) {
      return res.status(400).json({ error: 'Type and template are required' });
    }
    
    const prompts = loadPrompts();
    prompts[type] = {
      name: type,
      template: template
    };
    
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

// Server startup
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});