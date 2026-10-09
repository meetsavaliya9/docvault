import ManagerUsersClient from "@/components/Manager/ManagerUsersClient";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import PermissionDenied from "@/components/User/UI/PermissionDenied";

export default async function ManagerUsersPage() {
  const user = await getAuthenticatedUser();
  const canViewUsers = await hasPermission(user, "VIEW_USERS");
  if (!canViewUsers) {
    return (
      <section className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PermissionDenied permission="VIEW_USERS" />
      </section>
    );
  }
  const canViewUserFiles = await hasPermission(user, "VIEW_USER_FILES");
  const canViewSubscriptions = await hasPermission(user, "VIEW_SUBSCRIPTIONS");
  return (
    <ManagerUsersClient
      canViewUserFiles={canViewUserFiles}
      canViewSubscriptions={canViewSubscriptions}
      panelPath="/manager/users"
    />
  );
}
