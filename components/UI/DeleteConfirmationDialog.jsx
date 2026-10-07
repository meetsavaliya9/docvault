"use client";

import { useEffect } from "react";
import { TrashIcon } from "@/components/UI/Icons";

export default function DeleteConfirmationDialog({
  file,
  permanently = false,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!file) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [file, onCancel]);

  if (!file) return null;

  const actionLabel = permanently ? "Delete Permanently" : "Move to Trash";

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirmation-title"
        aria-describedby="delete-confirmation-description"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <TrashIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="delete-confirmation-title" className="text-base font-bold text-slate-900">
              {permanently ? "Delete this file permanently?" : "Move this file to Trash?"}
            </h2>
            <p id="delete-confirmation-description" className="mt-1 break-words text-sm leading-6 text-slate-500">
              Are you sure you want to {permanently ? "permanently delete" : "move"}{" "}
              <span className="font-semibold text-slate-700">&quot;{file.name}&quot;</span>
              {permanently
                ? "? This action cannot be undone."
                : "? You can restore it from Trash later."}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 min-[380px]:flex-row min-[380px]:justify-end">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 min-[380px]:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 min-[380px]:w-auto"
          >
            {actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
