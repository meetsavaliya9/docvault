const permissionMessages = {
  VIEW_DASHBOARD: [
    "Dashboard Access Restricted",
    "You don't have permission to access the Dashboard. Please contact your administrator.",
  ],
  VIEW_DOCUMENTS: [
    "Files Access Restricted",
    "You don't have permission to access your files. Please contact your administrator.",
  ],
  VIEW_FOLDERS: [
    "Folders Access Restricted",
    "You don't have permission to access your folders. Please contact your administrator.",
  ],
  VIEW_STARRED: [
    "Starred Access Restricted",
    "You don't have permission to access Starred documents. Please contact your administrator.",
  ],
  VIEW_TRASH: [
    "Trash Access Restricted",
    "You don't have permission to access Trash. Please contact your administrator.",
  ],
  VIEW_SUBSCRIPTION: [
    "Subscription Access Restricted",
    "You don't have permission to access subscription details. Please contact your administrator.",
  ],
  VIEW_USERS: [
    "Users Access Restricted",
    "You don't have permission to access this page.",
  ],
  VIEW_USER_FILES: [
    "User Files Restricted",
    "You don't have permission to view user files.",
  ],
  VIEW_DASHBOARD_STATS: [
    "Dashboard Stats Restricted",
    "You don't have permission to view dashboard statistics.",
  ],
  VIEW_RECENT_DOCUMENTS: [
    "Recent Documents Restricted",
    "You don't have permission to view recent documents.",
  ],
  VIEW_STORAGE_USAGE: [
    "Storage Usage Restricted",
    "You don't have permission to view storage usage.",
  ],
  UPLOAD_DOCUMENT: [
    "Upload Disabled",
    "You don't have permission to upload documents.",
  ],
  RENAME_DOCUMENT: [
    "Rename Disabled",
    "You don't have permission to rename documents.",
  ],
  MOVE_DOCUMENT: [
    "Move Disabled",
    "You don't have permission to move documents.",
  ],
  DOWNLOAD_DOCUMENT: [
    "Download Disabled",
    "You don't have permission to download documents.",
  ],
  VIEW_DOCUMENT_DETAILS: [
    "Document Details Restricted",
    "You don't have permission to view document details.",
  ],
  PREVIEW_DOCUMENT: [
    "Preview Disabled",
    "You don't have permission to preview documents.",
  ],
};

export default function PermissionDenied({
  permission,
  title,
  message,
  compact = false,
  className = "",
}) {
  const [defaultTitle, defaultMessage] = permissionMessages[permission] || [
    "Access Restricted",
    "You don't have permission to use this feature. Please contact your administrator.",
  ];

  return (
    <section
      role="status"
      aria-live="polite"
      className={`rounded-xl border border-amber-200 bg-amber-50 text-amber-950 ${
        compact ? "p-3" : "p-5 sm:p-6"
      } ${className}`}
    >
      <h2 className={`${compact ? "text-xs" : "text-sm sm:text-base"} font-semibold`}>
        {title || defaultTitle}
      </h2>
      <p className={`${compact ? "mt-0.5 text-[11px]" : "mt-1 text-xs sm:text-sm"} text-amber-900`}>
        {message || defaultMessage}
      </p>
    </section>
  );
}
