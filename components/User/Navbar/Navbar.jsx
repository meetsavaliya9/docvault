"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useVault } from "@/app/(user)/dashboard/lib/vaultContext";
import {
  SearchIcon,
  BellIcon,
  PlusIcon,
  CheckIcon,
  ClockIcon,
  ChevronRightIcon,
  MenuIcon,
} from "@/components/UI/Icons";
import SignOutButton from "@/components/Auth/SignOutButton";

export default function Navbar({
  userEmail = "",
  onMenuClick,
  isMenuOpen = false,
}) {
  const pathname = usePathname();
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    setIsCommandPaletteOpen,
    showToast,
    hasPermission,
  } = useVault();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

  const profileMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  // Outside-click and escape handling for profile menu
  useEffect(() => {
    if (!showProfileMenu) return;

    function handleClickOutside(event) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setShowProfileMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showProfileMenu]);

  // Outside-click and escape handling for notifications menu
  useEffect(() => {
    if (!showNotifications) return;

    function handleClickOutside(event) {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setShowNotifications(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showNotifications]);

  // Derive title from pathname
  const getPageTitle = () => {
    if (pathname.includes("/files")) return "My Files";
    if (pathname.includes("/folders")) return "Folders";
    if (pathname.includes("/starred")) return "Starred Documents";
    if (pathname.includes("/trash")) return "Trash Bin";
    return "Dashboard Overview";
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 min-w-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/85 px-3 backdrop-blur-md transition-all sm:gap-4 sm:px-6">
      {/* Left: Breadcrumbs & Page Title */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">
          Workspace
        </span>
        <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
        <h1 className="truncate text-sm font-bold tracking-tight text-slate-900 sm:text-lg">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right: Actions, Search, Notifications, Profile */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        {/* Quick Search triggering Command Palette */}
        {hasPermission("SEARCH_DOCUMENTS") && (
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="relative hidden md:flex items-center gap-2 pl-3 pr-4 py-1.5 text-xs rounded-xl bg-slate-100/80 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200/60 transition-all cursor-pointer shadow-xs w-56 lg:w-72"
          >
            <SearchIcon className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="flex-1 text-left truncate">
              Search files, folders...
            </span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-slate-500 bg-white rounded border border-slate-200">
              Ctrl+K
            </kbd>
          </button>
        )}

        {/* Mobile Search Button */}
        {hasPermission("SEARCH_DOCUMENTS") && (
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors md:hidden cursor-pointer"
            aria-label="Quick search"
          >
            <SearchIcon className="w-5 h-5" />
          </button>
        )}

        {/* Quick Upload CTA */}
        {hasPermission("UPLOAD_DOCUMENT") && (
          <Link
            href="/dashboard/files"
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-xs shadow-blue-500/20 transition-all cursor-pointer active:scale-95"
            title="Upload Document"
          >
            <PlusIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </Link>
        )}

        {/* Notifications Popover */}
        {hasPermission("VIEW_NOTIFICATIONS") && (
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Notifications"
              aria-expanded={showNotifications}
            >
              <BellIcon className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900">
                      Notifications
                    </h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {hasPermission("MARK_NOTIFICATION_READ") && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      disabled={unreadCount === 0}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 my-2 max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-2 py-8 text-center text-xs text-slate-500">
                      You’re all caught up. Activity will appear here.
                    </p>
                  ) : (
                    notifications.map((notification) => {
                      const Icon =
                        notification.type === "warning"
                          ? ClockIcon
                          : notification.type === "info"
                            ? BellIcon
                            : CheckIcon;
                      const iconColor =
                        notification.type === "warning"
                          ? "text-amber-600 bg-amber-50"
                          : notification.type === "info"
                            ? "text-blue-600 bg-blue-50"
                            : "text-emerald-600 bg-emerald-50";
                      return (
                        <button
                          type="button"
                          key={notification.id}
                          onClick={() => markNotificationRead(notification.id)}
                          disabled={!hasPermission("MARK_NOTIFICATION_READ")}
                          className={`w-full text-left py-3 flex items-start gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors ${
                            notification.read ? "" : "bg-blue-50/40"
                          }`}
                          aria-label={`Mark notification as read: ${notification.message}`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-900">
                              {notification.type === "warning"
                                ? "Needs attention"
                                : "Vault activity"}
                            </p>
                            <p className="text-[11px] text-slate-500 break-words mt-0.5">
                              {notification.message}
                            </p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {notification.time}
                            </span>
                          </div>
                          {!notification.read && (
                            <span
                              aria-label="Unread"
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600"
                            />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    {hasPermission("VIEW_DASHBOARD") && (
                      <Link
                        href="/dashboard"
                        onClick={() => setShowNotifications(false)}
                        className="text-xs font-semibold text-slate-600 hover:text-blue-600 py-1"
                      >
                        View dashboard
                      </Link>
                    )}
                    {hasPermission("MANAGE_NOTIFICATIONS") && (
                      <button
                        type="button"
                        onClick={clearNotifications}
                        className="text-xs font-medium text-slate-500 hover:text-rose-600 py-1"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* User Profile */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-expanded={showProfileMenu}
            aria-haspopup="menu"
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {(userEmail[0] || "U").toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <span className="font-semibold text-xs text-slate-700 hidden lg:inline max-w-28 truncate">
              {userEmail.split("@")[0] || "Account"}
            </span>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {userEmail.split("@")[0] || "Account"}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {userEmail}
                </p>
              </div>

              <div className="py-1 text-xs text-slate-700">
                <Link
                  href="/dashboard"
                  onClick={() => setShowProfileMenu(false)}
                  className="block px-4 py-2 hover:bg-slate-50 hover:text-blue-600"
                >
                  Dashboard Home
                </Link>
                <Link
                  href="/dashboard/files"
                  onClick={() => setShowProfileMenu(false)}
                  className="block px-4 py-2 hover:bg-slate-50 hover:text-blue-600"
                >
                  My Files
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    showToast(
                      "DocVault Security: 2-Factor Authentication enabled. Vault key safe.",
                      "info",
                    );
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 hover:text-blue-600 cursor-pointer"
                >
                  Security & Keys
                </button>
              </div>

              <div className="border-t border-slate-100 px-4 py-2">
                <SignOutButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
