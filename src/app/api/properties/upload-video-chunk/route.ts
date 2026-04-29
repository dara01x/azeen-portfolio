import { requireApiActor } from "@/modules/properties/property.api-auth";
import { assertPropertyWriteAccess } from "@/modules/properties/property.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor(request);

    const formData = await request.formData();
    const propertyId = formData.get("propertyId") as string;
    const uploadUrl = formData.get("uploadUrl") as string;
    const range = formData.get("range") as string;
    const chunk = formData.get("chunk") as Blob;

    if (!propertyId || !uploadUrl || !range || !(chunk instanceof Blob)) {
      return Response.json({ success: false, error: "Invalid chunk data." }, { status: 400 });
    }

    await assertPropertyWriteAccess(propertyId.trim(), actor);

    const buffer = Buffer.from(await chunk.arrayBuffer());

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Range": range,
      },
      body: buffer,
    });

    if (!response.ok && response.status !== 308) {
      const errorText = await response.text().catch(() => "Unknown storage error");
      console.error("GCS Chunk Upload Error:", response.status, errorText);
      return Response.json({ success: false, error: "Failed to upload chunk." }, { status: 500 });
    }

    return Response.json({ success: true, status: response.status }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Unauthorized.")) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && (error.message === "Forbidden" || error.message === "Forbidden.")) {
      return Response.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to upload video chunk.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
