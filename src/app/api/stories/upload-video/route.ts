import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAdminStorageBucket } from "@/lib/firebase/admin";
import { requireApiActor } from "@/modules/properties/property.api-auth";

export const runtime = "nodejs";

const MAX_STORY_VIDEO_SIZE_BYTES = 30 * 1024 * 1024;
const MAX_STORY_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

type StoryUploadMediaType = "video" | "image";

function detectMediaType(contentType: string): StoryUploadMediaType | null {
  if (contentType.startsWith("video/")) {
    return "video";
  }

  if (contentType.startsWith("image/")) {
    return "image";
  }

  return null;
}

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

  if (contentType.includes("avif")) {
    return "avif";
  }

  if (contentType.includes("heic")) {
    return "heic";
  }

  if (contentType.includes("heif")) {
    return "heif";
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

  return normalized || "story-video";
}

function toFirebaseDownloadUrl(bucketName: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor(request);

    if (actor.role === "viewer") {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden.",
        },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof Blob)) {
      return NextResponse.json(
        {
          success: false,
          error: "Story video file is required.",
        },
        { status: 400 },
      );
    }

    const mediaFile = fileValue as File;
    const contentType = mediaFile.type || "application/octet-stream";
    const mediaType = detectMediaType(contentType);

    if (!mediaType) {
      return NextResponse.json(
        {
          success: false,
          error: "Only image or video files are allowed for stories.",
        },
        { status: 400 },
      );
    }

    if (mediaType === "video" && mediaFile.size > MAX_STORY_VIDEO_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "Story video must be 30MB or less.",
        },
        { status: 400 },
      );
    }

    if (mediaType === "image" && mediaFile.size > MAX_STORY_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "Story image must be 10MB or less.",
        },
        { status: 400 },
      );
    }

    const bucket = getAdminStorageBucket();
    const safeName = sanitizeBaseName(mediaFile.name || "story-media");
    const extension = extensionFromMimeType(contentType);
    const objectPath = `stories/${actor.uid}/${mediaType}/${Date.now()}-${randomUUID()}-${safeName}.${extension}`;
    const downloadToken = randomUUID();
    const buffer = Buffer.from(await mediaFile.arrayBuffer());

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

    return NextResponse.json(
      {
        success: true,
        url: toFirebaseDownloadUrl(bucket.name, objectPath, downloadToken),
        media_type: mediaType,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload story media.";
    const status = message === "Unauthorized" || message === "Unauthorized." ? 401 : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status },
    );
  }
}
