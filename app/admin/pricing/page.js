"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_UNITS = {
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

function formatPrice(minorUnits, currency) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

function createForm(plan) {
  const unit = plan.storageLimitBytes >= 1024 ** 3 ? "GB" : "MB";
  return {
    name: plan.name,
    price: (plan.price / 100).toFixed(2).replace(/\.00$/, ""),
    currency: plan.currency,
    billingPeriod: plan.billingPeriod,
    description: plan.description,
    features: plan.features.join("\n"),
    documentLimit: plan.documentLimit === null ? "" : String(plan.documentLimit),
    storageLimitValue: String(plan.storageLimitBytes / STORAGE_UNITS[unit]),
    storageUnit: unit,
    isActive: plan.isActive,
    isRecommended: plan.isRecommended,
    displayOrder: String(plan.displayOrder),
  };
}

function validateForm(plan, form) {
  if (!form.name.trim()) return "Plan name is required.";
  if (
    !/^\d+(\.\d{1,2})?$/.test(form.price.trim()) ||
    !Number.isFinite(Number(form.price)) ||
    Number(form.price) < 0
  ) {
    return "Enter a valid non-negative plan price.";
  }
  if (plan.slug === "free" && Number(form.price) !== 0) {
    return "The Free plan must have a price of zero.";
  }
  if (plan.slug !== "free" && Number(form.price) <= 0) {
    return "Paid plans must have a positive price.";
  }
  if (!["monthly", "yearly"].includes(form.billingPeriod)) {
    return "Choose a valid billing period.";
  }
  if (!Number.isFinite(Number(form.storageLimitValue)) || Number(form.storageLimitValue) <= 0) {
    return "Enter a valid positive storage limit.";
  }
  const storageBytes = Number(form.storageLimitValue) * STORAGE_UNITS[form.storageUnit];
  if (!Number.isSafeInteger(Math.round(storageBytes))) return "Storage limit is too large.";
  if (
    form.documentLimit.trim() &&
    (!Number.isSafeInteger(Number(form.documentLimit)) || Number(form.documentLimit) < 1)
  ) {
    return "Document limit must be a positive whole number or left blank for unlimited.";
  }
  if (
    !Number.isSafeInteger(Number(form.displayOrder)) ||
    Number(form.displayOrder) < 0 ||
    Number(form.displayOrder) > 10000
  ) {
    return "Display order must be a whole number from 0 to 10000.";
  }
  return "";
}

