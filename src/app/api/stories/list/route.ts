import { NextResponse } from "next/server";
import { requireApiUser } from "@/modules/properties/property.api-auth";
import { getActiveStories } from "@/modules/stories/story.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireApiUser(request);

    const stories = await getActiveStories();

    return NextResponse.json({
      success: true,
      stories,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch stories.";
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
