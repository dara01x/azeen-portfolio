"use client";

import { auth } from "@/lib/firebase/client";
import type { Project } from "@/types";

type ProjectApiItem = Project & {
  created_at?: string | null;
  updated_at?: string | null;
};

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

function extensionFromMimeType(type: string): string {
  const normalized = type.toLowerCase();

  if (normalized.includes("png")) return ".png";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("gif")) return ".gif";
  if (normalized.includes("bmp")) return ".bmp";
  if (normalized.includes("svg")) return ".svg";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";

  return ".jpg";
}

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

export async function getProjects(): Promise<ProjectApiItem[]> {
  const payload = await authorizedJsonFetch<{ projects: ProjectApiItem[] }>("/api/projects/list", {
    method: "GET",
  });

  return Array.isArray(payload.projects) ? payload.projects : [];
}

export async function getProjectById(id: string): Promise<ProjectApiItem | undefined> {
  const projects = await getProjects();
  return projects.find((project) => project.id === id);
}

export async function createProject(data: Partial<Project>): Promise<ProjectApiItem> {
  const payload = await authorizedJsonFetch<{ project: ProjectApiItem }>(
    "/api/projects/create",
    {
      method: "POST",
    },
    { data },
  );

  return payload.project;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<ProjectApiItem> {
  const payload = await authorizedJsonFetch<{ project: ProjectApiItem }>(
    "/api/projects/update",
    {
      method: "PUT",
    },
    { id, data },
  );

  return payload.project;
}

export async function deleteProject(id: string): Promise<void> {
  await authorizedJsonFetch<{ success: boolean }>(
    "/api/projects/delete",
    {
      method: "DELETE",
    },
    { id },
  );
}

export async function uploadProjectImageBlobUrls(
  projectId: string,
  urls: string[],
  localFiles?: Record<string, File>,
): Promise<string[]> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be signed in to upload images.");
  }

  const token = await user.getIdToken();
  const uploaded: string[] = [];

  for (const [index, url] of urls.entries()) {
    const fileName = `project-image-${Date.now()}-${index + 1}`;
    let file = localFiles?.[url];

    if (!file) {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }

      const blob = await response.blob();
      const extension = extensionFromMimeType(blob.type || "image/jpeg");
      file = new File([blob], `${fileName}${extension}`, {
        type: blob.type || "image/jpeg",
      });
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("file", file, file.name || `${fileName}.jpg`);

    const uploadResponse = await fetch("/api/projects/upload-images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const uploadPayload = (await uploadResponse.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      url?: string;
    };

    if (!uploadResponse.ok || !uploadPayload.success || !uploadPayload.url) {
      continue;
    }

    uploaded.push(uploadPayload.url);
  }

  return uploaded;
}
