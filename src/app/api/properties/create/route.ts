import { requireApiActor } from "@/modules/properties/property.api-auth";
import { createProperty } from "@/modules/properties/property.service";

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

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const body = await request.json().catch(() => ({}));
    const payload = body?.data ?? body;

    const property = await createProperty(payload || {}, actor);

    return Response.json(
      {
        success: true,
        property,
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

    const message = error instanceof Error ? error.message : "Failed to create property.";
    const status = isValidationErrorMessage(message) ? 400 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}
