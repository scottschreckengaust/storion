# Channel-Based Sequential Video Player Design

## Overview

Extend Storion from a single-video player to a channel-based player that fetches and sequentially plays a YouTube channel's recent videos, shorts, and playlist contents from the last ~7 days.

## Data Flow & API Architecture

### Input
User enters a YouTube channel URL (e.g., `youtube.com/@The_Dolmans`, `youtube.com/channel/UC...`) or a bare `@handle`.

### Server-Side API Route (`/api/channel/route.ts`)
1. Receive channel handle or ID
2. Resolve handle → channel ID via `channels.list(forHandle)` (1 API unit, avoids 100-unit search)
3. Fetch "uploads" playlist ID from `channels.list(contentDetails)`
4. Fetch recent uploads via `playlistItems.list` — filter to ~last 7 days, fallback to most recent 20
5. Fetch channel playlists via `playlists.list`, expand each via `playlistItems.list`
6. Categorize as "video" or "short" by duration (shorts <= 60s) via `videos.list(contentDetails)`
7. Return structured JSON:
   ```json
   {
     "channel": { "title": "...", "thumbnail": "..." },
     "videos": [{ "videoId": "...", "title": "...", "publishedAt": "...", "duration": "..." }],
     "shorts": [{ "videoId": "...", "title": "...", "publishedAt": "...", "duration": "..." }],
     "playlists": [{ "title": "...", "items": [{ "videoId": "...", "title": "..." }] }]
   }
   ```

### API Key
Stored in `.env.local` as `YOUTUBE_API_KEY`, accessed only server-side. Setup instructions documented in README and `.env.example`.

### Quota Usage
- `channels.list` = 1 unit
- `playlistItems.list` = 1 unit per page
- `videos.list` = 1 unit per page
- Typical channel load: ~5-10 API units total

## UI Layout

```
+----------------------------------------------------------+
|  Storion                          [channel input] [Load]  |
+------------------------+---------------------------------+
|  SIDEBAR               |  PLAYER                         |
|                        |                                 |
|  > Videos (5)          |  +-------------------------+    |
|    * Video title 1  <--|--| YouTube Player          |    |
|      2 days ago        |  +-------------------------+    |
|    * Video title 2     |                                 |
|                        |  Now playing: Video title 1     |
|  > Shorts (8)          |  [Unmute] [< Prev] [Next >]    |
|    * Short title 1     |  3 / 15 total                   |
|    * Short title 2     |                                 |
|                        |                                 |
|  > Playlist: Vlogs (3) |                                 |
|    * Vlog ep 1         |                                 |
|                        |                                 |
|  > Playlist: Tips (2)  |                                 |
|    * Tip 1             |                                 |
+------------------------+---------------------------------+
```

### Sidebar
- Collapsible sections: Videos, Shorts, each Playlist
- Currently playing item highlighted
- Clicking any item jumps to it

### Player
- Auto-advances when video ends (videos -> shorts -> playlist items)
- Prev/Next buttons for manual navigation
- Progress indicator: "3 / 15 total"
- Mute/Unmute toggle (existing behavior)

### Excluded
- Community posts (not playable)

## Component Architecture

| Component | Role |
|-----------|------|
| `ChannelInput` | Replaces `VideoInput` — accepts channel URLs/handles |
| `YouTubePlayer` | Extended with `onEnded` callback prop |
| `VideoSidebar` | Collapsible sections listing videos, shorts, playlists |
| `page.tsx` | Orchestrates: fetches channel data, holds queue state, manages playback |

### State (`page.tsx`)
```typescript
channelData: ChannelData | null   // API response
queue: VideoItem[]                // flattened ordered list of all playable items
currentIndex: number              // which item is playing
isLoading: boolean
error: string | null
```

### Play Order
Videos (newest first) -> Shorts (newest first) -> Playlist 1 items -> Playlist 2 items -> ...

### Auto-Advance
`YouTubePlayer` fires `onEnded` -> increment `currentIndex` -> `key={queue[currentIndex].videoId}` remounts player.

### New Utility
`extractChannelIdentifier(input: string)` in `lib/youtube.ts` — parses `@handle`, `/channel/UCxxx`, and full URLs.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid channel URL | Inline error in ChannelInput |
| Channel not found (404) | "Channel not found" error state |
| API key missing/invalid | "YouTube API key not configured" error |
| API quota exceeded | "API quota exceeded, try again later" |
| Individual video fails | Skip to next in queue |
| Network error | "Failed to fetch channel data" with retry button |

## Testing Strategy (100% Coverage)

- Unit tests for `extractChannelIdentifier`
- API route tests with mocked YouTube API responses
- Component tests for `ChannelInput`, `VideoSidebar` rendering and interaction
- Auto-advance integration test (onEnded -> next video)
- Error scenario tests for each case above
- Existing `YouTubePlayer` tests updated for `onEnded` prop
