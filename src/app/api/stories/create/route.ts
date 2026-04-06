import { NextResponse } from "next/server";
import { requireApiUser } from "@/modules/properties/property.api-auth";
import { createStory } from "@/modules/stories/story.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser(request);

    const body = await request.json().catch(() => ({}));
    const payload = body?.data ?? body;

    const story = await createStory(actor.uid, payload || {});

    return NextResponse.json(
      {
        success: true,
        story,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create story.";

    if (message === "Story video URL is required." || message === "Story video URL must be a valid HTTP(S) URL.") {
      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: 400 },
      );
    }

    if (message === "Forbidden.") {
      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: 403 },
      );
    }

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
