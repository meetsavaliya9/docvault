import { requirePagePermission } from "@/lib/permissions";
import PermissionDenied from "@/components/User/UI/PermissionDenied";
import DashboardHomeClient from "./DashboardHomeClient";

export default async function DashboardPage() {
  const allowed = await requirePagePermission("VIEW_DASHBOARD");
  return allowed
    ? <DashboardHomeClient />
    : <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><PermissionDenied permission="VIEW_DASHBOARD" /></main>;
}
