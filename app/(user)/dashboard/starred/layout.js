import { requirePagePermission } from "@/lib/permissions";

export default async function StarredLayout({ children }) {
  await requirePagePermission("VIEW_STARRED");
  return children;
}