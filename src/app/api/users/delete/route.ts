import { NextResponse } from "next/server";
import { requireApiUser } from "@/modules/properties/property.api-auth";
import { canManageUsers, deleteUser, resolveUserAuthUidById } from "@/modules/users/user.service";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
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
    const bodyId = typeof body?.id === "string" ? body.id : "";
    const queryId = new URL(request.url).searchParams.get("id") || "";
    const id = bodyId || queryId;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "User id is required.",
        },
        { status: 400 },
      );
    }

    const targetAuthUid = await resolveUserAuthUidById(id);
    const isSelfTarget = id === actor.uid || (targetAuthUid ? targetAuthUid === actor.uid : false);

    if (isSelfTarget) {
      return NextResponse.json(
        {
          success: false,
          error: "You cannot delete your own account.",
        },
        { status: 400 },
      );
    }

    await deleteUser(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete user.";

    if (message === "User not found.") {
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
