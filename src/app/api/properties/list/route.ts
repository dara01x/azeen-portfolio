import { requireApiActor } from "@/modules/properties/property.api-auth";
import { getProperties } from "@/modules/properties/property.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const properties = await getProperties(actor);

    return Response.json({
      success: true,
      properties,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Unauthorized.")) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && (error.message === "Forbidden" || error.message === "Forbidden.")) {
      return Response.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to fetch properties.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
