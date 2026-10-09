"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PermissionDenied from "@/components/User/UI/PermissionDenied";

export default function ManagerUsersClient({
  canViewUserFiles = false,
  canViewSubscriptions = false,
  panelPath = "/manager/users",
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("createdAt");
  const [direction, setDirection] = useState("desc");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      page: String(page),
      status,
      sort,
      direction,
    });
    if (search) query.set("search", search);
    fetch(`/api/manager/users?${query}`, {
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
        setUsers(Array.isArray(result.users) ? result.users : []);
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
  }, [page, search, status, sort, direction, canViewUserFiles, canViewSubscriptions, reload]);

  if (restricted) {
    return <PermissionDenied permission="VIEW_USERS" />;
  }

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
          Workspace
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Users
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Browse active user accounts, their current plans, and permitted files.
        </p>
      </header>

      <form
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <label htmlFor="manager-user-search" className="sr-only">
          Search users
        </label>
        <input
          id="manager-user-search"
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by name or email"
          className="min-h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <select
          aria-label="Filter users by account status"
          value={status}
          onChange={(event) => {
            setLoading(true);
            setPage(1);
            setStatus(event.target.value);
          }}
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
        >
          <option value="all">All account statuses</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
        <select
          aria-label="Sort users"
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
          <option value="email:asc">Email A–Z</option>
          <option value="email:desc">Email Z–A</option>
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setSearchInput("");
              setSearch("");
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
          We couldn&apos;t load users right now.
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
          Loading users…
        </p>
      ) : users.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          No users to display.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <Link
                    href={`${panelPath}/${encodeURIComponent(user.id)}`}
                    className="truncate text-sm font-semibold text-blue-700 hover:underline"
                  >
                    {user.name || user.email}
                  </Link>
                  <p className="truncate text-sm text-slate-500">{user.email}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {canViewSubscriptions && (
                      <span className="capitalize">
                        {user.subscription?.plan || "Free"} · {user.subscription?.status || "free"}
                      </span>
                    )}
                    <span className="capitalize">{user.status || "active"}</span>
                    {user.documentCount !== null && (
                      <span>
                        {user.documentCount} {user.documentCount === 1 ? "file" : "files"}
                      </span>
                    )}
                    <span>
                      Joined {user.createdAt
                        ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                            new Date(user.createdAt),
                          )
                        : "—"}
                    </span>
                  </div>
                </div>
                {canViewUserFiles ? (
                  <Link
                    href={`${panelPath}/${encodeURIComponent(user.id)}/files`}
                    className="inline-flex w-fit items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                  >
                    View Files
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-slate-500">
              {total.toLocaleString()} {total === 1 ? "user" : "users"}
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
