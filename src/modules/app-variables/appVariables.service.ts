import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  APP_VARIABLE_TYPES,
  type AppVariableItem,
  type AppVariableType,
  type AreaBoundaryPoint,
} from "@/modules/app-variables/types";

function isValidType(value: string): value is AppVariableType {
  return (APP_VARIABLE_TYPES as readonly string[]).includes(value);
}

function normalizeType(value: string): AppVariableType {
  if (!isValidType(value)) {
    throw new Error("Invalid variable type.");
  }

  return value;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeBoundaryPoint(value: unknown): AreaBoundaryPoint | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const lat = asNumber((value as { lat?: unknown }).lat);
  const lng = asNumber((value as { lng?: unknown }).lng);

  if (lat == null || lng == null) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

function normalizeAreaBoundary(value: unknown): AreaBoundaryPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Map<string, AreaBoundaryPoint>();
  value.forEach((entry) => {
    const point = normalizeBoundaryPoint(entry);
    if (!point) {
      return;
    }

    deduped.set(`${point.lat},${point.lng}`, point);
  });

  return Array.from(deduped.values());
}

function computeAreaCenter(points: AreaBoundaryPoint[]): AreaBoundaryPoint | null {
  if (points.length === 0) {
    return null;
  }

  const sums = points.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: Number((sums.lat / points.length).toFixed(6)),
    lng: Number((sums.lng / points.length).toFixed(6)),
  };
}

function normalizeAreaPayload(type: AppVariableType, payload?: { area_boundary?: unknown }) {
  if (type !== "areas") {
    return { area_boundary: undefined, area_center: undefined };
  }

  const boundary = normalizeAreaBoundary(payload?.area_boundary);
  if (boundary.length > 0 && boundary.length < 3) {
    throw new Error("Area boundary must contain at least 3 points.");
  }

  return {
    area_boundary: boundary,
    area_center: computeAreaCenter(boundary),
  };
}

function mapDocToItem(id: string, data: Record<string, unknown>): AppVariableItem {
  const createdAt = data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : null;
  const areaBoundary = normalizeAreaBoundary(data.area_boundary);
  const areaCenter = normalizeBoundaryPoint(data.area_center);

  return {
    id,
    name: typeof data.name === "string" ? data.name : "",
    created_at: createdAt,
    area_boundary: areaBoundary.length > 0 ? areaBoundary : undefined,
    area_center: areaCenter,
  };
}

export async function createVariable(
  typeInput: string,
  nameInput: string,
  payloadInput?: { area_boundary?: unknown },
): Promise<AppVariableItem> {
  const type = normalizeType(typeInput);
  const name = nameInput.trim();

  if (!name) {
    throw new Error("Name is required.");
  }

  const areaPayload = normalizeAreaPayload(type, payloadInput);

  const db = getAdminDb();
  const created_at = Timestamp.now();

  const docRef = await db.collection(type).add({
    name,
    created_at,
    ...(type === "areas" ? areaPayload : {}),
  });

  return {
    id: docRef.id,
    name,
    created_at: created_at.toDate().toISOString(),
    ...(type === "areas"
      ? {
          area_boundary: areaPayload.area_boundary,
          area_center: areaPayload.area_center,
        }
      : {}),
  };
}

export async function getVariables(typeInput: string): Promise<AppVariableItem[]> {
  const type = normalizeType(typeInput);

  const db = getAdminDb();
  const snapshot = await db.collection(type).orderBy("created_at", "asc").get();

  return snapshot.docs
    .map((doc) => mapDocToItem(doc.id, doc.data()))
    .filter((item) => item.name.length > 0);
}

export async function updateVariable(
  typeInput: string,
  idInput: string,
  nameInput: string,
  payloadInput?: { area_boundary?: unknown },
): Promise<AppVariableItem> {
  const type = normalizeType(typeInput);
  const id = idInput.trim();
  const name = nameInput.trim();

  if (!id) {
    throw new Error("Variable id is required.");
  }

  if (!name) {
    throw new Error("Name is required.");
  }

  const areaPayload = normalizeAreaPayload(type, payloadInput);

  const db = getAdminDb();
  const docRef = db.collection(type).doc(id);
  const existing = await docRef.get();

  if (!existing.exists) {
    throw new Error("Variable not found.");
  }

  await docRef.set(
    {
      name,
      ...(type === "areas" ? areaPayload : {}),
    },
    { merge: true },
  );

  const updated = await docRef.get();
  return mapDocToItem(updated.id, updated.data() || {});
}

export async function deleteVariable(typeInput: string, idInput: string): Promise<void> {
  const type = normalizeType(typeInput);
  const id = idInput.trim();

  if (!id) {
    throw new Error("Variable id is required.");
  }

  const db = getAdminDb();
  const docRef = db.collection(type).doc(id);
  const existing = await docRef.get();

  if (!existing.exists) {
    throw new Error("Variable not found.");
  }

  await docRef.delete();
}
