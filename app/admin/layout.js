import { redirect } from "next/navigation";
import { getAuthenticatedAdmin } from "@/lib/auth/admin";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { getUserRole } from "@/lib/permissions";
import AdminWorkspace from "@/components/Admin/AdminWorkspace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "DocVault Admin",
  description: "Manage DocVault users, documents, subscriptions, and payments.",
};

export default async function AdminLayout({ children }) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    const user = await getAuthenticatedUser();
    if (!user) redirect("/login");
    const role = getUserRole(user);
    redirect(role === "MANAGER" ? "/manager" : role === "USER" ? "/dashboard" : "/login");
  }

  return <AdminWorkspace admin={admin}>{children}</AdminWorkspace>;
}
