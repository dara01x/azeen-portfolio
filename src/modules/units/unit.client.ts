"use client";

import { auth } from "@/lib/firebase/client";
import type { Unit } from "@/types";

type UnitApiItem = Unit & {
  created_at?: string | null;
  updated_at?: string | null;
  sold_at?: string | null;
};

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
  body?: unknown,
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

export async function getUnits(): Promise<UnitApiItem[]> {
  const payload = await authorizedJsonFetch<{ units: UnitApiItem[] }>("/api/units/list", {
    method: "GET",
  });

  return Array.isArray(payload.units) ? payload.units : [];
}

export async function getUnitById(id: string): Promise<UnitApiItem | undefined> {
  const units = await getUnits();
  return units.find((unit) => unit.id === id);
}

export async function createUnit(data: Partial<Unit>): Promise<UnitApiItem> {
  const payload = await authorizedJsonFetch<{ unit: UnitApiItem }>(
    "/api/units/create",
    {
      method: "POST",
    },
    { data },
  );

  return payload.unit;
}

export async function updateUnit(id: string, data: Partial<Unit>): Promise<UnitApiItem> {
  const payload = await authorizedJsonFetch<{ unit: UnitApiItem }>(
    "/api/units/update",
    {
      method: "PUT",
    },
    { id, data },
  );

  return payload.unit;
}

export async function deleteUnit(id: string): Promise<void> {
  await authorizedJsonFetch<{ success: boolean }>(
    "/api/units/delete",
    {
      method: "DELETE",
    },
    { id },
  );
}

export async function uploadUnitImageBlobUrls(
  unitId: string,
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
    const fileName = `unit-image-${Date.now()}-${index + 1}`;
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

    const formData = new FormData();
    formData.append("unitId", unitId);
    formData.append("file", file, file.name || `${fileName}.jpg`);

    const uploadResponse = await fetch("/api/units/upload-images", {
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
      throw new Error(uploadPayload.error || `Unit image upload failed (${uploadResponse.status}).`);
    }

    uploaded.push(uploadPayload.url);
  }

  return uploaded;
}
