import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { getUserRole } from "@/lib/permissions";

export default async function ManagerProfilePage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (getUserRole(user) !== "MANAGER") {
    redirect(getUserRole(user) === "ADMIN" ? "/admin" : "/dashboard");
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
          Manager workspace
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Profile
        </h1>
      </header>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Name
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">
              {user.name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Email
            </dt>
            <dd className="mt-1 break-all text-sm font-medium text-slate-800">
              {user.email}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Role
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">Manager</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
