import { requireApiUser } from "@/modules/properties/property.api-auth";
import { getVariables } from "@/modules/app-variables/appVariables.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireApiUser(request);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "";

    if (!type) {
      return Response.json({ success: false, error: "type query param is required." }, { status: 400 });
    }

    const variables = await getVariables(type);

    return Response.json({
      success: true,
      variables,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to fetch variables.";
    const status = message === "Invalid variable type." ? 400 : 500;

    return Response.json({ success: false, error: message }, { status });
  }
}
