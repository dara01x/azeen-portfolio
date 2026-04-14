import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import type { Story } from "@/types";

type StoryWriteInput = Partial<Story>;

type StoryMediaType = "video" | "image";

type StoryDeleteScope = {
  uid: string;
  role: "admin" | "company";
};

type StoryActor = {
  uid: string;
  role: Story["created_by_role"];
  full_name: string;
};

const STORY_DURATION_MS = 24 * 60 * 60 * 1000;

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

function parseIsoTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asUniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function tryParseStorageObjectPath(urlValue: string, bucketName: string): string | null {
  const value = urlValue.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("gs://")) {
    const withoutPrefix = value.slice("gs://".length);
    const firstSlash = withoutPrefix.indexOf("/");
    if (firstSlash <= 0) {
      return null;
    }

    const parsedBucketName = withoutPrefix.slice(0, firstSlash);
    if (parsedBucketName !== bucketName) {
      return null;
    }

    return withoutPrefix.slice(firstSlash + 1);
  }

  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.hostname === "firebasestorage.googleapis.com") {
      const matched = parsedUrl.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (!matched) {
        return null;
      }

      const parsedBucketName = safeDecodeURIComponent(matched[1]);
      if (parsedBucketName !== bucketName) {
        return null;
      }

      return safeDecodeURIComponent(matched[2]);
    }

    if (parsedUrl.hostname === "storage.googleapis.com") {
      const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
      if (pathParts.length < 2) {
        return null;
      }

      const parsedBucketName = pathParts[0];
      if (parsedBucketName !== bucketName) {
        return null;
      }

      return safeDecodeURIComponent(pathParts.slice(1).join("/"));
    }

    const storageHostSuffix = ".storage.googleapis.com";
    if (parsedUrl.hostname.endsWith(storageHostSuffix)) {
      const parsedBucketName = parsedUrl.hostname.slice(0, -storageHostSuffix.length);
      if (parsedBucketName !== bucketName) {
        return null;
      }

      return safeDecodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
    }

    return null;
  } catch {
    return null;
  }
}

function isNotFoundStorageError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("no such object") || message.includes("not found") || message.includes("404");
}

function normalizeStoryMediaType(value: unknown): StoryMediaType | null {
  return value === "image" || value === "video" ? value : null;
}

function normalizeActorRole(value: unknown): Story["created_by_role"] | null {
  if (value === "admin" || value === "company") {
    return value;
  }

  if (value === "owner" || value === "manager") {
    return "admin";
  }

  return null;
}

function normalizeActorStatus(value: unknown): "active" | "disabled" {
  return value === "disabled" ? "disabled" : "active";
}

function validateStoryMediaUrl(mediaUrl: string) {
  if (!mediaUrl) {
    throw new Error("Story media URL is required.");
  }

  const isHttpUrl = mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://");

  if (!isHttpUrl) {
    throw new Error("Story media URL must be a valid HTTP(S) URL.");
  }
}

function resolveStoryMediaFromInput(data: StoryWriteInput) {
  const requestedMediaType = normalizeStoryMediaType(data.media_type);
  const mediaUrl = asString(data.media_url).trim();
  const imageUrl = asString(data.image_url).trim();
  const videoUrl = asString(data.video_url).trim();

  const mediaType = requestedMediaType || (imageUrl ? "image" : videoUrl ? "video" : null);
  if (!mediaType) {
    throw new Error("Story media type is invalid.");
  }

  const resolvedMediaUrl = mediaUrl || (mediaType === "image" ? imageUrl : videoUrl);
  validateStoryMediaUrl(resolvedMediaUrl);

  return {
    mediaType,
    mediaUrl: resolvedMediaUrl,
    videoUrl: mediaType === "video" ? resolvedMediaUrl : "",
    imageUrl: mediaType === "image" ? resolvedMediaUrl : "",
  };
}

function extractStoryMediaUrls(data: Record<string, unknown>) {
  return asUniqueStrings([
    asString(data.media_url),
    asString(data.video_url),
    asString(data.image_url),
  ]);
}

async function deleteStoryMediaFromStorage(data: Record<string, unknown>) {
  const bucket = getAdminStorageBucket();
  const mediaObjectPaths = asUniqueStrings(
    extractStoryMediaUrls(data)
      .map((urlValue) => tryParseStorageObjectPath(urlValue, bucket.name) || "")
      .filter(Boolean),
  );

  for (const objectPath of mediaObjectPaths) {
    try {
      await bucket.file(objectPath).delete({ ignoreNotFound: true });
    } catch (error) {
      if (!isNotFoundStorageError(error)) {
        throw error;
      }
    }
  }
}

