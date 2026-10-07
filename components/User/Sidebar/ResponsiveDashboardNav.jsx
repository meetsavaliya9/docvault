"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/User/Navbar/Navbar";
import Sidebar from "@/components/User/Sidebar/Sidebar";
import { XIcon } from "@/components/UI/Icons";

export default function ResponsiveDashboardNav({ userEmail }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <>
      <Navbar
        userEmail={userEmail}
        isMenuOpen={isOpen}
        onMenuClick={() => setIsOpen(true)}
      />

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 h-full w-full bg-slate-950/40"
            onClick={() => setIsOpen(false)}
          />
          <div
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace navigation"
            className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col bg-white shadow-2xl"
          >
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setIsOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <XIcon className="h-5 w-5" />
            </button>
            <Sidebar
              userEmail={userEmail}
              onNavigate={() => setIsOpen(false)}
              className="!static !flex !h-full !max-h-screen !w-full !shrink-0 !border-r-0"
            />
          </div>
        </div>
      )}
    </>
  );
}
