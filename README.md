# Articulate AI

A mobile-first **PWA speaking coach** that trains you to express ideas clearly, concisely and persuasively in English, in 5–15 minutes a day.

Every session follows one loop:

> **Speak → Analyze → Improve → Speak again → Reflect**

You answer a question out loud. The coach names **one** strength and **one** thing to fix, and shows an improved version. You then say it again in half the time, and the app compares the two attempts. The weakness it found comes back on a **spaced-repetition** schedule, like flashcards for your speaking habits, until it stops showing up.

## What's in the MVP

| Area | Status |
|---|---|
| One-tap start: 5 / 10 / 15-minute sessions with timed phases, pause/resume on real elapsed time | ✅ |
| Warm-up (stress & pausing drill, plus today's framework) | ✅ |
| Microphone recording, live on-device transcript, optional server transcription (Whisper) | ✅ |
| AI feedback: 5 weighted dimensions, structure check (point / reasons / example / conclusion), strength, single biggest fix, improved version, why it's better, retry challenge | ✅ |
| Retry at half the time, then a before → after comparison with both recordings | ✅ |
| Stakeholder follow-up question (10 and 15-minute sessions) | ✅ |
| Six modules (Structure, Spontaneous, Concise, Persuasive, Delivery, Story), 40 curated questions, plus AI-generated questions when a key is set | ✅ |
| Spaced repetition of weaknesses; the next question targets whichever weakness is due | ✅ |
| Progress: streak, daily minutes, score trend, skill deltas, personal best, history with transcripts and recordings | ✅ |
| Coach screen: weekly recommendation, tracked patterns, review schedule | ✅ |
| Hands-free mode (reads prompts and feedback aloud, records automatically, stops on silence) | ✅ |
| Coaching notes in English or Japanese (rewrites always in English) | ✅ |
| Installable PWA, works offline (feedback falls back to an on-device estimate) | ✅ |
| Privacy: local-first; audio saved only with consent; export, import, per-session delete, delete everything | ✅ |
| Demo mode with no API keys, clearly labelled as simulated | ✅ |
| Cloud sync and accounts (Supabase schema included) | Phase 2 |

### Scoring principles
- Weights: Clarity 25%, Structure 25%, Conciseness 20%, Expression 15%, Delivery 15%.
- Scores are labelled **AI coaching estimates**, never presented as validated measurements.
- **Delivery is measured from the audio signal**: pace, hesitations and fillers per minute. The language model never scores it, and pronunciation is never judged from a transcript.
- Model output is validated and clamped (`lib/merge.ts`). If the AI fails, the session still completes with an on-device estimate.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional: leave empty for demo mode
npm run dev                  # http://localhost:3000
```

The microphone needs a **secure context**: `localhost` or HTTPS. To test on your phone, deploy the app (below) or use an HTTPS tunnel.

### Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Coaching with Claude. Used first if set. Default model `claude-sonnet-5-5`. |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` | Any OpenAI-compatible chat endpoint for coaching. This key also enables server speech-to-text and text-to-speech. |
| `STT_MODEL` | Server transcription model (default `whisper-1`). Without it, the browser's built-in speech recognition is used. |
| `TTS_MODEL`, `TTS_VOICE` | Server voice. Without it, the device's built-in voice is used. |

Keys are read only by the server-side route handlers in `app/api/*`. They are never sent to the browser.

**Recommended setup:** `ANTHROPIC_API_KEY` for coaching plus `OPENAI_API_KEY` for accurate Whisper transcription. With only one key, everything still works.

## Install on iPhone
1. Open the deployed URL in **Safari**, tap **Share → Add to Home Screen**.
2. Open Articulate from the home screen and allow the microphone on first use.
3. If you denied access earlier: Settings → Safari → Microphone (or Settings → Apps → Safari).

## Deploy
**Vercel (recommended):** import the repo, add the environment variables, deploy. No other configuration is needed.

**Any Node host:** `npm run build && npm start` (port 3000) behind HTTPS.

## Scripts
```bash
npm test         # unit tests (scoring, metrics, SRS, plans, question picking, AI-output parsing)
npm run lint     # type-check
npm run build    # production build
npm run icons    # re-render PWA icons from public/icons/icon.svg
```

## Architecture

```
app/
  page.tsx            Home: today's focus, duration, one-tap Start
  practice/page.tsx   The learning loop (state machine: warmup → prompt → recording → feedback → … → reflect)
  progress/ coach/ settings/
  api/analyze         Coaching (Claude / OpenAI-compatible / demo fallback)
  api/transcribe      Server speech-to-text (optional)
  api/question        AI-generated question (optional, local bank is the fallback)
  api/tts             Server voice (optional)
  api/status          Which providers are configured
lib/
  types.ts            Domain model
  rubric.ts           Weights, dimension labels, weakness taxonomy and drills
  metrics.ts          Transcript metrics + audio-based delivery score
  recorder.ts         MediaRecorder + energy-based pause detection + live recognition
  srs.ts              Spaced repetition for weaknesses
  questions.ts        Modules, question bank, warm-ups, adaptive picker
  prompts.ts          Coach system prompt and JSON contract
  merge.ts / json.ts  Validate and clamp model output
  demo.ts             Rule-based simulated coach (demo / offline)
  storage.ts          Local-first persistence (localStorage + IndexedDB)
  stats.ts            Streaks, trends, averages
public/sw.js          Service worker (app shell; never caches /api)
supabase/schema.sql   Tables + RLS + private recordings bucket for Phase 2 sync
```

To add cloud sync, replace the functions in `lib/storage.ts` with Supabase-backed equivalents using `supabase/schema.sql`. The UI only calls that module.

### Cost control
- One model call per attempt (2–3 per session). Questions come from the local bank; an AI question is requested once, during the warm-up.
- Live transcription runs in the browser for free. Whisper is used only if configured.
- The device's built-in voice is the default. Server TTS is opt-in.
