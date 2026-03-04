# Storion

Auto-loading YouTube video player built with Next.js.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

Paste a YouTube URL or video ID into the input field and click **Load**. The video will autoplay muted (per browser policy). Click **Unmute** to enable audio.

Supported URL formats:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- Plain 11-character video ID (e.g. `dQw4w9WgXcQ`)

## Tech Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [react-youtube](https://github.com/tjallingt/react-youtube)
- [Tailwind CSS](https://tailwindcss.com)
