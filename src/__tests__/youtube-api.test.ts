import { fetchChannelData } from "@/lib/youtube-api";
import type { ChannelIdentifier } from "@/lib/youtube";

// --- helpers to build YouTube API mock responses ---

function makeChannelResponse(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      {
        snippet: {
          title: "Test Channel",
          thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
        },
        contentDetails: {
          relatedPlaylists: { uploads: "UU_uploads_id" },
        },
        ...overrides,
      },
    ],
  };
}

function makePlaylistItemsResponse(
  videoIds: string[],
  publishedAts?: string[]
) {
  const now = new Date();
  return {
    items: videoIds.map((id, i) => ({
      contentDetails: {
        videoId: id,
        videoPublishedAt:
          publishedAts?.[i] ??
          new Date(now.getTime() - i * 3600_000).toISOString(),
      },
    })),
  };
}

function makeVideosResponse(
  entries: { id: string; duration: string; title?: string }[]
) {
  return {
    items: entries.map((e) => ({
      id: e.id,
      snippet: { title: e.title ?? `Title ${e.id}` },
      contentDetails: { duration: e.duration },
    })),
  };
}

function makePlaylistsResponse(
  playlists: { id: string; title: string }[] = []
) {
  return {
    items: playlists.map((p) => ({
      id: p.id,
      snippet: { title: p.title },
    })),
  };
}

function makePlaylistVideosResponse(
  videoIds: string[],
  publishedAts?: string[]
) {
  const now = new Date();
  return {
    items: videoIds.map((id, i) => ({
      contentDetails: {
        videoId: id,
        videoPublishedAt:
          publishedAts?.[i] ??
          new Date(now.getTime() - i * 3600_000).toISOString(),
      },
    })),
  };
}

// --- tests ---

