import { requireApiActor } from "@/modules/properties/property.api-auth";
import { deleteProperty } from "@/modules/properties/property.service";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const body = await request.json().catch(() => ({}));
    const bodyId = typeof body?.id === "string" ? body.id : "";
    const queryId = new URL(request.url).searchParams.get("id") || "";
    const id = bodyId || queryId;

    if (!id) {
      return Response.json({ success: false, error: "Property id is required." }, { status: 400 });
    }

    await deleteProperty(id, actor);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Unauthorized.")) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && (error.message === "Forbidden" || error.message === "Forbidden.")) {
      return Response.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to delete property.";
    const status = message === "Property not found." ? 404 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}