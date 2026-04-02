import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const adminDb = getAdminDb();
    const snapshot = await adminDb.collection("test").get();

    return Response.json({
      success: true,
      count: snapshot.size,
    });
  } catch (error) {
    console.error("Firebase test route error:", error);

    return Response.json(
      {
        success: false,
        count: 0,
      },
      { status: 500 },
    );
  }
}
