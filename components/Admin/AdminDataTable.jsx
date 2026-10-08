"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PERMISSIONS,
  PERMISSION_DEPENDENCIES,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  getPermissionParents,
  setPermissionValue,
} from "@/lib/permissionConstants";

const resourceConfig = {
  users: {
    title: "Users",
    description: "Browse user accounts, plans, and access status.",
    endpoint: "/api/admin/users",
    collection: "users",
    singular: "user",
    filters: [
      ["all", "All users"],
      ["active", "Active"],
      ["blocked", "Blocked"],
    ],
  },
  documents: {
    title: "Documents",
    description: "Review document metadata across user vaults.",
    endpoint: "/api/admin/documents",
    collection: "documents",
    singular: "document",
    filters: [
      ["all", "All documents"],
      ["active", "Stored"],
      ["trash", "In trash"],
    ],
  },
  subscriptions: {
    title: "Subscriptions",
    description: "Review plan assignments and renewal periods.",
    endpoint: "/api/admin/subscriptions",
    collection: "subscriptions",
    singular: "subscription",
    filters: [
      ["all", "All statuses"],
      ["active", "Active"],
      ["trialing", "Trialing"],
      ["cancelled", "Cancelled"],
      ["canceled", "Canceled"],
      ["expired", "Expired"],
    ],
  },
  payments: {
    title: "Payments",
    description: "Payment history recorded by the DocVault Razorpay flow.",
    endpoint: "/api/admin/payments",
    collection: "payments",
    singular: "payment",
    filters: [
      ["all", "All statuses"],
      ["SUCCESS", "Success"],
      ["FAILED", "Failed"],
      ["PENDING", "Pending"],
      ["REFUNDED", "Refunded"],
    ],
  },
};

function formatDate(value, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(
    "en",
    includeTime
      ? { dateStyle: "medium", timeStyle: "short" }
      : { dateStyle: "medium" },
  ).format(date);
}

async function readPermissionResponse(response, action) {
  const body = await response.text();
  let result;
  try {
    result = body ? JSON.parse(body) : null;
  } catch {
    throw new Error(
      `Could not ${action}: the server returned an invalid response (HTTP ${response.status}).`,
    );
  }

  if (!result || typeof result !== "object") {
    throw new Error(
      `Could not ${action}: the server returned an empty response (HTTP ${response.status}).`,
    );
  }
  if (!response.ok || result.success === false) {
    throw new Error(
      result.error || `Could not ${action} (HTTP ${response.status}).`,
    );
  }
  return result;
}

function formatAmount(amount, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format((amount || 0) / 100);
  } catch {
    return `${currency} ${((amount || 0) / 100).toFixed(2)}`;
  }
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(1)} ${units[index]}`;
}

function StatusBadge({ value }) {
  const status = String(value || "unknown").toLowerCase();
  const style =
    status === "success" || status === "active" || status === "stored"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
      : status === "failed" ||
          status === "blocked" ||
          status === "expired" ||
          status === "refunded"
        ? "bg-rose-50 text-rose-700 ring-rose-600/15"
        : status === "pending" || status === "trialing"
          ? "bg-amber-50 text-amber-700 ring-amber-600/15"
          : "bg-slate-100 text-slate-600 ring-slate-500/10";
  const label =
    status === "success"
      ? "Success"
      : status === "stored"
        ? "Stored"
        : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${style}`}
    >
      {label}
    </span>
  );
}

