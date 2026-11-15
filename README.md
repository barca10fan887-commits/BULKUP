# BULKUP

BULKUP is a bulking and fitness tracker. It's a Progressive Web App (PWA), so it runs in any browser on desktop and phone, and you can install it on an iPhone or Android home screen like a normal app.

## Features

- **Onboarding and personal targets:** calculates BMI (optional), maintenance calories, surplus, daily calorie, protein, carb and fat targets, water goal and rate of gain. Every target can be adjusted, and all of them are labelled as estimates.
- **Dashboard:** calorie ring, macro bars, Today's Focus, daily summary, weight goal progress, today's training and quick water logging.
- **Food diary:** search (a built-in food list plus Open Food Facts), barcode scanner with manual entry fallback, AI photo scanner, manual entry, custom foods, saved meals, copy yesterday's meals, edit and delete with undo.
- **Workouts:** starter Upper, Lower and Full Body templates, routine editor, live workout logging with rest timer, auto-filled weights from last time, history, personal records with estimated 1RM, and a workout calendar.
- **Progress:** weight graph with 4-week, 3-month, 1-year and all-time ranges, weekly and monthly change, trend versus plan, weekly averages, measurements including custom ones, and a private photo journal with side-by-side and slider comparison.
- **Supplements:** creatine (your own daily dose, no forced loading phase), protein powder, mass gainers and pre-workout use nutrition from your own product label. You can also add custom supplements. Includes a 14-day history, reminder times and optional cost tracking.
- **AI coach:** answers questions using your actual logged data. Without an AI key it falls back to a clearly labelled rule-based basic coach.
- **Weekly check-in:** 7-day stats with an AI or basic review and suggested adjustments.
- **Water tracker, calendar and history, reminders, data export and account deletion.**

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS, Recharts, vite-plugin-pwa (Workbox), Supabase (auth, Postgres, storage), Express API server, and the Anthropic SDK (Claude) for the AI coach and photo scanner.

```
src/
  lib/          pure logic: calculations, stats, coach context, food DB, Open Food Facts, API client
  data/         storage layer: Repository interface + IndexedDB (local) and Supabase (cloud) adapters, app store
  auth/         Supabase auth provider
  components/   UI kit (Button, Card, Field, Sheet, Progress…) and the app shell
  features/     one folder per screen
server/         Express API: /api/status, /api/coach (streaming), /api/food-scan, /api/account/delete
shared/         request/response schemas used by both the client and the server
supabase/       SQL migration with tables, row-level security and the private photo bucket
```

## Run it locally

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

Open http://localhost:5173. Vite serves the app and forwards `/api` requests to the API server on port 8787.

```bash
npm test
```

```bash
npm run build
```

### Modes

| What's configured | What you get |
| --- | --- |
| Nothing | **Local mode.** Everything is saved in the browser on that device (IndexedDB). There are no accounts and no sync. Only the basic coach is available. |
| `ANTHROPIC_API_KEY` | AI coach, AI weekly reviews and the food photo scanner. |
| Supabase vars | Real accounts with sign up, log in, log out and password reset, data synced across devices, and private photo storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | "Delete account" removes the auth user and every row and photo belonging to them. |

## Set up Supabase (accounts and sync)

1. Create a project at supabase.com.
2. Open the SQL editor, paste `supabase/migrations/001_init.sql` and run it. It creates every table with row-level security, so each user can only read and write their own rows, plus the private `progress-photos` storage bucket.
3. In **Authentication > URL configuration**, set the Site URL to your deployed address. Password reset emails link back to it.
4. Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Add `SUPABASE_SERVICE_ROLE_KEY` on the server only.

## AI features

Set `ANTHROPIC_API_KEY` on the **server**. The key never reaches the browser: the app calls `/api/coach` and `/api/food-scan`, and the server calls Claude. The default model is `claude-opus-5-5` (override it with `ANTHROPIC_MODEL`). Requests use server-side refusal fallbacks, so a declined request is retried on a fallback model.

How the AI endpoints are protected:
- With Supabase configured, every request needs a valid signed-in user token.
- Without Supabase, set `BULKUP_ACCESS_CODE` and enter that code once in **Settings > Privacy**.
- In production with neither of these, the AI endpoints stay locked, so a public URL can't spend your API credit.
- Requests are rate-limited per user.

Users must turn on **Settings > Privacy > AI features** before any of their data is sent to the AI service.

## Deploy

The server serves the built app and the API from one Node process, so any Node host works (Render, Railway, Fly.io, a VPS):

```bash
npm install && npm run build
```

```bash
npm start
```

Set the environment variables from `.env.example` in your host's dashboard. The `VITE_*` variables must be set **before** `npm run build`, because they're compiled into the frontend. The site must be served over **HTTPS**, because the camera, barcode scanning, installing to the home screen and notifications all require it.

## Install on iPhone

1. Open your deployed BULKUP address in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open BULKUP from the home screen icon. It runs full screen and works offline for logging.
4. To get reminders, go to **Settings > Notifications** inside the installed app and turn them on. iOS needs version 16.4 or later, and the app must be opened from the home screen.

## Known limits

- **Reminders** are shown while the app is open or was used recently. Reminders that arrive while the app is fully closed need a push server (Web Push). The settings and reminder logic are ready for one.
- **Offline:** the app shell works offline. In cloud mode, changes made offline aren't queued yet. The store gives a clear "Couldn't save" message and rolls the change back.
- **Food data:** Open Food Facts is a community database, so a product can be missing or wrong. When a barcode isn't found, the app offers manual entry and saves the product to My foods.
- **Photo scanning** gives estimates for the user to review, not measurements.
- Units are metric (kg, cm, ml).

## Path to native iOS and Android apps

The UI only talks to storage through the `Repository` interface (`src/data/repo.ts`), and device features are isolated in `src/lib` (camera via `BarcodeScanner`, `image.ts` and `notifications.ts`). The simplest route is to wrap the existing build with **Capacitor**:

```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
```

```bash
npx cap init BULKUP com.yourname.bulkup --web-dir dist
```

```bash
npx cap add ios
```

Then replace `notifications.ts` with `@capacitor/local-notifications` (true background reminders) and point API calls at your deployed server URL. Building for iOS needs a Mac with Xcode and an Apple Developer account.

## Disclaimer

BULKUP gives general fitness and nutrition guidance. Calorie, macro and weight-gain figures are estimates from standard formulas, not medical advice.
