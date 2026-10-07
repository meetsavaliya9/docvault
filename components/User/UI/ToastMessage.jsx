"use client";

import { useVault } from "@/app/(user)/dashboard/lib/vaultContext";
import { CheckIcon, ClockIcon, XIcon } from "@/components/UI/Icons";

export default function ToastMessage() {
  const { toastMessage, toastType, dismissToast } = useVault();

  if (!toastMessage) return null;

  const isWarning = toastType === "warning";
  const Icon = isWarning ? ClockIcon : CheckIcon;

  return (
    <div
      role={isWarning ? "alert" : "status"}
      aria-live={isWarning ? "assertive" : "polite"}
      className={`fixed bottom-4 right-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl animate-in slide-in-from-bottom duration-200 sm:bottom-6 sm:right-6 ${
        isWarning
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : toastType === "info"
            ? "border-blue-200 bg-blue-50 text-blue-950"
            : "border-emerald-200 bg-emerald-50 text-emerald-950"
      }`}
    >
      <Icon
        className={`mt-0.5 h-5 w-5 shrink-0 ${
          isWarning
            ? "text-amber-600"
            : toastType === "info"
              ? "text-blue-600"
              : "text-emerald-600"
        }`}
      />
      <p className="min-w-0 flex-1 break-words font-medium">{toastMessage}</p>
      <button
        type="button"
        onClick={dismissToast}
        aria-label="Dismiss message"
        className="shrink-0 rounded-lg p-1 text-slate-500 transition-colors hover:bg-black/5 hover:text-slate-900"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