function UserCell({ user }) {
  const email = user?.email || "Unknown user";
  return (
    <div className="flex min-w-44 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
        {(user?.name || email).slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-800">
          {user?.name || email.split("@")[0]}
        </span>
        <span className="block truncate text-xs text-slate-500">{email}</span>
      </span>
    </div>
  );
}

function columnsFor(resource) {
  if (resource === "users") {
    return [
      {
        label: "User",
        key: "name",
        render: (item) => <UserCell user={item} />,
      },
      {
        label: "Subscription",
        key: "subscription",
        render: (item) => (
          <span className="font-medium text-slate-700">
            {item.subscription?.planName || "Free"}
          </span>
        ),
      },
      {
        label: "Status",
        key: "isBlocked",
        render: (item) => (
          <StatusBadge value={item.isBlocked ? "blocked" : "active"} />
        ),
      },
      {
        label: "Documents",
        key: "documentCount",
        render: (item) => (
          <span className="tabular-nums text-slate-600">
            {item.documentCount || 0}
          </span>
        ),
      },
      {
        label: "Joined",
        key: "createdAt",
        render: (item) => formatDate(item.createdAt),
      },
    ];
  }
  if (resource === "documents") {
    return [
      {
        label: "Document",
        key: "name",
        render: (item) => (
          <span
            className="block max-w-56 truncate font-medium text-slate-800"
            title={item.name}
          >
            {item.name}
          </span>
        ),
      },
      {
        label: "Owner",
        key: "user.email",
        render: (item) => <UserCell user={item.user} />,
      },
      {
        label: "File type",
        key: "type",
        render: (item) => (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase text-slate-600">
            {item.type || "File"}
          </span>
        ),
      },
      {
        label: "Size",
        key: "rawBytes",
        render: (item) =>
          item.rawBytes
            ? formatBytes(item.rawBytes)
            : item.size || formatBytes(0),
      },
      {
        label: "Uploaded",
        key: "createdAt",
        render: (item) => formatDate(item.createdAt),
      },
      {
        label: "Status",
        key: "deleted",
        render: (item) => (
          <StatusBadge value={item.deleted ? "trash" : "stored"} />
        ),
      },
    ];
  }
  if (resource === "subscriptions") {
    return [
      {
        label: "User",
        key: "user.email",
        render: (item) => <UserCell user={item.user} />,
      },
      {
        label: "Plan",
        key: "planName",
        render: (item) => (
          <span className="font-semibold text-slate-800">
            {item.planName || item.planKey || "Free"}
          </span>
        ),
      },
      {
        label: "Status",
        key: "status",
        render: (item) => <StatusBadge value={item.status} />,
      },
      {
        label: "Start date",
        key: "startDate",
        render: (item) => formatDate(item.startDate || item.createdAt),
      },
      {
        label: "Renewal",
        key: "currentPeriodEnd",
        render: (item) => formatDate(item.endDate || item.currentPeriodEnd),
      },
      {
        label: "Amount",
        key: "amount",
        render: (item) =>
          item.amount ? formatAmount(item.amount, item.currency) : "—",
      },
    ];
  }
  return [
    {
      label: "Payment ID",
      key: "paymentId",
      render: (item) => (
        <span
          className="block max-w-44 truncate font-mono text-xs text-slate-600"
          title={item.paymentId}
        >
          {item.paymentId || item.razorpayOrderId}
        </span>
      ),
    },
    {
      label: "User",
      key: "user.email",
      render: (item) => <UserCell user={item.user} />,
    },
    {
      label: "Plan",
      key: "planName",
      render: (item) => (
        <span className="font-medium text-slate-700">
          {item.planName || item.plan}
        </span>
      ),
    },
    {
      label: "Amount",
      key: "amount",
      render: (item) => (
        <span className="font-semibold tabular-nums text-slate-800">
          {formatAmount(item.amount, item.currency)}
        </span>
      ),
    },
    {
      label: "Status",
      key: "status",
      render: (item) => <StatusBadge value={item.status} />,
    },
    {
      label: "Payment date",
      key: "createdAt",
      render: (item) => formatDate(item.createdAt, true),
    },
  ];
}

function sortableValue(item, key) {
  return key.split(".").reduce((value, part) => value?.[part], item);
}

export default function AdminDataTable({
  resource,
  initialSearch = "",
  selectedUserId = null,
}) {
  const config = resourceConfig[resource];
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState({ key: "createdAt", direction: "desc" });
  const [selected, setSelected] = useState(null);
  const [permissionTarget, setPermissionTarget] = useState(null);
  const [permissionValues, setPermissionValues] = useState({});
  const [permissionParentChanges, setPermissionParentChanges] = useState({});
  const [permissionError, setPermissionError] = useState("");
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [subscriptionMetrics, setSubscriptionMetrics] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (resource === "documents" && selectedUserId !== null) {
      params.set("userId", selectedUserId);
    }
    if (search.trim()) params.set("search", search.trim());
    if (status !== "all") params.set("status", status);
    if (resource === "documents" && type !== "all") params.set("type", type);
    fetch(`${config.endpoint}?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || `Could not load ${config.title.toLowerCase()}.`,
          );
        setError("");
        const collectionItems = result[config.collection] || [];
        setItems(
          resource === "users"
            ? collectionItems.filter(
                (user) => !user.isAdmin && user.role !== "ADMIN",
              )
            : collectionItems,
        );
        setTotal(result.total || 0);
        setSelectedUser(result.selectedUser || null);
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") {
          setItems([]);
          setTotal(0);
          setSelectedUser(null);
          setError(
            loadError.message ||
              `Could not load ${config.title.toLowerCase()}.`,
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    config,
    page,
    pageSize,
    reload,
    resource,
    search,
    selectedUserId,
    status,
    type,
  ]);

  useEffect(() => {
    if (resource !== "subscriptions") return;
    const controller = new AbortController();
    fetch("/api/admin", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || "Could not load subscription summary.",
          );
        setSubscriptionMetrics(result.summary?.subscriptionMetrics || {});
      })
      .catch((summaryError) => {
        if (summaryError.name !== "AbortError") {
          console.error("Could not load subscription summary:", summaryError);
        }
      });
    return () => controller.abort();
  }, [resource]);

  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((left, right) => {
      const a = sortableValue(left, sort.key);
      const b = sortableValue(right, sort.key);
      const comparison =
        a == null || b == null
          ? String(a || "").localeCompare(String(b || ""))
          : typeof a === "number" && typeof b === "number"
            ? a - b
            : String(a).localeCompare(String(b), undefined, {
                numeric: true,
                sensitivity: "base",
              });
      return sort.direction === "asc" ? comparison : -comparison;
    });
    return copy;
  }, [items, sort]);

  const columns = columnsFor(resource);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const refreshItems = () => {
    setLoading(true);
    setReload((value) => value + 1);
  };

  const toggleSort = (key) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  const openPermissionEditor = async (item) => {
    setPermissionTarget(item);
    setPermissionValues({});
    setPermissionParentChanges({});
    setPermissionError("");
    setPermissionsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(item.id)}/permissions`,
        { cache: "no-store" },
      );
      const result = await readPermissionResponse(
        response,
        "load user permissions",
      );
      if (!result.permissions || typeof result.permissions !== "object") {
        throw new Error("The server returned an invalid permissions list.");
      }
      setPermissionValues(result.permissions || {});
      setPermissionParentChanges({});
    } catch (loadError) {
      setPermissionValues({});
      setPermissionParentChanges({});
      setPermissionError(
        loadError.name === "TypeError"
          ? "Could not reach the server. Check your connection and try again."
          : loadError.message || "Could not load user permissions.",
      );
    } finally {
      setPermissionsLoading(false);
    }
  };

  const savePermissions = async () => {
    if (!permissionTarget) return;
    setPermissionsSaving(true);
    setPermissionError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(permissionTarget.id)}/permissions`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            permissions: permissionValues,
            parentChanges: permissionParentChanges,
          }),
        },
      );
      const result = await readPermissionResponse(
        response,
        "save user permissions",
      );
      setNotice(result.message || "Permissions saved.");
      setPermissionTarget(null);
    } catch (saveError) {
      setPermissionError(
        saveError.name === "TypeError"
          ? "Could not reach the server. Check your connection and try again."
          : saveError.message || "Could not save user permissions.",
      );
    } finally {
      setPermissionsSaving(false);
    }
  };

  const handleAction = async (item, action) => {
    const isDelete = action === "delete";
    const label = resource === "users" ? item.email : item.name;
    if (
      isDelete &&
      !window.confirm(
        `Permanently delete ${resource === "users" ? "this account and its related data" : "this document"}${label ? ` (${label})` : ""}? This cannot be undone.`,
      )
    )
      return;
    setError("");
    setNotice("");
    try {
      let endpoint =
        resource === "users"
          ? `/api/admin/users/${encodeURIComponent(item.id)}`
          : `/api/admin/documents/${encodeURIComponent(item.id)}`;
      if (resource === "documents" && selectedUserId !== null) {
        endpoint += `?userId=${encodeURIComponent(selectedUserId)}`;
      }
      const response = await fetch(
        endpoint,
        isDelete
          ? { method: "DELETE" }
          : {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isBlocked: !item.isBlocked }),
            },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "This action could not be completed.");
      setNotice(result.message || "Changes saved.");
      setLoading(true);
      setReload((value) => value + 1);
    } catch (actionError) {
      setError(actionError.message || "This action could not be completed.");
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
            Management
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {config.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{config.description}</p>
          {resource === "documents" && selectedUserId !== null && (
            <div className="mt-3">
              <p className="text-sm font-medium text-slate-700">
                Showing files for:{" "}
                {selectedUser?.name || selectedUser?.email || "Selected user"}
              </p>
              {selectedUser?.name && selectedUser?.email && (
                <p className="mt-0.5 text-sm text-slate-500">
                  {selectedUser.email}
                </p>
              )}
              <Link
                href="/admin/users"
                className="mt-3 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                ← Back to Users
              </Link>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
          <span className="font-semibold text-slate-900">
            {total.toLocaleString()}
          </span>{" "}
          {config.title.toLowerCase()}
        </div>
      </div>

      {resource === "subscriptions" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              "Free users",
              subscriptionMetrics?.freeAccounts || 0,
              "bg-slate-100 text-slate-600",
            ],
            [
              "Plus users",
              subscriptionMetrics?.plusSubscribers || 0,
              "bg-blue-50 text-blue-700",
            ],
            [
              "Pro users",
              subscriptionMetrics?.proSubscribers || 0,
              "bg-violet-50 text-violet-700",
            ],
            [
              "Active subscriptions",
              subscriptionMetrics?.planSubscribers || 0,
              "bg-emerald-50 text-emerald-700",
            ],
          ].map(([label, value, accent]) => (
            <article
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                {Number(value).toLocaleString()}
              </p>
              <span
                className={`mt-2 inline-flex rounded-md px-2 py-1 text-[10px] font-semibold ${accent}`}
              >
                Live data
              </span>
            </article>
          ))}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            className="font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search {config.title}</span>
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={`Search ${config.title.toLowerCase()}...`}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </label>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <label>
            <span className="sr-only">Filter {config.title}</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 sm:w-auto"
            >
              {config.filters.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {resource === "documents" && (
            <label>
              <span className="sr-only">Filter documents by type</span>
              <select
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 sm:w-auto"
              >
                <option value="all">All file types</option>
                {[
                  "PDF",
                  "DOC",
                  "DOCX",
                  "TXT",
                  "PNG",
                  "JPG",
                  "JPEG",
                  "WEBP",
                  "GIF",
                  "SVG",
                ].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={refreshItems}
            disabled={loading}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div
            className="space-y-3 p-5"
            aria-label={`Loading ${config.title.toLowerCase()}`}
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-11 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M4 5h16v14H4zM8 9h8M8 13h5" />
              </svg>
            </span>
            <h2 className="mt-4 text-sm font-semibold text-slate-900">
              {resource === "documents" &&
              selectedUserId !== null &&
              selectedUser?.documentCount === 0
                ? "No documents uploaded by this user."
                : `No ${config.title.toLowerCase()} found`}
            </h2>
            {!(
              resource === "documents" &&
              selectedUserId !== null &&
              selectedUser?.documentCount === 0
            ) && (
              <p className="mt-1 text-sm text-slate-500">
                {search || status !== "all" || type !== "all"
                  ? "Try adjusting your search or filters."
                  : `There are no ${config.title.toLowerCase()} to display yet.`}
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left">
              <thead className="bg-slate-50">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="inline-flex items-center gap-1.5 hover:text-slate-900"
                      >
                        {column.label}
                        <span aria-hidden="true" className="text-slate-400">
                          {sort.key === column.key
                            ? sort.direction === "asc"
                              ? "↑"
                              : "↓"
                            : "↕"}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedItems.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50/70">
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-600"
                      >
                        {column.render(item)}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {resource === "users" && (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelected(item)}
                              className="px-1 py-1.5 text-xs font-semibold text-blue-700 transition-colors duration-200 hover:text-blue-900 hover:underline"
                            >
                              View
                            </button>
                            <Link
                              href={`/admin/documents?userId=${encodeURIComponent(item.id)}`}
                              className="px-1 py-1.5 text-xs font-semibold text-green-700 transition-colors duration-200 hover:text-green-900 hover:underline"
                            >
                              View Files
                            </Link>
                            {!item.isAdmin && (
                              <button
                                type="button"
                                onClick={() => openPermissionEditor(item)}
                                className="px-1 py-1.5 text-xs font-semibold text-purple-700 transition-colors duration-200 hover:text-purple-900 hover:underline"
                              >
                                Permissions
                              </button>
                            )}
                            {!item.isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleAction(item, "block")}
                                className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                              >
                                {item.isBlocked ? "Unblock" : "Block"}
                              </button>
                            )}
                            {!item.isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleAction(item, "delete")}
                                className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                              >
                                Delete
                              </button>
                            )}
                            {item.isAdmin && (
                              <span className="px-2 text-[11px] font-medium text-slate-400">
                                Admin
                              </span>
                            )}
                          </>
                        )}
                        {resource === "documents" && (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelected(item)}
                              className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAction(item, "delete")}
                              className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {resource === "subscriptions" && (
                          <Link
                            href={`/admin/users?search=${encodeURIComponent(item.user?.email || "")}`}
                            className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            View user
                          </Link>
                        )}
                        {resource === "payments" && (
                          <button
                            type="button"
                            onClick={() => setSelected(item)}
                            className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            Details
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
              </span>{" "}
              of <span className="font-semibold text-slate-700">{total}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs tabular-nums text-slate-500">
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() =>
                  setPage((value) => Math.min(pageCount, value + 1))
                }
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-detail-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  {resource.slice(0, -1)} details
                </p>
                <h2
                  id="admin-detail-title"
                  className="mt-1 truncate text-lg font-bold text-slate-900"
                >
                  {resource === "users"
                    ? selected.name || selected.email
                    : resource === "documents"
                      ? selected.name
                      : resource === "payments"
                        ? selected.paymentId
                        : selected.planName}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close details"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <dl className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {resource === "users" && (
                <>
                  <Detail label="Email" value={selected.email} />
                  <Detail
                    label="Status"
                    value={selected.isBlocked ? "Blocked" : "Active"}
                  />
                  <Detail
                    label="Subscription"
                    value={selected.subscription?.planName || "Free"}
                  />
                  <Detail
                    label="Documents"
                    value={selected.documentCount ?? 0}
                  />
                  <Detail
                    label="Joined"
                    value={formatDate(selected.createdAt)}
                  />
                  <Detail label="Account ID" value={selected.id} />
                </>
              )}
              {resource === "documents" && (
                <>
                  <Detail label="Owner" value={selected.user?.email} />
                  <Detail label="File type" value={selected.type} />
                  <Detail label="Size" value={formatBytes(selected.rawBytes)} />
                  <Detail
                    label="Uploaded"
                    value={formatDate(selected.createdAt, true)}
                  />
                  <Detail
                    label="Status"
                    value={selected.deleted ? "In trash" : "Stored"}
                  />
                </>
              )}
              {resource === "payments" && (
                <>
                  <Detail label="User" value={selected.user?.email} />
                  <Detail label="Plan" value={selected.planName} />
                  <Detail
                    label="Amount"
                    value={formatAmount(selected.amount, selected.currency)}
                  />
                  <Detail label="Status" value={selected.status} />
                  <Detail label="Payment ID" value={selected.paymentId} />
                  <Detail
                    label="Created"
                    value={formatDate(selected.createdAt, true)}
                  />
                </>
              )}
            </dl>
            {resource === "subscriptions" && (
              <dl className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <Detail label="User" value={selected.user?.email} />
                <Detail label="Status" value={selected.status} />
                <Detail label="Plan" value={selected.planName} />
                <Detail label="Provider" value={selected.provider} />
                <Detail
                  label="Start date"
                  value={formatDate(selected.startDate || selected.createdAt)}
                />
                <Detail
                  label="Renewal date"
                  value={formatDate(
                    selected.endDate || selected.currentPeriodEnd,
                  )}
                />
                <Detail
                  label="Amount"
                  value={
                    selected.amount
                      ? formatAmount(selected.amount, selected.currency)
                      : "—"
                  }
                />
                <Detail
                  label="Subscription ID"
                  value={selected.stripeSubscriptionId || "—"}
                />
              </dl>
            )}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {permissionTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPermissionTarget(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-permissions-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  User access
                </p>
                <h2
                  id="user-permissions-title"
                  className="mt-1 truncate text-lg font-bold text-slate-900"
                >
                  Manage Permissions
                </h2>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {permissionTarget.name || permissionTarget.email}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close permissions"
                onClick={() => setPermissionTarget(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="mt-5 max-h-[60vh] overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 px-4">
              {permissionsLoading ? (
                <p className="py-6 text-sm text-slate-500">
                  Loading permissions...
                </p>
              ) : permissionError ? (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-3 py-4 text-sm text-rose-700"
                >
                  <span>{permissionError}</span>
                  <button
                    type="button"
                    onClick={() => openPermissionEditor(permissionTarget)}
                    className="shrink-0 font-semibold text-blue-700 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                PERMISSION_GROUPS.map((group) => (
                  <section key={group.title} className="py-3">
                    <h3 className="text-sm font-semibold text-slate-800">
                      {group.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {group.description}
                    </p>
                    <div className="mt-1 divide-y divide-slate-100">
                      {group.permissions.map((permission) => (
                        <div
                          key={permission}
                          className="flex items-center justify-between gap-4 py-3"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-700">
                              {PERMISSION_LABELS[permission]}
                            </span>
                            {PERMISSION_DESCRIPTIONS[permission] && (
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {PERMISSION_DESCRIPTIONS[permission]}
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={permissionValues[permission] === true}
                            aria-disabled={
                              permissionsLoading ||
                              getPermissionParents(permission).some(
                                (parent) => permissionValues[parent] !== true,
                              )
                            }
                            aria-label={PERMISSION_LABELS[permission]}
                            disabled={
                              permissionsLoading ||
                              getPermissionParents(permission).some(
                                (parent) => permissionValues[parent] !== true,
                              )
                            }
                            onClick={() => {
                              const enabled = permissionValues[permission] !== true;
                              setPermissionValues((current) =>
                                setPermissionValue(current, permission, enabled),
                              );
                              if (Object.hasOwn(PERMISSION_DEPENDENCIES, permission)) {
                                setPermissionParentChanges((current) => ({
                                  ...current,
                                  [permission]: enabled,
                                }));
                              }
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${permissionValues[permission] ? "bg-blue-600" : "bg-slate-300"}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${permissionValues[permission] ? "translate-x-6" : "translate-x-1"}`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPermissionTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              {!permissionError && (
                <button
                  type="button"
                  disabled={
                    permissionsLoading ||
                    permissionsSaving ||
                    Object.keys(permissionValues).length !== PERMISSIONS.length
                  }
                  onClick={savePermissions}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {permissionsSaving ? "Saving..." : "Save Permissions"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-all text-sm font-medium text-slate-800">
        {value || "—"}
      </dd>
    </div>
  );
}
