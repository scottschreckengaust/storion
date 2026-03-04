# Channel-Based Sequential Video Player Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend Storion from a single-video player to a channel-based player that fetches and sequentially plays a YouTube channel's recent videos, shorts, and playlist contents.

**Architecture:** A Next.js API route calls the YouTube Data API v3 server-side to fetch channel data (uploads, shorts, playlists). The client renders a sidebar with collapsible sections and a player that auto-advances through a flattened queue. The API key stays server-side in `.env.local`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, react-youtube, YouTube Data API v3

---

### Task 1: Add `extractChannelIdentifier` to `src/lib/youtube.ts`

**Files:**
- Modify: `src/lib/youtube.ts`
- Modify: `src/__tests__/youtube.test.ts`

**Step 1: Write the failing tests**

Add to the end of `src/__tests__/youtube.test.ts`:

```typescript
import { extractVideoId, extractChannelIdentifier } from "@/lib/youtube";

// ... existing extractVideoId tests stay unchanged ...

describe("extractChannelIdentifier", () => {
  it("extracts handle from @handle", () => {
    expect(extractChannelIdentifier("@The_Dolmans")).toEqual({ type: "handle", value: "The_Dolmans" });
  });

  it("extracts handle from full URL with @", () => {
    expect(extractChannelIdentifier("https://www.youtube.com/@The_Dolmans")).toEqual({ type: "handle", value: "The_Dolmans" });
  });

  it("extracts handle from URL without www", () => {
    expect(extractChannelIdentifier("https://youtube.com/@The_Dolmans")).toEqual({ type: "handle", value: "The_Dolmans" });
  });

  it("extracts channel ID from /channel/ URL", () => {
    expect(extractChannelIdentifier("https://www.youtube.com/channel/UCabc123def456")).toEqual({ type: "id", value: "UCabc123def456" });
  });

  it("extracts channel ID from bare UC-prefixed string", () => {
    expect(extractChannelIdentifier("UCabc123def456")).toEqual({ type: "id", value: "UCabc123def456" });
  });

  it("returns null for empty string", () => {
    expect(extractChannelIdentifier("")).toBeNull();
  });

  it("returns null for whitespace only", () => {
    expect(extractChannelIdentifier("   ")).toBeNull();
  });

  it("returns null for random URL", () => {
    expect(extractChannelIdentifier("https://example.com/channel")).toBeNull();
  });

  it("returns null for a video URL", () => {
    expect(extractChannelIdentifier("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(extractChannelIdentifier("  @The_Dolmans  ")).toEqual({ type: "handle", value: "The_Dolmans" });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/youtube.test.ts -v`
Expected: FAIL — `extractChannelIdentifier` is not exported

**Step 3: Write minimal implementation**

Add to the end of `src/lib/youtube.ts`:

```typescript
export interface ChannelIdentifier {
  type: "handle" | "id";
  value: string;
}

export function extractChannelIdentifier(input: string): ChannelIdentifier | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Full URL: youtube.com/@handle
  const handleUrlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([a-zA-Z0-9_.-]+)/
  );
  if (handleUrlMatch) return { type: "handle", value: handleUrlMatch[1] };

  // Bare @handle
  const bareHandleMatch = trimmed.match(/^@([a-zA-Z0-9_.-]+)$/);
  if (bareHandleMatch) return { type: "handle", value: bareHandleMatch[1] };

  // Full URL: youtube.com/channel/UCxxx
  const channelUrlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/
  );
  if (channelUrlMatch) return { type: "id", value: channelUrlMatch[1] };

  // Bare channel ID starting with UC
  const bareIdMatch = trimmed.match(/^(UC[a-zA-Z0-9_-]+)$/);
  if (bareIdMatch) return { type: "id", value: bareIdMatch[1] };

  return null;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/youtube.test.ts -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/youtube.ts src/__tests__/youtube.test.ts
git commit -m "feat: add extractChannelIdentifier utility"
```

---

### Task 2: Add shared types in `src/lib/types.ts`

**Files:**
- Create: `src/lib/types.ts`

**Step 1: Create the types file**

```typescript
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
```

