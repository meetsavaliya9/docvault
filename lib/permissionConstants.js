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
  "VIEW_DASHBOARD",
  "VIEW_DASHBOARD_STATS",
  "VIEW_RECENT_DOCUMENTS",
  "VIEW_STORAGE_USAGE",
  "PERMANENT_DELETE_DOCUMENT",
  "VIEW_DOCUMENT_DETAILS",
  "SEARCH_DOCUMENTS",
  "SEARCH_BY_NAME",
  "SEARCH_BY_TYPE",
  "SORT_DOCUMENTS",
  "FILTER_DOCUMENTS",
  "PREVIEW_DOCUMENT",
  "MANAGE_STARRED_DOCUMENTS",
  "VIEW_FOLDERS",
  "CREATE_FOLDER",
  "RENAME_FOLDER",
  "DELETE_FOLDER",
  "MOVE_DOCUMENT",
  "VIEW_STARRED",
  "VIEW_PLANS",
  "CHANGE_SUBSCRIPTION",
  "MANAGE_SUBSCRIPTION",
  "VIEW_PAYMENT_HISTORY",
  "VIEW_NOTIFICATIONS",
  "MANAGE_NOTIFICATIONS",
  "MARK_NOTIFICATION_READ",
];

export const PERMISSION_DEPENDENCIES = {
  VIEW_DASHBOARD: [
    "VIEW_DASHBOARD_STATS",
    "VIEW_RECENT_DOCUMENTS",
    "VIEW_STORAGE_USAGE",
  ],
  VIEW_DOCUMENTS: [
    "UPLOAD_DOCUMENT",
    "DOWNLOAD_DOCUMENT",
    "DELETE_DOCUMENT",
    "SHARE_DOCUMENT",
    "RENAME_DOCUMENT",
    "VIEW_DOCUMENT_DETAILS",
    "SEARCH_DOCUMENTS",
    "SEARCH_BY_NAME",
    "SEARCH_BY_TYPE",
    "SORT_DOCUMENTS",
    "FILTER_DOCUMENTS",
    "PREVIEW_DOCUMENT",
    "MANAGE_STARRED_DOCUMENTS",
    "MOVE_DOCUMENT",
  ],
  VIEW_FOLDERS: [
    "CREATE_FOLDER",
    "RENAME_FOLDER",
    "DELETE_FOLDER",
    "MOVE_DOCUMENT",
  ],
  VIEW_TRASH: [
    "RESTORE_DOCUMENT",
    "PERMANENT_DELETE_DOCUMENT",
    "EMPTY_TRASH",
  ],
  VIEW_SUBSCRIPTION: [
    "VIEW_PLANS",
    "CHANGE_SUBSCRIPTION",
    "MANAGE_SUBSCRIPTION",
    "VIEW_PAYMENT_HISTORY",
  ],
  VIEW_NOTIFICATIONS: [
    "MANAGE_NOTIFICATIONS",
    "MARK_NOTIFICATION_READ",
  ],
};

const permissionParents = new Map();
for (const [parent, children] of Object.entries(PERMISSION_DEPENDENCIES)) {
  for (const child of children) {
    const parents = permissionParents.get(child) || [];
    parents.push(parent);
    permissionParents.set(child, parents);
  }
}

export const PERMISSION_GROUPS = [
  {
    title: "Dashboard",
    description: "Control access to the dashboard and its summaries.",
    permissions: [
      "VIEW_DASHBOARD",
      "VIEW_DASHBOARD_STATS",
      "VIEW_RECENT_DOCUMENTS",
      "VIEW_STORAGE_USAGE",
    ],
  },
  {
    title: "Documents",
    description: "Control document access and available document actions.",
    permissions: [
      "VIEW_DOCUMENTS",
      "UPLOAD_DOCUMENT",
      "DOWNLOAD_DOCUMENT",
      "DELETE_DOCUMENT",
      "RENAME_DOCUMENT",
      "VIEW_DOCUMENT_DETAILS",
      "SEARCH_DOCUMENTS",
      "SEARCH_BY_NAME",
      "SEARCH_BY_TYPE",
      "SORT_DOCUMENTS",
      "FILTER_DOCUMENTS",
      "PREVIEW_DOCUMENT",
      "MANAGE_STARRED_DOCUMENTS",
    ],
  },
  {
    title: "Folders & Organization",
    description: "Control folder pages and existing folder operations.",
    permissions: [
      "VIEW_FOLDERS",
      "CREATE_FOLDER",
      "RENAME_FOLDER",
      "DELETE_FOLDER",
      "MOVE_DOCUMENT",
    ],
  },
  {
    title: "Starred",
    description: "Control the Starred page separately from the Files page.",
    permissions: ["VIEW_STARRED"],
  },
  {
    title: "Trash",
    description: "Control access to Trash and its recovery actions.",
    permissions: [
      "VIEW_TRASH",
      "RESTORE_DOCUMENT",
      "PERMANENT_DELETE_DOCUMENT",
      "EMPTY_TRASH",
    ],
  },
  {
    title: "Subscription",
    description: "Control plan visibility and subscription actions.",
    permissions: [
      "VIEW_SUBSCRIPTION",
      "VIEW_PLANS",
      "CHANGE_SUBSCRIPTION",
      "MANAGE_SUBSCRIPTION",
      "VIEW_PAYMENT_HISTORY",
    ],
  },
  {
    title: "Notifications",
    description: "Control the existing in-app notification popover.",
    permissions: [
      "VIEW_NOTIFICATIONS",
      "MANAGE_NOTIFICATIONS",
      "MARK_NOTIFICATION_READ",
    ],
  },
];

