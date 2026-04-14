import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

type ApiActorRole = "admin" | "company" | "viewer";
type ApiActorStatus = "active" | "disabled";

export type ApiActor = {
  uid: string;
  email: string;
  role: ApiActorRole;
  status: ApiActorStatus;
  userId: string;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeRole(value: unknown): ApiActorRole {
  if (value === "company" || value === "admin" || value === "viewer") {
    return value;
  }

  if (value === "owner" || value === "manager") {
    return "admin";
  }

  return "admin";
}

function normalizeStatus(value: unknown): ApiActorStatus {
  return value === "disabled" ? "disabled" : "active";
}

async function resolveActorFromUsersCollection(decodedToken: DecodedIdToken): Promise<ApiActor | null> {
  const db = getAdminDb();
  const usersCollection = db.collection("users");
  const email = asString(decodedToken.email).trim().toLowerCase();

  let actorDoc = await usersCollection.doc(decodedToken.uid).get();

  if (!actorDoc.exists) {
    const byAuthUid = await usersCollection.where("auth_uid", "==", decodedToken.uid).limit(1).get();

    if (!byAuthUid.empty) {
      actorDoc = byAuthUid.docs[0];
    }
  }

  if (!actorDoc.exists && email) {
    const byEmail = await usersCollection.where("email", "==", email).limit(1).get();

    if (!byEmail.empty) {
      actorDoc = byEmail.docs[0];
    }
  }

  if (!actorDoc.exists) {
    return null;
  }

  const actorData = actorDoc.data() || {};
  const role = normalizeRole(actorData.role);
  const status = normalizeStatus(actorData.status);

  return {
    uid: decodedToken.uid,
    email,
    role,
    status,
    userId: actorDoc.id,
  };
}

export async function requireApiUser(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) {
    throw new Error("Unauthorized");
  }

  const adminAuth = getAdminAuth();
  return adminAuth.verifyIdToken(idToken);
}

export async function requireApiActor(request: Request): Promise<ApiActor> {
  const decodedToken = await requireApiUser(request);
  const email = asString(decodedToken.email).trim().toLowerCase();

  if (!decodedToken.uid || !email) {
    throw new Error("Unauthorized");
  }

  const resolvedActor = await resolveActorFromUsersCollection(decodedToken);

  if (!resolvedActor) {
    return {
      uid: decodedToken.uid,
      email,
      role: "admin",
      status: "active",
      userId: decodedToken.uid,
    };
  }

  if (resolvedActor.status !== "active") {
    throw new Error("Unauthorized");
  }

  return resolvedActor;
}
