export function mapDocument(document, { deferFileData = false, hasFileData = false } = {}) {
  if (!document) return null;

  const mediaUrl = document.cloudinaryPublicId || (deferFileData && hasFileData)
    ? `/api/documents/${encodeURIComponent(document.id)}/media`
    : document.fileData;

  return {
    ...document,
    fileData: mediaUrl,
    dataUrl: mediaUrl,
  };
}
