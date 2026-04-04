import { NextResponse } from "next/server";
import { requireApiUser } from "@/modules/properties/property.api-auth";
import { getProjects } from "@/modules/projects/project.service";

export async function GET(request: Request) {
  try {
    await requireApiUser(request);

    const projects = await getProjects();

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch projects.";
    const status = message === "Unauthorized." ? 401 : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status },
    );
  }
}
