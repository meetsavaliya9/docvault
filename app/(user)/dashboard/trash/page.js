"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVault } from "@/app/(user)/dashboard/lib/vaultContext";
import {
  TrashIcon,
  RefreshCwIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "@/components/UI/Icons";
import { FileBadge, FileIconBox } from "@/components/UI/FileBadge";
import DeleteConfirmationDialog from "@/components/UI/DeleteConfirmationDialog";
import RestoreConfirmationDialog from "@/components/UI/RestoreConfirmationDialog";

export default function TrashPage() {
  const [isEmptyTrashDialogOpen, setIsEmptyTrashDialogOpen] = useState(false);
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState(null);
  const [pendingRestore, setPendingRestore] = useState(null);
  const {
    trash,
    restoreFromTrash,
    deletePermanently,
    emptyTrash,
    hasPermission,
  } = useVault();

  useEffect(() => {
    if (!isEmptyTrashDialogOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsEmptyTrashDialogOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isEmptyTrashDialogOpen]);

  const handleEmptyTrash = () => {
    if (trash.length === 0) return;
    emptyTrash();
    setIsEmptyTrashDialogOpen(false);
  };

  const handlePermanentDelete = (item) => {
    setPendingPermanentDelete(item);
  };

  const confirmPermanentDelete = () => {
    if (!pendingPermanentDelete) return;
    deletePermanently(pendingPermanentDelete.id);
    setPendingPermanentDelete(null);
  };

  const confirmRestore = () => {
    if (!pendingRestore) return;
    restoreFromTrash(pendingRestore.id);
    setPendingRestore(null);
  };

  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200/60 mb-2">
            <TrashIcon className="w-3.5 h-3.5" />
            <span>Recycle & Recovery</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Trash Bin
          </h1>
          <p className="mt-1 text-slate-500 text-xs sm:text-sm">
            {trash.length} deleted document{trash.length === 1 ? "" : "s"} protected under 30-day retention.
          </p>
        </div>

        {trash.length > 0 && hasPermission("EMPTY_TRASH") && (
          <button
            onClick={() => setIsEmptyTrashDialogOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-rose-500/20 transition-all hover:bg-rose-700 active:scale-95 sm:w-auto sm:self-auto sm:text-sm cursor-pointer"
          >
            <TrashIcon className="w-4 h-4" />
            <span>Empty All Trash</span>
          </button>
        )}
      </div>

      {isEmptyTrashDialogOpen && trash.length > 0 && (
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/40 p-4 lg:pl-[calc(18rem+1rem)]">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="empty-trash-title"
            aria-describedby="empty-trash-description"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const buttons = event.currentTarget.querySelectorAll("button");
              const firstButton = buttons[0];
              const lastButton = buttons[buttons.length - 1];

              if (event.shiftKey && document.activeElement === firstButton) {
                event.preventDefault();
                lastButton.focus();
              } else if (
                !event.shiftKey &&
                document.activeElement === lastButton
              ) {
                event.preventDefault();
                firstButton.focus();
              }
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <TrashIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 id="empty-trash-title" className="text-base font-bold text-slate-900">
                  Empty all trash?
                </h2>
                <p id="empty-trash-description" className="mt-1 break-words text-sm leading-6 text-slate-500">
                  Are you sure you want to permanently empty all items from Trash? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 min-[380px]:flex-row min-[380px]:justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setIsEmptyTrashDialogOpen(false)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 min-[380px]:w-auto cursor-pointer"
              >
                Cancel
              </button>
              {hasPermission("EMPTY_TRASH") && <button
                type="button"
                onClick={handleEmptyTrash}
                className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 min-[380px]:w-auto cursor-pointer"
              >
                Empty Trash
              </button>}
            </div>
          </section>
        </div>
      )}

      <DeleteConfirmationDialog
        file={pendingPermanentDelete}
        permanently
        onCancel={() => setPendingPermanentDelete(null)}
        onConfirm={confirmPermanentDelete}
      />
      <RestoreConfirmationDialog
        file={pendingRestore}
        onCancel={() => setPendingRestore(null)}
        onConfirm={confirmRestore}
      />

      {/* Retention Info Banner */}
      <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4">
        <ClockIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="min-w-0 break-words text-xs text-amber-900">
          <p className="font-bold">Automatic 30-Day Retention Policy</p>
          <p className="text-amber-800/80 mt-0.5">
            Files in the trash bin can be restored back to your active vault at any time. Once 30 days elapse, items are permanently erased.
          </p>
        </div>
      </div>

      {/* Responsive Trash Cards */}
      <section
        aria-label="Deleted documents"
        className="space-y-3 xl:hidden"
      >
        {trash.map((file) => (
          <article
            key={file.id}
            className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs"
          >
            <div className="flex min-w-0 items-start gap-3">
              <FileIconBox type={file.type} className="h-9 w-9 shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-sm font-semibold text-slate-800">
                  {file.name}
                </h2>
                <div className="mt-1.5">
                  <FileBadge type={file.type} />
                </div>
              </div>
            </div>

            <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-3 gap-y-3 border-t border-slate-100 pt-3 text-xs">
              <div className="min-w-0">
                <dt className="text-slate-400">Original folder</dt>
                <dd className="mt-0.5 truncate font-medium text-slate-700">
                  {file.originalFolder || "Vault"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-slate-400">Size</dt>
                <dd className="mt-0.5 font-medium text-slate-700">
                  {file.size}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-slate-400">Deleted on</dt>
                <dd className="mt-0.5 break-words text-slate-600">
                  {file.deleted}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-slate-400">Auto-purge in</dt>
                <dd className="mt-1">
                  <span className="inline-flex max-w-full rounded-md border border-amber-200/60 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    {file.retentionDays || 30} days left
                  </span>
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 min-[380px]:flex-row">
              {hasPermission("RESTORE_DOCUMENT") && <button
                onClick={() => setPendingRestore(file)}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 transition-all hover:bg-blue-600 hover:text-white cursor-pointer"
              >
                <RefreshCwIcon className="h-3.5 w-3.5 shrink-0" />
                Restore
              </button>}
              {hasPermission("PERMANENT_DELETE_DOCUMENT") && <button
                onClick={() => handlePermanentDelete(file)}
                className="inline-flex min-w-0 flex-1 items-center justify-center rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition-all hover:bg-rose-600 hover:text-white cursor-pointer"
              >
                Delete Forever
              </button>}
            </div>
          </article>
        ))}

        {trash.length === 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-12 text-center shadow-xs">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <TrashIcon className="h-7 w-7" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">
              Trash is completely empty
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
              There are no deleted documents in your vault. Files you delete
              will be kept here for 30 days.
            </p>
            {hasPermission("VIEW_DOCUMENTS") && <Link
              href="/dashboard/files"
              className="mt-4 inline-block rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Return to My Files
            </Link>}
          </div>
        )}
      </section>

      {/* Desktop Trash Table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs xl:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Document</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Original Folder</th>
                <th className="px-4 py-3.5">Size</th>
                <th className="px-4 py-3.5">Deleted On</th>
                <th className="px-4 py-3.5">Auto-Purge In</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {trash.map((file) => (
                <tr
                  key={file.id}
                  className="transition-colors hover:bg-slate-50/60 group"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <FileIconBox type={file.type} className="w-8 h-8 shrink-0" />
                      <span className="font-semibold text-slate-800 truncate max-w-xs sm:max-w-md">
                        {file.name}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3.5">
                    <FileBadge type={file.type} />
                  </td>

                  <td className="px-4 py-3.5 text-slate-600 font-medium">
                    {file.originalFolder || "Vault"}
                  </td>

                  <td className="px-4 py-3.5 text-slate-600 font-medium">
                    {file.size}
                  </td>

                  <td className="px-4 py-3.5 text-slate-400">
                    {file.deleted}
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                      {file.retentionDays || 30} days left
                    </span>
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {hasPermission("RESTORE_DOCUMENT") && <button
                        onClick={() => setPendingRestore(file)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-semibold transition-all cursor-pointer text-xs"
                      >
                        <RefreshCwIcon className="w-3.5 h-3.5" />
                        Restore
                      </button>}

                      {hasPermission("PERMANENT_DELETE_DOCUMENT") && <button
                        onClick={() => handlePermanentDelete(file)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white font-semibold transition-all cursor-pointer text-xs"
                      >
                        Delete Forever
                      </button>}
                    </div>
                  </td>
                </tr>
              ))}

              {trash.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <TrashIcon className="w-7 h-7" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Trash is completely empty
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                      There are no deleted documents in your vault. Files you delete will be kept here for 30 days.
                    </p>
                    <Link
                      href="/dashboard/files"
                      className="mt-4 inline-block px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors"
                    >
                      Return to My Files
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}