export default function AdminPricingPage() {
  const [plans, setPlans] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPlans = useCallback(async () => {
    const response = await fetch("/api/admin/pricing", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load pricing plans.");
    setPlans(result.plans || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/pricing", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load pricing plans.");
        return result;
      })
      .then((result) => {
        if (!cancelled) setPlans(result.plans || []);
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
  }, [loadPlans]);

  const beginEdit = (plan) => {
    setEditingId(plan.id);
    setForm(createForm(plan));
    setError("");
    setNotice("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(null);
  };

  const savePlan = async (plan, changes = null) => {
    const formData = changes || form;
    if (!formData) return;
    const validationError = validateForm(plan, formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    const price = Number(formData.price);
    const payload = {
      name: formData.name.trim(),
      price: Math.round(price * 100),
      currency: formData.currency,
      billingPeriod: formData.billingPeriod,
      description: formData.description.trim(),
      features: formData.features.split("\n").map((feature) => feature.trim()).filter(Boolean),
      documentLimit: formData.documentLimit.trim() ? Number(formData.documentLimit) : null,
      storageLimitBytes: Math.round(
        Number(formData.storageLimitValue) * STORAGE_UNITS[formData.storageUnit]
      ),
      isActive: formData.isActive,
      isRecommended: formData.isRecommended,
      displayOrder: Number(formData.displayOrder),
    };

    if (!Number.isSafeInteger(payload.price)) {
      setError("Price must be a valid amount with at most two decimal places.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/pricing/${encodeURIComponent(plan.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save this plan.");
      await loadPlans();
      setNotice(result.message || "Pricing plan saved.");
      cancelEdit();
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
      setNotice(
        `${plan.name} is now ${!plan.isActive ? "active" : "inactive"}. Existing subscriptions are unchanged.`
      );
    } catch (toggleError) {
      setError(toggleError.message || "Could not update this plan.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading subscription pricing…
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
          Admin settings
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Subscription Pricing
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Manage plan details, checkout prices, feature lists, and server-enforced
          document and storage limits.
        </p>
      </header>

      {notice && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </p>
      )}

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          No subscription plans were found. Run <code>npm run db:seed</code> to add
          the initial Free, Plus, and Pro plans.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {plans.map((plan) => {
            const isEditing = editingId === plan.id;
            const planForm = isEditing ? form : null;
            return (
              <article
                key={plan.id}
                className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-extrabold text-slate-900">{plan.name}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        {plan.slug}
                      </span>
                      {plan.isRecommended && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-2xl font-extrabold text-slate-900">
                      {formatPrice(plan.price, plan.currency)}
                      <span className="ml-1 text-sm font-medium text-slate-500">
                        / {plan.billingPeriod}
                      </span>
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                    plan.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {isEditing && planForm ? (
                  <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
                    <label className="min-w-0 text-sm font-semibold text-slate-700">
                      Plan name
                      <input
                        value={planForm.name}
                        onChange={(event) => updateField("name", event.target.value)}
                        maxLength={80}
                        className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 font-normal"
                      />
                    </label>
                    <label className="min-w-0 text-sm font-semibold text-slate-700">
                      Price (major currency units)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={planForm.price}
                        disabled={plan.slug === "free"}
                        onChange={(event) => updateField("price", event.target.value)}
                        className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 font-normal disabled:bg-slate-100"
                      />
                    </label>
                    <label className="min-w-0 text-sm font-semibold text-slate-700">
                      Currency
                      <select
                        value={planForm.currency}
                        onChange={(event) => updateField("currency", event.target.value)}
                        className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                      >
                        {CURRENCIES.map((currency) => (
                          <option key={currency} value={currency}>{currency}</option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-0 text-sm font-semibold text-slate-700">
                      Billing period
                      <select
                        value={planForm.billingPeriod}
                        onChange={(event) => updateField("billingPeriod", event.target.value)}
                        className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </label>
                    <label className="min-w-0 text-sm font-semibold text-slate-700 sm:col-span-2">
                      Description
                      <textarea
                        value={planForm.description}
                        onChange={(event) => updateField("description", event.target.value)}
                        maxLength={500}
                        rows={2}
                        className="mt-1 w-full min-w-0 resize-y rounded-lg border border-slate-300 px-3 py-2 font-normal"
                      />
                    </label>
                    <label className="min-w-0 text-sm font-semibold text-slate-700 sm:col-span-2">
                      Features (one per line)
                      <textarea
                        value={planForm.features}
                        onChange={(event) => updateField("features", event.target.value)}
                        rows={4}
                        className="mt-1 w-full min-w-0 resize-y rounded-lg border border-slate-300 px-3 py-2 font-normal"
                      />
                    </label>
                    <label className="min-w-0 text-sm font-semibold text-slate-700">
                      Document limit
                      <input
                        type="number"
                        min="1"
                        value={planForm.documentLimit}
                        onChange={(event) => updateField("documentLimit", event.target.value)}
                        placeholder="Blank means unlimited"
                        className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 font-normal"
                      />
                    </label>
                    <div className="min-w-0">
                      <label className="text-sm font-semibold text-slate-700">
                        Storage limit
                      </label>
                      <div className="mt-1 flex min-w-0 gap-2">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={planForm.storageLimitValue}
                          onChange={(event) => updateField("storageLimitValue", event.target.value)}
                          className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 font-normal"
                        />
                        <select
                          value={planForm.storageUnit}
                          onChange={(event) => updateField("storageUnit", event.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-2 font-normal"
                          aria-label="Storage unit"
                        >
                          {Object.keys(STORAGE_UNITS).map((unit) => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <label className="min-w-0 text-sm font-semibold text-slate-700">
                      Display order
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        step="1"
                        value={planForm.displayOrder}
                        onChange={(event) => updateField("displayOrder", event.target.value)}
                        className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 font-normal"
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-span-2">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={planForm.isActive}
                          onChange={(event) => updateField("isActive", event.target.checked)}
                          className="accent-blue-600"
                        />
                        Active
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={planForm.isRecommended}
                          onChange={(event) => updateField("isRecommended", event.target.checked)}
                          className="accent-blue-600"
                        />
                        Recommended
                      </label>
                    </div>
                    <div className="flex flex-col-reverse gap-2 pt-1 sm:col-span-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving}
                        className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => savePlan(plan)}
                        disabled={saving}
                        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-slate-600">{plan.description}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                      <p><span className="text-slate-500">Documents:</span>{" "}
                        <span className="font-semibold">{plan.documentLimit ?? "Unlimited"}</span>
                      </p>
                      <p><span className="text-slate-500">Storage:</span>{" "}
                        <span className="font-semibold">{formatStorage(plan.storageLimitBytes)}</span>
                      </p>
                    </div>
                    <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <span className="font-bold text-emerald-600">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => beginEdit(plan)}
                        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePlanStatus(plan)}
                        disabled={saving}
                        className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving
                          ? "Updating…"
                          : plan.isActive
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
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
