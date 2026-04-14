import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import type { Property } from "@/types";

const PROPERTY_CODE_PREFIX = "P";
const PROPERTY_CODE_LENGTH = 6;
const PROPERTY_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PROPERTY_CODE_MAX_ATTEMPTS = 10;

type PropertyAddress = {
  en: string;
  ku: string;
  ar: string;
};

type PropertyCoordinates = {
  lat: number | null;
  lng: number | null;
};

type PropertyDescription = {
  en: string;
  ku: string;
  ar: string;
};

type PropertyRecord = Property & {
  address: PropertyAddress;
  coordinates: PropertyCoordinates;
  description: PropertyDescription;
  created_at: string | null;
  updated_at: string | null;
  sold_at: string | null;
};

type PropertyWriteInput = Partial<Property> & {
  address?: Partial<PropertyAddress>;
  coordinates?: Partial<PropertyCoordinates>;
  description?: Partial<PropertyDescription>;
};

type PropertyAccessScope = {
  role: "admin" | "company" | "viewer";
  userId: string;
};

function normalizePropertyCode(value: string) {
  return value.trim().toUpperCase();
}

function buildPropertyCodeFromId(id: string) {
  const compact = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const shortBody = compact.slice(0, PROPERTY_CODE_LENGTH).padEnd(PROPERTY_CODE_LENGTH, "0");
  return `${PROPERTY_CODE_PREFIX}${shortBody}`;
}

function createRandomPropertyCode() {
  let body = "";

  for (let index = 0; index < PROPERTY_CODE_LENGTH; index += 1) {
    const randomIndex = Math.floor(Math.random() * PROPERTY_CODE_CHARSET.length);
    body += PROPERTY_CODE_CHARSET[randomIndex];
  }

  return `${PROPERTY_CODE_PREFIX}${body}`;
}

async function generateUniquePropertyCode(db: ReturnType<typeof getAdminDb>) {
  for (let attempt = 0; attempt < PROPERTY_CODE_MAX_ATTEMPTS; attempt += 1) {
    const candidate = createRandomPropertyCode();
    const existing = await db
      .collection("properties")
      .where("property_code", "==", candidate)
      .limit(1)
      .get();

    if (existing.empty) {
      return candidate;
    }
  }

  return `${PROPERTY_CODE_PREFIX}${Date.now().toString(36).toUpperCase().slice(-PROPERTY_CODE_LENGTH).padStart(PROPERTY_CODE_LENGTH, "0")}`;
}

