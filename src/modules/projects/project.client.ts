"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "@/lib/firebase/client";
import type { Project } from "@/types";

type ProjectApiItem = Project & {
  created_at?: string | null;
  updated_at?: string | null;
};

const MAX_PROJECT_VIDEO_UPLOAD_SIZE_BYTES = 30 * 1024 * 1024;

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

function extensionFromMimeType(type: string): string {
  const normalized = type.toLowerCase();

  if (normalized.includes("mp4")) return ".mp4";
  if (normalized.includes("webm")) return ".webm";
  if (normalized.includes("quicktime")) return ".mov";
  if (normalized.includes("x-matroska")) return ".mkv";

  if (normalized.includes("png")) return ".png";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("gif")) return ".gif";
  if (normalized.includes("bmp")) return ".bmp";
  if (normalized.includes("svg")) return ".svg";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";

  return ".jpg";
}

function sanitizeBaseName(fileName: string) {
  const withoutExt = fileName.replace(/\.[^/.]+$/, "");
  const normalized = withoutExt
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || "video";
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

async function uploadVideoDirectlyToFirebaseStorage(
  objectPath: string,
  file: File,
): Promise<string> {
  const storageRef = ref(storage, objectPath);

  await uploadBytes(storageRef, file, {
    contentType: file.type || "video/mp4",
    cacheControl: "public,max-age=31536000,immutable",
  });

  return getDownloadURL(storageRef);
}

async function uploadImageDirectlyToFirebaseStorage(
  objectPath: string,
  file: File,
): Promise<string> {
  const storageRef = ref(storage, objectPath);

  await uploadBytes(storageRef, file, {
    contentType: file.type || "image/jpeg",
    cacheControl: "public,max-age=31536000,immutable",
  });

  return getDownloadURL(storageRef);
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
        throw new Error(`Failed to read selected image (${response.status}).`);
      }

      const blob = await response.blob();
      const extension = extensionFromMimeType(blob.type || "image/jpeg");
      file = new File([blob], `${fileName}${extension}`, {
        type: blob.type || "image/jpeg",
      });
    }

    const imageExtension = extensionFromMimeType(file.type || "image/jpeg");
    const safeName = sanitizeBaseName(file.name || fileName);
    const directObjectPath = `projects/${projectId}/${Date.now()}-${randomSuffix()}-${safeName}${imageExtension}`;

    try {
      const directUrl = await uploadImageDirectlyToFirebaseStorage(directObjectPath, file);
      uploaded.push(directUrl);
      continue;
    } catch {
      // Fallback keeps compatibility if client-side storage rules block direct uploads.
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
      const message =
        uploadResponse.status === 413
          ? "Project image upload request is too large. Please upload a smaller image."
          : uploadPayload.error || `Project image upload failed (${uploadResponse.status}).`;
      throw new Error(message);
    }

    uploaded.push(uploadPayload.url);
  }

  return uploaded;
}

export async function uploadProjectVideoFile(projectId: string, file: File): Promise<string> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be signed in to upload videos.");
  }

  if (!(file instanceof File)) {
    throw new Error("Video file is required.");
  }

  if (!file.type.startsWith("video/")) {
    throw new Error("Please select a valid video file.");
  }

  if (file.size > MAX_PROJECT_VIDEO_UPLOAD_SIZE_BYTES) {
    throw new Error("Video is too large. Please use a file up to 30MB.");
  }

  const contentType = file.type || "video/mp4";
  const ext = extensionFromMimeType(contentType).replace(/^\./, "");
  const safeName = sanitizeBaseName(file.name || "project-video");
  const objectPath = `projects/${projectId}/videos/${Date.now()}-${randomSuffix()}-${safeName}.${ext}`;

  try {
    return await uploadVideoDirectlyToFirebaseStorage(objectPath, file);
  } catch {
    // Fallback keeps compatibility if client-side storage rules block direct uploads.
  }

  const token = await user.getIdToken();
  const formData = new FormData();
  formData.append("projectId", projectId);
  formData.append("file", file, file.name || `project-video-${Date.now()}.mp4`);

  const uploadResponse = await fetch("/api/projects/upload-video", {
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
    throw new Error(uploadPayload.error || "Project video upload failed.");
  }

  return uploadPayload.url;
}
