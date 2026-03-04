/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock next/server before any imports that depend on it.
// In the jsdom test environment, the native Response constructor may not
// be available, so we provide a lightweight stand-in.
jest.mock("next/server", () => ({
  NextResponse: {
    json(body: unknown, init?: { status?: number }) {
      const status = init?.status ?? 200;
      return {
        status,
        json: () => Promise.resolve(body),
      };
    },
  },
}));

jest.mock("@/lib/youtube-api");

import { GET } from "@/app/api/channel/route";
import { fetchChannelData } from "@/lib/youtube-api";
import type { ChannelData } from "@/lib/types";

const mockFetchChannelData = fetchChannelData as jest.MockedFunction<
  typeof fetchChannelData
>;

/**
 * Create a minimal Request-like object. The GET handler only reads
 * `request.url`, so a plain object with a `url` property suffices.
 */
function makeRequest(url: string): Request {
  return { url } as unknown as Request;
}

const sampleChannelData: ChannelData = {
  channel: {
    title: "The Dolmans",
    thumbnail: "https://example.com/thumb.jpg",
  },
  videos: [
    {
      videoId: "v1",
      title: "Video One",
      publishedAt: "2025-01-01T00:00:00Z",
      duration: "PT5M30S",
      type: "video",
    },
  ],
  shorts: [
    {
      videoId: "s1",
      title: "Short One",
      publishedAt: "2025-01-02T00:00:00Z",
      duration: "PT30S",
      type: "short",
    },
  ],
  playlists: [],
};

describe("GET /api/channel", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // 1. Returns channel data for valid handle (200)
  it("returns channel data for a valid handle", async () => {
    mockFetchChannelData.mockResolvedValue(sampleChannelData);

    const req = makeRequest("http://localhost:3000/api/channel?q=@The_Dolmans");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.channel.title).toBe("The Dolmans");
    expect(body.videos).toHaveLength(1);
    expect(body.shorts).toHaveLength(1);
    expect(mockFetchChannelData).toHaveBeenCalledWith({
      type: "handle",
      value: "The_Dolmans",
    });
  });

  // 2. Returns 400 for missing query parameter
  it("returns 400 when q parameter is missing", async () => {
    const req = makeRequest("http://localhost:3000/api/channel");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Missing channel URL or handle");
  });

  // 3. Returns 400 for invalid channel identifier
  it("returns 400 for invalid channel identifier", async () => {
    const req = makeRequest(
      "http://localhost:3000/api/channel?q=not-a-valid-channel"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid channel URL or handle");
  });

  // 4. Returns 404 when channel not found
  it("returns 404 when channel is not found", async () => {
    mockFetchChannelData.mockRejectedValue(new Error("Channel not found"));

    const req = makeRequest(
      "http://localhost:3000/api/channel?q=@NonExistentChannel"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Channel not found");
  });

  // 5. Returns 500 for API key errors
  it("returns 500 for API key errors", async () => {
    mockFetchChannelData.mockRejectedValue(
      new Error("YouTube API key not configured")
    );

    const req = makeRequest("http://localhost:3000/api/channel?q=@SomeChannel");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("YouTube API key not configured");
  });

  // 6. Returns 500 for generic errors (quota exceeded)
  it("returns 500 for quota exceeded errors", async () => {
    mockFetchChannelData.mockRejectedValue(
      new Error("YouTube API error: quotaExceeded")
    );

    const req = makeRequest("http://localhost:3000/api/channel?q=@SomeChannel");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("YouTube API error: quotaExceeded");
  });

  // 7. Returns 500 with 'Unknown error' for non-Error throws
  it("returns 500 with 'Unknown error' for non-Error throws", async () => {
    mockFetchChannelData.mockRejectedValueOnce("string error");

    const req = makeRequest("http://localhost:3000/api/channel?q=@TestChannel");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Unknown error");
  });
});
