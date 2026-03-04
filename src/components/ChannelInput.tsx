"use client";

import { useState, useCallback } from "react";
import { extractChannelIdentifier } from "@/lib/youtube";

interface ChannelInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

export default function ChannelInput({ onSubmit, isLoading }: ChannelInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const identifier = extractChannelIdentifier(url);
      if (identifier) {
        setError("");
        onSubmit(url);
      } else {
        setError("Invalid YouTube channel URL or handle.");
      }
    },
    [url, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-5xl">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube channel URL or @handle"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-zinc-900 px-6 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isLoading ? "Loading..." : "Load"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </form>
  );
}
