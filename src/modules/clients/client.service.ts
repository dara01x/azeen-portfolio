import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Client } from "@/types";

type ClientRecord = Client & {
  created_at: string | null;
  updated_at: string | null;
};

type ClientWriteInput = Partial<Client>;

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeStatus(value: unknown): Client["status"] {
  return value === "inactive" ? "inactive" : "active";
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

function normalizeClientData(input: ClientWriteInput) {
  return {
    full_name: asString(input.full_name).trim(),
    primary_phone: asString(input.primary_phone).trim(),
    secondary_phone: asString(input.secondary_phone).trim(),
    email: asString(input.email).trim(),
    notes: asString(input.notes).trim(),
    status: normalizeStatus(input.status),
  };
}

function mapDocToClientRecord(id: string, data: Record<string, unknown>): ClientRecord {
  const secondaryPhone = asString(data.secondary_phone).trim();
  const email = asString(data.email).trim();
  const notes = asString(data.notes).trim();

  return {
    id,
    full_name: asString(data.full_name),
    primary_phone: asString(data.primary_phone),
    secondary_phone: secondaryPhone || undefined,
    email: email || undefined,
    notes: notes || undefined,
    status: normalizeStatus(data.status),
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
  };
}

function validateRequiredClientFields(data: { full_name: string; primary_phone: string }) {
  if (!data.full_name) {
    throw new Error("Client full name is required.");
  }

  if (!data.primary_phone) {
    throw new Error("Client primary phone is required.");
  }
}

export async function createClient(data: ClientWriteInput): Promise<ClientRecord> {
  const db = getAdminDb();
  const now = Timestamp.now();
  const normalized = normalizeClientData(data);

  validateRequiredClientFields(normalized);

  const payload: Record<string, unknown> = {
    full_name: normalized.full_name,
    primary_phone: normalized.primary_phone,
    status: normalized.status,
    created_at: now,
    updated_at: now,
  };

  if (normalized.secondary_phone) {
    payload.secondary_phone = normalized.secondary_phone;
  }

  if (normalized.email) {
    payload.email = normalized.email;
  }

  if (normalized.notes) {
    payload.notes = normalized.notes;
  }

  const docRef = await db.collection("clients").add(payload);
  const createdDoc = await docRef.get();

  return mapDocToClientRecord(docRef.id, createdDoc.data() || {});
}

export async function getClients(): Promise<ClientRecord[]> {
  const db = getAdminDb();
  const snapshot = await db.collection("clients").orderBy("updated_at", "desc").get();

  return snapshot.docs.map((doc) => mapDocToClientRecord(doc.id, doc.data()));
}

export async function updateClient(id: string, data: ClientWriteInput): Promise<ClientRecord> {
  const db = getAdminDb();
  const docRef = db.collection("clients").doc(id);

  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    throw new Error("Client not found.");
  }

  const now = Timestamp.now();
  const normalized = normalizeClientData(data);

  validateRequiredClientFields(normalized);

  const payload: Record<string, unknown> = {
    full_name: normalized.full_name,
    primary_phone: normalized.primary_phone,
    status: normalized.status,
    updated_at: now,
  };

  if (normalized.secondary_phone) {
    payload.secondary_phone = normalized.secondary_phone;
  }

  if (normalized.email) {
    payload.email = normalized.email;
  }

  if (normalized.notes) {
    payload.notes = normalized.notes;
  }

  await docRef.set(payload, { merge: true });

  const updatedDoc = await docRef.get();
  return mapDocToClientRecord(id, updatedDoc.data() || {});
}

export async function deleteClient(id: string): Promise<void> {
  const db = getAdminDb();
  const docRef = db.collection("clients").doc(id);

  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    throw new Error("Client not found.");
  }

  await docRef.delete();
}
