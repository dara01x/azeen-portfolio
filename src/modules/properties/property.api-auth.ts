import { getAdminAuth } from "@/lib/firebase/admin";

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
