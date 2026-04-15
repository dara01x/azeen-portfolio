import { randomUUID } from "crypto";
import { getAdminStorageBucket } from "@/lib/firebase/admin";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { assertPropertyWriteAccess } from "@/modules/properties/property.service";

export const runtime = "nodejs";

const MAX_PROPERTY_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;

function extensionFromMimeType(contentType: string) {
  if (contentType.includes("mp4")) {
    return "mp4";
  }

  if (contentType.includes("webm")) {
    return "webm";
  }

  if (contentType.includes("quicktime")) {
    return "mov";
  }

  if (contentType.includes("x-matroska")) {
    return "mkv";
  }

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

function toFirebaseDownloadUrl(bucketName: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const formData = await request.formData();
    const propertyIdValue = formData.get("propertyId");
    const fileValue = formData.get("file");

    if (typeof propertyIdValue !== "string" || !propertyIdValue.trim()) {
      return Response.json({ success: false, error: "propertyId is required." }, { status: 400 });
    }

    if (!(fileValue instanceof Blob)) {
      return Response.json({ success: false, error: "Video file is required." }, { status: 400 });
    }

    const propertyId = propertyIdValue.trim();
    await assertPropertyWriteAccess(propertyId, actor);

    const videoFile = fileValue as File;
    const contentType = videoFile.type || "application/octet-stream";

    if (!contentType.startsWith("video/")) {
      return Response.json({ success: false, error: "Only video files are allowed." }, { status: 400 });
    }

    if (videoFile.size > MAX_PROPERTY_VIDEO_SIZE_BYTES) {
      return Response.json(
        {
          success: false,
          error: "Video must be 500MB or smaller.",
        },
        { status: 413 },
      );
    }

    const bucket = getAdminStorageBucket();
    const safeName = sanitizeBaseName(videoFile.name || "property-video");
    const ext = extensionFromMimeType(contentType);
    const fileName = `${Date.now()}-${randomUUID()}-${safeName}.${ext}`;
    const objectPath = `properties/${propertyId}/videos/${fileName}`;
    const downloadToken = randomUUID();
    const buffer = Buffer.from(await videoFile.arrayBuffer());

    await bucket.file(objectPath).save(buffer, {
      resumable: false,
      contentType,
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    const url = toFirebaseDownloadUrl(bucket.name, objectPath, downloadToken);

    return Response.json({ success: true, url }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Unauthorized.")) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && (error.message === "Forbidden" || error.message === "Forbidden.")) {
      return Response.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to upload property video.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
