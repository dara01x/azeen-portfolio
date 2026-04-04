"use client";

import { auth } from "@/lib/firebase/client";
import type { Property } from "@/types";

type PropertyApiItem = Property & {
  created_at?: string | null;
  updated_at?: string | null;
  sold_at?: string | null;
};

function extensionFromMimeType(contentType: string) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return "jpg";
  }

  if (contentType.includes("png")) {
    return "png";
  }

  if (contentType.includes("webp")) {
    return "webp";
  }

  if (contentType.includes("gif")) {
    return "gif";
  }

  if (contentType.includes("svg")) {
    return "svg";
  }

  return "bin";
}

async function authorizedJsonFetch(url: string, options: RequestInit = {}) {
  const idToken = await auth.currentUser?.getIdToken();

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (idToken) {
    headers.set("Authorization", `Bearer ${idToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload?.error === "string" ? payload.error : `Request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload;
}

export async function getProperties(): Promise<PropertyApiItem[]> {
  const payload = await authorizedJsonFetch("/api/properties/list", { method: "GET" });
  return Array.isArray(payload.properties) ? payload.properties : [];
}

export async function getPropertyById(id: string): Promise<PropertyApiItem | null> {
  const properties = await getProperties();
  return properties.find((property) => property.id === id) || null;
}

export async function createProperty(data: Omit<Property, "id">): Promise<PropertyApiItem> {
  const payload = await authorizedJsonFetch("/api/properties/create", {
    method: "POST",
    body: JSON.stringify({ data }),
  });

  return payload.property as PropertyApiItem;
}

export async function updateProperty(id: string, data: Omit<Property, "id">): Promise<PropertyApiItem> {
  const payload = await authorizedJsonFetch("/api/properties/update", {
    method: "PUT",
    body: JSON.stringify({ id, data }),
  });

  return payload.property as PropertyApiItem;
}

export async function deleteProperty(id: string): Promise<void> {
  await authorizedJsonFetch("/api/properties/delete", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}

export async function uploadPropertyImageBlobUrls(
  propertyId: string,
  imageBlobUrls: string[],
  localFilesByUrl: Record<string, File> = {},
): Promise<string[]> {
  if (!propertyId || imageBlobUrls.length === 0) {
    return [];
  }

  const idToken = await auth.currentUser?.getIdToken();
  const headers = new Headers();

  if (idToken) {
    headers.set("Authorization", `Bearer ${idToken}`);
  }

  const formData = new FormData();
  formData.append("propertyId", propertyId);

  await Promise.all(
    imageBlobUrls.map(async (blobUrl, index) => {
      const file = localFilesByUrl[blobUrl];
      const blob = file
        ? file
        : await (async () => {
            const blobResponse = await fetch(blobUrl);
            if (!blobResponse.ok) {
              throw new Error("Failed to read selected image for upload.");
            }

            return blobResponse.blob();
          })();

      const contentType = blob.type || "application/octet-stream";
      const ext = extensionFromMimeType(contentType);
      const fileName = file?.name || `property-image-${index + 1}.${ext}`;
      const uploadFile =
        file || new File([blob], fileName, {
          type: contentType,
        });

      formData.append("files", uploadFile, uploadFile.name);
    }),
  );

  const response = await fetch("/api/properties/upload-images", {
    method: "POST",
    headers,
    body: formData,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Property image upload failed (${response.status}).`;
    throw new Error(message);
  }

  return Array.isArray(payload.urls) ? payload.urls : [];
}
