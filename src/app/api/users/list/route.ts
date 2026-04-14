import { NextResponse } from "next/server";
import { requireApiActor } from "@/modules/properties/property.api-auth";
import { getUsers } from "@/modules/users/user.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireApiActor(request);

    if (actor.role === "viewer") {
      return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const users = await getUsers();

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch users.";
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
