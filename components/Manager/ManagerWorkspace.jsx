"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DashboardIcon,
  FilesIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "@/components/UI/Icons";
import SignOutButton from "@/components/Auth/SignOutButton";

const navigation = [
  { label: "Dashboard", href: "/manager", permission: "VIEW_DASHBOARD", Icon: DashboardIcon },
  { label: "Users", href: "/manager/users", permission: "VIEW_USERS", Icon: UsersIcon },
  { label: "Files", href: "/manager/files", permission: "VIEW_USER_FILES", Icon: FilesIcon },
  { label: "Payments", href: "/manager/payments", permission: "VIEW_PAYMENTS", Icon: FilesIcon },
  { label: "Subscriptions", href: "/manager/subscriptions", permission: "VIEW_SUBSCRIPTIONS", Icon: ShieldCheckIcon },
  { label: "Reports", href: "/manager/reports", permission: "VIEW_REPORTS", Icon: ShieldCheckIcon },
  { label: "Profile", href: "/manager/profile", Icon: UsersIcon },
];

export default function ManagerWorkspace({ manager, permissions, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastRefreshAt = useRef(0);
  const name = manager.name || manager.email || "Manager";
  const initials = name.slice(0, 1).toUpperCase();
  const visibleNavigation = navigation.filter(
    (item) => !item.permission || permissions[item.permission] === true,
  );

  useEffect(() => {
    function refreshPermissions() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshAt.current < 1500) return;
      lastRefreshAt.current = now;
      router.refresh();
    }

    window.addEventListener("focus", refreshPermissions);
    document.addEventListener("visibilitychange", refreshPermissions);
    return () => {
      window.removeEventListener("focus", refreshPermissions);
      document.removeEventListener("visibilitychange", refreshPermissions);
    };
  }, [router]);

  function renderNavigation(mobile = false) {
    return (
      <nav aria-label="Manager navigation" className="space-y-1">
        {visibleNavigation.map(({ label, href, Icon }) => {
          const active = href === "/manager"
            ? pathname === href
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={() => mobile && setMobileOpen(false)}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${
                active
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-white" : "text-slate-400"}`} />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  function renderSidebar(mobile = false) {
    return (
      <aside className="flex h-full flex-col border-r border-slate-200 bg-white">
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-100 px-5">
          <Link href="/manager" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-600/20">
              D
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold tracking-tight text-slate-900">
                DocVault
              </span>
              <span className="block text-[11px] font-medium text-slate-500">
                Manager workspace
              </span>
            </span>
          </Link>
          {mobile && (
            <button
              type="button"
              aria-label="Close manager navigation"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              ×
            </button>
          )}
        </div>
        <div className="px-3 pt-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </p>
          {renderNavigation(mobile)}
        </div>
        <div className="mt-auto border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-800">
                {name}
              </span>
              <span className="block truncate text-[11px] text-slate-500">
                {manager.email}
              </span>
            </span>
          </div>
          <div className="mt-2 rounded-lg px-3 py-2 text-xs text-slate-500">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              Manager
            </span>
            <SignOutButton />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        {renderSidebar()}
      </div>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-label="Open manager navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <span className="block space-y-1" aria-hidden="true">
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
            </span>
          </button>
          <span className="text-sm font-semibold text-slate-700">
            Manager Panel
          </span>
          <span className="ml-auto hidden truncate text-xs text-slate-500 sm:block">
            {manager.email}
          </span>
        </header>
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close manager navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-slate-950/40"
          />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] shadow-2xl">
            {renderSidebar(true)}
          </div>
        </div>
      )}
    </div>
  );
}
