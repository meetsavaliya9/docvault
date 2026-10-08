"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminSignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleLogout = async () => {
    setPending(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out.");
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Admin sign out error:", err);
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-50"
    >
      {pending ? "Signing out..." : "Sign Out"}
    </button>
  );
}
