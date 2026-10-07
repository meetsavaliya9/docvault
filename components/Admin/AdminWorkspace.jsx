"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminSignOutButton from "@/components/Admin/AdminSignOutButton";

const navigation = [
  { label: "Dashboard", href: "/admin", icon: "dashboard" },
  { label: "Users", href: "/admin/users", icon: "users" },
  { label: "Documents", href: "/admin/documents", icon: "documents" },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: "subscriptions" },
  { label: "Pricing", href: "/admin/pricing", icon: "pricing" },
  { label: "Payments", href: "/admin/payments", icon: "payments" },
  { label: "Settings", href: "/admin/settings", icon: "settings" },
];

const titles = Object.fromEntries(navigation.map(({ href, label }) => [href, label]));

export function AdminIcon({ name, className = "h-5 w-5" }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const drawings = {
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    documents: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    subscriptions: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    pricing: <><path d="M20.5 13.5 13 21l-10-10V3h8z" /><circle cx="7.5" cy="7.5" r="1" /><path d="m14 7 3 3m-3 0 3-3" /></>,
    payments: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /><path d="M17 15h.01" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1A1.7 1.7 0 0 0 4.2 12H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    chevron: <><path d="m7 10 5 5 5-5" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    sparkles: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1 2.5 2.5 1-2.5 1L19 21l-1-2.5-2.5-1 2.5-1 1-2.5ZM5 3l.7 1.8L7.5 5.5l-1.8.7L5 8l-.7-1.8-1.8-.7 1.8-.7L5 3Z" /></>,
  };

  return <svg {...common}>{drawings[name] || drawings.dashboard}</svg>;
}

function Brand({ compact }) {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-600/20">
        D
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-base font-bold tracking-tight text-slate-900">DocVault</span>
          <span className="block text-[11px] font-medium text-slate-500">Admin workspace</span>
        </span>
      )}
    </Link>
  );
}

export default function AdminWorkspace({ admin, children }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [search, setSearch] = useState("");
  const title = titles[pathname] || "Admin workspace";
  const initials = (admin.name || admin.email || "A").slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!profileOpen) return undefined;

    const closeOnOutsidePointer = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setProfileOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileOpen]);

  const sidebar = (mobile = false) => (
    <div className="flex h-full flex-col bg-white">
      <div className={`flex h-[72px] shrink-0 items-center border-b border-slate-100 px-5 ${collapsed && !mobile ? "justify-center" : "justify-between"}`}>
        <Brand compact={collapsed && !mobile} />
        {mobile && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <AdminIcon name="close" />
          </button>
        )}
      </div>
      <div className="px-3 pt-6">
        {!(collapsed && !mobile) && (
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
        )}
        <nav aria-label="Admin navigation" className="space-y-1">
          {navigation.map((item) => {
            const active = item.href === "/admin"
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed && !mobile ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                className={`group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                } ${collapsed && !mobile ? "justify-center px-2" : ""}`}
              >
                <AdminIcon name={item.icon} className={`h-[18px] w-[18px] shrink-0 ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                {!(collapsed && !mobile) && <span>{item.label}</span>}
                {active && !(collapsed && !mobile) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className={`mt-auto border-t border-slate-100 p-3 ${collapsed && !mobile ? "items-center" : ""}`}>
        <div className={`flex items-center gap-3 rounded-lg p-2 ${collapsed && !mobile ? "justify-center" : ""}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
            {initials}
          </span>
          {!(collapsed && !mobile) && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-800">{admin.name || "Administrator"}</span>
              <span className="block truncate text-[11px] text-slate-500">{admin.email}</span>
            </span>
          )}
        </div>
        {!(collapsed && !mobile) && (
          <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-500">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Administrator</span>
            <AdminSignOutButton />
          </div>
        )}
        {collapsed && !mobile && (
          <div className="mt-2 flex justify-center" title="Sign out">
            <AdminSignOutButton />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-white transition-[width] duration-200 lg:block ${collapsed ? "w-[76px]" : "w-[252px]"}`}>
        {sidebar()}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]"
          />
          <aside className="relative h-full w-[min(84vw,288px)] border-r border-slate-200 shadow-2xl">
            {sidebar(true)}
          </aside>
        </div>
      )}

      <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "lg:pl-[76px]" : "lg:pl-[252px]"}`}>
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => {
              if (window.matchMedia("(min-width: 1024px)").matches) setCollapsed((value) => !value);
              else setMobileOpen(true);
            }}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <AdminIcon name="menu" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
            <p className="hidden text-xs text-slate-500 sm:block">DocVault administration</p>
          </div>
          <form action="/admin/users" className="hidden w-full max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 sm:flex">
            <AdminIcon name="search" className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              name="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users..."
              aria-label="Search users"
              className="h-9 min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
            />
          </form>
          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              onClick={() => {
                setNotificationsOpen((value) => !value);
                setProfileOpen(false);
              }}
              className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <AdminIcon name="bell" className="h-[18px] w-[18px]" />
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                <p className="text-sm font-semibold text-slate-900">Notifications</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">You’re all caught up. System alerts will appear here.</p>
              </div>
            )}
          </div>
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              aria-label="Open administrator profile menu"
              aria-expanded={profileOpen}
              onClick={() => {
                setProfileOpen((value) => !value);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-slate-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{initials}</span>
              <AdminIcon name="chevron" className="hidden h-4 w-4 text-slate-400 sm:block" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="truncate text-xs font-semibold text-slate-800">{admin.name || "Administrator"}</p>
                  <p className="truncate text-[11px] text-slate-500">{admin.email}</p>
                </div>
                <Link href="/admin/settings" onClick={() => setProfileOpen(false)} className="mt-1 block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Profile & settings</Link>
                <div className="px-3 py-2"><AdminSignOutButton /></div>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
