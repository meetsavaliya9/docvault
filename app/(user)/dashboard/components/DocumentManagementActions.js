"use client";

import { useId, useState } from "react";
import { useVault } from "@/app/(user)/dashboard/lib/vaultContext";
import PermissionActionButton from "@/components/User/UI/PermissionActionButton";

export default function DocumentManagementActions({ document, className = "" }) {
  const { folders, hasPermission, moveDocument, renameDocument } = useVault();
  const modalId = useId().replace(/:/g, "");
  const [mode, setMode] = useState("");
  const [name, setName] = useState(document.name);
  const [folderSlug, setFolderSlug] = useState(document.folderSlug || "general");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canRename = hasPermission("RENAME_DOCUMENT");
  const canMove = hasPermission("MOVE_DOCUMENT") && hasPermission("VIEW_FOLDERS");

  const openModal = (nextMode) => {
    setError("");
    setName(document.name);
    setFolderSlug(document.folderSlug || "general");
    setMode(nextMode);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (mode === "rename") {
        await renameDocument(document.id, name);
      } else {
        const destination =
          folderSlug === "general"
            ? { name: "General", slug: "general" }
            : folders.find((folder) => folder.slug === folderSlug);
        if (!destination) throw new Error("Select a valid destination folder.");
        await moveDocument(document.id, destination.slug, destination.name);
      }
      setMode("");
    } catch (submitError) {
      setError(submitError.message || "Could not update this document.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={`flex items-center gap-1 ${className}`}>
        <PermissionActionButton
          permission="RENAME_DOCUMENT"
          allowed={canRename}
          onClick={() => openModal("rename")}
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          title="Rename document"
        >
          Rename
        </PermissionActionButton>
        <PermissionActionButton
          permission="MOVE_DOCUMENT"
          allowed={canMove}
          onClick={() => openModal("move")}
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          title="Move document"
        >
          Move
        </PermissionActionButton>
      </div>

      {mode && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setMode("");
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${modalId}-title`}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <h2 id={`${modalId}-title`} className="text-base font-bold text-slate-900">
              {mode === "rename" ? "Rename document" : "Move document"}
            </h2>
            <p className="mt-1 truncate text-xs text-slate-500">{document.name}</p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {mode === "rename" ? (
                <label className="block text-xs font-semibold text-slate-700">
                  Document name
                  <input
                    autoFocus
                    required
                    maxLength={255}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </label>
              ) : (
                <label className="block text-xs font-semibold text-slate-700">
                  Destination folder
                  <select
                    value={folderSlug}
                    onChange={(event) => setFolderSlug(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="general">General (Root)</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.slug}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setMode("")}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : mode === "rename" ? "Save name" : "Move document"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
