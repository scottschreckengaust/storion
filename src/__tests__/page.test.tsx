import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";

jest.mock("react-youtube", () => {
  const MockYouTube = (props: { videoId: string }) => (
    <div data-testid="youtube-player" data-video-id={props.videoId} />
  );
  MockYouTube.displayName = "YouTube";
  return { __esModule: true, default: MockYouTube };
});

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

describe("Home page", () => {
  it("renders title and input", () => {
    render(<Home />);
    expect(screen.getByText("Storion")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Paste a YouTube URL or video ID")).toBeInTheDocument();
  });

  it("does not render player initially", () => {
    render(<Home />);
    expect(screen.queryByTestId("youtube-player")).not.toBeInTheDocument();
  });

  it("renders player after submitting a valid video ID", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(
      screen.getByPlaceholderText("Paste a YouTube URL or video ID"),
      "dQw4w9WgXcQ"
    );
    await user.click(screen.getByRole("button", { name: "Load" }));

    const player = screen.getByTestId("youtube-player");
    expect(player).toBeInTheDocument();
    expect(player).toHaveAttribute("data-video-id", "dQw4w9WgXcQ");
  });
});
