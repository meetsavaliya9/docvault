"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PermissionDenied from "@/components/User/UI/PermissionDenied";

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function formatBytes(value) {
  let bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let index = -1;
  do {
    bytes /= 1024;
    index += 1;
  } while (bytes >= 1024 && index < units.length - 1);
  return `${bytes.toFixed(1)} ${units[index]}`;
}

function formatMoney(value, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format((Number(value) || 0) / 100);
  } catch {
    return `${currency || "INR"} ${((Number(value) || 0) / 100).toFixed(2)}`;
  }
}

function formatCurrencyTotals(rows) {
  if (!rows?.length) return "—";
  return rows.map((row) => `${row.currency} ${formatMoney(row.gross, row.currency)}`).join(" · ");
}

function formatDate(value, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" } : {}),
    timeZone: "UTC",
  }).format(date);
}

function formatPeriod(value, range) {
  if (!value) return "—";
  const date = new Date(value.length === 7 ? `${value}-01T00:00:00Z` : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    ...(range === "all" ? { year: "numeric" } : { day: "numeric" }),
    timeZone: "UTC",
  }).format(date);
}

function SectionHeading({ title, description, href, linkLabel }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="w-fit text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline"
        >
          {linkLabel || "View all"} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {value}
      </p>
      {detail && <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>}
    </article>
  );
}

