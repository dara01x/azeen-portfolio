import { NextResponse } from "next/server";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { deleteStory } from "@/modules/stories/story.service";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const body = await request.json().catch(() => ({}));
    const bodyId = typeof body?.id === "string" ? body.id : "";
    const queryId = new URL(request.url).searchParams.get("id") || "";
    const id = (bodyId || queryId).trim();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Story id is required.",
        },
        { status: 400 },
      );
    }

    await deleteStory(id, {
      uid: actor.uid,
      role: actor.role,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete story.";

    if (message === "Unauthorized" || message === "Unauthorized.") {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    if (message === "Forbidden" || message === "Forbidden.") {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden.",
        },
        { status: 403 },
      );
    }

    if (message === "Story not found.") {
      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: 404 },
      );
    }

    if (message === "Story id is required.") {
      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: 400 },
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
