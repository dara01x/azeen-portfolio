import { NextResponse } from "next/server";
import { requireApiUser } from "@/modules/properties/property.api-auth";
import { getClients } from "@/modules/clients/client.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireApiUser(request);

    const clients = await getClients();

    return NextResponse.json({
      success: true,
      clients,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch clients.";
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
