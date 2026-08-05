# Savor IQ

AI-assisted recipe and meal planning for iOS, built with Expo.

## Stack

- **Expo** (React Native) — test on device with Expo Go
- **TypeScript**
- **Expo Router** — file-based navigation
- **Firebase Auth** — email/password (configure via `.env`)
- **Gemini** — recipes from text + meal photo nutrition (`EXPO_PUBLIC_GEMINI_API_KEY`)
- **expo-image-picker** — camera / gallery for Analyze

## Prerequisites

- Node.js 20.19+
- [Expo Go](https://expo.dev/go) on your iPhone (**SDK 54** — current App Store version)
- Same Wi‑Fi network as your Mac (or use tunnel mode)
- A Firebase project with Email/Password auth enabled
- A [Google AI Studio](https://aistudio.google.com/apikey) Gemini API key

## Getting started

```bash
npm install
cp .env.example .env
# fill in EXPO_PUBLIC_FIREBASE_* and EXPO_PUBLIC_GEMINI_API_KEY
npm start
```

Scan the QR code in the terminal with the Camera app / Expo Go.

Useful scripts:

| Command | Description |
|---|---|
| `npm start` | Start Metro / Expo Dev Tools |
| `npm run ios` | Open in iOS simulator (macOS + Xcode) |
| `npm run android` | Open in Android emulator |
| `npm run web` | Run in the browser |
| `npm run lint` | ESLint via Expo |
| `npm run typecheck` | TypeScript check |
| `npm run lint:ci` | ESLint with zero warnings allowed |
| `npm run audit` | Fail on critical npm advisories |
| `npm run export:check` | Web export smoke (Metro bundle) |
| `npm run ci` | Full local gate (lint, typecheck, audit, doctor, config, export) |

## CI / CD

**CI** runs on every PR and push to `main`:

| Job | What it checks |
|---|---|
| Quality | ESLint (`--max-warnings=0`) + TypeScript |
| Expo | `expo-doctor`, `expo config`, web export smoke |
| Dependencies | `npm audit` (fail on critical; report high+) |
| Dependency Review | New/changed deps on PRs (fail on high+) |
| CodeQL | JavaScript/TypeScript static analysis |
| Secrets Scan | Gitleaks (block committed secrets) |

Protect `main` with required status checks for at least **Quality**, **Expo**, **Dependencies**, **CodeQL**, and **Secrets Scan**.

**CD**

- Push to `main` → quality gate, then **EAS iOS preview** build (skipped cleanly if `EXPO_TOKEN` is unset)
- Manual `workflow_dispatch` → choose `development` / `preview` / `production`
- Production / TestFlight submit stays manual (no auto-submit on tags yet)

Repo secret required for builds: `EXPO_TOKEN`

## Project layout

```
app/           # Expo Router screens
components/    # Shared UI
constants/     # Theme tokens
context/       # Auth provider
lib/           # Firebase + Gemini clients
ref/           # Local Flutter reference (gitignored)
```

## Notes

- **Recipes** tab: text ingredients → Gemini recipe (title, steps, nutrition). Recent recipes are stored locally on device.
- **Analyze** tab: camera or gallery photo → Gemini nutrition breakdown (calories, macros, tips).
- Auth screens work once Firebase env vars are set.
- Planner, cloud storage, voice, and PDF are not wired up yet.
- `EXPO_PUBLIC_*` keys are bundled into the client — fine for Expo Go prototyping; use a backend proxy before shipping.