describe("fetchChannelData", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test-api-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.YOUTUBE_API_KEY;
  });

  // ---------- helper to build ordered fetch mock ----------
  function mockFetchSequence(responses: unknown[]) {
    let callIndex = 0;
    global.fetch = jest.fn((() => {
      const body = responses[callIndex++];
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(body),
      });
    }) as unknown as typeof fetch);
  }

  // ---------- 1. Fetches channel data by handle ----------
  it("fetches channel data by handle (uses forHandle param)", async () => {
    mockFetchSequence([
      // 1 - channel lookup
      makeChannelResponse(),
      // 2 - uploads playlist items
      makePlaylistItemsResponse(["v1", "v2"]),
      // 3 - video details
      makeVideosResponse([
        { id: "v1", duration: "PT5M30S" },
        { id: "v2", duration: "PT30S" },
      ]),
      // 4 - playlists list
      makePlaylistsResponse([]),
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    // Verify the first fetch used forHandle
    const firstCallUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(firstCallUrl).toContain("forHandle=TestHandle");
    expect(firstCallUrl).not.toContain("id=");

    expect(result.channel.title).toBe("Test Channel");
    expect(result.channel.thumbnail).toBe("https://example.com/thumb.jpg");
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].videoId).toBe("v1");
    expect(result.videos[0].type).toBe("video");
    expect(result.shorts).toHaveLength(1);
    expect(result.shorts[0].videoId).toBe("v2");
    expect(result.shorts[0].type).toBe("short");
  });

  // ---------- 2. Fetches channel data by ID ----------
  it("fetches channel data by ID (uses id param)", async () => {
    mockFetchSequence([
      makeChannelResponse(),
      makePlaylistItemsResponse(["v1"]),
      makeVideosResponse([{ id: "v1", duration: "PT1H2M3S" }]),
      makePlaylistsResponse([]),
    ]);

    const id: ChannelIdentifier = { type: "id", value: "UCabc123" };
    const result = await fetchChannelData(id);

    const firstCallUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(firstCallUrl).toContain("id=UCabc123");
    expect(firstCallUrl).not.toContain("forHandle=");

    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].duration).toBe("PT1H2M3S");
    expect(result.videos[0].type).toBe("video");
    expect(result.shorts).toHaveLength(0);
  });

  // ---------- 3. Throws when API key is missing ----------
  it("throws when API key is missing", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    await expect(fetchChannelData(id)).rejects.toThrow(
      "YouTube API key not configured"
    );
  });

  // ---------- 4. Throws when channel not found ----------
  it("throws when channel not found (empty items)", async () => {
    mockFetchSequence([{ items: [] }]);

    const id: ChannelIdentifier = { type: "handle", value: "NoSuchChannel" };
    await expect(fetchChannelData(id)).rejects.toThrow("Channel not found");
  });

  // ---------- 5. Throws on API error response ----------
  it("throws on API error response", async () => {
    global.fetch = jest.fn((() =>
      Promise.resolve({
        ok: false,
        json: () =>
          Promise.resolve({
            error: { message: "quotaExceeded" },
          }),
      })) as unknown as typeof fetch);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    await expect(fetchChannelData(id)).rejects.toThrow(
      "YouTube API error: quotaExceeded"
    );
  });

  // ---------- 6. Handles channel with no playlists ----------
  it("handles channel with no playlists", async () => {
    mockFetchSequence([
      makeChannelResponse(),
      makePlaylistItemsResponse(["v1"]),
      makeVideosResponse([{ id: "v1", duration: "PT10M" }]),
      makePlaylistsResponse([]), // empty playlists
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    expect(result.playlists).toEqual([]);
    expect(result.videos).toHaveLength(1);
  });

  // ---------- 7. Handles channel with no recent uploads ----------
  it("handles channel with no recent uploads (empty items)", async () => {
    mockFetchSequence([
      makeChannelResponse(),
      // uploads returns empty
      { items: [] },
      // playlists
      makePlaylistsResponse([]),
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    // No videos fetched -> no duration call
    expect(result.videos).toEqual([]);
    expect(result.shorts).toEqual([]);
    // fetch was called 3 times: channel, uploads, playlists (no videos/details call)
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  // ---------- 8. Filters uploads older than 7 days, falls back to max 20 ----------
  it("filters uploads older than 7 days, falls back to max 20", async () => {
    const now = new Date();
    const daysAgo = (n: number) =>
      new Date(now.getTime() - n * 86_400_000).toISOString();

    // 25 videos, all older than 7 days
    const videoIds = Array.from({ length: 25 }, (_, i) => `old${i}`);
    const publishedAts = videoIds.map((_, i) => daysAgo(10 + i));

    mockFetchSequence([
      makeChannelResponse(),
      makePlaylistItemsResponse(videoIds, publishedAts),
      // video details for the first 20 (fallback)
      makeVideosResponse(
        videoIds.slice(0, 20).map((id) => ({ id, duration: "PT3M" }))
      ),
      makePlaylistsResponse([]),
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    // Should have exactly 20 videos (fallback cap)
    expect(result.videos.length + result.shorts.length).toBe(20);
  });

  // ---------- 9. Playlists are expanded ----------
  it("expands playlists with their video items", async () => {
    mockFetchSequence([
      makeChannelResponse(),
      makePlaylistItemsResponse(["v1"]),
      makeVideosResponse([{ id: "v1", duration: "PT2M" }]),
      // playlists list
      makePlaylistsResponse([
        { id: "PLabc", title: "My Playlist" },
      ]),
      // playlist items for PLabc
      makePlaylistVideosResponse(["pv1", "pv2"]),
      // video details for playlist videos
      makeVideosResponse([
        { id: "pv1", duration: "PT45S", title: "Pl Vid 1" },
        { id: "pv2", duration: "PT10M", title: "Pl Vid 2" },
      ]),
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    expect(result.playlists).toHaveLength(1);
    expect(result.playlists[0].title).toBe("My Playlist");
    expect(result.playlists[0].playlistId).toBe("PLabc");
    expect(result.playlists[0].items).toHaveLength(2);
    expect(result.playlists[0].items[0].type).toBe("short"); // 45s
    expect(result.playlists[0].items[1].type).toBe("video"); // 10m
  });

  // ---------- 10. Empty playlist (no items) ----------
  it("handles empty playlist with no video items", async () => {
    mockFetchSequence([
      makeChannelResponse(),
      makePlaylistItemsResponse(["v1"]),
      makeVideosResponse([{ id: "v1", duration: "PT2M" }]),
      // playlists list — one playlist returned
      makePlaylistsResponse([
        { id: "PL_empty", title: "Empty Playlist" },
      ]),
      // playlist items for PL_empty — returns empty items
      { items: [] },
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    expect(result.playlists).toHaveLength(1);
    expect(result.playlists[0].title).toBe("Empty Playlist");
    expect(result.playlists[0].playlistId).toBe("PL_empty");
    expect(result.playlists[0].items).toHaveLength(0);
  });

  // ---------- 11. API error without message field ----------
  it("throws with 'Unknown error' when API error has no message", async () => {
    global.fetch = jest.fn((() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: {} }),
      })) as unknown as typeof fetch);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    await expect(fetchChannelData(id)).rejects.toThrow(
      "YouTube API error: Unknown error"
    );
  });

  // ---------- 11b. API error with no error object at all ----------
  it("throws with 'Unknown error' when API response has no error field", async () => {
    global.fetch = jest.fn((() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
      })) as unknown as typeof fetch);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    await expect(fetchChannelData(id)).rejects.toThrow(
      "YouTube API error: Unknown error"
    );
  });

  // ---------- 12. Video with unparseable duration ----------
  it("treats unparseable duration as 0 seconds (short)", async () => {
    mockFetchSequence([
      makeChannelResponse(),
      makePlaylistItemsResponse(["v1"]),
      makeVideosResponse([{ id: "v1", duration: "INVALID" }]),
      makePlaylistsResponse([]),
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    // 0 seconds is <=60, so classified as "short"
    expect(result.shorts).toHaveLength(1);
    expect(result.shorts[0].videoId).toBe("v1");
    expect(result.videos).toHaveLength(0);
  });

  // ---------- 13. Uploads response with null items ----------
  it("handles uploads response with missing items field", async () => {
    mockFetchSequence([
      makeChannelResponse(),
      // uploads response without items field
      {},
      // playlists
      makePlaylistsResponse([]),
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    expect(result.videos).toEqual([]);
    expect(result.shorts).toEqual([]);
  });

  // ---------- 14. Video detail with no matching upload item ----------
  it("handles video detail with no matching upload item", async () => {
    mockFetchSequence([
      makeChannelResponse(),
      makePlaylistItemsResponse(["v1"]),
      // Video details returns a video with a different ID than the upload
      makeVideosResponse([{ id: "v_different", duration: "PT5M", title: "Mismatched" }]),
      makePlaylistsResponse([]),
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    // The video should still be included, with empty publishedAt
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].publishedAt).toBe("");
  });

  // ---------- 15. Playlists response with null items ----------
  it("handles playlists response with missing items field", async () => {
    mockFetchSequence([
      makeChannelResponse(),
      makePlaylistItemsResponse(["v1"]),
      makeVideosResponse([{ id: "v1", duration: "PT10M" }]),
      // playlists with no items field
      {},
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    expect(result.playlists).toEqual([]);
  });

  // ---------- 16. Playlist items response with null items ----------
  it("handles playlist items response with missing items field", async () => {
    mockFetchSequence([
      makeChannelResponse(),
      makePlaylistItemsResponse(["v1"]),
      makeVideosResponse([{ id: "v1", duration: "PT10M" }]),
      makePlaylistsResponse([{ id: "PL1", title: "Test PL" }]),
      // playlist items response without items field
      {},
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    expect(result.playlists).toHaveLength(1);
    expect(result.playlists[0].items).toHaveLength(0);
  });

  // ---------- 17. Playlist video details with null items ----------
  it("handles playlist video details with missing items field", async () => {
    mockFetchSequence([
      makeChannelResponse(),
      makePlaylistItemsResponse(["v1"]),
      makeVideosResponse([{ id: "v1", duration: "PT10M" }]),
      makePlaylistsResponse([{ id: "PL1", title: "Test PL" }]),
      makePlaylistVideosResponse(["pv1"]),
      // playlist video details without items field
      {},
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    expect(result.playlists).toHaveLength(1);
    expect(result.playlists[0].items).toHaveLength(0);
  });

  // ---------- 18. Playlist video with no matching playlist item ----------
  it("handles playlist video with no matching playlist item", async () => {
    mockFetchSequence([
      makeChannelResponse(),
      makePlaylistItemsResponse(["v1"]),
      makeVideosResponse([{ id: "v1", duration: "PT10M" }]),
      makePlaylistsResponse([{ id: "PL1", title: "Test PL" }]),
      makePlaylistVideosResponse(["pv1"]),
      // Video details return a different video ID
      makeVideosResponse([{ id: "pv_different", duration: "PT5M", title: "Mismatched PL Vid" }]),
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    expect(result.playlists).toHaveLength(1);
    expect(result.playlists[0].items).toHaveLength(1);
    expect(result.playlists[0].items[0].publishedAt).toBe("");
  });

  // ---------- 19. Channel with empty title (channelId fallback) ----------
  it("falls back to identifier value when channel title is empty", async () => {
    mockFetchSequence([
      makeChannelResponse({
        snippet: {
          title: "",
          thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
        },
      }),
      makePlaylistItemsResponse(["v1"]),
      makeVideosResponse([{ id: "v1", duration: "PT10M" }]),
      makePlaylistsResponse([]),
    ]);

    const id: ChannelIdentifier = { type: "handle", value: "TestHandle" };
    const result = await fetchChannelData(id);

    // Should still work; channelId derived from identifier.value as fallback
    expect(result.channel.title).toBe("");
    expect(result.videos).toHaveLength(1);

    // Check the playlists API was called with the fallback channelId
    const playlistsCall = (global.fetch as jest.Mock).mock.calls[3][0] as string;
    expect(playlistsCall).toContain("channelId=TestHandle");
  });
});
