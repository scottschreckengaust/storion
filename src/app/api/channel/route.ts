import { NextResponse } from "next/server";
import { extractChannelIdentifier } from "@/lib/youtube";
import { fetchChannelData } from "@/lib/youtube-api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Missing channel URL or handle" },
      { status: 400 }
    );
  }

  const identifier = extractChannelIdentifier(query);
  if (!identifier) {
    return NextResponse.json(
      { error: "Invalid channel URL or handle" },
      { status: 400 }
    );
  }

  try {
    const data = await fetchChannelData(identifier);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Channel not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
