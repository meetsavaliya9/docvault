"use client";

import { useEffect, useState } from "react";
import PermissionDenied from "@/components/User/UI/PermissionDenied";

const VIEW_CONFIG = {
  payments: {
    title: "Payments",
    endpoint: "/api/manager/payments",
    permission: "VIEW_PAYMENTS",
    collection: "payments",
    statuses: ["SUCCESS", "FAILED", "PENDING", "REFUNDED"],
  },
  subscriptions: {
    title: "Subscriptions",
    endpoint: "/api/manager/subscriptions",
    permission: "VIEW_SUBSCRIPTIONS",
    collection: "subscriptions",
    statuses: ["active", "trialing", "cancelled", "canceled", "expired", "refunded", "past_due", "pending"],
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

function formatAmount(amount, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format((Number(amount) || 0) / 100);
  } catch {
    return `${currency} ${((Number(amount) || 0) / 100).toFixed(2)}`;
  }
}

function Status({ value }) {
  const normalized = String(value || "unknown").toLowerCase();
  const className = ["success", "active"].includes(normalized)
    ? "bg-emerald-50 text-emerald-700"
    : ["failed", "refunded", "expired", "cancelled", "canceled"].includes(normalized)
      ? "bg-rose-50 text-rose-700"
      : "bg-amber-50 text-amber-700";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </span>
  );
}

export default function ManagerBillingClient({ kind }) {
  const config = VIEW_CONFIG[kind];
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [planInput, setPlanInput] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("createdAt");
  const [direction, setDirection] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      page: String(page),
      sort,
      direction,
    });
    if (search) query.set("search", search);
    if (plan) query.set("plan", plan);
    if (status !== "all") query.set("status", status);

    fetch(`${config.endpoint}?${query}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 403) {
          setRestricted(true);
          return;
        }
        if (!response.ok) {
          throw new Error(`Could not load ${config.title.toLowerCase()}.`);
        }
        const result = await response.json();
        setItems(Array.isArray(result[config.collection]) ? result[config.collection] : []);
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
  }, [config, page, search, plan, status, sort, direction, reload]);

  if (restricted) {
    return (
      <section className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PermissionDenied permission={config.permission} />
      </section>
    );
  }

  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const isPayments = kind === "payments";

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
          Manager workspace
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {config.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isPayments
            ? "Read-only payment records stored and verified by DocVault. Gateway-only historical records are not included."
            : "Read-only subscription records for normal user accounts."}
        </p>
      </header>

      <form
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setPage(1);
          setSearch(searchInput.trim());
          setPlan(planInput.trim());
        }}
      >
        <input
          type="search"
          aria-label={`Search ${config.title.toLowerCase()}`}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={isPayments ? "Search ID, user, or plan" : "Search user, plan, or ID"}
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <input
          type="search"
          aria-label="Filter by subscription plan"
          value={planInput}
          onChange={(event) => setPlanInput(event.target.value)}
          placeholder="Filter by plan"
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <select
          aria-label={`Filter ${config.title.toLowerCase()} by status`}
          value={status}
          onChange={(event) => {
            setLoading(true);
            setPage(1);
            setStatus(event.target.value);
          }}
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
        >
          <option value="all">All statuses</option>
          {config.statuses.map((value) => (
            <option key={value} value={value}>
              {value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select
          aria-label={`Sort ${config.title.toLowerCase()}`}
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
          <option value="status:asc">Status A–Z</option>
          <option value="status:desc">Status Z–A</option>
          <option value="plan:asc">Plan A–Z</option>
          <option value="user:asc">User A–Z</option>
          {isPayments && <option value="amount:desc">Amount high–low</option>}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Search
        </button>
      </form>

      {failed ? (
        <div role="alert" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          We couldn&apos;t load {config.title.toLowerCase()} right now. Please try again.
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
          Loading {config.title.toLowerCase()}…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          No {config.title.toLowerCase()} match these filters.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {isPayments ? (
                    <>
                      <th className="px-4 py-3">Payment / Order ID</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Payment date</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Started</th>
                      <th className="px-4 py-3">Renewal / end</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="align-top">
                    {isPayments ? (
                      <>
                        <td className="max-w-56 px-4 py-3 font-mono text-xs text-slate-700">
                          <span className="break-all">{item.paymentId || "—"}</span>
                          <details className="mt-2">
                            <summary className="cursor-pointer font-sans font-semibold text-blue-700">Details</summary>
                            <dl className="mt-2 space-y-1 font-sans text-xs text-slate-600">
                              <div>Recorded order amount: {formatAmount(item.amount, item.currency)}</div>
                              {item.amountPaid > 0 && <div>Verified paid: {formatAmount(item.amountPaid, item.currency)}</div>}
                              {item.refundedAmount > 0 && <div>Refunded: {formatAmount(item.refundedAmount, item.currency)}</div>}
                              {item.subscription && (
                                <div>
                                  Subscription: {item.subscription.plan || "Plan"} · {item.subscription.status}
                                  {item.subscription.endDate ? ` · ends ${formatDate(item.subscription.endDate)}` : ""}
                                </div>
                              )}
                            </dl>
                          </details>
                        </td>
                        <td className="min-w-48 px-4 py-3">
                          <span className="block font-medium text-slate-800">{item.user?.name || "User"}</span>
                          <span className="block text-xs text-slate-500">{item.user?.email || "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.planName || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                          {formatAmount(item.amount, item.currency)}
                        </td>
                        <td className="px-4 py-3"><Status value={item.status} /></td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(item.createdAt, true)}</td>
                      </>
                    ) : (
                      <>
                        <td className="min-w-48 px-4 py-3">
                          <span className="block font-medium text-slate-800">{item.user?.name || "User"}</span>
                          <span className="block text-xs text-slate-500">{item.user?.email || "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.planName || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{formatAmount(item.amount, item.currency)}</td>
                        <td className="px-4 py-3">
                          <Status value={item.status} />
                          {item.cancelAtPeriodEnd && <span className="mt-1 block text-xs text-slate-500">Cancels at period end</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(item.startDate || item.createdAt)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(item.endDate)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((value) => Math.max(1, value - 1));
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500">Page {page} of {pageCount}</span>
              <button
                type="button"
                disabled={page >= pageCount || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((value) => Math.min(pageCount, value + 1));
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
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
