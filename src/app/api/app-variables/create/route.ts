import { requireApiActor } from "@/modules/properties/property.api-auth";
import { createVariable } from "@/modules/app-variables/appVariables.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor(request);

    if (actor.role === "viewer") {
      return Response.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const type = typeof body?.type === "string" ? body.type : "";
    const name = typeof body?.name === "string" ? body.name : "";
    const payload = body?.payload && typeof body.payload === "object" ? body.payload : undefined;

    if (!type || !name.trim()) {
      return Response.json(
        {
          success: false,
          error: "type and name are required.",
        },
        { status: 400 },
      );
    }

    const variable = await createVariable(type, name, payload);

    return Response.json(
      {
        success: true,
        variable,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Unauthorized.")) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && (error.message === "Forbidden" || error.message === "Forbidden.")) {
      return Response.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to create variable.";
    const status =
      message === "Invalid variable type." ||
      message === "Name is required." ||
      message === "Area boundary must contain at least 3 points."
        ? 400
        : 500;

    return Response.json({ success: false, error: message }, { status });
  }
}
