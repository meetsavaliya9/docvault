export const PERMISSIONS = [
  "VIEW_DOCUMENTS",
  "UPLOAD_DOCUMENT",
  "DOWNLOAD_DOCUMENT",
  "DELETE_DOCUMENT",
  "RESTORE_DOCUMENT",
  "EMPTY_TRASH",
  "SHARE_DOCUMENT",
  "RENAME_DOCUMENT",
  "VIEW_TRASH",
  "VIEW_SUBSCRIPTION",
];

export const PERMISSION_LABELS = {
  VIEW_DOCUMENTS: "View Documents",
  UPLOAD_DOCUMENT: "Upload Document",
  DOWNLOAD_DOCUMENT: "Download Document",
  DELETE_DOCUMENT: "Delete Document",
  RESTORE_DOCUMENT: "Restore Document",
  EMPTY_TRASH: "Empty Trash",
  SHARE_DOCUMENT: "Share Document",
  RENAME_DOCUMENT: "Rename Document",
  VIEW_TRASH: "View Trash",
  VIEW_SUBSCRIPTION: "View Subscription",
};

export const DEFAULT_USER_PERMISSIONS = PERMISSIONS;

export function createPermissionMap(enabledPermissions = []) {
  const enabled = new Set(enabledPermissions);
  return Object.fromEntries(PERMISSIONS.map((permission) => [permission, enabled.has(permission)]));
}