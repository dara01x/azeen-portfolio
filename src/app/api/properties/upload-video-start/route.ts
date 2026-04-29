import { randomUUID } from "crypto";
import { getAdminStorageBucket } from "@/lib/firebase/admin";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { assertPropertyWriteAccess } from "@/modules/properties/property.service";

export const runtime = "nodejs";

function extensionFromMimeType(contentType: string) {
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("x-matroska")) return "mkv";
  return "mp4";
}

function sanitizeBaseName(fileName: string) {
  const withoutExt = fileName.replace(/\.[^/.]+$/, "");
  const normalized = withoutExt
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || "video";
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const { propertyId, fileName, contentType } = await request.json();

    if (typeof propertyId !== "string" || !propertyId.trim()) {
      return Response.json({ success: false, error: "propertyId is required." }, { status: 400 });
    }

    await assertPropertyWriteAccess(propertyId.trim(), actor);

    const bucket = getAdminStorageBucket();
    const safeName = sanitizeBaseName(fileName || "property-video");
    const ext = extensionFromMimeType(contentType || "video/mp4");
    const safeFileName = `${Date.now()}-${randomUUID()}-${safeName}.${ext}`;
    const objectPath = `properties/${propertyId}/videos/${safeFileName}`;
    const downloadToken = randomUUID();

    const file = bucket.file(objectPath);
    const [uploadUrl] = await file.createResumableUpload({
      origin: "*",
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    return Response.json({ 
      success: true, 
      uploadUrl, 
      objectPath, 
      downloadToken,
      bucketName: bucket.name 
    }, { status: 200 });

  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Unauthorized.")) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && (error.message === "Forbidden" || error.message === "Forbidden.")) {
      return Response.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to initiate video upload.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
