"use client";

import { useState } from "react";
import { useVault } from "@/app/(user)/dashboard/lib/vaultContext";
import PermissionDenied from "./PermissionDenied";

export default function PermissionActionButton({
  permission,
  allowed: allowedOverride,
  onClick,
  title,
  className,
  children,
}) {
  const { hasPermission } = useVault();
  const [showDenied, setShowDenied] = useState(false);
  const allowed = allowedOverride ?? hasPermission(permission);

  return (
    <span
      className={`relative ${className?.includes("flex-1") ? "flex flex-1" : "inline-flex"} flex-col items-center`}
    >
      <button
        type="button"
        onClick={() => {
          if (!allowed) {
            setShowDenied(true);
            return;
          }
          setShowDenied(false);
          onClick?.();
        }}
        className={`${className} ${className?.includes("flex-1") ? "w-full" : ""}`}
        title={title}
        aria-label={title}
      >
        {children}
      </button>
      {showDenied && (
        <PermissionDenied
          permission={permission}
          compact
          className="absolute right-0 top-full z-20 mt-2 w-64 shadow-md"
        />
      )}
    </span>
  );
}
