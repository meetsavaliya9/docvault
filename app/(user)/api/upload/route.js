import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { uploadPrivateAsset } from "@/lib/cloudinary";

export async function POST(request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose a file to upload." },
        { status: 400 }
      );
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Files must be 15 MB or smaller." }, { status: 413 });
    }

    const result = await uploadPrivateAsset(
      Buffer.from(await file.arrayBuffer()),
      user.id,
      file.name
    );

    return NextResponse.json({
      success: true,
      publicId: result.public_id,
      resourceType: result.resource_type,
      version: result.version,
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);

    return NextResponse.json(
      {
        error: error.message?.startsWith("Cloudinary is not configured.")
          ? error.message
          : "Could not upload the file to Cloudinary. Check the server configuration and try again.",
      },
      { status: 500 }
    );
  }
}