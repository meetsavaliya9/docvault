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

export default function ManagerFilesClient() {
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [ownerInput, setOwnerInput] = useState("");
  const [owner, setOwner] = useState("");
  const [fileType, setFileType] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [direction, setDirection] = useState("desc");
  const [types, setTypes] = useState([]);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      page: String(page),
      sort,
      direction,
    });
    if (search) query.set("search", search);
    if (owner) query.set("owner", owner);
    if (fileType) query.set("type", fileType);
    fetch(`/api/manager/files?${query}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 403) {
          setRestricted(true);
          return;
        }
        if (!response.ok) throw new Error("Could not load files.");
        const result = await response.json();
        setDocuments(Array.isArray(result.documents) ? result.documents : []);
        setTotal(Number(result.total) || 0);
        setTypes(Array.isArray(result.types) ? result.types : []);
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
  }, [page, search, owner, fileType, sort, direction, reload]);

  if (restricted) {
    return (
      <section className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PermissionDenied permission="VIEW_USER_FILES" />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
          Manager workspace
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Files
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Documents belonging to normal User accounts. Preview and download are permission-checked.
        </p>
      </header>

      <form
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setPage(1);
          setSearch(searchInput.trim());
          setOwner(ownerInput.trim());
        }}
      >
        <label htmlFor="manager-file-search" className="sr-only">
          Search files
        </label>
        <input
          id="manager-file-search"
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search files, types, or owners"
          className="min-h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <input
          type="search"
          value={ownerInput}
          onChange={(event) => setOwnerInput(event.target.value)}
          placeholder="Filter by user"
          aria-label="Filter files by user name or email"
          className="min-h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <select
          value={fileType}
          aria-label="Filter files by type"
          onChange={(event) => {
            setLoading(true);
            setPage(1);
            setFileType(event.target.value);
          }}
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
        >
          <option value="">All file types</option>
          {types.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Sort files"
          value={`${sort}:${direction}`}
          onChange={(event) => {
            const [nextSort, nextDirection] = event.target.value.split(":");
            setLoading(true);
            setPage(1);
            setSort(nextSort);
            setDirection(nextDirection);
          }}
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
        >
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
          <option value="name:asc">Name A–Z</option>
          <option value="name:desc">Name Z–A</option>
          <option value="type:asc">Type A–Z</option>
          <option value="rawBytes:desc">Largest first</option>
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Search
        </button>
        {(search || owner) && (
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setSearchInput("");
              setOwnerInput("");
              setSearch("");
              setOwner("");
              setPage(1);
            }}
            className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </form>

      {failed ? (
        <div role="alert" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          We couldn&apos;t load files right now.
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
      ) : documents.length === 0 ? (
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
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Folder</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3 sm:px-5">Uploaded</th>
                  <th className="px-4 py-3 sm:px-5">Status</th>
                  <th className="px-4 py-3 sm:px-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td className="max-w-64 px-4 py-3 font-medium text-slate-800 sm:px-5">
                      <span className="block truncate" title={document.name}>{document.name}</span>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs font-semibold text-blue-700">
                          File details
                        </summary>
                        <dl className="mt-2 space-y-1 text-xs font-normal text-slate-500">
                          <div>Document ID: {document.id}</div>
                          <div>Uploaded: {document.createdAt ? new Date(document.createdAt).toLocaleString() : "—"}</div>
                          <div>Status: Stored</div>
                        </dl>
                      </details>
                    </td>
                    <td className="min-w-52 px-4 py-3">
                      <Link
                        href={`/manager/users/${encodeURIComponent(document.user.id)}/files`}
                        className="block truncate font-medium text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        {document.user.name || document.user.email}
                      </Link>
                      <span className="block truncate text-xs text-slate-500">
                        {document.user.email}
                      </span>
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
