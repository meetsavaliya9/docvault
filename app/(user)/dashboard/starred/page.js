"use client";

import { useState } from "react";
import Link from "next/link";
import { useVault } from "@/app/(user)/dashboard/lib/vaultContext";
import { isImageDocument } from "@/app/(user)/dashboard/lib/documentUtils";
import {
  StarIcon,
  SearchIcon,
  EyeIcon,
  DownloadIcon,
  ShieldCheckIcon,
} from "@/components/UI/Icons";
import { FileBadge, FileIconBox } from "@/components/UI/FileBadge";

export default function StarredPage() {
  const {
    starredDocuments,
    toggleStar,
    downloadDocument,
    hasPermission,
  } = useVault();

  const [search, setSearch] = useState("");
  const [previewFile, setPreviewFile] = useState(null);

  const filtered = starredDocuments.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.folder.toLowerCase().includes(search.toLowerCase())
  );

  if (!hasPermission("VIEW_STARRED") || !hasPermission("VIEW_DOCUMENTS")) return null;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200/60 mb-2">
            <StarIcon className="w-3.5 h-3.5" filled={true} />
            <span>High Priority Access</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Starred Documents
          </h1>
          <p className="mt-1 text-slate-500 text-xs sm:text-sm">
            {starredDocuments.length} bookmarked documents synchronized across your vault.
          </p>
        </div>

        {/* Search */}
        {hasPermission("SEARCH_DOCUMENTS") && hasPermission("SEARCH_BY_NAME") && <div className="relative w-full sm:w-72">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search starred files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:border-blue-500 text-slate-800 placeholder-slate-400 outline-none shadow-xs"
          />
        </div>}
      </div>

      {/* Files Table */}
      <div className="overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-3 sm:px-5 py-3.5">Document</th>
                <th className="hidden sm:table-cell px-3 sm:px-4 py-3.5">Type</th>
                <th className="hidden md:table-cell px-3 sm:px-4 py-3.5">Folder</th>
                <th className="hidden sm:table-cell px-3 sm:px-4 py-3.5">Size</th>
                <th className="hidden lg:table-cell px-3 sm:px-4 py-3.5">Modified</th>
                <th className="px-3 sm:px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filtered.map((file) => (
                <tr
                  key={file.id}
                  className="transition-colors hover:bg-slate-50/60 group"
                >
                  <td className="px-3 sm:px-5 py-3 sm:py-3.5">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <FileIconBox type={file.type} className="w-8 h-8 shrink-0" />

                      <div className="min-w-0">
                        <span
                          onClick={() => setPreviewFile(file)}
                          className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors cursor-pointer truncate block max-w-[120px] xs:max-w-[170px] sm:max-w-xs md:max-w-md"
                        >
                          {file.name}
                        </span>
                        {/* Subtitle for mobile view */}
                        <div className="sm:hidden text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-slate-500">{file.type}</span>
                          <span>•</span>
                          <span>{file.size}</span>
                          <span>•</span>
                          <span className="truncate max-w-[70px]">{file.folder}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="hidden sm:table-cell px-3 sm:px-4 py-3.5">
                    <FileBadge type={file.type} />
                  </td>

                  <td className="hidden md:table-cell px-3 sm:px-4 py-3.5 text-slate-600 font-medium">
                    {file.folder}
                  </td>

                  <td className="hidden sm:table-cell px-3 sm:px-4 py-3.5 text-slate-500 font-medium">
                    {file.size}
                  </td>

                  <td className="hidden lg:table-cell px-3 sm:px-4 py-3.5 text-slate-400">
                    {file.modified}
                  </td>

                  <td className="px-3 sm:px-5 py-3 sm:py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {hasPermission("MANAGE_STARRED_DOCUMENTS") && <button
                        onClick={() => toggleStar(file.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                        title="Remove Star"
                      >
                        <StarIcon className="w-3.5 h-3.5 text-amber-500" filled={false} />
                        <span className="hidden xs:inline">Remove Star</span>
                      </button>}

                      {hasPermission("VIEW_DOCUMENT_DETAILS") && <button
                        onClick={() => setPreviewFile(file)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Preview"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>}
                      {hasPermission("DOWNLOAD_DOCUMENT") && <button
                        onClick={() => downloadDocument(file)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Download"
                      >
                        <DownloadIcon className="w-4 h-4" />
                      </button>}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3">
                      <StarIcon className="w-7 h-7" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      No starred documents found
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                      Click the star icon next to any document in your vault to bookmark it here for instant access.
                    </p>
                    {hasPermission("VIEW_DOCUMENTS") && <Link
                      href="/dashboard/files"
                      className="mt-4 inline-block px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors"
                    >
                      Browse My Files
                    </Link>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Modal */}
      {(hasPermission("VIEW_DOCUMENT_DETAILS") || hasPermission("PREVIEW_DOCUMENT")) && previewFile && (
        <div
          onClick={() => setPreviewFile(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <FileIconBox type={previewFile.type} className="w-10 h-10" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900 truncate max-w-xs">
                    {previewFile.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {previewFile.size} • {previewFile.folder}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="my-5 p-6 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-center">
              {hasPermission("PREVIEW_DOCUMENT") && previewFile.dataUrl && isImageDocument(previewFile) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewFile.dataUrl}
                  alt={previewFile.name}
                  className="max-h-52 max-w-full rounded-xl object-contain shadow-xs mb-3"
                />
              ) : (
                <ShieldCheckIcon className="w-8 h-8 text-emerald-600 mb-2" />
              )}
              {hasPermission("PREVIEW_DOCUMENT") && <p className="text-xs font-bold text-slate-800">
                Starred Cloud Asset
              </p>}
              {hasPermission("PREVIEW_DOCUMENT") && <p className="text-[11px] text-slate-400 mt-1">
                Zero-knowledge encrypted. Ready for offline or online sync.
              </p>}
            </div>

            <div className="flex items-center gap-3">
              {hasPermission("DOWNLOAD_DOCUMENT") && <button
                onClick={() => {
                  downloadDocument(previewFile);
                  setPreviewFile(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <DownloadIcon className="w-4 h-4" />
                Download Copy
              </button>}
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