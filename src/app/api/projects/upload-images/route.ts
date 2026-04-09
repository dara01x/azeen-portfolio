import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAdminStorageBucket } from "@/lib/firebase/admin";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { assertProjectWriteAccess } from "@/modules/projects/project.service";

function extensionFromMimeType(type: string): string {
  const normalized = type.toLowerCase();

  if (normalized.includes("png")) return ".png";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("gif")) return ".gif";
  if (normalized.includes("bmp")) return ".bmp";
  if (normalized.includes("svg")) return ".svg";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";

  return ".jpg";
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
          error: "Missing image file.",
        },
        { status: 400 },
      );
    }

    const contentType = file.type || "image/jpeg";
    const extension = extensionFromMimeType(contentType);

    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const objectPath = `projects/${projectId}/${fileName}`;

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
    const message = error instanceof Error ? error.message : "Unable to upload project image.";
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
