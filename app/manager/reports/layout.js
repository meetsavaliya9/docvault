import PermissionDenied from "@/components/User/UI/PermissionDenied";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

export default async function ManagerReportsLayout({ children }) {
  const user = await getAuthenticatedUser();
  const allowed = await hasPermission(user, "VIEW_REPORTS");
  return allowed ? (
    children
  ) : (
    <section className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PermissionDenied permission="VIEW_REPORTS" />
    </section>
  );
}
