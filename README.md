# AI URL Shortener & Analytics Platform

A high-performance, feature-packed full-stack **AI URL Shortener** application. This platform goes beyond basic redirection, offering custom aliases, robust access controls (passwords, expiration), detailed client-side telemetry, dynamic analytics dashboards, and server-side intelligence driven by the Google Gemini API (including URL safety scanning, phishing detection, page summaries, and alias recommendations).

---

## 🚀 Key Features

*   **AI Smart Suite**:
    *   **Phishing & Safety Scanner**: Analyzes destination URLs using the Google Gemini API to detect suspicious, fraudulent, or malicious links with structural risk reports.
    *   **Page Summarizer**: Generates automatic, concise digests of the destination pages.
    *   **Smart Alias Generator**: Recommends memorable and relevant custom aliases using natural language processing.
*   **Advanced Redirection Controls**:
    *   **Custom Aliases**: Personalize links for branding and ease of sharing.
    *   **Password Protection**: Secure sensitive URLs with encryption/passphrase hurdles.
    *   **Link Expiration**: Configure automatic expiration limits based on time or maximum click thresholds.
*   **Analytics Engine**:
    *   Real-time tracker analyzing device types, operating systems, browsers, referral headers, and approximate geo-location.
    *   Rich visual dashboard with charts displaying traffic patterns, referral sources, and user devices.
*   **Flexible Database Support**:
    *   **Offline / Local Persistence**: Fallback key-value data store `db.json` for superfast, setup-free local testing.
    *   **Production Supabase Integration**: Seamlessly connect your custom Supabase DB via environment variables for live cloud persistence.

---

## 🛠️ Tech Stack

*   **Frontend**: React (v19), Vite, Tailwind CSS (v4), Motion (for fluid animations), Lucide React (icons).
*   **Backend**: Node.js, Express, tsx (dev-runner), esbuild (production bundler).
*   **AI Integration**: Official `@google/genai` SDK.
*   **Database & Analytics Storage**: Express-bundled JSON storage + Optional Supabase Client.

---

## ⚙️ Environment Variables

Create a file named `.env` in the root directory (copy from `.env.example`):

```env
# Required for Gemini AI safety scanning and recommendations
GEMINI_API_KEY="your_gemini_api_key_here"

# The base URL where your app/server is hosted (e.g. http://localhost:3000)
APP_URL="http://localhost:3000"

# (Optional) Supabase integration for durable cloud persistence
SUPABASE_URL="your_supabase_url_here"
SUPABASE_ANON_KEY="your_supabase_anon_key_here"
```

---

## 💻 Local Development

Follow these steps to run the complete full-stack application on your machine:

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start the Dev Server**:
    ```bash
    npm run dev
    ```
    This launches the Express backend on `http://localhost:3000`, which automatically integrates and serves the Vite-powered React frontend with hot-reloading configurations.

3.  **Production Build**:
    ```bash
    npm run build
    ```
    This builds the frontend static assets under `dist/` and bundles the Express backend into `dist/server.cjs` for efficient production launching.

4.  **Launch Production Server**:
    ```bash
    npm start
    ```

---

## ☁️ Deployment Guide

### Why Netlify Alone Shows `Unexpected end of JSON input`
If you attempt to deploy the entire repository directly to **Netlify**, the React frontend loads, but clicking buttons or creating links produces a blank page or an error like:
`Failed to execute 'json' on 'Response': Unexpected end of JSON input`

**Why does this happen?**
Netlify is a **static web hosting provider**. It only builds and hosts the static frontend built assets (the `dist` folder files). It **cannot run your Express backend (`server.ts`)** because it does not support long-running Node.js processes. 

When your React app requests dynamic database endpoints like `/api/urls`, Netlify returns either a `404 Not Found` page or falls back to serving `index.html`. When React tries to parse that text payload as database JSON (`response.json()`), the browser fails with the `Unexpected end of JSON input` error.

---

### How to Correctly Deploy the App

To host this application properly, you have two simple choices:

#### Option A: Unified Full-Stack Hosting (Recommended & Easiest)
Deploy to cloud platforms that natively support running Node.js full-stack servers out of the box (both backend + frontend assets):
*   **Supported Platforms**: Render, Railway, Fly.io, Heroku, or digital ocean.
*   **Configuration**:
    1. Import your repository.
    2. Set the **Build Command** to: `npm run build`
    3. Set the **Start/Run Command** to: `npm start`
    4. Define your `GEMINI_API_KEY` (and optional Supabase variables) under the platform's Environment Settings.
    5. The engine will build the frontend, bundle the Node.js server, launch on a standard port, and render everything perfectly.

#### Option B: Split Frontend (Netlify/Vercel) + Backend (Node Host) (use render)
If you are determined to keep using Netlify for the frontend client, you must host the underlying API database elsewhere:
1.  **Backend Host**: Deploy the Express server (`server.ts`) code independently to **Render**, **Railway**, or **Fly.io**.
2.  **Configure API URL**: Update the `/src/` paths in your frontend code so that fetch requests point directly to your deployed Node API URL (e.g. `https://your-api.onrender.com/api/urls` instead of `/api/urls`).
3.  **Build Frontend**: Run `npm run build` locally or inside Netlify.
4.  **Deploy on Netlify**: Deploy the static `dist/` directory generated during the build to Netlify. Create a `_redirects` file in your Netlify folder to forward api endpoints to your API URL if desired:
    ```text
    /api/*  https://your-api.onrender.com/api/:splat  200
    /*      /index.html   200
    ```
