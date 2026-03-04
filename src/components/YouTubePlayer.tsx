"use client";

import { useState, useCallback } from "react";
import YouTube, { YouTubeEvent } from "react-youtube";

interface YouTubePlayerProps {
  videoId: string;
}

type PlayerState = "unstarted" | "buffering" | "playing" | "paused" | "ended" | "error";

export default function YouTubePlayer({ videoId }: YouTubePlayerProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [playerState, setPlayerState] = useState<PlayerState>("unstarted");
  const [player, setPlayer] = useState<YT.Player | null>(null);

  const onReady = useCallback((event: YouTubeEvent) => {
    setPlayer(event.target);
    event.target.playVideo();
  }, []);

  const onStateChange = useCallback((event: YouTubeEvent<number>) => {
    const stateMap: Record<number, PlayerState> = {
      [-1]: "unstarted",
      [YT.PlayerState.BUFFERING]: "buffering",
      [YT.PlayerState.PLAYING]: "playing",
      [YT.PlayerState.PAUSED]: "paused",
      [YT.PlayerState.ENDED]: "ended",
    };
    setPlayerState(stateMap[event.data] ?? "unstarted");
  }, []);

  const onError = useCallback(() => {
    setPlayerState("error");
  }, []);

  const handleUnmute = useCallback(() => {
    if (player) {
      player.unMute();
      player.setVolume(100);
      setIsMuted(false);
    }
  }, [player]);

  const handleMute = useCallback(() => {
    if (player) {
      player.mute();
      setIsMuted(true);
    }
  }, [player]);

  return (
    <div className="relative w-full max-w-3xl">
      <YouTube
        videoId={videoId}
        opts={{
          width: "100%",
          playerVars: {
            autoplay: 1,
            mute: 1,
            playsinline: 1,
            rel: 0,
          },
        }}
        onReady={onReady}
        onStateChange={onStateChange}
        onError={onError}
        className="aspect-video w-full"
        iframeClassName="w-full h-full absolute inset-0"
      />

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-zinc-500 capitalize">{playerState}</span>
        <button
          onClick={isMuted ? handleUnmute : handleMute}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isMuted ? "Unmute" : "Mute"}
        </button>
      </div>

      {playerState === "error" && (
        <p className="mt-2 text-sm text-red-500">
          Failed to load video. Please check the video ID and try again.
        </p>
      )}
    </div>
  );
}
