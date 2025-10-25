# Technology Stack

**Last Updated**: 2025-10-26
**Project**: YouTube Translater - YouTube video transcription and LLM chat system

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Frontend Stack](#frontend-stack)
3. [Backend Stack](#backend-stack)
4. [Development Tools](#development-tools)
5. [Infrastructure](#infrastructure)
6. [Key Libraries & Their Roles](#key-libraries--their-roles)

---

## 🎯 Project Overview

**Type**: Full-stack web application
**Architecture**: Client-Server with REST API
**Primary Function**: YouTube video transcription, PDF analysis, and AI-powered chat interface

### Core Features
- YouTube video transcription (subtitle extraction or Whisper API)
- PDF document analysis and summarization
- Audio/video file upload and processing
- AI chat interface for content interaction
- Cost and time estimation for processing
- Historical data tracking for improved predictions

---

## 🎨 Frontend Stack

### Core Framework
- **React 19.1.0** - UI library with latest features
- **TypeScript 5.8.3** - Type-safe JavaScript
- **Vite 7.0.0** - Fast build tool and dev server

### UI & Styling
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **@tailwindcss/typography 0.5.16** - Beautiful typographic defaults
- **PostCSS 8.5.6** - CSS transformations
- **Autoprefixer 10.4.21** - Vendor prefix automation

### State Management & Data Fetching
- **Zustand 5.0.6** - Lightweight state management
- **@tanstack/react-query 5.81.5** - Server state management and caching

### Routing & Navigation
- **React Router DOM 7.6.3** - Client-side routing

### Content Rendering
- **React Markdown 10.1.0** - Markdown rendering for chat messages
- **remark-gfm 4.0.1** - GitHub Flavored Markdown support

### Build Output
- **Client Bundle**: `dist/public/` (served statically)
- **Entry Point**: `src/main.tsx`
- **HTML Template**: `index.html`

---

## ⚙️ Backend Stack

### Runtime & Framework
- **Node.js** - JavaScript runtime
- **Express 4.18.2** - Web application framework
- **TypeScript 5.8.3** - Type-safe server code

### AI & ML Services
- **OpenAI API 4.20.1** - GPT models for:
  - Transcription (Whisper, GPT-4o-transcribe, GPT-4o-mini-transcribe)
  - Summarization (GPT-4o, GPT-4o-mini)
  - Chat interface
  - Article generation

### Media Processing
- **@distube/ytdl-core 4.16.12** - YouTube video downloading
- **youtube-transcript-api 3.0.0** - YouTube subtitle extraction
- **fluent-ffmpeg 2.1.2** - Audio/video conversion and processing
- **pdf-parse 1.1.1** - PDF text extraction

### File Handling
- **Multer 1.4.5-lts.1** - Multipart/form-data file uploads

### HTTP & Networking
- **Axios 1.10.0** - HTTP client for external APIs
- **CORS 2.8.5** - Cross-Origin Resource Sharing

### Configuration
- **dotenv 16.3.1** - Environment variable management

### Data Storage
- **File System** - JSON-based storage for:
  - History entries (`history/` directory)
  - Transcripts (`transcripts/` directory)
  - Uploads (`uploads/` directory)
  - Cost tracking
  - Analysis progress database

### Build Output
- **Server Bundle**: `dist/server.js`
- **Entry Point**: `src/server.ts`

---

## 🛠️ Development Tools

### Code Quality
- **ESLint 8.57.1** - JavaScript/TypeScript linting
  - `@typescript-eslint/eslint-plugin 8.35.0`
  - `@typescript-eslint/parser 8.35.0`
- **Prettier 3.6.0** - Code formatting

### Development Server
- **ts-node 10.9.2** - TypeScript execution for development
- **Nodemon 3.0.1** - Auto-restart on file changes
- **Vite Dev Server** - Hot module replacement for client

### Build Tools
- **TypeScript Compiler (tsc)** - Server-side transpilation
- **Vite** - Client-side bundling and optimization

### Testing
- **Jest** (implied by test files in `src/__tests__/` and `src/utils/__tests__/`)
- Test files:
  - `src/__tests__/pdf-page-navigation.test.ts`
  - `src/utils/__tests__/*`

---

## 🏗️ Infrastructure

### Port Configuration
- **Server**: Port 3000
- **Client Dev Server**: Port 5173 (Vite default)
- **Production**: Client served from Express static middleware

### File Storage Structure
```
.
├── history/           # Video analysis history (JSON)
├── transcripts/       # Transcript files
├── uploads/          # User-uploaded files
├── dist/
│   ├── server.js     # Compiled backend
│   └── public/       # Compiled frontend assets
└── public/           # Static assets
```

### Environment Variables (`.env`)
```bash
OPENAI_API_KEY=<your-api-key>
PORT=3000
```

### API Endpoints
- `/api/upload-youtube` - YouTube URL analysis
- `/api/upload-video` - Video file upload
- `/api/upload-audio` - Audio file upload
- `/api/analyze-pdf` - PDF analysis (URL or file)
- `/api/estimate-cost` - Cost estimation for YouTube
- `/api/estimate-cost-pdf` - Cost estimation for PDF
- `/api/chat` - Chat with AI about content
- `/api/regenerate-summary` - Regenerate summary
- `/api/generate-article` - Generate article
- `/api/history` - Get analysis history
- `/api/load-from-history/:videoId` - Load specific entry
- `/api/costs` - Get cost analytics

---

## 📚 Key Libraries & Their Roles

### Frontend

#### State Management
```typescript
// Zustand - Global app state
import { create } from 'zustand';

// React Query - Server state caching
import { useQuery, useMutation } from '@tanstack/react-query';
```

**Why chosen**:
- Zustand: Minimal boilerplate, TypeScript-first, ~1KB
- React Query: Automatic caching, refetching, and synchronization

#### Styling
```typescript
// Tailwind CSS - Utility classes
<div className="flex items-center justify-between p-4 bg-gray-100">
```

**Why chosen**:
- Rapid development with utility classes
- Consistent design system
- Excellent tree-shaking (small bundle size)

#### Markdown Rendering
```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {chatMessage}
</ReactMarkdown>
```

**Why chosen**:
- Supports GitHub Flavored Markdown (tables, task lists, strikethrough)
- Safe HTML rendering
- Extensible with plugins

### Backend

#### YouTube Processing
```typescript
import ytdl from '@distube/ytdl-core';
import { YoutubeTranscript } from 'youtube-transcript-api';

// Extract subtitle captions (fast, free)
const transcript = await YoutubeTranscript.fetchTranscript(videoId);

// Or download audio and transcribe with Whisper (slow, paid)
const audioStream = ytdl(url, { quality: 'highestaudio' });
```

**Why chosen**:
- `@distube/ytdl-core`: More stable than original ytdl-core
- `youtube-transcript-api`: Fast subtitle extraction (no API costs)

#### PDF Processing
```typescript
import pdfParse from 'pdf-parse';

const pdfBuffer = await downloadPDF(url);
const pdfContent = await pdfParse(pdfBuffer);
```

**Why chosen**:
- Pure JavaScript (no native dependencies)
- Extracts text and metadata
- Handles most PDF formats

#### AI Integration
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Transcription
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: 'whisper-1'
});

// Chat completion
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: prompt }]
});
```

**Why chosen**:
- Official OpenAI SDK
- Type-safe API
- Supports streaming responses

#### Media Processing
```typescript
import ffmpeg from 'fluent-ffmpeg';

