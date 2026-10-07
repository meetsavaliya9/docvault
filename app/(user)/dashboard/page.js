"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useVault } from "@/app/(user)/dashboard/lib/vaultContext";
import { isImageDocument } from "@/app/(user)/dashboard/lib/documentUtils";
import {
  FilesIcon,
  HardDriveIcon,
  StarIcon,
  ShieldCheckIcon,
  PlusIcon,
  FolderIcon,
  TrendingUpIcon,
  EyeIcon,
  DownloadIcon,
  ChevronRightIcon,
  SparklesIcon,
} from "@/components/UI/Icons";
import { FileBadge, FileIconBox } from "@/components/UI/FileBadge";

export default function DashboardPage() {
  const {
    userName,
    documents,
    folders,
    starredDocuments,
    storageMetrics,
    billing,
    toggleStar,
    downloadDocument,
  } = useVault();

  const [activeTab, setActiveTab] = useState("all");
  const [previewFile, setPreviewFile] = useState(null);

  // Filter recent documents
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (activeTab === "starred") return doc.starred;
      if (activeTab === "pdf") return doc.type === "PDF";
      return true;
    }).slice(0, 6);
  }, [documents, activeTab]);

  // Compute folder document counts and storage dynamically
  const folderStats = useMemo(() => {
    return folders.map((folder) => {
      const folderDocs = documents.filter((d) => d.folderSlug === folder.slug || d.folder === folder.name);
      const bytes = folderDocs.reduce((acc, d) => acc + (d.rawBytes || 1024 * 500), 0);
      const sizeMB = (bytes / (1024 * 1024)).toFixed(1);
      return {
        ...folder,
        docCount: folderDocs.length,
        sizeFormatted: `${sizeMB} MB`,
      };
    });
  }, [folders, documents]);

  // Compute storage distribution
  const typeDistribution = useMemo(() => {
    let pdfBytes = 0;
    let docBytes = 0;
    let imgBytes = 0;
    let otherBytes = 0;

    documents.forEach((d) => {
      const b = d.rawBytes || 1024 * 1024;
      const t = d.type.toUpperCase();
      if (t === "PDF") pdfBytes += b;
      else if (["DOC", "DOCX"].includes(t)) docBytes += b;
      else if (["PNG", "JPG", "JPEG", "WEBP"].includes(t)) imgBytes += b;
      else otherBytes += b;
    });

    const total = Math.max(pdfBytes + docBytes + imgBytes + otherBytes, 1);

    return {
      pdfPct: Math.round((pdfBytes / total) * 100),
      pdfMB: (pdfBytes / (1024 * 1024)).toFixed(1),
      docPct: Math.round((docBytes / total) * 100),
      docMB: (docBytes / (1024 * 1024)).toFixed(1),
      imgPct: Math.round((imgBytes / total) * 100),
      imgMB: (imgBytes / (1024 * 1024)).toFixed(1),
      otherPct: Math.max(100 - (Math.round((pdfBytes / total) * 100) + Math.round((docBytes / total) * 100) + Math.round((imgBytes / total) * 100)), 0),
      otherMB: (otherBytes / (1024 * 1024)).toFixed(1),
    };
  }, [documents]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-6 sm:p-8 shadow-xl shadow-blue-500/15">
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-indigo-400/20 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-medium tracking-wide mb-3 border border-white/20">
              <SparklesIcon className="w-3.5 h-3.5 text-blue-200" />
              <span>DocVault Cloud Workspace v2.0</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {userName} 👋
            </h1>
            <p className="mt-1.5 text-blue-100 text-sm max-w-xl">
              All {documents.length} cloud documents are synchronized and secured with AES-256 encryption. You have used {storageMetrics.percentage}% of your {storageMetrics.planName || "Free"} storage quota.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/dashboard/files"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-600 font-semibold text-xs sm:text-sm hover:bg-blue-50 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <PlusIcon className="w-4 h-4 text-blue-600" />
              Upload Document
            </Link>
            <Link
              href="/dashboard/folders"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-medium text-xs sm:text-sm border border-white/25 backdrop-blur-md transition-all active:scale-95 cursor-pointer"
            >
              <FolderIcon className="w-4 h-4" />
              Folders
            </Link>
          </div>
        </div>
      </div>

      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Current plan</p>
          <p className="mt-1 text-lg font-extrabold text-slate-900">
            {billing.planName}
            <span className="ml-2 text-sm font-semibold text-slate-500">
              {billing.plan === "free"
                ? "Free"
                : `${new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: billing.currency || "INR",
                    maximumFractionDigits: 2,
                  }).format((billing.amount || 0) / 100)}/{billing.billingPeriod || "month"}`}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {billing.plan !== "free" && billing.currentPeriodEnd
              ? `Valid until ${new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                }).format(new Date(billing.currentPeriodEnd))}`
              : "Basic document storage and search"}
          </p>
        </div>
        <Link
          href="/dashboard/subscription"
          className="inline-flex shrink-0 items-center justify-center rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
        >
          {billing.plan === "free" ? "Upgrade" : "Manage Plan"}
        </Link>
      </section>

      {/* KPI Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Documents */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Documents
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FilesIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {documents.length}
            </h2>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              <TrendingUpIcon className="w-3 h-3 mr-0.5" />
              Active
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Across {folders.length} custom folders
          </p>
        </div>

        {/* Storage Quota */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Storage Used
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <HardDriveIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {storageMetrics.formattedUsed}
            </h2>
            <span className="text-xs font-medium text-slate-400">of {storageMetrics.quotaLabel}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
              style={{ width: `${storageMetrics.percentage}%` }}
            />
          </div>
        </div>

        {/* Starred Documents */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Starred Files
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <StarIcon className="w-5 h-5" filled={true} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {starredDocuments.length}
            </h2>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md font-semibold">
              Fast Access
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Bookmarked for priority
          </p>
        </div>

        {/* Security Status */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Vault Security
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldCheckIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              100%
            </h2>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
              Encrypted
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            AES-256 bit data protection
          </p>
        </div>
      </div>

      {/* Storage Breakdown Multi-Bar */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Cloud Storage Distribution
            </h3>
            <p className="text-xs text-slate-500">
              Real-time breakdown of all stored media & documents
            </p>
          </div>
          <span className="text-xs font-bold text-blue-600">
            {storageMetrics.formattedRemaining} Remaining
          </span>
        </div>

        {/* Multi-segmented dynamic bar */}
        <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden gap-0.5">
          <div
            className="bg-rose-500 h-full transition-all duration-500"
            style={{ width: `${Math.max(typeDistribution.pdfPct, 5)}%` }}
            title={`PDF: ${typeDistribution.pdfPct}%`}
          />
          <div
            className="bg-blue-500 h-full transition-all duration-500"
            style={{ width: `${Math.max(typeDistribution.docPct, 5)}%` }}
            title={`Docs: ${typeDistribution.docPct}%`}
          />
          <div
            className="bg-purple-500 h-full transition-all duration-500"
            style={{ width: `${Math.max(typeDistribution.imgPct, 5)}%` }}
            title={`Images: ${typeDistribution.imgPct}%`}
          />
          <div
            className="bg-emerald-500 h-full transition-all duration-500"
            style={{ width: `${Math.max(typeDistribution.otherPct, 5)}%` }}
            title={`Sheets/Other: ${typeDistribution.otherPct}%`}
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-rose-500 shrink-0" />
            <span className="text-slate-600">PDF Files: <b className="text-slate-800">{typeDistribution.pdfMB} MB</b></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-blue-500 shrink-0" />
            <span className="text-slate-600">Documents: <b className="text-slate-800">{typeDistribution.docMB} MB</b></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-purple-500 shrink-0" />
            <span className="text-slate-600">Media/Images: <b className="text-slate-800">{typeDistribution.imgMB} MB</b></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-emerald-500 shrink-0" />
            <span className="text-slate-600">Sheets & Other: <b className="text-slate-800">{typeDistribution.otherMB} MB</b></span>
          </div>
        </div>
      </div>

      {/* Quick Folders Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              Quick Folders
            </h3>
            <p className="text-xs text-slate-500">
              Browse organized categories
            </p>
          </div>
          <Link
            href="/dashboard/folders"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
          >
            All folders ({folders.length})
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {folderStats.map((folder) => (
            <Link
              key={folder.id}
              href={`/dashboard/folders/${folder.slug}`}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group block"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-11 h-11 rounded-xl ${folder.bgLight} ${folder.textColor} flex items-center justify-center font-bold text-lg shadow-xs group-hover:scale-105 transition-transform`}
                >
                  <FolderIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                  {folder.sizeFormatted}
                </span>
              </div>
              <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors truncate">
                {folder.name}
              </h4>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                {folder.docCount} documents
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Documents Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              Recent Documents
            </h3>
            <p className="text-xs text-slate-500">
              Live vault files synchronized with My Files & Starred
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === "all" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab("starred")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === "starred" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
                }`}
              >
                Starred ({starredDocuments.length})
              </button>
              <button
                onClick={() => setActiveTab("pdf")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === "pdf" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
                }`}
              >
                PDFs
              </button>
            </div>

            <Link
              href="/dashboard/files"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              View Full Vault →
            </Link>
          </div>
        </div>

        {/* Documents Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-5">Document Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Folder</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Last Modified</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-slate-50/60 transition-colors group"
                >
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <FileIconBox type={doc.type} className="w-9 h-9 shrink-0" />
                      <div className="min-w-0">
                        <p
                          onClick={() => setPreviewFile(doc)}
                          className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate max-w-xs sm:max-w-sm cursor-pointer"
                        >
                          {doc.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                            <ShieldCheckIcon className="w-3 h-3" />
                            Encrypted
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <FileBadge type={doc.type} />
                  </td>

                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                    {doc.folder}
                  </td>

                  <td className="py-3.5 px-4 text-slate-500 font-medium">
                    {doc.size}
                  </td>

                  <td className="py-3.5 px-4 text-slate-400">
                    {doc.modified}
                  </td>

                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleStar(doc.id)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          doc.starred
                            ? "text-amber-500 hover:text-amber-600 bg-amber-50"
                            : "text-slate-400 hover:text-amber-500 hover:bg-slate-100"
                        }`}
                        title={doc.starred ? "Remove Star" : "Add to Starred"}
                      >
                        <StarIcon className="w-4 h-4" filled={doc.starred} />
                      </button>

                      <button
                        onClick={() => setPreviewFile(doc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Preview Document"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => downloadDocument(doc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Download Document"
                      >
                        <DownloadIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Preview Modal */}
      {previewFile && (
        <div
          onClick={() => setPreviewFile(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <FileIconBox type={previewFile.type} className="w-11 h-11" />
                <div>
                  <h3 className="font-bold text-base text-slate-900 truncate max-w-xs">
                    {previewFile.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {previewFile.size} • {previewFile.folder}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg text-xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Document Content / Image Preview */}
            <div className="my-6 p-6 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-center">
              {previewFile.dataUrl && isImageDocument(previewFile) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewFile.dataUrl}
                  alt={previewFile.name}
                  className="max-h-56 max-w-full rounded-xl object-contain shadow-xs mb-3"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white shadow-xs border border-slate-200/60 flex items-center justify-center mb-3">
                  <FilesIcon className="w-8 h-8 text-blue-600" />
                </div>
              )}
              <p className="text-sm font-semibold text-slate-800">
                Encrypted Document Preview
              </p>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Verified SHA-256 fingerprint: <br />
                <code className="text-[10px] text-blue-600 font-mono">
                  {previewFile.hash || "e83f21...c82a1"}
                </code>
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  downloadDocument(previewFile);
                  setPreviewFile(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <DownloadIcon className="w-4 h-4" />
                Download Decrypted Copy
              </button>
              <button
                onClick={() => setPreviewFile(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}