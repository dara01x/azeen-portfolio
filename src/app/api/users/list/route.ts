import { NextResponse } from "next/server";
import { requireApiUser } from "@/modules/properties/property.api-auth";
import { getUsers } from "@/modules/users/user.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireApiUser(request);

    const users = await getUsers();

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch users.";
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
