"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useVault } from "@/app/(user)/dashboard/lib/vaultContext";
import {
  FolderIcon,
  PlusIcon,
  ChevronRightIcon,
  SparklesIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "@/components/UI/Icons";

export default function FoldersPage() {
  const {
    folders,
    documents,
    createFolder,
    deleteFolder,
  } = useVault();

  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [deleteFolderError, setDeleteFolderError] = useState("");

  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    createFolder(newFolderName.trim(), newFolderDesc.trim());
    setNewFolderName("");
    setNewFolderDesc("");
    setShowNewFolderModal(false);
  };

  const handleDeleteFolder = async () => {
    if (!pendingDeleteFolder || isDeletingFolder) return;
    setIsDeletingFolder(true);
    setDeleteFolderError("");
    try {
      const deleted = await deleteFolder(pendingDeleteFolder.slug);
      if (deleted) setPendingDeleteFolder(null);
    } catch (error) {
      setDeleteFolderError(error.message || "Could not delete this folder.");
    } finally {
      setIsDeletingFolder(false);
    }
  };

  // Compute stats per folder from real documents
  const folderStats = useMemo(() => {
    return folders.map((folder) => {
      const folderDocs = documents.filter(
        (d) => d.folderSlug === folder.slug || d.folder === folder.name
      );
      const bytes = folderDocs.reduce((acc, d) => acc + (d.rawBytes || 1024 * 500), 0);
      const sizeMB = (bytes / (1024 * 1024)).toFixed(1);
      return {
        ...folder,
        files: folderDocs.length,
        size: `${sizeMB} MB`,
      };
    });
  }, [folders, documents]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Vault Folders
          </h1>
          <p className="mt-1 text-slate-500 text-xs sm:text-sm">
            Organize documents into encrypted categories with granular access control.
          </p>
        </div>

        <button
          onClick={() => setShowNewFolderModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
        >
          <PlusIcon className="w-4 h-4" />
          <span>New Folder</span>
        </button>
      </div>

      {/* Folders Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FolderIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Folders</p>
            <p className="text-xl font-extrabold text-slate-900">{folders.length} Collections</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <SparklesIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Documents</p>
            <p className="text-xl font-extrabold text-slate-900">
              {documents.length} Files
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheckIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Security</p>
            <p className="text-xl font-extrabold text-emerald-600">Zero-Knowledge</p>
          </div>
        </div>
      </div>

      {/* Folder Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {folderStats.map((folder) => (
          <article
            key={folder.id}
            className="relative rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
          >
            <Link
              href={`/dashboard/folders/${folder.slug}`}
              className="p-6 flex flex-col justify-between group block"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-2xl ${folder.bgLight} ${folder.textColor} flex items-center justify-center font-bold text-xl shadow-xs group-hover:scale-105 transition-transform`}
                  >
                    <FolderIcon className="w-6 h-6" />
                  </div>
                  <span className="mr-10 text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                    {folder.size}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                  {folder.name}
                </h3>
                <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                  {folder.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  {folder.files} documents
                </span>
                <span className="font-semibold text-blue-600 group-hover:text-blue-700 flex items-center gap-1 transition-colors">
                  Open Folder
                  <ChevronRightIcon className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
            <button
              type="button"
              aria-label={`Delete ${folder.name} folder`}
              title="Delete folder"
              onClick={() => {
                setDeleteFolderError("");
                setPendingDeleteFolder(folder);
              }}
              className="absolute right-5 top-5 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </article>
        ))}
      </div>

      {pendingDeleteFolder && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeletingFolder) {
              setPendingDeleteFolder(null);
              setDeleteFolderError("");
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-folder-title"
            aria-describedby="delete-folder-description"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <h2 id="delete-folder-title" className="text-base font-bold text-slate-900">
              Delete this folder?
            </h2>
            <p id="delete-folder-description" className="mt-2 text-sm leading-6 text-slate-500">
              Delete <span className="font-semibold text-slate-700">{pendingDeleteFolder.name}</span>?
              Its documents will be kept and moved to the General folder.
            </p>
            {deleteFolderError && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                {deleteFolderError}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 min-[380px]:flex-row min-[380px]:justify-end">
              <button
                type="button"
                disabled={isDeletingFolder}
                onClick={() => {
                  setPendingDeleteFolder(null);
                  setDeleteFolderError("");
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 min-[380px]:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingFolder}
                onClick={handleDeleteFolder}
                className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50 min-[380px]:w-auto"
              >
                {isDeletingFolder ? "Deleting..." : "Delete Folder"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Create New Folder Modal */}
      {showNewFolderModal && (
        <div
          onClick={() => setShowNewFolderModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                Create New Folder
              </h3>
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4 my-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Marketing Q4, Tax Documents..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief note about the contents in this folder..."
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-800 outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer"
                >
                  Create Folder
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
