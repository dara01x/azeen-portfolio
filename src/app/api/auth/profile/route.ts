import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import type { UserRole, UserStatus } from "@/lib/auth/types";

export const runtime = "nodejs";

function isValidRole(role: unknown): role is UserRole {
  return role === "owner" || role === "manager" || role === "company";
}

function isValidStatus(status: unknown): status is UserStatus {
  return status === "active" || status === "disabled";
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (!decodedToken.email) {
      return Response.json({ error: "User email is required" }, { status: 400 });
    }

    const uid = decodedToken.uid;
    const usersCollection = adminDb.collection("users");
    const docRef = usersCollection.doc(uid);
    let profileDocRef = docRef;
    let profileDocSnap = await profileDocRef.get();

    if (!profileDocSnap.exists) {
      const authUidQuery = await usersCollection.where("auth_uid", "==", uid).limit(1).get();

      if (!authUidQuery.empty) {
        profileDocRef = authUidQuery.docs[0].ref;
        profileDocSnap = authUidQuery.docs[0];
      }
    }

    if (!profileDocSnap.exists) {
      const emailQuery = await usersCollection.where("email", "==", decodedToken.email).limit(1).get();

      if (!emailQuery.empty) {
        profileDocRef = emailQuery.docs[0].ref;
        profileDocSnap = emailQuery.docs[0];
      }
    }

    if (!profileDocSnap.exists) {
      const inferredName =
        (typeof decodedToken.name === "string" && decodedToken.name.trim()) ||
        decodedToken.email.split("@")[0] ||
        "User";

      const bootstrapUser = {
        auth_uid: uid,
        full_name: inferredName,
        email: decodedToken.email,
        role: "manager" as UserRole,
        status: "active" as UserStatus,
      };

      await docRef.set(bootstrapUser, { merge: true });

      return Response.json({
        uid,
        ...bootstrapUser,
      });
    }

    const data = (profileDocSnap.data() || {}) as Record<string, unknown>;

    const role: UserRole = isValidRole(data.role) ? data.role : "manager";
    const status: UserStatus = isValidStatus(data.status) ? data.status : "active";
    const full_name =
      typeof data.full_name === "string" && data.full_name.trim()
        ? data.full_name
        : decodedToken.email.split("@")[0];
    const email =
      typeof data.email === "string" && data.email.trim() ? data.email : decodedToken.email;

    const updates: Record<string, string> = {};

    if (data.full_name !== full_name) {
      updates.full_name = full_name;
    }

    if (data.email !== email) {
      updates.email = email;
    }

    if (data.role !== role) {
      updates.role = role;
    }

    if (data.status !== status) {
      updates.status = status;
    }

    if (data.auth_uid !== uid) {
      updates.auth_uid = uid;
    }

    if (Object.keys(updates).length > 0) {
      await profileDocRef.set(updates, { merge: true });
    }

    return Response.json({
      uid,
      email,
      full_name,
      role,
      status,
    });
  } catch (error) {
    console.error("Auth profile API error:", error);

    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
