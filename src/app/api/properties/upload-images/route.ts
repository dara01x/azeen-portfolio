import { randomUUID } from "crypto";
import { getAdminStorageBucket } from "@/lib/firebase/admin";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { assertPropertyWriteAccess } from "@/modules/properties/property.service";

export const runtime = "nodejs";
const MAX_PROPERTY_IMAGE_SIZE_BYTES = 500 * 1024 * 1024;

function extensionFromMimeType(contentType: string) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return "jpg";
  }

  if (contentType.includes("png")) {
    return "png";
  }

  if (contentType.includes("webp")) {
    return "webp";
  }

  if (contentType.includes("gif")) {
    return "gif";
  }

  if (contentType.includes("svg")) {
    return "svg";
  }

  return "bin";
}

function sanitizeBaseName(fileName: string) {
  const withoutExt = fileName.replace(/\.[^/.]+$/, "");
  const normalized = withoutExt
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || "image";
}

function toFirebaseDownloadUrl(bucketName: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const formData = await request.formData();
    const propertyId = formData.get("propertyId");

    if (typeof propertyId !== "string" || !propertyId.trim()) {
      return Response.json({ success: false, error: "propertyId is required." }, { status: 400 });
    }

    await assertPropertyWriteAccess(propertyId.trim(), actor);

    const fileEntries = formData
      .getAll("files")
      .flatMap((value, index) => {
        if (typeof value === "string") {
          return [];
        }

        const blobLike = value as Blob;
        if (typeof blobLike.arrayBuffer !== "function") {
          return [];
        }

        const fileLike = value as File;
        const originalName =
          typeof fileLike.name === "string" && fileLike.name.trim()
            ? fileLike.name
            : `image-${index + 1}`;

        return [
          {
            blob: blobLike,
            originalName,
            contentType: blobLike.type || "application/octet-stream",
          },
        ];
      });

    if (fileEntries.length === 0) {
      return Response.json({ success: false, error: "At least one image file is required." }, { status: 400 });
    }

    const oversizedEntry = fileEntries.find((entry) => entry.blob.size > MAX_PROPERTY_IMAGE_SIZE_BYTES);
    if (oversizedEntry) {
      return Response.json(
        {
          success: false,
          error: "Each image must be 500MB or smaller.",
        },
        { status: 413 },
      );
    }

    const bucket = getAdminStorageBucket();

    const uploadedUrls = await Promise.all(
      fileEntries.map(async (entry, index) => {
        const contentType = entry.contentType;
        const ext = extensionFromMimeType(contentType);
        const safeName = sanitizeBaseName(entry.originalName);
        const fileName = `${Date.now()}-${index}-${safeName}.${ext}`;
        const objectPath = `properties/${propertyId}/${fileName}`;
        const downloadToken = randomUUID();
        const buffer = Buffer.from(await entry.blob.arrayBuffer());

        const storageFile = bucket.file(objectPath);
        await storageFile.save(buffer, {
          resumable: false,
          contentType,
          metadata: {
            contentType,
            metadata: {
              firebaseStorageDownloadTokens: downloadToken,
            },
          },
        });

        return toFirebaseDownloadUrl(bucket.name, objectPath, downloadToken);
      }),
    );

    return Response.json({ success: true, urls: uploadedUrls }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Unauthorized.")) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && (error.message === "Forbidden" || error.message === "Forbidden.")) {
      return Response.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to upload property images.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
