import type { ChannelIdentifier } from "./youtube";
import type { ChannelData, VideoItem, PlaylistData } from "./types";

const API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Internal helper — appends the API key to every YouTube API request.
 */
async function ytFetch(
  endpoint: string,
  params: Record<string, string>
): Promise<unknown> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YouTube API key not configured");
  }

  const searchParams = new URLSearchParams({ ...params, key: apiKey });
  const url = `${API_BASE}/${endpoint}?${searchParams.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = (await res.json()) as { error?: { message?: string } };
    throw new Error(
      `YouTube API error: ${body.error?.message ?? "Unknown error"}`
    );
  }

  return res.json();
}

/**
 * Parse an ISO 8601 duration (e.g. PT5M30S, PT30S, PT1H2M3S) into total seconds.
 */
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

interface YTChannelItem {
  snippet: {
    title: string;
    thumbnails: { default: { url: string } };
  };
  contentDetails: {
    relatedPlaylists: { uploads: string };
  };
}

interface YTPlaylistItemEntry {
  contentDetails: {
    videoId: string;
    videoPublishedAt: string;
  };
}

interface YTVideoDetail {
  id: string;
  snippet: { title: string };
  contentDetails: { duration: string };
}

interface YTPlaylistEntry {
  id: string;
  snippet: { title: string };
}

/**
 * Fetch full channel data for a given channel identifier.
 */
export async function fetchChannelData(
  identifier: ChannelIdentifier
): Promise<ChannelData> {
  // --- 1. Resolve channel ---
  const channelParams: Record<string, string> = {
    part: "snippet,contentDetails",
  };
  if (identifier.type === "handle") {
    channelParams.forHandle = identifier.value;
  } else {
    channelParams.id = identifier.value;
  }

  const channelRes = (await ytFetch("channels", channelParams)) as {
    items: YTChannelItem[];
  };

  if (!channelRes.items || channelRes.items.length === 0) {
    throw new Error("Channel not found");
  }

  const channel = channelRes.items[0];
  const uploadsPlaylistId =
    channel.contentDetails.relatedPlaylists.uploads;

  // --- 2. Fetch uploads playlist items ---
  const uploadsRes = (await ytFetch("playlistItems", {
    part: "contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: "50",
  })) as { items: YTPlaylistItemEntry[] };

  const uploadItems = uploadsRes.items ?? [];

  // --- 3. Filter to ~7 days, fall back to max 20 ---
  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  let recentItems = uploadItems.filter(
    (item) =>
      new Date(item.contentDetails.videoPublishedAt).getTime() >= sevenDaysAgo
  );
  if (recentItems.length === 0) {
    recentItems = uploadItems.slice(0, 20);
  }

  // --- 4. Fetch video details (durations) for recent uploads ---
  let videos: VideoItem[] = [];
  let shorts: VideoItem[] = [];

  if (recentItems.length > 0) {
    const videoIds = recentItems.map((item) => item.contentDetails.videoId);
    const videosRes = (await ytFetch("videos", {
      part: "snippet,contentDetails",
      id: videoIds.join(","),
    })) as { items: YTVideoDetail[] };

    for (const v of videosRes.items) {
      const totalSeconds = parseDuration(v.contentDetails.duration);
      const publishedItem = recentItems.find(
        (ri) => ri.contentDetails.videoId === v.id
      );
      const item: VideoItem = {
        videoId: v.id,
        title: v.snippet.title,
        publishedAt: publishedItem?.contentDetails.videoPublishedAt ?? "",
        duration: v.contentDetails.duration,
        type: totalSeconds <= 60 ? "short" : "video",
      };
      if (item.type === "short") {
        shorts.push(item);
      } else {
        videos.push(item);
      }
    }
  }

  // --- 5. Fetch channel playlists ---
  const playlistsRes = (await ytFetch("playlists", {
    part: "snippet",
    channelId:
      identifier.type === "id"
        ? identifier.value
        : channelRes.items[0].snippet.title
          ? /* derive channel id from uploads playlist id */
            "UC" + uploadsPlaylistId.slice(2)
          : identifier.value,
    maxResults: "50",
  })) as { items: YTPlaylistEntry[] };

  const playlists: PlaylistData[] = [];

  for (const pl of playlistsRes.items ?? []) {
    // Expand each playlist
    const plItemsRes = (await ytFetch("playlistItems", {
      part: "contentDetails",
      playlistId: pl.id,
      maxResults: "50",
    })) as { items: YTPlaylistItemEntry[] };

    const plVideoIds = (plItemsRes.items ?? []).map(
      (item) => item.contentDetails.videoId
    );

    if (plVideoIds.length === 0) {
      playlists.push({ title: pl.snippet.title, playlistId: pl.id, items: [] });
      continue;
    }

    const plVideosRes = (await ytFetch("videos", {
      part: "snippet,contentDetails",
      id: plVideoIds.join(","),
    })) as { items: YTVideoDetail[] };

    const plItems: VideoItem[] = (plVideosRes.items ?? []).map((v) => {
      const totalSeconds = parseDuration(v.contentDetails.duration);
      /* istanbul ignore next -- plItemsRes.items already guarded on line 173 */
      const matchingItem = (plItemsRes.items ?? []).find(
        (pi) => pi.contentDetails.videoId === v.id
      );
      return {
        videoId: v.id,
        title: v.snippet.title,
        publishedAt: matchingItem?.contentDetails.videoPublishedAt ?? "",
        duration: v.contentDetails.duration,
        type: totalSeconds <= 60 ? ("short" as const) : ("video" as const),
      };
    });

    playlists.push({
      title: pl.snippet.title,
      playlistId: pl.id,
      items: plItems,
    });
  }

  return {
    channel: {
      title: channel.snippet.title,
      thumbnail: channel.snippet.thumbnails.default.url,
    },
    videos,
    shorts,
    playlists,
  };
}