ffmpeg(inputPath)
  .audioCodec('libmp3lame')
  .audioBitrate(128)
  .format('mp3')
  .save(outputPath);
```

**Why chosen**:
- Comprehensive audio/video conversion
- Cross-platform support
- Integration with FFmpeg binary

---

## 🔄 Build & Deployment Process

### Development
```bash
# Terminal 1: Backend with hot reload
npm run dev

# Terminal 2: Frontend with HMR
npm run dev:client
```

### Production Build
```bash
# Clean, compile TypeScript, build client
npm run build:all

# Outputs:
# - dist/server.js (backend)
# - dist/public/* (frontend assets)
```

### Start Production
```bash
npm start
# Runs: npm run build:all && node dist/server.js
```

---

## 📊 Performance Characteristics

### Frontend
- **Initial Load**: ~200-500KB (Vite optimized bundle)
- **Code Splitting**: Automatic route-based splitting
- **Caching**: React Query handles server state cache
- **Build Time**: ~5-10 seconds (Vite)

### Backend
- **Startup Time**: ~2-3 seconds
- **Memory Usage**: ~150-300MB baseline
- **PDF Processing**: 0.1-5 seconds per page
- **Video Transcription**:
  - Subtitle extraction: 1-3 seconds
  - Whisper API: 30-60 seconds per minute of audio

---

## 🔐 Security Considerations

### Current Implementation
- ✅ CORS enabled for API access
- ✅ Environment variables for secrets
- ✅ TypeScript for type safety
- ✅ File upload size limits (Multer)

### Recommended Improvements (from PR #24 review)
- ⚠️ **SSRF Protection**: Validate PDF URLs to block internal IPs
- ⚠️ **DoS Prevention**: Enforce PDF size limits before download
- ⚠️ **Rate Limiting**: Prevent abuse of API endpoints
- ⚠️ **Input Validation**: Sanitize user inputs
- ⚠️ **Content Security Policy**: Add CSP headers

---

## 📈 Scalability Considerations

### Current Architecture
- **Single Server**: Express handles all requests
- **File Storage**: Local filesystem
- **No Load Balancing**: Not horizontally scalable

### Potential Improvements
1. **Queue System**: Redis/Bull for background processing
2. **Object Storage**: S3 for uploads and transcripts
3. **Database**: PostgreSQL for structured data
4. **Caching**: Redis for API responses
5. **CDN**: CloudFront for static assets
6. **Containerization**: Docker for consistent deployment

---

## 🧪 Testing Strategy

### Current Coverage
- Unit tests for utilities (`src/utils/__tests__/`)
- Integration tests for specific features
- Manual end-to-end testing

### Test Files
```
src/
├── __tests__/
│   └── pdf-page-navigation.test.ts
└── utils/
    └── __tests__/
        └── (various utility tests)
