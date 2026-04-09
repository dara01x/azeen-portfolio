import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
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

type ProjectAccessScope = {
  role: "admin" | "company";
  userId: string;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function isCompanyScope(
  scope?: ProjectAccessScope,
): scope is ProjectAccessScope & { role: "company" } {
  return !!scope && scope.role === "company";
}

function redactProjectContactFields(record: ProjectRecord): ProjectRecord {
  return {
    ...record,
    contact_name: "",
    primary_mobile_number: "",
    secondary_mobile_number: undefined,
  };
}

function applyProjectReadScope(record: ProjectRecord, scope?: ProjectAccessScope): ProjectRecord {
  if (!isCompanyScope(scope)) {
    return record;
  }

  return redactProjectContactFields(record);
}

function assertCompanyProjectWriteAccess(
  existingData: Record<string, unknown>,
  scope?: ProjectAccessScope,
) {
  if (!isCompanyScope(scope)) {
    return;
  }

  const assignedCompanyId = asString(existingData.assigned_company_id).trim();
  if (!assignedCompanyId || assignedCompanyId !== scope.userId) {
    throw new Error("Forbidden.");
  }
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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

function extractProjectImageUrls(data: Record<string, unknown>) {
  const mainImage = asString(data.main_image);
  const images = asStringArray(data.images);
  return asUniqueStrings([...images, mainImage]);
}

async function deleteProjectStorageAssets(id: string, data: Record<string, unknown>) {
  const bucket = getAdminStorageBucket();
  const imageUrls = extractProjectImageUrls(data);
  const imageObjectPaths = asUniqueStrings(
    imageUrls
      .map((urlValue) => tryParseStorageObjectPath(urlValue, bucket.name) || "")
      .filter(Boolean),
  );

  for (const objectPath of imageObjectPaths) {
    try {
      await bucket.file(objectPath).delete({ ignoreNotFound: true });
    } catch (error) {
      if (!isNotFoundStorageError(error)) {
        throw error;
      }
    }
  }

  try {
    await bucket.deleteFiles({ prefix: `projects/${id}/`, force: true });
  } catch (error) {
    if (!isNotFoundStorageError(error)) {
      throw error;
    }
  }
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
  const propertyTypeIds = asUniqueStrings(asStringArray(input.property_type_ids));
  const amenityIds = asUniqueStrings(asStringArray(input.amenities));
  const addressEn = asString(input.address_en);
  const addressKu = asString(input.address_ku);
  const addressAr = asString(input.address_ar);
  const descriptionEn = asString(input.description_en);
  const descriptionKu = asString(input.description_ku);
  const descriptionAr = asString(input.description_ar);

  return {
    title: asString(input.title),
    description: asString(input.description) || descriptionEn,
    description_en: descriptionEn,
    description_ku: descriptionKu,
    description_ar: descriptionAr,
    status: (input.status as Project["status"]) || "active",
    city_id: asString(input.city_id),
    area: asString(input.area),
    address: asString(input.address) || addressEn,
    address_en: addressEn || asString(input.address),
    address_ku: addressKu,
    address_ar: addressAr,
    coordinates,
    property_type_ids: propertyTypeIds,
    area_size: asNumber(input.area_size),
    starting_price: asNumber(input.starting_price),
    currency: (input.currency as Project["currency"]) || "USD",
    payment_type: (input.payment_type as Project["payment_type"]) || "cash",
    amenities: amenityIds,
    contact_name: asString(input.contact_name),
    primary_mobile_number: asString(input.primary_mobile_number),
    secondary_mobile_number: asString(input.secondary_mobile_number),
    images,
    main_image: sanitizedMainImage || images[0] || "",
    video_url: asString(input.video_url),
    assigned_company_id: asString(input.assigned_company_id),
    internal_notes: asString(input.internal_notes),
  };
}

function mapDocToProjectRecord(id: string, data: Record<string, unknown>): ProjectRecord {
  const coordinates = (data.coordinates || {}) as Partial<ProjectCoordinates>;
  const images = asStringArray(data.images);
  const descriptionEn = asString(data.description_en) || asString(data.description);
  const addressEn = asString(data.address_en) || asString(data.address);

  return {
    id,
    title: asString(data.title),
    description: descriptionEn,
    description_en: descriptionEn,
    description_ku: asString(data.description_ku),
    description_ar: asString(data.description_ar),
    status: (data.status as Project["status"]) || "active",
    city_id: asString(data.city_id),
    area: asString(data.area),
    address: addressEn,
    address_en: addressEn,
    address_ku: asString(data.address_ku),
    address_ar: asString(data.address_ar),
    lat: asOptionalNumber(coordinates.lat ?? data.lat),
    lng: asOptionalNumber(coordinates.lng ?? data.lng),
    property_type_ids: asStringArray(data.property_type_ids),
    area_size: asNumber(data.area_size),
    starting_price: asNumber(data.starting_price),
    currency: (asString(data.currency, "USD") as Project["currency"]) || "USD",
    payment_type: (asString(data.payment_type, "cash") as Project["payment_type"]) || "cash",
    amenities: asStringArray(data.amenities),
    contact_name: asString(data.contact_name),
    primary_mobile_number: asString(data.primary_mobile_number),
    secondary_mobile_number: asString(data.secondary_mobile_number) || undefined,
    images,
    main_image: asString(data.main_image) || undefined,
    video_url: asString(data.video_url) || undefined,
    assigned_company_id: asString(data.assigned_company_id) || undefined,
    internal_notes: asString(data.internal_notes) || undefined,
    coordinates: {
      lat: asNullableNumber(coordinates.lat ?? data.lat),
      lng: asNullableNumber(coordinates.lng ?? data.lng),
    },
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
  };
}

export async function createProject(
  data: ProjectWriteInput,
  scope?: ProjectAccessScope,
): Promise<ProjectRecord> {
  const db = getAdminDb();
  const now = Timestamp.now();
  const normalized = normalizeProjectData(data);

  if (isCompanyScope(scope)) {
    normalized.assigned_company_id = scope.userId;
  }

  const payload = {
    ...normalized,
    created_at: now,
    updated_at: now,
  };

  const docRef = await db.collection("projects").add(payload);
  const createdDoc = await docRef.get();

  return applyProjectReadScope(mapDocToProjectRecord(docRef.id, createdDoc.data() || {}), scope);
}

export async function getProjects(scope?: ProjectAccessScope): Promise<ProjectRecord[]> {
  const db = getAdminDb();
  const snapshot = await db.collection("projects").orderBy("updated_at", "desc").get();

  const records = snapshot.docs.map((doc) => mapDocToProjectRecord(doc.id, doc.data()));
  const visibleRecords = isCompanyScope(scope)
    ? records.filter((record) => record.assigned_company_id === scope.userId)
    : records;

  return visibleRecords.map((record) => applyProjectReadScope(record, scope));
}

export async function updateProject(
  id: string,
  data: ProjectWriteInput,
  scope?: ProjectAccessScope,
): Promise<ProjectRecord> {
  const db = getAdminDb();
  const docRef = db.collection("projects").doc(id);

  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    throw new Error("Project not found.");
  }

  assertCompanyProjectWriteAccess((existingDoc.data() || {}) as Record<string, unknown>, scope);

  const now = Timestamp.now();
  const normalized = normalizeProjectData(data);

  if (isCompanyScope(scope)) {
    normalized.assigned_company_id = scope.userId;
  }

  const payload = {
    ...normalized,
    updated_at: now,
  };

  await docRef.set(payload, { merge: true });

  const updatedDoc = await docRef.get();
  return applyProjectReadScope(mapDocToProjectRecord(id, updatedDoc.data() || {}), scope);
}

export async function deleteProject(id: string, scope?: ProjectAccessScope): Promise<void> {
  const db = getAdminDb();
  const docRef = db.collection("projects").doc(id);

  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    throw new Error("Project not found.");
  }

  const data = (existingDoc.data() || {}) as Record<string, unknown>;
  assertCompanyProjectWriteAccess(data, scope);
  await deleteProjectStorageAssets(id, data);
  await docRef.delete();
}

export async function assertProjectWriteAccess(
  id: string,
  scope?: ProjectAccessScope,
): Promise<void> {
  if (!isCompanyScope(scope)) {
    return;
  }

  const db = getAdminDb();
  const docRef = db.collection("projects").doc(id);
  const existingDoc = await docRef.get();

  if (!existingDoc.exists) {
    throw new Error("Project not found.");
  }

  assertCompanyProjectWriteAccess((existingDoc.data() || {}) as Record<string, unknown>, scope);
}
