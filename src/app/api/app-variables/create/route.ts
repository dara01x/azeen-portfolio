import { requireApiUser } from "@/modules/properties/property.api-auth";
import { createVariable } from "@/modules/app-variables/appVariables.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireApiUser(request);

    const body = await request.json().catch(() => ({}));
    const type = typeof body?.type === "string" ? body.type : "";
    const name = typeof body?.name === "string" ? body.name : "";

    if (!type || !name.trim()) {
      return Response.json(
        {
          success: false,
          error: "type and name are required.",
        },
        { status: 400 },
      );
    }

    const variable = await createVariable(type, name);

    return Response.json(
      {
        success: true,
        variable,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to create variable.";
    const status = message === "Invalid variable type." || message === "Name is required." ? 400 : 500;

    return Response.json({ success: false, error: message }, { status });
  }
}
