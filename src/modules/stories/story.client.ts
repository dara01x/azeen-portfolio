"use client";

import { auth } from "@/lib/firebase/client";
import type { Story } from "@/types";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

async function authorizedJsonFetch<TResponse>(
  url: string,
  init: RequestInit = {},
  body?: JsonObject,
): Promise<TResponse> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be signed in to perform this action.");
  }

  const token = await user.getIdToken();

  const response = await fetch(url, {
    ...init,
    method: init.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
  } & TResponse;

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

export async function getStories(): Promise<Story[]> {
  const payload = await authorizedJsonFetch<{ stories: Story[] }>("/api/stories/list", {
    method: "GET",
  });

  return Array.isArray(payload.stories) ? payload.stories : [];
}

export async function createStory(data: { video_url: string }): Promise<Story> {
  const payload = await authorizedJsonFetch<{ story: Story }>(
    "/api/stories/create",
    {
      method: "POST",
    },
    { data },
  );

  return payload.story;
}

export async function uploadStoryVideo(file: File): Promise<string> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be signed in to upload a story.");
  }

  const token = await user.getIdToken();
  const formData = new FormData();
  formData.append("file", file, file.name || "story-video.mp4");

  const response = await fetch("/api/stories/upload-video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    url?: string;
  };

  if (!response.ok || !payload.success || typeof payload.url !== "string") {
    throw new Error(payload.error || "Failed to upload story video.");
  }

  return payload.url;
}
