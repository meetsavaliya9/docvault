import { getAuthenticatedUser } from "@/app/lib/auth/session";
import PermissionDenied from "@/components/User/UI/PermissionDenied";
import { getManagerOverallReport } from "@/lib/managerData";
import { getUserPermissions, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let size = value / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(1)} ${units[index]}`;
}

function formatMoney(amount, currency) {
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

function formatMonth(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}-01T00:00:00Z`));
}

function Metric({ label, value, detail }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      {detail && <p className="mt-2 text-xs text-slate-500">{detail}</p>}
    </article>
  );
}

function BarList({ title, rows, labelKey, valueKey = "count", formatValue = formatCount }) {
  if (!rows?.length) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm text-slate-500">No matching records.</p>
      </section>
    );
  }
  const max = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <ul className="mt-4 space-y-4">
        {rows.map((row, index) => {
          const amount = Number(row[valueKey]) || 0;
          return (
            <li key={`${row[labelKey]}-${index}`}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-slate-600">{row[labelKey]}</span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                  {formatValue(amount, row)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${Math.max(amount > 0 ? 3 : 0, (amount / max) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RevenueSummary({ rows }) {
  if (!rows?.length) {
    return <p className="text-sm text-slate-500">No verified successful payments are recorded.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-4">Currency</th>
            <th className="py-2 pr-4">Verified payments</th>
            <th className="py-2 pr-4">Gross paid</th>
            <th className="py-2 pr-4">Refunds</th>
            <th className="py-2">Net after refunds</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.currency}>
              <td className="py-3 pr-4 font-medium text-slate-800">{row.currency}</td>
              <td className="py-3 pr-4 tabular-nums text-slate-600">{formatCount(row.count)}</td>
              <td className="py-3 pr-4 tabular-nums text-slate-600">{formatMoney(row.gross, row.currency)}</td>
              <td className="py-3 pr-4 tabular-nums text-slate-600">{formatMoney(row.refunded, row.currency)}</td>
              <td className="py-3 tabular-nums font-semibold text-slate-800">{formatMoney(row.net, row.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentTrend({ rows }) {
  const currencies = [...new Set(rows.map((row) => row.currency))];
  if (!rows?.length) {
    return <p className="text-sm text-slate-500">No verified payments in the reporting period.</p>;
  }
  return (
    <div className="space-y-5">
      {currencies.map((currency) => (
        <BarList
          key={currency}
          title={`${currency} payments`}
          rows={rows
            .filter((row) => row.currency === currency)
            .map((row) => ({ ...row, period: formatMonth(row.month) }))}
          labelKey="period"
          valueKey="gross"
          formatValue={(value, row) =>
            `${formatMoney(value, currency)} gross · ${formatCount(row.verifiedCount)} verified of ${formatCount(row.count)} records`
          }
        />
      ))}
    </div>
  );
}

export default async function ManagerReportsPage() {
  const user = await getAuthenticatedUser();
  if (!(await hasPermission(user, "VIEW_REPORTS"))) {
    return (
      <section className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PermissionDenied permission="VIEW_REPORTS" />
      </section>
    );
  }

  const permissions = await getUserPermissions(user);
  const report = await getManagerOverallReport(permissions);
  const cards = [
    report.users && { label: "Registered users", value: formatCount(report.users.totalUsers) },
    report.users && { label: "Active users", value: formatCount(report.users.activeUsers) },
    report.files && { label: "Stored files", value: formatCount(report.files.totalFiles) },
    report.files && { label: "Storage used", value: formatBytes(report.files.totalBytes) },
    report.subscriptions && {
      label: "Active subscriptions",
      value: formatCount(report.subscriptions.activeSubscriptions),
    },
    report.payments && {
      label: "Successful payments",
      value: formatCount(
        report.payments.byCurrency.reduce((sum, row) => sum + row.count, 0),
      ),
      detail: "Server-verified successful or fully refunded payment records",
    },
  ].filter(Boolean);
  const hasReportData = Boolean(report.users || report.files || report.subscriptions || report.payments);

  return (
    <section className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
          Manager workspace
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Overall Reports
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          Live summaries from DocVault records. Each section is shown only when its
          corresponding user, file, subscription, or payment permission is enabled.
          Trends cover the current month and the previous eleven months where records exist.
        </p>
      </header>

      {!hasReportData ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Report access is enabled, but no underlying data permissions are enabled for your account.
        </p>
      ) : (
        <>
          {cards.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <Metric key={card.label} {...card} />
              ))}
            </div>
          )}

          {report.users && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">User reports</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                <BarList
                  title="New registrations by month"
                  rows={report.users.registrations.map((row) => ({
                    ...row,
                    period: formatMonth(row.month),
                  }))}
                  labelKey="period"
                />
                {report.users.usersByPlan && (
                  <BarList
                    title="Users by current plan"
                    rows={report.users.usersByPlan}
                    labelKey="plan"
                  />
                )}
              </div>
            </section>
          )}

          {report.files && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">File reports</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                <BarList title="Files by type" rows={report.files.byType} labelKey="type" />
                <BarList
                  title="Uploads by month"
                  rows={report.files.uploads.map((row) => ({
                    ...row,
                    period: formatMonth(row.month),
                  }))}
                  labelKey="period"
                />
              </div>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">Top users by stored file size</h3>
                {report.files.largestOwners.length ? (
                  <ul className="mt-4 divide-y divide-slate-100">
                    {report.files.largestOwners.map(({ user: owner, count, bytes }) => (
                      <li key={owner.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-800">{owner.name || owner.email}</span>
                          <span className="block truncate text-xs text-slate-500">{owner.email}</span>
                        </span>
                        <span className="shrink-0 text-right text-slate-600">
                          {formatBytes(bytes)} · {formatCount(count)} files
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No stored files.</p>
                )}
              </section>
            </section>
          )}

          {report.subscriptions && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Subscription reports</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                <BarList
                  title="Active subscriptions by plan"
                  rows={report.subscriptions.activeByPlan}
                  labelKey="plan"
                />
                <BarList
                  title="Subscription records by status"
                  rows={report.subscriptions.byStatus}
                  labelKey="status"
                />
              </div>
            </section>
          )}

          {report.payments && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Payment reports</h2>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">Verified revenue</h3>
                <p className="mb-3 mt-1 text-xs text-slate-500">
                  Gross is the amount DocVault recorded as paid; net subtracts recorded refunds.
                  Amounts are kept separate by currency.
                </p>
                <RevenueSummary rows={report.payments.byCurrency} />
              </section>
              <div className="grid gap-4 lg:grid-cols-2">
                <BarList
                  title="Payment records by status"
                  rows={report.payments.byStatus}
                  labelKey="status"
                />
                <BarList
                  title="Verified revenue by plan"
                  rows={report.payments.byPlan}
                  labelKey="plan"
                  valueKey="gross"
                  formatValue={(value, row) => formatMoney(value, row.currency)}
                />
              </div>
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">Verified payments over time</h3>
                <p className="text-xs text-slate-500">Monthly gross verified amounts and payment counts, grouped by currency.</p>
                <PaymentTrend rows={report.payments.trend} />
              </section>
            </section>
          )}
        </>
      )}
    </section>
  );
}
