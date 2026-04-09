import { NextResponse } from "next/server";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { getProjects } from "@/modules/projects/project.service";

export async function GET(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const projects = await getProjects(actor);

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch projects.";
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
