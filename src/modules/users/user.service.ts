import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import type { User } from "@/types";

type UserRecord = User & {
  created_at: string | null;
  updated_at: string | null;
};

type UserWriteInput = Partial<User>;

type UserAuthOptions = {
  password?: string;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeRole(value: unknown): User["role"] {
  if (value === "company" || value === "admin" || value === "viewer") {
    return value;
  }

  if (value === "owner" || value === "manager") {
    return "admin";
  }

  return "admin";
}

function normalizeStatus(value: unknown): User["status"] {
  return value === "disabled" ? "disabled" : "active";
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

function parseIsoTime(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeUserData(input: UserWriteInput) {
  return {
    full_name: asString(input.full_name).trim(),
    email: asString(input.email).trim().toLowerCase(),
    role: normalizeRole(input.role),
    status: normalizeStatus(input.status),
    phone: asString(input.phone).trim(),
    company_name: asString(input.company_name).trim(),
    company_phone: asString(input.company_phone).trim(),
    company_address: asString(input.company_address).trim(),
  };
}

function normalizePassword(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function validatePassword(password: string) {
  if (!password) {
    throw new Error("Password is required.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
}

function hasPassword(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFirebaseAuthError(error: unknown): error is { code: string } {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

function mapFirebaseAuthError(error: unknown, fallbackMessage: string): Error {
  if (isFirebaseAuthError(error)) {
    if (error.code === "auth/email-already-exists") {
      return new Error("User email already exists.");
    }

    if (error.code === "auth/invalid-password") {
      return new Error("Password must be at least 6 characters.");
    }

    if (error.code === "auth/user-not-found") {
      return new Error("User login account was not found.");
    }
  }

  return new Error(fallbackMessage);
}

async function resolveAuthUidForUserDoc(
  userDocId: string,
  email: string,
  storedAuthUid?: unknown,
): Promise<string | null> {
  const adminAuth = getAdminAuth();

  if (typeof storedAuthUid === "string" && storedAuthUid.trim()) {
    const normalizedUid = storedAuthUid.trim();

    try {
      await adminAuth.getUser(normalizedUid);
      return normalizedUid;
    } catch (error) {
      if (!isFirebaseAuthError(error) || error.code !== "auth/user-not-found") {
        throw mapFirebaseAuthError(error, "Failed to verify user login account.");
      }
    }
  }

  try {
    await adminAuth.getUser(userDocId);
    return userDocId;
  } catch (error) {
    if (!isFirebaseAuthError(error) || error.code !== "auth/user-not-found") {
      throw mapFirebaseAuthError(error, "Failed to verify user login account.");
    }
  }

  if (!email.trim()) {
    return null;
  }

  try {
    const authUser = await adminAuth.getUserByEmail(email);
    return authUser.uid;
  } catch (error) {
    if (isFirebaseAuthError(error) && error.code === "auth/user-not-found") {
      return null;
    }

    throw mapFirebaseAuthError(error, "Failed to verify user login account.");
  }
}

function mapDocToUserRecord(id: string, data: Record<string, unknown>): UserRecord {
  const companyName = asString(data.company_name).trim();
  const companyPhone = asString(data.company_phone).trim();
  const companyAddress = asString(data.company_address).trim();

  return {
    id,
    full_name: asString(data.full_name).trim(),
    email: asString(data.email).trim(),
    role: normalizeRole(data.role),
    status: normalizeStatus(data.status),
    phone: asString(data.phone).trim(),
    company_name: companyName || undefined,
    company_phone: companyPhone || undefined,
    company_address: companyAddress || undefined,
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
  };
}

function validateRequiredUserFields(data: { full_name: string; email: string; phone: string }) {
  if (!data.full_name) {
    throw new Error("User full name is required.");
  }

  if (!data.email) {
    throw new Error("User email is required.");
  }

  if (!isValidEmail(data.email)) {
    throw new Error("User email is invalid.");
  }

  if (!data.phone) {
    throw new Error("User phone is required.");
  }
}

async function ensureUniqueEmail(email: string, excludeId?: string) {
  const db = getAdminDb();
  const snapshot = await db.collection("users").get();
  const normalizedEmail = email.trim().toLowerCase();

  const hasConflict = snapshot.docs.some((doc) => {
    if (excludeId && doc.id === excludeId) {
      return false;
    }

    const docEmail = asString(doc.data().email).trim().toLowerCase();
    return docEmail.length > 0 && docEmail === normalizedEmail;
  });

  if (hasConflict) {
    throw new Error("User email already exists.");
  }
}

export async function createUser(data: UserWriteInput, options: UserAuthOptions = {}): Promise<UserRecord> {
  const db = getAdminDb();
  const adminAuth = getAdminAuth();
  const now = Timestamp.now();
  const normalized = normalizeUserData(data);
  const password = normalizePassword(options.password);

  validateRequiredUserFields(normalized);
  validatePassword(password);
  await ensureUniqueEmail(normalized.email);

  let authUid = "";

  try {
    const authUser = await adminAuth.createUser({
      email: normalized.email,
      password,
      displayName: normalized.full_name,
      disabled: normalized.status === "disabled",
    });

    authUid = authUser.uid;
  } catch (error) {
    throw mapFirebaseAuthError(error, "Failed to create user login account.");
  }

  const payload: Record<string, unknown> = {
    auth_uid: authUid,
    full_name: normalized.full_name,
    email: normalized.email,
    role: normalized.role,
    status: normalized.status,
    phone: normalized.phone,
    created_at: now,
    updated_at: now,
  };

  if (normalized.role === "company") {
    if (normalized.company_name) {
      payload.company_name = normalized.company_name;
    }

    if (normalized.company_phone) {
      payload.company_phone = normalized.company_phone;
    }

    if (normalized.company_address) {
      payload.company_address = normalized.company_address;
    }
  }

  const docRef = db.collection("users").doc(authUid);

  try {
    await docRef.set(payload, { merge: true });
  } catch (error) {
    try {
      await adminAuth.deleteUser(authUid);
    } catch {
      // Keep original Firestore failure as the source error.
    }

    throw error;
  }

  const createdDoc = await docRef.get();

  return mapDocToUserRecord(authUid, createdDoc.data() || {});
}

export async function getUsers(): Promise<UserRecord[]> {
  const db = getAdminDb();
  const snapshot = await db.collection("users").get();

  const users = snapshot.docs.map((doc) => mapDocToUserRecord(doc.id, doc.data()));

  return users.sort((a, b) => {
    const aTime = parseIsoTime(a.updated_at || a.created_at);
    const bTime = parseIsoTime(b.updated_at || b.created_at);
    return bTime - aTime;
  });
}

export async function updateUser(
  id: string,
  data: UserWriteInput,
  options: UserAuthOptions = {},
): Promise<UserRecord> {
  const db = getAdminDb();
  const adminAuth = getAdminAuth();
  const docRef = db.collection("users").doc(id);

  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    throw new Error("User not found.");
  }

  const now = Timestamp.now();
  const normalized = normalizeUserData(data);
  const password = normalizePassword(options.password);

  validateRequiredUserFields(normalized);
  await ensureUniqueEmail(normalized.email, id);

  if (hasPassword(password)) {
    validatePassword(password);
  }

  const existingData = existingDoc.data() || {};
  const authUid = await resolveAuthUidForUserDoc(
    id,
    asString(existingData.email).trim() || normalized.email,
    existingData.auth_uid,
  );
  let nextAuthUid = authUid;

  if (authUid) {
    const authUpdatePayload: {
      email: string;
      displayName: string;
      disabled: boolean;
      password?: string;
    } = {
      email: normalized.email,
      displayName: normalized.full_name,
      disabled: normalized.status === "disabled",
    };

    if (hasPassword(password)) {
      authUpdatePayload.password = password;
    }

    try {
      await adminAuth.updateUser(authUid, authUpdatePayload);
    } catch (error) {
      throw mapFirebaseAuthError(error, "Failed to update user login account.");
    }
  } else if (hasPassword(password)) {
    try {
      const authUser = await adminAuth.createUser({
        email: normalized.email,
        password,
        displayName: normalized.full_name,
        disabled: normalized.status === "disabled",
      });

      nextAuthUid = authUser.uid;
    } catch (error) {
      throw mapFirebaseAuthError(error, "Failed to create user login account.");
    }
  }

  const payload: Record<string, unknown> = {
    auth_uid: nextAuthUid || FieldValue.delete(),
    full_name: normalized.full_name,
    email: normalized.email,
    role: normalized.role,
    status: normalized.status,
    phone: normalized.phone,
    updated_at: now,
  };

  if (normalized.role === "company") {
    payload.company_name = normalized.company_name || FieldValue.delete();
    payload.company_phone = normalized.company_phone || FieldValue.delete();
    payload.company_address = normalized.company_address || FieldValue.delete();
  } else {
    payload.company_name = FieldValue.delete();
    payload.company_phone = FieldValue.delete();
    payload.company_address = FieldValue.delete();
  }

  await docRef.set(payload, { merge: true });

  const updatedDoc = await docRef.get();
  return mapDocToUserRecord(id, updatedDoc.data() || {});
}

export async function deleteUser(id: string): Promise<void> {
  const db = getAdminDb();
  const adminAuth = getAdminAuth();
  const docRef = db.collection("users").doc(id);

  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    throw new Error("User not found.");
  }

  const existingData = existingDoc.data() || {};
  const authUid = await resolveAuthUidForUserDoc(
    id,
    asString(existingData.email).trim(),
    existingData.auth_uid,
  );

  if (authUid) {
    try {
      await adminAuth.deleteUser(authUid);
    } catch (error) {
      if (!isFirebaseAuthError(error) || error.code !== "auth/user-not-found") {
        throw mapFirebaseAuthError(error, "Failed to delete user login account.");
      }
    }
  }

  await docRef.delete();
}

export async function resolveUserAuthUidById(id: string): Promise<string | null> {
  const db = getAdminDb();
  const docRef = db.collection("users").doc(id);
  const existingDoc = await docRef.get();

  if (!existingDoc.exists) {
    throw new Error("User not found.");
  }

  const existingData = existingDoc.data() || {};
  return resolveAuthUidForUserDoc(id, asString(existingData.email).trim(), existingData.auth_uid);
}

export async function canManageUsers(uid: string): Promise<boolean> {
  if (!uid.trim()) {
    return false;
  }

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
    return true;
  }

  const actorData = actorDoc.data() || {};
  const actorRole = normalizeRole(actorData.role);
  const actorStatus = normalizeStatus(actorData.status);

  return actorStatus === "active" && actorRole === "admin";
}
