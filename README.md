# Savor IQ

AI-assisted recipe and meal planning for iOS, built with Expo.

## Stack

- **Expo** (React Native) — test on device with Expo Go
- **TypeScript**
- **Expo Router** — file-based navigation

## Prerequisites

- Node.js 20+
- [Expo Go](https://expo.dev/go) on your iPhone
- Same Wi‑Fi network as your Mac (or use tunnel mode)

## Getting started

```bash
npm install
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

## Project layout

```
app/           # Expo Router screens
assets/        # Icons and splash
ref/           # Local Flutter reference (gitignored)
```

## Notes

Firebase, Gemini, camera, voice, and PDF are intentionally not wired up yet — this branch is the app shell only.
