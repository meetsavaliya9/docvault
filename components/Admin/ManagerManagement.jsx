"use client";

import { useEffect, useState } from "react";
import {
  PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  MANAGER_PERMISSION_GROUPS,
  PERMISSION_LABELS,
  setPermissionValue,
} from "@/lib/permissionConstants";

async function readResponse(response, action) {
  const body = await response.text();
  let result;
  try {
    result = body ? JSON.parse(body) : null;
  } catch {
    throw new Error(`Could not ${action}: the server returned an invalid response.`);
  }
  if (!result || !response.ok || result.success === false) {
    throw new Error(result?.error || `Could not ${action}.`);
  }
  return result;
}

export default function ManagerManagement() {
  const [configuration, setConfiguration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [permissionValues, setPermissionValues] = useState({});
  const [permissionError, setPermissionError] = useState("");
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/managers", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => readResponse(response, "load Manager configuration"))
      .then((result) => {
        setConfiguration(result);
        setError("");
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") {
          setError(loadError.message || "Could not load Manager configuration.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const loadPermissions = async (manager) => {
    setPermissionsOpen(true);
    setPermissionsLoading(true);
    setPermissionError("");
    setPermissionValues({});
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(manager.id)}/permissions`,
        { cache: "no-store" },
      );
      const result = await readResponse(response, "load Manager permissions");
      if (!result.permissions || typeof result.permissions !== "object") {
        throw new Error("The server returned an invalid permissions list.");
      }
      setPermissionValues(result.permissions);
    } catch (loadError) {
      setPermissionError(loadError.message || "Could not load Manager permissions.");
    } finally {
      setPermissionsLoading(false);
    }
  };

  const savePermissions = async () => {
    if (!configuration?.manager) return;
    setPermissionsSaving(true);
    setPermissionError("");
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(configuration.manager.id)}/permissions`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            permissions: permissionValues,
          }),
        },
      );
      const result = await readResponse(response, "save Manager permissions");
      setPermissionValues(result.permissions);
      setPermissionsOpen(false);
      setNotice(result.message || "Manager permissions saved.");
    } catch (saveError) {
      setPermissionError(saveError.message || "Could not save Manager permissions.");
    } finally {
      setPermissionsSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!manager) return;
    setUpdatingStatus(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/managers/${encodeURIComponent(manager.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: manager.isBlocked ? "unblock" : "block" }),
        },
      );
      const result = await readResponse(response, "update Manager access");
      setConfiguration((current) => ({
        ...current,
        manager: { ...current.manager, isBlocked: result.isBlocked },
      }));
      setNotice(result.message || "Manager access updated.");
    } catch (statusError) {
      setError(statusError.message || "Could not update Manager access.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const manager = configuration?.manager;
  const managerIsReady = manager?.role === "MANAGER";

  return (
    <section className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
          Access management
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Manager
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Manage the single configured Manager account and its existing DocVault
          permissions. Account identity is configured with <code>MANAGER_EMAIL</code>.
        </p>
      </header>

      {notice && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-slate-900">Configured account</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            This account is prepared by the secure Manager bootstrap command; existing credentials are preserved.
          </p>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500">Loading configured account…</p>
        ) : configuration?.configurationError ? (
          <div className="space-y-3 px-5 py-6">
            <p role="alert" className="text-sm text-amber-800">{configuration.configurationError}</p>
            <p className="text-sm text-slate-600">
              Set <code>MANAGER_EMAIL</code> in the environment and run{" "}
              <code>npm run manager:bootstrap</code> against the intended database.
            </p>
          </div>
        ) : !manager ? (
          <div className="space-y-3 px-5 py-6">
            <p className="text-sm text-slate-700">
              No account exists for <strong>{configuration?.configuredEmail}</strong>.
            </p>
            <p className="text-sm text-slate-500">
              Configure <code>MANAGER_PASSWORD</code> for first-time setup, then run{" "}
              <code>npm run manager:bootstrap</code>. The password is only used when
              creating the account.
            </p>
          </div>
        ) : (
          <article className="flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
                {(manager.name || manager.email).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {manager.name || manager.email}
                </p>
                <p className="truncate text-xs text-slate-500">{manager.email}</p>
                <p className="mt-1 text-xs">
                  Database role: <strong>{manager.role}</strong>
                  {" · "}
                  <span className={manager.isBlocked ? "font-medium text-rose-700" : "font-medium text-emerald-700"}>
                    {manager.isBlocked ? "Disabled" : "Active"}
                  </span>
                  {" · "}
                  {manager.accessibleUserCount} active user{manager.accessibleUserCount === 1 ? "" : "s"} in Manager scope
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={updatingStatus}
                onClick={toggleStatus}
                className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {updatingStatus ? "Saving…" : manager.isBlocked ? "Activate" : "Deactivate"}
              </button>
              <button
                type="button"
                disabled={!managerIsReady || manager.isBlocked}
                onClick={() => loadPermissions(manager)}
                className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Permissions
              </button>
            </div>
            {!managerIsReady && (
              <p role="alert" className="basis-full text-sm text-amber-800">
                The configured email belongs to a {manager.role} account. Run{" "}
                <code>npm run manager:bootstrap</code> to safely ensure its Manager
                database role.
              </p>
            )}
          </article>
        )}
      </section>

      {permissionsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPermissionsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="manager-permissions-title"
            className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="manager-permissions-title" className="text-lg font-bold text-slate-900">
                  Manager permissions
                </h2>
                <p className="mt-1 truncate text-sm text-slate-500">{manager?.email}</p>
              </div>
              <button
                type="button"
                aria-label="Close Manager permissions"
                onClick={() => setPermissionsOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="mt-5 max-h-[60vh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 px-4">
              {permissionsLoading ? (
                <p className="py-6 text-sm text-slate-500">Loading permissions…</p>
              ) : permissionError ? (
                <div role="alert" className="flex items-center justify-between gap-3 py-4 text-sm text-rose-700">
                  <span>{permissionError}</span>
                  <button type="button" onClick={() => loadPermissions(manager)} className="shrink-0 font-semibold text-blue-700 hover:underline">
                    Retry
                  </button>
                </div>
              ) : (
                <>
                <p className="py-4 text-sm text-slate-600">
                  Managers can be granted dashboard access and read-only access
                  to normal users, files, payments, subscriptions, and reports.
                  Account and system controls remain Admin-only.
                </p>
                {MANAGER_PERMISSION_GROUPS.map((group) => (
                  <section key={group.title} className="py-3">
                    <h3 className="text-sm font-semibold text-slate-800">{group.title}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">{group.description}</p>
                    <div className="mt-1 divide-y divide-slate-100">
                      {group.permissions.map((permission) => {
                        const enabled = permissionValues[permission] === true;
                        const disabled = permissionsLoading || getPermissionParents(permission).some(
                          (parent) => permissionValues[parent] !== true,
                        );
                        return (
                          <div key={permission} className="flex items-center justify-between gap-4 py-3">
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-slate-700">
                                {PERMISSION_LABELS[permission]}
                              </span>
                              {PERMISSION_DESCRIPTIONS[permission] && (
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  {PERMISSION_DESCRIPTIONS[permission]}
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={enabled}
                              aria-label={PERMISSION_LABELS[permission]}
                              disabled={disabled}
                              onClick={() => {
                                const nextEnabled = !enabled;
                                setPermissionValues((current) =>
                                  setPermissionValue(current, permission, nextEnabled),
                                );
                              }}
                              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${enabled ? "bg-blue-600" : "bg-slate-300"}`}
                            >
                              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
                </>
              )}
            </div>
            {permissionError && (
              <p role="alert" className="mt-3 text-sm text-rose-700">{permissionError}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPermissionsOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              {!permissionError && (
                <button
                  type="button"
                  disabled={permissionsLoading || permissionsSaving || Object.keys(permissionValues).length !== PERMISSIONS.length}
                  onClick={savePermissions}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {permissionsSaving ? "Saving…" : "Save permissions"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
