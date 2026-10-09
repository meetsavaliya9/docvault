import ManagerDashboardClient from "@/components/Manager/ManagerDashboardClient";
import PermissionDenied from "@/components/User/UI/PermissionDenied";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ManagerDashboardPage() {
  const user = await getAuthenticatedUser();
  if (!(await hasPermission(user, "VIEW_DASHBOARD"))) {
    return (
      <section className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PermissionDenied permission="VIEW_DASHBOARD" />
      </section>
    );
  }

  return <ManagerDashboardClient managerName={user.name || "Manager"} />;
}
