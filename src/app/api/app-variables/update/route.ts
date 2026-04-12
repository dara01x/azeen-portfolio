import { requireApiUser } from "@/modules/properties/property.api-auth";
import { updateVariable } from "@/modules/app-variables/appVariables.service";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    await requireApiUser(request);

    const body = await request.json().catch(() => ({}));
    const type = typeof body?.type === "string" ? body.type : "";
    const id = typeof body?.id === "string" ? body.id : "";
    const name = typeof body?.name === "string" ? body.name : "";
    const payload = body?.payload && typeof body.payload === "object" ? body.payload : undefined;

    if (!type || !id || !name.trim()) {
      return Response.json(
        {
          success: false,
          error: "type, id and name are required.",
        },
        { status: 400 },
      );
    }

    const variable = await updateVariable(type, id, name, payload);

    return Response.json({
      success: true,
      variable,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to update variable.";
    const status =
      message === "Invalid variable type." ||
      message === "Name is required." ||
      message === "Variable id is required." ||
      message === "Area boundary must contain at least 3 points."
        ? 400
        : message === "Variable not found."
          ? 404
          : 500;

    return Response.json({ success: false, error: message }, { status });
  }
}
