import { NextResponse } from "next/server";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { deleteClient } from "@/modules/clients/client.service";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const actor = await requireApiActor(request);

    if (actor.role === "viewer") {
      return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const bodyId = typeof body?.id === "string" ? body.id : "";
    const queryId = new URL(request.url).searchParams.get("id") || "";
    const id = bodyId || queryId;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Client id is required.",
        },
        { status: 400 },
      );
    }

    await deleteClient(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete client.";

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
