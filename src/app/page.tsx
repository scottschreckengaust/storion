"use client";

import { useState } from "react";
import VideoInput from "@/components/VideoInput";
import YouTubePlayer from "@/components/YouTubePlayer";

export default function Home() {
  const [videoId, setVideoId] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        Storion
      </h1>
      <VideoInput onVideoId={setVideoId} />
      {videoId && <YouTubePlayer videoId={videoId} />}
    </div>
  );
}
