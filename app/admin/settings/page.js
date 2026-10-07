import { getAuthenticatedAdmin } from "@/lib/auth/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings — DocVault Admin",
};

export default async function AdminSettingsPage() {
  const admin = await getAuthenticatedAdmin();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Workspace</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Administrator profile and access information.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-lg font-bold text-blue-700">
            {(admin?.name || admin?.email || "A").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">Administrator profile</h2>
            <p className="mt-1 text-sm text-slate-500">This account is authorized through DocVault’s server-side administrator allowlist.</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-slate-500">Name</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{admin?.name || "Administrator"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Email</dt>
            <dd className="mt-1 break-all text-sm font-semibold text-slate-800">{admin?.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Access level</dt>
            <dd className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="h-2 w-2 rounded-full bg-emerald-500" />Administrator</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Session</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">Protected, server-validated</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-blue-200 bg-blue-50/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Security and billing</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Admin access is checked on every page and API request. Pricing updates are stored in the existing plan records and used for new checkouts.
            </p>
          </div>
          <Link href="/admin/pricing" className="shrink-0 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-800">Manage pricing</Link>
        </div>
      </section>
    </div>
  );
}
