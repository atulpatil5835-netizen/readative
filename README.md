<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9284e864-ea53-486c-b150-f2122231c0f8

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the AI keys in `.env.local`:
   `GEMINI_API_KEY` for the existing Gemini-powered tools
   `OPENAI_API_KEY` for the new ChatGPT SmartTalk and low-interaction comment fallbacks
   `VITE_FIREBASE_AUTH_DOMAIN=readative.com` for the production Google sign-in helper URL
   `VITE_FIREBASE_PROJECT_AUTH_DOMAIN=readative-803b0.firebaseapp.com` for local development sign-in
3. Run the app:
   `npm run dev`

## Branded Firebase Auth URL

Readative uses `readative.com` as the Firebase Auth domain so the Google sign-in
window opens on a branded URL in production. Local development still uses
`readative-803b0.firebaseapp.com` to avoid Google OAuth `redirect_uri_mismatch`
errors while running on `localhost`. Keep the `/__/auth/*` rewrite enabled in
production and add `readative.com` in Firebase Authentication authorized
domains. If Google Cloud asks for a redirect URI, add
`https://readative.com/__/auth/handler`.
