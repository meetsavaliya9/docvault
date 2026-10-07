"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

function formatPrice(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

function formatStorage(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${units[unit]}`;
}

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value))
    : "—";
}

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (script?.dataset.loaded === "true") {
      reject(new Error("Razorpay Checkout did not initialize. Please refresh and try again."));
      return;
    }
    const shouldAppend = !script;
    if (!script) {
      script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
    }
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        if (window.Razorpay) resolve();
        else reject(new Error("Checkout failed to initialize."));
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => {
        script.remove();
        reject(new Error("Could not load Razorpay Checkout."));
      },
      { once: true }
    );
    if (shouldAppend) document.body.appendChild(script);
  });
}

export default function SubscriptionPage() {
  const [billing, setBilling] = useState(null);
  const [plans, setPlans] = useState([]);
  const [razorpayKeyId, setRazorpayKeyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const checkoutReturned = useRef(false);

  const fetchData = useCallback(async () => {
    const [billingResponse, plansResponse] = await Promise.all([
      fetch("/api/billing", { cache: "no-store" }),
      fetch("/api/subscription/plans", { cache: "no-store" }),
    ]);
    const [billingResult, plansResult] = await Promise.all([
      billingResponse.json(),
      plansResponse.json(),
    ]);
    if (!billingResponse.ok || !plansResponse.ok) {
      throw new Error("Could not load subscription details. Please try again.");
    }
    return {
      billing: billingResult,
      plans: (plansResult.plans || []).map((plan) => ({
        ...plan,
        key: plan.slug,
        amount: plan.price,
        quotaLabel: formatStorage(plan.storageLimitBytes),
        maxDocuments: plan.documentLimit,
      })),
      razorpayKeyId: plansResult.razorpayKeyId || null,
    };
  }, []);

  const loadData = useCallback(async () => {
    const result = await fetchData();
    setBilling(result.billing);
    setPlans(result.plans);
    setRazorpayKeyId(result.razorpayKeyId);
    setError("");
  }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    fetchData()
      .then((result) => {
        if (cancelled) return;
        setBilling(result.billing);
        setPlans(result.plans);
        setRazorpayKeyId(result.razorpayKeyId);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      loadData().catch((loadError) => {
        setError(loadError.message || "Could not refresh subscription details.");
      });
    };
    const intervalId = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (loadError) {
      setError(loadError.message || "Could not refresh subscription details.");
    } finally {
      setRefreshing(false);
    }
  };

  const startCheckout = async (plan) => {
    setBusy(`create:${plan.key}`);
    setError("");
    setNotice("");
    setFailure(null);
    setPaymentSuccess(null);
    checkoutReturned.current = false;
    try {
      const orderResponse = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) {
        throw new Error(orderData.error || "Could not start payment.");
      }

      setBusy(`processing:${plan.key}`);
      await loadRazorpayCheckout();
      const checkout = new window.Razorpay({
        key: orderData.keyId || razorpayKeyId,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        name: orderData.name,
        description: orderData.description,
        prefill: orderData.prefill,
        theme: { color: "#2563eb" },
        modal: {
          ondismiss: () => {
            if (checkoutReturned.current) return;
            setBusy("");
            setFailure({
              plan,
              message: "Checkout was cancelled. Your subscription has not been activated.",
            });
          },
        },
        handler: async (checkoutResult) => {
          checkoutReturned.current = true;
          setBusy(`verify:${plan.key}`);
          try {
            const verifyResponse = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(checkoutResult),
            });
            const verifyResult = await verifyResponse.json();
            if (!verifyResponse.ok || !verifyResult.success) {
              throw new Error(
                verifyResult.error ||
                  "Payment verification failed. Your subscription has not been activated."
              );
            }
            setPaymentSuccess(verifyResult);
            window.dispatchEvent(new Event("docvault:billing-updated"));
            await loadData();
          } catch (verifyError) {
            setFailure({
              plan,
              message:
                verifyError.message ||
                "Payment verification failed. Your subscription has not been activated.",
            });
          } finally {
            setBusy("");
          }
        },
      });

      checkout.on("payment.failed", () => {
        checkoutReturned.current = true;
        setBusy("");
        setFailure({
          plan,
          message: "Payment failed. Your subscription has not been activated.",
        });
      });
      checkout.open();
    } catch (checkoutError) {
      setBusy("");
      setFailure({
        plan,
        message: checkoutError.message || "Could not start payment. Please try again.",
      });
    }
  };

  const downgradeToFree = async () => {
    if (
      !window.confirm(
        "Your current plan will stay active until it expires. After that, your account returns to Free."
      )
    ) {
      return;
    }
    setBusy("downgrade");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/billing/cancel", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update your plan.");
      setNotice(result.message);
      window.dispatchEvent(new Event("docvault:billing-updated"));
      await loadData();
    } catch (actionError) {
      setError(actionError.message || "Could not update your plan.");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading subscription details…
        </div>
      </main>
    );
  }

  if (!billing) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Subscription</h1>
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error || "Could not load subscription details."}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError("");
            loadData()
              .catch((loadError) => setError(loadError.message))
              .finally(() => setLoading(false));
          }}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Try again
        </button>
      </main>
    );
  }

  if (paymentSuccess) {
    return (
      <main className="mx-auto max-w-2xl p-4 py-10 sm:p-6 lg:py-16">
        <section className="rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-xl shadow-emerald-900/5 sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
            ✓
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            Payment confirmed
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
            Payment Successful!
          </h1>
          <p className="mt-2 text-slate-600">
            Your {paymentSuccess.planName} plan is now active.
          </p>
          <dl className="mt-7 grid gap-3 rounded-2xl bg-slate-50 p-5 text-left text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Plan</dt>
              <dd className="mt-1 font-bold text-slate-900">{paymentSuccess.planName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Amount</dt>
              <dd className="mt-1 font-bold text-slate-900">
                {formatPrice(paymentSuccess.amount, paymentSuccess.currency)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Payment ID</dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-800">
                {paymentSuccess.paymentId}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Starts</dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {formatDate(paymentSuccess.startDate)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Valid until</dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {formatDate(paymentSuccess.endDate)}
              </dd>
            </div>
          </dl>
          <Link
            href="/dashboard"
            className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 sm:w-auto"
          >
            Go to Dashboard
          </Link>
        </section>
      </main>
    );
  }

  const currentPlan = billing?.plan || "free";

  return (
    <main className="mx-auto max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
      <header className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
          DocVault plans
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          The right plan for every vault
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Securely manage your documents with storage and tools that grow with you.
          Plan details and pricing are provided by DocVault.
        </p>
      </header>

      {billing && (
        <section className="flex flex-col justify-between gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Current plan</p>
            <p className="mt-1 text-xl font-extrabold text-slate-900">
              {billing.planName}
              <span className="ml-2 text-sm font-medium text-slate-500">
                {formatPrice(billing.amount || 0, billing.currency || "INR")} / {billing.billingPeriod || "monthly"}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {billing.plan !== "free" && billing.currentPeriodEnd
                ? `Valid until ${formatDate(billing.currentPeriodEnd)}`
                : "Free plan"}
              {billing.cancelAtPeriodEnd ? " · Returns to Free after expiry" : ""}
            </p>
          </div>
          <p className="text-sm text-slate-600">
            {billing.documentCount} / {billing.maxDocuments ?? "∞"} documents
            <span className="mx-2">·</span>
            {billing.quotaLabel} storage
          </p>
        </section>
      )}

      {billing?.latestPayment?.refundedAmount > 0 && (
        <p
          role="status"
          className={`rounded-xl border p-4 text-sm ${
            billing.latestPayment.status === "refunded"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-blue-200 bg-blue-50 text-blue-900"
          }`}
        >
          {billing.latestPayment.status === "refunded"
            ? `A full refund of ${formatPrice(
                billing.latestPayment.refundedAmount,
                billing.latestPayment.currency
              )} was processed. Your paid subscription has ended.`
            : `A partial refund of ${formatPrice(
                billing.latestPayment.refundedAmount,
                billing.latestPayment.currency
              )} was processed. Your subscription remains active until its expiry date.`}
        </p>
      )}

      {notice && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {(error || failure) && (
        <section role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {failure && <p className="font-bold">Payment Failed</p>}
            <p>{failure?.message || error}</p>
            {failure && <p className="mt-1">Your subscription has not been activated.</p>}
          </div>
          {failure && (
            <button
              type="button"
              onClick={() => startCheckout(failure.plan)}
              disabled={Boolean(busy)}
              className="shrink-0 rounded-lg bg-rose-700 px-4 py-2.5 font-bold text-white hover:bg-rose-800 disabled:opacity-50"
            >
              Try Again
            </button>
          )}
        </section>
      )}

      {!razorpayKeyId && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Test checkout is not configured. Add Razorpay Test Mode credentials to the server
          environment and restart the app.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || Boolean(busy)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"
        >
          {refreshing ? "Refreshing plans…" : "Refresh plans"}
        </button>
      </div>

      <section className="grid items-stretch gap-5 sm:grid-cols-2 2xl:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.key;
          const isLowerTier =
            billing.status === "active" &&
            plan.currency === billing.currency &&
            plan.amount < (billing.amount || 0) &&
            plan.key !== "free";
          const isFreeDowngrade = plan.key === "free" && currentPlan !== "free";
          const isOtherFreePlan = plan.amount === 0 && !isCurrent && !isFreeDowngrade;
          const isBusy = busy.endsWith(`:${plan.key}`);
          return (
            <article
              key={plan.key}
              className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                plan.isRecommended
                  ? "border-blue-400 ring-2 ring-blue-100"
                  : isCurrent
                    ? "border-emerald-300"
                    : "border-slate-200"
              }`}
            >
              {plan.isRecommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  Recommended
                </span>
              )}
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold uppercase tracking-wide text-slate-900">
                  {plan.name}
                </h2>
                {isCurrent && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-800">
                    Current plan
                  </span>
                )}
              </div>
              <p className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900">
                {formatPrice(plan.amount, plan.currency)}
                <span className="ml-1 text-sm font-semibold text-slate-500">/ {plan.billingPeriod}</span>
              </p>
              <p className="mt-2 min-h-10 text-sm text-slate-600">{plan.description}</p>
              <p className="mt-2 text-sm font-semibold text-blue-700">
                {plan.quotaLabel} storage
                <span className="text-slate-500">
                  {" "}· {plan.maxDocuments === null ? "Unlimited" : plan.maxDocuments} documents
                </span>
              </p>
              <ul className="my-6 flex-1 space-y-3 border-t border-slate-100 pt-5 text-sm text-slate-600">
                {(plan.features || []).map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="font-bold text-emerald-600">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button disabled className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-500">
                  Current Plan
                </button>
              ) : isFreeDowngrade ? (
                <button
                  type="button"
                  onClick={downgradeToFree}
                  disabled={Boolean(busy) || billing.cancelAtPeriodEnd}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {billing.cancelAtPeriodEnd
                    ? "Downgrade Scheduled"
                    : busy === "downgrade"
                      ? "Updating plan…"
                      : "Downgrade to Free"}
                </button>
              ) : isLowerTier ? (
                <button disabled className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-500">
                  Available after current plan
                </button>
              ) : isOtherFreePlan ? (
                <button disabled className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-500">
                  Free plan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startCheckout(plan)}
                  disabled={Boolean(busy) || !plan.checkoutAvailable}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:bg-slate-300"
                >
                  {busy === `create:${plan.key}`
                    ? "Creating payment…"
                    : busy === `processing:${plan.key}`
                      ? "Processing payment…"
                      : busy === `verify:${plan.key}`
                        ? "Verifying payment…"
                        : currentPlan === "free"
                          ? `Upgrade to ${plan.name}`
                          : `Upgrade to ${plan.name}`}
                </button>
              )}
              {isBusy && (
                <p className="mt-2 text-center text-xs text-slate-500" role="status">
                  Please keep this page open while we securely process your payment.
                </p>
              )}
            </article>
          );
        })}
      </section>

      <p className="text-center text-xs leading-5 text-slate-500">
        Payments are processed securely by Razorpay. DocVault never stores card numbers,
        CVV, UPI PINs, or banking credentials. Plans do not auto-renew; renew from this
        page when you are ready.
      </p>
      <div className="text-center">
        <Link href="/dashboard" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
