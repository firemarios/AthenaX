"use client";

import { API_BASE } from "@athenax/api-client";

export type StreamHandler = (event: string, payload: Record<string, unknown>) => void;

/** POST a JSON body and consume the SSE response (fetch + ReadableStream). */
export async function postStream(
  path: string,
  body: unknown,
  onEvent: StreamHandler,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });

  if (!res.ok || !res.body) {
    let message = "";
    try {
      const payload = (await res.json()) as {
        error?: { message?: string };
        detail?: string;
      };
      message = payload?.error?.message || payload?.detail || "";
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      let event = "message";
      const data: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trim());
      }
      if (!data.length) continue;
      try {
        onEvent(event, JSON.parse(data.join("\n")) as Record<string, unknown>);
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}
