import { NextResponse } from "next/server";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { getUnits } from "@/modules/units/unit.service";

export async function GET(request: Request) {
  try {
    const actor = await requireApiActor(request);
    const units = await getUnits(actor);

    return NextResponse.json({
      success: true,
      units,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch units.";
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
