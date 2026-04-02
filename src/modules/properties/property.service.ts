import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Property } from "@/types";

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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
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
  const images = asStringArray(input.images);

  return {
    title: asString(input.title),
    type_id: asString(input.type_id),
    listing_type: (input.listing_type as Property["listing_type"]) || "sale",
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
    bathrooms: asNumber(input.bathrooms),
    floors: asNumber(input.floors, 1),
    condition: (input.condition as Property["condition"]) || "new",
    amenities: asStringArray(input.amenities),
    view_id: asString(input.view_id),
    land_number: asString(input.land_number),
    total_floors: input.total_floors == null ? null : asNumber(input.total_floors),
    unit_floor_number: input.unit_floor_number == null ? null : asNumber(input.unit_floor_number),
    building_name: asString(input.building_name),
    description,
    images,
    main_image: asString(input.main_image) || images[0] || "",
    video_url: asString(input.video_url),
    project_id: asString(input.project_id),
    owner_client_id: asString(input.owner_client_id),
    assigned_company_id: asString(input.assigned_company_id),
    internal_notes: asString(input.internal_notes),
  };
}

function mapDocToPropertyRecord(id: string, data: Record<string, unknown>): PropertyRecord {
  const address = (data.address || {}) as Partial<PropertyAddress>;
  const coordinates = (data.coordinates || {}) as Partial<PropertyCoordinates>;
  const description = (data.description || {}) as Partial<PropertyDescription>;

  const images = asStringArray(data.images);

  return {
    id,
    title: asString(data.title),
    type_id: asString(data.type_id),
    listing_type: (data.listing_type as Property["listing_type"]) || "sale",
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
    bathrooms: asNumber(data.bathrooms),
    floors: asNumber(data.floors, 1),
    condition: (data.condition as Property["condition"]) || "new",
    amenities: asStringArray(data.amenities),
    view_id: asString(data.view_id) || undefined,
    land_number: asString(data.land_number) || undefined,
    total_floors: data.total_floors == null ? undefined : asNumber(data.total_floors),
    unit_floor_number: data.unit_floor_number == null ? undefined : asNumber(data.unit_floor_number),
    building_name: asString(data.building_name) || undefined,
    description_en: asString(description.en),
    description_ku: asString(description.ku),
    description_ar: asString(description.ar),
    images,
    main_image: asString(data.main_image) || undefined,
    video_url: asString(data.video_url) || undefined,
    project_id: asString(data.project_id) || undefined,
    owner_client_id: asString(data.owner_client_id) || undefined,
    assigned_company_id: asString(data.assigned_company_id) || undefined,
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

export async function createProperty(data: PropertyWriteInput): Promise<PropertyRecord> {
  const db = getAdminDb();
  const now = Timestamp.now();
  const normalized = normalizePropertyData(data);

  const payload = {
    ...normalized,
    sold_at: normalized.status === "sold" ? now : null,
    created_at: now,
    updated_at: now,
  };

  const docRef = await db.collection("properties").add(payload);
  const createdDoc = await docRef.get();

  return mapDocToPropertyRecord(docRef.id, createdDoc.data() || {});
}

export async function getProperties(): Promise<PropertyRecord[]> {
  const db = getAdminDb();
  const snapshot = await db.collection("properties").orderBy("updated_at", "desc").get();

  return snapshot.docs.map((doc) => mapDocToPropertyRecord(doc.id, doc.data()));
}

export async function updateProperty(id: string, data: PropertyWriteInput): Promise<PropertyRecord> {
  const db = getAdminDb();
  const docRef = db.collection("properties").doc(id);

  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    throw new Error("Property not found.");
  }

  const now = Timestamp.now();
  const normalized = normalizePropertyData(data);

  const payload = {
    ...normalized,
    sold_at: normalized.status === "sold" ? now : null,
    updated_at: now,
  };

  await docRef.set(payload, { merge: true });

  const updatedDoc = await docRef.get();
  return mapDocToPropertyRecord(id, updatedDoc.data() || {});
}
