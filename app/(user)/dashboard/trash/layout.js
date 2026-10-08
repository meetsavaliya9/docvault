import { requirePagePermission } from "@/lib/permissions";

export default async function TrashLayout({ children }) {
  await requirePagePermission("VIEW_TRASH");
  return children;
}