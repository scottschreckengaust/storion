import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import YouTubePlayer from "@/components/YouTubePlayer";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockYouTube = jest.fn((_props: Record<string, unknown>) => (
  <div data-testid="youtube-player" />
));

jest.mock("react-youtube", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockYouTube(props),
}));

const mockPlayer = {
  playVideo: jest.fn(),
  unMute: jest.fn(),
  setVolume: jest.fn(),
  mute: jest.fn(),
};

function getLastProps(): Record<string, unknown> {
  const calls = mockYouTube.mock.calls;
  return calls[calls.length - 1]![0] as unknown as Record<string, unknown>;
}

beforeAll(() => {
  (globalThis as Record<string, unknown>).YT = {
    PlayerState: {
      BUFFERING: 3,
      PLAYING: 1,
      PAUSED: 2,
      ENDED: 0,
    },
  };
});

beforeEach(() => {
  mockYouTube.mockClear();
  jest.clearAllMocks();
});

describe("YouTubePlayer", () => {
  it("renders YouTube component with correct videoId", () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    expect(screen.getByTestId("youtube-player")).toBeInTheDocument();
    expect(getLastProps().videoId).toBe("dQw4w9WgXcQ");
  });

  it("passes correct playerVars for autoplay", () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    const opts = getLastProps().opts as { playerVars: Record<string, number> };
    expect(opts.playerVars.autoplay).toBe(1);
    expect(opts.playerVars.mute).toBe(1);
    expect(opts.playerVars.playsinline).toBe(1);
    expect(opts.playerVars.rel).toBe(0);
  });

  it("shows unstarted state initially", () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    expect(screen.getByText("unstarted")).toBeInTheDocument();
  });

  it("shows Unmute button initially", () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
  });

  it("calls playVideo on ready", () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    const onReady = getLastProps().onReady as (event: { target: typeof mockPlayer }) => void;
    act(() => {
      onReady({ target: mockPlayer });
    });
    expect(mockPlayer.playVideo).toHaveBeenCalled();
  });

  it("updates state on state change to playing", () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    const onStateChange = getLastProps().onStateChange as (event: { data: number }) => void;
    act(() => {
      onStateChange({ data: 1 });
    });
    expect(screen.getByText("playing")).toBeInTheDocument();
  });

  it("updates state on state change to paused", () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    const onStateChange = getLastProps().onStateChange as (event: { data: number }) => void;
    act(() => {
      onStateChange({ data: 2 });
    });
    expect(screen.getByText("paused")).toBeInTheDocument();
  });

  it("updates state on state change to buffering", () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    const onStateChange = getLastProps().onStateChange as (event: { data: number }) => void;
    act(() => {
      onStateChange({ data: 3 });
    });
    expect(screen.getByText("buffering")).toBeInTheDocument();
  });

  it("updates state on state change to ended", () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    const onStateChange = getLastProps().onStateChange as (event: { data: number }) => void;
    act(() => {
      onStateChange({ data: 0 });
    });
    expect(screen.getByText("ended")).toBeInTheDocument();
  });

  it("updates state to unstarted for -1", () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    const onStateChange = getLastProps().onStateChange as (event: { data: number }) => void;
    act(() => {
      onStateChange({ data: -1 });
    });
    expect(screen.getByText("unstarted")).toBeInTheDocument();
  });

  it("falls back to unstarted for unknown state", () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    const onStateChange = getLastProps().onStateChange as (event: { data: number }) => void;
    act(() => {
      onStateChange({ data: 999 });
    });
    expect(screen.getByText("unstarted")).toBeInTheDocument();
  });

  it("shows error state and message on error", () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    const onError = getLastProps().onError as () => void;
    act(() => {
      onError();
    });
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.getByText("Failed to load video. Please check the video ID and try again.")).toBeInTheDocument();
  });

  it("unmutes when Unmute button is clicked after player ready", async () => {
    const user = userEvent.setup();
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);

    const onReady = getLastProps().onReady as (event: { target: typeof mockPlayer }) => void;
    act(() => {
      onReady({ target: mockPlayer });
    });

    await user.click(screen.getByRole("button", { name: "Unmute" }));
    expect(mockPlayer.unMute).toHaveBeenCalled();
    expect(mockPlayer.setVolume).toHaveBeenCalledWith(100);
    expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
  });

  it("mutes when Mute button is clicked", async () => {
    const user = userEvent.setup();
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);

    const onReady = getLastProps().onReady as (event: { target: typeof mockPlayer }) => void;
    act(() => {
      onReady({ target: mockPlayer });
    });

    await user.click(screen.getByRole("button", { name: "Unmute" }));
    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(mockPlayer.mute).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
  });

  it("does nothing when Unmute clicked before player ready", async () => {
    const user = userEvent.setup();
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    await user.click(screen.getByRole("button", { name: "Unmute" }));
    expect(mockPlayer.unMute).not.toHaveBeenCalled();
  });

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
});
