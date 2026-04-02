import { requireApiUser } from "@/modules/properties/property.api-auth";
import { createProperty } from "@/modules/properties/property.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireApiUser(request);

    const body = await request.json().catch(() => ({}));
    const payload = body?.data ?? body;

    const property = await createProperty(payload || {});

    return Response.json(
      {
        success: true,
        property,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to create property.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
