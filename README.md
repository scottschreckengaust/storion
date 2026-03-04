# Storion

Channel-based YouTube video player built with Next.js. Enter a YouTube channel and auto-play its recent videos, shorts, and playlist contents sequentially.

## Prerequisites

### YouTube Data API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services > Library**
4. Search for **"YouTube Data API v3"** and click **Enable**
5. Go to **APIs & Services > Credentials**
6. Click **Create Credentials > API Key**
7. Copy the key

### API Key Best Practices

1. **Restrict your API key** — In Google Cloud Console, restrict the key to only the YouTube Data API v3 under **API restrictions**, and consider adding HTTP referrer or IP restrictions.
2. **Delete unneeded API keys** to minimize exposure to attacks.
3. **Rotate keys periodically** — Delete and recreate your API keys on a regular schedule.
4. **Never include API keys in client code or commit them to repositories** — Use `.env.local` (git-ignored) for local development and environment variables in production.
5. **Implement monitoring and logging** — Enable API key usage monitoring in Google Cloud Console to detect unauthorized use.

## Getting Started

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and add your YouTube Data API key:

```
YOUTUBE_API_KEY=your_key_here
```

Then start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

Paste a YouTube channel URL or handle into the input field and click **Load**. The app fetches the channel's recent videos (~last 7 days), shorts, and playlists, then plays them sequentially.

Supported channel URL formats:

- `@The_Dolmans`
- `https://www.youtube.com/@The_Dolmans`
- `https://www.youtube.com/channel/UCxxxxxxx`
- Bare channel ID (e.g., `UCxxxxxxx`)

### Playback

- Videos auto-play muted (per browser policy). Click **Unmute** to enable audio.
- Videos auto-advance when they end.
- Use **Prev** / **Next** buttons to navigate manually.
- Click any item in the sidebar to jump to it.
- Play order: Videos (newest first) > Shorts (newest first) > Playlist items.

## Tech Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [react-youtube](https://github.com/tjallingt/react-youtube)
- [Tailwind CSS](https://tailwindcss.com)
- [YouTube Data API v3](https://developers.google.com/youtube/v3)
