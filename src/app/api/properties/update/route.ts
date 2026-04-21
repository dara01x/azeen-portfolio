import { requireApiActor } from "@/modules/properties/property.api-auth";
import { updateProperty } from "@/modules/properties/property.service";

export const runtime = "nodejs";

function isValidationErrorMessage(message: string) {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("required") ||
    normalized.includes("invalid") ||
    normalized.includes("cannot") ||
    normalized.includes("must") ||
    normalized.includes("at least") ||
    normalized.includes("greater than")
  );
}

export async function PUT(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : "";
    const payload = body?.data ?? body;

    if (!id) {
      return Response.json({ success: false, error: "Property id is required." }, { status: 400 });
    }

    const property = await updateProperty(id, payload || {}, actor);

    return Response.json({
      success: true,
      property,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Unauthorized.")) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && (error.message === "Forbidden" || error.message === "Forbidden.")) {
      return Response.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to update property.";
    const status =
      message === "Property not found." ? 404 : isValidationErrorMessage(message) ? 400 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}
