import { NextResponse } from "next/server";
import { requireApiUser } from "@/modules/properties/property.api-auth";
import { canManageUsers, createUser } from "@/modules/users/user.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser(request);

    const allowed = await canManageUsers(actor.uid);
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden.",
        },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const payload = body?.data ?? body;
    const password = typeof body?.password === "string" ? body.password : "";

    if (!password) {
      return NextResponse.json(
        {
          success: false,
          error: "Password is required.",
        },
        { status: 400 },
      );
    }

    const user = await createUser(payload || {}, { password });

    return NextResponse.json(
      {
        success: true,
        user,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user.";
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
