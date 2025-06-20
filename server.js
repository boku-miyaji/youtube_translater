require('dotenv').config();
const express = require('express');
const multer = require('multer');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const OpenAI = require('openai');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { YoutubeTranscript } = require('youtube-transcript-api');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
let currentMetadata = null;
let currentSummary = null;
let currentTimestampedSegments = [];
let currentArticle = null;
let sessionCosts = {
  whisper: 0,
  gpt: 0,
  total: 0
};

// 料金設定（2024年12月時点の最新公式価格）
const pricing = {
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

function loadHistory() {
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

function saveHistory(history) {
  try {
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Error saving history:', error);
  }
}

function loadCosts() {
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

function saveCosts(costs) {
  try {
    fs.writeFileSync(costsFile, JSON.stringify(costs, null, 2));
  } catch (error) {
    console.error('Error saving costs:', error);
  }
}

function loadTemplates() {
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

function saveTemplates(templates) {
  try {
    fs.writeFileSync(templatesFile, JSON.stringify(templates, null, 2));
  } catch (error) {
    console.error('Error saving templates:', error);
  }
}

function addCostEntry(videoId, title, method, language, gptModel, whisperCost, gptCost, totalCost) {
  const costs = loadCosts();
  const entry = {
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

function addToHistory(videoId, title, url, transcript, method, cost = 0, metadata = null, summary = null, language = 'original', gptModel = 'gpt-4o-mini', timestampedSegments = [], tags = [], mainTags = [], article = null) {
  const history = loadHistory();
  const entry = {
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

// YouTubeメタデータ分析機能
async function getYouTubeMetadata(url) {
  try {
    const info = await ytdl.getInfo(url);
    const videoDetails = info.videoDetails;
    const formats = info.formats;
    
    // チャプター情報の抽出
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
    
    // 字幕情報
    const captions = info.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    
    return {
      basic: {
        title: videoDetails.title,
        videoId: videoDetails.videoId,
        duration: parseInt(videoDetails.lengthSeconds),
        channel: videoDetails.author.name,
        viewCount: parseInt(videoDetails.viewCount || 0),
        likes: parseInt(videoDetails.likes || 0),
        uploadDate: videoDetails.uploadDate,
        publishDate: videoDetails.publishDate,
        category: videoDetails.category,
        description: videoDetails.description
      },
      chapters: chapters,
      captions: captions.map(cap => ({
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
    console.error('メタデータ取得エラー:', error);
    return null;
  }
}

// 時間フォーマット関数（秒を mm:ss 形式に変換）
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 文字起こし結果の整形（タイムスタンプなし）
function formatTranscript(transcript) {
  if (!transcript) return '';
  
  // より詳細な整形処理
  let formatted = transcript
    // 連続する空白を単一の空白に
    .replace(/\s+/g, ' ')
    .trim();
  
  // 日本語の句読点で改行
  formatted = formatted
    .replace(/([。！？])/g, '$1\n\n')
    .replace(/([、])/g, '$1 ');
  
  // 英語の文末で改行
  formatted = formatted
    .replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2');
  
  // 長い文を適度に分割（100文字程度）
  formatted = formatted
    .replace(/(.{100,}?)([。！？、,.])/g, '$1$2\n');
  
  // 特定のパターンで改行を追加
  formatted = formatted
    // 「です」「ます」「だ」「である」の後に改行
    .replace(/(です|ます|だ|である)([。]?)\s*([あ-ん])/g, '$1$2\n\n$3')
    // 「そして」「しかし」「ところで」「また」などの接続詞の前に改行
    .replace(/([。])\s*(そして|しかし|ところで|また|さらに|一方|つまり|なお|ちなみに)/g, '$1\n\n$2')
    // 質問文の後に改行
    .replace(/([？])\s*([あ-んア-ン])/g, '$1\n\n$2');
  
  // 複数の改行を統一
  formatted = formatted
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n\s+\n/g, '\n\n');
  
  // 行頭の空白を削除
  formatted = formatted
    .split('\n')
    .map(line => line.trim())
    .join('\n');
  
  // 空行を削除しつつ、段落間の空行は保持
  formatted = formatted
    .replace(/\n\n+/g, '\n\n')
    .trim();
  
  return formatted;
}

// タイムスタンプ付き文字起こしの整形
function formatTimestampedTranscript(timestampedSegments) {
  if (!timestampedSegments || timestampedSegments.length === 0) return '';
  
  return timestampedSegments.map(segment => {
    const startTime = formatTime(segment.start);
    const text = segment.text.trim();
    return `<div class="timestamp-segment" data-start="${segment.start}"><div class="timestamp-row"><span class="timestamp-time" onclick="seekToTime(${segment.start})">${startTime}</span><span class="timestamp-text">${text}</span></div></div>`;
  }).join('');
}

// 要約生成機能
async function generateSummary(transcript, metadata, gptModel = 'gpt-4o-mini', timestampedSegments = []) {
  try {
    // タイムスタンプ情報があれば、時間的な根拠を含めた要約を生成
    const hasTimestamps = timestampedSegments && timestampedSegments.length > 0;
    
    // プロンプトファイルから読み込み
    const prompts = loadPrompts();
    let promptTemplate = '';
    
    if (prompts && prompts.summary && prompts.summary.template) {
      promptTemplate = prompts.summary.template;
    } else {
      // デフォルトプロンプト（既存のまま）
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
    
    // テンプレート変数を置換
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
    const outputTokens = Math.ceil(response.choices[0].message.content.length / 4);
    const modelPricing = pricing.models[gptModel];
    const summaryCost = (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);
    
    sessionCosts.gpt += summaryCost;
    sessionCosts.total += summaryCost;

    return {
      content: response.choices[0].message.content,
      model: gptModel,
      cost: summaryCost,
      tokens: { input: inputTokens, output: outputTokens }
    };

  } catch (error) {
    console.error('要約生成エラー:', error);
    return null;
  }
}

async function downloadYouTubeAudio(url, outputPath) {
  return new Promise((resolve, reject) => {
    const stream = ytdl(url, { quality: 'highestaudio' });
    
    ffmpeg(stream)
      .audioCodec('libmp3lame')
      .audioBitrate(64)
      .audioChannels(1)
      .audioFrequency(16000)
      .toFormat('mp3')
      .on('error', (err) => {
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

async function transcribeAudio(audioPath, language = 'original') {
  const stats = fs.statSync(audioPath);
  const fileSizeInBytes = stats.size;
  const maxSize = 25 * 1024 * 1024; // 25MB
  
  if (fileSizeInBytes > maxSize) {
    // ファイルが大きすぎる場合は分割処理
    return await transcribeLargeAudio(audioPath, language);
  }
  
  const audioFile = fs.createReadStream(audioPath);
  
  const transcriptionParams = {
    file: audioFile,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment']
  };
  
  // 言語設定を追加
  if (language !== 'original') {
    transcriptionParams.language = language;
  }
  
  const transcription = await openai.audio.transcriptions.create(transcriptionParams);
  
  return {
    text: transcription.text,
    timestampedSegments: transcription.segments ? transcription.segments.map(segment => ({
      start: segment.start,
      duration: segment.end - segment.start,
      text: segment.text
    })) : []
  };
}

async function transcribeLargeAudio(audioPath, language = 'original') {
  const segmentDuration = 600; // 10分ごとに分割
  const segmentPaths = [];
  
  return new Promise((resolve, reject) => {
    // まず音声の長さを取得
    ffmpeg.ffprobe(audioPath, async (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const duration = metadata.format.duration;
      const segments = Math.ceil(duration / segmentDuration);
      const transcripts = [];
      
      try {
        // 各セグメントを処理
        for (let i = 0; i < segments; i++) {
          const startTime = i * segmentDuration;
          const segmentPath = audioPath.replace('.mp3', `_segment_${i}.mp3`);
          segmentPaths.push(segmentPath);
          
          await new Promise((segResolve, segReject) => {
            ffmpeg(audioPath)
              .seekInput(startTime)
              .duration(segmentDuration)
              .on('error', segReject)
              .on('end', segResolve)
              .save(segmentPath);
          });
          
          // セグメントを文字起こし
          const audioFile = fs.createReadStream(segmentPath);
          
          const transcriptionParams = {
            file: audioFile,
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['segment']
          };
          
          // 言語設定を追加
          if (language !== 'original') {
            transcriptionParams.language = language;
          }
          
          const transcription = await openai.audio.transcriptions.create(transcriptionParams);
          
          transcripts.push({
            text: transcription.text,
            segments: transcription.segments || [],
            offset: startTime
          });
        }
        
        // セグメントファイルを削除
        segmentPaths.forEach(path => {
          if (fs.existsSync(path)) {
            fs.unlinkSync(path);
          }
        });
        
        // セグメントを統合してタイムスタンプ情報も含める
        const allSegments = [];
        let combinedText = '';
        
        transcripts.forEach(transcriptResult => {
          combinedText += (combinedText ? ' ' : '') + transcriptResult.text;
          transcriptResult.segments.forEach(segment => {
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
        // セグメントファイルを削除
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

async function getYouTubeSubtitles(videoId, preferredLanguage = 'original') {
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

function getLanguageOrder(preferredLanguage) {
  switch (preferredLanguage) {
    case 'ja':
      return ['ja', 'en'];
    case 'en':
      return ['en', 'ja'];
    case 'original':
    default:
      // originalの場合は利用可能な字幕を優先順位で試行
      return ['ja', 'en', 'ko', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'ru'];
  }
}

function extractVideoId(url) {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function calculateAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
}

app.post('/upload-youtube', async (req, res) => {
  try {
    const { url, language = 'original', gptModel = 'gpt-4o-mini', mainTags = [], tags = '', forceRegenerate = false } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Could not extract video ID from URL' });
    }

    // 履歴から既存の文字起こしをチェック（forceRegenerateがfalseの場合のみ）
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
        return res.json({
          success: true,
          title: existingEntry.title,
          transcript: existingEntry.transcript,
          summary: existingEntry.summary?.content,
          metadata: existingEntry.metadata,
          method: existingEntry.method,
          language: existingEntry.language,
          gptModel: existingEntry.gptModel,
          timestampedSegments: existingEntry.timestampedSegments || [],
          message: 'Retrieved from history',
          fromHistory: true,
          costs: sessionCosts
        });
      }
    }

    const videoInfo = await ytdl.getInfo(url);
    const videoTitle = videoInfo.videoDetails.title;

    // メタデータを取得
    console.log('Getting video metadata...');
    const metadata = await getYouTubeMetadata(url);
    currentMetadata = metadata;

    // まずYouTubeの字幕を試す
    console.log(`Checking for YouTube subtitles (preferred language: ${language})...`);
    const subtitlesResult = await getYouTubeSubtitles(videoId, language);
    
    let transcript;
    let method;
    let cost = 0;
    let detectedLanguage = language;
    let timestampedSegments = [];

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
      
      // 音声の長さを計算してコストを算出
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

    // 文字起こし結果を整形
    const formattedTranscript = formatTranscript(transcript);
    currentTranscript = formattedTranscript;
    currentTimestampedSegments = timestampedSegments;

    // 要約を生成
    console.log(`Generating summary using ${gptModel}...`);
    const summary = await generateSummary(formattedTranscript, metadata, gptModel, timestampedSegments);
    currentSummary = summary;

    // タグを処理
    const processedTags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    
    // 履歴に保存
    addToHistory(videoId, videoTitle, url, formattedTranscript, method, cost, metadata, summary, language, gptModel, timestampedSegments, processedTags, mainTags, null);
    
    // コスト履歴に保存
    const totalCostForVideo = cost + (summary ? summary.cost : 0);
    addCostEntry(videoId, videoTitle, method, language, gptModel, cost, summary ? summary.cost : 0, totalCostForVideo);

    // ファイルにも保存
    const transcriptPath = path.join('transcripts', `${Date.now()}_${videoId}_${language}_${gptModel}_transcript.txt`);
    fs.writeFileSync(transcriptPath, formattedTranscript);

    res.json({
      success: true,
      title: videoTitle,
      transcript: formattedTranscript,
      summary: summary?.content,
      metadata: metadata,
      method: method,
      language: language,
      gptModel: gptModel,
      detectedLanguage: detectedLanguage,
      timestampedSegments: timestampedSegments,
      cost: cost,
      message: `Video transcribed successfully using ${method} (${detectedLanguage})`,
      costs: sessionCosts
    });

  } catch (error) {
    console.error('Error processing YouTube video:', error);
    res.status(500).json({ error: 'Failed to process YouTube video' });
  }
});

// 要約のみ再生成API
app.post('/regenerate-summary', async (req, res) => {
  try {
    const { url, language = 'original', gptModel = 'gpt-4o-mini' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Could not extract video ID from URL' });
    }

    // 履歴から既存の文字起こしを取得
    const history = loadHistory();
    const existingEntry = history.find(item => 
      item.id === videoId && 
      item.language === language
    );
    
    if (!existingEntry || !existingEntry.transcript) {
      return res.status(400).json({ error: 'No existing transcript found. Please run full transcription first.' });
    }

    // 既存の文字起こしとメタデータを使用
    currentTranscript = existingEntry.transcript;
    currentMetadata = existingEntry.metadata;
    currentTimestampedSegments = existingEntry.timestampedSegments || [];

    // 新しい要約を生成
    console.log(`Regenerating summary using ${gptModel}...`);
    const summary = await generateSummary(currentTranscript, currentMetadata, gptModel, currentTimestampedSegments);
    currentSummary = summary;

    // 履歴を更新（新しい要約で）
    const updatedEntry = { ...existingEntry };
    updatedEntry.summary = summary;
    updatedEntry.gptModel = gptModel;
    updatedEntry.timestamp = new Date().toISOString();
    
    const existingIndex = history.findIndex(item => item.id === videoId);
    if (existingIndex >= 0) {
      history[existingIndex] = updatedEntry;
    }
    saveHistory(history);

    // コスト履歴に保存
    const totalCostForVideo = summary ? summary.cost : 0;
    addCostEntry(videoId, existingEntry.title, existingEntry.method, language, gptModel, 0, summary ? summary.cost : 0, totalCostForVideo);

    // セッションコストを更新
    if (summary && summary.cost) {
      sessionCosts.gpt += summary.cost;
      sessionCosts.total += summary.cost;
    }

    res.json({
      success: true,
      title: existingEntry.title,
      summary: summary?.content,
      metadata: currentMetadata,
      timestampedSegments: currentTimestampedSegments,
      message: 'Summary regenerated successfully',
      costs: sessionCosts
    });

  } catch (error) {
    console.error('Error regenerating summary:', error);
    res.status(500).json({ error: 'Failed to regenerate summary' });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { message, gptModel = 'gpt-4o-mini' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!currentTranscript) {
      return res.status(400).json({ error: 'No transcript available. Please upload a YouTube video first.' });
    }

    // タイムスタンプ情報があるかチェック
    const hasTimestamps = currentTimestampedSegments && currentTimestampedSegments.length > 0;

    // AIアシスタント向けのコンテキストを提供
    let contextInfo = `あなたは親切なAIアシスタントです。以下のYouTube動画の内容について、ユーザーの質問や要求に答えてください。

重要な回答ルール:
- **Markdown形式**で回答してください（見出し、箇条書き、太字、斜体、コードブロックなど適切に使用）
- 動画の特定時間を言及する際は、[mm:ss]または[h:mm:ss]の形式で必ず表記してください
- 回答は構造化して読みやすくしてください
- 長い回答の場合は見出しで区切ってください

特別な機能:
- 動画内容についての質問回答
- 解説記事の修正・改善提案  
- 要約の詳細説明
- その他の関連する質問にも対応

\n\n`;
    
    if (currentMetadata) {
      contextInfo += `動画情報:\n`;
      contextInfo += `- タイトル: ${currentMetadata.basic.title}\n`;
      contextInfo += `- チャンネル: ${currentMetadata.basic.channel}\n`;
      contextInfo += `- 長さ: ${Math.floor(currentMetadata.basic.duration/60)}分${currentMetadata.basic.duration%60}秒\n`;
      if (currentMetadata.chapters.length > 0) {
        contextInfo += `- チャプター: ${currentMetadata.chapters.map(c => `${c.timestamp} ${c.title}`).join(', ')}\n`;
      }
      contextInfo += `\n`;
    }
    
    if (currentSummary) {
      contextInfo += `動画要約:\n${currentSummary.content}\n\n`;
    }
    
    if (currentArticle) {
      contextInfo += `解説記事（Markdown形式）:\n${currentArticle}\n\n`;
    }
    
    if (hasTimestamps) {
      contextInfo += `⚠️ 重要指示: 回答の際は、言及する内容の該当時間を [mm:ss] の形式で必ず含めてください。\n`;
      contextInfo += `例: \"その説明は [3:45] で詳しく述べられています\"\n\n`;
      contextInfo += `タイムスタンプ付き文字起こし:\n`;
      contextInfo += currentTimestampedSegments.map(segment => {
        const startTime = formatTime(segment.start);
        return `[${startTime}] ${segment.text}`;
      }).join('\n');
    } else {
      contextInfo += `文字起こし内容:\n${currentTranscript}`;
    }
    
    const inputTokens = Math.ceil((contextInfo.length + message.length) / 4); // 概算
    
    const maxTokens = gptModel === 'gpt-3.5-turbo' ? 1000 : 1500;
    
    const response = await openai.chat.completions.create({
      model: gptModel,
      messages: [
        {
          role: 'system',
          content: contextInfo
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.7
    });

    const outputTokens = Math.ceil((response.choices[0].message.content.length) / 4); // 概算
    const modelPricing = pricing.models[gptModel];
    const chatCost = (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);
    
    sessionCosts.gpt += chatCost;
    sessionCosts.total += chatCost;

    res.json({
      success: true,
      response: response.choices[0].message.content,
      model: gptModel,
      cost: chatCost,
      costs: sessionCosts,
      tokens: {
        input: inputTokens,
        output: outputTokens
      }
    });

  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

app.get('/transcript', (_, res) => {
  res.json({
    transcript: currentTranscript || 'No transcript available',
    timestampedTranscript: currentTimestampedSegments.length > 0 ? 
      formatTimestampedTranscript(currentTimestampedSegments) : null,
    hasTimestamps: currentTimestampedSegments.length > 0
  });
});

app.get('/history', (_, res) => {
  const history = loadHistory();
  res.json({
    success: true,
    history: history
  });
});

app.get('/costs', (_, res) => {
  res.json({
    success: true,
    costs: sessionCosts
  });
});

app.get('/costs-analysis', (req, res) => {
  try {
    const { period = 'total', videoId = null } = req.query;
    const costs = loadCosts();
    
    let filteredCosts = costs;
    
    // 動画IDでフィルタ
    if (videoId) {
      filteredCosts = costs.filter(cost => cost.videoId === videoId);
    }
    
    // 期間でフィルタ
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (period !== 'total') {
      filteredCosts = costs.filter(cost => {
        const costDate = new Date(cost.timestamp);
        switch (period) {
          case 'today':
            return cost.date === today;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return costDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            return costDate >= monthAgo;
          default:
            return true;
        }
      });
    }
    
    // 集計
    const summary = {
      totalWhisper: filteredCosts.reduce((sum, cost) => sum + cost.whisperCost, 0),
      totalGpt: filteredCosts.reduce((sum, cost) => sum + cost.gptCost, 0),
      totalCost: filteredCosts.reduce((sum, cost) => sum + cost.totalCost, 0),
      videoCount: filteredCosts.length,
      byMethod: {},
      byModel: {},
      byDate: {}
    };
    
    // 方法別集計
    filteredCosts.forEach(cost => {
      if (!summary.byMethod[cost.method]) {
        summary.byMethod[cost.method] = { count: 0, cost: 0 };
      }
      summary.byMethod[cost.method].count++;
      summary.byMethod[cost.method].cost += cost.totalCost;
    });
    
    // モデル別集計
    filteredCosts.forEach(cost => {
      if (!summary.byModel[cost.gptModel]) {
        summary.byModel[cost.gptModel] = { count: 0, cost: 0 };
      }
      summary.byModel[cost.gptModel].count++;
      summary.byModel[cost.gptModel].cost += cost.totalCost;
    });
    
    // 日別集計（過去30日）
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const dayCosts = filteredCosts.filter(cost => cost.date === dateStr);
      summary.byDate[dateStr] = {
        count: dayCosts.length,
        cost: dayCosts.reduce((sum, cost) => sum + cost.totalCost, 0)
      };
    }
    
    // セッション料金をマージ（本日の場合のみ）
    let sessionCostsData = null;
    if (period === 'today') {
      summary.totalWhisper += sessionCosts.whisper;
      summary.totalGpt += sessionCosts.gpt;
      summary.totalCost += sessionCosts.total;
      sessionCostsData = sessionCosts;
    }
    
    res.json({
      success: true,
      period,
      videoId,
      summary,
      sessionCosts: sessionCostsData,
      details: filteredCosts.slice(0, 100) // 最新100件
    });
    
  } catch (error) {
    console.error('Error analyzing costs:', error);
    res.status(500).json({ error: 'Failed to analyze costs' });
  }
});

app.post('/load-from-history', (req, res) => {
  try {
    const { videoId } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const history = loadHistory();
    const entry = history.find(item => item.id === videoId);
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found in history' });
    }

    currentTranscript = entry.transcript;
    currentMetadata = entry.metadata;
    currentSummary = entry.summary;
    currentTimestampedSegments = entry.timestampedSegments || [];
    currentArticle = entry.article || null;
    
    res.json({
      success: true,
      title: entry.title,
      transcript: entry.transcript,
      summary: entry.summary?.content,
      metadata: entry.metadata,
      method: entry.method,
      cost: entry.cost,
      timestamp: entry.timestamp,
      timestampedSegments: entry.timestampedSegments || [],
      article: entry.article || null,
      message: 'Loaded from history'
    });

  } catch (error) {
    console.error('Error loading from history:', error);
    res.status(500).json({ error: 'Failed to load from history' });
  }
});

// 記事取得API
app.get('/article/:videoId', (req, res) => {
  try {
    const { videoId } = req.params;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const history = loadHistory();
    const entry = history.find(item => item.id === videoId);
    
    if (!entry) {
      return res.status(404).json({ 
        success: false, 
        error: 'Entry not found in history',
        hasArticle: false,
        article: null
      });
    }

    if (!entry.article) {
      return res.json({
        success: true,
        hasArticle: false,
        article: null,
        message: 'No article generated yet for this video'
      });
    }

    res.json({
      success: true,
      hasArticle: true,
      article: entry.article,
      title: entry.title,
      timestamp: entry.timestamp,
      message: 'Article retrieved from history'
    });

  } catch (error) {
    console.error('Error retrieving article:', error);
    res.status(500).json({ error: 'Failed to retrieve article' });
  }
});

// 現在の記事取得API（現在のセッション用）
app.get('/current-article', (req, res) => {
  res.json({
    success: true,
    hasArticle: !!currentArticle,
    article: currentArticle || null
  });
});

// テンプレート保存API
app.post('/save-article-template', (req, res) => {
  try {
    const { article } = req.body;
    
    if (!article) {
      return res.status(400).json({ error: 'Article content is required' });
    }

    const templates = loadTemplates();
    const newTemplate = {
      id: Date.now().toString(),
      content: article,
      createdAt: new Date().toISOString(),
      // 記事の構造を分析
      structure: analyzeArticleStructure(article)
    };

    templates.unshift(newTemplate);
    
    // 最新10件まで保持
    if (templates.length > 10) {
      templates.splice(10);
    }
    
    saveTemplates(templates);
    
    res.json({
      success: true,
      message: 'テンプレートを保存しました',
      templateId: newTemplate.id
    });

  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

// 記事構造の分析
function analyzeArticleStructure(article) {
  const lines = article.split('\n');
  const structure = {
    hasTitle: false,
    hasIntroduction: false,
    headingLevels: [],
    hasCodeBlocks: false,
    hasLists: false,
    hasConclusion: false,
    pattern: ''
  };

  let inCodeBlock = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // タイトル（# で始まる）
    if (trimmed.startsWith('#')) {
      const level = trimmed.match(/^#+/)[0].length;
      structure.headingLevels.push(level);
      if (level === 1) structure.hasTitle = true;
    }
    
    // コードブロック
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      structure.hasCodeBlocks = true;
    }
    
    // リスト
    if (trimmed.match(/^[-*+]\s/) || trimmed.match(/^\d+\.\s/)) {
      structure.hasLists = true;
    }
    
    // 導入部・まとめの検出
    if (trimmed.includes('はじめに') || trimmed.includes('導入') || trimmed.includes('概要')) {
      structure.hasIntroduction = true;
    }
    if (trimmed.includes('まとめ') || trimmed.includes('結論') || trimmed.includes('おわりに')) {
      structure.hasConclusion = true;
    }
  }

  // 構造パターンを生成
  structure.pattern = generateStructurePattern(structure);
  
  return structure;
}

function generateStructurePattern(structure) {
  let pattern = '';
  if (structure.hasTitle) pattern += 'title+';
  if (structure.hasIntroduction) pattern += 'intro+';
  pattern += 'h' + Math.max(...structure.headingLevels) + '+';
  if (structure.hasCodeBlocks) pattern += 'code+';
  if (structure.hasLists) pattern += 'list+';
  if (structure.hasConclusion) pattern += 'conclusion';
  return pattern;
}

// テンプレート情報取得API
app.get('/templates-info', (_, res) => {
  try {
    const templates = loadTemplates();
    res.json({
      success: true,
      templates: templates
    });
  } catch (error) {
    console.error('Error getting templates info:', error);
    res.status(500).json({ error: 'Failed to get templates info' });
  }
});

// 解説記事生成API
app.post('/generate-article', async (req, res) => {
  try {
    const { gptModel = 'gpt-4.1-mini' } = req.body;
    
    if (!currentTranscript) {
      return res.status(400).json({ error: 'No transcript available. Please upload a YouTube video first.' });
    }

    // タイムスタンプ情報があるかチェック
    const hasTimestamps = currentTimestampedSegments && currentTimestampedSegments.length > 0;
    
    let contextInfo = `以下はYouTube動画の文字起こしです。この内容に基づいて、技術系の解説記事を作成してください。\n\n`;
    
    if (currentMetadata) {
      contextInfo += `動画情報:\n`;
      contextInfo += `- タイトル: ${currentMetadata.basic.title}\n`;
      contextInfo += `- チャンネル: ${currentMetadata.basic.channel}\n`;
      contextInfo += `- 長さ: ${Math.floor(currentMetadata.basic.duration/60)}分${currentMetadata.basic.duration%60}秒\n`;
      if (currentMetadata.chapters.length > 0) {
        contextInfo += `- チャプター: ${currentMetadata.chapters.map(c => `${c.timestamp} ${c.title}`).join(', ')}\n`;
      }
      contextInfo += `\n`;
    }
    
    if (currentSummary) {
      contextInfo += `動画要約:\n${currentSummary.content}\n\n`;
    }
    
    if (hasTimestamps) {
      contextInfo += `タイムスタンプ付き文字起こし:\n`;
      contextInfo += currentTimestampedSegments.map(segment => {
        const startTime = formatTime(segment.start);
        return `[${startTime}] ${segment.text}`;
      }).join('\n');
    } else {
      contextInfo += `文字起こし内容:\n${currentTranscript}`;
    }

    // 保存されたテンプレートを読み込み
    const templates = loadTemplates();
    const templateExample = templates.length > 0 ? templates[0] : null;

    // プロンプトファイルから読み込み
    const prompts = loadPrompts();
    let promptTemplate = '';
    
    if (prompts && prompts.article && prompts.article.template) {
      promptTemplate = prompts.article.template;
    } else {
      // デフォルトプロンプト
      promptTemplate = `あなたは技術記事の専門ライターです。YouTube動画の内容をもとに、Zenn/Qiita向けの高品質な技術解説記事を作成してください。

{{templateNote}}

記事の構成要件:
1. **タイトル**: 読者の興味を引く、SEOを意識したタイトル
2. **導入部**: 記事の概要と読者が得られる価値を明確に
3. **本文**: 論理的で分かりやすい構成
4. **コード例**: 必要に応じて実装例やサンプルコードを含める
5. **まとめ**: 要点の再整理と次のアクションの提案

記事の品質要件:
-- 初心者にも理解しやすい説明
-- 実践的で再現可能な内容
-- 適切な見出し構造（H1→H2→H3）
-- コードブロックの適切な使用
-- 図表や画像の説明（必要に応じて）
-- SEOを意識したキーワード配置

出力形式:
Markdown形式で記事を作成し、以下の要素を含めてください：
- タイトル（H1）
- 導入部
- 目次（必要に応じて）
- 本文（適切な見出し構造）
- まとめ
- 参考リンク（元動画のURL含む）`;
    }
    
    // テンプレート情報を構築
    let templateNote = '';
    if (templateExample) {
      templateNote = `⚠️ 重要: 以下は過去に保存された良い記事のテンプレートです。この構造・フォーマット・文体を参考にして記事を作成してください。

## 参考テンプレート:
${templateExample.content.substring(0, 1500)}...

上記テンプレートの構造的特徴:
- 見出し構造: ${templateExample.structure.headingLevels.join('→')}レベル
- コードブロック: ${templateExample.structure.hasCodeBlocks ? 'あり' : 'なし'}
- リスト形式: ${templateExample.structure.hasLists ? 'あり' : 'なし'}
- 導入部: ${templateExample.structure.hasIntroduction ? 'あり' : 'なし'}
- まとめ: ${templateExample.structure.hasConclusion ? 'あり' : 'なし'}

このテンプレートの構造と文体に合わせて、今回の動画内容用の記事を作成してください。`;
    }
    
    const systemMessage = promptTemplate.replace(/\{\{templateNote\}\}/g, templateNote);

    const maxTokens = gptModel === 'gpt-3.5-turbo' ? 2000 : 3000;

    const response = await openai.chat.completions.create({
      model: gptModel,
      messages: [
        {
          role: 'system',
          content: systemMessage
        },
        {
          role: 'user',
          content: contextInfo
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.7
    });

    const inputTokens = Math.ceil((systemMessage.length + contextInfo.length) / 4);
    const outputTokens = Math.ceil(response.choices[0].message.content.length / 4);
    const modelPricing = pricing.models[gptModel];
    const articleCost = (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);
    
    sessionCosts.gpt += articleCost;
    sessionCosts.total += articleCost;

    // 生成された記事を保存
    currentArticle = response.choices[0].message.content;

    // 履歴に記事を保存（現在のビデオ情報がある場合）
    if (currentMetadata && currentMetadata.basic && currentMetadata.basic.videoId) {
      const history = loadHistory();
      const videoId = currentMetadata.basic.videoId;
      const existingIndex = history.findIndex(item => item.id === videoId);
      
      if (existingIndex >= 0) {
        // 既存エントリに記事を追加
        history[existingIndex].article = response.choices[0].message.content;
        history[existingIndex].timestamp = new Date().toISOString();
        saveHistory(history);
      }
      
      // 記事履歴にも保存
      addArticleToHistory(videoId, response.choices[0].message.content, 'generated');
    }

    res.json({
      success: true,
      article: response.choices[0].message.content,
      model: gptModel,
      cost: articleCost,
      costs: sessionCosts,
      tokens: {
        input: inputTokens,
        output: outputTokens
      }
    });

  } catch (error) {
    console.error('Error generating article:', error);
    res.status(500).json({ error: 'Failed to generate article' });
  }
});

// 深掘り質問提案API
app.get('/suggested-questions', (_, res) => {
  try {
    if (!currentSummary || !currentMetadata) {
      console.log('Debug: currentSummary or currentMetadata is null');
      console.log('currentSummary:', currentSummary ? 'exists' : 'null');
      console.log('currentMetadata:', currentMetadata ? 'exists' : 'null');
      
      // 一時的なフォールバック質問を返す
      const fallbackQuestions = [
        '動画の内容を詳しく説明してください',
        '重要なポイントを教えてください',
        'この動画から学べることは何ですか？',
        '実践的に活用できる内容はありますか？'
      ];
      
      return res.json({ 
        success: true,
        questions: fallbackQuestions
      });
    }

    // 要約から深掘り質問を抽出
    const summaryContent = currentSummary.content;
    console.log('Debug: Summary content preview:', summaryContent ? summaryContent.substring(0, 1000) + '...' : 'null');
    
    // より柔軟な正規表現で深掘り質問セクションを抽出
    const questionPatterns = [
      /6\.\s*\*\*💡\s*おすすめ深掘り質問\*\*\s*([\s\S]*?)(?=\n\n|$)/i,
      /\*\*💡\s*おすすめ深掘り質問\*\*\s*([\s\S]*?)(?=\n\n|$)/i,
      /💡\s*おすすめ深掘り質問[:\s]*([\s\S]*?)(?=\n\n|$)/i,
      /おすすめ深掘り質問[:\s]*([\s\S]*?)(?=\n\n|$)/i
    ];
    
    let suggestedQuestions = [];
    for (const pattern of questionPatterns) {
      const questionsMatch = summaryContent.match(pattern);
      if (questionsMatch) {
        console.log('Debug: Found questions match with pattern:', pattern);
        const questionsText = questionsMatch[1];
        console.log('Debug: Questions text:', questionsText);
        
        suggestedQuestions = questionsText
          .split(/\n/)
          .map(line => line.trim())
          .filter(line => {
            // より柔軟な質問の開始パターンを検出
            return line.startsWith('-') || 
                   line.startsWith('•') || 
                   line.match(/^\d+[\.\)]/) ||
                   (line.includes('？') && line.length > 5);
          })
          .map(line => {
            // 先頭の記号や番号を削除
            return line.replace(/^[-•\d\.\)\s]+/, '').trim();
          })
          .filter(q => q.length > 5 && q.includes('？'))
          .slice(0, 5); // 最大5個まで
        
        console.log('Debug: Extracted questions:', suggestedQuestions);
        
        if (suggestedQuestions.length > 0) {
          break; // 質問が見つかったらループを抜ける
        }
      }
    }

    // メタデータベースの追加質問（動画内容に基づく）
    const metadataQuestions = [];
    if (currentMetadata && currentMetadata.chapters && currentMetadata.chapters.length > 0) {
      metadataQuestions.push(`「${currentMetadata.chapters[0].title}」の部分で何が説明されていますか？`);
      if (currentMetadata.chapters.length > 1) {
        metadataQuestions.push(`「${currentMetadata.chapters[1].title}」について詳しく教えてください`);
      }
    }
    
    // デバッグ用のフォールバック質問（実際のデータがない場合）
    let fallbackQuestions = [];
    console.log('Debug: suggestedQuestions.length:', suggestedQuestions.length);
    console.log('Debug: metadataQuestions.length:', metadataQuestions.length);
    
    if (suggestedQuestions.length === 0 && metadataQuestions.length === 0) {
      console.log('Debug: Adding fallback questions');
      fallbackQuestions = [
        '動画の内容を詳しく説明してください',
        '重要なポイントを教えてください',
        'この動画から学べることは何ですか？'
      ];
    }

    const finalQuestions = [...suggestedQuestions, ...metadataQuestions, ...fallbackQuestions].slice(0, 8);
    console.log('Debug: Final questions:', finalQuestions);
    console.log('Debug: Questions source - suggestedQuestions:', suggestedQuestions.length, 'metadataQuestions:', metadataQuestions.length, 'fallbackQuestions:', fallbackQuestions.length);

    res.json({
      success: true,
      questions: finalQuestions,
      debug: {
        suggestedCount: suggestedQuestions.length,
        metadataCount: metadataQuestions.length,
        fallbackCount: fallbackQuestions.length,
        summaryPreview: summaryContent ? summaryContent.substring(0, 200) + '...' : 'null'
      }
    });

  } catch (error) {
    console.error('Error getting suggested questions:', error);
    res.status(500).json({ error: 'Failed to get suggested questions' });
  }
});

// メタデータ取得API
app.get('/metadata', (_, res) => {
  res.json({
    success: true,
    metadata: currentMetadata,
    summary: currentSummary?.content
  });
});

// デバッグ用API - 現在の状態を確認
app.get('/debug-state', (_, res) => {
  res.json({
    hasCurrentSummary: !!currentSummary,
    hasCurrentMetadata: !!currentMetadata,
    hasCurrentTranscript: !!currentTranscript,
    summaryContent: currentSummary ? currentSummary.content.substring(0, 500) + '...' : null,
    summaryLength: currentSummary ? currentSummary.content.length : 0
  });
});

// プロンプト管理API
function loadPrompts() {
  try {
    if (fs.existsSync('prompts.json')) {
      const data = fs.readFileSync('prompts.json', 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading prompts:', error);
  }
  return null;
}

function savePrompts(prompts) {
  try {
    fs.writeFileSync('prompts.json', JSON.stringify(prompts, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving prompts:', error);
    return false;
  }
}

// プロンプト取得
app.get('/prompts', (req, res) => {
  try {
    const prompts = loadPrompts();
    res.json({ success: true, prompts: prompts || {} });
  } catch (error) {
    console.error('Error getting prompts:', error);
    res.status(500).json({ error: 'Failed to get prompts' });
  }
});

// プロンプト保存
app.post('/prompts', (req, res) => {
  try {
    const { type, template } = req.body;
    if (!type || !template) {
      return res.status(400).json({ error: 'Type and template are required' });
    }

    let prompts = loadPrompts() || {};
    if (!prompts[type]) {
      prompts[type] = {};
    }
    prompts[type].template = template;

    if (savePrompts(prompts)) {
      res.json({ success: true, message: 'Prompt saved successfully' });
    } else {
      res.status(500).json({ error: 'Failed to save prompt' });
    }
  } catch (error) {
    console.error('Error saving prompt:', error);
    res.status(500).json({ error: 'Failed to save prompt' });
  }
});

// 記事智能合并API
app.post('/merge-article', async (req, res) => {
  try {
    const { existingArticle, userInstruction, aiResponse, gptModel = 'gpt-4o-mini', videoId } = req.body;
    
    console.log('=== MERGE REQUEST DEBUG ===');
    console.log('Existing article length:', existingArticle ? existingArticle.length : 0);
    console.log('User instruction:', userInstruction);
    console.log('AI response length:', aiResponse ? aiResponse.length : 0);
    console.log('GPT Model:', gptModel);
    
    if (!existingArticle || !userInstruction || !aiResponse) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'Existing article, user instruction, and AI response are required' });
    }

    // まず、ユーザー指示から該当セクションを特定
    const sectionAnalysisPrompt = `以下のユーザー指示を分析し、既存記事のどの部分を修正・詳細化したいのかを判断してください。

既存記事:
${existingArticle}

ユーザー指示:
${userInstruction}

AIの回答:
${aiResponse}

以下のJSON形式で回答してください:
{
  "targetSection": "該当するセクション名（例：導入部、まとめ、節約生活と現状の説明）。新しいセクションの場合は'新規'",
  "action": "詳細化 | 追加 | 修正",
  "explanation": "なぜそのセクションが該当するかの説明"
}`;

    console.log('Analyzing target section...');
    const analysisResponse = await openai.chat.completions.create({
      model: gptModel,
      messages: [{ role: 'user', content: sectionAnalysisPrompt }],
      max_tokens: 200,
      temperature: 0.1
    });

    let analysis;
    try {
      analysis = JSON.parse(analysisResponse.choices[0].message.content);
      console.log('Section analysis:', analysis);
    } catch (error) {
      console.log('Failed to parse analysis, using fallback');
      analysis = { targetSection: "不明", action: "詳細化", explanation: "分析失敗" };
    }

    // セクション特定型のマージプロンプト
    const mergePrompt = `あなたは記事編集の専門家です。既存記事の特定部分のみを改善してください。

## 既存記事:
${existingArticle}

## ユーザー指示:
${userInstruction}

## 該当セクション分析:
- 対象セクション: ${analysis.targetSection}
- アクション: ${analysis.action}
- 理由: ${analysis.explanation}

## AIの回答（参考情報）:
${aiResponse}

## 重要な指示:
1. 既存記事の構造とタイトル（#マーク含む）は絶対に変更しないでください
2. ${analysis.targetSection}セクションのみを ${analysis.action} してください
3. 他のセクションは一切変更せず、元のまま保持してください
4. セクションが「新規」の場合のみ、新しいセクションを追加してください
5. 既存の文体や表現を維持してください
6. 出力時は必ず # から始まるMarkdown形式を保持してください

## 作業方法:
- 該当セクションの内容を既存文章をベースに詳細化・改善
- 他のセクションはコピー&ペーストで完全に保持
- 全体の一貫性を保つ

既存記事をベースに、指定されたセクションのみを改善した記事を出力してください:`;

    const maxTokens = gptModel === 'gpt-3.5-turbo' ? 2000 : 3000;

    const response = await openai.chat.completions.create({
      model: gptModel,
      messages: [
        {
          role: 'system',
          content: mergePrompt
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.3
    });

    console.log('=== MERGE RESULT DEBUG ===');
    console.log('Original article preview:', existingArticle.substring(0, 200) + '...');
    console.log('Merge result preview:', response.choices[0].message.content.substring(0, 200) + '...');
    console.log('Result length:', response.choices[0].message.content.length);
    console.log('Contains original title:', response.choices[0].message.content.includes('残高850円の24歳女性のナイトルーティン'));

    const analysisInputTokens = Math.ceil(sectionAnalysisPrompt.length / 4);
    const analysisOutputTokens = Math.ceil(analysisResponse.choices[0].message.content.length / 4);
    const mergeInputTokens = Math.ceil(mergePrompt.length / 4);
    const mergeOutputTokens = Math.ceil(response.choices[0].message.content.length / 4);
    
    const totalInputTokens = analysisInputTokens + mergeInputTokens;
    const totalOutputTokens = analysisOutputTokens + mergeOutputTokens;
    
    const modelPricing = pricing.models[gptModel];
    const mergeCost = (totalInputTokens * modelPricing.input) + (totalOutputTokens * modelPricing.output);
    
    sessionCosts.gpt += mergeCost;
    sessionCosts.total += mergeCost;

    // マージ前の記事を履歴に保存（リクエストの existingArticle を使用）
    console.log('=== PRE-MERGE ARTICLE SAVE DEBUG ===');
    console.log('videoId from request:', videoId);
    console.log('existingArticle exists:', !!existingArticle);
    console.log('existingArticle length:', existingArticle ? existingArticle.length : 0);
    console.log('existingArticle preview:', existingArticle ? existingArticle.substring(0, 100) + '...' : 'null');
    
    if (videoId && existingArticle) {
      console.log('✅ Saving pre-merge article to history');
      addArticleToHistory(videoId, existingArticle, 'pre-merge');
    } else {
      console.log('❌ Cannot save pre-merge article - missing requirements');
      console.log('  videoId:', videoId);
      console.log('  existingArticle:', !!existingArticle);
    }
    
    // マージされた記事を現在の記事として保存
    currentArticle = response.choices[0].message.content;
    
    // マージ後の記事も履歴に保存
    if (videoId) {
      console.log('✅ Saving merged article to history');
      addArticleToHistory(videoId, response.choices[0].message.content, 'merged');
    }

    res.json({
      success: true,
      mergedArticle: response.choices[0].message.content,
      model: gptModel,
      cost: mergeCost,
      costs: sessionCosts,
      analysis: analysis,
      tokens: {
        input: totalInputTokens,
        output: totalOutputTokens
      }
    });

  } catch (error) {
    console.error('Error merging article:', error);
    res.status(500).json({ error: 'Failed to merge article' });
  }
});

// 記事履歴管理API
const articleHistoryFile = path.join('history', 'article_history.json');

function loadArticleHistory() {
  if (fs.existsSync(articleHistoryFile)) {
    try {
      return JSON.parse(fs.readFileSync(articleHistoryFile, 'utf8'));
    } catch (error) {
      console.error('Error loading article history:', error);
      return {};
    }
  }
  return {};
}

function saveArticleHistory(history) {
  try {
    fs.writeFileSync(articleHistoryFile, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Error saving article history:', error);
  }
}

function addArticleToHistory(videoId, article, type = 'generated') {
  const history = loadArticleHistory();
  if (!history[videoId]) {
    history[videoId] = [];
  }
  
  const entry = {
    article: article,
    type: type, // 'generated', 'merged'
    timestamp: new Date().toISOString(),
    id: Date.now().toString()
  };
  
  history[videoId].unshift(entry);
  
  // 各動画につき最新10件まで保持
  if (history[videoId].length > 10) {
    history[videoId].splice(10);
  }
  
  saveArticleHistory(history);
  return entry;
}

// 記事履歴取得API
app.get('/article-history/:videoId', (req, res) => {
  try {
    const { videoId } = req.params;
    const history = loadArticleHistory();
    
    res.json({
      success: true,
      history: history[videoId] || []
    });
  } catch (error) {
    console.error('Error getting article history:', error);
    res.status(500).json({ error: 'Failed to get article history' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Server also accessible on http://0.0.0.0:${PORT}`);
}).on('error', (err) => {
  console.error('Server error:', err);
});