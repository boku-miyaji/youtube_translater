import 'dotenv/config';
import express, { Request, Response } from 'express';
import multer from 'multer';
import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import OpenAI from 'openai';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

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

let currentTranscript = '';

interface YouTubeUploadRequest {
  url: string;
}

interface ChatRequest {
  message: string;
}

async function downloadYouTubeAudio(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = ytdl(url, { quality: 'highestaudio' });
    
    ffmpeg(stream)
      .audioCodec('libmp3lame')
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

async function transcribeAudio(audioPath: string): Promise<string> {
  const audioFile = fs.createReadStream(audioPath);
  
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: 'ja'
  });
  
  return transcription.text;
}

app.post('/upload-youtube', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const videoInfo = await ytdl.getInfo(url);
    const videoTitle = videoInfo.videoDetails.title;
    const audioPath = path.join('uploads', `${Date.now()}_audio.mp3`);

    await downloadYouTubeAudio(url, audioPath);

    const transcript = await transcribeAudio(audioPath);
    currentTranscript = transcript;

    const transcriptPath = path.join('transcripts', `${Date.now()}_transcript.txt`);
    fs.writeFileSync(transcriptPath, transcript);

    fs.unlinkSync(audioPath);

    res.json({
      success: true,
      title: videoTitle,
      transcript: transcript,
      message: 'Video transcribed successfully'
    });

  } catch (error) {
    console.error('Error processing YouTube video:', error);
    res.status(500).json({ error: 'Failed to process YouTube video' });
  }
});

app.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!currentTranscript) {
      return res.status(400).json({ error: 'No transcript available. Please upload a YouTube video first.' });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `以下はYouTube動画の文字起こしです。この内容に基づいて質問に答えてください。\n\n${currentTranscript}`
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    res.json({
      success: true,
      response: response.choices[0].message.content
    });

  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

app.get('/transcript', (req: Request, res: Response) => {
  res.json({
    transcript: currentTranscript || 'No transcript available'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});