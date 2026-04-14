import { NextResponse } from "next/server";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { createClient } from "@/modules/clients/client.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor(request);

    if (actor.role === "viewer") {
      return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const payload = body?.data ?? body;

    const client = await createClient(payload || {});

    return NextResponse.json(
      {
        success: true,
        client,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create client.";
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
