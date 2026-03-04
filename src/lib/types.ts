export interface VideoItem {
  videoId: string;
  title: string;
  publishedAt: string;
  duration: string;
  type: "video" | "short";
}

export interface PlaylistData {
  title: string;
  playlistId: string;
  items: VideoItem[];
}

export interface ChannelData {
  channel: {
    title: string;
    thumbnail: string;
  };
  videos: VideoItem[];
  shorts: VideoItem[];
  playlists: PlaylistData[];
}
