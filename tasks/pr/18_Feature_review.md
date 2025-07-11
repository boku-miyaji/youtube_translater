以下では **OpenAI の 3 つの音声→テキストモデル** ― **GPT-4o-Transcribe**、**GPT-4o-Mini-Transcribe**、**Whisper-1** ― を、料金・速度・精度など主な観点でまとめました。

| 観点                               | **GPT-4o-Transcribe**                                              | **GPT-4o-Mini-Transcribe**                                                                      | **Whisper-1** (API版)                                |
| ---------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **課金**<br>(目安 USD/分)          | **\$0.006** （\$6 / 100 万音声トークン） ([Holori][1])             | **\$0.003** （\$3 / 100 万音声トークン） ([Holori][1])                                          | **\$0.006** （秒単位課金） ([InvertedStone][2])      |
| **対応エンドポイント**             | バッチ `/audio` ＋ リアルタイム WebSocket                          | 同左                                                                                            | バッチ `/audio` のみ                                 |
| **ストリーミング遅延**<br>（平均） | ≈ 0.32 秒 最短 0.23 秒 ([OpenAI][3])                               | GPT-4o 比で **さらに低遅延**（Azure 計測で \~1.3–1.5× 高速） ([TECHCOMMUNITY.MICROSOFT.COM][4]) | 5 秒音声→1.1–1.6 秒（=実時間×0.2-0.3） ([Medium][5]) |
| **英語 WER**<br>(小さいほど高精度) | **≈ 2.5 %**（33 言語平均でも Whisper を上回る） ([VentureBeat][6]) | GPT-4o より **+3–5 pt 程度悪化**（“やや精度低下”と公式説明） ([TECHCOMMUNITY.MICROSOFT.COM][4]) | Whisper large 相当で **≈ 7.6 %** ([kenility.com][7]) |
| **1 リクエスト上限**               | 音声ファイル 25 MB ([Microsoft Learn][8])                          | 同左                                                                                            | 25 MB ([OpenAI Community][9])                        |
| **対応言語**                       | 100 +（日本語含む）                                                | 100 +                                                                                           | 100 +                                                |
| **代表的な不足機能**               | 話者分離・語単位タイムスタンプ未実装 ([Microsoft Learn][8])        | 〃                                                                                              | 〃                                                   |
| **特徴まとめ**                     | 高精度＋低遅延のフラッグシップ                                     | **半額＆さらに速い** ― モバイル・組込向け                                                       | OSS 版もあり, コスト／セルフホスト自由度◎            |

### 使い分けのヒント

| 目的 / 制約                                  | 最適モデル                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| **ライブ字幕・音声 UI**<br>遅延 0.5 秒以内   | **GPT-4o-Transcribe**（正確さ重視）<br>または **GPT-4o-Mini**（コストと速度優先） |
| **既録音ファイルの大量処理**                 | Whisper-1（バッチ処理専用で設定が簡単）                                           |
| **オンプレ／機密データ**                     | Whisper OSS（`whisper-large-v3` + `faster-whisper` など）                         |
| **GPU コストを最小化しつつ英語精度も欲しい** | GPT-4o-Mini-Transcribe（Whisper 比 \~50 % 割安で精度も上）                        |

> **ポイント**
>
> - GPT-4o 系は **ストリーミング／バッチ両対応**。同じモデルで場面ごとに API を切り替えられる。
> - Whisper-1 は **API ではストリーム非対応**だが、オープンソース版を改造すればリアルタイムも可（研究実装で 3.3 秒遅延報告あり）。 ([arXiv][10])
> - いずれも 25 MB 制限を超える長尺音声は分割アップロードが必要。

これを踏まえれば、**“超低遅延かつ高精度” が要件 → GPT-4o-Transcribe**、**“とにかく速く安く” → GPT-4o-Mini-Transcribe**、**“バッチ中心で安価・簡単” → Whisper-1** が大まかな選択基準になります。

[1]: https://holori.com/openai-pricing-guide/?utm_source=chatgpt.com 'The Ultimate Guide to OpenAI Pricing: Maximize Your AI investment'
[2]: https://invertedstone.com/calculators/whisper-pricing?utm_source=chatgpt.com 'OpenAI Whisper Pricing Calculator - InvertedStone'
[3]: https://openai.com/index/hello-gpt-4o/?utm_source=chatgpt.com 'Hello GPT-4o - OpenAI'
[4]: https://techcommunity.microsoft.com/blog/azure-ai-services-blog/real-time-speech-transcription-with-gpt-4o-transcribe-and-gpt-4o-mini-transcribe/4410353 'Real-time Speech Transcription with GPT-4o-transcribe and GPT-4o-mini-transcribe using WebSocket | Microsoft Community Hub'
[5]: https://tmmtt.medium.com/whisper-api-speech-to-text-2e7e366f9ec6?utm_source=chatgpt.com 'Whisper API — Speech to text - Teemu Maatta - Medium'
[6]: https://venturebeat.com/ai/openais-new-voice-ai-models-gpt-4o-transcribe-let-you-add-speech-to-your-existing-text-apps-in-seconds/?utm_source=chatgpt.com "OpenAI's new voice AI model gpt-4o-transcribe lets you add speech ..."
[7]: https://www.kenility.com/blog/technology/rise-ai-transcription-whisper-vs-google-speech-text 'The Rise of AI Transcription: Whisper vs Google Speech-to-Text | Kenility'
[8]: https://learn.microsoft.com/en-us/answers/questions/2260666/availability-of-gpt-4o-transcribe-in-azure-ai-spee?utm_source=chatgpt.com 'Availability of GPT-4o-Transcribe in Azure AI Speech? - Microsoft Q&A'
[9]: https://community.openai.com/t/whisper-api-increase-file-limit-25-mb/566754?utm_source=chatgpt.com 'Whisper API, increase file limit >25 MB'
[10]: https://arxiv.org/abs/2307.14743?utm_source=chatgpt.com 'Turning Whisper into Real-Time Transcription System'
