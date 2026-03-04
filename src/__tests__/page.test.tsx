import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockYouTube = jest.fn((_props: Record<string, unknown>) => (
  <div data-testid="youtube-player" />
));

jest.mock("react-youtube", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockYouTube(props),
}));

const mockFetch = jest.fn();

beforeAll(() => {
  (globalThis as Record<string, unknown>).YT = {
    PlayerState: {
      BUFFERING: 3,
      PLAYING: 1,
      PAUSED: 2,
      ENDED: 0,
    },
  };
  globalThis.fetch = mockFetch as unknown as typeof fetch;
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

async function submitChannel() {
  const user = userEvent.setup();
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockChannelData,
  });

  await user.type(
    screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"),
    "@TestChannel"
  );
  await user.click(screen.getByRole("button", { name: "Load" }));

  await screen.findByText("Test Channel");
}

describe("Home page", () => {
  it("renders title and channel input", () => {
    render(<Home />);
    expect(screen.getByText("Storion")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Paste a YouTube channel URL or @handle")
    ).toBeInTheDocument();
  });

  it("does not render player or sidebar initially", () => {
    render(<Home />);
    expect(screen.queryByTestId("youtube-player")).not.toBeInTheDocument();
    expect(screen.queryByText("Test Channel")).not.toBeInTheDocument();
  });

  it("fetches and displays channel data on submit", async () => {
    render(<Home />);
    await submitChannel();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/channel?q=%40TestChannel"
    );
    expect(screen.getByText("Test Channel")).toBeInTheDocument();
    expect(screen.getByTestId("youtube-player")).toBeInTheDocument();
    expect(screen.getByText("Video One")).toBeInTheDocument();
    expect(screen.getByText("Video Two")).toBeInTheDocument();
  });

  it("shows error on fetch failure", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Channel not found" }),
    });

    render(<Home />);

    await user.type(
      screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"),
      "@BadChannel"
    );
    await user.click(screen.getByRole("button", { name: "Load" }));

    await screen.findByText("Channel not found");
    expect(screen.queryByTestId("youtube-player")).not.toBeInTheDocument();
  });

  it("advances to next video on ended", async () => {
    render(<Home />);
    await submitChannel();

    // First video should be playing — vid1
    const firstProps = mockYouTube.mock.calls[mockYouTube.mock.calls.length - 1]![0] as Record<string, unknown>;
    expect(firstProps.videoId).toBe("vid1");

    // Simulate video ended (YT.PlayerState.ENDED = 0)
    const onStateChange = firstProps.onStateChange as (event: { data: number }) => void;
    act(() => {
      onStateChange({ data: 0 });
    });

    // Should now show vid2
    const nextProps = mockYouTube.mock.calls[mockYouTube.mock.calls.length - 1]![0] as Record<string, unknown>;
    expect(nextProps.videoId).toBe("vid2");
  });

  it("shows progress indicator", async () => {
    render(<Home />);
    await submitChannel();

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("navigates with prev/next buttons", async () => {
    const user = userEvent.setup();
    render(<Home />);
    await submitChannel();

    // Initially on vid1: "1 / 3"
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    // Click Next
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    // Click Prev
    await user.click(screen.getByRole("button", { name: "Prev" }));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("disables Prev on first video and Next on last video", async () => {
    const user = userEvent.setup();
    render(<Home />);
    await submitChannel();

    // Prev should be disabled on first video
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();

    // Navigate to last video (index 2, which is short1)
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Prev" })).not.toBeDisabled();
  });

  it("shows error on network failure", async () => {
    const user = userEvent.setup();
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<Home />);
    await user.type(
      screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"),
      "@TestChannel"
    );
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(await screen.findByText("Failed to fetch channel data")).toBeInTheDocument();
  });

  it("shows fallback error when API returns no error field", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    render(<Home />);
    await user.type(
      screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"),
      "@TestChannel"
    );
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(await screen.findByText("Failed to fetch channel data")).toBeInTheDocument();
  });

  it("includes playlist items in the queue", async () => {
    const user = userEvent.setup();
    const dataWithPlaylist = {
      ...mockChannelData,
      playlists: [{
        title: "My Playlist",
        playlistId: "PLtest1",
        items: [{ videoId: "plvid1", title: "Playlist Vid", publishedAt: "2026-03-01T00:00:00Z", duration: "PT8M", type: "video" }],
      }],
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => dataWithPlaylist });

    render(<Home />);
    await user.type(
      screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"),
      "@TestChannel"
    );
    await user.click(screen.getByRole("button", { name: "Load" }));

    await screen.findByText("Test Channel");
    // Queue should be: vid1, vid2, short1, plvid1 = 4 total
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("handles channel data with empty queue", async () => {
    const user = userEvent.setup();
    const emptyData = {
      channel: { title: "Empty Channel", thumbnail: "https://thumb.jpg" },
      videos: [],
      shorts: [],
      playlists: [],
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => emptyData });

    render(<Home />);
    await user.type(
      screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"),
      "@EmptyChannel"
    );
    await user.click(screen.getByRole("button", { name: "Load" }));

    await screen.findByText("Empty Channel");
    // No player should be rendered since there are no videos
    expect(screen.queryByTestId("youtube-player")).not.toBeInTheDocument();
  });

  it("jumps to video when sidebar item is clicked", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockChannelData });

    render(<Home />);
    await user.type(
      screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"),
      "@TestChannel"
    );
    await user.click(screen.getByRole("button", { name: "Load" }));

    await screen.findByText("Test Channel");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    // Click "Short One" in sidebar (index 2 in queue: vid1, vid2, short1)
    await user.click(screen.getByText("Short One"));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });
});
