import { NextResponse } from "next/server";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { createProject } from "@/modules/projects/project.service";

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const payload = (await request.json().catch(() => null)) as {
      data?: Record<string, unknown>;
    } | null;

    if (!payload?.data || typeof payload.data !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Missing project payload.",
        },
        { status: 400 },
      );
    }

    const project = await createProject(payload.data, actor);

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create project.";
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
