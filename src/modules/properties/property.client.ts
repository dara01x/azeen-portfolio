"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "@/lib/firebase/client";
import type { Property } from "@/types";

type PropertyWritePayload = Omit<Property, "id" | "listing_type" | "payment_type"> & {
  listing_type?: Property["listing_type"];
  payment_type?: Property["payment_type"];
};

type PropertyApiItem = Property & {
  created_at?: string | null;
  updated_at?: string | null;
  sold_at?: string | null;
};

const MAX_PROPERTY_IMAGE_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_PROPERTY_VIDEO_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;

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

function extensionFromMimeType(contentType: string) {
  if (contentType.includes("mp4")) {
    return "mp4";
  }

  if (contentType.includes("webm")) {
    return "webm";
  }

  if (contentType.includes("quicktime")) {
    return "mov";
  }

  if (contentType.includes("x-matroska")) {
    return "mkv";
  }

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

export async function createProperty(data: PropertyWritePayload): Promise<PropertyApiItem> {
  const payload = await authorizedJsonFetch("/api/properties/create", {
    method: "POST",
    body: JSON.stringify({ data }),
  });

  return payload.property as PropertyApiItem;
}

export async function updateProperty(id: string, data: PropertyWritePayload): Promise<PropertyApiItem> {
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

  const uploadedUrls: string[] = [];

  for (const [index, blobUrl] of imageBlobUrls.entries()) {
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
      file ||
      new File([blob], fileName, {
        type: contentType,
      });

    if (uploadFile.size > MAX_PROPERTY_IMAGE_UPLOAD_SIZE_BYTES) {
      throw new Error("Image is too large. Please use images up to 500MB each.");
    }

    const formData = new FormData();
    formData.append("propertyId", propertyId);
    formData.append("files", uploadFile, uploadFile.name);

    const response = await fetch("/api/properties/upload-images", {
      method: "POST",
      headers,
      body: formData,
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error("Image upload request is too large. Please upload smaller images (up to 500MB each).");
      }

      const message =
        typeof payload?.error === "string"
          ? payload.error
          : `Property image upload failed (${response.status}).`;
      throw new Error(message);
    }

    if (Array.isArray(payload.urls) && payload.urls.length > 0) {
      uploadedUrls.push(payload.urls[0]);
    }
  }

  return uploadedUrls;
}

export async function uploadPropertyVideoFile(propertyId: string, file: File): Promise<string> {
  if (!propertyId) {
    throw new Error("Property id is required for video upload.");
  }

  if (!(file instanceof File)) {
    throw new Error("Video file is required.");
  }

  if (!file.type.startsWith("video/")) {
    throw new Error("Please select a valid video file.");
  }

  if (file.size > MAX_PROPERTY_VIDEO_UPLOAD_SIZE_BYTES) {
    throw new Error("Video is too large. Please use a file up to 500MB.");
  }

  const contentType = file.type || "video/mp4";
  const ext = extensionFromMimeType(contentType);
  const safeName = sanitizeBaseName(file.name || "property-video");
  const objectPath = `properties/${propertyId}/videos/${Date.now()}-${randomSuffix()}-${safeName}.${ext}`;

  try {
    return await uploadVideoDirectlyToFirebaseStorage(objectPath, file);
  } catch {
    // Fallback keeps compatibility if client-side storage rules block direct uploads.
  }

  const idToken = await auth.currentUser?.getIdToken();
  const headers = new Headers();

  if (idToken) {
    headers.set("Authorization", `Bearer ${idToken}`);
  }

  const formData = new FormData();
  formData.append("propertyId", propertyId);
  formData.append("file", file, file.name || `property-video.${extensionFromMimeType(contentType)}`);

  const response = await fetch("/api/properties/upload-video", {
    method: "POST",
    headers,
    body: formData,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 413) {
      const message =
        typeof payload?.error === "string"
          ? payload.error
          : "Video upload request is too large for this deployment. Please upload a smaller video.";
      throw new Error(message);
    }

    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Property video upload failed (${response.status}).`;
    throw new Error(message);
  }

  const uploadedUrl = typeof payload?.url === "string" ? payload.url : "";
  if (!uploadedUrl) {
    throw new Error("Property video upload did not return a valid URL.");
  }

  return uploadedUrl;
}
