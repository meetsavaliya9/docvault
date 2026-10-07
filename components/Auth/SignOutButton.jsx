"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignOutButton({ redirectTo = "/login" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setError("");
    setPending(true);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Unable to sign out.");
      }

      router.push(redirectTo);
      router.refresh();
    } catch (signOutError) {
      setError(signOutError.message || "Unable to sign out. Please try again.");
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={pending}
        className="mt-2 text-xs font-semibold text-slate-500 transition hover:text-rose-600 disabled:opacity-50"
      >
        {pending ? "Signing out..." : "Sign out"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-[11px] text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
