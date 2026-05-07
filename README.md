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
   `VITE_FIREBASE_AUTH_DOMAIN=readative-803b0.firebaseapp.com` for local Google sign-in
   `VITE_FIREBASE_PROJECT_AUTH_DOMAIN=readative-803b0.firebaseapp.com` for local development sign-in
   `VITE_FIREBASE_USE_BRANDED_AUTH_DOMAIN=false` unless the branded redirect URI is registered in Google Cloud
3. Run the app:
   `npm run dev`

## Branded Firebase Auth URL

Readative uses `readative.com` as the Firebase Auth domain so the Google sign-in
window can open on a branded URL in production. Branded auth is opt-in with
`VITE_FIREBASE_USE_BRANDED_AUTH_DOMAIN=true`; leave it off until the Google
Cloud OAuth redirect URI is registered. Local development uses
`readative-803b0.firebaseapp.com` to avoid `redirect_uri_mismatch` errors while
running on `localhost`. Keep the `/__/auth/*` rewrite enabled in production and
add `readative.com` in Firebase Authentication authorized domains. If Google
Cloud asks for a redirect URI, add `https://readative.com/__/auth/handler` and
`https://www.readative.com/__/auth/handler` if the live site redirects to `www`.
