import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedAdmin } from "@/lib/auth/admin";
import AdminSignOutButton from "@/components/Admin/AdminSignOutButton";
import {
  VaultIcon,
  ShieldCheckIcon,
} from "@/components/UI/Icons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Panel — DocVault",
  description: "Enterprise administration, user directory, and platform storage telemetry.",
};

export default async function AdminLayout({ children }) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/60 text-slate-900 selection:bg-blue-600 selection:text-white lg:flex-row">
      {/* Sidebar for Desktop */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-200/80 bg-white p-5 select-none lg:flex">
        {/* Brand */}
        <Link href="/admin" className="flex items-center gap-3 mb-8 group">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
            <VaultIcon className="h-6 w-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                DocVault
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium -mt-0.5">
              Control & Governance
            </p>
          </div>
        </Link>

        {/* Section title */}
        <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          Management
        </p>

        {/* Navigation */}
        <nav className="space-y-1.5">
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/30 font-medium text-sm transition-colors"
          >
            <ShieldCheckIcon className="w-4 h-4 text-indigo-400" />
            Admin Overview & Directory
          </Link>
          <Link
            href="/admin/pricing"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors"
          >
            Pricing Management
          </Link>
        </nav>

        {/* Admin Security Banner */}
        <div className="mt-8 mx-1 p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center gap-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-800">Protected Session</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Authenticated via isolated admin token with allowlist validation.
          </p>
        </div>

        {/* Bottom Profile & Sign Out */}
        <div className="mt-auto pt-6 border-t border-slate-100 space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold flex items-center justify-center text-sm shadow-xs">
              {(admin.email[0] || "A").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {admin.name || "Administrator"}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{admin.email}</p>
            </div>
          </div>

          <div className="flex items-center justify-between px-1 pt-1 text-xs">
            <span className="text-[11px] text-slate-500">Session active</span>
            <AdminSignOutButton />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/85 px-3 backdrop-blur-md sm:gap-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="lg:hidden flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white">
                <VaultIcon className="h-5 w-5" />
              </span>
              <span className="font-extrabold text-slate-900 text-base">DocVault</span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                Admin
              </span>
            </div>
            <div className="hidden lg:block">
              <h1 className="text-sm font-bold tracking-tight text-slate-900 sm:text-lg">
                Administrator Control Center
              </h1>
              <p className="text-xs text-slate-500">
                Live oversight, account governance, and system-wide storage telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/admin/pricing"
              className="rounded-lg px-2.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 sm:text-sm"
            >
              Pricing
            </Link>
            <span className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
              {admin.email}
            </span>
            <div className="lg:hidden">
              <AdminSignOutButton />
            </div>
          </div>
        </header>

        {/* Content body */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
