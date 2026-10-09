import ManagerBillingClient from "@/components/Manager/ManagerBillingClient";
import PermissionDenied from "@/components/User/UI/PermissionDenied";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ManagerPaymentsPage() {
  const user = await getAuthenticatedUser();
  if (!(await hasPermission(user, "VIEW_PAYMENTS"))) {
    return (
      <section className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PermissionDenied permission="VIEW_PAYMENTS" />
      </section>
    );
  }
  return <ManagerBillingClient kind="payments" />;
}
