# Savor IQ

AI-assisted recipe and meal planning for iOS, built with Expo.

## Stack

- **Expo** (React Native) — test on device with Expo Go
- **TypeScript**
- **Expo Router** — file-based navigation
- **Firebase Auth** — email/password (configure via `.env`)
- **Cloud Firestore** — save recipes and nutrition history per signed-in user
- **Gemini** — recipes from text + meal photo nutrition (`EXPO_PUBLIC_GEMINI_API_KEY`)
- **expo-camera** — in-app meal capture for Analyze (frame guide, retake)
- **expo-image-picker** — gallery picks for Analyze

## Prerequisites

- Node.js 20.19+
- [Expo Go](https://expo.dev/go) on your iPhone (**SDK 54** — current App Store version)
- Same Wi‑Fi network as your Mac (or use tunnel mode)
- A Firebase project with Email/Password auth enabled
- Cloud Firestore created in that Firebase project (start in test mode, then apply the rules below)
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

- **Home** tab: today’s macros from analyzed meals + recent meal list. Analyze via the center **+** button.
- **Analyze** (`+`): opens the camera directly (gallery in the corner) → confirm → processing → results. Saved to `users/{uid}/analyses`.
- **Chat** tab: choose Meal plan or Recipe, answer with option chips, get a plan or recipe in-thread (PDF export for plans).
- **Calendar** tab: month view of analyzed meals; select a day for macros and meal list.
- **Profile** shows cloud recipe and nutrition history.
- Auth screens work once Firebase env vars are set.
- Voice input is not wired up yet.
- `EXPO_PUBLIC_*` keys are bundled into the client — fine for Expo Go prototyping; use a backend proxy before shipping.

## Firestore rules

Enable Firestore, then use rules that keep each user to their own data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /recipes/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /analyses/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## Storage rules (meal photos)

Enable Storage in the Firebase console, then:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/meals/{fileName} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
