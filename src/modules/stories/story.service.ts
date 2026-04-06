import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Story } from "@/types";

type StoryWriteInput = Partial<Story>;

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

function validateStoryVideoUrl(videoUrl: string) {
  if (!videoUrl) {
    throw new Error("Story video URL is required.");
  }

  const isHttpUrl = videoUrl.startsWith("http://") || videoUrl.startsWith("https://");

  if (!isHttpUrl) {
    throw new Error("Story video URL must be a valid HTTP(S) URL.");
  }
}

function mapDocToStoryRecord(id: string, data: Record<string, unknown>): Story {
  const created_at = toIso(data.created_at) || new Date().toISOString();
  const expires_at =
    toIso(data.expires_at) || new Date(Date.now() + STORY_DURATION_MS).toISOString();

  return {
    id,
    video_url: asString(data.video_url).trim(),
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
  const videoUrl = asString(data.video_url).trim();

  validateStoryVideoUrl(videoUrl);

  const db = getAdminDb();
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + STORY_DURATION_MS);

  const payload = {
    video_url: videoUrl,
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

  const snapshot = await db.collection("stories").where("expires_at", ">", now).get();

  const stories = snapshot.docs
    .map((doc) => mapDocToStoryRecord(doc.id, doc.data()))
    .filter((story) => !!story.video_url);

  return stories.sort((a, b) => parseIsoTime(b.created_at) - parseIsoTime(a.created_at));
}