export const MANAGEABLE_PERMISSIONS = PERMISSION_GROUPS.flatMap(
  (group) => group.permissions,
);

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
  VIEW_DASHBOARD: "View Dashboard",
  VIEW_DASHBOARD_STATS: "View Dashboard Stats",
  VIEW_RECENT_DOCUMENTS: "View Recent Documents",
  VIEW_STORAGE_USAGE: "View Storage Usage",
  PERMANENT_DELETE_DOCUMENT: "Permanently Delete Document",
  VIEW_DOCUMENT_DETAILS: "View Document Details",
  SEARCH_DOCUMENTS: "Search Documents",
  SEARCH_BY_NAME: "Search by Name",
  SEARCH_BY_TYPE: "Search by Type",
  SORT_DOCUMENTS: "Sort Documents",
  FILTER_DOCUMENTS: "Filter Documents",
  PREVIEW_DOCUMENT: "Preview Document",
  MANAGE_STARRED_DOCUMENTS: "Manage Starred Documents",
  VIEW_FOLDERS: "View Folders",
  CREATE_FOLDER: "Create Folder",
  RENAME_FOLDER: "Rename Folder",
  DELETE_FOLDER: "Delete Folder",
  MOVE_DOCUMENT: "Move Document",
  VIEW_STARRED: "View Starred",
  VIEW_PLANS: "View Plans",
  CHANGE_SUBSCRIPTION: "Change Subscription",
  MANAGE_SUBSCRIPTION: "Manage Subscription",
  VIEW_PAYMENT_HISTORY: "View Payment History",
  VIEW_NOTIFICATIONS: "View Notifications",
  MANAGE_NOTIFICATIONS: "Manage Notifications",
  MARK_NOTIFICATION_READ: "Mark Notification Read",
};

export const PERMISSION_DESCRIPTIONS = {
  VIEW_DASHBOARD_STATS: "Show document, starred, and security summary cards.",
  VIEW_RECENT_DOCUMENTS: "Show the recent documents table on the dashboard.",
  VIEW_STORAGE_USAGE: "Show storage quota and file-type usage summaries.",
  DELETE_DOCUMENT: "Move an active document into Trash.",
  PERMANENT_DELETE_DOCUMENT: "Permanently remove items from Trash or the vault.",
  SEARCH_BY_NAME: "Include document names in search results.",
  SEARCH_BY_TYPE: "Include file types in search results.",
  SORT_DOCUMENTS: "Use the existing document sort controls.",
  FILTER_DOCUMENTS: "Use existing document type and folder filters.",
  MANAGE_STARRED_DOCUMENTS: "Star or unstar documents.",
  RENAME_FOLDER: "Rename a folder through the existing folder API.",
  MOVE_DOCUMENT: "Move a document between existing folders.",
  CHANGE_SUBSCRIPTION: "Start or verify a plan change through Razorpay.",
  MANAGE_SUBSCRIPTION: "Manage or cancel the current subscription.",
  VIEW_PAYMENT_HISTORY: "View the latest payment/refund information DocVault exposes.",
  MANAGE_NOTIFICATIONS: "Clear the existing in-app notification list.",
  MARK_NOTIFICATION_READ: "Mark one or all in-app notifications as read.",
  SHARE_DOCUMENT: "Reserved legacy permission; sharing is not implemented.",
};

export const DEFAULT_USER_PERMISSIONS = PERMISSIONS;

export function getPermissionParents(permission) {
  return permissionParents.get(permission) || [];
}

export function applyPermissionDependencies(values, parentChanges = {}) {
  const result = Object.fromEntries(
    PERMISSIONS.map((permission) => [permission, values?.[permission] === true]),
  );

  for (const [parent, enabled] of Object.entries(parentChanges)) {
    result[parent] = enabled;
    for (const child of PERMISSION_DEPENDENCIES[parent] || []) {
      result[child] = enabled;
    }
  }

  for (const [parent, children] of Object.entries(PERMISSION_DEPENDENCIES)) {
    if (result[parent]) continue;
    for (const child of children) {
      result[child] = false;
    }
  }

  return result;
}

export function setPermissionValue(values, permission, enabled) {
  const nextValues = {
    ...values,
    [permission]: enabled,
  };

  if (Object.hasOwn(PERMISSION_DEPENDENCIES, permission)) {
    for (const child of PERMISSION_DEPENDENCIES[permission]) {
      nextValues[child] = enabled;
    }
  }

  return applyPermissionDependencies(nextValues);
}

export function createPermissionMap(enabledPermissions = []) {
  const enabled = new Set(enabledPermissions);
  return applyPermissionDependencies(
    Object.fromEntries(PERMISSIONS.map((permission) => [permission, enabled.has(permission)])),
  );
}