"use client";

import { useEffect } from "react";
import { RefreshCwIcon } from "@/components/UI/Icons";

export default function RestoreConfirmationDialog({ file, onCancel, onConfirm }) {
  useEffect(() => {
    if (!file) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [file, onCancel]);

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="restore-confirmation-title"
        aria-describedby="restore-confirmation-description"
        className="w-full max-w-md rounded-2xl border border-blue-200 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <RefreshCwIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="restore-confirmation-title" className="text-sm font-bold text-slate-900">
              Are you sure you want to restore this file?
            </h2>
            <p id="restore-confirmation-description" className="mt-1 break-words text-sm leading-6 text-slate-500">
              Restore{" "}
              <span className="font-semibold text-slate-700">&quot;{file.name}&quot;</span>
              {" "}to your files?
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Restore File
          </button>
        </div>
      </section>
    </div>
  );
}
