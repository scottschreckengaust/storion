import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChannelInput from "@/components/ChannelInput";

describe("ChannelInput", () => {
  it("renders input and button", () => {
    render(<ChannelInput onSubmit={jest.fn()} isLoading={false} />);
    expect(
      screen.getByPlaceholderText("Paste a YouTube channel URL or @handle")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load" })).toBeInTheDocument();
  });

  it("calls onSubmit with channel input on valid submit", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<ChannelInput onSubmit={onSubmit} isLoading={false} />);

    await user.type(
      screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"),
      "@MrBeast"
    );
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(onSubmit).toHaveBeenCalledWith("@MrBeast");
  });

  it("shows error for invalid input", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<ChannelInput onSubmit={onSubmit} isLoading={false} />);

    await user.type(
      screen.getByPlaceholderText("Paste a YouTube channel URL or @handle"),
      "not a channel"
    );
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText("Invalid YouTube channel URL or handle.")
    ).toBeInTheDocument();
  });

  it("clears error on valid resubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<ChannelInput onSubmit={onSubmit} isLoading={false} />);

    const input = screen.getByPlaceholderText(
      "Paste a YouTube channel URL or @handle"
    );

    await user.type(input, "not a channel");
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(
      screen.getByText("Invalid YouTube channel URL or handle.")
    ).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "@MrBeast");
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(
      screen.queryByText("Invalid YouTube channel URL or handle.")
    ).not.toBeInTheDocument();
  });

  it("disables button and shows loading text when isLoading", () => {
    render(<ChannelInput onSubmit={jest.fn()} isLoading={true} />);
    const button = screen.getByRole("button", { name: "Loading..." });
    expect(button).toBeDisabled();
  });
});
