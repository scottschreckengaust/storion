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

const emptyChannel: ChannelData = {
  channel: { title: "Empty Channel", thumbnail: "https://thumb.jpg" },
  videos: [],
  shorts: [],
  playlists: [],
};

describe("VideoSidebar", () => {
  it("renders channel title", () => {
    render(
      <VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />
    );
    expect(screen.getByText("Test Channel")).toBeInTheDocument();
  });

  it("renders video section with count", () => {
    render(
      <VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />
    );
    expect(screen.getByText("Videos (2)")).toBeInTheDocument();
  });

  it("renders shorts section with count", () => {
    render(
      <VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />
    );
    expect(screen.getByText("Shorts (1)")).toBeInTheDocument();
  });

  it("renders playlist section with title and count", () => {
    render(
      <VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />
    );
    expect(screen.getByText("My Playlist (1)")).toBeInTheDocument();
  });

  it("highlights currently playing video", () => {
    render(
      <VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />
    );
    const videoOneText = screen.getByText("Video One");
    const button = videoOneText.closest("button");
    expect(button?.className).toContain("bg-zinc-200");
  });

  it("does not highlight non-playing videos", () => {
    render(
      <VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />
    );
    const videoTwoText = screen.getByText("Video Two");
    const button = videoTwoText.closest("button");
    expect(button?.className).not.toContain("bg-zinc-200");
  });

  it("calls onSelect when clicking a video", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(
      <VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={onSelect} />
    );
    await user.click(screen.getByText("Video Two"));
    expect(onSelect).toHaveBeenCalledWith("vid2");
  });

  it("toggles section collapse on click", async () => {
    const user = userEvent.setup();
    render(
      <VideoSidebar channelData={mockChannel} currentVideoId="vid1" onSelect={jest.fn()} />
    );
    // Videos section is open by default, so items should be visible
    const videoOneText = screen.getByText("Video One");
    expect(videoOneText.closest("div[class]")?.className).not.toContain("hidden");

    // Click the Videos section header to collapse it
    await user.click(screen.getByText("Videos (2)"));

    // After collapsing, the container div should have the hidden class
    expect(videoOneText.closest("div.hidden")).toBeTruthy();
  });

  it("renders empty state when no content", () => {
    render(
      <VideoSidebar channelData={emptyChannel} currentVideoId="" onSelect={jest.fn()} />
    );
    expect(screen.getByText("No videos found")).toBeInTheDocument();
  });

  it("shows content when only playlists have items", () => {
    const playlistOnlyData: ChannelData = {
      channel: { title: "Playlist Channel", thumbnail: "" },
      videos: [],
      shorts: [],
      playlists: [{
        title: "Only Playlist",
        playlistId: "PLonly",
        items: [{ videoId: "plvid1", title: "PL Vid", publishedAt: "2026-03-01T00:00:00Z", duration: "PT5M", type: "video" }],
      }],
    };
    render(<VideoSidebar channelData={playlistOnlyData} currentVideoId="" onSelect={jest.fn()} />);
    expect(screen.queryByText("No videos found")).not.toBeInTheDocument();
    expect(screen.getByText("Only Playlist (1)")).toBeInTheDocument();
  });
});
