"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VaultIcon } from "@/components/UI/Icons";

export default function AuthForm({
  mode,
  initialMessage = "",
  initialError = "",
}) {
  const isSignUp = mode === "signup";
  const router = useRouter();

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");

  // UI States
  const [otpStage, setOtpStage] = useState(false);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState(initialError);

  // Countdown timer for OTP Resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  async function pasteOtpFromClipboard() {
    setError("");
    try {
      if (!navigator.clipboard?.readText) {
        throw new Error("Clipboard access is not available in this browser.");
      }

      const clipboardText = await navigator.clipboard.readText();
      const code = clipboardText.match(/(?:^|\D)(\d{6})(?:\D|$)/)?.[1];
      if (!code) {
        throw new Error("No 6-digit code found in clipboard. Please copy the OTP from your email.");
      }

      setOtpCode(code);
      setMessage("Verification code pasted! Select Verify OTP to continue.");
    } catch (clipboardError) {
      setError(
        clipboardError.message ||
          "Could not read the clipboard. Copy the code from your email and enter it manually."
      );
    }
  }

  async function handleResendOtp() {
    if (cooldown > 0 || resending || pending) return;

    setError("");
    setMessage("");
    setResending(true);

    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to resend verification code.");
      }

      setCooldown(result.cooldownSeconds || 60);
      setOtpCode("");
      setMessage(result.message || "A new 6-digit OTP has been sent to your email.");
    } catch (err) {
      setError(err.message || "Could not resend OTP. Please try again.");
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    // Client-side validations
    if (!otpStage && isSignUp) {
      if (!name.trim()) {
        setError("Please enter your name.");
        return;
      }
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError("Please enter a valid email address.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    if (otpStage && !/^\d{6}$/.test(otpCode.trim())) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setPending(true);
    try {
      if (otpStage) {
        // VERIFY OTP STEP
        const response = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            otp: otpCode.trim(),
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Verification failed. Please try again.");
        }

        setMessage("Email verified successfully! Redirecting to your vault...");
        setTimeout(() => {
          router.replace(result.redirectTo || "/dashboard");
        }, 600);
        return;
      }

      // STEP 1: SEND OTP (Signup) or LOGIN
      const endpoint = isSignUp ? "/api/auth/signup" : "/api/auth/login";
      const payload = isSignUp
        ? {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            confirmPassword,
          }
        : {
            email: email.trim().toLowerCase(),
            password,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Authentication failed. Please check your details.");
      }

      if (result.otpRequired) {
        setOtpStage(true);
        setOtpCode("");
        setCooldown(result.cooldownSeconds || 60);
        setMessage(
          result.message ||
            `A 6-digit verification code has been sent to ${result.email || email}. It expires in 10 minutes.`
        );
      } else {
        router.replace(result.redirectTo || "/dashboard");
      }
    } catch (authError) {
      setError(authError.message || "An unexpected error occurred. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:py-12">
      <section className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-10">
        <Link href="/login" className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
            <VaultIcon className="h-6 w-6" />
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-slate-900">
            DocVault
          </span>
        </Link>

        <div className="mb-7 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {otpStage
              ? "Verify your email"
              : isSignUp
              ? "Create your account"
              : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {otpStage
              ? `Enter the 6-digit OTP sent to ${email}`
              : isSignUp
              ? "Sign up to access your personal document vault."
              : "Sign in to continue. Administrators are automatically sent to the admin console."}
          </p>
        </div>

        {message && (
          <div
            role="status"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800"
          >
            <span className="text-emerald-600 mt-0.5 font-bold">✓</span>
            <div className="flex-1">{message}</div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700"
          >
            <span className="text-rose-600 mt-0.5 font-bold">⚠</span>
            <div className="flex-1">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {otpStage ? (
            /* STEP 2: VERIFY OTP SCREEN */
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                6-Digit Verification Code
                <input
                  type="text"
                  name="one-time-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={otpCode}
                  onChange={(event) =>
                    setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-2xl font-mono font-bold tracking-[0.5em] text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="------"
                />
                <span className="mt-2 block text-xs font-normal text-slate-500">
                  Please check your Gmail inbox (and Spam/Junk folder) for the code.
                </span>
              </label>

              <button
                type="button"
                onClick={pasteOtpFromClipboard}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                📋 Paste code from clipboard
              </button>

              <button
                type="submit"
                disabled={pending || otpCode.length !== 6}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Verifying..." : "Verify OTP & Complete Account"}
              </button>

              {/* Resend OTP Row with Cooldown */}
              <div className="pt-2 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {cooldown > 0 ? (
                    <span>
                      Resend OTP in <strong className="font-semibold text-slate-700">{cooldown}s</strong>
                    </span>
                  ) : (
                    "Didn't receive the email?"
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={cooldown > 0 || resending || pending}
                  className="font-semibold text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {resending ? "Sending..." : "Resend OTP"}
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setOtpStage(false);
                    setOtpCode("");
                    setError("");
                    setMessage("");
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 underline"
                >
                  ← Edit details / Change email
                </button>
              </div>
            </div>
          ) : (
            /* STEP 1: ACCOUNT DETAILS SCREEN */
            <div className="space-y-4">
              {isSignUp && (
                <label className="block text-sm font-semibold text-slate-700">
                  Full Name
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="Meet Savaliya"
                  />
                </label>
              )}

              <label className="block text-sm font-semibold text-slate-700">
                Email Address
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="you@gmail.com"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Password
                <input
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder={isSignUp ? "At least 8 characters" : "Your password"}
                />
              </label>

              {isSignUp && (
                <label className="block text-sm font-semibold text-slate-700">
                  Confirm Password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="Re-enter password"
                  />
                </label>
              )}

              <button
                type="submit"
                disabled={pending}
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending
                  ? isSignUp
                    ? "Sending OTP..."
                    : "Signing in..."
                  : isSignUp
                  ? "Create Account & Send OTP"
                  : "Continue"}
              </button>
            </div>
          )}
        </form>

        {!otpStage && (
          <>
            <p className="mt-7 text-center text-sm text-slate-500">
              {isSignUp ? "Already have an account?" : "New to DocVault?"}{" "}
              <Link
                href={isSignUp ? "/login" : "/signup"}
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                {isSignUp ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
