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
    const docRef = adminDb.collection("users").doc(uid);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      const inferredName =
        (typeof decodedToken.name === "string" && decodedToken.name.trim()) ||
        decodedToken.email.split("@")[0] ||
        "User";

      const bootstrapUser = {
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

    const data = docSnap.data() || {};

    const role: UserRole = isValidRole(data.role) ? data.role : "manager";
    const status: UserStatus = isValidStatus(data.status) ? data.status : "active";
    const full_name =
      typeof data.full_name === "string" && data.full_name.trim()
        ? data.full_name
        : decodedToken.email.split("@")[0];
    const email =
      typeof data.email === "string" && data.email.trim() ? data.email : decodedToken.email;

    await docRef.set({ full_name, email, role, status }, { merge: true });

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