No tests needed for a pure types file — TypeScript compiler validates it.

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared types for channel data"
```

---

### Task 3: Create YouTube API helper `src/lib/youtube-api.ts`

**Files:**
- Create: `src/lib/youtube-api.ts`
- Create: `src/__tests__/youtube-api.test.ts`

This is a server-only module that wraps YouTube Data API v3 calls using plain `fetch`. No SDK dependency needed.

**Step 1: Write the failing tests**

Create `src/__tests__/youtube-api.test.ts`:

```typescript
import { fetchChannelData } from "@/lib/youtube-api";

const YOUTUBE_BASE = "https://www.googleapis.com/youtube/v3";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockJsonResponse(data: unknown) {
  return { ok: true, json: async () => data };
}

function mockErrorResponse(status: number, message: string) {
  return { ok: false, status, json: async () => ({ error: { message } }) };
}

beforeEach(() => {
  mockFetch.mockReset();
  process.env.YOUTUBE_API_KEY = "test-api-key";
});

afterEach(() => {
  delete process.env.YOUTUBE_API_KEY;
});

describe("fetchChannelData", () => {
  const channelResponse = {
    items: [{
      id: "UCtest123",
      snippet: { title: "Test Channel", thumbnails: { default: { url: "https://thumb.jpg" } } },
      contentDetails: { relatedPlaylists: { uploads: "UUtest123" } },
    }],
  };

  const uploadsResponse = {
    items: [
      {
        snippet: {
          resourceId: { videoId: "vid1" },
          title: "Video One",
          publishedAt: new Date().toISOString(),
        },
      },
      {
        snippet: {
          resourceId: { videoId: "short1" },
          title: "Short One",
          publishedAt: new Date().toISOString(),
        },
      },
    ],
  };

  const videosDetailResponse = {
    items: [
      { id: "vid1", contentDetails: { duration: "PT5M30S" } },
      { id: "short1", contentDetails: { duration: "PT30S" } },
    ],
  };

  const playlistsResponse = {
    items: [
      { id: "PLtest1", snippet: { title: "My Playlist" } },
    ],
  };

  const playlistItemsResponse = {
    items: [
      {
        snippet: {
          resourceId: { videoId: "plvid1" },
          title: "Playlist Vid 1",
          publishedAt: new Date().toISOString(),
        },
      },
    ],
  };

  const playlistVideoDetailResponse = {
    items: [
      { id: "plvid1", contentDetails: { duration: "PT10M" } },
    ],
  };

  it("fetches channel data by handle", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse(channelResponse))      // channels.list
      .mockResolvedValueOnce(mockJsonResponse(uploadsResponse))       // playlistItems.list (uploads)
      .mockResolvedValueOnce(mockJsonResponse(videosDetailResponse))  // videos.list (durations)
      .mockResolvedValueOnce(mockJsonResponse(playlistsResponse))     // playlists.list
      .mockResolvedValueOnce(mockJsonResponse(playlistItemsResponse)) // playlistItems.list (playlist)
      .mockResolvedValueOnce(mockJsonResponse(playlistVideoDetailResponse)); // videos.list (playlist durations)

    const result = await fetchChannelData({ type: "handle", value: "TestChannel" });

    expect(result.channel.title).toBe("Test Channel");
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].videoId).toBe("vid1");
    expect(result.shorts).toHaveLength(1);
    expect(result.shorts[0].videoId).toBe("short1");
    expect(result.playlists).toHaveLength(1);
    expect(result.playlists[0].items).toHaveLength(1);

    // Verify first fetch used forHandle
    const firstCallUrl = mockFetch.mock.calls[0][0] as string;
    expect(firstCallUrl).toContain("forHandle=TestChannel");
  });

  it("fetches channel data by ID", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse(channelResponse))
      .mockResolvedValueOnce(mockJsonResponse(uploadsResponse))
      .mockResolvedValueOnce(mockJsonResponse(videosDetailResponse))
      .mockResolvedValueOnce(mockJsonResponse(playlistsResponse))
      .mockResolvedValueOnce(mockJsonResponse(playlistItemsResponse))
      .mockResolvedValueOnce(mockJsonResponse(playlistVideoDetailResponse));

    await fetchChannelData({ type: "id", value: "UCtest123" });

    const firstCallUrl = mockFetch.mock.calls[0][0] as string;
    expect(firstCallUrl).toContain("id=UCtest123");
  });

  it("throws when API key is missing", async () => {
    delete process.env.YOUTUBE_API_KEY;
    await expect(fetchChannelData({ type: "handle", value: "Test" }))
      .rejects.toThrow("YouTube API key not configured");
  });

  it("throws when channel is not found", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ items: [] }));
    await expect(fetchChannelData({ type: "handle", value: "Nonexistent" }))
      .rejects.toThrow("Channel not found");
  });

  it("throws on API error response", async () => {
    mockFetch.mockResolvedValueOnce(mockErrorResponse(403, "quotaExceeded"));
    await expect(fetchChannelData({ type: "handle", value: "Test" }))
      .rejects.toThrow("YouTube API error: quotaExceeded");
  });

  it("handles channel with no playlists", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse(channelResponse))
      .mockResolvedValueOnce(mockJsonResponse(uploadsResponse))
      .mockResolvedValueOnce(mockJsonResponse(videosDetailResponse))
      .mockResolvedValueOnce(mockJsonResponse({ items: [] }));

    const result = await fetchChannelData({ type: "handle", value: "TestChannel" });

    expect(result.playlists).toHaveLength(0);
  });

  it("handles channel with no recent uploads", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse(channelResponse))
      .mockResolvedValueOnce(mockJsonResponse({ items: [] }))
      .mockResolvedValueOnce(mockJsonResponse(playlistsResponse))
      .mockResolvedValueOnce(mockJsonResponse(playlistItemsResponse))
      .mockResolvedValueOnce(mockJsonResponse(playlistVideoDetailResponse));

    const result = await fetchChannelData({ type: "handle", value: "TestChannel" });

    expect(result.videos).toHaveLength(0);
    expect(result.shorts).toHaveLength(0);
  });

  it("filters uploads older than 7 days, falls back to max 20", async () => {
    const oldDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const oldUploads = {
      items: Array.from({ length: 25 }, (_, i) => ({
        snippet: {
          resourceId: { videoId: `old${i}` },
          title: `Old Video ${i}`,
          publishedAt: oldDate,
        },
      })),
    };
    const oldDurations = {
      items: Array.from({ length: 20 }, (_, i) => ({
        id: `old${i}`,
        contentDetails: { duration: "PT5M" },
      })),
    };

    mockFetch
      .mockResolvedValueOnce(mockJsonResponse(channelResponse))
      .mockResolvedValueOnce(mockJsonResponse(oldUploads))
      .mockResolvedValueOnce(mockJsonResponse(oldDurations))
      .mockResolvedValueOnce(mockJsonResponse({ items: [] }));

    const result = await fetchChannelData({ type: "handle", value: "TestChannel" });

    // Falls back to max 20 since none are within 7 days
    expect(result.videos.length + result.shorts.length).toBeLessThanOrEqual(20);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/youtube-api.test.ts -v`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/lib/youtube-api.ts`:

```typescript
import type { ChannelIdentifier } from "./youtube";
import type { ChannelData, VideoItem, PlaylistData } from "./types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YouTube API key not configured");
  return key;
}

async function ytFetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set("key", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`YouTube API error: ${err.error?.message ?? res.status}`);
  }
  return res.json() as Promise<T>;
}

interface YTChannelItem {
  id: string;
  snippet: { title: string; thumbnails: { default: { url: string } } };
  contentDetails: { relatedPlaylists: { uploads: string } };
}

interface YTPlaylistItem {
  snippet: {
    resourceId: { videoId: string };
    title: string;
    publishedAt: string;
  };
}

interface YTVideoDetail {
  id: string;
  contentDetails: { duration: string };
}

interface YTPlaylistInfo {
  id: string;
  snippet: { title: string };
}

function parseDurationSeconds(iso8601: string): number {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) +
         (parseInt(match[2] || "0") * 60) +
         (parseInt(match[3] || "0"));
}

async function fetchVideoDetails(videoIds: string[]): Promise<YTVideoDetail[]> {
  if (videoIds.length === 0) return [];
  const data = await ytFetch<{ items: YTVideoDetail[] }>("videos", {
    part: "contentDetails",
    id: videoIds.join(","),
    maxResults: "50",
  });
  return data.items;
}

async function fetchPlaylistItems(playlistId: string, maxResults = 50): Promise<YTPlaylistItem[]> {
  const data = await ytFetch<{ items: YTPlaylistItem[] }>("playlistItems", {
    part: "snippet",
    playlistId,
    maxResults: maxResults.toString(),
  });
  return data.items;
}

function categorizeByDuration(
  items: YTPlaylistItem[],
  details: YTVideoDetail[]
): { videos: VideoItem[]; shorts: VideoItem[] } {
  const durationMap = new Map(details.map(d => [d.id, d.contentDetails.duration]));
  const videos: VideoItem[] = [];
  const shorts: VideoItem[] = [];

  for (const item of items) {
    const duration = durationMap.get(item.snippet.resourceId.videoId) ?? "PT0S";
    const seconds = parseDurationSeconds(duration);
    const videoItem: VideoItem = {
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
      duration,
      type: seconds <= 60 ? "short" : "video",
    };
    if (seconds <= 60) {
      shorts.push(videoItem);
    } else {
      videos.push(videoItem);
    }
  }

  return { videos, shorts };
}

export async function fetchChannelData(identifier: ChannelIdentifier): Promise<ChannelData> {
  // 1. Resolve channel
  const channelParams: Record<string, string> = {
    part: "snippet,contentDetails",
  };
  if (identifier.type === "handle") {
    channelParams.forHandle = identifier.value;
  } else {
    channelParams.id = identifier.value;
  }

  const channelData = await ytFetch<{ items: YTChannelItem[] }>("channels", channelParams);
  if (!channelData.items || channelData.items.length === 0) {
    throw new Error("Channel not found");
  }

  const channel = channelData.items[0];
  const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

  // 2. Fetch recent uploads
  const uploads = await fetchPlaylistItems(uploadsPlaylistId, 50);

  // 3. Filter to ~7 days, fallback to 20
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let recentUploads = uploads.filter(
    item => new Date(item.snippet.publishedAt) >= sevenDaysAgo
  );
  if (recentUploads.length === 0) {
    recentUploads = uploads.slice(0, 20);
  }

  // 4. Get durations to categorize videos vs shorts
  let videos: VideoItem[] = [];
  let shorts: VideoItem[] = [];

  if (recentUploads.length > 0) {
    const videoIds = recentUploads.map(u => u.snippet.resourceId.videoId);
    const details = await fetchVideoDetails(videoIds);
    const categorized = categorizeByDuration(recentUploads, details);
    videos = categorized.videos;
    shorts = categorized.shorts;
  }

  // 5. Fetch channel playlists
  const playlistsData = await ytFetch<{ items: YTPlaylistInfo[] }>("playlists", {
    part: "snippet",
    channelId: channel.id,
    maxResults: "25",
  });

  // 6. Expand each playlist
  const playlists: PlaylistData[] = [];
  for (const pl of playlistsData.items) {
    const plItems = await fetchPlaylistItems(pl.id);
    if (plItems.length === 0) continue;
    const plVideoIds = plItems.map(i => i.snippet.resourceId.videoId);
    const plDetails = await fetchVideoDetails(plVideoIds);
    const durationMap = new Map(plDetails.map(d => [d.id, d.contentDetails.duration]));
    playlists.push({
      title: pl.snippet.title,
      playlistId: pl.id,
      items: plItems.map(i => ({
        videoId: i.snippet.resourceId.videoId,
        title: i.snippet.title,
        publishedAt: i.snippet.publishedAt,
        duration: durationMap.get(i.snippet.resourceId.videoId) ?? "PT0S",
        type: parseDurationSeconds(durationMap.get(i.snippet.resourceId.videoId) ?? "PT0S") <= 60 ? "short" as const : "video" as const,
      })),
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
```

**Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/youtube-api.test.ts -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/youtube-api.ts src/__tests__/youtube-api.test.ts
git commit -m "feat: add YouTube Data API helper for channel fetching"
```

---

### Task 4: Create API route `src/app/api/channel/route.ts`

**Files:**
- Create: `src/app/api/channel/route.ts`
- Create: `src/__tests__/channel-route.test.ts`

**Step 1: Write the failing tests**

Create `src/__tests__/channel-route.test.ts`:

```typescript
import { GET } from "@/app/api/channel/route";
import * as youtubeApi from "@/lib/youtube-api";

jest.mock("@/lib/youtube-api");
const mockFetchChannelData = youtubeApi.fetchChannelData as jest.MockedFunction<typeof youtubeApi.fetchChannelData>;

describe("GET /api/channel", () => {
  it("returns channel data for valid handle", async () => {
    const mockData = {
      channel: { title: "Test", thumbnail: "https://thumb.jpg" },
      videos: [],
      shorts: [],
      playlists: [],
    };
    mockFetchChannelData.mockResolvedValueOnce(mockData);

    const request = new Request("http://localhost/api/channel?q=%40TestChannel");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockData);
  });

  it("returns 400 for missing query parameter", async () => {
    const request = new Request("http://localhost/api/channel");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Missing channel URL or handle");
  });

  it("returns 400 for invalid channel identifier", async () => {
    const request = new Request("http://localhost/api/channel?q=invalid");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid channel URL or handle");
  });

  it("returns 404 when channel not found", async () => {
    mockFetchChannelData.mockRejectedValueOnce(new Error("Channel not found"));

    const request = new Request("http://localhost/api/channel?q=%40Nonexistent");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Channel not found");
  });

  it("returns 500 for API key errors", async () => {
    mockFetchChannelData.mockRejectedValueOnce(new Error("YouTube API key not configured"));

    const request = new Request("http://localhost/api/channel?q=%40Test");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("YouTube API key not configured");
  });

  it("returns 500 for generic errors", async () => {
    mockFetchChannelData.mockRejectedValueOnce(new Error("YouTube API error: quotaExceeded"));

    const request = new Request("http://localhost/api/channel?q=%40Test");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("YouTube API error: quotaExceeded");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/channel-route.test.ts -v`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/app/api/channel/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { extractChannelIdentifier } from "@/lib/youtube";
import { fetchChannelData } from "@/lib/youtube-api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Missing channel URL or handle" },
      { status: 400 }
    );
  }

  const identifier = extractChannelIdentifier(query);
  if (!identifier) {
    return NextResponse.json(
      { error: "Invalid channel URL or handle" },
      { status: 400 }
    );
  }

  try {
    const data = await fetchChannelData(identifier);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Channel not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/channel-route.test.ts -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/app/api/channel/route.ts src/__tests__/channel-route.test.ts
git commit -m "feat: add /api/channel route for YouTube channel data"
```

---

### Task 5: Extend `YouTubePlayer` with `onEnded` callback

**Files:**
- Modify: `src/components/YouTubePlayer.tsx`
- Modify: `src/__tests__/YouTubePlayer.test.tsx`

**Step 1: Write the failing test**

Add to `src/__tests__/YouTubePlayer.test.tsx`, inside the existing `describe("YouTubePlayer", ...)`:

```typescript
  it("calls onEnded when video ends", () => {
    const onEnded = jest.fn();
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" onEnded={onEnded} />);
    const onStateChange = getLastProps().onStateChange as (event: { data: number }) => void;
    act(() => {
      onStateChange({ data: 0 }); // ENDED state
    });
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("does not crash when onEnded is not provided and video ends", () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    const onStateChange = getLastProps().onStateChange as (event: { data: number }) => void;
    act(() => {
      onStateChange({ data: 0 });
    });
    expect(screen.getByText("ended")).toBeInTheDocument();
  });
```

**Step 2: Run tests to verify the first fails**

Run: `npx jest src/__tests__/YouTubePlayer.test.tsx -v`
Expected: FAIL — `onEnded` not recognized / not called

**Step 3: Update the implementation**

In `src/components/YouTubePlayer.tsx`:

1. Update the interface:
```typescript
interface YouTubePlayerProps {
  videoId: string;
  onEnded?: () => void;
}
```

2. Update the component signature:
```typescript
export default function YouTubePlayer({ videoId, onEnded }: YouTubePlayerProps) {
```

3. Update the `onStateChange` callback to call `onEnded`:
```typescript
  const onStateChange = useCallback((event: YouTubeEvent<number>) => {
    const stateMap: Record<number, PlayerState> = {
      [-1]: "unstarted",
      [YT.PlayerState.BUFFERING]: "buffering",
      [YT.PlayerState.PLAYING]: "playing",
      [YT.PlayerState.PAUSED]: "paused",
      [YT.PlayerState.ENDED]: "ended",
    };
    const newState = stateMap[event.data] ?? "unstarted";
    setPlayerState(newState);
    if (newState === "ended") {
      onEnded?.();
    }
  }, [onEnded]);
```

**Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/YouTubePlayer.test.tsx -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/YouTubePlayer.tsx src/__tests__/YouTubePlayer.test.tsx
git commit -m "feat: add onEnded callback to YouTubePlayer"
```

---

### Task 6: Create `ChannelInput` component

**Files:**
- Create: `src/components/ChannelInput.tsx`
- Create: `src/__tests__/ChannelInput.test.tsx`

**Step 1: Write the failing tests**

Create `src/__tests__/ChannelInput.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChannelInput from "@/components/ChannelInput";

describe("ChannelInput", () => {
  it("renders input and button", () => {
    render(<ChannelInput onSubmit={jest.fn()} isLoading={false} />);
    expect(screen.getByPlaceholderText("Paste a YouTube channel URL or @handle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load" })).toBeInTheDocument();
  });

  it("calls onSubmit with channel input on valid submit", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<ChannelInput onSubmit={onSubmit} isLoading={false} />);

    await user.type(screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"), "@The_Dolmans");
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(onSubmit).toHaveBeenCalledWith("@The_Dolmans");
  });

  it("shows error for invalid input", async () => {
    const user = userEvent.setup();
    render(<ChannelInput onSubmit={jest.fn()} isLoading={false} />);

    await user.type(screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"), "invalid");
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(screen.getByText("Invalid YouTube channel URL or handle.")).toBeInTheDocument();
  });

  it("clears error on valid resubmit", async () => {
    const user = userEvent.setup();
    render(<ChannelInput onSubmit={jest.fn()} isLoading={false} />);
    const input = screen.getByPlaceholderText("Paste a YouTube channel URL or @handle");

    await user.type(input, "invalid");
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(screen.getByText("Invalid YouTube channel URL or handle.")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "@The_Dolmans");
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(screen.queryByText("Invalid YouTube channel URL or handle.")).not.toBeInTheDocument();
  });

  it("disables button and shows loading text when isLoading", () => {
    render(<ChannelInput onSubmit={jest.fn()} isLoading={true} />);
    const button = screen.getByRole("button", { name: "Loading..." });
    expect(button).toBeDisabled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/ChannelInput.test.tsx -v`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/components/ChannelInput.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import { extractChannelIdentifier } from "@/lib/youtube";

interface ChannelInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

export default function ChannelInput({ onSubmit, isLoading }: ChannelInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const identifier = extractChannelIdentifier(url);
      if (identifier) {
        setError("");
        onSubmit(url);
      } else {
        setError("Invalid YouTube channel URL or handle.");
      }
    },
    [url, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-5xl">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube channel URL or @handle"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-zinc-900 px-6 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isLoading ? "Loading..." : "Load"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </form>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/ChannelInput.test.tsx -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/ChannelInput.tsx src/__tests__/ChannelInput.test.tsx
git commit -m "feat: add ChannelInput component"
```

---

### Task 7: Create `VideoSidebar` component

**Files:**
- Create: `src/components/VideoSidebar.tsx`
- Create: `src/__tests__/VideoSidebar.test.tsx`

**Step 1: Write the failing tests**

Create `src/__tests__/VideoSidebar.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VideoSidebar from "@/components/VideoSidebar";
import type { ChannelData } from "@/lib/types";

const mockChannel: ChannelData = {
  channel: { title: "Test Channel", thumbnail: "https://thumb.jpg" },
  videos: [
    { videoId: "vid1", title: "Video One", publishedAt: "2026-03-01T00:00:00Z", duration: "PT5M", type: "video" },
    { videoId: "vid2", title: "Video Two", publishedAt: "2026-02-28T00:00:00Z", duration: "PT10M", type: "video" },
  ],
  shorts: [
    { videoId: "short1", title: "Short One", publishedAt: "2026-03-01T00:00:00Z", duration: "PT30S", type: "short" },
  ],
  playlists: [
    {
      title: "My Playlist",
      playlistId: "PLtest1",
      items: [
        { videoId: "plvid1", title: "Playlist Vid", publishedAt: "2026-03-01T00:00:00Z", duration: "PT8M", type: "video" },
      ],
    },
  ],
};

describe("VideoSidebar", () => {
  it("renders channel title", () => {
    render(<VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />);
    expect(screen.getByText("Test Channel")).toBeInTheDocument();
  });

  it("renders video section with count", () => {
    render(<VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />);
    expect(screen.getByText("Videos (2)")).toBeInTheDocument();
  });

  it("renders shorts section with count", () => {
    render(<VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />);
    expect(screen.getByText("Shorts (1)")).toBeInTheDocument();
  });

  it("renders playlist section with title and count", () => {
    render(<VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />);
    expect(screen.getByText("My Playlist (1)")).toBeInTheDocument();
  });

  it("highlights currently playing video", () => {
    render(<VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />);
    const item = screen.getByText("Video One").closest("button");
    expect(item).toHaveClass("bg-zinc-200");
  });

  it("does not highlight non-playing videos", () => {
    render(<VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />);
    const item = screen.getByText("Video Two").closest("button");
    expect(item).not.toHaveClass("bg-zinc-200");
  });

  it("calls onSelect when clicking a video", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(<VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={onSelect} />);

    await user.click(screen.getByText("Video Two"));
    expect(onSelect).toHaveBeenCalledWith("vid2");
  });

  it("toggles section collapse on click", async () => {
    const user = userEvent.setup();
    render(<VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />);

    // Videos section is visible initially
    expect(screen.getByText("Video One")).toBeVisible();

    // Click the section header to collapse
    await user.click(screen.getByText("Videos (2)"));
    expect(screen.queryByText("Video One")).not.toBeVisible();

    // Click again to expand
    await user.click(screen.getByText("Videos (2)"));
    expect(screen.getByText("Video One")).toBeVisible();
  });

  it("renders empty state when no content", () => {
    const emptyData: ChannelData = {
      channel: { title: "Empty Channel", thumbnail: "" },
      videos: [],
      shorts: [],
      playlists: [],
    };
    render(<VideoSidebar channelData={emptyData} currentVideoId="" onSelect={jest.fn()} />);
    expect(screen.getByText("No videos found")).toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/VideoSidebar.test.tsx -v`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/components/VideoSidebar.tsx`:

```typescript
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
```

**Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/VideoSidebar.test.tsx -v`
Expected: ALL PASS (may need minor adjustments to CSS class checks)

**Step 5: Commit**

```bash
git add src/components/VideoSidebar.tsx src/__tests__/VideoSidebar.test.tsx
git commit -m "feat: add VideoSidebar component with collapsible sections"
```

---

### Task 8: Rewrite `page.tsx` to orchestrate channel playback

**Files:**
- Modify: `src/app/page.tsx`
- Rewrite: `src/__tests__/page.test.tsx`

**Step 1: Write the failing tests**

Rewrite `src/__tests__/page.test.tsx`:

```typescript
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";

// Mock react-youtube
const mockYouTube = jest.fn((_props: Record<string, unknown>) => (
  <div data-testid="youtube-player" />
));

jest.mock("react-youtube", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockYouTube(props),
}));

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeAll(() => {
  (globalThis as Record<string, unknown>).YT = {
    PlayerState: { BUFFERING: 3, PLAYING: 1, PAUSED: 2, ENDED: 0 },
  };
});

beforeEach(() => {
  mockYouTube.mockClear();
  mockFetch.mockReset();
});

const mockChannelData = {
  channel: { title: "Test Channel", thumbnail: "https://thumb.jpg" },
  videos: [
    { videoId: "vid1", title: "Video One", publishedAt: "2026-03-01T00:00:00Z", duration: "PT5M", type: "video" },
    { videoId: "vid2", title: "Video Two", publishedAt: "2026-02-28T00:00:00Z", duration: "PT10M", type: "video" },
  ],
  shorts: [
    { videoId: "short1", title: "Short One", publishedAt: "2026-03-01T00:00:00Z", duration: "PT30S", type: "short" },
  ],
  playlists: [],
};

describe("Home page", () => {
  it("renders title and channel input", () => {
    render(<Home />);
    expect(screen.getByText("Storion")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Paste a YouTube channel URL or @handle")).toBeInTheDocument();
  });

  it("does not render player or sidebar initially", () => {
    render(<Home />);
    expect(screen.queryByTestId("youtube-player")).not.toBeInTheDocument();
  });

  it("fetches and displays channel data on submit", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockChannelData,
    });

    render(<Home />);
    await user.type(screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"), "@TestChannel");
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(await screen.findByText("Test Channel")).toBeInTheDocument();
    expect(screen.getByText("Video One")).toBeInTheDocument();
    expect(screen.getByTestId("youtube-player")).toBeInTheDocument();
  });

  it("shows error on fetch failure", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Channel not found" }),
    });

    render(<Home />);
    await user.type(screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"), "@BadChannel");
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(await screen.findByText("Channel not found")).toBeInTheDocument();
  });

  it("advances to next video on ended", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockChannelData,
    });

    render(<Home />);
    await user.type(screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"), "@TestChannel");
    await user.click(screen.getByRole("button", { name: "Load" }));

    await screen.findByText("Test Channel");

    // Simulate video ended
    const calls = mockYouTube.mock.calls;
    const lastProps = calls[calls.length - 1]![0] as Record<string, unknown>;
    const onStateChange = lastProps.onStateChange as (event: { data: number }) => void;
    act(() => {
      onStateChange({ data: 0 }); // ENDED
    });

    // Should now show progress as "2 / 3"
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("shows progress indicator", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockChannelData,
    });

    render(<Home />);
    await user.type(screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"), "@TestChannel");
    await user.click(screen.getByRole("button", { name: "Load" }));

    await screen.findByText("Test Channel");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("navigates with prev/next buttons", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockChannelData,
    });

    render(<Home />);
    await user.type(screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"), "@TestChannel");
    await user.click(screen.getByRole("button", { name: "Load" }));

    await screen.findByText("Test Channel");

    // Click Next
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    // Click Prev
    await user.click(screen.getByRole("button", { name: "Prev" }));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("disables Prev on first video", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockChannelData,
    });

    render(<Home />);
    await user.type(screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"), "@TestChannel");
    await user.click(screen.getByRole("button", { name: "Load" }));

    await screen.findByText("Test Channel");
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
  });

  it("disables Next on last video", async () => {
    const user = userEvent.setup();
    const singleVideoData = {
      ...mockChannelData,
      videos: [mockChannelData.videos[0]],
      shorts: [],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => singleVideoData,
    });

    render(<Home />);
    await user.type(screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"), "@TestChannel");
    await user.click(screen.getByRole("button", { name: "Load" }));

    await screen.findByText("Test Channel");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/page.test.tsx -v`
Expected: FAIL — page still renders old VideoInput

**Step 3: Rewrite `page.tsx`**

```typescript
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
```

**Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/page.test.tsx -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/app/page.tsx src/__tests__/page.test.tsx
git commit -m "feat: rewrite page with channel playback, sidebar, and queue"
```

---

### Task 9: Update `.env.example`, README, and jest config

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `jest.config.ts` (exclude API route from coverage if it's tested via integration)

**Step 1: Update `.env.example`**

Add to `.env.example`:

```
NEXT_TELEMETRY_DISABLED=1
YOUTUBE_API_KEY=your_youtube_data_api_v3_key_here
```

**Step 2: Update `README.md`**

Replace the README with updated content covering:
- New channel-based usage (paste a channel URL, not a video URL)
- YouTube Data API key setup instructions (Google Cloud Console steps)
- Supported channel URL formats (`@handle`, `youtube.com/@handle`, `youtube.com/channel/UCxxx`)
- How auto-play and queue navigation work

**Step 3: Run full test suite**

Run: `npx jest --coverage`
Expected: ALL PASS, 100% coverage

If coverage is below 100%, identify uncovered lines and add targeted tests.

**Step 4: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: No errors

**Step 5: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add .env.example README.md jest.config.ts
git commit -m "docs: update README and env example for channel player"
```

---

### Task 10: Remove old `VideoInput` component

**Files:**
- Delete: `src/components/VideoInput.tsx`
- Delete: `src/__tests__/VideoInput.test.tsx`

**Step 1: Verify `VideoInput` is not imported anywhere**

Run: `grep -r "VideoInput" src/ --include="*.tsx" --include="*.ts"`
Expected: Only hits in `VideoInput.tsx` and `VideoInput.test.tsx` (page.tsx should now import `ChannelInput`)

**Step 2: Delete the files**

```bash
rm src/components/VideoInput.tsx src/__tests__/VideoInput.test.tsx
```

**Step 3: Run tests to verify nothing broke**

Run: `npx jest --coverage`
Expected: ALL PASS, 100% coverage

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove old VideoInput component"
```

---

### Task 11: Final verification and push

**Step 1: Run the full check suite**

Run: `npm run lint && npm run typecheck && npx jest --coverage && npm run build`
Expected: All pass, 100% coverage, build succeeds

**Step 2: Push**

```bash
git push
```
