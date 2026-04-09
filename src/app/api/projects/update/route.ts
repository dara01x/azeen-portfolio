import { NextResponse } from "next/server";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { updateProject } from "@/modules/projects/project.service";

export async function PUT(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const payload = (await request.json().catch(() => null)) as {
      id?: string;
      data?: Record<string, unknown>;
    } | null;

    if (!payload?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Project id is required.",
        },
        { status: 400 },
      );
    }

    if (!payload.data || typeof payload.data !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Missing project payload.",
        },
        { status: 400 },
      );
    }

    const project = await updateProject(payload.id, payload.data, actor);

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update project.";

    if (message === "Project not found.") {
      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: 404 },
      );
    }

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
