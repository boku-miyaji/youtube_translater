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
const PORT = process.env.PORT || 3000;

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
let sessionCosts = {
  whisper: 0,
  gpt: 0,
  total: 0
};

// 料金設定（2024年6月時点の価格）
const pricing = {
  whisper: 0.006, // $0.006 per minute
  models: {
    'gpt-4o-mini': {
      input: 0.15 / 1000000, // $0.15 per 1M tokens
      output: 0.60 / 1000000  // $0.60 per 1M tokens
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
    }
  }
};

// 履歴ファイルのパス
const historyFile = path.join('history', 'transcripts.json');

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

function addToHistory(videoId, title, url, transcript, method, cost = 0, metadata = null, summary = null, language = 'original', gptModel = 'gpt-4o-mini') {
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

// 文字起こし結果の整形
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

// 要約生成機能
async function generateSummary(transcript, metadata, gptModel = 'gpt-4o-mini') {
  try {
    const systemMessage = `あなたは動画コンテンツの分析専門家です。以下のYouTube動画の文字起こしを分析し、構造化された要約を生成してください。

動画情報:
- タイトル: ${metadata?.basic?.title || '不明'}
- 長さ: ${metadata?.basic?.duration ? Math.floor(metadata.basic.duration/60) + '分' + (metadata.basic.duration%60) + '秒' : '不明'}
- チャンネル: ${metadata?.basic?.channel || '不明'}

要約は以下の形式で出力してください:

## 📝 全体要約
[動画全体の概要を2-3文で]

## 🎯 主要ポイント
[最も重要な3-5つのポイントを箇条書きで]

## 📊 トピック別詳細
[内容を3-5つのトピックに分けて、それぞれ詳細に要約]

### 🔍 トピック1: [タイトル]
[このトピックの詳細内容 - 深掘り質問ができる程度の詳しさで]

### 🔍 トピック2: [タイトル]
[このトピックの詳細内容]

(以下、必要に応じて続ける)

## 💡 おすすめ深掘り質問
[視聴者が質問したくなりそうな具体的な質問例を3-5個]

文字起こし内容:
${transcript}`;

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
    model: 'whisper-1'
  };
  
  // 言語設定を追加
  if (language !== 'original') {
    transcriptionParams.language = language;
  }
  
  const transcription = await openai.audio.transcriptions.create(transcriptionParams);
  
  return transcription.text;
}

async function transcribeLargeAudio(audioPath, language = 'original') {
  const segmentDuration = 600; // 10分ごとに分割
  const segmentPaths = [];
  let segmentIndex = 0;
  
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
            model: 'whisper-1'
          };
          
          // 言語設定を追加
          if (language !== 'original') {
            transcriptionParams.language = language;
          }
          
          const transcription = await openai.audio.transcriptions.create(transcriptionParams);
          
          transcripts.push(transcription.text);
        }
        
        // セグメントファイルを削除
        segmentPaths.forEach(path => {
          if (fs.existsSync(path)) {
            fs.unlinkSync(path);
          }
        });
        
        resolve(transcripts.join(' '));
        
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
          detectedLanguage: lang
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
    const { url, language = 'original', gptModel = 'gpt-4o-mini' } = req.body;
    
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

    // 履歴から既存の文字起こしをチェック（同じ言語・モデル設定のもの）
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
      return res.json({
        success: true,
        title: existingEntry.title,
        transcript: existingEntry.transcript,
        summary: existingEntry.summary?.content,
        metadata: existingEntry.metadata,
        method: existingEntry.method,
        language: existingEntry.language,
        gptModel: existingEntry.gptModel,
        message: 'Retrieved from history',
        fromHistory: true,
        costs: sessionCosts
      });
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

    if (subtitlesResult) {
      console.log(`Using YouTube subtitles (${subtitlesResult.detectedLanguage})`);
      transcript = subtitlesResult.text;
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

      transcript = await transcribeAudio(audioPath, language);
      method = 'whisper';

      fs.unlinkSync(audioPath);
    }

    // 文字起こし結果を整形
    const formattedTranscript = formatTranscript(transcript);
    currentTranscript = formattedTranscript;

    // 要約を生成
    console.log(`Generating summary using ${gptModel}...`);
    const summary = await generateSummary(formattedTranscript, metadata, gptModel);
    currentSummary = summary;

    // 履歴に保存
    addToHistory(videoId, videoTitle, url, formattedTranscript, method, cost, metadata, summary, language, gptModel);

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
      cost: cost,
      message: `Video transcribed successfully using ${method} (${detectedLanguage})`,
      costs: sessionCosts
    });

  } catch (error) {
    console.error('Error processing YouTube video:', error);
    res.status(500).json({ error: 'Failed to process YouTube video' });
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

    // より詳細なコンテキストを提供
    let contextInfo = `以下はYouTube動画の文字起こしです。この内容に基づいて質問に答えてください。\n\n`;
    
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
    
    contextInfo += `文字起こし内容:\n${currentTranscript}`;
    
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

app.get('/transcript', (req, res) => {
  res.json({
    transcript: currentTranscript || 'No transcript available'
  });
});

app.get('/history', (req, res) => {
  const history = loadHistory();
  res.json({
    success: true,
    history: history
  });
});

app.get('/costs', (req, res) => {
  res.json({
    success: true,
    costs: sessionCosts
  });
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
    
    res.json({
      success: true,
      title: entry.title,
      transcript: entry.transcript,
      summary: entry.summary?.content,
      metadata: entry.metadata,
      method: entry.method,
      cost: entry.cost,
      timestamp: entry.timestamp,
      message: 'Loaded from history'
    });

  } catch (error) {
    console.error('Error loading from history:', error);
    res.status(500).json({ error: 'Failed to load from history' });
  }
});

// 深掘り質問提案API
app.get('/suggested-questions', (req, res) => {
  try {
    if (!currentSummary || !currentMetadata) {
      return res.status(400).json({ error: 'No summary or metadata available' });
    }

    // 要約から深掘り質問を抽出
    const summaryContent = currentSummary.content;
    const questionsMatch = summaryContent.match(/## 💡 おすすめ深掘り質問\s*([\s\S]*?)(?=##|$)/);
    
    let suggestedQuestions = [];
    if (questionsMatch) {
      const questionsText = questionsMatch[1];
      suggestedQuestions = questionsText
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
        .map(line => line.replace(/^[-\d.]\s*/, '').trim())
        .filter(q => q.length > 0);
    }

    // メタデータベースの追加質問
    const metadataQuestions = [];
    if (currentMetadata.chapters.length > 0) {
      metadataQuestions.push(`「${currentMetadata.chapters[0].title}」の部分について詳しく教えて`);
    }
    if (currentMetadata.basic.category) {
      metadataQuestions.push(`この動画の${currentMetadata.basic.category}分野での位置づけは？`);
    }

    res.json({
      success: true,
      questions: [...suggestedQuestions, ...metadataQuestions].slice(0, 8)
    });

  } catch (error) {
    console.error('Error getting suggested questions:', error);
    res.status(500).json({ error: 'Failed to get suggested questions' });
  }
});

// メタデータ取得API
app.get('/metadata', (req, res) => {
  res.json({
    success: true,
    metadata: currentMetadata,
    summary: currentSummary?.content
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});