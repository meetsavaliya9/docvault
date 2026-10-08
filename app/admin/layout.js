import { redirect } from "next/navigation";
import { getAuthenticatedAdmin } from "@/lib/auth/admin";
import AdminWorkspace from "@/components/Admin/AdminWorkspace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "DocVault Admin",
  description: "Manage DocVault users, documents, subscriptions, and payments.",
};

export default async function AdminLayout({ children }) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) redirect("/login");

  return <AdminWorkspace admin={admin}>{children}</AdminWorkspace>;
}
