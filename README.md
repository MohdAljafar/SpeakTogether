# SpeakTogether — MVP

A two-person English-practice video calling MVP.

## Included
- React + Vite frontend
- Google sign-in via Supabase Auth
- Express API with Supabase JWT verification
- PostgreSQL + Prisma schema
- Two-person room creation and joining
- LiveKit video/audio room tokens
- Per-user microphone recording in the browser, uploaded as chunks to private Supabase Storage
- Per-user AI analysis pipeline using Gemini audio input (short recordings recommended for this MVP)
- Personal conversation/report pages

## Important limitations
This is an MVP starter, not a hardened production service. It uses browser-side microphone recording of the local LiveKit microphone track. It uploads chunks periodically, which reduces loss if a tab closes, but abrupt browser/device failure can still lose the last chunk. Recording starts only after both users have consented and the recording indicator is visible.

The worker currently assembles chunks and sends each user's audio to Gemini for transcription + coaching analysis. Audio payloads sent inline to Gemini have size limits; keep initial test calls short. For longer recordings, replace this with a dedicated transcription API or Gemini Files API and a durable job queue.

Before public launch:
- Add rate limiting, stricter schema validation, monitoring, retries and abuse protection.
- Configure retention/deletion policies and obtain informed consent from every participant.
- Review local privacy/data-protection obligations.
- Test browser/device/network failures.
- Add signed upload/download URLs or authenticated streaming for playback if you add playback.
- Do not expose service-role, LiveKit secret or Gemini keys to the browser.

## 1. Requirements
- Node.js 20+
- npm
- PostgreSQL database (Supabase PostgreSQL is convenient)
- Supabase project
- Google OAuth client configured in Supabase
- LiveKit Cloud project (or self-hosted LiveKit)
- Gemini API key

## 2. Supabase setup
1. Create a project at https://supabase.com.
2. In Authentication → Providers → Google, enable Google.
3. Configure Google OAuth Client ID and Client Secret. Add the Supabase callback URL shown in the dashboard to Google Cloud OAuth authorized redirect URIs.
4. In Authentication → URL Configuration, add:
   - Site URL: `http://localhost:5173`
   - Redirect URL: `http://localhost:5173/**`
5. In Storage, create a **private** bucket named `conversation-audio`.
6. Copy Project URL, anon/publishable key, service-role key (server only), and PostgreSQL connection string.
7. Use the direct or pooled connection string appropriate for your deployment. Prisma migrations generally work best with a direct connection URL.

## 3. LiveKit setup
1. Create a project at https://cloud.livekit.io.
2. Copy WebSocket URL, API key and API secret.
3. In the LiveKit project, allow your frontend origin if the project settings require it.
4. This MVP generates participant access tokens on the backend. Never put the LiveKit API secret in frontend variables.

## 4. Gemini setup
1. Create an API key at https://aistudio.google.com/apikey.
2. Put it only in the backend `.env`.
3. The worker uses Gemini audio understanding to produce a transcript and coaching report. Model names can change; set `GEMINI_MODEL` to a currently available audio-capable Gemini model in your account.

## 5. Install
From the project root:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

On Windows PowerShell, use:
```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Fill in the environment values.

Install backend:
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
cd ..
```

Install frontend:
```bash
cd frontend
npm install
cd ..
```

## 6. Run locally
Terminal 1 — backend:
```bash
cd backend
npm run dev
```

Terminal 2 — worker:
```bash
cd backend
npm run worker
```

Terminal 3 — frontend:
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. Sign in with Google. Use two different accounts/devices to test a call.

## 7. How to test
1. Sign in as User A.
2. Create a room and copy the invitation link.
3. Open the link on another browser/device and sign in as User B.
4. Both users accept the recording consent.
5. Start the call. Confirm the recording indicator is visible for both.
6. End the call. The backend finalizes each recording and queues analysis.
7. Worker assembles each user's chunks and calls Gemini separately.
8. Each user sees only their own report.

## 8. Environment variables

### backend/.env
See `.env.example`. Required:
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `GEMINI_API_KEY`

### frontend/.env
- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_LIVEKIT_URL`

## 9. API routes
- `GET /api/health`
- `GET /api/auth/me`
- `POST /api/rooms`
- `POST /api/rooms/:roomCode/join`
- `POST /api/rooms/:roomCode/consent`
- `POST /api/rooms/:roomCode/token`
- `POST /api/rooms/:roomCode/end`
- `POST /api/recordings/:recordingId/chunks`
- `POST /api/recordings/:recordingId/finalize`
- `GET /api/recordings`
- `GET /api/reports/:recordingId`

All application routes require a valid Supabase access token.

## 10. Deployment
- Frontend: Vercel
- API: Render Web Service
- Worker: Render Background Worker (same backend repo, start command `npm run worker`)
- Database + private storage + auth: Supabase
- Video: LiveKit Cloud

Set production environment variables separately for API and worker. Set frontend `VITE_*` variables in Vercel. Update Supabase Auth redirect URLs to your production frontend URL and configure CORS.

## 11. Recording and privacy
The app requires each participant to explicitly consent before recording starts. The recording status is shown in the call UI. Each participant's microphone track is recorded separately and reports are private to that participant. The app does not record remote audio into the local participant's file.

A participant can withdraw consent/end the call. Add a formal privacy notice, retention period and account/data deletion flow before public use. Do not record people without their knowledge and agreement.

## 12. Troubleshooting
- Google login redirect error: check Supabase Google provider settings and redirect URL allow-list.
- 401 from API: ensure frontend sends the current Supabase access token in `Authorization: Bearer <token>`.
- LiveKit won't connect: check `VITE_LIVEKIT_URL`, backend token URL and LiveKit project credentials.
- Storage upload fails: ensure bucket exists and service-role key is correct in backend only.
- Gemini error: confirm model availability and API quota. Update `GEMINI_MODEL`.
- No report: ensure worker is running and recording status is `PROCESSING`.
