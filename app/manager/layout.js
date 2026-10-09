import { redirect } from "next/navigation";
import ManagerWorkspace from "@/components/Manager/ManagerWorkspace";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { getUserPermissions, getUserRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "DocVault Manager",
  description: "Manage the DocVault workspace features assigned to you.",
};

export default async function ManagerLayout({ children }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const role = getUserRole(user);
  if (role !== "MANAGER") {
    redirect(role === "ADMIN" ? "/admin" : "/dashboard");
  }

  const permissions = await getUserPermissions(user);
  return (
    <ManagerWorkspace manager={user} permissions={permissions}>
      {children}
    </ManagerWorkspace>
  );
}
