export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export interface ChannelIdentifier {
  type: "handle" | "id";
  value: string;
}

export function extractChannelIdentifier(input: string): ChannelIdentifier | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Full URL: youtube.com/@handle
  const handleUrlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([a-zA-Z0-9_.-]+)/
  );
  if (handleUrlMatch) return { type: "handle", value: handleUrlMatch[1] };

  // Bare @handle
  const bareHandleMatch = trimmed.match(/^@([a-zA-Z0-9_.-]+)$/);
  if (bareHandleMatch) return { type: "handle", value: bareHandleMatch[1] };

  // Full URL: youtube.com/channel/UCxxx
  const channelUrlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/
  );
  if (channelUrlMatch) return { type: "id", value: channelUrlMatch[1] };

  // Bare channel ID starting with UC
  const bareIdMatch = trimmed.match(/^(UC[a-zA-Z0-9_-]+)$/);
  if (bareIdMatch) return { type: "id", value: bareIdMatch[1] };

  return null;
}
