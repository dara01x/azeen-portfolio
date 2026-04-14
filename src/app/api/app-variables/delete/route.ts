import { requireApiActor } from "@/modules/properties/property.api-auth";
import { deleteVariable } from "@/modules/app-variables/appVariables.service";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const actor = await requireApiActor(request);

    if (actor.role === "viewer") {
      return Response.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const type = typeof body?.type === "string" ? body.type : "";
    const id = typeof body?.id === "string" ? body.id : "";

    if (!type || !id) {
      return Response.json(
        {
          success: false,
          error: "type and id are required.",
        },
        { status: 400 },
      );
    }

    await deleteVariable(type, id);

    return Response.json({
      success: true,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Unauthorized.")) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && (error.message === "Forbidden" || error.message === "Forbidden.")) {
      return Response.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to delete variable.";
    const status =
      message === "Invalid variable type." || message === "Variable id is required."
        ? 400
        : message === "Variable not found."
          ? 404
          : 500;

    return Response.json({ success: false, error: message }, { status });
  }
}
