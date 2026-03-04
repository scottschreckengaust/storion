import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VideoInput from "@/components/VideoInput";

describe("VideoInput", () => {
  it("renders input and button", () => {
    render(<VideoInput onVideoId={jest.fn()} />);
    expect(screen.getByPlaceholderText("Paste a YouTube URL or video ID")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load" })).toBeInTheDocument();
  });

  it("calls onVideoId with valid video ID on submit", async () => {
    const user = userEvent.setup();
    const onVideoId = jest.fn();
    render(<VideoInput onVideoId={onVideoId} />);

    await user.type(screen.getByPlaceholderText("Paste a YouTube URL or video ID"), "dQw4w9WgXcQ");
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(onVideoId).toHaveBeenCalledWith("dQw4w9WgXcQ");
  });

  it("calls onVideoId with ID extracted from URL", async () => {
    const user = userEvent.setup();
    const onVideoId = jest.fn();
    render(<VideoInput onVideoId={onVideoId} />);

    await user.type(
      screen.getByPlaceholderText("Paste a YouTube URL or video ID"),
      "https://youtu.be/YQpC2ivIT6Q"
    );
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(onVideoId).toHaveBeenCalledWith("YQpC2ivIT6Q");
  });

  it("shows error for invalid input", async () => {
    const user = userEvent.setup();
    const onVideoId = jest.fn();
    render(<VideoInput onVideoId={onVideoId} />);

    await user.type(screen.getByPlaceholderText("Paste a YouTube URL or video ID"), "invalid");
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(onVideoId).not.toHaveBeenCalled();
    expect(screen.getByText("Invalid YouTube URL or video ID.")).toBeInTheDocument();
  });

  it("clears error when valid input is submitted after invalid", async () => {
    const user = userEvent.setup();
    const onVideoId = jest.fn();
    render(<VideoInput onVideoId={onVideoId} />);

    const input = screen.getByPlaceholderText("Paste a YouTube URL or video ID");

    await user.type(input, "invalid");
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(screen.getByText("Invalid YouTube URL or video ID.")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "dQw4w9WgXcQ");
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(screen.queryByText("Invalid YouTube URL or video ID.")).not.toBeInTheDocument();
  });
});
