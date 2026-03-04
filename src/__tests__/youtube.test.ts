import { extractVideoId, extractChannelIdentifier } from "@/lib/youtube";

describe("extractVideoId", () => {
  describe("standard YouTube URLs", () => {
    it("extracts ID from youtube.com/watch?v= URL", () => {
      expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from youtube.com/watch?v= with extra params", () => {
      expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from youtube.com without www", () => {
      expect(extractVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from http URL", () => {
      expect(extractVideoId("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });
  });

  describe("short URLs", () => {
    it("extracts ID from youtu.be URL", () => {
      expect(extractVideoId("https://youtu.be/YQpC2ivIT6Q")).toBe("YQpC2ivIT6Q");
    });

    it("extracts ID from youtu.be with params", () => {
      expect(extractVideoId("https://youtu.be/YQpC2ivIT6Q?t=30")).toBe("YQpC2ivIT6Q");
    });
  });

  describe("embed URLs", () => {
    it("extracts ID from youtube.com/embed/ URL", () => {
      expect(extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });
  });

  describe("shorts URLs", () => {
    it("extracts ID from youtube.com/shorts/ URL", () => {
      expect(extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from shorts URL without www", () => {
      expect(extractVideoId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });
  });

  describe("plain video IDs", () => {
    it("accepts a valid 11-character video ID", () => {
      expect(extractVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("accepts ID with underscores and hyphens", () => {
      expect(extractVideoId("abc_def-ghi")).toBe("abc_def-ghi");
    });
  });

  describe("invalid inputs", () => {
    it("returns null for empty string", () => {
      expect(extractVideoId("")).toBeNull();
    });

    it("returns null for whitespace only", () => {
      expect(extractVideoId("   ")).toBeNull();
    });

    it("returns null for too-short string", () => {
      expect(extractVideoId("abc")).toBeNull();
    });

    it("returns null for too-long string", () => {
      expect(extractVideoId("dQw4w9WgXcQx")).toBeNull();
    });

    it("returns null for string with invalid characters", () => {
      expect(extractVideoId("dQw4w9WgXc!")).toBeNull();
    });

    it("returns null for random URL", () => {
      expect(extractVideoId("https://example.com/video")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("trims leading/trailing whitespace", () => {
      expect(extractVideoId("  dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
    });

    it("trims whitespace from URLs", () => {
      expect(extractVideoId("  https://youtu.be/YQpC2ivIT6Q  ")).toBe("YQpC2ivIT6Q");
    });
  });
});

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
