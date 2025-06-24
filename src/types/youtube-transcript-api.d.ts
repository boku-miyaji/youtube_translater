declare module 'youtube-transcript-api' {
  export interface TranscriptItem {
    text: string;
    offset: string;
    duration: string;
  }

  export interface TranscriptConfig {
    lang?: string;
  }

  export class YoutubeTranscript {
    static fetchTranscript(
      videoId: string,
      config?: TranscriptConfig
    ): Promise<TranscriptItem[]>;
  }
}