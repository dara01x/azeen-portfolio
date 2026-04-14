import { NextResponse } from "next/server";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { updateClient } from "@/modules/clients/client.service";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const actor = await requireApiActor(request);

    if (actor.role === "viewer") {
      return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : "";
    const payload = body?.data ?? body;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Client id is required.",
        },
        { status: 400 },
      );
    }

    const client = await updateClient(id, payload || {});

    return NextResponse.json({
      success: true,
      client,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update client.";

    if (message === "Client not found.") {
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