function Panel({ title, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ children = "No matching records in this date range." }) {
  return <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

function BarList({ rows, labelKey, formatValue = formatCount }) {
  if (!rows?.length) return <EmptyState />;
  const max = Math.max(...rows.map((row) => Number(row.count) || 0), 1);
  return (
    <ul className="space-y-4">
      {rows.map((row, index) => {
        const amount = Number(row.count) || 0;
        return (
          <li key={`${row[labelKey]}-${index}`} className="min-w-0">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-600">{row[labelKey]}</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-800">{formatValue(amount, row)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${amount > 0 ? Math.max(3, (amount / max) * 100) : 0}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FileOwnerList({ rows }) {
  if (!rows?.length) return <EmptyState />;
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map(({ user, count, bytes }) => (
        <li key={user.id} className="flex items-center justify-between gap-3 py-3 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-800">{user.name || user.email}</span>
            <span className="block truncate text-xs text-slate-500">{user.email}</span>
          </span>
          <span className="shrink-0 text-right text-slate-600">
            {formatCount(count)} files · {formatBytes(bytes)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TrendChart({ rows, valueKey = "count", formatter = formatCount, range = "30d" }) {
  if (!rows?.length) return <EmptyState />;
  const width = 640;
  const height = 220;
  const left = 16;
  const right = width - 16;
  const top = 16;
  const bottom = height - 36;
  const max = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1);
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? width / 2 : left + ((right - left) * index) / (rows.length - 1);
    const y = bottom - ((Number(row[valueKey]) || 0) / max) * (bottom - top);
    return { x, y, row };
  });
  const line = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const fill = `${left},${bottom} ${line} ${right},${bottom}`;

  return (
    <div className="min-w-0">
      <svg
        className="h-48 w-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Activity trend chart"
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = bottom - ratio * (bottom - top);
          return (
            <line
              key={ratio}
              x1={left}
              x2={right}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="4 5"
            />
          );
        })}
        <polygon points={fill} fill="#2563eb" fillOpacity="0.1" />
        <polyline
          points={line}
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map(({ x, y, row }) => (
          <circle key={row.period} cx={x} cy={y} r="4" fill="#2563eb">
            <title>{`${formatPeriod(row.period, range)}: ${formatter(Number(row[valueKey]) || 0, row)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between gap-2 text-[11px] text-slate-500">
        <span>{formatPeriod(rows[0].period, range)}</span>
        {rows.length > 2 && <span>{formatPeriod(rows[Math.floor(rows.length / 2)].period, range)}</span>}
        <span>{formatPeriod(rows[rows.length - 1].period, range)}</span>
      </div>
    </div>
  );
}

function DataTable({ headers, children, empty }) {
  return (
    <div className="overflow-x-auto">
      {empty ? (
        <EmptyState />
      ) : (
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>{headers.map((header) => <th key={header} className="whitespace-nowrap py-2 pr-4 font-semibold">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const value = String(status || "unknown");
  const normalized = value.toLowerCase();
  const color = ["success", "active", "trialing"].includes(normalized)
    ? "bg-emerald-50 text-emerald-700"
    : ["failed", "refunded", "expired", "cancelled", "canceled"].includes(normalized)
      ? "bg-rose-50 text-rose-700"
      : "bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${color}`}>{value}</span>;
}

function RevenueRows({ rows, amountKey = "gross", showRefunds = false }) {
  if (!rows?.length) return <EmptyState>No verified payment totals are available.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="whitespace-nowrap py-2 pr-4">Currency / plan</th>
            <th className="whitespace-nowrap py-2 pr-4">Verified payments</th>
            <th className="whitespace-nowrap py-2 pr-4">Gross paid</th>
            {showRefunds && <th className="whitespace-nowrap py-2 pr-4">Refunds</th>}
            {showRefunds && <th className="whitespace-nowrap py-2">Net paid</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={`${row.currency}-${row.plan || index}`}>
              <td className="whitespace-nowrap py-3 pr-4 font-medium text-slate-800">
                {row.plan ? `${row.plan} · ` : ""}{row.currency}
              </td>
              <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-slate-600">{formatCount(row.count)}</td>
              <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-slate-600">{formatMoney(row[amountKey], row.currency)}</td>
              {showRefunds && <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-slate-600">{formatMoney(row.refunded, row.currency)}</td>}
              {showRefunds && <td className="whitespace-nowrap py-3 tabular-nums font-semibold text-slate-800">{formatMoney(row.net, row.currency)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div role="status" aria-label="Loading dashboard" className="space-y-6">
      <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="grid animate-pulse gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-2xl bg-slate-200" />
        <div className="h-72 rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}

function UserSection({ data, range }) {
  return (
    <section className="space-y-4">
      <SectionHeading title="Users overview" description="Normal user accounts only; Admin and Manager accounts are excluded." href="/manager/users" linkLabel="View all users" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Registered users · lifetime" value={formatCount(data.total)} />
        <MetricCard label="Active accounts · lifetime" value={formatCount(data.active)} detail="Accounts not currently blocked" />
        <MetricCard label="Joined today · UTC" value={formatCount(data.newToday)} />
        <MetricCard label="Joined this month · UTC" value={formatCount(data.newThisMonth)} detail={`${formatCount(data.selectedNew)} registered in selected range`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Registration trend">
          <TrendChart rows={data.trend} range={range} />
        </Panel>
        {data.byPlan && (
          <Panel title="Users by current subscription plan">
            <BarList rows={data.byPlan} labelKey="plan" />
          </Panel>
        )}
      </div>
      <Panel title="Recent registrations">
        <DataTable
          headers={["Name", "Email", "Plan", "Registered"]}
          empty={!data.recent.length}
        >
          {data.recent.map((user) => (
            <tr key={user.id}>
              <td className="whitespace-nowrap py-3 pr-4">
                <Link href={`/manager/users/${encodeURIComponent(user.id)}`} className="font-semibold text-blue-700 hover:underline">{user.name || user.email}</Link>
              </td>
              <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{user.email}</td>
              <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{user.plan || "Restricted"}</td>
              <td className="whitespace-nowrap py-3 text-slate-600">{formatDate(user.createdAt)}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </section>
  );
}

function FileSection({ data, range }) {
  return (
    <section className="space-y-4">
      <SectionHeading title="Files and storage" description="Active stored documents only; trashed/deleted records are excluded." href="/manager/files" linkLabel="View all files" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active files · lifetime" value={formatCount(data.total)} />
        <MetricCard label="Storage used · lifetime" value={formatBytes(data.totalBytes)} detail="Sum of stored raw file bytes" />
        <MetricCard label="Uploaded today · UTC" value={formatCount(data.uploadedToday)} />
        <MetricCard label="Uploaded this month · UTC" value={formatCount(data.uploadedThisMonth)} detail={`${formatCount(data.selectedCount)} uploaded in selected range`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="File uploads over time">
          <TrendChart rows={data.trend} range={range} />
        </Panel>
        <Panel title="File type distribution">
          <BarList rows={data.byType} labelKey="type" />
        </Panel>
        <Panel title="Top file owners · lifetime">
          <FileOwnerList rows={data.largestOwners} />
        </Panel>
      </div>
      <Panel title="Recent uploads">
        <DataTable headers={["File", "Owner", "Type", "Size", "Uploaded"]} empty={!data.recent.length}>
          {data.recent.map((file) => (
            <tr key={file.id}>
              <td className="max-w-48 truncate py-3 pr-4 font-semibold text-slate-800">{file.name}</td>
              <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{file.user.name || file.user.email}</td>
              <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{file.type || "Unknown"}</td>
              <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{formatBytes(file.rawBytes)}</td>
              <td className="whitespace-nowrap py-3 text-slate-600">{formatDate(file.createdAt)}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </section>
  );
}

function PaymentSection({ data, range }) {
  const successfulRows = data.lifetimeRevenue || [];
  const currencies = [...new Set(data.trend.map((row) => row.currency))];
  return (
    <section className="space-y-4">
      <SectionHeading title="Payments overview" description="Only server-recorded successful payment verifications count toward paid totals." href="/manager/payments" linkLabel="View all payments" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Verified successful payments · lifetime" value={formatCount(data.totalSuccess)} />
        <MetricCard label="Successful today · UTC" value={formatCount(data.successfulToday)} />
        <MetricCard label="Successful this month · UTC" value={formatCount(data.successfulThisMonth)} />
        <MetricCard label="Pending / failed · selected range" value={`${formatCount(data.pending)} / ${formatCount(data.failed)}`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard label="Gross verified payments today · UTC" value={formatCurrencyTotals(data.revenueToday)} detail="Before refunds; recorded payment currency" />
        <MetricCard label="Gross verified payments this month · UTC" value={formatCurrencyTotals(data.revenueThisMonth)} detail="Before refunds; recorded payment currency" />
      </div>
      <Panel title="Lifetime verified payment totals">
        <RevenueRows rows={successfulRows} showRefunds />
        <p className="mt-3 text-xs text-slate-500">Transaction totals are not recurring revenue forecasts. Values use each payment&apos;s stored currency.</p>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          {currencies.length ? currencies.map((currency) => (
            <Panel key={currency} title={`Verified payment trend · ${currency}`}>
              <TrendChart
                rows={data.trend.filter((row) => row.currency === currency)}
                valueKey="gross"
                formatter={(amount) => formatMoney(amount, currency)}
                range={range}
              />
            </Panel>
          )) : <Panel title="Verified payment trend"><EmptyState>No verified payments in this date range.</EmptyState></Panel>}
        </div>
        <Panel title="Payment status breakdown · selected range">
          <BarList
            rows={Object.entries(data.selectedStatusCounts).map(([status, count]) => ({ status, count }))}
            labelKey="status"
          />
        </Panel>
      </div>
      <Panel title={`Recent payments · ${RANGE_OPTIONS.find((item) => item.value === range)?.label || "selected range"}`}>
        <DataTable headers={["Payment ID", "User", "Plan", "Paid", "Status", "Payment date"]} empty={!data.recent.length}>
          {data.recent.map((payment) => (
            <tr key={payment.id}>
              <td className="max-w-44 truncate py-3 pr-4 font-mono text-xs text-slate-700">{payment.paymentId}</td>
              <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{payment.user.name || payment.user.email}</td>
              <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{payment.plan}</td>
              <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-slate-700">{formatMoney(payment.amount, payment.currency)}</td>
              <td className="whitespace-nowrap py-3 pr-4"><StatusPill status={payment.status} /></td>
              <td className="whitespace-nowrap py-3 text-slate-600">{formatDate(payment.createdAt, true)}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </section>
  );
}

function RevenueSection({ revenue, payments }) {
  return (
    <section className="space-y-4">
      <SectionHeading title="Revenue analytics" description="Revenue is calculated from verified payment records, not subscription list prices." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Verified revenue today · UTC">
          <RevenueRows rows={payments.revenueToday} showRefunds />
        </Panel>
        <Panel title="Verified revenue this month · UTC">
          <RevenueRows rows={payments.revenueThisMonth} showRefunds />
        </Panel>
      </div>
      <Panel title="Verified revenue in selected range">
        <RevenueRows rows={revenue.selected} showRefunds />
      </Panel>
      {revenue.byPlan && (
        <Panel title="Verified payment totals by plan in selected range">
          <RevenueRows rows={revenue.byPlan} showRefunds />
        </Panel>
      )}
    </section>
  );
}

function SubscriptionSection({ data }) {
  return (
    <section className="space-y-4">
      <SectionHeading title="Subscriptions overview" description="Active totals exclude cancelled and expired subscriptions." href="/manager/subscriptions" linkLabel="View subscriptions" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Subscription records · lifetime" value={formatCount(data.total)} detail={`${formatCount(data.selectedTotal)} created in selected range`} />
        <MetricCard label="Active subscriptions" value={formatCount(data.active)} detail="Active or trialing and within their stored term" />
        <MetricCard label="Cancelled" value={formatCount(data.cancelled)} />
        <MetricCard label="Expired" value={formatCount(data.expired)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Active subscriptions by plan"><BarList rows={data.byPlan} labelKey="plan" /></Panel>
        <Panel title="Subscription status distribution"><BarList rows={data.statuses} labelKey="status" /></Panel>
      </div>
      <Panel title="Recent subscription changes">
        <DataTable headers={["User", "Plan", "Status", "Last updated"]} empty={!data.recent.length}>
          {data.recent.map((subscription) => (
            <tr key={subscription.id}>
              <td className="whitespace-nowrap py-3 pr-4 text-slate-700">{subscription.user.name || subscription.user.email}</td>
              <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{subscription.plan}</td>
              <td className="whitespace-nowrap py-3 pr-4"><StatusPill status={subscription.status} /></td>
              <td className="whitespace-nowrap py-3 text-slate-600">{formatDate(subscription.updatedAt, true)}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </section>
  );
}

function RecentActivity({ records }) {
  return (
    <Panel title="Recent activity">
      {!records?.length ? (
        <EmptyState>No recent authorized registrations, uploads, payments, or subscription updates.</EmptyState>
      ) : (
        <ol className="divide-y divide-slate-100">
          {records.map((record) => (
            <li key={record.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <Link href={record.href} className="truncate text-sm font-semibold text-blue-700 hover:underline">{record.label}</Link>
                <p className="truncate text-xs text-slate-500">{record.detail}</p>
              </div>
              <time className="shrink-0 text-xs text-slate-500">{formatDate(record.at, true)}</time>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export default function ManagerDashboardClient({ managerName }) {
  const [range, setRange] = useState("30d");
  const [reload, setReload] = useState(0);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/manager/dashboard?range=${encodeURIComponent(range)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 403) {
          setRestricted(true);
          setDashboard(null);
          setFailed(false);
          return null;
        }
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error || "Dashboard request failed.");
        }
        return response.json();
      })
      .then((data) => {
        if (!data) return;
        setDashboard(data);
        setRestricted(false);
        setFailed(false);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [range, reload]);

  useEffect(() => {
    function refreshOnReturn() {
      if (document.visibilityState === "visible") {
        setLoading(true);
        setReload((value) => value + 1);
      }
    }
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, []);

  if (restricted) {
    return (
      <section className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PermissionDenied permission="VIEW_DASHBOARD" />
      </section>
    );
  }

  const permissions = dashboard?.permissions;
  const hasSections = permissions && (
    permissions.users || permissions.files || permissions.payments || permissions.subscriptions
  );

  return (
    <section className="mx-auto max-w-7xl space-y-7 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Manager workspace</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Operational dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Welcome, {managerName}. Operational metrics are sourced from current DocVault records. Date filters use UTC calendar boundaries.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="manager-dashboard-range">Report date range</label>
          <select
            id="manager-dashboard-range"
            value={range}
            onChange={(event) => {
              setLoading(true);
              setRange(event.target.value);
            }}
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
          >
            {RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setReload((value) => value + 1);
            }}
            className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {failed ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          We couldn&apos;t load the dashboard data. Please try again.
          <button type="button" onClick={() => {
            setLoading(true);
            setReload((value) => value + 1);
          }} className="ml-2 font-semibold underline">Retry</button>
        </div>
      ) : loading ? (
        <LoadingDashboard />
      ) : (
        <>
          {dashboard?.overall && (
            <section className="space-y-4">
              <SectionHeading title="Website activity · lifetime" description="Only totals authorized by your current data permissions are included." />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {dashboard.overall.users !== null && <MetricCard label="Users" value={formatCount(dashboard.overall.users)} />}
                {dashboard.overall.files !== null && <MetricCard label="Files" value={formatCount(dashboard.overall.files)} />}
                {dashboard.overall.storageBytes !== null && <MetricCard label="Storage used" value={formatBytes(dashboard.overall.storageBytes)} />}
                {dashboard.overall.successfulPayments !== null && <MetricCard label="Verified payments" value={formatCount(dashboard.overall.successfulPayments)} />}
                {dashboard.overall.activeSubscriptions !== null && <MetricCard label="Active subscriptions" value={formatCount(dashboard.overall.activeSubscriptions)} />}
              </div>
            </section>
          )}

          {loading && dashboard && (
            <p role="status" className="text-xs text-slate-500">Refreshing dashboard data…</p>
          )}

          {!hasSections && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              Your dashboard is available, but user, file, payment, and subscription sections are restricted. Ask an administrator to enable the relevant Manager permissions.
            </div>
          )}

          {permissions?.users && <UserSection data={dashboard.users} range={range} />}
          {permissions?.files && <FileSection data={dashboard.files} range={range} />}
          {permissions?.payments && <PaymentSection data={dashboard.payments} range={range} />}
          {permissions?.reports && permissions.payments && dashboard.payments?.revenue && (
            <RevenueSection revenue={dashboard.payments.revenue} payments={dashboard.payments} />
          )}
          {permissions?.subscriptions && <SubscriptionSection data={dashboard.subscriptions} />}
          {permissions?.reports && <RecentActivity records={dashboard.recentActivity} />}
        </>
      )}
    </section>
  );
}
