export function normalizeDocument(document) {
  if (!document || typeof document !== "object") return document;
  const fileData = document.fileData || document.dataUrl || null;

  return {
    ...document,
    fileData,
    dataUrl: fileData,
    deleted: document.deleted ?? false,
  };
}

export function isImageDocument(document) {
  return /^(AVIF|BMP|GIF|JPG|JPEG|PNG|SVG|WEBP)$/.test(
    String(document?.type || "").toUpperCase()
  );
}
