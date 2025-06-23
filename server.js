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
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    server: 'javascript',
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
    method,
    language,
    gptModel,
    cost,
    metadata,
    summary,
    timestampedSegments,
    tags,
    mainTags,
    article,
    timestamp: new Date().toISOString()
  };
  
  const existingIndex = history.findIndex(item => item.id === videoId);
  if (existingIndex >= 0) {
    history[existingIndex] = entry;
  } else {
    history.unshift(entry);
  }
  
  if (history.length > 100) {
    history.splice(100);
  }
  
  saveHistory(history);
  return entry;
}

// Time format function (convert seconds to mm:ss format)
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Format timestamped transcript
function formatTimestampedTranscript(timestampedSegments) {
  if (!timestampedSegments || timestampedSegments.length === 0) return '';
  
  return timestampedSegments.map(segment => {
    const startTime = formatTime(segment.start);
    const text = segment.text.trim();
    return `<div class="timestamp-segment" data-start="${segment.start}"><div class="timestamp-row"><span class="timestamp-time" onclick="seekToTime(${segment.start})">${startTime}</span><span class="timestamp-text">${text}</span></div></div>`;
  }).join('');
}

// API endpoints
app.get('/transcript', (req, res) => {
  const timestampedTranscript = formatTimestampedTranscript(currentTimestampedSegments);
  res.json({
    transcript: currentTranscript || 'No transcript available',
    timestampedTranscript: timestampedTranscript,
    timestampedSegments: currentTimestampedSegments
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
  const costs = loadCosts();
  res.json(costs);
});

app.get('/session-costs', (req, res) => {
  console.log('JavaScript server: /session-costs called');
  res.json({
    ...sessionCosts,
    server: 'javascript',
    timestamp: new Date().toISOString()
  });
});

app.post('/load-from-history', async (req, res) => {
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

app.post('/save-article', async (req, res) => {
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

// Prompts configuration endpoints
app.get('/prompts', (req, res) => {
  const promptsFile = 'prompts.json';
  if (fs.existsSync(promptsFile)) {
    try {
      const prompts = JSON.parse(fs.readFileSync(promptsFile, 'utf8'));
      res.json(prompts);
    } catch (error) {
      console.error('Error loading prompts:', error);
      res.json({});
    }
  } else {
    res.json({});
  }
});

app.post('/prompts/save', (req, res) => {
  try {
    const { type, template } = req.body;
    
    if (!type || !template) {
      return res.status(400).json({ error: 'Type and template are required' });
    }
    
    const promptsFile = 'prompts.json';
    let prompts = {};
    
    if (fs.existsSync(promptsFile)) {
      try {
        prompts = JSON.parse(fs.readFileSync(promptsFile, 'utf8'));
      } catch (error) {
        console.error('Error loading existing prompts:', error);
      }
    }
    
    prompts[type] = {
      name: type,
      template: template
    };
    
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

// Missing core endpoints - copied from TypeScript server
app.post('/upload-youtube', async (req, res) => {
  try {
    const { url, language = 'original', gptModel = 'gpt-4o-mini', mainTags = [], tags = '', forceRegenerate = false } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false,
        message: 'YouTube URL is required'
      });
    }

    // For now, return a simple response to prevent 404
    res.json({
      success: false,
      message: 'Please use TypeScript server for full functionality'
    });

  } catch (error) {
    console.error('Error in upload-youtube:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { message, gptModel = 'gpt-4o-mini' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // For now, return a simple response to prevent 404
    res.json({
      success: false,
      response: 'Please use TypeScript server for full functionality'
    });

  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/regenerate-summary', async (req, res) => {
  try {
    res.json({
      success: false,
      message: 'Please use TypeScript server for full functionality'
    });
  } catch (error) {
    console.error('Error in regenerate-summary:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});