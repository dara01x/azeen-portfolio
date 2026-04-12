import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import type { Unit } from "@/types";

const UNIT_CODE_PREFIX = "U";
const UNIT_CODE_LENGTH = 6;

type UnitRecord = Unit & {
  created_at: string | null;
  updated_at: string | null;
  sold_at: string | null;
};

type UnitWriteInput = Partial<Unit>;

type UnitAccessScope = {
  role: "admin" | "company";
  userId: string;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
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

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
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

function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

function isCompanyScope(scope?: UnitAccessScope): scope is UnitAccessScope & { role: "company" } {
  return !!scope && scope.role === "company";
}

function normalizeUnitStatus(value: unknown): Unit["status"] {
  if (value === "available" || value === "sold" || value === "archived") {
    return value;
  }

  return "available";
}

function normalizeUnitCurrency(value: unknown): Unit["currency"] {
  return value === "IQD" ? "IQD" : "USD";
}

function normalizeUnitPaymentType(value: unknown): Unit["payment_type"] {
  return value === "installment" ? "installment" : "cash";
}

function normalizeUnitOptionCurrency(value: unknown): Unit["currency"] {
  return value === "IQD" ? "IQD" : "USD";
}

function asInterfaceArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return asUniqueStrings(
    value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean),
  );
}

function normalizeUnitFeaturesValue(value: unknown) {
  const raw = (value || {}) as Partial<Record<"bedrooms" | "bathrooms" | "suit_rooms" | "balconies", unknown>>;

  return {
    bedrooms: asNumber(raw.bedrooms),
    bathrooms: asNumber(raw.bathrooms),
    suit_rooms: asNumber(raw.suit_rooms),
    balconies: asNumber(raw.balconies),
  };
}

function normalizeUnitPropertiesValue(value: unknown): Unit["properties"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const raw = (item || {}) as Partial<
        Record<"price" | "currency" | "interface" | "building_no" | "floor_no" | "active" | "sold", unknown>
      >;

      return {
        price: asNumber(raw.price),
        currency: normalizeUnitOptionCurrency(raw.currency),
        interface: asInterfaceArray(raw.interface),
        building_no: asString(raw.building_no).trim() || undefined,
        floor_no: asString(raw.floor_no).trim() || undefined,
        active: asBoolean(raw.active),
        sold: asBoolean(raw.sold),
      };
    })
    .filter((item) => Number.isFinite(item.price));
}

function deriveStatusFromProperties(properties: Unit["properties"]): Unit["status"] {
  if (properties.length === 0) {
    return "available";
  }

  const total = properties.length;
  const soldCount = properties.filter((item) => item.sold).length;
  const activeAvailableCount = properties.filter((item) => item.active && !item.sold).length;

  if (soldCount === total) {
    return "sold";
  }

  if (activeAvailableCount > 0) {
    return "available";
  }

  return "archived";
}

