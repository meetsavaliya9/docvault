"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_UNITS = {
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

function formatPrice(minorUnits, currency) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(minorUnits / 100);
  } catch {
    return `${currency} ${(minorUnits / 100).toFixed(2)}`;
  }
}

function formatStorage(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes) || 0;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${units[unit]}`;
}

function createForm(plan = null, nextOrder = 0) {
  const storageLimitBytes = plan?.storageLimitBytes ?? 5 * STORAGE_UNITS.GB;
  const unit = storageLimitBytes >= STORAGE_UNITS.GB ? "GB" : "MB";
  return {
    name: plan?.name || "",
    price: plan ? String(plan.price / 100) : "",
    currency: plan?.currency || "INR",
    billingPeriod: plan?.billingPeriod || "monthly",
    description: plan?.description || "",
    features: plan ? [...plan.features] : [""],
    documentLimit: plan?.documentLimit === null ? "" : String(plan?.documentLimit ?? ""),
    storageLimitValue: String(storageLimitBytes / STORAGE_UNITS[unit]),
    storageUnit: unit,
    isActive: plan?.isActive ?? true,
    isRecommended: plan?.isRecommended ?? false,
    displayOrder: String(plan?.displayOrder ?? nextOrder),
    razorpayPlanId: plan?.razorpayPlanId || "",
  };
}

function validateForm(form) {
  if (!form.name.trim()) return "Plan name is required.";
  if (form.name.trim().length > 80) return "Plan name must be at most 80 characters.";
  if (
    !/^\d+(\.\d{1,2})?$/.test(form.price.trim()) ||
    !Number.isFinite(Number(form.price)) ||
    Number(form.price) < 0
  ) {
    return "Enter a valid non-negative price with up to two decimal places.";
  }
  if (!CURRENCIES.includes(form.currency)) return "Choose a supported currency.";
  if (!["monthly", "yearly"].includes(form.billingPeriod)) return "Choose a valid billing cycle.";
  if (!form.description.trim() || form.description.trim().length > 500) {
    return "Enter a plan description of at most 500 characters.";
  }
  if (
    !Number.isFinite(Number(form.storageLimitValue)) ||
    Number(form.storageLimitValue) <= 0 ||
    !STORAGE_UNITS[form.storageUnit]
  ) {
    return "Enter a valid positive storage limit.";
  }
  const storageBytes = Number(form.storageLimitValue) * STORAGE_UNITS[form.storageUnit];
  if (!Number.isSafeInteger(Math.round(storageBytes))) return "Storage limit is too large.";
  if (
    form.documentLimit.trim() &&
    (!/^\d+$/.test(form.documentLimit.trim()) ||
      !Number.isSafeInteger(Number(form.documentLimit)) ||
      Number(form.documentLimit) < 1)
  ) {
    return "Document limit must be a positive whole number or left blank for unlimited.";
  }
  if (!Number.isSafeInteger(Number(form.displayOrder)) || Number(form.displayOrder) < 0) {
    return "Display order must be a non-negative whole number.";
  }
  if (form.features.some((feature) => !feature.trim())) {
    return "Remove empty feature rows or enter a feature.";
  }
  const features = form.features.map((feature) => feature.trim()).filter(Boolean);
  if (Number(form.price) > 0 && features.length === 0) {
    return "Add at least one feature to a paid plan.";
  }
  if (form.razorpayPlanId.trim() && !/^plan_[A-Za-z0-9]+$/.test(form.razorpayPlanId.trim())) {
    return "Enter a valid Razorpay Plan ID or leave it blank.";
  }
  return "";
}

function PlanEditor({ plan, form, setForm, saving, onClose, onSave }) {
  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-editor-title"
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{plan ? "Plan settings" : "New subscription plan"}</p>
            <h2 id="plan-editor-title" className="mt-1 text-lg font-bold text-slate-900">{plan ? `Edit ${plan.name}` : "Add a plan"}</h2>
          </div>
          <button type="button" aria-label="Close plan editor" disabled={saving} onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">×</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Plan name
              <input autoFocus value={form.name} onChange={(event) => updateField("name", event.target.value)} maxLength={80} placeholder="Business" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Price
              <div className="mt-1.5 flex min-w-0">
                <span className="flex h-10 items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">{form.currency}</span>
                <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => updateField("price", event.target.value)} placeholder="799" className="h-10 min-w-0 flex-1 rounded-r-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
              </div>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Currency
              <select value={form.currency} onChange={(event) => updateField("currency", event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500">
                {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Billing cycle
              <select value={form.billingPeriod} onChange={(event) => updateField("billingPeriod", event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Description
              <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} maxLength={500} rows={2} placeholder="For small businesses and teams" className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
            </label>
            <div className="min-w-0">
              <label className="text-sm font-medium text-slate-700">Storage limit</label>
              <div className="mt-1.5 flex min-w-0 gap-2">
                <input type="number" min="0.01" step="any" value={form.storageLimitValue} onChange={(event) => updateField("storageLimitValue", event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
                <select value={form.storageUnit} onChange={(event) => updateField("storageUnit", event.target.value)} aria-label="Storage unit" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                  {Object.keys(STORAGE_UNITS).map((unit) => <option key={unit}>{unit}</option>)}
                </select>
              </div>
            </div>
            <label className="text-sm font-medium text-slate-700">
              Document limit
              <input type="number" min="1" step="1" value={form.documentLimit} onChange={(event) => updateField("documentLimit", event.target.value)} placeholder="Unlimited" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
              <span className="mt-1 block text-[11px] font-normal text-slate-500">Leave blank for unlimited documents.</span>
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Razorpay Plan ID <span className="font-normal text-slate-400">(optional)</span>
              <input value={form.razorpayPlanId} onChange={(event) => updateField("razorpayPlanId", event.target.value)} placeholder="plan_..." className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
              <span className="mt-1 block text-[11px] font-normal leading-5 text-slate-500">DocVault currently uses Razorpay Orders, which do not require a Razorpay Plan ID. This field is for mapping a separately configured recurring plan.</span>
            </label>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">Plan features</p>
                  <p className="text-xs text-slate-500">Add any number of features shown on the user pricing page.</p>
                </div>
                <button type="button" onClick={() => updateField("features", [...form.features, ""])} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">+ Add feature</button>
              </div>
              <div className="mt-3 space-y-2">
                {form.features.map((feature, index) => (
                  <div key={index} className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-bold text-emerald-600">✓</span>
                    <input value={feature} onChange={(event) => updateField("features", form.features.map((value, featureIndex) => featureIndex === index ? event.target.value : value))} maxLength={120} placeholder={index === 0 ? "Priority support" : "Feature description"} aria-label={`Feature ${index + 1}`} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
                    <button type="button" aria-label={`Remove feature ${index + 1}`} onClick={() => updateField("features", form.features.filter((_, featureIndex) => featureIndex !== index))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">×</button>
                  </div>
                ))}
              </div>
            </div>
            <label className="text-sm font-medium text-slate-700">
              Display order
              <input type="number" min="0" step="1" value={form.displayOrder} onChange={(event) => updateField("displayOrder", event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
            </label>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 self-center">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} className="h-4 w-4 accent-blue-600" />
                Active
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.isRecommended} onChange={(event) => updateField("isRecommended", event.target.checked)} className="h-4 w-4 accent-blue-600" />
                Mark as popular
              </label>
            </div>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={saving} onClick={onSave} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50">{saving ? "Saving…" : plan ? "Save changes" : "Create plan"}</button>
        </footer>
      </section>
    </div>
  );
}

export default function AdminPricingPage() {
  const [plans, setPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [form, setForm] = useState(null);
  const [confirmPlan, setConfirmPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPlans = useCallback(async (signal) => {
    const response = await fetch("/api/admin/pricing", { cache: "no-store", signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load pricing plans.");
    setPlans(result.plans || []);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      loadPlans(controller.signal)
        .catch((loadError) => {
          if (loadError.name !== "AbortError") setError(loadError.message || "Could not load pricing plans.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });
    return () => controller.abort();
  }, [loadPlans]);

  const beginCreate = () => {
    setEditingPlan(null);
    setForm(createForm(null, plans.length ? Math.max(...plans.map((plan) => plan.displayOrder)) + 1 : 0));
    setError("");
    setNotice("");
  };

  const beginEdit = (plan) => {
    setEditingPlan(plan);
    setForm(createForm(plan));
    setError("");
    setNotice("");
  };

  const closeEditor = () => {
    if (saving) return;
    setEditingPlan(null);
    setForm(null);
  };

  const savePlan = async () => {
    if (!form) return;
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    const price = Number(form.price);
    const payload = {
      name: form.name.trim(),
      price: Math.round(price * 100),
      currency: form.currency,
      billingPeriod: form.billingPeriod,
      description: form.description.trim(),
      features: form.features.map((feature) => feature.trim()).filter(Boolean),
      documentLimit: form.documentLimit.trim() ? Number(form.documentLimit) : null,
      storageLimitBytes: Math.round(Number(form.storageLimitValue) * STORAGE_UNITS[form.storageUnit]),
      isActive: form.isActive,
      isRecommended: form.isRecommended,
      displayOrder: Number(form.displayOrder),
      razorpayPlanId: form.razorpayPlanId.trim() || null,
    };

    if (!Number.isSafeInteger(payload.price)) {
      setError("Price is too large.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        editingPlan
          ? `/api/admin/pricing/${encodeURIComponent(editingPlan.id)}`
          : "/api/admin/pricing",
        {
          method: editingPlan ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save this plan.");
      await loadPlans();
      setNotice(result.message || (editingPlan ? "Plan updated." : "Plan created."));
      setEditingPlan(null);
      setForm(null);
    } catch (saveError) {
      setError(saveError.message || "Could not save this plan.");
    } finally {
      setSaving(false);
    }
  };

  const togglePlanStatus = async (plan) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/pricing/${encodeURIComponent(plan.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update this plan.");
      await loadPlans();
      setNotice(`${plan.name} is now ${!plan.isActive ? "active" : "inactive"}. Existing subscribers keep their plan.`);
    } catch (toggleError) {
      setError(toggleError.message || "Could not update this plan.");
    } finally {
      setSaving(false);
    }
  };

  const removePlan = async () => {
    if (!confirmPlan) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/pricing/${encodeURIComponent(confirmPlan.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not remove this plan.");
      await loadPlans();
      setNotice(result.message || `${confirmPlan.name} was removed.`);
      setConfirmPlan(null);
    } catch (removeError) {
      setError(removeError.message || "Could not remove this plan.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="space-y-5" aria-label="Loading plans">
        <div className="h-16 animate-pulse rounded-xl bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-xl bg-white shadow-sm" />)}</div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Admin settings</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Subscription plans</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Manage plan pricing, entitlements, visibility, and display order. Changes apply to new purchases; existing subscribers are not modified.</p>
        </div>
        <button type="button" onClick={beginCreate} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
          <span className="text-lg leading-none">+</span> Add New Plan
        </button>
      </header>

      {notice && <div role="status" className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss success message">×</button></div>}
      {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error message">×</button></div>}

      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl font-medium text-blue-700">+</span>
          <h2 className="mt-4 text-base font-semibold text-slate-900">No subscription plans yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Create a plan to make it available to users on the subscription page.</p>
          <button type="button" onClick={beginCreate} className="mt-5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Create your first plan</button>
        </div>
      ) : (
        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.id} className={`relative flex min-w-0 flex-col rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md ${plan.isRecommended ? "border-blue-300 ring-1 ring-blue-100" : "border-slate-200"}`}>
              {plan.isRecommended && <span className="absolute -top-2.5 right-4 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Popular</span>}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-bold text-slate-900">{plan.name}</h2>
                    {plan.isRecommended && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Featured</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{plan.slug}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${plan.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{plan.isActive ? "Active" : "Inactive"}</span>
              </div>
              <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
                {formatPrice(plan.price, plan.currency)}
                <span className="ml-1 text-sm font-medium text-slate-500">/ {plan.billingPeriod}</span>
              </p>
              <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{plan.description}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-slate-600">
                <span className="rounded-md bg-slate-50 px-2.5 py-1.5">{plan.documentLimit === null ? "Unlimited" : plan.documentLimit} documents</span>
                <span className="rounded-md bg-slate-50 px-2.5 py-1.5">{formatStorage(plan.storageLimitBytes)} storage</span>
              </div>
              <ul className="my-5 flex-1 space-y-2 border-t border-slate-100 pt-4">
                {plan.features.map((feature, index) => <li key={`${index}-${feature}`} className="flex min-w-0 gap-2 text-sm text-slate-600"><span className="shrink-0 font-bold text-emerald-600">✓</span><span className="break-words">{feature}</span></li>)}
                {plan.features.length === 0 && <li className="text-sm text-slate-400">No additional features listed.</li>}
              </ul>
              {plan.razorpayPlanId && <p className="mb-4 truncate text-[11px] text-slate-500" title={plan.razorpayPlanId}>Razorpay Plan: <span className="font-mono">{plan.razorpayPlanId}</span></p>}
              <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button type="button" disabled={saving} onClick={() => beginEdit(plan)} className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">Edit</button>
                <button type="button" disabled={saving || (plan.slug.toLowerCase() === "free" && plan.isActive)} onClick={() => togglePlanStatus(plan)} className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">{plan.isActive ? "Disable" : "Enable"}</button>
                {plan.slug.toLowerCase() !== "free" && <button type="button" disabled={saving} onClick={() => setConfirmPlan(plan)} className="ml-auto rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Delete / archive</button>}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-5 text-blue-900">
        Active plans appear automatically on the user subscription page. Disabling a plan prevents new purchases but does not cancel or downgrade existing subscribers. DocVault creates Razorpay Orders using the server-side account credentials; a Razorpay Plan ID is optional for recurring-plan integrations.
      </p>

      {form && <PlanEditor plan={editingPlan} form={form} setForm={setForm} saving={saving} onClose={closeEditor} onSave={savePlan} />}

      {confirmPlan && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setConfirmPlan(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="remove-plan-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Remove plan</p>
            <h2 id="remove-plan-title" className="mt-1 text-lg font-bold text-slate-900">Delete or archive {confirmPlan.name}?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">If this plan has subscriptions or payment history, DocVault will archive it to preserve those records. Otherwise, it can be permanently deleted.</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={saving} onClick={() => setConfirmPlan(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={saving} onClick={removePlan} className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{saving ? "Removing…" : "Continue"}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
