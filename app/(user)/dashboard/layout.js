import { redirect } from "next/navigation";
import Sidebar from "@/components/User/Sidebar/Sidebar";
import ResponsiveDashboardNav from "@/components/User/Sidebar/ResponsiveDashboardNav";
import { VaultProvider } from "@/app/(user)/dashboard/lib/vaultContext";
import CommandPalette from "@/components/User/CommandPalette/CommandPalette";
import ToastMessage from "@/components/User/UI/ToastMessage";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { getUserPermissions, getUserRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }
  const role = getUserRole(user);
  if (role === "MANAGER") redirect("/manager");
  if (role === "ADMIN") redirect("/admin");
  const userPermissions = await getUserPermissions(user);
  return (
    <VaultProvider key={user.id} userId={user.id} userEmail={user.email || ""} userPermissions={userPermissions}>
      <div className="flex min-h-screen max-w-full overflow-x-hidden bg-slate-50/60 text-slate-900">
        <Sidebar userEmail={user.email || ""} />
        <div aria-hidden="true" className="hidden w-72 shrink-0 lg:block" />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden">
          <ResponsiveDashboardNav userEmail={user.email || ""} />
          <div className="flex-1 min-w-0 max-w-full overflow-x-hidden">
            {children}
          </div>
        </div>

        {/* Global Quick Search / Command Palette */}
        <CommandPalette />
        <ToastMessage />
      </div>
    </VaultProvider>
  );
}