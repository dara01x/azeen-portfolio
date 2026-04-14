import { NextResponse } from "next/server";
import { requireApiUser } from "@/modules/properties/property.api-auth";
import { canManageUsers, resolveUserAuthUidById, updateUser } from "@/modules/users/user.service";

export const runtime = "nodejs";

export async function PUT(request: Request) {
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
    const id = typeof body?.id === "string" ? body.id : "";
    const payload = body?.data ?? body;
    const password = typeof body?.password === "string" ? body.password : undefined;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "User id is required.",
        },
        { status: 400 },
      );
    }

    const nextStatus = typeof payload?.status === "string" ? payload.status : "";
    const nextRole = typeof payload?.role === "string" ? payload.role : "";
    const targetAuthUid = await resolveUserAuthUidById(id);
    const isSelfTarget = id === actor.uid || (targetAuthUid ? targetAuthUid === actor.uid : false);

    if (isSelfTarget && nextStatus === "disabled") {
      return NextResponse.json(
        {
          success: false,
          error: "You cannot disable your own account.",
        },
        { status: 400 },
      );
    }

    if (isSelfTarget && (nextRole === "company" || nextRole === "viewer")) {
      return NextResponse.json(
        {
          success: false,
          error: "You cannot change your own role to company or viewer.",
        },
        { status: 400 },
      );
    }

    const user = await updateUser(id, payload || {}, { password });

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user.";

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