function resolvePropertyCode(data: Record<string, unknown>, id: string) {
  const code = normalizePropertyCode(asString(data.property_code));
  if (code) {
    return code;
  }

  return buildPropertyCodeFromId(id);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function isCompanyScope(
  scope?: PropertyAccessScope,
): scope is PropertyAccessScope & { role: "company" } {
  return !!scope && scope.role === "company";
}

function isViewerScope(
  scope?: PropertyAccessScope,
): scope is PropertyAccessScope & { role: "viewer" } {
  return !!scope && scope.role === "viewer";
}

function assertPropertyWritePermission(scope?: PropertyAccessScope) {
  if (isViewerScope(scope)) {
    throw new Error("Forbidden.");
  }
}

function redactPropertyContactFields(record: PropertyRecord): PropertyRecord {
  return {
    ...record,
    contact_name: "",
    primary_mobile_number: "",
    secondary_mobile_number: undefined,
  };
}

function applyPropertyReadScope(record: PropertyRecord, scope?: PropertyAccessScope): PropertyRecord {
  if (!isCompanyScope(scope)) {
    return record;
  }

  return redactPropertyContactFields(record);
}

function assertCompanyPropertyWriteAccess(
  existingData: Record<string, unknown>,
  scope?: PropertyAccessScope,
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

async function resolveUserDisplayNames(userIds: string[]) {
  const uniqueUserIds = asUniqueStrings(userIds);
  if (uniqueUserIds.length === 0) {
    return new Map<string, string>();
  }

  const db = getAdminDb();
  const snapshots = await Promise.all(
    uniqueUserIds.map((userId) => db.collection("users").doc(userId).get()),
  );

  const namesByUserId = new Map<string, string>();

  snapshots.forEach((snapshot, index) => {
    if (!snapshot.exists) {
      return;
    }

    const data = (snapshot.data() || {}) as Record<string, unknown>;
    const companyName = asString(data.company_name).trim();
    const fullName = asString(data.full_name).trim();
    const displayName = companyName || fullName;

    if (displayName) {
      namesByUserId.set(uniqueUserIds[index], displayName);
    }
  });

  return namesByUserId;
}

function withPropertyAssignmentNames(
  record: PropertyRecord,
  namesByUserId: Map<string, string>,
): PropertyRecord {
  const assignedCompanyId = asString(record.assigned_company_id).trim();
  const assignedViewerId = asString(record.assigned_viewer_id).trim();

  return {
    ...record,
    assigned_company_name: assignedCompanyId
      ? namesByUserId.get(assignedCompanyId) || undefined
      : undefined,
    assigned_viewer_name: assignedViewerId
      ? namesByUserId.get(assignedViewerId) || undefined
      : undefined,
  };
}

function asDateString(value: unknown) {
  const raw = asString(value).trim();
  if (!raw) {
    return "";
  }

  const candidate = raw.length >= 10 ? raw.slice(0, 10) : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return "";
  }

  const parsed = Date.parse(`${candidate}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? candidate : "";
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

function extractPropertyImageUrls(data: Record<string, unknown>) {
  const mainImage = asString(data.main_image);
  const images = asStringArray(data.images);
  return asUniqueStrings([...images, mainImage]);
}

async function deletePropertyStorageAssets(id: string, data: Record<string, unknown>) {
  const bucket = getAdminStorageBucket();
  const imageUrls = extractPropertyImageUrls(data);
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
    await bucket.deleteFiles({ prefix: `properties/${id}/`, force: true });
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

function normalizeAddress(input: PropertyWriteInput): PropertyAddress {
  return {
    en: asString(input.address?.en ?? input.address_en),
    ku: asString(input.address?.ku ?? input.address_ku),
    ar: asString(input.address?.ar ?? input.address_ar),
  };
}

function normalizeCoordinates(input: PropertyWriteInput): PropertyCoordinates {
  return {
    lat: asNullableNumber(input.coordinates?.lat ?? input.lat),
    lng: asNullableNumber(input.coordinates?.lng ?? input.lng),
  };
}

function normalizeDescription(input: PropertyWriteInput): PropertyDescription {
  return {
    en: asString(input.description?.en ?? input.description_en),
    ku: asString(input.description?.ku ?? input.description_ku),
    ar: asString(input.description?.ar ?? input.description_ar),
  };
}

function normalizePropertyData(input: PropertyWriteInput) {
  const address = normalizeAddress(input);
  const coordinates = normalizeCoordinates(input);
  const description = normalizeDescription(input);
  const images = asStringArray(input.images).filter((image) => !isLocalPreviewUrl(image));
  const mainImageInput = asString(input.main_image);
  const sanitizedMainImage = isLocalPreviewUrl(mainImageInput) ? "" : mainImageInput;

  return {
    title: asString(input.title),
    type_id: asString(input.type_id),
    listing_type: (input.listing_type as Property["listing_type"]) || "sale",
    listing_date: asDateString(input.listing_date),
    status: (input.status as Property["status"]) || "available",
    price: asNumber(input.price),
    currency: (input.currency as Property["currency"]) || "USD",
    payment_type: (input.payment_type as Property["payment_type"]) || "cash",
    city_id: asString(input.city_id),
    area: asString(input.area),
    address,
    coordinates,
    area_size: asNumber(input.area_size),
    bedrooms: asNumber(input.bedrooms),
    suit_rooms: asNumber(input.suit_rooms),
    bathrooms: asNumber(input.bathrooms),
    balconies: asNumber(input.balconies),
    floors: asNumber(input.floors, 1),
    condition: (input.condition as Property["condition"]) || "new",
    ownership_type: asString(input.ownership_type),
    amenities: asStringArray(input.amenities),
    view_id: asString(input.view_id),
    land_number: asString(input.land_number),
    total_floors: input.total_floors == null ? null : asNumber(input.total_floors),
    unit_floor_number: input.unit_floor_number == null ? null : asNumber(input.unit_floor_number),
    building_name: asString(input.building_name),
    tower_number: asString(input.tower_number),
    description,
    images,
    main_image: sanitizedMainImage || images[0] || "",
    video_url: asString(input.video_url),
    project_id: asString(input.project_id),
    owner_client_id: asString(input.owner_client_id),
    assigned_company_id: asString(input.assigned_company_id),
    assigned_viewer_id: asString(input.assigned_viewer_id),
    contact_name: asString(input.contact_name),
    primary_mobile_number: asString(input.primary_mobile_number),
    secondary_mobile_number: asString(input.secondary_mobile_number),
    internal_notes: asString(input.internal_notes),
  };
}

function validateFloorConsistency(data: { total_floors: number | null; unit_floor_number: number | null }) {
  const hasTotalFloors = typeof data.total_floors === "number" && Number.isFinite(data.total_floors);
  const hasUnitFloorNumber =
    typeof data.unit_floor_number === "number" && Number.isFinite(data.unit_floor_number);

  if (
    hasUnitFloorNumber &&
    hasTotalFloors &&
    (data.unit_floor_number as number) > (data.total_floors as number)
  ) {
    throw new Error("Unit floor number cannot be greater than total floors.");
  }
}

function mapDocToPropertyRecord(id: string, data: Record<string, unknown>): PropertyRecord {
  const address = (data.address || {}) as Partial<PropertyAddress>;
  const coordinates = (data.coordinates || {}) as Partial<PropertyCoordinates>;
  const description = (data.description || {}) as Partial<PropertyDescription>;

  const images = asStringArray(data.images);

  return {
    id,
    property_code: resolvePropertyCode(data, id),
    title: asString(data.title),
    type_id: asString(data.type_id),
    listing_type: (data.listing_type as Property["listing_type"]) || "sale",
    listing_date: asDateString(data.listing_date) || undefined,
    status: (data.status as Property["status"]) || "available",
    price: asNumber(data.price),
    currency: (data.currency as Property["currency"]) || "USD",
    payment_type: (data.payment_type as Property["payment_type"]) || "cash",
    city_id: asString(data.city_id),
    area: asString(data.area),
    address_en: asString(address.en),
    address_ku: asString(address.ku),
    address_ar: asString(address.ar),
    lat: asOptionalNumber(coordinates.lat),
    lng: asOptionalNumber(coordinates.lng),
    area_size: asNumber(data.area_size),
    bedrooms: asNumber(data.bedrooms),
    suit_rooms: asNumber(data.suit_rooms),
    bathrooms: asNumber(data.bathrooms),
    balconies: asNumber(data.balconies),
    floors: asNumber(data.floors, 1),
    condition: (data.condition as Property["condition"]) || "new",
    ownership_type: asString(data.ownership_type) || undefined,
    amenities: asStringArray(data.amenities),
    view_id: asString(data.view_id) || undefined,
    land_number: asString(data.land_number) || undefined,
    total_floors: data.total_floors == null ? undefined : asNumber(data.total_floors),
    unit_floor_number: data.unit_floor_number == null ? undefined : asNumber(data.unit_floor_number),
    building_name: asString(data.building_name) || undefined,
    tower_number: asString(data.tower_number) || undefined,
    description_en: asString(description.en),
    description_ku: asString(description.ku),
    description_ar: asString(description.ar),
    images,
    main_image: asString(data.main_image) || undefined,
    video_url: asString(data.video_url) || undefined,
    project_id: asString(data.project_id) || undefined,
    owner_client_id: asString(data.owner_client_id) || undefined,
    assigned_company_id: asString(data.assigned_company_id) || undefined,
    assigned_company_name: asString(data.assigned_company_name) || undefined,
    assigned_viewer_id: asString(data.assigned_viewer_id) || undefined,
    assigned_viewer_name: asString(data.assigned_viewer_name) || undefined,
    contact_name: asString(data.contact_name),
    primary_mobile_number: asString(data.primary_mobile_number),
    secondary_mobile_number: asString(data.secondary_mobile_number) || undefined,
    internal_notes: asString(data.internal_notes) || undefined,
    address: {
      en: asString(address.en),
      ku: asString(address.ku),
      ar: asString(address.ar),
    },
    coordinates: {
      lat: asNullableNumber(coordinates.lat),
      lng: asNullableNumber(coordinates.lng),
    },
    description: {
      en: asString(description.en),
      ku: asString(description.ku),
      ar: asString(description.ar),
    },
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
    sold_at: toIso(data.sold_at),
  };
}

export async function createProperty(
  data: PropertyWriteInput,
  scope?: PropertyAccessScope,
): Promise<PropertyRecord> {
  assertPropertyWritePermission(scope);

  const db = getAdminDb();
  const now = Timestamp.now();
  const normalized = normalizePropertyData(data);

  if (isCompanyScope(scope)) {
    normalized.assigned_company_id = scope.userId;
  }

  validateFloorConsistency(normalized);
  const propertyCode = await generateUniquePropertyCode(db);

  const payload = {
    ...normalized,
    property_code: propertyCode,
    sold_at: normalized.status === "sold" ? now : null,
    created_at: now,
    updated_at: now,
  };

  const docRef = await db.collection("properties").add(payload);
  const createdDoc = await docRef.get();

  return applyPropertyReadScope(mapDocToPropertyRecord(docRef.id, createdDoc.data() || {}), scope);
}

export async function getProperties(scope?: PropertyAccessScope): Promise<PropertyRecord[]> {
  const db = getAdminDb();
  const snapshot = await db.collection("properties").orderBy("updated_at", "desc").get();

  const records = snapshot.docs.map((doc) => mapDocToPropertyRecord(doc.id, doc.data()));
  const visibleRecords = isCompanyScope(scope)
    ? records.filter((record) => record.assigned_company_id === scope.userId)
    : isViewerScope(scope)
      ? records.filter((record) => record.assigned_viewer_id === scope.userId)
      : records;

  const assignmentUserIds = asUniqueStrings(
    visibleRecords.flatMap((record) => [record.assigned_company_id || "", record.assigned_viewer_id || ""]),
  );
  const namesByUserId = await resolveUserDisplayNames(assignmentUserIds);

  return visibleRecords.map((record) =>
    applyPropertyReadScope(withPropertyAssignmentNames(record, namesByUserId), scope),
  );
}

export async function updateProperty(
  id: string,
  data: PropertyWriteInput,
  scope?: PropertyAccessScope,
): Promise<PropertyRecord> {
  assertPropertyWritePermission(scope);

  const db = getAdminDb();
  const docRef = db.collection("properties").doc(id);

  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    throw new Error("Property not found.");
  }

  assertCompanyPropertyWriteAccess((existingDoc.data() || {}) as Record<string, unknown>, scope);

  const now = Timestamp.now();
  const normalized = normalizePropertyData(data);

  if (isCompanyScope(scope)) {
    normalized.assigned_company_id = scope.userId;
  }

  validateFloorConsistency(normalized);

  const payload = {
    ...normalized,
    sold_at: normalized.status === "sold" ? now : null,
    updated_at: now,
  };

  await docRef.set(payload, { merge: true });

  const updatedDoc = await docRef.get();
  return applyPropertyReadScope(mapDocToPropertyRecord(id, updatedDoc.data() || {}), scope);
}

export async function deleteProperty(id: string, scope?: PropertyAccessScope): Promise<void> {
  assertPropertyWritePermission(scope);

  const db = getAdminDb();
  const docRef = db.collection("properties").doc(id);

  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    throw new Error("Property not found.");
  }

  const data = (existingDoc.data() || {}) as Record<string, unknown>;
  assertCompanyPropertyWriteAccess(data, scope);
  await deletePropertyStorageAssets(id, data);
  await docRef.delete();
}

export async function assertPropertyWriteAccess(
  id: string,
  scope?: PropertyAccessScope,
): Promise<void> {
  if (isViewerScope(scope)) {
    throw new Error("Forbidden.");
  }

  if (!isCompanyScope(scope)) {
    return;
  }

  const db = getAdminDb();
  const docRef = db.collection("properties").doc(id);
  const existingDoc = await docRef.get();

  if (!existingDoc.exists) {
    throw new Error("Property not found.");
  }

  assertCompanyPropertyWriteAccess((existingDoc.data() || {}) as Record<string, unknown>, scope);
}
