"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useVault } from "@/app/(user)/dashboard/lib/vaultContext";
import {
  VaultIcon,
  DashboardIcon,
  FilesIcon,
  FolderIcon,
  StarIcon,
  TrashIcon,
  HardDriveIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from "@/components/UI/Icons";
import SignOutButton from "@/components/Auth/SignOutButton";

export default function Sidebar({
  className = "",
  userEmail = "",
  onNavigate,
}) {
  const pathname = usePathname();
  const {
    documents,
    folders,
    starredDocuments,
    trash,
    storageMetrics,
    billing,
    hasPermission,
  } = useVault();

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: DashboardIcon,
      exact: true,
      permission: "VIEW_DASHBOARD",
    },
    {
      name: "My Files",
      href: "/dashboard/files",
      icon: FilesIcon,
      badge: documents.length.toString(),
      permission: "VIEW_DOCUMENTS",
    },
    {
      name: "Folders",
      href: "/dashboard/folders",
      icon: FolderIcon,
      badge: folders.length.toString(),
      permission: "VIEW_FOLDERS",
    },
    {
      name: "Starred",
      href: "/dashboard/starred",
      icon: StarIcon,
      badge:
        starredDocuments.length > 0 ? starredDocuments.length.toString() : null,
      badgeColor: "bg-amber-100 text-amber-700",
      permission: "VIEW_STARRED",
    },
    {
      name: "Trash",
      href: "/dashboard/trash",
      icon: TrashIcon,
      badge: trash.length > 0 ? trash.length.toString() : null,
      badgeColor: "bg-rose-100 text-rose-700",
      permission: "VIEW_TRASH",
    },
    {
      name: "Subscription",
      href: "/dashboard/subscription",
      icon: SparklesIcon,
      permission: "VIEW_SUBSCRIPTION",
    },
  ];
  const visibleNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  const isActive = (item) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <aside
      className={`hidden lg:flex fixed inset-y-0 left-0 z-40 h-screen max-h-screen w-72 overflow-y-auto bg-white border-r border-slate-200/80 flex-col justify-between p-5 select-none shrink-0 transition-all ${className}`}
    >
      {/* Top Header & Navigation */}
      <div>
        {/* Brand Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-2 py-1 mb-8 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform duration-200">
            <VaultIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                DocVault
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 uppercase">
                {billing.planName || "Free"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium -mt-0.5">
              Secure Document Cloud
            </p>
          </div>
        </Link>

        {/* Section Label */}
        <div className="px-3 mb-2">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Workspace
          </span>
        </div>

        {/* Navigation List */}
        <nav className="space-y-1.5">
          {visibleNavItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                  active
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/30"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      active
                        ? "text-white"
                        : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      active
                        ? "bg-white/20 text-white"
                        : item.badgeColor || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Security Feature Pill */}
        <div className="mt-8 mx-1 p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheckIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800">
              AES-256 Vault Guard
            </p>
            <p className="text-[11px] text-slate-400">End-to-end encrypted</p>
          </div>
        </div>
      </div>

      {/* Bottom Storage & User Profile */}
      <div className="pt-6 border-t border-slate-100 space-y-4">
        {/* Storage Card connected to real metrics */}
        {hasPermission("VIEW_STORAGE_USAGE") && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100/80">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
              <span className="flex items-center gap-1.5">
                <HardDriveIcon className="w-4 h-4 text-blue-600" />
                Storage Used
              </span>
              <span className="text-blue-700 font-bold">
                {storageMetrics.percentage}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
                style={{ width: `${storageMetrics.percentage}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-500 mb-3">
              <span className="font-semibold text-slate-700">
                {storageMetrics.formattedUsed}
              </span>{" "}
              of {storageMetrics.quotaLabel} used
            </p>

            {hasPermission("VIEW_SUBSCRIPTION") && (
              <Link
                href="/dashboard/subscription"
                onClick={onNavigate}
                className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-blue-700 bg-white hover:bg-blue-600 hover:text-white border border-blue-200 hover:border-transparent transition-all duration-150 flex items-center justify-center gap-1.5 shadow-xs"
              >
                <SparklesIcon className="w-3.5 h-3.5" />
                {billing.plan === "free" ? "View plans" : "Manage subscription"}
              </Link>
            )}
          </div>
        )}

        {/* User Card */}
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                {(userEmail[0] || "U").toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                {userEmail.split("@")[0] || "Account"}
              </p>
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