function inferFloorNumberFromProperties(properties: Unit["properties"]) {
  const fromOption = properties.find((item) => item.floor_no && item.floor_no.trim());
  if (!fromOption?.floor_no) {
    return undefined;
  }

  const parsed = Number(fromOption.floor_no);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeUnitCode(value: string) {
  return value.trim().toUpperCase();
}

function buildUnitCodeFromId(id: string) {
  const compact = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const shortBody = compact.slice(0, UNIT_CODE_LENGTH).padEnd(UNIT_CODE_LENGTH, "0");
  return `${UNIT_CODE_PREFIX}${shortBody}`;
}

function resolveUnitCode(data: Record<string, unknown>, id: string) {
  const code = normalizeUnitCode(asString(data.unit_code));
  if (code) {
    return code;
  }

  return buildUnitCodeFromId(id);
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

function extractUnitImageUrls(data: Record<string, unknown>) {
  const mainImage = asString(data.main_image);
  const images = asStringArray(data.images);
  return asUniqueStrings([...images, mainImage]);
}

async function deleteUnitStorageAssets(id: string, data: Record<string, unknown>) {
  const bucket = getAdminStorageBucket();
  const imageUrls = extractUnitImageUrls(data);
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
    await bucket.deleteFiles({ prefix: `units/${id}/`, force: true });
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

function normalizeUnitData(input: UnitWriteInput) {
  const images = asStringArray(input.images).filter((image) => !isLocalPreviewUrl(image));
  const mainImageInput = asString(input.main_image);
  const sanitizedMainImage = isLocalPreviewUrl(mainImageInput) ? "" : mainImageInput;
  const normalizedFeatures = normalizeUnitFeaturesValue(input.features);
  const normalizedProperties = normalizeUnitPropertiesValue(input.properties);
  const derivedStatus = deriveStatusFromProperties(normalizedProperties);
  const primaryProperty = normalizedProperties[0];
  const floorNumberFromProperties = inferFloorNumberFromProperties(normalizedProperties);
  const explicitStatus = input.status;
  const normalizedStatus =
    explicitStatus === "available" || explicitStatus === "sold" || explicitStatus === "archived"
      ? explicitStatus
      : derivedStatus;

  return {
    unit_code: normalizeUnitCode(asString(input.unit_code)),
    project_id: asString(input.project_id).trim(),
    unit_number: asString(input.unit_number).trim(),
    title: asString(input.title).trim(),
    status: normalizeUnitStatus(normalizedStatus),
    price: primaryProperty ? asNumber(primaryProperty.price) : asNumber(input.price),
    currency: primaryProperty
      ? normalizeUnitCurrency(primaryProperty.currency)
      : normalizeUnitCurrency(input.currency),
    payment_type: normalizeUnitPaymentType(input.payment_type),
    type_id: asString(input.type_id).trim(),
    area_size: asNumber(input.area_size),
    bedrooms: normalizedFeatures.bedrooms,
    suit_rooms: normalizedFeatures.suit_rooms,
    bathrooms: normalizedFeatures.bathrooms,
    balconies: normalizedFeatures.balconies,
    floor_number:
      input.floor_number == null
        ? floorNumberFromProperties == null
          ? null
          : asNumber(floorNumberFromProperties)
        : asNumber(input.floor_number),
    features: normalizedFeatures,
    properties: normalizedProperties,
    images,
    main_image: sanitizedMainImage || images[0] || "",
    assigned_company_id: asString(input.assigned_company_id).trim(),
    internal_notes: asString(input.internal_notes).trim(),
  };
}

function assertUnitDataIsValid(data: ReturnType<typeof normalizeUnitData>) {
  if (!data.project_id) {
    throw new Error("Project is required.");
  }

  if (!data.type_id) {
    throw new Error("Unit type is required.");
  }

  if (data.price < 0) {
    throw new Error("Price cannot be negative.");
  }

  if (data.area_size <= 0) {
    throw new Error("Area size is required.");
  }

  if (data.bedrooms < 0 || data.suit_rooms < 0 || data.bathrooms < 0) {
    throw new Error("Room values cannot be negative.");
  }

  if (data.balconies < 0) {
    throw new Error("Room values cannot be negative.");
  }

  if (data.floor_number != null && data.floor_number < 0) {
    throw new Error("Floor number cannot be negative.");
  }

  if (!Array.isArray(data.properties) || data.properties.length === 0) {
    throw new Error("At least one unit option is required.");
  }

  if (data.properties.some((item) => item.price < 0)) {
    throw new Error("Price cannot be negative.");
  }
}

async function getProjectAssignedCompanyId(projectId: string) {
  const db = getAdminDb();
  const docRef = db.collection("projects").doc(projectId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new Error("Project not found.");
  }

  const data = (docSnap.data() || {}) as Record<string, unknown>;
  return asString(data.assigned_company_id).trim();
}

async function assertUniqueUnitNumber(projectId: string, unitNumber: string, excludeId?: string) {
  if (!unitNumber.trim()) {
    return;
  }

  const db = getAdminDb();
  const snapshot = await db.collection("units").where("project_id", "==", projectId).get();
  const normalizedNumber = unitNumber.trim().toLowerCase();

  const hasDuplicate = snapshot.docs.some((doc) => {
    if (excludeId && doc.id === excludeId) {
      return false;
    }

    const data = doc.data() as Record<string, unknown>;
    const existingNumber = asString(data.unit_number).trim().toLowerCase();
    return existingNumber === normalizedNumber;
  });

  if (hasDuplicate) {
    throw new Error("Unit number already exists in this project.");
  }
}

async function resolveAssignedCompanyId(
  data: ReturnType<typeof normalizeUnitData>,
  scope?: UnitAccessScope,
) {
  const projectAssignedCompanyId = await getProjectAssignedCompanyId(data.project_id);

  if (isCompanyScope(scope)) {
    if (!projectAssignedCompanyId || projectAssignedCompanyId !== scope.userId) {
      throw new Error("Forbidden.");
    }

    return scope.userId;
  }

  return data.assigned_company_id || projectAssignedCompanyId;
}

async function assertCompanyUnitWriteAccess(
  existingData: Record<string, unknown>,
  scope?: UnitAccessScope,
) {
  if (!isCompanyScope(scope)) {
    return;
  }

  const assignedCompanyId = asString(existingData.assigned_company_id).trim();

  if (assignedCompanyId) {
    if (assignedCompanyId !== scope.userId) {
      throw new Error("Forbidden.");
    }

    return;
  }

  const projectId = asString(existingData.project_id).trim();
  if (!projectId) {
    throw new Error("Forbidden.");
  }

  try {
    const projectAssignedCompanyId = await getProjectAssignedCompanyId(projectId);

    if (!projectAssignedCompanyId || projectAssignedCompanyId !== scope.userId) {
      throw new Error("Forbidden.");
    }
  } catch {
    throw new Error("Forbidden.");
  }
}

function mapDocToUnitRecord(id: string, data: Record<string, unknown>): UnitRecord {
  const unitNumber = asString(data.unit_number).trim();
  const images = asStringArray(data.images);
  const normalizedProperties = normalizeUnitPropertiesValue(data.properties);
  const fallbackProperty: Unit["properties"][number] = {
    price: asNumber(data.price),
    currency: normalizeUnitCurrency(data.currency),
    interface: [],
    building_no: undefined,
    floor_no: asOptionalNumber(data.floor_number)?.toString(),
    active: normalizeUnitStatus(data.status) === "available",
    sold: normalizeUnitStatus(data.status) === "sold",
  };
  const properties = normalizedProperties.length > 0 ? normalizedProperties : [fallbackProperty];
  const hasFeaturesObject = !!data.features && typeof data.features === "object";
  const features = hasFeaturesObject
    ? normalizeUnitFeaturesValue(data.features)
    : {
        bedrooms: asNumber(data.bedrooms),
        bathrooms: asNumber(data.bathrooms),
        suit_rooms: asNumber(data.suit_rooms),
        balconies: asNumber(data.balconies),
      };
  const inferredStatus = deriveStatusFromProperties(properties);
  const statusValue =
    data.status === "available" || data.status === "sold" || data.status === "archived"
      ? normalizeUnitStatus(data.status)
      : inferredStatus;
  const primaryProperty = properties[0];
  const inferredFloorNumber = inferFloorNumberFromProperties(properties);

  return {
    id,
    unit_code: resolveUnitCode(data, id),
    project_id: asString(data.project_id).trim(),
    unit_number: unitNumber || undefined,
    title: asString(data.title).trim() || unitNumber || resolveUnitCode(data, id),
    status: statusValue,
    price: primaryProperty ? asNumber(primaryProperty.price) : asNumber(data.price),
    currency: primaryProperty
      ? normalizeUnitCurrency(primaryProperty.currency)
      : normalizeUnitCurrency(data.currency),
    payment_type: normalizeUnitPaymentType(data.payment_type),
    type_id: asString(data.type_id).trim() || undefined,
    area_size: asNumber(data.area_size),
    bedrooms: features.bedrooms,
    suit_rooms: features.suit_rooms,
    bathrooms: features.bathrooms,
    balconies: features.balconies,
    floor_number: asOptionalNumber(data.floor_number) ?? inferredFloorNumber,
    features,
    properties,
    images,
    main_image: asString(data.main_image) || undefined,
    assigned_company_id: asString(data.assigned_company_id).trim() || undefined,
    internal_notes: asString(data.internal_notes).trim() || undefined,
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
    sold_at: toIso(data.sold_at),
  };
}

export async function createUnit(data: UnitWriteInput, scope?: UnitAccessScope): Promise<UnitRecord> {
  const db = getAdminDb();
  const now = Timestamp.now();
  const normalized = normalizeUnitData(data);

  if (!normalized.title) {
    normalized.title = normalized.unit_number || normalized.type_id || "Unit";
  }

  assertUnitDataIsValid(normalized);
  await assertUniqueUnitNumber(normalized.project_id, normalized.unit_number);

  const assignedCompanyId = await resolveAssignedCompanyId(normalized, scope);

  const payload = {
    ...normalized,
    assigned_company_id: assignedCompanyId,
    sold_at: normalized.status === "sold" ? now : null,
    created_at: now,
    updated_at: now,
  };

  const docRef = await db.collection("units").add(payload);
  const createdDoc = await docRef.get();

  return mapDocToUnitRecord(docRef.id, createdDoc.data() || {});
}

export async function getUnits(scope?: UnitAccessScope): Promise<UnitRecord[]> {
  const db = getAdminDb();
  const snapshot = await db.collection("units").orderBy("updated_at", "desc").get();
  const records = snapshot.docs.map((doc) => mapDocToUnitRecord(doc.id, doc.data()));

  if (!isCompanyScope(scope)) {
    return records;
  }

  return records.filter((record) => record.assigned_company_id === scope.userId);
}

export async function updateUnit(
  id: string,
  data: UnitWriteInput,
  scope?: UnitAccessScope,
): Promise<UnitRecord> {
  const db = getAdminDb();
  const docRef = db.collection("units").doc(id);

  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    throw new Error("Unit not found.");
  }

  const existingData = (existingDoc.data() || {}) as Record<string, unknown>;
  await assertCompanyUnitWriteAccess(existingData, scope);

  const normalized = normalizeUnitData(data);

  if (!normalized.project_id) {
    normalized.project_id = asString(existingData.project_id).trim();
  }

  if (!normalized.unit_number) {
    normalized.unit_number = asString(existingData.unit_number).trim();
  }

  if (!normalized.title) {
    normalized.title =
      asString(existingData.title).trim() || normalized.unit_number || normalized.type_id || "Unit";
  }

  assertUnitDataIsValid(normalized);
  await assertUniqueUnitNumber(normalized.project_id, normalized.unit_number, id);

  const assignedCompanyId = await resolveAssignedCompanyId(normalized, scope);
  const now = Timestamp.now();

  const payload = {
    ...normalized,
    assigned_company_id: assignedCompanyId,
    sold_at: normalized.status === "sold" ? now : null,
    updated_at: now,
  };

  await docRef.set(payload, { merge: true });

  const updatedDoc = await docRef.get();
  return mapDocToUnitRecord(id, updatedDoc.data() || {});
}

export async function deleteUnit(id: string, scope?: UnitAccessScope): Promise<void> {
  const db = getAdminDb();
  const docRef = db.collection("units").doc(id);

  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    throw new Error("Unit not found.");
  }

  const existingData = (existingDoc.data() || {}) as Record<string, unknown>;
  await assertCompanyUnitWriteAccess(existingData, scope);
  await deleteUnitStorageAssets(id, existingData);

  await docRef.delete();
}

export async function assertUnitWriteAccess(id: string, scope?: UnitAccessScope): Promise<void> {
  if (!isCompanyScope(scope)) {
    return;
  }

  const db = getAdminDb();
  const docRef = db.collection("units").doc(id);
  const existingDoc = await docRef.get();

  if (!existingDoc.exists) {
    throw new Error("Unit not found.");
  }

  await assertCompanyUnitWriteAccess((existingDoc.data() || {}) as Record<string, unknown>, scope);
}
