import ManagerFilesClient from "./ManagerFilesClient";
import PermissionDenied from "@/components/User/UI/PermissionDenied";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

export default async function ManagerFilesPage() {
  const user = await getAuthenticatedUser();
  if (!(await hasPermission(user, "VIEW_USER_FILES"))) {
    return (
      <section className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PermissionDenied permission="VIEW_USER_FILES" />
      </section>
    );
  }
  return <ManagerFilesClient />;
}
