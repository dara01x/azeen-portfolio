"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "@/lib/firebase/client";
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

export async function uploadPropertyImageBlobUrls(
  propertyId: string,
  imageBlobUrls: string[],
): Promise<string[]> {
  if (!propertyId || imageBlobUrls.length === 0) {
    return [];
  }

  const uploaded = await Promise.all(
    imageBlobUrls.map(async (blobUrl, index) => {
      const blobResponse = await fetch(blobUrl);
      if (!blobResponse.ok) {
        throw new Error("Failed to read selected image for upload.");
      }

      const blob = await blobResponse.blob();
      const contentType = blob.type || "application/octet-stream";
      const ext = extensionFromMimeType(contentType);
      const fileName = `${Date.now()}-${index}.${ext}`;
      const fileRef = ref(storage, `properties/${propertyId}/${fileName}`);

      await uploadBytes(fileRef, blob, { contentType });
      return getDownloadURL(fileRef);
    }),
  );

  return uploaded;
}
