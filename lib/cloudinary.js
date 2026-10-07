import "server-only";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function assertCloudinaryConfigured() {
  const missing = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ].filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(`Cloudinary is not configured. Set ${missing.join(", ")} in .env.local.`);
  }
}

export function uploadPrivateAsset(buffer, userId, filename) {
  assertCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: "auto",
          type: "authenticated",
          folder: `docvault/${userId}`,
          filename_override: filename,
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (!result) {
            reject(new Error("Cloudinary did not return an upload result."));
          } else {
            resolve(result);
          }
        }
      )
      .end(buffer);
  });
}

export function deletePrivateAsset(publicId, resourceType) {
  assertCloudinaryConfigured();
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: "authenticated",
    invalidate: true,
  });
}

export function getPrivateAssetMetadata(publicId, resourceType) {
  assertCloudinaryConfigured();
  return cloudinary.api.resource(publicId, {
    resource_type: resourceType,
    type: "authenticated",
  });
}

export function getPrivateAssetUrl(publicId, resourceType, version) {
  assertCloudinaryConfigured();
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: "authenticated",
    secure: true,
    sign_url: true,
    version,
  });
}

export default cloudinary;