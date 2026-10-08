"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useVault } from "@/app/(user)/dashboard/lib/vaultContext";
import { isImageDocument } from "@/app/(user)/dashboard/lib/documentUtils";
import {
  FolderIcon,
  ChevronRightIcon,
  FilesIcon,
  ShieldCheckIcon,
  PlusIcon,
  EyeIcon,
  DownloadIcon,
  TrashIcon,
  StarIcon,
} from "@/components/UI/Icons";
import { FileBadge, FileIconBox } from "@/components/UI/FileBadge";
import DeleteConfirmationDialog from "@/components/UI/DeleteConfirmationDialog";

export default function FolderPage({ params }) {
  const unwrappedParams = use(params);
  const folderSlug = unwrappedParams.folder;

  const {
    folders,
    documents,
    toggleStar,
    moveToTrash,
    uploadFile,
    downloadDocument,
    hasPermission,
  } = useVault();

  const [previewFile, setPreviewFile] = useState(null);
  const [pendingDeleteFile, setPendingDeleteFile] = useState(null);

  const confirmDeleteFile = () => {
    if (!pendingDeleteFile) return;
    moveToTrash(pendingDeleteFile.id);
    if (String(previewFile?.id) === String(pendingDeleteFile.id)) {
      setPreviewFile(null);
    }
    setPendingDeleteFile(null);
  };

  const currentFolder = folders.find((f) => f.slug === folderSlug) || {
    name: folderSlug.charAt(0).toUpperCase() + folderSlug.slice(1).replace("-", " "),
    slug: folderSlug,
    description: "Folder document collection.",
  };

  const folderFiles = useMemo(() => {
    return documents.filter(
      (d) =>
        d.folderSlug === folderSlug ||
        (typeof d.folder === "string" &&
          d.folder.toLowerCase() === currentFolder.name.toLowerCase())
    );
  }, [documents, folderSlug, currentFolder.name]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file, folderSlug);
      e.target.value = "";
    }
  };

  if (!hasPermission("VIEW_DOCUMENTS")) return null;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Link href="/dashboard/folders" className="hover:text-blue-600 transition-colors">
          Folders
        </Link>
        <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800">{currentFolder.name}</span>
      </div>

      {/* Folder Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
            <FolderIcon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {currentFolder.name}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {folderFiles.length} documents encrypted in this folder • {currentFolder.description}
            </p>
          </div>
        </div>

        {hasPermission("UPLOAD_DOCUMENT") && <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer">
          <PlusIcon className="w-4 h-4" />
          <span>Add File to Folder</span>
          <input
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>}
      </div>

      {/* Files in Folder Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            Documents in {currentFolder.name}
          </h3>
          <span className="text-xs font-medium text-slate-400">
            {folderFiles.length} file{folderFiles.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-5">Document Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Modified</th>
                <th className="py-3 px-4">Encryption</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {folderFiles.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleStar(doc.id)}
                        className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                          doc.starred
                            ? "text-amber-500"
                            : "text-slate-300 hover:text-amber-500"
                        }`}
                      >
                        <StarIcon className="w-4 h-4" filled={doc.starred} />
                      </button>
                      <FileIconBox type={doc.type} className="w-8 h-8" />
                      <span
                        onClick={() => setPreviewFile(doc)}
                        className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors cursor-pointer truncate max-w-xs sm:max-w-md"
                      >
                        {doc.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <FileBadge type={doc.type} />
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                    {doc.size}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">
                    {doc.modified}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <ShieldCheckIcon className="w-3 h-3" />
                      AES-256
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setPreviewFile(doc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      {hasPermission("DOWNLOAD_DOCUMENT") && <button
                        onClick={() => downloadDocument(doc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Download"
                      >
                        <DownloadIcon className="w-4 h-4" />
                      </button>}
                      {hasPermission("DELETE_DOCUMENT") && <button
                        onClick={() => setPendingDeleteFile(doc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Move to Trash"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>}
                    </div>
                  </td>
                </tr>
              ))}

              {folderFiles.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                      <FilesIcon className="w-7 h-7" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      No documents in {currentFolder.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                      Upload your first file into this folder to get started.
                    </p>
                    {hasPermission("UPLOAD_DOCUMENT") && <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors cursor-pointer">
                      <PlusIcon className="w-4 h-4" />
                      <span>Upload to {currentFolder.name}</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <div
          onClick={() => setPreviewFile(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-150"
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
              {previewFile.dataUrl && isImageDocument(previewFile) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewFile.dataUrl}
                  alt={previewFile.name}
                  className="max-h-52 max-w-full rounded-xl object-contain shadow-xs mb-3"
                />
              ) : (
                <ShieldCheckIcon className="w-8 h-8 text-emerald-600 mb-2" />
              )}
              <p className="text-xs font-bold text-slate-800">
                Encrypted Vault Document
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Zero-knowledge encrypted with client-side key.
              </p>
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

      <DeleteConfirmationDialog
        file={pendingDeleteFile}
        onCancel={() => setPendingDeleteFile(null)}
        onConfirm={confirmDeleteFile}
      />
    </main>
  );
}