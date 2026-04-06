import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { APP_VARIABLE_TYPES, type AppVariableItem, type AppVariableType } from "@/modules/app-variables/types";

function isValidType(value: string): value is AppVariableType {
  return (APP_VARIABLE_TYPES as readonly string[]).includes(value);
}

function normalizeType(value: string): AppVariableType {
  if (!isValidType(value)) {
    throw new Error("Invalid variable type.");
  }

  return value;
}

function mapDocToItem(id: string, data: Record<string, unknown>): AppVariableItem {
  const createdAt = data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : null;

  return {
    id,
    name: typeof data.name === "string" ? data.name : "",
    created_at: createdAt,
  };
}

export async function createVariable(typeInput: string, nameInput: string): Promise<AppVariableItem> {
  const type = normalizeType(typeInput);
  const name = nameInput.trim();

  if (!name) {
    throw new Error("Name is required.");
  }

  const db = getAdminDb();
  const created_at = Timestamp.now();

  const docRef = await db.collection(type).add({
    name,
    created_at,
  });

  return {
    id: docRef.id,
    name,
    created_at: created_at.toDate().toISOString(),
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

  const db = getAdminDb();
  const docRef = db.collection(type).doc(id);
  const existing = await docRef.get();

  if (!existing.exists) {
    throw new Error("Variable not found.");
  }

  await docRef.set({ name }, { merge: true });

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
