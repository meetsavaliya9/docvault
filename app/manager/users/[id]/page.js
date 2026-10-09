import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import PermissionDenied from "@/components/User/UI/PermissionDenied";
import { getAdminEmails } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ManagerUserDetailsPage({ params }) {
  const manager = await getAuthenticatedUser();
  if (!(await hasPermission(manager, "VIEW_USERS"))) {
    return (
      <section className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
        <PermissionDenied permission="VIEW_USERS" />
      </section>
    );
  }

  const { id } = await params;
  const viewFiles = await hasPermission(manager, "VIEW_USER_FILES");
  const viewSubscriptions = await hasPermission(manager, "VIEW_SUBSCRIPTIONS");
  const adminEmails = getAdminEmails();
  const user = await prisma.user.findFirst({
    where: {
      id,
      role: "USER",
      ...(adminEmails.length ? { email: { notIn: adminEmails } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      isBlocked: true,
      createdAt: true,
      ...(viewFiles
        ? { _count: { select: { documents: { where: { deleted: false } } } } }
        : {}),
      ...(viewSubscriptions
        ? {
            subscriptions: {
              where: {
                status: { in: ["active", "trialing"] },
                AND: [
                  { OR: [{ endDate: null }, { endDate: { gt: new Date() } }] },
                  { OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }] },
                ],
              },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                status: true,
                planKey: true,
                endDate: true,
                currentPeriodEnd: true,
                plan: { select: { name: true } },
              },
            },
          }
        : {}),
    },
  });
  if (!user) notFound();
  const subscription = viewSubscriptions ? user.subscriptions[0] || null : null;

  return (
    <section className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/manager/users"
        className="inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
      >
        ← Back to Users
      </Link>
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
          User details
        </p>
        <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {user.name || user.email}
        </h1>
        <p className="mt-1 break-all text-sm text-slate-500">{user.email}</p>
      </header>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Account status
          </dt>
          <dd className="mt-2 text-sm font-semibold capitalize text-slate-800">
            {user.isBlocked ? "Blocked" : "Active"}
          </dd>
        </div>
        {viewSubscriptions && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Current plan
              </dt>
              <dd className="mt-2 text-sm font-semibold text-slate-800">
                {subscription?.plan?.name || subscription?.planKey || "Free"}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Subscription status
              </dt>
              <dd className="mt-2 text-sm font-semibold capitalize text-slate-800">
                {subscription?.status || "Free"}
              </dd>
            </div>
          </>
        )}
        {viewFiles && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Active files
            </dt>
            <dd className="mt-2 text-sm font-semibold text-slate-800">
              {user._count.documents.toLocaleString()}
            </dd>
          </div>
        )}
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Joined
          </dt>
          <dd className="mt-2 text-sm font-semibold text-slate-800">
            {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(user.createdAt)}
          </dd>
        </div>
      </dl>
      {viewFiles ? (
        <Link
          href={`/manager/users/${encodeURIComponent(user.id)}/files`}
          className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          View user files
        </Link>
      ) : (
        <PermissionDenied permission="VIEW_USER_FILES" />
      )}
    </section>
  );
}
