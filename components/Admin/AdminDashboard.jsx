"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminIcon } from "@/components/Admin/AdminWorkspace";

function formatAmount(minorUnits, currency) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format((minorUnits || 0) / 100);
  } catch {
    return `${currency || "INR"} ${((minorUnits || 0) / 100).toFixed(0)}`;
  }
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function MetricCard({ label, value, detail, icon, accent, href }) {
  const content = (
    <div className="flex h-full min-w-0 items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-3 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{value}</p>
        <p className="mt-2 truncate text-xs text-slate-500">{detail}</p>
      </div>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <AdminIcon name={icon} className="h-5 w-5" />
      </span>
    </div>
  );
  const className = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md";
  return href ? <Link href={href} className={className}>{content}</Link> : <article className={className}>{content}</article>;
}

function LineChart({ title, description, data, currency, period, color = "#2563eb", valueLabel }) {
  const values = data.map((item) => valueLabel(item));
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 250 : 12 + (index * 476) / (values.length - 1);
    const y = 164 - (value / max) * 140;
    return `${x},${y}`;
  });
  const hasData = values.some((value) => value > 0);
  const chartId = title.replace(/\W/g, "").toLowerCase();

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <span className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">
          {period === "weekly" ? "Last 7 days" : period === "monthly" ? "Last 30 days" : "Last 12 months"}
          {currency ? ` · ${currency}` : ""}
        </span>
      </div>
      {hasData ? (
        <div className="mt-5">
          <svg viewBox="0 0 500 180" role="img" aria-label={`${title} line chart`} className="h-48 w-full overflow-visible">
            <defs>
              <linearGradient id={`${chartId}-fill`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[24, 70, 116, 164].map((y) => (
              <line key={y} x1="8" x2="492" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 5" />
            ))}
            <polygon points={`12,164 ${points.join(" ")} 488,164`} fill={`url(#${chartId}-fill)`} />
            <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, index) => {
              const [cx, cy] = point.split(",");
              return <circle key={`${data[index]?.month}-${point}`} cx={cx} cy={cy} r="3.5" fill="white" stroke={color} strokeWidth="2" />;
            })}
          </svg>
          <div className="flex justify-between px-1 text-[10px] text-slate-400">
            {data.filter((_, index) => {
              const interval = data.length > 20 ? 5 : data.length > 10 ? 3 : 1;
              return index % interval === 0 || index === data.length - 1;
            }).map((item) => (
              <span key={item.month}>{item.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 flex h-52 items-center justify-center rounded-lg bg-slate-50 text-center text-sm text-slate-500">
          No activity recorded in this period.
        </div>
      )}
    </section>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [chartPeriod, setChartPeriod] = useState("yearly");

  const loadDashboard = useCallback(async (signal) => {
    const response = await fetch(`/api/admin?chartPeriod=${chartPeriod}`, { cache: "no-store", signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load dashboard data.");
    setError("");
    setData(result);
  }, [chartPeriod]);

  useEffect(() => {
    const controller = new AbortController();
    loadDashboard(controller.signal)
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setError(loadError.message || "Could not load dashboard data.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadDashboard, reload]);

  const summary = data?.summary;
  const metrics = summary?.subscriptionMetrics || {};
  const mainRevenue = useMemo(() => {
    const revenues = summary?.revenueByCurrency || [];
    return revenues.find((item) => item.currency === "INR") || revenues[0] || { currency: "INR", amount: 0, paymentCount: 0 };
  }, [summary]);

  if (loading && !data) {
    return (
      <div className="space-y-6" aria-label="Loading dashboard">
        <div className="h-16 animate-pulse rounded-xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-xl bg-white shadow-sm" />)}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-xl bg-white shadow-sm" />
          <div className="h-72 animate-pulse rounded-xl bg-white shadow-sm" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5" role="alert">
        <p className="font-semibold text-rose-900">Dashboard data is unavailable</p>
        <p className="mt-1 text-sm text-rose-700">{error}</p>
        <button type="button" onClick={refreshDashboard} className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white">Try again</button>
      </div>
    );
  }

  const revenueForMainCurrency = (summary?.revenueByPeriod || []).map((period) => ({
    ...period,
    amount: period.amounts?.[mainRevenue.currency] || 0,
  }));
  const userGrowth = summary?.userGrowth || [];
  const distributionColors = ["bg-slate-400", "bg-blue-600", "bg-violet-600", "bg-emerald-600", "bg-amber-500"];
  const distributions = (metrics.planDistribution || [
    { name: "Free", subscribers: metrics.freeAccounts || 0 },
    { name: "Plus", subscribers: metrics.plusSubscribers || 0 },
    { name: "Pro", subscribers: metrics.proSubscribers || 0 },
  ]).map((plan, index) => ({
    label: plan.name,
    value: plan.subscribers,
    color: distributionColors[index % distributionColors.length],
  }));
  const distributionTotal = distributions.reduce((sum, item) => sum + item.value, 0);
  const refreshDashboard = () => {
    setLoading(true);
    setError("");
    setReload((value) => value + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Overview</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Good to see you</h1>
          <p className="mt-1 text-sm text-slate-500">Here’s what’s happening across your DocVault workspace.</p>
        </div>
        <button type="button" onClick={refreshDashboard} disabled={loading} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total users" value={(summary?.userCount || 0).toLocaleString()} detail="Registered accounts" icon="users" accent="bg-blue-50 text-blue-700" href="/admin/users" />
        <MetricCard label="Active subscriptions" value={(summary?.activeSubscriptions || 0).toLocaleString()} detail="Paid subscription plans" icon="subscriptions" accent="bg-violet-50 text-violet-700" href="/admin/subscriptions" />
        <MetricCard label="Total documents" value={(summary?.documentCount || 0).toLocaleString()} detail="Documents in the vault" icon="documents" accent="bg-amber-50 text-amber-700" href="/admin/documents" />
        <MetricCard
          label="Successful revenue"
          value={formatAmount(mainRevenue.amount, mainRevenue.currency)}
          detail={(summary?.revenueByCurrency || []).length > 1
            ? `${mainRevenue.paymentCount} ${mainRevenue.currency} payments · ${summary.revenueByCurrency.filter((item) => item.currency !== mainRevenue.currency).map((item) => formatAmount(item.amount, item.currency)).join(" · ")} other`
            : `${mainRevenue.paymentCount} successful ${mainRevenue.currency} payments`}
          icon="payments"
          accent="bg-emerald-50 text-emerald-700"
          href="/admin/payments"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Dashboard trends</h2>
          <p className="mt-1 text-xs text-slate-500">Choose the time range for revenue and user growth.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <span>Range</span>
          <select
            value={chartPeriod}
            onChange={(event) => setChartPeriod(event.target.value)}
            aria-label="Chart time range"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          >
            <option value="weekly">Weekly · 7 days</option>
            <option value="monthly">Monthly · 30 days</option>
            <option value="yearly">Yearly · 12 months</option>
          </select>
        </label>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <LineChart
          title="Revenue"
          description="Captured Razorpay payments over time"
          data={revenueForMainCurrency}
          currency={mainRevenue.currency}
          period={chartPeriod}
          color="#2563eb"
          valueLabel={(item) => item.amount}
        />
        <LineChart
          title="User growth"
          description="New account registrations"
          data={userGrowth}
          period={chartPeriod}
          color="#7c3aed"
          valueLabel={(item) => item.count}
        />
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_1.35fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Subscription distribution</h2>
            <p className="mt-1 text-xs text-slate-500">Current user plan mix</p>
          </div>
          <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-slate-100">
            {distributions.map((item) => (
              <span key={item.label} className={item.color} style={{ width: `${distributionTotal ? (item.value / distributionTotal) * 100 : 0}%` }} />
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {distributions.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />{item.label}</span>
                <span className="font-semibold tabular-nums text-slate-900">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
          {distributionTotal === 0 && <p className="mt-4 text-xs text-slate-500">No subscription records yet.</p>}
        </section>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recently joined</h2>
              <p className="mt-1 text-xs text-slate-500">Latest registered accounts</p>
            </div>
            <Link href="/admin/users" className="text-xs font-semibold text-blue-700 hover:text-blue-800">View all users</Link>
          </div>
          {data?.users?.length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {data.users.filter((user) => !user.isAdmin).slice(0, 4).map((user) => (
                <div key={user.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{(user.name || user.email || "U").slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{user.name || user.email.split("@")[0]}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">{formatDate(user.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-500">No users have joined yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
