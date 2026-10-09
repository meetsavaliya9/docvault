"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PermissionDenied from "@/components/User/UI/PermissionDenied";

function formatBytes(bytes, fallback) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return fallback || "—";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export default function ManagerUserFilesClient({
  userId,
  panelPath = "/manager/users",
}) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/manager/users/${encodeURIComponent(userId)}/files?page=${page}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 403) {
          setRestricted(true);
          return;
        }
        if (!response.ok) {
          setFailed(true);
          return;
        }
        const result = await response.json();
        setAccount(result.user || null);
        setTotal(Number(result.total) || 0);
        setFailed(false);
        setRestricted(false);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [userId, page, reload]);

  if (restricted) {
    return <PermissionDenied permission="VIEW_USER_FILES" />;
  }

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <header>
        <Link
          href={panelPath}
          className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
        >
          ← Back to Users
        </Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
          User Files
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {account?.name || account?.email || "Files"}
        </h1>
        {account?.name && (
          <p className="mt-1 text-sm text-slate-500">{account.email}</p>
        )}
      </header>

      {failed ? (
        <div role="alert" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          We couldn&apos;t load this user&apos;s files right now.
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setLoading(true);
              setReload((value) => value + 1);
            }}
            className="ml-2 font-semibold text-blue-700 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Loading files…
        </p>
      ) : !account || account.documents.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          No files to display.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 sm:px-5">File</th>
                  <th className="px-4 py-3">Folder</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3 sm:px-5">Added</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 sm:px-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {account.documents.map((document) => (
                  <tr key={document.id}>
                    <td className="max-w-64 truncate px-4 py-3 font-medium text-slate-800 sm:px-5">
                      {document.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{document.folder || "—"}</td>
                    <td className="px-4 py-3 uppercase text-slate-600">{document.type || "File"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatBytes(document.rawBytes, document.size)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 sm:px-5">
                      {document.createdAt
                        ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                            new Date(document.createdAt),
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">Stored</td>
                    <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                      <a
                        href={`/api/manager/documents/${encodeURIComponent(document.id)}/media`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        Preview
                      </a>
                      <a
                        href={`/api/manager/documents/${encodeURIComponent(document.id)}/media?download=1`}
                        className="ml-3 font-semibold text-blue-700 hover:underline"
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-slate-500">
              {total.toLocaleString()} {total === 1 ? "file" : "files"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1 || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((value) => Math.max(1, value - 1));
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page * 25 >= total || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((value) => value + 1);
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
