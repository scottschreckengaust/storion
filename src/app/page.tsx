"use client";

import { useState, useCallback, useMemo } from "react";
import ChannelInput from "@/components/ChannelInput";
import YouTubePlayer from "@/components/YouTubePlayer";
import VideoSidebar from "@/components/VideoSidebar";
import type { ChannelData, VideoItem } from "@/lib/types";

function buildQueue(data: ChannelData): VideoItem[] {
  const queue: VideoItem[] = [];
  queue.push(...data.videos);
  queue.push(...data.shorts);
  for (const pl of data.playlists) {
    queue.push(...pl.items);
  }
  return queue;
}

export default function Home() {
  const [channelData, setChannelData] = useState<ChannelData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queue = useMemo(
    () => (channelData ? buildQueue(channelData) : []),
    [channelData]
  );

  const currentVideo = queue[currentIndex] ?? null;

  const handleSubmit = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    setChannelData(null);
    setCurrentIndex(0);

    try {
      const res = await fetch(`/api/channel?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to fetch channel data");
        return;
      }
      setChannelData(data);
    } catch {
      setError("Failed to fetch channel data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, queue.length - 1));
  }, [queue.length]);

  const handleSelect = useCallback(
    (videoId: string) => {
      const idx = queue.findIndex((v) => v.videoId === videoId);
      /* istanbul ignore next -- defensive guard: sidebar only provides valid IDs */
      if (idx >= 0) setCurrentIndex(idx);
    },
    [queue]
  );

  const handlePrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, queue.length - 1));
  }, [queue.length]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Storion
        </h1>
        <ChannelInput onSubmit={handleSubmit} isLoading={isLoading} />
      </header>

      {error && (
        <div className="px-4 py-3">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {channelData && (
        <div className="flex flex-1 overflow-hidden">
          <VideoSidebar
            channelData={channelData}
            currentVideoId={currentVideo?.videoId ?? ""}
            onSelect={handleSelect}
          />
          <main className="flex flex-1 flex-col items-center gap-4 p-6">
            {currentVideo && (
              <>
                <YouTubePlayer
                  key={currentVideo.videoId}
                  videoId={currentVideo.videoId}
                  onEnded={handleEnded}
                />
                <div className="flex items-center gap-4">
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-zinc-500">
                    {currentIndex + 1} / {queue.length}
                  </span>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex === queue.length - 1}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
