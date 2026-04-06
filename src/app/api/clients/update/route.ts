import { NextResponse } from "next/server";
import { requireApiUser } from "@/modules/properties/property.api-auth";
import { updateClient } from "@/modules/clients/client.service";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    await requireApiUser(request);

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
