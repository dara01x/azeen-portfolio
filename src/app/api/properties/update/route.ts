import { requireApiUser } from "@/modules/properties/property.api-auth";
import { updateProperty } from "@/modules/properties/property.service";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    await requireApiUser(request);

    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : "";
    const payload = body?.data ?? body;

    if (!id) {
      return Response.json({ success: false, error: "Property id is required." }, { status: 400 });
    }

    const property = await updateProperty(id, payload || {});

    return Response.json({
      success: true,
      property,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to update property.";
    const status = message === "Property not found." ? 404 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}
