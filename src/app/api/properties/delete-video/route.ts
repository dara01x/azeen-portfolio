import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { assertPropertyWriteAccess } from "@/modules/properties/property.service";

export const runtime = "nodejs";

function extractObjectPathFromUrl(url: string, bucketName: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathPrefix = `/v0/b/${bucketName}/o/`;
    if (urlObj.pathname.startsWith(pathPrefix)) {
      const encodedPath = urlObj.pathname.slice(pathPrefix.length);
      return decodeURIComponent(encodedPath);
    }
  } catch {
    // Ignore invalid URL
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const { propertyId } = await request.json();

    if (typeof propertyId !== "string" || !propertyId.trim()) {
      return Response.json({ success: false, error: "propertyId is required." }, { status: 400 });
    }

    const id = propertyId.trim();
    await assertPropertyWriteAccess(id, actor);

    const db = getAdminDb();
    const docRef = db.collection("properties").doc(id);
    const existingDoc = await docRef.get();

    if (!existingDoc.exists) {
      return Response.json({ success: false, error: "Property not found." }, { status: 404 });
    }

    const property = existingDoc.data() || {};

    if (!property.video_url) {
      return Response.json({ success: true, message: "No video to delete." }, { status: 200 });
    }

    const bucket = getAdminStorageBucket();
    const objectPath = extractObjectPathFromUrl(property.video_url, bucket.name);

    if (objectPath) {
      try {
        await bucket.file(objectPath).delete();
      } catch (err) {
        console.error("Failed to delete video file from storage:", err);
        // Continue to update document even if file deletion fails
      }
    }

    await docRef.set({ video_url: "" }, { merge: true });

    return Response.json({ success: true }, { status: 200 });

  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Unauthorized.")) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && (error.message === "Forbidden" || error.message === "Forbidden.")) {
      return Response.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to delete property video.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
