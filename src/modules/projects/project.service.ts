import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Project } from "@/types";

type ProjectCoordinates = {
  lat: number | null;
  lng: number | null;
};

type ProjectRecord = Project & {
  coordinates: ProjectCoordinates;
  created_at: string | null;
  updated_at: string | null;
};

type ProjectWriteInput = Partial<Project> & {
  coordinates?: Partial<ProjectCoordinates>;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asOptionalNumber(value: unknown): number | undefined {
  const numeric = asNullableNumber(value);
  return numeric == null ? undefined : numeric;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function isLocalPreviewUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("blob:") || normalized.startsWith("data:");
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

function normalizeCoordinates(input: ProjectWriteInput): ProjectCoordinates {
  return {
    lat: asNullableNumber(input.coordinates?.lat ?? input.lat),
    lng: asNullableNumber(input.coordinates?.lng ?? input.lng),
  };
}

function normalizeProjectData(input: ProjectWriteInput) {
  const coordinates = normalizeCoordinates(input);
  const images = asStringArray(input.images).filter((image) => !isLocalPreviewUrl(image));
  const mainImageInput = asString(input.main_image);
  const sanitizedMainImage = isLocalPreviewUrl(mainImageInput) ? "" : mainImageInput;

  return {
    title: asString(input.title),
    description: asString(input.description),
    status: (input.status as Project["status"]) || "active",
    city_id: asString(input.city_id),
    area: asString(input.area),
    address: asString(input.address),
    coordinates,
    total_units: asNumber(input.total_units),
    available_units: asNumber(input.available_units),
    images,
    main_image: sanitizedMainImage || images[0] || "",
    video_url: asString(input.video_url),
    assigned_company_id: asString(input.assigned_company_id),
    has_units: asBoolean(input.has_units),
    internal_notes: asString(input.internal_notes),
  };
}

function mapDocToProjectRecord(id: string, data: Record<string, unknown>): ProjectRecord {
  const coordinates = (data.coordinates || {}) as Partial<ProjectCoordinates>;
  const images = asStringArray(data.images);

  return {
    id,
    title: asString(data.title),
    description: asString(data.description),
    status: (data.status as Project["status"]) || "active",
    city_id: asString(data.city_id),
    area: asString(data.area),
    address: asString(data.address),
    lat: asOptionalNumber(coordinates.lat ?? data.lat),
    lng: asOptionalNumber(coordinates.lng ?? data.lng),
    total_units: asNumber(data.total_units),
    available_units: asNumber(data.available_units),
    images,
    main_image: asString(data.main_image) || undefined,
    video_url: asString(data.video_url) || undefined,
    assigned_company_id: asString(data.assigned_company_id) || undefined,
    has_units: asBoolean(data.has_units),
    internal_notes: asString(data.internal_notes) || undefined,
    coordinates: {
      lat: asNullableNumber(coordinates.lat ?? data.lat),
      lng: asNullableNumber(coordinates.lng ?? data.lng),
    },
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
  };
}

export async function createProject(data: ProjectWriteInput): Promise<ProjectRecord> {
  const db = getAdminDb();
  const now = Timestamp.now();
  const normalized = normalizeProjectData(data);

  const payload = {
    ...normalized,
    created_at: now,
    updated_at: now,
  };

  const docRef = await db.collection("projects").add(payload);
  const createdDoc = await docRef.get();

  return mapDocToProjectRecord(docRef.id, createdDoc.data() || {});
}

export async function getProjects(): Promise<ProjectRecord[]> {
  const db = getAdminDb();
  const snapshot = await db.collection("projects").orderBy("updated_at", "desc").get();

  return snapshot.docs.map((doc) => mapDocToProjectRecord(doc.id, doc.data()));
}

export async function updateProject(id: string, data: ProjectWriteInput): Promise<ProjectRecord> {
  const db = getAdminDb();
  const docRef = db.collection("projects").doc(id);

  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    throw new Error("Project not found.");
  }

  const now = Timestamp.now();
  const normalized = normalizeProjectData(data);

  const payload = {
    ...normalized,
    updated_at: now,
  };

  await docRef.set(payload, { merge: true });

  const updatedDoc = await docRef.get();
  return mapDocToProjectRecord(id, updatedDoc.data() || {});
}
