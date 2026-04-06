import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAdminStorageBucket } from "@/lib/firebase/admin";
import { requireApiUser } from "@/modules/properties/property.api-auth";

export const runtime = "nodejs";

const MAX_STORY_VIDEO_SIZE_BYTES = 30 * 1024 * 1024;

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

  return normalized || "story-video";
}

function toFirebaseDownloadUrl(bucketName: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser(request);

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

    const videoFile = fileValue as File;
    const contentType = videoFile.type || "application/octet-stream";

    if (!contentType.startsWith("video/")) {
      return NextResponse.json(
        {
          success: false,
          error: "Only video files are allowed for stories.",
        },
        { status: 400 },
      );
    }

    if (videoFile.size > MAX_STORY_VIDEO_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "Story video must be 30MB or less.",
        },
        { status: 400 },
      );
    }

    const bucket = getAdminStorageBucket();
    const safeName = sanitizeBaseName(videoFile.name || "story-video");
    const extension = extensionFromMimeType(contentType);
    const objectPath = `stories/${actor.uid}/${Date.now()}-${randomUUID()}-${safeName}.${extension}`;
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

    return NextResponse.json(
      {
        success: true,
        url: toFirebaseDownloadUrl(bucket.name, objectPath, downloadToken),
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload story video.";
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