function assertStoryDeleteAccess(data: Record<string, unknown>, scope?: StoryDeleteScope) {
  if (!scope || scope.role === "admin") {
    return;
  }

  const createdByUid = asString(data.created_by_uid).trim();

  if (!createdByUid || createdByUid !== scope.uid) {
    throw new Error("Forbidden.");
  }
}

async function cleanupExpiredStories(now: Timestamp) {
  const db = getAdminDb();
  const snapshot = await db.collection("stories").where("expires_at", "<=", now).get();

  for (const storyDoc of snapshot.docs) {
    const storyData = storyDoc.data() || {};
    await deleteStoryMediaFromStorage(storyData);

    await storyDoc.ref.delete();
  }
}

function mapDocToStoryRecord(id: string, data: Record<string, unknown>): Story {
  const created_at = toIso(data.created_at) || new Date().toISOString();
  const expires_at =
    toIso(data.expires_at) || new Date(Date.now() + STORY_DURATION_MS).toISOString();

  const storedMediaType = normalizeStoryMediaType(data.media_type);
  const storedMediaUrl = asString(data.media_url).trim();
  const storedVideoUrl = asString(data.video_url).trim();
  const storedImageUrl = asString(data.image_url).trim();

  const media_type = storedMediaType || (storedImageUrl ? "image" : "video");
  const media_url = storedMediaUrl || (media_type === "image" ? storedImageUrl : storedVideoUrl);
  const video_url = media_type === "video" ? storedVideoUrl || media_url : "";
  const image_url = media_type === "image" ? storedImageUrl || media_url : "";

  return {
    id,
    video_url,
    image_url: image_url || undefined,
    media_type,
    media_url: media_url || undefined,
    created_by_uid: asString(data.created_by_uid).trim(),
    created_by_name: asString(data.created_by_name).trim() || "User",
    created_by_role: normalizeActorRole(data.created_by_role) || "admin",
    created_at,
    expires_at,
  };
}

async function getStoryActor(uid: string): Promise<StoryActor> {
  const db = getAdminDb();
  const usersCollection = db.collection("users");

  let actorDoc = await usersCollection.doc(uid).get();

  if (!actorDoc.exists) {
    const actorByAuthUid = await usersCollection.where("auth_uid", "==", uid).limit(1).get();

    if (!actorByAuthUid.empty) {
      actorDoc = actorByAuthUid.docs[0];
    }
  }

  if (!actorDoc.exists) {
    throw new Error("Forbidden.");
  }

  const actorData = actorDoc.data() || {};
  const role = normalizeActorRole(actorData.role);
  const status = normalizeActorStatus(actorData.status);

  if (!role || status !== "active") {
    throw new Error("Forbidden.");
  }

  return {
    uid,
    role,
    full_name: asString(actorData.full_name).trim() || asString(actorData.email).trim() || "User",
  };
}

export async function createStory(actorUid: string, data: StoryWriteInput): Promise<Story> {
  if (!actorUid.trim()) {
    throw new Error("Unauthorized.");
  }

  const actor = await getStoryActor(actorUid);
  const storyMedia = resolveStoryMediaFromInput(data);

  const db = getAdminDb();
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + STORY_DURATION_MS);

  const payload = {
    media_type: storyMedia.mediaType,
    media_url: storyMedia.mediaUrl,
    video_url: storyMedia.videoUrl,
    image_url: storyMedia.imageUrl,
    created_by_uid: actor.uid,
    created_by_name: actor.full_name,
    created_by_role: actor.role,
    created_at: now,
    expires_at: expiresAt,
  };

  const docRef = await db.collection("stories").add(payload);
  const createdDoc = await docRef.get();

  return mapDocToStoryRecord(docRef.id, createdDoc.data() || payload);
}

export async function getActiveStories(): Promise<Story[]> {
  const db = getAdminDb();
  const now = Timestamp.now();

  await cleanupExpiredStories(now);

  const snapshot = await db.collection("stories").where("expires_at", ">", now).get();

  const stories = snapshot.docs
    .map((doc) => mapDocToStoryRecord(doc.id, doc.data()))
    .filter((story) => !!((story.media_url || story.video_url || story.image_url || "").trim()));

  return stories.sort((a, b) => parseIsoTime(b.created_at) - parseIsoTime(a.created_at));
}

export async function deleteStory(id: string, scope?: StoryDeleteScope): Promise<void> {
  const storyId = id.trim();

  if (!storyId) {
    throw new Error("Story id is required.");
  }

  const db = getAdminDb();
  const docRef = db.collection("stories").doc(storyId);
  const existingDoc = await docRef.get();

  if (!existingDoc.exists) {
    throw new Error("Story not found.");
  }

  const storyData = (existingDoc.data() || {}) as Record<string, unknown>;
  assertStoryDeleteAccess(storyData, scope);
  await deleteStoryMediaFromStorage(storyData);
  await docRef.delete();
}
