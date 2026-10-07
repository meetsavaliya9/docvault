"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  FilesIcon,
  HardDriveIcon,
  SearchIcon,
  TrashIcon,  
  ShieldCheckIcon,
  EyeIcon,
  SparklesIcon,
  RefreshCwIcon,
  DownloadIcon,
  TrendingUpIcon,
} from "@/components/UI/Icons";
import { FileBadge, FileIconBox } from "@/components/UI/FileBadge";

function formatBytes(bytes) {
  if (!bytes) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatCurrency(cents, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
}

async function readResponse(response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [pricingPlans, setPricingPlans] = useState([]);
  const [summary, setSummary] = useState({
    userCount: 0,
    documentCount: 0,
    storageBytes: 0,
    storageByType: { pdfBytes: 0, imgBytes: 0, docBytes: 0, otherBytes: 0 },
    subscriptionMetrics: {},
  });
  const [documents, setDocuments] = useState([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState("all");
  const [searchUser, setSearchUser] = useState("");
  const [searchFile, setSearchFile] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);

  // Deletion modals state
  const [pendingDeleteUser, setPendingDeleteUser] = useState(null);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [overviewResponse, plansResponse] = await Promise.all([
        fetch("/api/admin", { cache: "no-store" }),
        fetch("/api/admin/plans", { cache: "no-store" }),
      ]);
      const [data, pricingData] = await Promise.all([
        readResponse(overviewResponse),
        readResponse(plansResponse),
      ]);
      setUsers(data.users || []);
      setSummary(data.summary || {});
      setPricingPlans(pricingData.plans || []);
    } catch (err) {
      setError(err.message || "Failed to load admin data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams({ documentsOnly: "true" });
      if (selectedUserFilter !== "all") params.set("userId", selectedUserFilter);
      const res = await fetch(`/api/admin?${params.toString()}`, { cache: "no-store" });
      const data = await readResponse(res);
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err.message || "Failed to load documents.");
    }
  }, [selectedUserFilter]);

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    // Data updates only after the asynchronous request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData, refreshTrigger]);

  useEffect(() => {
    // Data updates only after the asynchronous request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeTab === "files") fetchDocuments();
  }, [activeTab, fetchDocuments, refreshTrigger]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        fetchData();
        if (activeTab === "files") fetchDocuments();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [activeTab, fetchData, fetchDocuments]);

  // Filtered users for Users tab
  const filteredUsers = useMemo(() => {
    const q = searchUser.trim().toLowerCase();
    return users.filter((u) => !u.isAdmin).filter(
      (u) =>
        !q ||
        u.email?.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q) ||
        u.id?.toLowerCase().includes(q)
    );
  }, [users, searchUser]);

  // Filtered documents for Files tab
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // User filter
      if (selectedUserFilter !== "all" && doc.userId !== selectedUserFilter) {
        return false;
      }
      // Type filter
      if (fileTypeFilter !== "all") {
        const t = (doc.type || "").toUpperCase();
        if (fileTypeFilter === "pdf" && t !== "PDF") return false;
        if (fileTypeFilter === "images" && !["PNG", "JPG", "JPEG", "WEBP", "GIF", "SVG"].includes(t)) return false;
        if (fileTypeFilter === "docs" && !["DOC", "DOCX", "TXT", "MD"].includes(t)) return false;
      }
      // Search query
      if (searchFile.trim()) {
        const q = searchFile.trim().toLowerCase();
        const matchesName = doc.name?.toLowerCase().includes(q);
        const matchesOwner = doc.user?.email?.toLowerCase().includes(q);
        const matchesFolder = doc.folder?.toLowerCase().includes(q);
        if (!matchesName && !matchesOwner && !matchesFolder) return false;
      }
      return true;
    });
  }, [documents, selectedUserFilter, fileTypeFilter, searchFile]);

  // Storage percentage calculations
  const storageDist = useMemo(() => {
    const total = Math.max(summary.storageBytes || 1, 1);
    const s = summary.storageByType || { pdfBytes: 0, imgBytes: 0, docBytes: 0, otherBytes: 0 };
    return {
      pdfPct: Math.round(((s.pdfBytes || 0) / total) * 100),
      imgPct: Math.round(((s.imgBytes || 0) / total) * 100),
      docPct: Math.round(((s.docBytes || 0) / total) * 100),
      otherPct: Math.max(
        100 -
          (Math.round(((s.pdfBytes || 0) / total) * 100) +
            Math.round(((s.imgBytes || 0) / total) * 100) +
            Math.round(((s.docBytes || 0) / total) * 100)),
        0
      ),
    };
  }, [summary]);

  // Handle User Deletion
  const handleDeleteUser = async () => {
    if (!pendingDeleteUser) return;
    setIsDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(pendingDeleteUser.id)}`, {
        method: "DELETE",
      });
      const data = await readResponse(res);
      setNotice(data.message || "User account removed.");
      setPendingDeleteUser(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setError(err.message || "Failed to delete user account.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleUserBlock = async (user) => {
    setUpdatingUserId(user.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: !user.isBlocked }),
      });
      const data = await readResponse(res);
      setNotice(data.message || (data.isBlocked ? "User account blocked." : "User account unblocked."));
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === user.id
            ? { ...currentUser, isBlocked: data.isBlocked }
            : currentUser
        )
      );
    } catch (err) {
      setError(err.message || "Failed to update user access.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Handle Document Deletion
  const handleDeleteDoc = async () => {
    if (!pendingDeleteDoc) return;
    setIsDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/documents/${encodeURIComponent(pendingDeleteDoc.id)}`, {
        method: "DELETE",
      });
      const data = await readResponse(res);
      setNotice(data.message || "Document permanently purged.");
      setPendingDeleteDoc(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setError(err.message || "Failed to delete document.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="admin-theme space-y-6 text-slate-900">
      {/* Toast Notice */}
      {notice && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-400">✓</span>
            <span>{notice}</span>
          </div>
          <button
            onClick={() => setNotice("")}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-rose-400">⚠</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError("")}
            className="text-rose-400 hover:text-rose-200 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Registered Accounts
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldCheckIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-extrabold text-slate-900">
              {summary.userCount || 0}
            </h3>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-0.5">
              <TrendingUpIcon className="w-3 h-3" /> Live
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Across DocVault platform
          </p>
        </div>

        {/* Total Documents */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Documents
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FilesIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-extrabold text-slate-900">
              {summary.documentCount || 0}
            </h3>
            <span className="text-xs text-slate-400">files indexed</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            AES-256 encrypted records
          </p>
        </div>

        {/* Global Storage */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Global Disk Space
            </span>
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <HardDriveIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-extrabold text-slate-900">
              {formatBytes(summary.storageBytes || 0)}
            </h3>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Active payload consumption
          </p>
        </div>

        {/* System Health */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              System Health
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <SparklesIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-2xl font-extrabold text-emerald-400">
              100% Operational
            </h3>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            MySQL • Cloudinary CDN • Next.js
          </p>
        </div>
      </div>

      {/* Subscription Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Plus & Pro Subscribers",
            value: summary.subscriptionMetrics?.planSubscribers || 0,
            detail: `${summary.subscriptionMetrics?.plusSubscribers || 0} Plus · ${summary.subscriptionMetrics?.proSubscribers || 0} Pro · ${summary.subscriptionMetrics?.paidSubscribers || 0} paid`,
            color: "text-indigo-400",
          },
          {
            label: "Demo Subscriptions",
            value: summary.subscriptionMetrics?.demoSubscriptions || 0,
            detail: "Active demo plans; no payment collected",
            color: "text-amber-400",
          },
          {
            label: "Estimated Monthly Plan Value",
            value: formatCurrency(
              summary.subscriptionMetrics?.estimatedMonthlyPlanValueCents,
              summary.subscriptionMetrics?.currency
            ),
            detail: `Paid revenue estimate: ${formatCurrency(
              summary.subscriptionMetrics?.estimatedMonthlyRevenueCents,
              summary.subscriptionMetrics?.currency
            )}. Demo/admin plans are not payments.`,
            color: "text-emerald-400",
          },
        ].map((metric) => (
          <div key={metric.label} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{metric.label}</p>
            <p className={`mt-2 text-2xl font-extrabold ${metric.color}`}>{metric.value}</p>
            <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
          </div>
        ))}
      </div>

      {/* Storage Breakdown Multi-bar */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Platform Storage Distribution
            </h4>
            <p className="text-xs text-slate-400">
              Real-time cross-account disk consumption breakdown
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-indigo-400">
            Total: {formatBytes(summary.storageBytes || 0)}
          </span>
        </div>

        <div className="w-full h-3 rounded-full bg-slate-800 flex overflow-hidden gap-0.5">
          <div
            className="bg-rose-500 h-full transition-all duration-500"
            style={{ width: `${Math.max(storageDist.pdfPct, summary.storageBytes ? 3 : 0)}%` }}
            title={`PDF: ${storageDist.pdfPct}%`}
          />
          <div
            className="bg-purple-500 h-full transition-all duration-500"
            style={{ width: `${Math.max(storageDist.imgPct, summary.storageBytes ? 3 : 0)}%` }}
            title={`Images: ${storageDist.imgPct}%`}
          />
          <div
            className="bg-blue-500 h-full transition-all duration-500"
            style={{ width: `${Math.max(storageDist.docPct, summary.storageBytes ? 3 : 0)}%` }}
            title={`Docs: ${storageDist.docPct}%`}
          />
          <div
            className="bg-emerald-500 h-full transition-all duration-500"
            style={{ width: `${Math.max(storageDist.otherPct, summary.storageBytes ? 3 : 0)}%` }}
            title={`Other: ${storageDist.otherPct}%`}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shrink-0" />
            <span>PDF: <b className="text-slate-200">{formatBytes(summary.storageByType?.pdfBytes || 0)}</b></span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 shrink-0" />
            <span>Images: <b className="text-slate-200">{formatBytes(summary.storageByType?.imgBytes || 0)}</b></span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 shrink-0" />
            <span>Docs: <b className="text-slate-200">{formatBytes(summary.storageByType?.docBytes || 0)}</b></span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
            <span>Sheets/Other: <b className="text-slate-200">{formatBytes(summary.storageByType?.otherBytes || 0)}</b></span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher & Refresh Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === "overview"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-900"
            }`}
          >
            Overview & Users ({users.filter((user) => !user.isAdmin).length})
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === "files"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-900"
            }`}
          >
            Global Files & Governance ({documents.length})
          </button>
          <button
            onClick={() => setActiveTab("pricing")}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === "pricing"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-900"
            }`}
          >
            Subscription Pricing
          </button>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCwIcon className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
          {isLoading ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {/* TAB 1: USERS DIRECTORY */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Registered User Directory
              </h3>
              <p className="text-xs text-slate-400">
                Manage accounts, inspect per-user storage consumption, and enforce policy
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <SearchIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search user by email or name..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-5">User</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4">Files</th>
                  <th className="py-3 px-4">Storage Used</th>
                  <th className="py-3 px-4">Subscription Plan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No user accounts found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold flex items-center justify-center text-xs">
                            {(u.email[0] || "U").toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {u.name || u.email.split("@")[0]}
                            </p>
                            <p className="text-[11px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20">
                          {u.documentCount} docs
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-200">
                        {formatBytes(u.storageBytes)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-200">
                              {u.subscription?.planName || "Free"}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {u.subscription?.quotaLabel || "100 MB"}
                            </span>
                          </div>
                          {u.subscription?.provider && (
                            <span className="text-[10px] text-slate-500">
                              {u.subscription.provider === "razorpay"
                                ? "Razorpay"
                                : u.subscription.provider === "internal"
                                  ? "Included plan"
                                : u.subscription.provider === "stripe"
                                  ? "Stripe (legacy)"
                                : u.subscription.provider === "demo"
                                  ? "Demo · no payment"
                                  : "Admin assigned"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            u.isBlocked
                              ? "bg-rose-50 text-rose-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {u.isBlocked ? "Blocked" : "Active"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedUserFilter(u.id);
                              setActiveTab("files");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                          >
                            Inspect Files
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleUserBlock(u)}
                            disabled={updatingUserId === u.id}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                              u.isBlocked
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                            }`}
                          >
                            {updatingUserId === u.id
                              ? "Updating..."
                              : u.isBlocked
                                ? "Unblock"
                                : "Block"}
                          </button>
                          <button
                            onClick={() => setPendingDeleteUser(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete User Account"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "pricing" && (
        <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Subscription pricing</h3>
              <p className="mt-1 text-xs text-slate-400">
                Update prices and plan settings in the pricing manager.
              </p>
            </div>
            <Link
              href="/admin/pricing"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              Set prices and manage plans
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <article key={plan.key} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-base font-bold text-slate-900">{plan.name}</h4>
                {plan.key === "free" ? (
                  <>
                    <p className="mt-2 text-2xl font-extrabold text-slate-900">
                      {formatCurrency(plan.amount, plan.currency)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Included plan · {plan.billingPeriod}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-2xl font-extrabold text-slate-900">
                      {formatCurrency(plan.amount, plan.currency)}/{plan.billingPeriod}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {plan.checkoutAvailable ? "Razorpay checkout available" : "Checkout not configured"}
                    </p>
                  </>
                )}
                <Link
                  href="/admin/pricing"
                  className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  Edit {plan.name} plan
                </Link>
              </article>
            ))}
          </div>
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            Changes are saved to MySQL and apply to new purchases. Existing paid subscriptions keep their original payment amount.
          </p>
        </section>
      )}

      {/* TAB 2: GLOBAL FILES & GOVERNANCE */}
      {activeTab === "files" && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">
                  Global Document Governance
                </h3>
                {selectedUserFilter !== "all" && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 flex items-center gap-1.5">
                    Filtered by user
                    <button
                      onClick={() => setSelectedUserFilter("all")}
                      className="hover:text-slate-900 cursor-pointer ml-1"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Audit uploaded payloads across all accounts with instant inspection and emergency removal
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* User Selector Filter */}
              <select
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-900 outline-none cursor-pointer focus:border-indigo-500"
              >
                <option value="all">All Users ({users.length})</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email} ({u.documentCount})
                  </option>
                ))}
              </select>

              {/* Type Filter */}
              <select
                value={fileTypeFilter}
                onChange={(e) => setFileTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-900 outline-none cursor-pointer focus:border-indigo-500"
              >
                <option value="all">All File Types</option>
                <option value="pdf">PDFs</option>
                <option value="images">Images</option>
                <option value="docs">Documents</option>
              </select>

              {/* Search file */}
              <div className="relative w-full sm:w-56">
                <SearchIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search file name..."
                  value={searchFile}
                  onChange={(e) => setSearchFile(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-5">Document Name</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No documents found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <FileIconBox type={doc.type} className="w-8 h-8 shrink-0" />
                          <div className="min-w-0">
                            <p
                              onClick={() => setPreviewDoc(doc)}
                              className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors truncate max-w-xs cursor-pointer"
                            >
                              {doc.name}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500 truncate">
                              SHA: {doc.hash?.slice(0, 16) || "verified"}...
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        {doc.user?.email || "Unknown"}
                      </td>

                      <td className="py-3.5 px-4">
                        <FileBadge type={doc.type} />
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {formatBytes(doc.rawBytes)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400">
                        {formatDate(doc.createdAt)}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                            title="Inspect Document"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPendingDeleteDoc(doc)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Purge Document"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE USER MODAL */}
      {pendingDeleteUser && (
        <div
          onClick={() => setPendingDeleteUser(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-left"
          >
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <TrashIcon className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">
                Delete User Account?
              </h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Are you sure you want to permanently delete{" "}
              <b className="text-slate-900 font-mono">{pendingDeleteUser.email}</b>?
              This action will permanently delete all associated documents, folders, and active sessions. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setPendingDeleteUser(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DOCUMENT MODAL */}
      {pendingDeleteDoc && (
        <div
          onClick={() => setPendingDeleteDoc(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-left"
          >
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <TrashIcon className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">
                Purge Document?
              </h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              You are about to permanently purge{" "}
              <b className="text-slate-900 font-mono">{pendingDeleteDoc.name}</b> uploaded by{" "}
              <span className="text-indigo-300 font-semibold">{pendingDeleteDoc.user?.email}</span>.
              The payload will be destroyed from Cloudinary and removed from MySQL.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setPendingDeleteDoc(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDoc}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Purging..." : "Purge Document"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDoc && (
        <div
          onClick={() => setPreviewDoc(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <FileIconBox type={previewDoc.type} className="w-10 h-10" />
                <div>
                  <h4 className="font-bold text-sm text-slate-900 truncate max-w-xs">
                    {previewDoc.name}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {formatBytes(previewDoc.rawBytes)} • {previewDoc.folder || "Vault"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-900 p-1 rounded-lg text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="my-6 p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center">
              {["PNG", "JPG", "JPEG", "WEBP"].includes((previewDoc.type || "").toUpperCase()) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/admin/documents/${encodeURIComponent(previewDoc.id)}`}
                  alt={previewDoc.name}
                  className="max-h-56 max-w-full rounded-xl object-contain shadow-md mb-3"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-indigo-400">
                  <FilesIcon className="w-8 h-8" />
                </div>
              )}
              <p className="text-sm font-semibold text-slate-900">
                Admin Security Inspection
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Owner: <b className="text-slate-200">{previewDoc.user?.email || "Unknown"}</b> <br />
                SHA-256: <code className="text-indigo-400 font-mono text-[10px]">{previewDoc.hash || "Verified"}</code>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
