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
import DocumentManagementActions from "@/app/(user)/dashboard/components/DocumentManagementActions";
import PermissionDenied from "@/components/User/UI/PermissionDenied";
import PermissionActionButton from "@/components/User/UI/PermissionActionButton";

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
    renameFolder,
    hasPermission,
  } = useVault();

  const [previewFile, setPreviewFile] = useState(null);
  const [pendingDeleteFile, setPendingDeleteFile] = useState(null);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

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

  const formatFileSize = (doc) => {
    const bytes = Number(doc.rawBytes);
    if (!Number.isFinite(bytes) || bytes <= 0) return doc.size || "—";
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    const unitIndex = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)) - 1,
      units.length - 1
    );
    const amount = bytes / 1024 ** (unitIndex + 1);
    return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[unitIndex]}`;
  };

  const handleRenameFolder = async (event) => {
    event.preventDefault();
    if (isRenaming) return;
    setIsRenaming(true);
    setRenameError("");
    try {
      await renameFolder(folderSlug, folderName);
      setIsRenameOpen(false);
    } catch (error) {
      setRenameError(error.message || "Could not rename this folder.");
    } finally {
      setIsRenaming(false);
    }
  };

  if (!folders.some((folder) => folder.slug === folderSlug)) {
    return (
      <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6 lg:p-8">
        <h1 className="text-xl font-bold text-slate-900">Folder not found</h1>
        <p className="text-sm text-slate-500">This folder is unavailable or does not belong to your account.</p>
        <Link href="/dashboard/folders" className="inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700">
          Back to Folders
        </Link>
      </main>
    );
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file, folderSlug);
      e.target.value = "";
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Link href="/dashboard/files" className="hover:text-blue-600 transition-colors">Documents</Link>
        <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
        <Link href="/dashboard/folders" className="hover:text-blue-600 transition-colors">Folders</Link>
        <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800">{currentFolder.name}</span>
      </div>

      {/* Folder Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
            <FolderIcon className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {currentFolder.name}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {hasPermission("VIEW_DOCUMENTS")
                ? `${folderFiles.length} documents encrypted in this folder • ${currentFolder.description}`
                : currentFolder.description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {hasPermission("RENAME_FOLDER") && (
            <button
              type="button"
              onClick={() => {
                setFolderName(currentFolder.name);
                setRenameError("");
                setIsRenameOpen(true);
              }}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-600"
            >
              Rename Folder
            </button>
          )}
          {hasPermission("UPLOAD_DOCUMENT") && <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer">
            <PlusIcon className="w-4 h-4" />
            <span>Add File to Folder</span>
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>}
        </div>
      </div>

      {/* Files in Folder Table */}
      {!hasPermission("UPLOAD_DOCUMENT") && (
        <PermissionDenied permission="UPLOAD_DOCUMENT" compact />
      )}
      {hasPermission("VIEW_DOCUMENTS") ? <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            Documents in {currentFolder.name}
          </h3>
          <span className="text-xs font-medium text-slate-400">
            {folderFiles.length} file{folderFiles.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] table-fixed text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="w-[34%] py-3 px-5">Document Name</th>
                <th className="w-[10%] py-3 px-4">Type</th>
                <th className="w-[10%] py-3 px-4">Size</th>
                <th className="w-[14%] py-3 px-4">Modified</th>
                <th className="w-[14%] py-3 px-4">Encryption</th>
                <th className="w-[18%] py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {folderFiles.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      {hasPermission("MANAGE_STARRED_DOCUMENTS") && <button
                        onClick={() => toggleStar(doc.id)}
                        className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                          doc.starred
                            ? "text-amber-500"
                            : "text-slate-300 hover:text-amber-500"
                        }`}
                      >
                        <StarIcon className="w-4 h-4" filled={doc.starred} />
                      </button>}
                      <FileIconBox type={doc.type} className="w-8 h-8" />
                      <span
                        onClick={hasPermission("VIEW_DOCUMENT_DETAILS") ? () => setPreviewFile(doc) : undefined}
                        className={`min-w-0 truncate font-semibold text-slate-800 ${hasPermission("VIEW_DOCUMENT_DETAILS") ? "group-hover:text-blue-600 transition-colors cursor-pointer" : ""}`}
                      >
                        {doc.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <FileBadge type={doc.type} />
                  </td>
                  <td className="whitespace-nowrap py-3.5 px-4 text-slate-600 font-medium tabular-nums">
                    {formatFileSize(doc)}
                  </td>
                  <td className="whitespace-nowrap py-3.5 px-4 text-slate-400">
                    {doc.modified}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <ShieldCheckIcon className="w-3 h-3" />
                      AES-256
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {hasPermission("VIEW_DOCUMENT_DETAILS") && <button
                        onClick={() => setPreviewFile(doc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>}
                      <PermissionActionButton
                        permission="DOWNLOAD_DOCUMENT"
                        onClick={() => downloadDocument(doc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Download document"
                      >
                        <DownloadIcon className="w-4 h-4" />
                      </PermissionActionButton>
                      <DocumentManagementActions document={doc} />
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
      </div> : <PermissionDenied permission="VIEW_DOCUMENTS" />}

      {isRenameOpen && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isRenaming) setIsRenameOpen(false);
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="rename-folder-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <h2 id="rename-folder-title" className="text-base font-bold text-slate-900">Rename folder</h2>
            <form onSubmit={handleRenameFolder} className="mt-4 space-y-4">
              <input
                autoFocus
                required
                maxLength={255}
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              />
              {renameError && <p role="alert" className="text-xs text-rose-600">{renameError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" disabled={isRenaming} onClick={() => setIsRenameOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isRenaming} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{isRenaming ? "Saving..." : "Save name"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Preview Modal */}
      {(hasPermission("VIEW_DOCUMENT_DETAILS") || hasPermission("PREVIEW_DOCUMENT")) && previewFile && (
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
                Encrypted Vault Document
              </p>}
              {hasPermission("PREVIEW_DOCUMENT") && <p className="text-[11px] text-slate-400 mt-1">
                Zero-knowledge encrypted with client-side key.
              </p>}
            </div>

            <div className="flex items-center gap-3">
              <PermissionActionButton
                permission="DOWNLOAD_DOCUMENT"
                onClick={() => {
                  downloadDocument(previewFile);
                  setPreviewFile(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                title="Download document"
              >
                <DownloadIcon className="w-4 h-4" />
                Download Copy
              </PermissionActionButton>
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