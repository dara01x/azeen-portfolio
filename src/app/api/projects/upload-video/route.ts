import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAdminStorageBucket } from "@/lib/firebase/admin";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { assertProjectWriteAccess } from "@/modules/projects/project.service";

const MAX_PROJECT_VIDEO_SIZE_BYTES = 30 * 1024 * 1024;

function extensionFromMimeType(type: string): string {
  const normalized = type.toLowerCase();

  if (normalized.includes("mp4")) return ".mp4";
  if (normalized.includes("webm")) return ".webm";
  if (normalized.includes("quicktime")) return ".mov";
  if (normalized.includes("x-matroska")) return ".mkv";

  return ".mp4";
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const formData = await request.formData();
    const projectId = formData.get("projectId");

    if (typeof projectId !== "string" || !projectId.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "projectId is required.",
        },
        { status: 400 },
      );
    }

    await assertProjectWriteAccess(projectId.trim(), actor);

    const file = formData.get("file");

    if (!(file instanceof Blob)) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing video file.",
        },
        { status: 400 },
      );
    }

    const contentType = file.type || "application/octet-stream";
    if (!contentType.startsWith("video/")) {
      return NextResponse.json(
        {
          success: false,
          error: "Only video files are allowed.",
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_PROJECT_VIDEO_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "Project video must be 30MB or less.",
        },
        { status: 413 },
      );
    }

    const extension = extensionFromMimeType(contentType);
    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const objectPath = `projects/${projectId}/videos/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const bucket = getAdminStorageBucket();
    const uploadedFile = bucket.file(objectPath);

    await uploadedFile.save(buffer, {
      resumable: false,
      contentType,
      public: true,
      metadata: {
        cacheControl: "public,max-age=31536000,immutable",
      },
    });

    return NextResponse.json({
      success: true,
      url: uploadedFile.publicUrl(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload project video.";
    const status =
      message === "Unauthorized" || message === "Unauthorized."
        ? 401
        : message === "Forbidden" || message === "Forbidden."
          ? 403
          : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status },
    );
  }
}
