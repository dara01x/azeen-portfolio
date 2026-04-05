import { NextResponse } from "next/server";
import { requireApiUser } from "@/modules/properties/property.api-auth";
import { deleteProject } from "@/modules/projects/project.service";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    await requireApiUser(request);

    const body = await request.json().catch(() => ({}));
    const bodyId = typeof body?.id === "string" ? body.id : "";
    const queryId = new URL(request.url).searchParams.get("id") || "";
    const id = bodyId || queryId;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Project id is required.",
        },
        { status: 400 },
      );
    }

    await deleteProject(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete project.";

    if (message === "Unauthorized.") {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 },
      );
    }

    if (message === "Project not found.") {
      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
