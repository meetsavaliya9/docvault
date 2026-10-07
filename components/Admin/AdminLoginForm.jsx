"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheckIcon, VaultIcon } from "@/components/UI/Icons";

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.error || "Could not sign in to the admin panel.",
        );
      }
      router.replace(result.redirectTo || "/admin");
      router.refresh();
    } catch (loginError) {
      setError(loginError.message || "Could not sign in. Please try again.");
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:rounded-3xl sm:p-10">
        <Link
          href="/admin/login"
          className="mb-8 flex items-center justify-center gap-3"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
            <VaultIcon className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-2xl font-extrabold tracking-tight text-slate-900">
              DocVault
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-blue-600">
              Admin Console
            </span>
          </span>
        </Link>

        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600">
            <ShieldCheckIcon className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Administrator Access
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Sign in with an authorized administrator account to oversee users,
            enforce retention, and audit storage.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700"
          >
            <span className="mt-0.5 font-bold text-rose-600">⚠</span>
            <div className="flex-1">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Administrator Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
              placeholder="Enter admin Email"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
              placeholder="Enter password"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Signing in..." : "Sign in to Admin Panel"}
          </button>
        </form>
      </section>
    </main>
  );
}
