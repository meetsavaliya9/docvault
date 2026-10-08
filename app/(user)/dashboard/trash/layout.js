import { requirePagePermission } from "@/lib/permissions";
import PermissionDenied from "@/components/User/UI/PermissionDenied";

export default async function TrashLayout({ children }) {
  const allowed = await requirePagePermission("VIEW_TRASH");
  return allowed
    ? children
    : <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><PermissionDenied permission="VIEW_TRASH" /></main>;
}