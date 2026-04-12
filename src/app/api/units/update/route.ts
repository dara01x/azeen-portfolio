import { NextResponse } from "next/server";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { updateUnit } from "@/modules/units/unit.service";

export async function PUT(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const payload = (await request.json().catch(() => null)) as {
      id?: string;
      data?: Record<string, unknown>;
    } | null;

    if (!payload?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Unit id is required.",
        },
        { status: 400 },
      );
    }

    if (!payload.data || typeof payload.data !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Missing unit payload.",
        },
        { status: 400 },
      );
    }

    const unit = await updateUnit(payload.id, payload.data, actor);

    return NextResponse.json({
      success: true,
      unit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update unit.";
    const isValidationError =
      message === "Project is required." ||
      message === "Unit type is required." ||
      message === "Area size is required." ||
      message === "At least one unit option is required." ||
      message.includes("cannot be negative");

    if (message === "Unit not found.") {
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
          : message === "Project not found."
            ? 404
            : message === "Unit number already exists in this project."
              ? 409
              : isValidationError
              ? 400
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
