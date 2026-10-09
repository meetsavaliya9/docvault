import ManagerBillingClient from "@/components/Manager/ManagerBillingClient";
import PermissionDenied from "@/components/User/UI/PermissionDenied";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ManagerSubscriptionsPage() {
  const user = await getAuthenticatedUser();
  if (!(await hasPermission(user, "VIEW_SUBSCRIPTIONS"))) {
    return (
      <section className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PermissionDenied permission="VIEW_SUBSCRIPTIONS" />
      </section>
    );
  }
  return <ManagerBillingClient kind="subscriptions" />;
}
