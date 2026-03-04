"use client";

import { useState } from "react";
import type { ChannelData, VideoItem } from "@/lib/types";

interface VideoSidebarProps {
  channelData: ChannelData;
  currentVideoId: string;
  onSelect: (videoId: string) => void;
}

function SidebarSection({
  title,
  items,
  currentVideoId,
  onSelect,
  defaultOpen = true,
}: {
  title: string;
  items: VideoItem[];
  currentVideoId: string;
  onSelect: (videoId: string) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>&#9654;</span>
        {title}
      </button>
      <div className={isOpen ? "" : "hidden"}>
        {items.map((item) => (
          <button
            key={item.videoId}
            onClick={() => onSelect(item.videoId)}
            className={`block w-full px-6 py-1.5 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              item.videoId === currentVideoId
                ? "bg-zinc-200 dark:bg-zinc-700 font-medium"
                : ""
            }`}
          >
            <span className="line-clamp-1">{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function VideoSidebar({ channelData, currentVideoId, onSelect }: VideoSidebarProps) {
  const hasContent =
    channelData.videos.length > 0 ||
    channelData.shorts.length > 0 ||
    channelData.playlists.some(p => p.items.length > 0);

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-700">
      <div className="px-3 py-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">
        {channelData.channel.title}
      </div>

      {!hasContent && (
        <p className="px-3 py-2 text-sm text-zinc-500">No videos found</p>
      )}

      {channelData.videos.length > 0 && (
        <SidebarSection
          title={`Videos (${channelData.videos.length})`}
          items={channelData.videos}
          currentVideoId={currentVideoId}
          onSelect={onSelect}
        />
      )}

      {channelData.shorts.length > 0 && (
        <SidebarSection
          title={`Shorts (${channelData.shorts.length})`}
          items={channelData.shorts}
          currentVideoId={currentVideoId}
          onSelect={onSelect}
        />
      )}

      {channelData.playlists.map((pl) => (
        <SidebarSection
          key={pl.playlistId}
          title={`${pl.title} (${pl.items.length})`}
          items={pl.items}
          currentVideoId={currentVideoId}
          onSelect={onSelect}
          defaultOpen={false}
        />
      ))}
    </aside>
  );
}