```

### Testing Tools (inferred)
- Jest or Vitest (TypeScript test runner)
- React Testing Library (component tests)

---

## 📝 Configuration Files

### TypeScript
- `tsconfig.json` - TypeScript compiler options
- Target: ES2020
- Module: CommonJS (backend) / ESNext (frontend)

### Vite
- `vite.config.ts` - Frontend build configuration
- Plugins: `@vitejs/plugin-react`
- Proxy: API requests to backend during dev

### Tailwind
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS plugins

### Linting
- `.eslintrc.js` / `.eslintrc.json` - ESLint rules
- `.prettierrc` / `.prettierrc.json` - Code formatting rules

---

## 🚀 Future Technology Considerations

Based on project trajectory, consider:

1. **Database**:
   - PostgreSQL for relational data
   - MongoDB for flexible schema
   - Prisma ORM for type-safe queries

2. **Real-time Features**:
   - Socket.io for live transcription progress
   - WebSockets for chat streaming

3. **Search**:
   - Elasticsearch for full-text search
   - Vector database (Pinecone, Weaviate) for semantic search

4. **Monitoring**:
   - Sentry for error tracking
   - DataDog/New Relic for performance monitoring
   - OpenTelemetry for distributed tracing

5. **Authentication**:
   - Auth0 or Clerk for user management
   - JWT tokens for API authentication

---

## 📚 Additional Resources

### Documentation
- [PDF Implementation Details](./pdf-implementation-details.md)
- [PDF Processing Logic](./pdf-processing-logic.md)
- [PDF Quickstart Guide](./pdf-quickstart-guide.md)
- [TypeScript Migration Plan](./typescript-migration-plan.md)

### External Dependencies Docs
- [React 19 Docs](https://react.dev/)
- [Vite Docs](https://vitejs.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/)
- [OpenAI API Docs](https://platform.openai.com/docs/)
- [Express Docs](https://expressjs.com/)

---

**Maintained by**: Development Team
**Last Review**: 2025-10-26
**Version**: 1.0.0
