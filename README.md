# Savor IQ

AI-assisted recipe and meal planning for iOS, built with Expo.

## Stack

- **Expo** (React Native) — test on device with Expo Go
- **TypeScript**
- **Expo Router** — file-based navigation
- **Firebase Auth** — email/password (configure via `.env`)
- **Gemini** — recipe generation from text ingredients (`EXPO_PUBLIC_GEMINI_API_KEY`)

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
| `npm run ci` | Lint + typecheck (matches CI) |

## CI / CD

- **CI** (on PRs and `main`): lint, typecheck, and `expo-doctor`
- **CD**: manual GitHub Action (`CD` workflow) that runs `eas build` for iOS once `EXPO_TOKEN` is set in repo secrets

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
- Auth screens work once Firebase env vars are set.
- Camera analyze, planner, cloud storage, voice, and PDF are not wired up yet.
- `EXPO_PUBLIC_*` keys are bundled into the client — fine for Expo Go prototyping; use a backend proxy before shipping.
